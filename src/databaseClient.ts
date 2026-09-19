import { createClient } from '@supabase/supabase-js';
import {
  PanfletagemArea,
  CampaignPin,
  CheckIn,
  CheckInMedia,
  CheckInNote,
  CheckInOperationRef,
  Candidate,
  Party,
  OperationType,
  PriorityLevel,
  Escola
} from './types';
import type { FichaDispositivo } from './services/dispositivo';

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

/**
 * Deixa no registro do check-in só o que a tabela `check_ins` tem.
 *
 * Observações e operações moram em tabelas próprias; se forem junto no mesmo
 * envio, o banco recusa a gravação inteira por causa de uma coluna que não
 * existe — e o check-in não é salvo.
 */
const somenteColunasDoCheckIn = (checkIn: any) => {
  // status, confirmedAt e updatedAt saem daqui e voltam na primeira tentativa:
  // assim a tentativa seguinte, para bancos sem a migração, fica sem eles.
  // favorite fica de fora: quem grava a estrela é definirFavoritoCheckIn, e
  // num banco sem a migração a coluna derrubaria o upsert inteiro.
  const {
    notes,
    operations,
    status,
    confirmedAt,
    updatedAt,
    favorite,
    trashed,
    ...colunas
  } = checkIn || {};
  return colunas;
};

