/**
 * Delta Operacional — quem planeja as operações do cliente.
 *
 * O Delta Operacional é do time do cliente e tem painel próprio: desenha um
 * raio no mapa, escolhe os pontos que estão dentro dele e monta a operação —
 * título, prioridade, turno, prazo e o plano de ação em etapas. Quem o
 * cadastra é o administrador, à mão ou por um QR Code de uso único.
 *
 * Tudo que toca o banco a respeito dele mora aqui. As tabelas e as funções
 * estão em db/migrations/2026-09-26-delta-operacional.sql.
 */
import {
  DatabaseService,
  colunaDoCliente,
  db,
  detectTableCasing,
  normalizeRecord
} from '../databaseClient';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DeltaOperacional {
  id: string;
  candidate_id: string;
  full_name: string;
  whatsapp: string;
  image?: string | null;
  access_token: string;
  source: 'manual' | 'qrcode';
  active: boolean;
  created_at: string;
  last_access_at?: string | null;
}

export interface EtapaDoPlano {
  id: string;
  texto: string;
  feita: boolean;
}

export type TipoDeAlvo = 'pin' | 'checkin';

/** Um ponto escolhido para a operação, com a cópia do que ele era na hora. */
export interface AlvoDaOperacao {
  id: string;
  tipo: TipoDeAlvo;
  titulo: string;
  lat: number;
  lng: number;
  cor?: string;
}

export type StatusDaOperacao = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';

export interface Operacao {
  id: string;
  candidate_id: string;
  created_by?: string | null;
  created_by_name?: string | null;
  title: string;
  objective?: string | null;
  action_plan: EtapaDoPlano[];
  priority?: string | null;
  turno?: string | null;
  due_date?: string | null;
  status: StatusDaOperacao;
  center: { lat: number; lng: number };
  radius: number;
  targets: AlvoDaOperacao[];
  created_at: string;
  updated_at: string;
}

/** Um ponto do mapa do cliente que pode entrar numa operação. */
export interface PontoDoMapa {
  id: string;
  tipo: TipoDeAlvo;
  titulo: string;
  detalhe: string;
  lat: number;
  lng: number;
  cor: string;
  foto?: string;
  quando?: string;
}

export const STATUS_DA_OPERACAO: Record<
  StatusDaOperacao,
  { rotulo: string; cor: string; fundo: string }
> = {
  planejada: { rotulo: 'Planejada', cor: '#2563EB', fundo: '#EFF6FF' },
  em_andamento: { rotulo: 'Em andamento', cor: '#D97706', fundo: '#FFFBEB' },
  concluida: { rotulo: 'Concluída', cor: '#059669', fundo: '#ECFDF5' },
  cancelada: { rotulo: 'Cancelada', cor: '#64748B', fundo: '#F1F5F9' }
};

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/**
 * O painel do Delta Operacional mora no domínio de acesso da equipe, e não no
 * do painel administrativo: o link que vai para o celular de alguém nunca
 * carrega o endereço da área do administrador. O token vai depois do `#`, que
 * não chega ao servidor, não entra em log e não vaza no Referer.
 */
const BASE_PAINEL = (
  (import.meta as any).env?.VITE_OPERACIONAL_BASE_URL ||
  (import.meta as any).env?.VITE_TEAM_BASE_URL ||
  'https://time.61636573.74696d656f7065726163696f6e616c63636f.online'
).replace(/\/$/, '');

const BASE_CADASTRO = (
  (import.meta as any).env?.VITE_SIGNUP_BASE_URL ||
  'https://cadastro.657169.74696d656f7065726163696f6e616c63636f.online'
).replace(/\/$/, '');

export const linkDoPainelOperacional = (token: string) => `${BASE_PAINEL}/#o=${token}`;
export const linkDoCadastroOperacional = (token: string) => `${BASE_CADASTRO}/#oc=${token}`;

/** Conversa do WhatsApp já aberta com a pessoa e o link na mensagem. */
export const whatsappComLink = (delta: DeltaOperacional, nomeDoCliente: string) => {
  const numero = delta.whatsapp.replace(/\D/g, '');
  const comPais = numero.length <= 11 ? `55${numero}` : numero;
  const primeiroNome = (delta.full_name || '').trim().split(/\s+/)[0] || '';
  const texto =
    `Olá${primeiroNome ? `, ${primeiroNome}` : ''}! Este é o seu acesso ao painel do ` +
    `Delta Operacional${nomeDoCliente ? ` de ${nomeDoCliente}` : ''}. ` +
    `Abra o link e confirme o seu número de WhatsApp para entrar:\n\n` +
    linkDoPainelOperacional(delta.access_token);
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
};

