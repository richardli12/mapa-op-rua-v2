/**
 * Fontes de ruas do sistema.
 *
 * O sistema combina duas bases independentes para montar a lista de ruas:
 *
 * 1. Brasil Aberto (`/v1/streets/{districtId}`) — derivada do cadastro de CEP
 *    dos Correios. Só contém ruas com CEP próprio, o que deixa buracos grandes
 *    em cidades que usam "CEP geral" para o bairro inteiro.
 * 2. OpenStreetMap (Nominatim + Overpass) — a mesma base que desenha o mapa na
 *    tela, então traz exatamente as ruas que o usuário está enxergando.
 *
 * As duas listas são unidas e deduplicadas por `mergeStreetLists`.
 */

export type StreetSource = "cep" | "osm";

export interface StreetCandidate {
  id?: number;
  name: string;
  source: StreetSource;
}

export interface StreetOption {
  id: number;
  name: string;
  source: StreetSource;
}

const BRASIL_ABERTO_BASE = "https://api.brasilaberto.com/v1";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";

const NOMINATIM_TIMEOUT_MS = 10000;
const OVERPASS_TIMEOUT_MS = 25000;
const CEP_TIMEOUT_MS = 12000;

/** Raio usado quando o bairro está mapeado como ponto, e não como área. */
const FALLBACK_RADIUS_METERS = 1500;

/**
 * Espera curta antes de consultar o Nominatim.
 *
 * O painel de endereço dispara um geocode do bairro no mesmo instante em que a
 * lista de ruas é carregada, e a política de uso do Nominatim pede no máximo
 * uma requisição por vez. A pausa separa as duas chamadas e ainda funciona como
 * debounce quando o usuário troca de bairro várias vezes seguidas — nesse caso
 * o `AbortSignal` cancela a busca antes mesmo de ela sair.
 */
const NOMINATIM_POLITENESS_DELAY_MS = 600;

/** Ids de área do Overpass: relações somam 3.6e9 e ways somam 2.4e9 ao id OSM. */
const OVERPASS_RELATION_OFFSET = 3600000000;
const OVERPASS_WAY_OFFSET = 2400000000;

/** Ids sintéticos para ruas vindas do OSM, que não têm id na base de CEP. */
const OSM_ID_OFFSET = 900000000;

/**
 * Tipos de via do OSM que são rua de verdade. Fica de fora o que existe no mapa
 * mas ninguém informaria como endereço: calçada, trilha, ciclovia, escadaria,
 * viela de serviço e estrada de terra sem uso urbano.
 */
const STREET_HIGHWAY_TYPES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
  "pedestrian",
  "road",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);

/**
 * Abreviações de tipo de logradouro, normalizadas para uma forma única. É o que
 * permite reconhecer que "R. Marabá" (base de CEP) e "Rua Marabá" (OSM) são a
 * mesma rua.
 */
const STREET_TYPE_ALIASES: Record<string, string> = {
  r: "rua",
  rua: "rua",
  av: "avenida",
  avn: "avenida",
  avenida: "avenida",
  tv: "travessa",
  trav: "travessa",
  travessa: "travessa",
  pc: "praca",
  pca: "praca",
  praca: "praca",
  al: "alameda",
  alameda: "alameda",
  rod: "rodovia",
  rodovia: "rodovia",
  est: "estrada",
  estrada: "estrada",
  lgo: "largo",
  largo: "largo",
  cj: "conjunto",
  conj: "conjunto",
  conjunto: "conjunto",
  vl: "vila",
  vila: "vila",
  bc: "beco",
  beco: "beco",
  ld: "ladeira",
  ladeira: "ladeira",
  psg: "passagem",
  passagem: "passagem",
  vd: "viaduto",
  viaduto: "viaduto",
  lot: "loteamento",
  loteamento: "loteamento",
};

const removeAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Quebra o nome da rua em tipo de logradouro + núcleo do nome, para comparação.
 *
 * "Rua Tiradentes 69" e "Rua Tiradentes" viram o mesmo par, porque o número no
 * fim é o imóvel que ganhou CEP próprio, não parte do nome. Já "Rua 15" é
 * preservado inteiro: ali o número é o nome da rua.
 */
