import { createClient } from '@supabase/supabase-js';
import { PanfletagemArea, CampaignPin, CheckIn, Candidate, Party, OperationType } from './types';

const databaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const databaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const isDatabaseConfigured = Boolean(databaseUrl && databaseAnonKey);

export const db = isDatabaseConfigured
  ? createClient(databaseUrl, databaseAnonKey)
  : null;

// O script de criacao do banco nao mora mais aqui: ele vive so no repositorio,
// em db/schema.sql, fora do pacote que vai para o navegador. O bundle e
// publico, e o script cita o fornecedor de banco em cada comentario e em nomes
// de objeto que nao da para trocar.

/**
 * Service to sync areas, pins, and check-ins with banco de dados.
 * Each method returns success state, and any error message.
 */
let detectedCasing: { [table: string]: 'camel' | 'lower' } = {
  panfletagem_areas: 'camel',
  campaign_pins: 'camel',
  check_ins: 'camel'
};

export async function detectTableCasing() {
  if (!db) return;
  try {
    const { error } = await db.from('campaign_pins').select('candidateId').limit(0);
    if (error) {
      detectedCasing.campaign_pins = 'lower';
    }
  } catch (e) {
    detectedCasing.campaign_pins = 'lower';
  }

  try {
    const { error } = await db.from('panfletagem_areas').select('candidateId').limit(0);
    if (error) {
      detectedCasing.panfletagem_areas = 'lower';
    }
  } catch (e) {
    detectedCasing.panfletagem_areas = 'lower';
  }

  try {
    const { error } = await db.from('check_ins').select('candidateId').limit(0);
    if (error) {
      detectedCasing.check_ins = 'lower';
    }
  } catch (e) {
    detectedCasing.check_ins = 'lower';
  }
}

/** Converte as colunas cruas do Postgres para o formato camelCase do app. */
export function normalizeRecord<T>(obj: any): T {
  return normalizeFields<T>(obj);
}

function normalizeFields<T>(obj: any): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = { ...obj };

  const mappings: { [key: string]: string } = {
    candidateid: 'candidateId',
    createdat: 'createdAt',
    icontype: 'iconType',
    teamsize: 'teamSize',
    contactname: 'contactName',
    userlatitude: 'userLatitude',
    userlongitude: 'userLongitude',
    missionid: 'missionId',
    missiontitle: 'missionTitle'
  };

  for (const [lowerKey, camelKey] of Object.entries(mappings)) {
    if (lowerKey in result && result[lowerKey] !== undefined) {
      result[camelKey] = result[lowerKey];
      delete result[lowerKey];
    }
  }

  // Extract assignedDeltas from center/position JSON for Time Delta assignments support
  if (result.center && typeof result.center === 'object') {
    if (result.center.assignedDeltas) {
      result.assignedDeltas = result.center.assignedDeltas;
    }
  }
  if (result.position && typeof result.position === 'object') {
    if (result.position.assignedDeltas) {
      result.assignedDeltas = result.position.assignedDeltas;
    }
  }

  return result as T;
}

function prepareUpsertPayload(obj: any, table: string): any {
  if (!obj) return obj;
  const casing = detectedCasing[table] || 'camel';
  if (casing === 'camel') return obj;

  const payload = { ...obj };
  const mappings: { [key: string]: string } = {
    candidateId: 'candidateid',
    createdAt: 'createdat',
    iconType: 'icontype',
    teamSize: 'teamsize',
    contactName: 'contactname',
    userLatitude: 'userlatitude',
    userLongitude: 'userlongitude',
    missionId: 'missionid',
    missionTitle: 'missiontitle'
  };

  for (const [camelKey, lowerKey] of Object.entries(mappings)) {
    if (camelKey in payload) {
      payload[lowerKey] = payload[camelKey];
      delete payload[camelKey];
    }
  }
  return payload;
}

/**
 * Linha da tabela candidates -> cliente do app.
 *
 * As colunas seguem o padrao snake_case do banco e o app usa camelCase, entao
 * a traducao acontece aqui, num lugar so.
 */
