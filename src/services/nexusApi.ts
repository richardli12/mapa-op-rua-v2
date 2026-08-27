/**
 * Leitura de partidos e candidatos do Nexus.
 *
 * As chamadas passam pela ponte em /api/nexus, que guarda a chave no servidor.
 * O endpoint de candidatos já traz o partido de cada um embutido, então a lista
 * de partidos é montada a partir dela, sem uma segunda consulta.
 */

import { Candidate, Party } from "../types";

const BRIDGE_URL = "/api/nexus";
const PAGE_SIZE = 100;

/** Trava de segurança: impede laço infinito se o meta vier inconsistente. */
const MAX_PAGES = 50;

interface NexusParty {
  id?: string;
  nome?: string;
  sigla?: string;
  logo_url?: string | null;
  cor_primaria?: string | null;
}

interface NexusCandidate {
  id?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  instagram?: string;
  cargo?: string;
  cidade?: string;
  estado?: string;
  campanha?: string;
  numero_campanha?: string;
  link_grupo_whatsapp?: string;
  foto_url?: string | null;
  status?: string;
  favorito?: boolean;
  cadastrado_em?: string;
  partido?: NexusParty | null;
}

export interface NexusData {
  candidates: Candidate[];
  parties: Party[];
}

const fetchPage = async (
  page: number,
  signal?: AbortSignal,
): Promise<{ data: NexusCandidate[]; totalPages: number }> => {
  const response = await fetch(
    `${BRIDGE_URL}?path=candidatos&page=${page}&page_size=${PAGE_SIZE}`,
    { signal },
  );

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.error || "";
    } catch {
      /* corpo sem json: fica só o status */
    }
    throw new Error(detail || `Nexus respondeu ${response.status}.`);
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    // Em desenvolvimento o Vite não executa funções da Vercel e devolve o
    // próprio arquivo da ponte, que não é JSON.
    throw new Error(
      "A ponte /api/nexus não respondeu em JSON. Em ambiente local ela só funciona com `vercel dev`.",
    );
  }

  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    totalPages: Number(payload?.meta?.total_pages) || 1,
  };
};

const toCandidate = (raw: NexusCandidate): Candidate | null => {
  if (!raw?.id || !raw?.nome) return null;
  return {
    id: String(raw.id),
    name: raw.nome,
    phone: raw.telefone || "",
    instagram_handle: raw.instagram || "",
    city: raw.cidade || "",
    estado: raw.estado || "",
    office: raw.cargo || "",
    image: raw.foto_url || undefined,
    status_active: raw.status ? raw.status === "active" : true,
    partyId: raw.partido?.id ? String(raw.partido.id) : undefined,
  };
};

const toParty = (raw: NexusParty): Party | null => {
  if (!raw?.id) return null;
  return {
    id: String(raw.id),
    name: raw.nome || raw.sigla || "Partido sem nome",
    initials: raw.sigla || "—",
    logo_url: raw.logo_url || "",
    color: raw.cor_primaria || undefined,
  };
};

/**
 * Busca todos os candidatos, percorrendo as páginas, e deriva os partidos.
 */
export const fetchNexusData = async (
  signal?: AbortSignal,
): Promise<NexusData> => {
  const first = await fetchPage(1, signal);
  const rows = [...first.data];

  const totalPages = Math.min(first.totalPages, MAX_PAGES);
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchPage(page, signal);
    rows.push(...next.data);
    if (next.data.length === 0) break;
  }

  const candidates: Candidate[] = [];
  const partiesById = new Map<string, Party>();

  for (const row of rows) {
    const candidate = toCandidate(row);
    if (candidate) candidates.push(candidate);

    const party = row.partido ? toParty(row.partido) : null;
    if (party && !partiesById.has(party.id)) {
      partiesById.set(party.id, party);
    }
  }

  return {
    candidates,
    parties: [...partiesById.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    ),
  };
};