export const parseStreetName = (raw: string): { type: string; core: string } => {
  const normalized = removeAccents(raw)
    .toLowerCase()
    .replace(/[.,;/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let tokens = normalized.split(" ").filter(Boolean);
  let type = "";

  if (tokens.length > 1 && STREET_TYPE_ALIASES[tokens[0]]) {
    type = STREET_TYPE_ALIASES[tokens[0]];
    tokens = tokens.slice(1);
  }

  const hasWord = tokens.some((token) => /[a-z]/.test(token));
  if (hasWord) {
    while (tokens.length > 1 && /^\d+$/.test(tokens[tokens.length - 1])) {
      tokens.pop();
    }
  }

  return { type, core: tokens.join(" ") };
};

/**
 * Une listas de ruas de fontes diferentes sem repetir nenhuma.
 *
 * A comparação é feita sobre o par tipo+núcleo devolvido por `parseStreetName`,
 * então "R. Marabá" e "Rua Marabá" contam como uma rua só. Nomes sem tipo de
 * logradouro ("Marabá") casam com qualquer tipo, já que a fonte simplesmente
 * omitiu essa informação. Tipos diferentes e explícitos são mantidos separados,
 * porque "Rua Boa Vista" e "Travessa Boa Vista" são endereços distintos.
 *
 * A ordem das listas importa: a primeira ocorrência de cada rua é a que fica,
 * então passe primeiro a fonte cujo nome você prefere exibir.
 */
export const mergeStreetLists = (lists: StreetCandidate[][]): StreetOption[] => {
  const typesByCore = new Map<string, Set<string>>();
  const indexByTypeAndCore = new Map<string, number>();
  const firstIndexByCore = new Map<string, number>();
  const merged: StreetOption[] = [];
  let osmSequence = 0;

  for (const list of lists) {
    for (const candidate of list) {
      const name = candidate.name?.trim();
      if (!name) continue;

      const { type, core } = parseStreetName(name);
      if (!core) continue;

      const knownTypes = typesByCore.get(core);
      if (knownTypes) {
        const alreadyListed =
          type === "" || knownTypes.has("") || knownTypes.has(type);
        if (alreadyListed) {
          const existingIndex =
            indexByTypeAndCore.get(`${core}::${type}`) ??
            firstIndexByCore.get(core);
          if (existingIndex !== undefined) {
            preferCleanerName(merged[existingIndex], name);
          }
          continue;
        }
        knownTypes.add(type);
      } else {
        typesByCore.set(core, new Set([type]));
      }

      merged.push({
        id: candidate.id ?? OSM_ID_OFFSET + osmSequence++,
        name,
        source: candidate.source,
      });

      const index = merged.length - 1;
      indexByTypeAndCore.set(`${core}::${type}`, index);
      if (!firstIndexByCore.has(core)) firstIndexByCore.set(core, index);
    }
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

/**
 * Escolhe qual dos dois nomes da mesma rua fica visível para o usuário.
 *
 * A base de CEP grava o número do imóvel junto do nome quando o CEP é de um
 * endereço específico ("Rua Tiradentes 69"). Quando a outra fonte traz o nome
 * sem esse resto, ele é preferido — é o nome que a pessoa reconhece.
 */
const preferCleanerName = (entry: StreetOption, candidateName: string) => {
  const entryHasHouseNumber = /\s\d+$/.test(entry.name);
  const candidateHasHouseNumber = /\s\d+$/.test(candidateName);
  if (entryHasHouseNumber && !candidateHasHouseNumber) {
    entry.name = candidateName;
  }
};

const fetchWithTimeout = async (
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  const callerSignal = init?.signal;

  callerSignal?.addEventListener("abort", abortFromCaller);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
};

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

/** Cancelamento é fluxo normal (o usuário trocou de bairro), não é erro. */
const isAbort = (err: unknown) =>
  err instanceof Error && err.name === "AbortError";

/** Ruas com CEP próprio cadastrado no bairro, via Brasil Aberto. */
export const fetchCepStreets = async (
  districtId: number | string,
  signal?: AbortSignal,
): Promise<StreetCandidate[]> => {
  try {
    const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const response = await fetchWithTimeout(
      `${BRASIL_ABERTO_BASE}/streets/${districtId}`,
      CEP_TIMEOUT_MS,
      { headers, signal },
    );
    if (!response.ok) return [];

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.result)) return [];

    return payload.result
      .filter((street: any) => street && typeof street.name === "string")
      .map((street: any) => ({
        id: typeof street.id === "number" ? street.id : undefined,
        name: street.name,
        source: "cep" as const,
      }));
  } catch (err) {
    if (!isAbort(err)) {
      console.warn("Não foi possível carregar as ruas da base de CEP:", err);
    }
    return [];
  }
};

/**
 * Ruas desenhadas no mapa dentro do bairro, via OpenStreetMap.
 *
 * Primeiro o Nominatim localiza o bairro. Quando ele está mapeado como área
 * (relação ou way fechado), a busca no Overpass é limitada a essa área. Quando
 * está mapeado apenas como ponto — comum em cidades menores — cai para um raio
 * fixo em volta do ponto.
 */
export const fetchOsmStreets = async (
  bairro: string,
  cidade: string,
  uf: string,
  signal?: AbortSignal,
): Promise<StreetCandidate[]> => {
  if (!bairro?.trim()) return [];

  try {
    await wait(NOMINATIM_POLITENESS_DELAY_MS, signal);

    const query = [bairro, cidade, uf, "Brasil"]
      .filter((part) => part && String(part).trim())
      .join(", ");

    const placeResponse = await fetchWithTimeout(
      `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      NOMINATIM_TIMEOUT_MS,
      { signal },
    );
    if (!placeResponse.ok) return [];

    const places = await placeResponse.json();
    if (!Array.isArray(places) || places.length === 0) return [];

    const place = places[0];
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    let areaFilter: string;
    if (place.osm_type === "relation" && place.osm_id) {
      areaFilter = `(area:${OVERPASS_RELATION_OFFSET + Number(place.osm_id)})`;
    } else if (place.osm_type === "way" && place.osm_id) {
      areaFilter = `(area:${OVERPASS_WAY_OFFSET + Number(place.osm_id)})`;
    } else {
      areaFilter = `(around:${FALLBACK_RADIUS_METERS},${lat},${lng})`;
    }

    const overpassQuery = `[out:json][timeout:${Math.floor(OVERPASS_TIMEOUT_MS / 1000)}];way["highway"]["name"]${areaFilter};out tags;`;

    const overpassResponse = await fetchWithTimeout(
      `${OVERPASS_BASE}?data=${encodeURIComponent(overpassQuery)}`,
      OVERPASS_TIMEOUT_MS,
      { signal },
    );
    if (!overpassResponse.ok) return [];

    const result = await overpassResponse.json();
    if (!result || !Array.isArray(result.elements)) return [];

    return result.elements
      .filter(
        (element: any) =>
          element?.tags?.name &&
          STREET_HIGHWAY_TYPES.has(element.tags.highway),
      )
      .map((element: any) => ({
        name: String(element.tags.name).trim(),
        source: "osm" as const,
      }));
  } catch (err) {
    if (!isAbort(err)) {
      console.warn("Não foi possível carregar as ruas do mapa (OSM):", err);
    }
    return [];
  }
};