function rowToClient(row: any): Candidate {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    instagram_handle: row.instagram_handle || '',
    city: row.city || '',
    estado: row.estado || undefined,
    office: row.office || '',
    image: row.image || undefined,
    status_active: row.status_active !== false,
    partyId: row.party_id || undefined,
    source: row.source === 'vinculado' ? 'vinculado' : 'manual',
    externalId: row.external_id || undefined,
    email: row.email || undefined,
    campanha: row.campanha || undefined,
    numeroCampanha: row.numero_campanha || undefined,
    linkGrupoWhatsapp: row.link_grupo_whatsapp || undefined,
    favorito: typeof row.favorito === 'boolean' ? row.favorito : undefined,
    partyName: row.party_name || undefined,
    partyInitials: row.party_initials || undefined,
    partyLogoUrl: row.party_logo_url || undefined,
    partyColor: row.party_color || undefined,
    syncTeam: row.sync_team === true,
    externalCreatedAt: row.external_created_at || undefined,
    raw: row.raw || undefined
  };
}

/** Cliente do app -> linha da tabela candidates. */
function clientToRow(client: Omit<Candidate, 'id'> & { id?: string }): any {
  return {
    name: client.name,
    phone: client.phone || null,
    instagram_handle: client.instagram_handle || null,
    city: client.city || null,
    estado: client.estado || null,
    office: client.office || null,
    image: client.image || null,
    status_active: client.status_active !== false,
    party_id: client.partyId || null,
    source: client.source === 'vinculado' ? 'vinculado' : 'manual',
    external_id: client.externalId || null,
    email: client.email || null,
    campanha: client.campanha || null,
    numero_campanha: client.numeroCampanha || null,
    link_grupo_whatsapp: client.linkGrupoWhatsapp || null,
    favorito: typeof client.favorito === 'boolean' ? client.favorito : null,
    party_name: client.partyName || null,
    party_initials: client.partyInitials || null,
    party_logo_url: client.partyLogoUrl || null,
    party_color: client.partyColor || null,
    sync_team: client.syncTeam === true,
    external_created_at: client.externalCreatedAt || null,
    raw: client.raw || null
  };
}

