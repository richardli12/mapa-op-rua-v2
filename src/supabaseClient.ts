import { createClient } from '@supabase/supabase-js';
import { PanfletagemArea, CampaignPin, CheckIn, Candidate, Party, OperationType } from './types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Script completo de criacao do banco.
// Espelho de supabase/schema.sql - o app mostra este texto na tela de
// Configuracoes para copiar e colar no SQL Editor do Supabase.
export const SUPABASE_SQL_SETUP = `-- ============================================================================
-- MAPA DE LOCALIZACAO REAL - Banco de dados completo (Supabase / PostgreSQL)
--
-- Como usar: Painel do Supabase -> SQL Editor -> New query -> cole este
-- arquivo inteiro -> Run.
--
-- O script e idempotente: pode ser executado num banco novo (cria tudo) ou
-- num banco que ja tem parte das tabelas (so completa o que falta). Nada e
-- apagado em nenhum dos dois casos.
--
-- Cobertura: tela de login, cadastro de candidatos e partidos, Equipe (Time
-- Delta), tipos de operacao, areas de panfletagem, pontos estrategicos,
-- check-ins (missao e livre, com fotos e videos), Storage, Realtime e
-- politicas de acesso.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Extensoes
-- ----------------------------------------------------------------------------
-- gen_random_uuid() para os ids gerados pelo proprio banco.
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- 1. auth_users - login do painel administrativo
-- ----------------------------------------------------------------------------
-- A tela de login consulta email + password direto nesta tabela
-- (SupabaseService.loginAdmin). A senha fica em texto puro porque e assim que
-- o app compara hoje; veja a observacao de seguranca no fim do arquivo.
create table if not exists public.auth_users (
  email      text primary key,
  password   text not null,
  name       text,
  created_at timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- 2. candidates - CLIENTES do sistema
-- ----------------------------------------------------------------------------
-- E a entidade principal do painel: areas, pontos e check-ins apontam para um
-- cliente. O cadastro nasce de dois jeitos, e source diz qual:
--   'manual'    - o administrador digitou os dados na tela;
--   'vinculado' - o administrador escolheu alguem de uma base externa e o
--                 sistema copiou a ficha inteira para ca (foto, contatos,
--                 partido e o id de origem em external_id).
--
-- O id e text (e nao uuid) de proposito: num vinculo, o id de origem vira o id
-- do cliente aqui, e ele pode chegar em qualquer formato. Com text os dois
-- casos entram sem erro, e o default continua em formato uuid, que e o que o
-- app espera ao reconhecer um registro ja salvo.
--
-- raw guarda a ficha crua da origem inteira, entao nada se perde mesmo que a
-- base externa passe a mandar um campo que ainda nao tem coluna aqui.
create table if not exists public.candidates (
  id                   text primary key default gen_random_uuid()::text,
  name                 text not null,
  phone                text,
  instagram_handle     text,
  city                 text,
  estado               text,
  office               text,
  image                text,
  status_active        boolean default true,

  source               text default 'manual',
  external_id          text,

  email                text,
  campanha             text,
  numero_campanha      text,
  link_grupo_whatsapp  text,
  favorito             boolean,

  party_id             text,   -- id do partido na origem
  party_name           text,
  party_initials       text,
  party_logo_url       text,
  party_color          text,

  sync_team            boolean default false,  -- trazer a equipe da origem?
  external_created_at  text,   -- data de cadastro na base de origem
  raw                  jsonb,  -- ficha crua da origem, inteira
  created_at           timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- 3. parties - partidos
-- ----------------------------------------------------------------------------
create table if not exists public.parties (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  initials   text not null,
  logo_url   text,
  color      text,               -- cor primaria do partido
  created_at timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- 4. time_delta - Equipe em campo (quem faz check-in)
-- ----------------------------------------------------------------------------
-- O whatsapp e a chave de entrada da tela de check-in: e por ele que o app
-- reconhece o integrante (checkSupporter) e por ele que o upsert resolve
-- conflito, entao o unique e obrigatorio.
--
-- candidate_id fica sem foreign key porque um integrante pode chegar do Nexus
-- vinculado a um candidato que ainda nao foi espelhado na tabela candidates.
create table if not exists public.time_delta (
  id           text primary key default gen_random_uuid()::text,
  full_name    text,
  whatsapp     text not null unique,
  candidate_id text,
  image        text,
  created_at   timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- 5. operation_types - Tipos de Operacao dos pontos do mapa
-- ----------------------------------------------------------------------------
-- Lista cadastravel pelo proprio usuario. As colunas em camelCase ficam entre
-- aspas porque e exatamente assim que o app grava e le.
create table if not exists public.operation_types (
  id          text primary key,
  label       text not null,
  icon        text,
  color       text,
  "createdAt" text
);


-- ----------------------------------------------------------------------------
-- 6. panfletagem_areas - areas de panfletagem (circulos no mapa)
-- ----------------------------------------------------------------------------
-- center guarda { lat, lng, assignedDeltas } e "assignedDeltas" guarda a mesma
-- lista no nivel de cima - o app manda os dois no mesmo upsert, entao as duas
-- colunas precisam existir.
create table if not exists public.panfletagem_areas (
  id                text primary key,
  title             text not null,
  description       text,
  bairro            text,
  center            jsonb not null,
  radius            numeric not null,
  color             text,
  active            boolean default true,
  "teamSize"        integer,
  "contactName"     text,
  "createdAt"       text,
  "candidateId"     text,
  "assignedDeltas"  jsonb
);


-- ----------------------------------------------------------------------------
-- 7. campaign_pins - pontos estrategicos (pinos no mapa)
-- ----------------------------------------------------------------------------
create table if not exists public.campaign_pins (
  id                text primary key,
  title             text not null,
  description       text,
  position          jsonb not null,   -- { lat, lng, assignedDeltas }
  color             text,
  "iconType"        text,             -- id em operation_types
  active            boolean default true,
  "createdAt"       text,
  date              text,
  "candidateId"     text,
  "assignedDeltas"  jsonb
);


-- ----------------------------------------------------------------------------
-- 8. check_ins - registros feitos em campo
-- ----------------------------------------------------------------------------
-- coordinates    = ponto escolhido para aparecer no mapa
-- userLatitude/Longitude = onde o aparelho estava de fato
-- photo          = primeira imagem (miniatura e registros antigos)
-- media          = todas as fotos e videos: [{ url, type: 'image' | 'video' }]
-- mode           = 'missao' (missao enviada pelo comite) ou 'livre'
-- priority       = 'baixa' | 'media' | 'alta' | 'urgente' (check-in livre)
create table if not exists public.check_ins (
  id              text primary key,
  name            text not null,
  bairro          text,
  rua             text,
  municipio       text,
  estado          text,
  photo           text,
  media           jsonb,
  coordinates     jsonb not null,
  "userLatitude"  double precision,
  "userLongitude" double precision,
  "createdAt"     text,
  "candidateId"   text,
  mode            text,
  priority        text,
  "missionId"     text,
  "missionTitle"  text
);


-- ----------------------------------------------------------------------------
-- 9. Migracoes - completa bancos que ja existiam antes
-- ----------------------------------------------------------------------------
-- Num banco novo nada aqui muda coisa alguma; num banco antigo, adiciona as
-- colunas que entraram depois.
alter table public.auth_users        add column if not exists name text;
alter table public.auth_users        add column if not exists created_at timestamptz default now();

alter table public.candidates        add column if not exists estado text;
alter table public.candidates        add column if not exists party_id text;
alter table public.candidates        add column if not exists status_active boolean default true;
alter table public.candidates        add column if not exists created_at timestamptz default now();
alter table public.candidates        add column if not exists source text default 'manual';
alter table public.candidates        add column if not exists external_id text;
alter table public.candidates        add column if not exists email text;
alter table public.candidates        add column if not exists campanha text;
alter table public.candidates        add column if not exists numero_campanha text;
alter table public.candidates        add column if not exists link_grupo_whatsapp text;
alter table public.candidates        add column if not exists favorito boolean;
alter table public.candidates        add column if not exists party_name text;
alter table public.candidates        add column if not exists party_initials text;
alter table public.candidates        add column if not exists party_logo_url text;
alter table public.candidates        add column if not exists party_color text;
alter table public.candidates        add column if not exists sync_team boolean default false;
alter table public.candidates        add column if not exists external_created_at text;
alter table public.candidates        add column if not exists raw jsonb;

alter table public.parties           add column if not exists color text;
alter table public.parties           add column if not exists created_at timestamptz default now();

alter table public.time_delta        add column if not exists image text;
alter table public.time_delta        add column if not exists created_at timestamptz default now();

alter table public.panfletagem_areas add column if not exists "candidateId" text;
alter table public.panfletagem_areas add column if not exists "assignedDeltas" jsonb;

alter table public.campaign_pins     add column if not exists "candidateId" text;
alter table public.campaign_pins     add column if not exists "assignedDeltas" jsonb;

alter table public.check_ins         add column if not exists municipio text;
alter table public.check_ins         add column if not exists estado text;
alter table public.check_ins         add column if not exists media jsonb;
alter table public.check_ins         add column if not exists mode text;
alter table public.check_ins         add column if not exists priority text;
alter table public.check_ins         add column if not exists "missionId" text;
alter table public.check_ins         add column if not exists "missionTitle" text;


-- ----------------------------------------------------------------------------
-- 10. Restricoes de dominio do check-in
-- ----------------------------------------------------------------------------
-- Aceitam nulo para nao invalidar registros antigos, gravados antes do
-- check-in livre existir.
do $$
begin
  alter table public.check_ins
    add constraint check_ins_mode_valido
    check (mode is null or mode in ('missao', 'livre'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.check_ins
    add constraint check_ins_priority_valida
    check (priority is null or priority in ('baixa', 'media', 'alta', 'urgente'));
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- 11. Indices - as consultas que o app faz o tempo todo
-- ----------------------------------------------------------------------------
create index if not exists idx_check_ins_candidato  on public.check_ins ("candidateId");
create index if not exists idx_check_ins_criacao    on public.check_ins ("createdAt" desc);
create index if not exists idx_check_ins_modo       on public.check_ins (mode);
create index if not exists idx_check_ins_missao     on public.check_ins ("missionId");

create index if not exists idx_areas_candidato      on public.panfletagem_areas ("candidateId");
create index if not exists idx_areas_ativa          on public.panfletagem_areas (active);

create index if not exists idx_pins_candidato       on public.campaign_pins ("candidateId");
create index if not exists idx_pins_ativo           on public.campaign_pins (active);
create index if not exists idx_pins_tipo            on public.campaign_pins ("iconType");

create index if not exists idx_time_delta_candidato on public.time_delta (candidate_id);

create index if not exists idx_candidates_partido   on public.candidates (party_id);
create index if not exists idx_candidates_origem    on public.candidates (source);
create unique index if not exists idx_candidates_external
  on public.candidates (external_id) where external_id is not null;


-- ----------------------------------------------------------------------------
-- 12. Tipos de Operacao padrao
-- ----------------------------------------------------------------------------
-- Os ids sao os mesmos que os pontos ja gravados usam, entao nada do que esta
-- no mapa perde o icone. O "do nothing" preserva as edicoes do usuario.
insert into public.operation_types (id, label, icon, color, "createdAt") values
  ('flag',      'Base Operacional',      'flag',      '#2563eb', now()::text),
  ('group',     'Reuniao de Equipe',     'group',     '#7c3aed', now()::text),
  ('star',      'Evento / Acao',         'star',      '#ca8a04', now()::text),
  ('megaphone', 'Divulgacao',            'megaphone', '#ea580c', now()::text),
  ('home',      'Visita / Atendimento',  'home',      '#16a34a', now()::text),
  ('sound',     'Veiculo de Som',        'sound',     '#0891b2', now()::text)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- 13. Usuario inicial do painel
-- ----------------------------------------------------------------------------
-- TROQUE A SENHA depois do primeiro acesso:
--   update public.auth_users set password = 'sua-senha' where email = 'admin@totalmapa.com';
insert into public.auth_users (email, password, name)
values ('admin@totalmapa.com', 'troque-esta-senha', 'Administrador')
on conflict (email) do nothing;


-- ----------------------------------------------------------------------------
-- 14. Storage - bucket "imagens" (fotos e videos do check-in)
-- ----------------------------------------------------------------------------
-- O app envia os arquivos para imagens/check_ins/ e usa a URL publica.
insert into storage.buckets (id, name, public)
values ('imagens', 'imagens', true)
on conflict (id) do update set public = true;

do $$
begin
  drop policy if exists "imagens_leitura"     on storage.objects;
  drop policy if exists "imagens_envio"       on storage.objects;
  drop policy if exists "imagens_atualizacao" on storage.objects;
  drop policy if exists "imagens_remocao"     on storage.objects;

  create policy "imagens_leitura" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'imagens');

  create policy "imagens_envio" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'imagens');

  create policy "imagens_atualizacao" on storage.objects
    for update to anon, authenticated
    using (bucket_id = 'imagens')
    with check (bucket_id = 'imagens');

  create policy "imagens_remocao" on storage.objects
    for delete to anon, authenticated
    using (bucket_id = 'imagens');
exception when insufficient_privilege then
  raise notice 'Sem permissao para criar policies em storage.objects. Crie-as pelo painel: Storage > imagens > Policies.';
end $$;


-- ----------------------------------------------------------------------------
-- 15. Realtime - o mapa atualiza sozinho
-- ----------------------------------------------------------------------------
-- Sem isto o pino so aparece depois de recarregar a pagina. O "add table"
-- reclama se a tabela ja estiver na publicacao, e isso aqui e so um aviso.
do $$
declare t text;
begin
  foreach t in array array['check_ins', 'panfletagem_areas', 'campaign_pins', 'operation_types']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then
      raise notice 'Realtime ja ativo para %', t;
    end;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 16. Acesso (RLS)
-- ----------------------------------------------------------------------------
-- O app fala com o banco usando a chave anon, sem sessao de usuario do
-- Supabase Auth. Entao o RLS fica ligado (o painel do Supabase cobra isso)
-- com uma policy liberando leitura e escrita para essa chave - o efeito
-- pratico e o mesmo de deixar o RLS desligado, sem os alertas.
do $$
declare t text;
begin
  foreach t in array array[
    'auth_users', 'candidates', 'parties', 'time_delta',
    'operation_types', 'panfletagem_areas', 'campaign_pins', 'check_ins'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "acesso_app" on public.%I', t);
    execute format(
      'create policy "acesso_app" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 17. Recarrega o cache do PostgREST
-- ----------------------------------------------------------------------------
-- A API do Supabase guarda em cache o desenho das tabelas. Sem este aviso, uma
-- coluna recem-criada so aparece para o app depois de alguns minutos - ate la
-- ele responde "Could not find the ... column ... in the schema cache".
notify pgrst, 'reload schema';


-- ============================================================================
-- Observacao de seguranca
--
-- auth_users guarda a senha em texto puro e a policy acima deixa a tabela
-- legivel pela chave anon, que vai no bundle do navegador - ou seja, hoje
-- qualquer pessoa com a URL do app consegue ler as senhas do painel. O script
-- foi mantido assim porque e o formato que o login do app compara. Para
-- fechar isso de verdade, o caminho e migrar o login para o Supabase Auth ou
-- guardar so o hash (pgcrypto) e comparar numa funcao RPC - as duas mudancas
-- pedem ajuste no codigo do app tambem.
-- ============================================================================
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

  /** Tipos de Operação cadastrados pelo usuário. */
  async fetchOperationTypes() {
    if (!supabase) return { success: false, data: [] as OperationType[] };
    try {
      const { data, error } = await supabase
        .from('operation_types')
        .select('*');
      if (error) throw error;
      const rows = (data || []).map(row => normalizeFields<OperationType>(row));
      return { success: true, data: rows };
    } catch (err: any) {
      console.warn('Erro ao buscar tipos de operação no Supabase:', err);
      return { success: false, error: err.message, data: [] as OperationType[] };
    }
  },

  async upsertOperationType(type: OperationType) {
    if (!supabase) return { success: false };
    try {
      const { error } = await supabase
        .from('operation_types')
        .upsert({
          id: type.id,
          label: type.label,
          icon: type.icon,
          color: type.color,
          createdAt: type.createdAt || new Date().toISOString()
        });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar tipo de operação no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteOperationType(id: string) {
    if (!supabase) return { success: false };
    try {
      const { error } = await supabase
        .from('operation_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao deletar tipo de operação no Supabase:', err);
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

  /** Envia uma foto ou um vídeo do check-in para o Storage e devolve a URL pública. */
  async uploadMedia(file: File) {
    if (!supabase) {
      return { success: false, url: null, error: 'Supabase não configurado.' };
    }
    try {
      const isVideo = file.type.startsWith('video/');
      const nameExt = file.name.includes('.') ? file.name.split('.').pop() : '';
      // A câmera de alguns aparelhos manda o arquivo sem extensão no nome.
      const fileExt = nameExt || (isVideo ? 'mp4' : 'jpg');
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `check_ins/${fileName}`;

      const { error } = await supabase.storage
        .from('imagens')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('imagens')
        .getPublicUrl(filePath);

      return { success: true, url: publicUrl, error: null };
    } catch (err: any) {
      console.error('Erro de upload no Supabase Storage:', err);
      return {
        success: false,
        url: null,
        error: err.message || 'Falha no upload do arquivo.'
      };
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
    if (!supabase) return { success: false, data: [] as Candidate[] };
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*');
      if (error) throw error;
      const rows = (data || []).map(rowToClient);
      return { success: true, data: rows };
    } catch (err: any) {
      console.error('Erro ao buscar clientes no Supabase:', err);
      return { success: false, error: err.message, data: [] as Candidate[] };
    }
  },

  /** Mesmo dado de fetchCandidates, com o nome que a tela usa. */
  async fetchClients() {
    return SupabaseService.fetchCandidates();
  },

  /**
   * Grava um cliente com tudo o que se sabe sobre ele.
   *
   * Num vínculo, o id de origem vira o id do cliente aqui: é ele que as áreas,
   * os pontos e os check-ins ja usam para apontar para a pessoa, então manter o
   * mesmo id preserva os vínculos e evita registro duplicado a cada importação.
   */
  async upsertCandidate(cand: Omit<Candidate, 'id'> & { id?: string }) {
    if (!supabase) return { success: false, error: 'Supabase não configurado.' };
    try {
      const payload = clientToRow(cand);

      const isNew = !cand.id || cand.id.startsWith('temp-') || cand.id.length < 10;
      if (!isNew && cand.id) {
        payload.id = cand.id;
      }

      const { data, error } = await supabase
        .from('candidates')
        .upsert(payload)
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] ? rowToClient(data[0]) : undefined };
    } catch (err: any) {
      console.error('Erro ao salvar cliente no Supabase:', err);
      return { success: false, error: err.message };
    }
  },

  /** Mesmo upsert, com o nome que a tela usa. */
  async upsertClient(client: Omit<Candidate, 'id'> & { id?: string }) {
    return SupabaseService.upsertCandidate(client);
  },

  async deleteClient(id: string) {
    return SupabaseService.deleteCandidate(id);
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
