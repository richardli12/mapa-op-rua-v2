import { createClient } from '@supabase/supabase-js';
import { PanfletagemArea, CampaignPin, CheckIn, Candidate, Party } from './types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// SQL snippet to create tables
export const SUPABASE_SQL_SETUP = `-- Script de Configuração do Supabase (Acesse o Painel do Supabase -> SQL Editor -> Cole e execute este script)

create table if not exists panfletagem_areas (
  id text primary key,
  title text not null,
  description text,
  bairro text,
  center jsonb not null,
  radius numeric not null,
  color text,
  active boolean default true,
  "teamSize" integer,
  "contactName" text,
  "createdAt" text,
  "candidateId" text
);

create table if not exists campaign_pins (
  id text primary key,
  title text not null,
  description text,
  position jsonb not null,
  color text,
  "iconType" text,
  active boolean default true,
  "createdAt" text,
  date text,
  "candidateId" text
);

create table if not exists check_ins (
  id text primary key,
  name text not null,
  bairro text,
  rua text,
  municipio text,
  estado text,
  photo text, -- Armazena a imagem em formato base64
  coordinates jsonb not null,
  "userLatitude" double precision,
  "userLongitude" double precision,
  "createdAt" text,
  "candidateId" text,
  mode text,
  priority text,
  "missionId" text,
  "missionTitle" text
);

-- Migração para bancos já existentes: adiciona as colunas do check-in livre
-- (modalidade sem missão, com grau de prioridade/impacto).
alter table check_ins add column if not exists mode text;
alter table check_ins add column if not exists priority text;
alter table check_ins add column if not exists "missionId" text;
alter table check_ins add column if not exists "missionTitle" text;

create table if not exists auth_users (
  email text primary key,
  password text not null
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  instagram_handle text,
  city text,
  estado text,
  office text,
  image text
);

create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  logo_url text
);

create table if not exists time_delta (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  whatsapp text not null unique,
  candidate_id uuid references candidates(id),
  image text
);

-- Ativar RLS ou desativar conforme sua necessidade. Por padrão, se você quiser ler/escrever anonimamente,
-- pode desabilitar RLS ou criar políticas de leitura e gravação para todos.
alter table panfletagem_areas disable row level security;
alter table campaign_pins disable row level security;
alter table check_ins disable row level security;
alter table auth_users disable row level security;
alter table candidates disable row level security;
alter table parties disable row level security;
alter table time_delta disable row level security;
`;

/**
 * Service to sync areas, pins, and check-ins with Supabase.
 * Each method returns success state, and any error message.
 */
let detectedCasing: { [table: string]: 'camel' | 'lower' } = {
  panfletagem_areas: 'camel',
  campaign_pins: 'camel',
  check_ins: 'camel'
};

export async function detectTableCasing() {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('campaign_pins').select('candidateId').limit(0);
    if (error) {
      detectedCasing.campaign_pins = 'lower';
    }
  } catch (e) {
    detectedCasing.campaign_pins = 'lower';
  }

  try {
    const { error } = await supabase.from('panfletagem_areas').select('candidateId').limit(0);
    if (error) {
      detectedCasing.panfletagem_areas = 'lower';
    }
  } catch (e) {
    detectedCasing.panfletagem_areas = 'lower';
  }

  try {
    const { error } = await supabase.from('check_ins').select('candidateId').limit(0);
    if (error) {
      detectedCasing.check_ins = 'lower';
    }
  } catch (e) {
    detectedCasing.check_ins = 'lower';
  }
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