/** Reclamação de coluna que não existe naquele banco. */
const colunaDesconhecida = (erro: any) =>
  /column|schema cache|PGRST204/i.test(
    `${erro?.message || ''} ${erro?.code || ''} ${erro?.details || ''}`
  );

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
    missionTitle: 'missiontitle',
    confirmedAt: 'confirmedat',
    updatedAt: 'updatedat'
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
      const base = {
        id: type.id,
        label: type.label,
        icon: type.icon,
        color: type.color,
        candidateId: type.candidateId || null,
        createdAt: type.createdAt || new Date().toISOString()
      };
      const completo = {
        ...base,
        description: type.description || null,
        active: type.active !== false,
        position: type.position ?? 0
      };

      const { error } = await db.from('operation_types').upsert(completo);
      if (error) {
        // Banco ainda sem a migracao das colunas novas: grava o que ele tem
        // em vez de recusar o cadastro inteiro.
        if (!colunaDesconhecida(error)) throw error;
        const { error: erroBase } = await db.from('operation_types').upsert(base);
        if (erroBase) throw erroBase;
      }
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
      const agora = new Date().toISOString();
      const base = somenteColunasDoCheckIn(checkIn);
      const payload = prepareUpsertPayload(
        { ...base, status: 'confirmado', confirmedAt: agora, updatedAt: agora },
        'check_ins'
      );

      const { error } = await db.from('check_ins').upsert(payload);
      if (!error) return { success: true };

      // Banco que ainda não recebeu a migração do rascunho não tem status,
      // confirmedAt nem updatedAt. O check-in é mais importante que as três
      // colunas: grava sem elas em vez de perder o registro de campo.
      if (!colunaDesconhecida(error)) throw error;

      const semExtras = prepareUpsertPayload(base, 'check_ins');
      const { error: erroSemExtras } = await db.from('check_ins').upsert(semExtras);
      if (erroSemExtras) throw erroSemExtras;
      console.warn(
        'check-in salvo sem status/confirmedAt/updatedAt: rode a migração 2026-09-19.'
      );
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
  /**
   * Abre o convite prendendo-o ao aparelho que chegou primeiro.
   *
   * Banco que ainda não recebeu a migração da leitura única não tem a função:
   * nesse caso a leitura antiga responde, e o convite volta a valer para
   * qualquer aparelho até alguém concluir o cadastro.
   */
  async abrirConviteEquipe(token: string, deviceIdHash: string) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { data, error } = await db.rpc('open_team_invite', {
        p_token: token,
        p_device: deviceIdHash
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      if (/open_team_invite|function|schema cache|PGRST202/i.test(err?.message || '')) {
        console.warn('Leitura única indisponível: rode a migração 2026-09-19-qrcode-uma-leitura.');
        return this.getTeamInvite(token);
      }
      console.error('Erro ao abrir convite:', err);
      return { success: false, error: err.message };
    }
  },

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
    /** Aparelho que abriu o convite: só ele conclui o cadastro. */
    deviceIdHash?: string;
  }) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const comAparelho = await db.rpc('claim_team_invite_device', {
        p_token: payload.token,
        p_name: payload.name,
        p_whatsapp: payload.whatsapp,
        p_image: payload.image,
        p_extra: payload.extra || {},
        p_device: payload.deviceIdHash || ''
      });
      if (!comAparelho.error) return { success: true, data: comAparelho.data };

      // Banco sem a migração da leitura única: segue pela função antiga.
      if (!/claim_team_invite_device|function|schema cache|PGRST202/i.test(
        comAparelho.error.message || ''
      )) {
        throw comAparelho.error;
      }

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

  /**
   * Envia um arquivo do check-in para o Storage acompanhando o progresso.
   *
   * O cliente do banco resolve o upload numa promessa só, sem avisar o quanto
   * já subiu — e um vídeo de campo leva tempo demais para a tela ficar muda.
   * Por isso o envio é feito no XMLHttpRequest, que reporta byte a byte.
   *
   * Devolve também o caminho dentro do bucket: é por ele que o arquivo é
   * apagado quando a mídia sai do check-in.
   */
  uploadArquivoCheckIn(
    file: File,
    pasta: 'midias' | 'audios',
    onProgress?: (porcento: number) => void
  ): Promise<{ success: boolean; url: string | null; path: string | null; error?: string }> {
    if (!db) {
      return Promise.resolve({
        success: false,
        url: null,
        path: null,
        error: 'banco de dados não configurado.'
      });
    }

    const tipo = file.type || '';
    const extensaoDoNome = file.name.includes('.') ? file.name.split('.').pop() : '';
    // A câmera e o gravador de alguns aparelhos mandam o arquivo sem extensão.
    const padrao = tipo.startsWith('video/') ? 'mp4' : tipo.startsWith('audio/') ? 'webm' : 'jpg';
    const extensao = (extensaoDoNome || padrao).toLowerCase().replace(/[^a-z0-9]/g, '');
    const nome = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extensao}`;
    const caminho = `check_ins/${pasta}/${nome}`;

    return new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${databaseUrl}/storage/v1/object/imagens/${caminho}`, true);
      xhr.setRequestHeader('apikey', databaseAnonKey);
      xhr.setRequestHeader('authorization', `Bearer ${databaseAnonKey}`);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('cache-control', '3600');
      if (tipo) xhr.setRequestHeader('content-type', tipo);

      xhr.upload.onprogress = evento => {
        if (evento.lengthComputable) {
          onProgress?.(Math.round((evento.loaded / evento.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve({
            success: true,
            url: `${databaseUrl}/storage/v1/object/public/imagens/${caminho}`,
            path: caminho
          });
          return;
        }
        let mensagem = `falha no envio (${xhr.status}).`;
        try {
          mensagem = JSON.parse(xhr.responseText)?.message || mensagem;
        } catch {
          /* resposta sem corpo legível */
        }
        console.error('Erro de upload no banco de dados Storage:', xhr.responseText);
        resolve({ success: false, url: null, path: null, error: mensagem });
      };

      xhr.onerror = () =>
        resolve({ success: false, url: null, path: null, error: 'sem conexão para enviar o arquivo.' });
      xhr.onabort = () =>
        resolve({ success: false, url: null, path: null, error: 'envio cancelado.' });

      xhr.send(file);
    });
  },

  /** Apaga do Storage os arquivos que saíram do check-in. */
  async removerArquivosStorage(caminhos: string[]) {
    const lista = caminhos.filter(Boolean);
    if (!db || lista.length === 0) return { success: true };
    try {
      const { error } = await db.storage.from('imagens').remove(lista);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao apagar arquivo no banco de dados Storage:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Grava o check-in ainda como rascunho.
   *
   * O rascunho existe desde a confirmação do local para que cada mídia enviada
   * já tenha a que se ligar: assim o arquivo no Storage nunca fica solto, sem
   * linha no banco que diga de quem ele é.
   */
  async salvarRascunhoCheckIn(checkIn: CheckIn) {
    if (!db) return { success: false };
    try {
      const base = somenteColunasDoCheckIn(checkIn);
      const payload = prepareUpsertPayload(
        { ...base, status: 'rascunho', updatedAt: new Date().toISOString() },
        'check_ins'
      );

      const { error } = await db.from('check_ins').upsert(payload);
      if (!error) return { success: true };
      // Sem a migração do rascunho, o rascunho simplesmente não existe: o
      // check-in segue e é gravado inteiro na confirmação.
      if (!colunaDesconhecida(error)) throw error;
      return { success: false, error: error.message };
    } catch (err: any) {
      console.error('Erro ao salvar rascunho do check-in:', err);
      return { success: false, error: err.message };
    }
  },

  /** Liga uma mídia recém-enviada ao rascunho do check-in. */
  async registrarMidiaCheckIn(
    checkInId: string,
    midia: CheckInMedia & { id: string; position: number }
  ) {
    if (!db) return { success: false };
    try {
      const { error } = await db.from('check_in_media').upsert({
        id: midia.id,
        check_in_id: checkInId,
        kind: midia.type,
        url: midia.url,
        storage_path: midia.storagePath || null,
        mime_type: midia.mimeType || null,
        size_bytes: midia.sizeBytes || null,
        position: midia.position
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao registrar mídia do check-in:', err);
      return { success: false, error: err.message };
    }
  },

  /** Tira a mídia do check-in. O arquivo no Storage é apagado à parte. */
  async removerMidiaCheckIn(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db.from('check_in_media').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao remover mídia do check-in:', err);
      return { success: false, error: err.message };
    }
  },

  /** Regrava as observações do check-in na ordem em que aparecem na conversa. */
  async salvarObservacoesCheckIn(checkInId: string, notas: CheckInNote[]) {
    if (!db) return { success: false };
    try {
      const { error: erroLimpeza } = await db
        .from('check_in_notes')
        .delete()
        .eq('check_in_id', checkInId);
      if (erroLimpeza) throw erroLimpeza;

      if (notas.length === 0) return { success: true };

      const { error } = await db.from('check_in_notes').insert(
        notas.map((nota, i) => ({
          id: nota.id,
          check_in_id: checkInId,
          kind: nota.kind,
          content: nota.kind === 'texto' ? nota.content : null,
          url: nota.url || null,
          storage_path: nota.storagePath || null,
          duration_seconds: nota.durationSeconds ?? null,
          position: i
        }))
      );
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar observações do check-in:', err);
      return { success: false, error: err.message };
    }
  },

  /** Regrava os tipos de operação escolhidos no check-in. */
  async salvarOperacoesCheckIn(checkInId: string, operacoes: CheckInOperationRef[]) {
    if (!db) return { success: false };
    try {
      const { error: erroLimpeza } = await db
        .from('check_in_operations')
        .delete()
        .eq('check_in_id', checkInId);
      if (erroLimpeza) throw erroLimpeza;

      if (operacoes.length === 0) return { success: true };

      const { error } = await db.from('check_in_operations').insert(
        operacoes.map((op, i) => ({
          check_in_id: checkInId,
          operation_type_id: op.operationTypeId,
          operation_type_label: op.operationTypeLabel,
          position: i
        }))
      );
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar operações do check-in:', err);
      return { success: false, error: err.message };
    }
  },

  /** Liga ou desliga a estrela de um check-in. */
  async definirFavoritoCheckIn(id: string, favorito: boolean) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('check_ins')
        .update({ favorite: favorito })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao favoritar check-in:', err);
      return { success: false, error: err.message };
    }
  },

  /** Manda o check-in para a lixeira, ou tira ele de lá. */
  async definirLixeiraCheckIn(id: string, naLixeira: boolean) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('check_ins')
        .update({ trashed: naLixeira })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao mover check-in para a lixeira:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Apaga um check-in de vez.
   *
   * Mídias, observações e operações saem junto pela cascata das tabelas
   * filhas; os arquivos no Storage continuam lá, sem ninguém apontando.
   */
  async excluirCheckIn(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db.from('check_ins').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao excluir check-in:', err);
      return { success: false, error: err.message };
    }
  },

  /** Apaga o rascunho abandonado — as linhas filhas caem junto, por cascata. */
  async descartarRascunhoCheckIn(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('check_ins')
        .delete()
        .eq('id', id)
        .eq('status', 'rascunho');
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao descartar rascunho do check-in:', err);
      return { success: false, error: err.message };
    }
  },

  // --------------------------------------------------------------- aparelhos
  /**
   * Guarda o aparelho de um integrante.
   *
   * Chamado no cadastro pelo QR Code e, depois, a cada entrada no painel, para
   * atualizar a ultima vez em que aquele aparelho apareceu.
   */
  async registrarDispositivoMembro(dados: {
    memberId?: string | null;
    candidateId?: string | null;
    whatsapp?: string | null;
    origem: 'cadastro' | 'login';
    ficha: FichaDispositivo;
  }) {
    if (!db) return { success: false };
    try {
      const { ficha } = dados;
      const linha = {
        member_id: dados.memberId || null,
        candidate_id: dados.candidateId || null,
        whatsapp: dados.whatsapp || null,
        device_id_hash: ficha.deviceIdHash,
        fingerprint: ficha.fingerprint,
        device_type: ficha.deviceType,
        browser: ficha.browser,
        os: ficha.os,
        platform: ficha.platform,
        user_agent: ficha.userAgent,
        screen_resolution: ficha.screenResolution,
        timezone: ficha.timezone,
        language: ficha.language,
        languages: ficha.languages,
        touch_points: ficha.touchPoints,
        ip_hash: ficha.ipHash,
        origin: dados.origem,
        last_seen_at: ficha.accessedAt
      };

      // Mesmo aparelho do mesmo integrante: atualiza, nao duplica.
      if (dados.memberId) {
        const { data: existente } = await db
          .from('member_devices')
          .select('id')
          .eq('member_id', dados.memberId)
          .eq('device_id_hash', ficha.deviceIdHash)
          .limit(1);

        if (existente && existente.length > 0) {
          const { error } = await db
            .from('member_devices')
            .update({ last_seen_at: ficha.accessedAt, ip_hash: ficha.ipHash })
            .eq('id', existente[0].id);
          if (error) throw error;
          return { success: true };
        }
      }

      const { error } = await db.from('member_devices').insert(linha);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao registrar aparelho do integrante:', err);
      return { success: false, error: err.message };
    }
  },

  /** Aparelhos ja vinculados a um integrante. */
  async listarDispositivosMembro(memberId: string) {
    if (!db) return { success: false, data: [] as any[] };
    try {
      const { data, error } = await db
        .from('member_devices')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      console.error('Erro ao ler aparelhos do integrante:', err);
      return { success: false, data: [] as any[], error: err.message };
    }
  },

  /** Marca que aquele aparelho apareceu de novo agora. */
  async marcarDispositivoVisto(id: string, ficha: FichaDispositivo) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('member_devices')
        .update({
          last_seen_at: ficha.accessedAt,
          ip_hash: ficha.ipHash,
          device_id_hash: ficha.deviceIdHash
        })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao atualizar aparelho do integrante:', err);
      return { success: false, error: err.message };
    }
  },

  /** Solta o vinculo: o integrante volta a poder entrar de um aparelho novo. */
  async removerDispositivoMembro(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db.from('member_devices').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao remover aparelho do integrante:', err);
      return { success: false, error: err.message };
    }
  },

  // ----------------------------------------------------------- configuracoes
  /** Lê um ajuste do sistema. Sem banco ou sem valor, devolve vazio. */
  async lerConfiguracao(chave: string) {
    if (!db) return { success: false, value: '' };
    try {
      const { data, error } = await db
        .from('app_settings')
        .select('value')
        .eq('key', chave)
        .limit(1);
      if (error) throw error;
      return { success: true, value: data?.[0]?.value || '' };
    } catch (err: any) {
      console.error('Erro ao ler configuração:', err);
      return { success: false, value: '', error: err.message };
    }
  },

  /** Grava um ajuste do sistema. */
  async gravarConfiguracao(chave: string, valor: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db
        .from('app_settings')
        .upsert({ key: chave, value: valor, updated_at: new Date().toISOString() });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao gravar configuração:', err);
      return { success: false, error: err.message };
    }
  },

  /** Observações e operações de um check-in, para a ficha do administrador. */
  /**
   * Resumo de varios check-ins de uma vez: quantas operacoes e quantos
   * arquivos cada um tem, mais os rotulos das operacoes.
   *
   * A lista da tela precisa disso em todas as linhas ao mesmo tempo; pedir a
   * ficha completa de cada uma seria uma ida ao banco por linha.
   */
  async lerResumoCheckIns(ids: string[]) {
    const vazio = { success: false, operacoes: {} as Record<string, string[]>, midias: {} as Record<string, { imagens: number; videos: number }> };
    if (!db || ids.length === 0) return { ...vazio, success: ids.length === 0 };
    try {
      const [operacoes, midias] = await Promise.all([
        db
          .from('check_in_operations')
          .select('check_in_id, operation_type_label, position')
          .in('check_in_id', ids)
          .order('position', { ascending: true }),
        db
          .from('check_in_media')
          .select('check_in_id, kind')
          .in('check_in_id', ids)
      ]);

      const porOperacao: Record<string, string[]> = {};
      (operacoes.data || []).forEach((linha: any) => {
        const lista = porOperacao[linha.check_in_id] || [];
        if (linha.operation_type_label) lista.push(linha.operation_type_label);
        porOperacao[linha.check_in_id] = lista;
      });

      const porMidia: Record<string, { imagens: number; videos: number }> = {};
      (midias.data || []).forEach((linha: any) => {
        const atual = porMidia[linha.check_in_id] || { imagens: 0, videos: 0 };
        if (linha.kind === 'video') atual.videos += 1;
        else atual.imagens += 1;
        porMidia[linha.check_in_id] = atual;
      });

      return { success: true, operacoes: porOperacao, midias: porMidia };
    } catch (err: any) {
      // Banco sem as tabelas novas nao pode derrubar a lista de check-ins.
      console.warn('Nao foi possivel ler o resumo dos check-ins:', err);
      return vazio;
    }
  },

  async lerDetalhesCheckIn(checkInId: string) {
    if (!db) return { success: false, notas: [] as any[], operacoes: [] as any[], midias: [] as any[] };
    try {
      const [notas, operacoes, midias] = await Promise.all([
        db
          .from('check_in_notes')
          .select('*')
          .eq('check_in_id', checkInId)
          .order('position', { ascending: true }),
        db
          .from('check_in_operations')
          .select('*')
          .eq('check_in_id', checkInId)
          .order('position', { ascending: true }),
        db
          .from('check_in_media')
          .select('*')
          .eq('check_in_id', checkInId)
          .order('position', { ascending: true })
      ]);

      return {
        success: true,
        notas: notas.data || [],
        operacoes: operacoes.data || [],
        midias: midias.data || []
      };
    } catch (err: any) {
      // Banco sem as tabelas novas não pode derrubar a ficha do check-in.
      console.warn('Não foi possível ler os detalhes do check-in:', err);
      return { success: false, notas: [] as any[], operacoes: [] as any[], midias: [] as any[] };
    }
  },

  /**
   * Login do painel.
   *
   * A conferência acontece dentro do banco: o hash da senha nunca sai de lá, e
   * a comparação é feita com crypt(), que refaz o hash com o mesmo sal. Antes
   * disso o app comparava "email = ? and password = ?" lendo a tabela com a
   * chave anônima — que vai no pacote do navegador.
   */
  // ------------------------------------------------------ niveis de prioridade
  /** Níveis de prioridade cadastrados pelo administrador, na ordem da lista. */
  // ------------------------------------------------------------------ escolas
  /**
   * Escolas do municipio, para a camada do mapa.
   *
   * Sem a tabela criada o app segue sem a camada, em vez de quebrar: o botao
   * simplesmente nao aparece.
   */
  async fetchEscolas(municipio: string) {
    if (!db || !municipio) return { success: false, data: [] as Escola[] };
    try {
      const { data, error } = await db
        .from('escolas')
        .select('*')
        .ilike('municipio', municipio.trim())
        .order('nome', { ascending: true });
      if (error) throw error;

      const linhas = (data || []).map((linha: any) => ({
        codigoInep: linha.codigo_inep,
        nome: linha.nome,
        endereco: linha.endereco,
        latitude: Number(linha.latitude),
        longitude: Number(linha.longitude),
        municipio: linha.municipio,
        uf: linha.uf,
        dependencia: linha.dependencia,
        situacao: linha.situacao,
        restricao: linha.restricao,
        telefone: linha.telefone,
        etapas: linha.etapas || [],
        matriculas: linha.matriculas,
        matFeminino: linha.mat_feminino,
        matMasculino: linha.mat_masculino,
        matRacaNaoDeclarada: linha.mat_raca_nao_declarada,
        matBranca: linha.mat_branca,
        matPreta: linha.mat_preta,
        matParda: linha.mat_parda,
        matAmarela: linha.mat_amarela,
        matIndigena: linha.mat_indigena,
        mat0a3: linha.mat_0_3,
        mat4a5: linha.mat_4_5,
        mat6a10: linha.mat_6_10,
        mat11a14: linha.mat_11_14,
        mat15a17: linha.mat_15_17,
        mat18Mais: linha.mat_18_mais,
        matInfantil: linha.mat_infantil,
        matCreche: linha.mat_creche,
        matPreEscola: linha.mat_pre_escola,
        matFundamental: linha.mat_fundamental,
        matFundIniciais: linha.mat_fund_iniciais,
        matFundFinais: linha.mat_fund_finais,
        matMedio: linha.mat_medio,
        matProfissional: linha.mat_profissional,
        matEja: linha.mat_eja,
        matEjaFundamental: linha.mat_eja_fundamental,
        matEjaMedio: linha.mat_eja_medio,
        matEspecial: linha.mat_especial
      })) as Escola[];

      return { success: true, data: linhas };
    } catch (err: any) {
      console.warn('Nao foi possivel buscar as escolas do municipio:', err);
      return { success: false, data: [] as Escola[], error: err.message };
    }
  },

  async fetchPriorityLevels() {
    if (!db) return { success: false, data: [] as PriorityLevel[] };
    try {
      const { data, error } = await db
        .from('priority_levels')
        .select('*')
        .order('position', { ascending: true });
      if (error) throw error;
      return { success: true, data: (data || []) as PriorityLevel[] };
    } catch (err: any) {
      // Banco sem a tabela cai na lista fixa do código, e nada quebra.
      console.warn('Erro ao buscar níveis de prioridade:', err);
      return { success: false, data: [] as PriorityLevel[], error: err.message };
    }
  },

  async upsertPriorityLevel(nivel: PriorityLevel) {
    if (!db) return { success: false };
    try {
      const { error } = await db.from('priority_levels').upsert({
        id: nivel.id,
        label: nivel.label,
        description: nivel.description || null,
        color: nivel.color,
        position: nivel.position
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar nível de prioridade:', err);
      return { success: false, error: err.message };
    }
  },

  async deletePriorityLevel(id: string) {
    if (!db) return { success: false };
    try {
      const { error } = await db.from('priority_levels').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao remover nível de prioridade:', err);
      return { success: false, error: err.message };
    }
  },

  async loginAdmin(email: string, password: string) {
    if (!db) {
      return { success: false, error: 'banco de dados não configurado.' };
    }
    const conta = email.trim().toLowerCase();
    try {
      const { data, error } = await db.rpc('login_admin', {
        p_email: conta,
        p_password: password
      });

      if (error) {
        // Banco que ainda não recebeu a migração não tem a função: cai na
        // comparação antiga, para ninguém ficar sem entrar no painel.
        if (/login_admin|function|schema cache|PGRST202/i.test(error.message || '')) {
          console.warn('Senhas ainda em texto puro: rode a migração 2026-09-19-senhas-em-hash.');
          return this.loginAdminTextoPuro(conta, password);
        }
        throw error;
      }

      if (data?.ok) {
        return { success: true, user: { email: data.email, name: data.name } };
      }
      return { success: false, error: 'Usuário ou senha inválidos.' };
    } catch (err: any) {
      console.error('Erro ao autenticar administrador:', err);
      return { success: false, error: err.message || 'Erro inesperado ao realizar login.' };
    }
  },

  /** Caminho antigo, só enquanto a migração das senhas não roda. */
  async loginAdminTextoPuro(email: string, password: string) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { data, error } = await db
        .from('auth_users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .maybeSingle();
      if (error) throw error;
      if (data) return { success: true, user: data };
      return { success: false, error: 'Usuário ou senha inválidos.' };
    } catch (err: any) {
      console.error('Erro ao autenticar administrador:', err);
      return { success: false, error: err.message || 'Erro inesperado ao realizar login.' };
    }
  },

  /** Cadastra ou troca a senha de uma conta do painel. Guarda só o hash. */
  async definirSenhaAdmin(dados: {
    email: string;
    novaSenha: string;
    senhaAtual?: string;
    nome?: string;
  }) {
    if (!db) return { success: false, error: 'banco de dados não configurado.' };
    try {
      const { data, error } = await db.rpc('set_admin_password', {
        p_email: dados.email.trim().toLowerCase(),
        p_new_password: dados.novaSenha,
        p_old_password: dados.senhaAtual ?? null,
        p_name: dados.nome ?? null
      });
      if (error) throw error;
      if (data?.ok) return { success: true };
      const motivos: Record<string, string> = {
        senha_curta: 'A senha precisa ter pelo menos 8 caracteres.',
        senha_atual_incorreta: 'A senha atual está incorreta.'
      };
      return { success: false, error: motivos[data?.reason] || 'Não foi possível salvar a senha.' };
    } catch (err: any) {
      console.error('Erro ao definir senha do administrador:', err);
      return { success: false, error: err.message };
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
