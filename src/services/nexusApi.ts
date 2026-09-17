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

const fetchPage = async <T>(
  path: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ data: T[]; totalPages: number }> => {
  const response = await fetch(
    `${BRIDGE_URL}?path=${encodeURIComponent(path)}&page=${page}&page_size=${PAGE_SIZE}`,
    { signal },
  );

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.error || "";
    } catch {
      /* corpo sem json: fica só o status */
    }
    throw new Error(detail || `A base de vínculo respondeu ${response.status}.`);
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    // Em desenvolvimento o Vite não executa funções da Vercel e devolve o
    // próprio arquivo da ponte, que não é JSON.
    throw new Error(
      "A lista para vínculo não respondeu como esperado. Em ambiente local ela só funciona com `vercel dev`.",
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

    // A ficha vem inteira: o que o administrador vincular e salvar no nosso
    // banco tem que ser tudo o que existe sobre a pessoa, não um resumo.
    source: "vinculado",
    externalId: String(raw.id),
    email: raw.email || undefined,
    campanha: raw.campanha || undefined,
    numeroCampanha: raw.numero_campanha || undefined,
    linkGrupoWhatsapp: raw.link_grupo_whatsapp || undefined,
    favorito: typeof raw.favorito === "boolean" ? raw.favorito : undefined,
    partyName: raw.partido?.nome || undefined,
    partyInitials: raw.partido?.sigla || undefined,
    partyLogoUrl: raw.partido?.logo_url || undefined,
    partyColor: raw.partido?.cor_primaria || undefined,
    externalCreatedAt: raw.cadastrado_em || undefined,
    raw,
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
  const rows = await fetchAllPages<NexusCandidate>("candidatos", signal);

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

/** Percorre todas as páginas de um caminho paginado da API. */
const fetchAllPages = async <T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> => {
  const first = await fetchPage<T>(path, 1, signal);
  const rows = [...first.data];

  const totalPages = Math.min(first.totalPages, MAX_PAGES);
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchPage<T>(path, page, signal);
    rows.push(...next.data);
    if (next.data.length === 0) break;
  }

  return rows;
};

interface NexusTeamMember {
  id?: string;
  nome?: string;
  foto_url?: string | null;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  data_nascimento?: string;
  genero?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  rua?: string;
  latitude?: number;
  longitude?: number;
  grau_proximidade?: string;
  nucleo_delta?: string;
  cadastrado_em?: string;
}

/**
 * Integrante da Equipe no formato que o sistema já usa.
 *
 * Os nomes de campo (full_name, candidate_id) são os que o restante do código
 * espera desde a época em que a lista vinha do Supabase, então a conversão
 * acontece aqui e nada mais precisa mudar.
 */
export interface TeamMember {
  id: string;
  full_name: string;
  whatsapp: string;
  candidate_id: string;
  image: string;
  email: string;
  instagram: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
  latitude?: number;
  longitude?: number;
  grau_proximidade: string;
  nucleo: string;
  cadastrado_em: string;
}

/** Equipe de um candidato. */
export const fetchNexusTeam = async (
  candidateId: string,
  signal?: AbortSignal,
): Promise<TeamMember[]> => {
  if (!candidateId) return [];

  const rows = await fetchAllPages<NexusTeamMember>(
    `candidatos/${candidateId}/lideres-delta`,
    signal,
  );

  return rows
    .filter((row) => row?.id && row?.nome)
    .map((row) => ({
      id: String(row.id),
      full_name: String(row.nome),
      whatsapp: row.whatsapp || "",
      candidate_id: candidateId,
      image: row.foto_url || "",
      email: row.email || "",
      instagram: row.instagram || "",
      estado: row.estado || "",
      cidade: row.cidade || "",
      bairro: row.bairro || "",
      rua: row.rua || "",
      latitude: typeof row.latitude === "number" ? row.latitude : undefined,
      longitude: typeof row.longitude === "number" ? row.longitude : undefined,
      grau_proximidade: row.grau_proximidade || "",
      nucleo: row.nucleo_delta || "",
      cadastrado_em: row.cadastrado_em || "",
    }));
};