export const SupabaseService = {
  async fetchAll() {
    if (!supabase) {
      return { success: false, data: null, error: 'Supabase não configurado.' };
    }

    try {
      // Detect column casing dynamically
      await detectTableCasing();

      // Fetch areas
      const { data: areas, error: areasError } = await supabase
        .from('panfletagem_areas')
        .select('*');

      // Fetch pins
      const { data: pins, error: pinsError } = await supabase
        .from('campaign_pins')
        .select('*');

      // Fetch checkins
      const { data: checkins, error: checkinsError } = await supabase
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
      console.warn('Erro ao ler do Supabase:', err);
      // Check if error is due to missing tables
      const isMissingTable = err.message?.includes('does not exist') || err.code === '42P01';
      return {
        success: false,
        data: null,
        error: isMissingTable
          ? 'Tabelas não encontradas no Supabase. Crie-as executando o script SQL disponível nas configurações.'
          : err.message || 'Erro desconhecido ao carregar do Supabase.'
      };
    }
  },

  async upsertArea(area: PanfletagemArea) {
    if (!supabase) return { success: false };
    try {
      const payload = prepareUpsertPayload(area, 'panfletagem_areas');
      const { error } = await supabase
        .from('panfletagem_areas')
        .upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar área no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteArea(id: string) {
    if (!supabase) return { success: false };
    try {
      const { error } = await supabase
        .from('panfletagem_areas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar área no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async upsertPin(pin: CampaignPin) {
    if (!supabase) return { success: false };
    try {
      const payload = prepareUpsertPayload(pin, 'campaign_pins');
      const { error } = await supabase
        .from('campaign_pins')
        .upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar pin no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async deletePin(id: string) {
    if (!supabase) return { success: false };
    try {
      const { error } = await supabase
        .from('campaign_pins')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar pin no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async upsertCheckIn(checkIn: CheckIn) {
    if (!supabase) return { success: false };
    try {
      const payload = prepareUpsertPayload(checkIn, 'check_ins');
      const { error } = await supabase
        .from('check_ins')
        .upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar check-in no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteCheckIn(id: string) {
    if (!supabase) return { success: false };
    try {
      const { error } = await supabase
        .from('check_ins')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar check-in no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async checkSupporter(whatsapp: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase não configurado.' };
    }
    try {
      const cleanNumber = whatsapp.replace(/\D/g, '');
      const { data, error } = await supabase
        .from('time_delta')
        .select('*')
        .or(`whatsapp.eq."${whatsapp}",whatsapp.eq."${cleanNumber}"`);

      if (error) throw error;

      if (data && data.length > 0) {
        return { success: true, supporter: data[0] };
      }

      return { success: false, error: 'WhatsApp não credenciado na lista da Equipe.' };
    } catch (err: any) {
      console.error('Erro ao buscar delta no Supabase:', err);
      return { success: false, error: err.message || 'Erro inesperado ao verificar o WhatsApp.' };
    }
  },

  async fetchSupporters() {
    if (!supabase) return { success: false, data: [] };
    try {
      const { data, error } = await supabase
        .from('time_delta')
        .select('*');
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.warn('Erro ao buscar deltas do Supabase:', err);
      return { success: false, error: err.message, data: [] };
    }
  },

  async upsertSupporter(supporter: { id: string; full_name: string; whatsapp: string; candidate_id?: string; image?: string }) {
    if (!supabase) {
      return { success: false, error: 'Supabase não configurado.' };
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

      const isUuid = (str?: string) => str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;
      
      let targetId = supporter.id;
      if (isUuid(targetId)) {
        payload.id = targetId;
      } else {
        // Se o ID não for um UUID válido (pode ser o ID gerado localmente na autenticação inicial), tenta achar pelo whatsapp
        const { data } = await supabase
          .from('time_delta')
          .select('id')
          .or(`whatsapp.eq."${supporter.whatsapp}",whatsapp.eq."${cleanWhatsapp}"`)
          .limit(1);
        if (data && data.length > 0) {
          payload.id = data[0].id;
        }
      }

      const { data, error } = await supabase
        .from('time_delta')
        .upsert(payload, { onConflict: 'whatsapp' })
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Erro ao atualizar delta no Supabase:', err);
      return { success: false, error: err.message || 'Erro ao salvar dados do integrante da Equipe.' };
    }
  },

  async deleteSupporter(id: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase não configurado.' };
    }
    try {
      // Se não for UUID válido, tenta achar e deletar pelo valor (mas se for UUID faz por ID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = supabase.from('time_delta').delete();
      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.eq('id', id); // fallback standard query
      }
      const { error } = await query;
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar delta do Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async uploadImage(file: File) {
    if (!supabase) {
      return { success: false, url: null, error: 'Supabase não configurado.' };
    }
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `check_ins/${fileName}`;

      const { error } = await supabase.storage
        .from('imagens')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('imagens')
        .getPublicUrl(filePath);

      return { success: true, url: publicUrl, error: null };
    } catch (err: any) {
      console.error('Erro de upload no Supabase Storage:', err);
      return { success: false, url: null, error: err.message || 'Falha no upload da imagem.' };
    }
  },

  async loginAdmin(email: string, password: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase não configurado.' };
    }
    try {
      const { data, error } = await supabase
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
    if (!supabase) return { success: false, data: [] };
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*');
      if (error) throw error;
      return { success: true, data: data as Candidate[] };
    } catch (err: any) {
      console.error('Erro ao buscar candidatos no Supabase:', err);
      return { success: false, error: err.message, data: [] };
    }
  },

  async upsertCandidate(cand: Omit<Candidate, 'id'> & { id?: string }) {
    if (!supabase) return { success: false, error: 'Supabase não configurado.' };
    try {
      const payload = {
        name: cand.name,
        phone: cand.phone,
        instagram_handle: cand.instagram_handle,
        city: cand.city,
        estado: cand.estado,
        office: cand.office,
        image: cand.image
      } as any;
      
      const isNew = !cand.id || cand.id.startsWith('temp-') || cand.id.length < 10;
      if (!isNew && cand.id) {
        payload.id = cand.id;
      }

      const { data, error } = await supabase
        .from('candidates')
        .upsert(payload)
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err: any) {
      console.error('Erro ao salvar candidato no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteCandidate(id: string) {
    if (!supabase) return { success: false, error: 'Supabase não configurado.' };
    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar candidato no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async fetchParties() {
    if (!supabase) return { success: false, data: [] };
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('*');
      if (error) throw error;
      return { success: true, data: data as Party[] };
    } catch (err: any) {
      console.error('Erro ao buscar partidos no Supabase:', err);
      return { success: false, error: err.message, data: [] };
    }
  },

  async upsertParty(party: Omit<Party, 'id'> & { id?: string }) {
    if (!supabase) return { success: false, error: 'Supabase não configurado.' };
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

      const { data, error } = await supabase
        .from('parties')
        .upsert(payload)
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err: any) {
      console.error('Erro ao salvar partido no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteParty(id: string) {
    if (!supabase) return { success: false, error: 'Supabase não configurado.' };
    try {
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar partido no Supabase:', err);
      return { success: false, error: err.message };
    }
  }
};