/** Token longo e aleatório: o link é a primeira metade da credencial. */
const novoToken = () => {
  const partes = [
    (crypto as any)?.randomUUID?.(),
    (crypto as any)?.randomUUID?.()
  ].filter(Boolean);
  if (partes.length === 2) return partes.join('').replace(/-/g, '');
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const novoId = () =>
  (crypto as any)?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const soDigitos = (valor: string) => (valor || '').replace(/\D/g, '');

/** "(82) 99999-8888" a partir dos dígitos, do jeito que se lê em voz alta. */
export const formatarTelefone = (valor: string) => {
  const d = soDigitos(valor).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
};

/** Máscara enquanto se digita, sem brigar com quem cola o número com +55. */
export const mascararTelefone = (valor: string) => {
  // Colado com o código do país ("+55 82 9..."), o 55 sai antes de cortar em
  // 11 dígitos — senão o corte comeria o fim do número e sobraria o 55 como DDD.
  let d = soDigitos(valor);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

/** Distância em metros entre dois pontos (haversine). */
export const distanciaEmMetros = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) => {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatarDistancia = (metros: number) =>
  metros >= 1000
    ? `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : `${Math.round(metros)} m`;

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const semBanco = { success: false as const, error: 'banco de dados não configurado.' };

/** A mensagem que o banco manda quando a migração ainda não foi aplicada. */
const faltaMigracao = (erro: any) =>
  /operational_|operations|does not exist|schema cache|PGRST20[25]|42P01/i.test(
    `${erro?.message || ''} ${erro?.code || ''}`
  );

const explicar = (erro: any) =>
  faltaMigracao(erro)
    ? 'O banco ainda não tem o Delta Operacional. Rode db/migrations/2026-09-26-delta-operacional.sql.'
    : erro?.message || 'Erro desconhecido.';

const lerOperacao = (linha: any): Operacao => ({
  ...linha,
  action_plan: Array.isArray(linha?.action_plan) ? linha.action_plan : [],
  targets: Array.isArray(linha?.targets) ? linha.targets : [],
  radius: Number(linha?.radius) || 0,
  center: {
    lat: Number(linha?.center?.lat) || 0,
    lng: Number(linha?.center?.lng) || 0
  }
});

export const DeltaOperacionalService = {
  // ------------------------------------------------------------ pessoas ---
  async listar(candidateId: string) {
    if (!db) return { ...semBanco, data: [] as DeltaOperacional[] };
    const { data, error } = await db
      .from('operational_deltas')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: true });
    if (error) return { success: false, error: explicar(error), data: [] as DeltaOperacional[] };
    return { success: true, data: (data || []) as DeltaOperacional[] };
  },

  async cadastrar(dados: {
    candidateId: string;
    nome: string;
    whatsapp: string;
    image?: string | null;
  }) {
    if (!db) return { ...semBanco, data: null as DeltaOperacional | null };
    const { data, error } = await db
      .from('operational_deltas')
      .insert({
        candidate_id: dados.candidateId,
        full_name: dados.nome.trim(),
        whatsapp: soDigitos(dados.whatsapp),
        image: dados.image || null,
        access_token: novoToken(),
        source: 'manual'
      })
      .select()
      .single();
    if (error) {
      const repetido = /duplicate|23505|idx_op_deltas_cliente_whatsapp/i.test(
        `${error.message} ${error.code}`
      );
      return {
        success: false,
        error: repetido
          ? 'Este telefone já é de um Delta Operacional deste cliente.'
          : explicar(error),
        data: null
      };
    }
    return { success: true, data: data as DeltaOperacional };
  },

  async atualizar(id: string, mudancas: Partial<Pick<DeltaOperacional, 'full_name' | 'whatsapp' | 'image' | 'active'>>) {
    if (!db) return semBanco;
    const { error } = await db.from('operational_deltas').update(mudancas).eq('id', id);
    return error ? { success: false, error: explicar(error) } : { success: true };
  },

  /** Troca o token: o link antigo para de funcionar na hora. */
  async gerarNovoLink(id: string) {
    if (!db) return { ...semBanco, token: '' };
    const token = novoToken();
    const { error } = await db
      .from('operational_deltas')
      .update({ access_token: token })
      .eq('id', id);
    return error ? { success: false, error: explicar(error), token: '' } : { success: true, token };
  },

  async remover(id: string) {
    if (!db) return semBanco;
    const { error } = await db.from('operational_deltas').delete().eq('id', id);
    return error ? { success: false, error: explicar(error) } : { success: true };
  },

  // ------------------------------------------------------------ convites ---
  async listarConvites(candidateId: string) {
    if (!db) return { ...semBanco, data: [] as any[] };
    const { data, error } = await db
      .from('operational_invites')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });
    if (error) return { success: false, error: explicar(error), data: [] as any[] };
    return { success: true, data: data || [] };
  },

  async criarConvite(candidateId: string, nota: string, minutos: number) {
    if (!db) return { ...semBanco, data: null as any };
    const { data, error } = await db
      .from('operational_invites')
      .insert({
        token: novoToken(),
        candidate_id: candidateId,
        note: nota || null,
        expires_at: new Date(Date.now() + minutos * 60000).toISOString()
      })
      .select()
      .single();
    if (error) return { success: false, error: explicar(error), data: null };
    return { success: true, data };
  },

  async cancelarConvite(id: string) {
    if (!db) return semBanco;
    const { error } = await db
      .from('operational_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .is('used_at', null);
    return error ? { success: false, error: explicar(error) } : { success: true };
  },

  async abrirConvite(token: string) {
    if (!db) return { ...semBanco, data: null as any };
    const { data, error } = await db.rpc('get_operational_invite', { p_token: token });
    if (error) return { success: false, error: explicar(error), data: null };
    return { success: true, data };
  },

  async concluirCadastro(dados: { token: string; nome: string; whatsapp: string; image?: string }) {
    if (!db) return { ...semBanco, data: null as any };
    const { data, error } = await db.rpc('claim_operational_invite', {
      p_token: dados.token,
      p_name: dados.nome,
      p_whatsapp: dados.whatsapp,
      p_image: dados.image || ''
    });
    if (error) return { success: false, error: explicar(error), data: null };
    return { success: true, data };
  },

  // -------------------------------------------------------------- painel ---
  async espiarPainel(token: string) {
    if (!db) return { ...semBanco, data: null as any };
    const { data, error } = await db.rpc('peek_operational_panel', { p_token: token });
    if (error) return { success: false, error: explicar(error), data: null };
    return { success: true, data };
  },

  async entrarNoPainel(token: string, whatsapp: string) {
    if (!db) return { ...semBanco, data: null as any };
    const { data, error } = await db.rpc('enter_operational_panel', {
      p_token: token,
      p_whatsapp: whatsapp
    });
    if (error) return { success: false, error: explicar(error), data: null };
    return { success: true, data };
  },

  // ----------------------------------------------------------- operações ---
  async listarOperacoes(candidateId: string) {
    if (!db) return { ...semBanco, data: [] as Operacao[] };
    const { data, error } = await db
      .from('operations')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });
    if (error) return { success: false, error: explicar(error), data: [] as Operacao[] };
    return { success: true, data: (data || []).map(lerOperacao) };
  },

  async salvarOperacao(op: Operacao) {
    if (!db) return { ...semBanco, data: null as Operacao | null };
    const { data, error } = await db
      .from('operations')
      .upsert({ ...op, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return { success: false, error: explicar(error), data: null };
    return { success: true, data: lerOperacao(data) };
  },

  async apagarOperacao(id: string) {
    if (!db) return semBanco;
    const { error } = await db.from('operations').delete().eq('id', id);
    return error ? { success: false, error: explicar(error) } : { success: true };
  },

  /**
   * Os pontos do cliente que podem entrar numa operação: os pontos
   * estratégicos do mapa e os check-ins da equipe.
   *
   * Ficam de fora a missão sem lugar no mapa (não se desenha na rua), o
   * check-in em rascunho (ainda não aconteceu) e o que está na lixeira.
   */
  async lerPontosDoCliente(candidateId: string) {
    if (!db) return { ...semBanco, data: [] as PontoDoMapa[] };
    await detectTableCasing();
    const [pins, checkins, tipos] = await Promise.all([
      db.from('campaign_pins').select('*').eq(colunaDoCliente('campaign_pins'), candidateId),
      db.from('check_ins').select('*').eq(colunaDoCliente('check_ins'), candidateId),
      DatabaseService.fetchOperationTypes()
    ]);
    if (pins.error && checkins.error) {
      return { success: false, error: explicar(pins.error), data: [] as PontoDoMapa[] };
    }
    const rotuloDoTipo = (id?: string) =>
      (tipos as any)?.data?.find?.((t: any) => t.id === id)?.label || '';

    const pontos: PontoDoMapa[] = [];
    (pins.data || []).map((p: any) => normalizeRecord<any>(p)).forEach((p: any) => {
      const lat = Number(p.position?.lat);
      const lng = Number(p.position?.lng);
      if (p.position?.semLocal || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (p.active === false) return;
      pontos.push({
        id: p.id,
        tipo: 'pin',
        titulo: p.title || 'Ponto sem título',
        detalhe: rotuloDoTipo(p.iconType) || 'Ponto estratégico',
        lat,
        lng,
        cor: p.color || '#F58220',
        quando: p.createdAt
      });
    });
    (checkins.data || []).map((c: any) => normalizeRecord<any>(c)).forEach((c: any) => {
      if (c.status === 'rascunho' || c.trashed) return;
      const lat = Number(c.coordinates?.lat);
      const lng = Number(c.coordinates?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      pontos.push({
        id: c.id,
        tipo: 'checkin',
        titulo: c.operationTypeLabel || c.missionTitle || 'Check-in',
        detalhe: [c.name, [c.rua, c.bairro].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
        lat,
        lng,
        cor: '#10B981',
        foto: c.photo || c.media?.[0]?.url,
        quando: c.createdAt
      });
    });
    return { success: true, data: pontos };
  }
};
