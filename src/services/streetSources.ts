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

/** Caixa geográfica, nos limites que o Overpass e o Nominatim usam. */
export interface GeoBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface NeighborhoodArea {
  center: { lat: number; lng: number };
  box: GeoBox;
}

export interface StreetGeometry {
  name: string;
  center: { lat: number; lng: number };
  lines: [number, number][][];
}

const BRASIL_ABERTO_BASE = "https://api.brasilaberto.com/v1";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";

const NOMINATIM_TIMEOUT_MS = 10000;
const OVERPASS_TIMEOUT_MS = 25000;
const CEP_TIMEOUT_MS = 12000;

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

/**
 * Meia-altura mínima da caixa de busca, em graus (~1,3 km).
 *
 * Quando o bairro está mapeado como ponto, o Nominatim devolve uma caixa de
 * poucos metros, que não pegaria rua nenhuma. Nesse caso a caixa é expandida
 * até este mínimo em volta do centro.
 */
const MIN_BBOX_HALF_SPAN_DEG = 0.012;

/** Tipos de lugar que o Nominatim usa para bairro, em ordem de preferência. */
const PLACE_TYPE_PRIORITY = [
  "suburb",
  "neighbourhood",
  "quarter",
  "city_district",
  "district",
  "residential",
  "village",
  "hamlet",
  "town",
];

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
 * Escolhe o resultado do Nominatim que realmente é o bairro procurado.
 *
 * Pegar o primeiro da lista erra em nomes repetidos pelo país: buscar o bairro
 * "Rio Verde" traz antes a cidade de Rio Verde, em Goiás. Um resultado com cara
 * de bairro vem primeiro; se nenhum tiver, sobra o primeiro mesmo.
 */
const pickBestPlace = (places: any[]) => {
  for (const wanted of PLACE_TYPE_PRIORITY) {
    const match = places.find(
      (place) => place?.type === wanted || place?.addresstype === wanted,
    );
    if (match) return match;
  }
  return places[0];
};

/** Amplia a caixa em todas as direções, em graus. */
export const expandBox = (box: GeoBox, margin: number): GeoBox => ({
  south: box.south - margin,
  west: box.west - margin,
  north: box.north + margin,
  east: box.east + margin,
});

/** Diz se um ponto cai dentro da caixa. */
export const isInsideBox = (
  box: GeoBox,
  lat: number,
  lng: number,
): boolean =>
  lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;

/**
 * Caixa de busca do bairro, no formato que o Overpass espera, garantindo um
 * tamanho mínimo utilizável.
 */
const toSearchBox = (place: any): GeoBox | null => {
  const lat = parseFloat(place?.lat);
  const lng = parseFloat(place?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Nominatim devolve boundingbox como [sul, norte, oeste, leste].
  const raw = Array.isArray(place?.boundingbox)
    ? place.boundingbox.map((value: string) => parseFloat(value))
    : [];
  const hasBox = raw.length === 4 && raw.every((v: number) => Number.isFinite(v));

  const south = hasBox ? Math.min(raw[0], raw[1]) : lat;
  const north = hasBox ? Math.max(raw[0], raw[1]) : lat;
  const west = hasBox ? Math.min(raw[2], raw[3]) : lng;
  const east = hasBox ? Math.max(raw[2], raw[3]) : lng;

  return {
    south: Math.min(south, lat - MIN_BBOX_HALF_SPAN_DEG),
    north: Math.max(north, lat + MIN_BBOX_HALF_SPAN_DEG),
    west: Math.min(west, lng - MIN_BBOX_HALF_SPAN_DEG),
    east: Math.max(east, lng + MIN_BBOX_HALF_SPAN_DEG),
  };
};

/**
 * Cache dos bairros já localizados. A caixa do bairro é consultada tanto para
 * listar as ruas quanto para localizar cada rua escolhida, e ela não muda
 * enquanto o usuário mexe no painel.
 */
const neighborhoodAreaCache = new Map<string, NeighborhoodArea | null>();

/**
 * Localiza o bairro e devolve seu centro e a caixa que o envolve.
 *
 * Essa caixa é o limite de tudo que o sistema procura depois: a lista de ruas e
 * a demarcação da rua escolhida. É ela que impede o sistema de sair do bairro
 * que o usuário selecionou.
 */
export const fetchNeighborhoodArea = async (
  bairro: string,
  cidade: string,
  uf: string,
  signal?: AbortSignal,
): Promise<NeighborhoodArea | null> => {
  if (!bairro?.trim()) return null;

  const cacheKey = `${bairro}|${cidade}|${uf}`.toLowerCase();
  const cached = neighborhoodAreaCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    await wait(NOMINATIM_POLITENESS_DELAY_MS, signal);

    const query = [bairro, cidade, uf, "Brasil"]
      .filter((part) => part && String(part).trim())
      .join(", ");

    const response = await fetchWithTimeout(
      `${NOMINATIM_BASE}/search?format=jsonv2&limit=5&countrycodes=br&q=${encodeURIComponent(query)}`,
      NOMINATIM_TIMEOUT_MS,
      { signal },
    );
    if (!response.ok) return null;

    const places = await response.json();
    if (!Array.isArray(places) || places.length === 0) {
      neighborhoodAreaCache.set(cacheKey, null);
      return null;
    }

    const place = pickBestPlace(places);
    const box = toSearchBox(place);
    if (!box) return null;

    const area: NeighborhoodArea = {
      center: { lat: parseFloat(place.lat), lng: parseFloat(place.lon) },
      box,
    };
    neighborhoodAreaCache.set(cacheKey, area);
    return area;
  } catch (err) {
    if (!isAbort(err)) {
      console.warn("Não foi possível localizar o bairro no mapa:", err);
    }
    return null;
  }
};

