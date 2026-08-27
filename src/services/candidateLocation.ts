/**
 * Localização de campanha do candidato.
 *
 * O cadastro guarda a localização num único campo de texto livre, preenchido à
 * mão: pode vir "Parauapebas - PA", "Maceió/AL", "São Paulo, SP", só o nome da
 * cidade ou só o nome do estado. Este módulo transforma esse texto no par
 * estado + município que os seletores do sistema precisam.
 */

export const UF_TO_STATE_NAME: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export interface CandidateLocation {
  uf: string;
  stateName: string;
  /** Nome do município, quando dá para saber. Só o estado é um resultado válido. */
  cityName: string | null;
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NOMINATIM_TIMEOUT_MS = 10000;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const STATE_NAME_TO_UF = new Map(
  Object.entries(UF_TO_STATE_NAME).map(([uf, name]) => [normalize(name), uf]),
);

/**
 * Lê estado e município direto do texto, sem consultar nada.
 *
 * Cobre os formatos que uma pessoa digita naturalmente: a sigla em qualquer
 * posição ("Parauapebas - PA", "PA, Parauapebas") ou o nome do estado por
 * extenso. O que sobra depois de retirar o estado é tratado como município.
 */
export const parseCandidateLocation = (
  raw?: string | null,
): CandidateLocation | null => {
  const text = raw?.trim();
  if (!text) return null;

  const parts = text
    .split(/[,/|]|\s+-\s+|\s+–\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  // A sigla explícita manda. Ela é o sinal mais confiável de estado, e sem essa
  // precedência "São Paulo, SP" seria lido como estado "São Paulo" e município
  // "SP" — sete estados brasileiros têm o mesmo nome da capital ou de um
  // município, então quem decide é a sigla.
  const ufIndex = parts.findIndex((part) => {
    const asUf = part.toUpperCase();
    return asUf.length === 2 && asUf in UF_TO_STATE_NAME;
  });

  let uf = "";
  let remaining: string[] = [];

  if (ufIndex >= 0) {
    uf = parts[ufIndex].toUpperCase();
    remaining = parts.filter((_, index) => index !== ufIndex);
  } else {
    const stateIndex = parts.findIndex((part) =>
      STATE_NAME_TO_UF.has(normalize(part)),
    );
    if (stateIndex >= 0) {
      uf = STATE_NAME_TO_UF.get(normalize(parts[stateIndex])) as string;
      remaining = parts.filter((_, index) => index !== stateIndex);
    } else {
      remaining = [...parts];
    }
  }

  // Sigla grudada no fim do texto, sem separador: "Parauapebas PA".
  if (!uf && remaining.length === 1) {
    const words = remaining[0].split(/\s+/);
    const last = words[words.length - 1]?.toUpperCase();
    if (words.length > 1 && last?.length === 2 && last in UF_TO_STATE_NAME) {
      uf = last;
      remaining[0] = words.slice(0, -1).join(" ");
    }
  }

  if (!uf) return null;

  const cityName = remaining.join(" ").trim();
  return {
    uf,
    stateName: UF_TO_STATE_NAME[uf],
    cityName: cityName || null,
  };
};

/**
 * Texto de localização do candidato, juntando os dois campos do cadastro.
 *
 * O Nexus entrega município e estado separados ("Maceió" + "AL"); cadastros
 * antigos gravavam a mesma string nos dois campos. Juntar só quando são
 * diferentes cobre os dois casos sem repetir o nome.
 */
export const candidateLocationText = (
  candidate?: { city?: string | null; estado?: string | null } | null,
): string => {
  const city = candidate?.city?.trim() || "";
  const state = candidate?.estado?.trim() || "";
  if (city && state && normalize(city) !== normalize(state)) {
    return `${city} - ${state}`;
  }
  return state || city;
};

const resolvedCache = new Map<string, CandidateLocation | null>();

/**
 * Descobre estado e município do candidato.
 *
 * Tenta ler do próprio texto primeiro. Quando o cadastro traz só o nome do
 * município ("Parauapebas"), sem estado, pergunta ao Nominatim — a mesma base
 * que o mapa já usa — em vez de assumir um estado padrão, que é justamente o
 * que fazia o sistema abrir sempre em Alagoas.
 */
export const resolveCandidateLocation = async (
  raw?: string | null,
  signal?: AbortSignal,
): Promise<CandidateLocation | null> => {
  const text = raw?.trim();
  if (!text) return null;

  const parsed = parseCandidateLocation(text);
  if (parsed) return parsed;

  const cacheKey = normalize(text);
  const cached = resolvedCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller);

  try {
    const response = await fetch(
      `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(`${text}, Brasil`)}`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;

    const places = await response.json();
    const address = Array.isArray(places) ? places[0]?.address : null;
    if (!address) {
      resolvedCache.set(cacheKey, null);
      return null;
    }

    const uf = STATE_NAME_TO_UF.get(normalize(address.state || ""));
    if (!uf) {
      resolvedCache.set(cacheKey, null);
      return null;
    }

    const cityName =
      address.city ||
      address.town ||
      address.municipality ||
      address.village ||
      null;

    const location: CandidateLocation = {
      uf,
      stateName: UF_TO_STATE_NAME[uf],
      cityName,
    };
    resolvedCache.set(cacheKey, location);
    return location;
  } catch (err) {
    if (!(err instanceof Error && err.name === "AbortError")) {
      console.warn("Não foi possível resolver a localização do candidato:", err);
    }
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
};