export const DatabaseService = {
  async fetchAll() {
    if (!db) {
      return { success: false, data: null, error: 'banco de dados não configurado.' };
    }

    try {
      // Detect column casing dynamically
      await detectTableCasing();

      // Fetch areas
      const { data: areas, error: areasError } = await db
        .from('panfletagem_areas')
        .select('*');

      // Fetch pins
      const { data: pins, error: pinsError } = await db
        .from('campaign_pins')
        .select('*');

      // Fetch checkins
      const { data: checkins, error: checkinsError } = await db
        .from('check_ins')
        .select('*');

      if (areasError) throw areasError;
      if (pinsError) throw pinsError;
      if (checkinsError) throw checkinsError;

      const normalizedAreas = (areas || []).map(a => normalizeFields<PanfletagemArea>(a));
      const normalizedPins = (pins || []).map(p => normalizeFields<CampaignPin>(p));
      const normalizedCheckins = (checkins || []).map(c => normalizeFields<CheckIn>(c));

      return {
        success: true,
        data: {
          areas: normalizedAreas,
          pins: normalizedPins,
          checkins: normalizedCheckins
        }
      };
    } catch (err: any) {
      console.warn('Erro ao ler do banco de dados:', err);
      // Check if error is due to missing tables
      const isMissingTable = err.message?.includes('does not exist') || err.code === '42P01';
      return {
        success: false,
        data: null,
        error: isMissingTable
          ? 'Tabelas não encontradas no banco de dados. Crie-as executando o script SQL disponível nas configurações.'
          : err.message || 'Erro desconhecido ao carregar do banco de dados.'
      };
    }
  },

  async upsertArea(area: PanfletagemArea) {
    if (!db) return { success: false };
    try {
      const payload = prepareUpsertPayload(area, 'panfletagem_areas');
      const { error } = await db
        .from('panfletagem_areas')
        .upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar área no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteArea(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('panfletagem_areas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar área no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  /** Tipos de Operação cadastrados pelo usuário. */
  async fetchOperationTypes() {
    if (!db) return { success: false, data: [] as OperationType[] };
    try {
      const { data, error } = await db
        .from('operation_types')
        .select('*');
      if (error) throw error;
      const rows = (data || []).map(row => normalizeFields<OperationType>(row));
      return { success: true, data: rows };
    } catch (err: any) {
      console.warn('Erro ao buscar tipos de operação no banco de dados:', err);
      return { success: false, error: err.message, data: [] as OperationType[] };
    }
  },

  async upsertOperationType(type: OperationType) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('operation_types')
        .upsert({
          id: type.id,
          label: type.label,
          icon: type.icon,
          color: type.color,
          candidateId: type.candidateId || null,
          createdAt: type.createdAt || new Date().toISOString()
        });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar tipo de operação no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteOperationType(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('operation_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar tipo de operação no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async upsertPin(pin: CampaignPin) {
    if (!db) return { success: false };
    try {
      const payload = prepareUpsertPayload(pin, 'campaign_pins');
      const { error } = await db
        .from('campaign_pins')
        .upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar pin no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async deletePin(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('campaign_pins')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar pin no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async upsertCheckIn(checkIn: CheckIn) {
    if (!db) return { success: false };
    try {
      const payload = prepareUpsertPayload(checkIn, 'check_ins');
      const { error } = await db
        .from('check_ins')
        .upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar check-in no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteCheckIn(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('check_ins')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar check-in no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async checkSupporter(whatsapp: string) {
    if (!db) {
      return { success: false, error: 'banco de dados não configurado.' };
    }
    try {
      const cleanNumber = whatsapp.replace(/\D/g, '');
      const { data, error } = await db
        .from('time_delta')
        .select('*')
        .or(`whatsapp.eq."${whatsapp}",whatsapp.eq."${cleanNumber}"`);

      if (error) throw error;

      if (data && data.length > 0) {
        return { success: true, supporter: data[0] };
      }

      return { success: false, error: 'WhatsApp não credenciado na lista da Equipe.' };
    } catch (err: any) {
      console.error('Erro ao buscar delta no banco de dados:', err);
      return { success: false, error: err.message || 'Erro inesperado ao verificar o WhatsApp.' };
    }
  },

  /** Equipe. Com candidateId, so a daquele cliente. */
  async fetchSupporters(candidateId?: string) {
    if (!db) return { success: false, data: [] };
    try {
      let query = db.from('time_delta').select('*');
      if (candidateId) query = query.eq('candidate_id', candidateId);
      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.warn('Erro ao buscar deltas do banco de dados:', err);
      return { success: false, error: err.message, data: [] };
    }
  },

  async upsertSupporter(supporter: {
    id: string;
    full_name: string;
    whatsapp: string;
    candidate_id?: string;
    image?: string;
    extra_fields?: any;
    source?: string;
  }) {
    if (!db) {
      return { success: false, error: 'banco de dados não configurado.' };
    }
    try {
      const cleanWhatsapp = supporter.whatsapp.replace(/\D/g, '');
      const payload: any = {
        full_name: supporter.full_name,
        whatsapp: cleanWhatsapp,
      };

      if (supporter.candidate_id) {
        payload.candidate_id = supporter.candidate_id;
      }
      if (supporter.image) {
        payload.image = supporter.image;
      }
      if (supporter.extra_fields !== undefined) {
        payload.extra_fields = supporter.extra_fields;
      }
      if (supporter.source) {
        payload.source = supporter.source;
      }

      const isUuid = (str?: string) => str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;
      
      let targetId = supporter.id;
      if (isUuid(targetId)) {
        payload.id = targetId;
      } else if (supporter.candidate_id) {
        // Sem id valido, procura pelo telefone DENTRO do cliente: o mesmo
        // numero pode estar na equipe de outro cliente e aquele cadastro nao
        // tem nada a ver com este.
        const { data } = await db
          .from('time_delta')
          .select('id')
          .eq('candidate_id', supporter.candidate_id)
          .eq('whatsapp', cleanWhatsapp)
          .limit(1);
        if (data && data.length > 0) {
          payload.id = data[0].id;
        }
      }

      const { data, error } = await db
        .from('time_delta')
        .upsert(payload, { onConflict: 'candidate_id,whatsapp' })
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Erro ao atualizar delta no banco de dados:', err);
      return { success: false, error: err.message || 'Erro ao salvar dados do integrante da Equipe.' };
    }
  },

  // --------------------------------------------------------------------------
  // Campos de coleta que o ADM configura para a equipe de cada cliente
  // --------------------------------------------------------------------------
  async fetchTeamFields(candidateId: string) {
    if (!db || !candidateId) return { success: false, data: [] as any[] };
    try {
      const { data, error } = await db
        .from('team_field_defs')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('position', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      console.warn('Erro ao buscar campos de coleta:', err);
      return { success: false, error: err.message, data: [] as any[] };
    }
  },

  async upsertTeamField(field: any) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const payload: any = {
        candidate_id: field.candidate_id,
        label: field.label,
        type: field.type || 'text',
        options: field.options || null,
        required: field.required === true,
        position: field.position || 0
      };
      if (field.id) payload.id = field.id;

      const { data, error } = await db
        .from('team_field_defs')
        .upsert(payload)
        .select();
      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err: any) {
      console.error('Erro ao salvar campo de coleta:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteTeamField(id: string) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { error } = await db.from('team_field_defs').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // --------------------------------------------------------------------------
  // Convites de QR Code (um por pessoa, de uso unico)
  // --------------------------------------------------------------------------
  async fetchTeamInvites(candidateId: string) {
    if (!db || !candidateId) return { success: false, data: [] as any[] };
    try {
      const { data, error } = await db
        .from('team_invites')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      console.warn('Erro ao buscar convites:', err);
      return { success: false, error: err.message, data: [] as any[] };
    }
  },

  /**
   * Cria o convite do QR.
   *
   * O prazo vem do ADM. Sem prazo o convite so morre quando alguem usar, entao
   * o padrao e sempre ter um: quem chama passa os minutos.
   */
  async createTeamInvite(candidateId: string, note?: string, minutes?: number) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      // Token longo e aleatorio: o link do QR e a unica credencial dessa tela.
      const token =
        (crypto as any)?.randomUUID?.().replace(/-/g, '') ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);

      const expiresAt =
        minutes && minutes > 0
          ? new Date(Date.now() + minutes * 60000).toISOString()
          : null;

      const { data, error } = await db
        .from('team_invites')
        .insert({
          token,
          candidate_id: candidateId,
          note: note || null,
          expires_at: expiresAt
        })
        .select();
      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err: any) {
      console.error('Erro ao criar convite:', err);
      return { success: false, error: err.message };
    }
  },

  async revokeTeamInvite(id: string) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { error } = await db
        .from('team_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .is('used_at', null);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /** Leitura publica do convite, pela pessoa que abriu o QR. */
  async getTeamInvite(token: string) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { data, error } = await db.rpc('get_team_invite', { p_token: token });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Erro ao ler convite:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Conclui o cadastro pelo QR Code.
   *
   * O consumo do convite e a criacao do integrante acontecem dentro da mesma
   * funcao no banco, entao nao ha janela para o mesmo QR ser usado duas vezes.
   */
  async claimTeamInvite(payload: {
    token: string;
    name: string;
    whatsapp: string;
    image: string;
    extra: any;
  }) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { data, error } = await db.rpc('claim_team_invite', {
        p_token: payload.token,
        p_name: payload.name,
        p_whatsapp: payload.whatsapp,
        p_image: payload.image,
        p_extra: payload.extra || {}
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Erro ao concluir cadastro:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteSupporter(id: string) {
    if (!db) {
      return { success: false, error: 'banco de dados não configurado.' };
    }
    try {
      // Se não for UUID válido, tenta achar e deletar pelo valor (mas se for UUID faz por ID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = db.from('time_delta').delete();
      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.eq('id', id); // fallback standard query
      }
      const { error } = await query;
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar delta do banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  /** Envia uma foto ou um vídeo do check-in para o Storage e devolve a URL pública. */
  async uploadMedia(file: File) {
    if (!db) {
      return { success: false, url: null, error: 'banco de dados não configurado.' };
    }
    try {
      const isVideo = file.type.startsWith('video/');
      const nameExt = file.name.includes('.') ? file.name.split('.').pop() : '';
      // A câmera de alguns aparelhos manda o arquivo sem extensão no nome.
      const fileExt = nameExt || (isVideo ? 'mp4' : 'jpg');
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `check_ins/${fileName}`;

      const { error } = await db.storage
        .from('imagens')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined
        });

      if (error) throw error;

      const { data: { publicUrl } } = db.storage
        .from('imagens')
        .getPublicUrl(filePath);

      return { success: true, url: publicUrl, error: null };
    } catch (err: any) {
      console.error('Erro de upload no banco de dados Storage:', err);
      return {
        success: false,
        url: null,
        error: err.message || 'Falha no upload do arquivo.'
      };
    }
  },

  async loginAdmin(email: string, password: string) {
    if (!db) {
      return { success: false, error: 'banco de dados não configurado.' };
    }
    try {
      const { data, error } = await db
        .from('auth_users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao consultar a tabela auth_users:', error);
        throw error;
      }

      if (data) {
        return { success: true, user: data };
      }

      return { success: false, error: 'Usuário ou senha inválidos.' };
    } catch (err: any) {
      console.error('Erro ao autenticar administrador:', err);
      return { success: false, error: err.message || 'Erro inesperado ao realizar login.' };
    }
  },

  async fetchCandidates() {
    if (!db) return { success: false, data: [] as Candidate[] };
    try {
      const { data, error } = await db
        .from('candidates')
        .select('*');
      if (error) throw error;
      const rows = (data || []).map(rowToClient);
      return { success: true, data: rows };
    } catch (err: any) {
      console.error('Erro ao buscar clientes no banco de dados:', err);
      return { success: false, error: err.message, data: [] as Candidate[] };
    }
  },

  /** Mesmo dado de fetchCandidates, com o nome que a tela usa. */
  async fetchClients() {
    return DatabaseService.fetchCandidates();
  },

  /**
   * Grava um cliente com tudo o que se sabe sobre ele.
   *
   * Num vínculo, o id de origem vira o id do cliente aqui: é ele que as áreas,
   * os pontos e os check-ins ja usam para apontar para a pessoa, então manter o
   * mesmo id preserva os vínculos e evita registro duplicado a cada importação.
   */
  async upsertCandidate(cand: Omit<Candidate, 'id'> & { id?: string }) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const payload = clientToRow(cand);

      const isNew = !cand.id || cand.id.startsWith('temp-') || cand.id.length < 10;
      if (!isNew && cand.id) {
        payload.id = cand.id;
      }

      const { data, error } = await db
        .from('candidates')
        .upsert(payload)
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] ? rowToClient(data[0]) : undefined };
    } catch (err: any) {
      console.error('Erro ao salvar cliente no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  /** Mesmo upsert, com o nome que a tela usa. */
  async upsertClient(client: Omit<Candidate, 'id'> & { id?: string }) {
    return DatabaseService.upsertCandidate(client);
  },

  async deleteClient(id: string) {
    return DatabaseService.deleteCandidate(id);
  },

  async deleteCandidate(id: string) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { error } = await db
        .from('candidates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar candidato no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async fetchParties() {
    if (!db) return { success: false, data: [] };
    try {
      const { data, error } = await db
        .from('parties')
        .select('*');
      if (error) throw error;
      return { success: true, data: data as Party[] };
    } catch (err: any) {
      console.error('Erro ao buscar partidos no banco de dados:', err);
      return { success: false, error: err.message, data: [] };
    }
  },

  async upsertParty(party: Omit<Party, 'id'> & { id?: string }) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const payload = {
        name: party.name,
        initials: party.initials,
        logo_url: party.logo_url
      } as any;
      
      const isNew = !party.id || party.id.startsWith('temp-') || party.id.length < 10;
      if (!isNew && party.id) {
        payload.id = party.id;
      }

      const { data, error } = await db
        .from('parties')
        .upsert(payload)
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err: any) {
      console.error('Erro ao salvar partido no banco de dados:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteParty(id: string) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { error } = await db
        .from('parties')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar partido no banco de dados:', err);
      return { success: false, error: err.message };
    }
  }
};