/**
 * Ruas desenhadas no mapa dentro do bairro, via OpenStreetMap.
 *
 * O Nominatim localiza o bairro e devolve a caixa que o envolve; o Overpass
 * lista as vias nomeadas dentro dessa caixa.
 *
 * A busca é por caixa, e não pela área do bairro, de propósito: o Overpass só
 * consegue filtrar por área quando o objeto tem uma área indexada, o que boa
 * parte dos bairros brasileiros (mapeados como ponto, ou como polígono simples)
 * não tem — e nesses casos a consulta não falha, apenas volta vazia. A caixa
 * sempre existe. Ela pode trazer alguma rua vizinha na borda, o que é preferível
 * a não trazer rua nenhuma.
 */
export const fetchOsmStreets = async (
  bairro: string,
  cidade: string,
  uf: string,
  signal?: AbortSignal,
): Promise<StreetCandidate[]> => {
  if (!bairro?.trim()) return [];

  try {
    const area = await fetchNeighborhoodArea(bairro, cidade, uf, signal);
    if (!area) return [];

    const { box } = area;
    const overpassQuery = `[out:json][timeout:${Math.floor(OVERPASS_TIMEOUT_MS / 1000)}];way["highway"]["name"](${box.south},${box.west},${box.north},${box.east});out tags;`;

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

/** Escapa aspas e barras para o nome caber com segurança na consulta Overpass. */
const escapeOverpassString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Escapa os caracteres especiais de expressão regular do Overpass. */
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ponto que fica sobre a rua: o vértice do meio do trecho mais longo. */
const midpointOfLongestLine = (lines: [number, number][][]) => {
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), lines[0]);
  const [lat, lng] = longest[Math.floor(longest.length / 2)];
  return { lat, lng };
};

/**
 * Geometria real de uma rua dentro do bairro escolhido.
 *
 * O nome é comparado por igualdade exata, e só depois — se nada casar — por
 * igualdade ancorada sem diferenciar maiúsculas e acentos de caixa. Comparação
 * solta aqui é perigosa: procurar "Rua B" por trecho de texto casaria com
 * "Rua Bahia", "Rua Bacabeira" e qualquer outra que contenha as mesmas letras.
 *
 * A busca também nunca sai da caixa do bairro, então uma rua de mesmo nome em
 * outro bairro do município não pode ser devolvida no lugar da certa.
 */
export const fetchStreetGeometry = async (
  streetName: string,
  box: GeoBox,
  signal?: AbortSignal,
): Promise<StreetGeometry | null> => {
  const name = streetName?.trim();
  if (!name) return null;

  const bbox = `${box.south},${box.west},${box.north},${box.east}`;
  const timeout = Math.floor(OVERPASS_TIMEOUT_MS / 1000);

  const filters = [
    `["name"="${escapeOverpassString(name)}"]`,
    `["name"~"^${escapeOverpassString(escapeRegExp(name))}$",i]`,
  ];

  for (const filter of filters) {
    try {
      const query = `[out:json][timeout:${timeout}];way["highway"]${filter}(${bbox});out geom;`;
      const response = await fetchWithTimeout(
        `${OVERPASS_BASE}?data=${encodeURIComponent(query)}`,
        OVERPASS_TIMEOUT_MS,
        { signal },
      );
      if (!response.ok) continue;

      const result = await response.json();
      const elements = Array.isArray(result?.elements) ? result.elements : [];

      const lines: [number, number][][] = elements
        .filter((element: any) => Array.isArray(element?.geometry) && element.geometry.length > 1)
        .map((element: any) =>
          element.geometry.map((point: any) => [point.lat, point.lon] as [number, number]),
        );

      if (lines.length === 0) continue;

      return {
        name: elements[0]?.tags?.name || name,
        center: midpointOfLongestLine(lines),
        lines,
      };
    } catch (err) {
      if (isAbort(err)) return null;
      console.warn("Não foi possível obter o traçado da rua:", err);
    }
  }

  return null;
};
