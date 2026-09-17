-- ============================================================================
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
-- Cada cliente tem os seus tipos: "candidateId" e o dono, e tipo sem dono nao
-- aparece em tela nenhuma. Nao existe tipo fixo - um cliente novo comeca sem
-- nenhum. As colunas em camelCase ficam entre aspas porque e exatamente assim
-- que o app grava e le.
create table if not exists public.operation_types (
  id            text primary key,
  label         text not null,
  icon          text,
  color         text,
  "candidateId" text,
  "createdAt"   text
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

alter table public.operation_types   add column if not exists "candidateId" text;

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

create index if not exists idx_op_types_cliente    on public.operation_types ("candidateId");

create index if not exists idx_time_delta_candidato on public.time_delta (candidate_id);

create index if not exists idx_candidates_partido   on public.candidates (party_id);
create index if not exists idx_candidates_origem    on public.candidates (source);
create unique index if not exists idx_candidates_external
  on public.candidates (external_id) where external_id is not null;


-- ----------------------------------------------------------------------------
-- 12. Usuario inicial do painel
-- ----------------------------------------------------------------------------
-- TROQUE A SENHA depois do primeiro acesso:
--   update public.auth_users set password = 'sua-senha' where email = 'admin@totalmapa.com';
insert into public.auth_users (email, password, name)
values ('admin@totalmapa.com', 'troque-esta-senha', 'Administrador')
on conflict (email) do nothing;


-- ----------------------------------------------------------------------------
-- 13. Arquivos - bucket "imagens" (fotos e videos do check-in)
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
-- 14. Realtime - o mapa atualiza sozinho
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
-- 15. Acesso (RLS)
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
-- 16. Recarrega o cache do PostgREST
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
