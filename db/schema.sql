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
-- A senha e guardada so em hash bcrypt (pgcrypto), em password_hash. A coluna
-- password continua existindo, vazia, para nao quebrar instalacao antiga que
-- ainda a leia. Quem confere a senha e a funcao login_admin, dentro do banco:
-- o hash nunca sai de la.
create table if not exists public.auth_users (
  email               text primary key,
  password            text default '',
  password_hash       text,
  password_changed_at timestamptz,
  name                text,
  created_at          timestamptz default now()
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
-- center tambem carrega o que a missao tem de extra e nao e coordenada:
--   material  - arquivos de apoio
--   turno     - 'manha' | 'tarde' | 'noite' (faixas em app_settings)
--   priority  - id de priority_levels
-- Fica no jsonb de proposito: missao nova funciona em banco que ja esta no ar,
-- sem depender de migracao.
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
  -- { lat, lng, assignedDeltas, semLocal, material, turno, priority }
  -- Ver a nota em panfletagem_areas.center: o extra da missao mora no jsonb.
  position          jsonb not null,
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
  "missionTitle"  text,

  -- Check-in em formato de conversa
  "operationTypeId"    text,
  "operationTypeLabel" text,
  accuracy             numeric,   -- precisao do GPS, em metros
  "memberId"           text,
  "memberPhoto"        text,

  -- Estrela do administrador: destaca o registro na lista e no mapa
  favorite             boolean default false,

  -- Na lixeira: sai das telas e do mapa, e da para restaurar
  trashed              boolean default false
);


-- ----------------------------------------------------------------------------
-- 8.1 check_in_media - fotos e videos do check-in
-- ----------------------------------------------------------------------------
-- storage_path = caminho dentro do bucket 'imagens'. E por ele que o arquivo e
-- apagado quando a midia sai do check-in; sem ele o arquivo ficaria orfao.
create table if not exists public.check_in_media (
  id            uuid primary key default gen_random_uuid(),
  check_in_id   text not null references public.check_ins (id) on delete cascade,
  kind          text not null check (kind in ('image', 'video')),
  url           text not null,
  storage_path  text,
  mime_type     text,
  size_bytes    bigint,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_check_in_media_checkin
  on public.check_in_media (check_in_id, position);


-- ----------------------------------------------------------------------------
-- 8.2 check_in_notes - observacoes digitadas e audios gravados
-- ----------------------------------------------------------------------------
create table if not exists public.check_in_notes (
  id               uuid primary key default gen_random_uuid(),
  check_in_id      text not null references public.check_ins (id) on delete cascade,
  kind             text not null check (kind in ('texto', 'audio')),
  content          text,
  url              text,
  storage_path     text,
  duration_seconds numeric,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  constraint check_in_notes_conteudo check (
    (kind = 'texto' and content is not null and length(btrim(content)) > 0)
    or (kind = 'audio' and url is not null)
  )
);

create index if not exists idx_check_in_notes_checkin
  on public.check_in_notes (check_in_id, position);


-- ----------------------------------------------------------------------------
-- 8.3 check_in_operations - um check-in pode ter varios tipos de operacao
-- ----------------------------------------------------------------------------
create table if not exists public.check_in_operations (
  id                   uuid primary key default gen_random_uuid(),
  check_in_id          text not null references public.check_ins (id) on delete cascade,
  operation_type_id    text not null,
  operation_type_label text,
  position             integer not null default 0,
  created_at           timestamptz not null default now(),
  unique (check_in_id, operation_type_id)
);

create index if not exists idx_check_in_operations_checkin
  on public.check_in_operations (check_in_id, position);
create index if not exists idx_check_in_operations_tipo
  on public.check_in_operations (operation_type_id);

-- ----------------------------------------------------------------------------
-- 8.4 member_devices - de que aparelho cada integrante se cadastrou
-- ----------------------------------------------------------------------------
-- Prende o acesso ao painel ao aparelho do cadastro. Guarda a ficha tecnica que
-- o navegador entrega e, de identificavel, so hashes: o do identificador do
-- cookie e o HMAC do IP publico (este ultimo so quando DEVICE_IP_HMAC_KEY esta
-- configurada no servidor).
create table if not exists public.member_devices (
  id                uuid primary key default gen_random_uuid(),
  member_id         text references public.time_delta (id) on delete cascade,
  candidate_id      text,
  whatsapp          text,
  device_id_hash    text,
  fingerprint       text,
  trusted           boolean not null default true,
  device_type       text,
  browser           text,
  os                text,
  platform          text,
  user_agent        text,
  screen_resolution text,
  timezone          text,
  language          text,
  languages         text[],
  touch_points      integer,
  ip_hash           text,
  origin            text not null default 'cadastro',
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now()
);

create index if not exists idx_member_devices_membro  on public.member_devices (member_id);
create index if not exists idx_member_devices_whats   on public.member_devices (whatsapp);
create index if not exists idx_member_devices_cliente on public.member_devices (candidate_id);
create index if not exists idx_member_devices_hash    on public.member_devices (device_id_hash);

create unique index if not exists idx_member_devices_unico
  on public.member_devices (member_id, device_id_hash)
  where member_id is not null and device_id_hash is not null;

-- ----------------------------------------------------------------------------
-- 8.5 app_settings - ajustes que o administrador muda em tela
-- ----------------------------------------------------------------------------
-- Chaves em uso:
--   redirect_sem_link  - para onde vai quem abre o dominio sem link
--   midia_galeria      - 'sim' libera a galeria do celular no check-in
--   metas_<clienteId>  - metas da equipe daquele cliente, em JSON:
--                        { cadencia, de, ate, padrao: {manha,tarde,noite},
--                          porPessoa: { <memberId>: {manha,tarde,noite} } }
--                        A meta padrao vale para quem nao tem meta propria.
--   turnos_missao      - JSON com as faixas de manha, tarde e noite:
--                        [{"id":"manha","inicio":"08:30","fim":"11:59"}, ...]
--                        O fim entra no turno, e fim menor que inicio quer
--                        dizer que a janela atravessa a meia-noite.
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8.6 priority_levels - niveis de prioridade criados pelo administrador
-- ----------------------------------------------------------------------------
-- O id e o valor gravado em check_ins.priority. Os quatro primeiros sao os que
-- o sistema usava fixos no codigo, para os registros antigos continuarem sendo
-- reconhecidos.
create table if not exists public.priority_levels (
  id          text primary key,
  label       text not null,
  description text,
  color       text not null default '#64748b',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_priority_levels_ordem on public.priority_levels (position);

insert into public.priority_levels (id, label, description, color, position) values
  ('baixa',   'Baixa',   'Pode ser resolvido sem pressa.',      '#10b981', 0),
  ('media',   'Média',   'Precisa entrar na fila de serviço.',  '#f59e0b', 1),
  ('alta',    'Alta',    'Atrapalha a rotina do bairro.',       '#f97316', 2),
  ('urgente', 'Urgente', 'Risco imediato à população.',         '#dc2626', 3)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 9. Migracoes - completa bancos que ja existiam antes
-- ----------------------------------------------------------------------------
-- Num banco novo nada aqui muda coisa alguma; num banco antigo, adiciona as
-- colunas que entraram depois.
alter table public.auth_users        add column if not exists name text;
alter table public.auth_users        add column if not exists password_hash text;
alter table public.auth_users        add column if not exists password_changed_at timestamptz;
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
alter table public.check_ins         add column if not exists "operationTypeId" text;
alter table public.check_ins         add column if not exists "operationTypeLabel" text;
alter table public.check_ins         add column if not exists accuracy numeric;
alter table public.check_ins         add column if not exists status text default 'confirmado';
alter table public.check_ins         add column if not exists "confirmedAt" timestamptz;
alter table public.check_ins         add column if not exists "updatedAt" timestamptz default now();
alter table public.check_ins         add column if not exists "memberId" text;
alter table public.check_ins         add column if not exists "memberPhoto" text;


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
-- 11.1 Login do painel, dentro do banco
-- ----------------------------------------------------------------------------
-- Quem confere a senha e o banco, nao o app: o hash nunca sai daqui. O
-- security definer deixa a funcao ler auth_users mesmo com a tabela fechada
-- para a chave anon (secao 15), e ela devolve so o que a tela precisa.
--
-- Sem estas duas funcoes ninguem entra no painel. O app chama login_admin, e a
-- outra porta -- a comparacao antiga em texto puro -- nao serve mais, porque a
-- coluna password nasce vazia: o login responderia "usuario ou senha
-- invalidos" para a senha certa. Por isso elas vem com o schema, e nao so na
-- migracao db/migrations/2026-09-19-senhas-em-hash.sql.
--
-- O search_path leva "extensions" junto de proposito. crypt() e gen_salt() vem
-- do pgcrypto, e o Supabase instala as extensoes no schema "extensions", nao no
-- "public". Com "set search_path = public" sozinho, a funcao nao enxerga
-- crypt() e morre com "function crypt(text, text) does not exist" -- so na hora
-- do login, porque os updates deste arquivo rodam com o search_path da sessao,
-- que ja inclui extensions, e passam sem reclamar. Num banco que guarde o
-- pgcrypto no public, o schema a mais no caminho nao atrapalha.
create or replace function public.login_admin(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  conta public.auth_users%rowtype;
begin
  select * into conta
    from public.auth_users
   where email = lower(btrim(p_email));

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  -- Conta que ficou sem hash (criada por fora, direto na tabela) ainda entra
  -- pelo texto puro, e a senha e convertida na hora -- assim ninguem fica
  -- trancado do lado de fora.
  if conta.password_hash is null then
    if coalesce(conta.password, '') <> '' and conta.password = p_password then
      update public.auth_users
         set password_hash = crypt(p_password, gen_salt('bf', 10)),
             password = '',
             password_changed_at = now()
       where auth_users.email = conta.email;
      return jsonb_build_object(
        'ok', true,
        'email', conta.email,
        'name', coalesce(conta.name, '')
      );
    end if;
    return jsonb_build_object('ok', false);
  end if;

  if conta.password_hash = crypt(p_password, conta.password_hash) then
    return jsonb_build_object(
      'ok', true,
      'email', conta.email,
      'name', coalesce(conta.name, '')
    );
  end if;

  return jsonb_build_object('ok', false);
end;
$$;

do $$
begin
  execute 'grant execute on function public.login_admin(text, text) to anon, authenticated';
exception when others then
  raise notice 'grant de login_admin nao aplicado (%).', sqlerrm;
end $$;

-- A senha nova entra so em hash. Para trocar a de uma conta que ja existe, a
-- senha atual e exigida; para criar a primeira, nao ha o que exigir.
create or replace function public.set_admin_password(
  p_email        text,
  p_new_password text,
  p_old_password text default null,
  p_name         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  conta   public.auth_users%rowtype;
  -- Nome diferente do da coluna de proposito: chamada de "email", a variavel
  -- sombrearia a coluna e o "where" viraria uma comparacao dela com ela mesma,
  -- que e sempre verdadeira -- qualquer conta serviria.
  v_email text := lower(btrim(p_email));
begin
  if length(coalesce(p_new_password, '')) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'senha_curta');
  end if;

  select * into conta from public.auth_users where auth_users.email = v_email;

  if not found then
    insert into public.auth_users (email, password, password_hash, name, password_changed_at)
    values (v_email, '', crypt(p_new_password, gen_salt('bf', 10)), coalesce(p_name, ''), now());
    return jsonb_build_object('ok', true, 'criado', true);
  end if;

  if conta.password_hash is not null then
    if p_old_password is null
       or conta.password_hash <> crypt(p_old_password, conta.password_hash) then
      return jsonb_build_object('ok', false, 'reason', 'senha_atual_incorreta');
    end if;
  elsif coalesce(conta.password, '') <> '' and conta.password <> coalesce(p_old_password, '') then
    return jsonb_build_object('ok', false, 'reason', 'senha_atual_incorreta');
  end if;

  update public.auth_users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         password = '',
         name = coalesce(p_name, name),
         password_changed_at = now()
   where auth_users.email = conta.email;

  return jsonb_build_object('ok', true, 'criado', false);
end;
$$;

do $$
begin
  execute 'grant execute on function public.set_admin_password(text, text, text, text) to anon, authenticated';
exception when others then
  raise notice 'grant de set_admin_password nao aplicado (%).', sqlerrm;
end $$;


-- ----------------------------------------------------------------------------
-- 12. Usuario inicial do painel
-- ----------------------------------------------------------------------------
-- A senha entra ja em hash. TROQUE depois do primeiro acesso:
--   select public.set_admin_password('admin@totalmapa.com', 'sua-senha-nova', 'troque-esta-senha');
insert into public.auth_users (email, password, password_hash, name, password_changed_at)
values (
  'admin@totalmapa.com',
  '',
  crypt('troque-esta-senha', gen_salt('bf', 10)),
  'Administrador',
  now()
)
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
    'candidates', 'parties', 'time_delta',
    'operation_types', 'panfletagem_areas', 'campaign_pins', 'check_ins',
    'check_in_media', 'check_in_notes', 'check_in_operations',
    'member_devices', 'app_settings', 'priority_levels'
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

-- auth_users nao entra na lista acima de proposito: com o login e a troca de
-- senha dentro do banco (secao 11.1), a chave anon nao precisa mais enxergar a
-- tabela -- nem o hash, nem quem sao as contas. Quem entra e a funcao.
do $$
begin
  execute 'alter table public.auth_users enable row level security';
  execute 'drop policy if exists "acesso_app" on public.auth_users';
exception when others then
  raise notice 'auth_users: policy nao alterada (%).', sqlerrm;
end $$;

do $$
begin
  execute 'revoke all on table public.auth_users from anon';
  execute 'revoke all on table public.auth_users from authenticated';
exception when others then
  raise notice 'auth_users: acesso nao revogado (%).', sqlerrm;
end $$;


-- ----------------------------------------------------------------------------
-- 16. Recarrega o cache do PostgREST
-- ----------------------------------------------------------------------------
-- A API do Supabase guarda em cache o desenho das tabelas. Sem este aviso, uma
-- coluna recem-criada so aparece para o app depois de alguns minutos - ate la
-- ele responde "Could not find the ... column ... in the schema cache".
notify pgrst, 'reload schema';


-- ----------------------------------------------------------------------------
-- 16. Delta Operacional - quem planeja as operacoes do cliente
-- ----------------------------------------------------------------------------
-- A pessoa do time do cliente que entra num painel proprio (link + telefone),
-- desenha um raio no mapa, escolhe os pontos dentro dele e monta a operacao.
-- O mesmo conteudo de db/migrations/2026-09-26-delta-operacional.sql, que e
-- o que se roda num banco que ja existia.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. operational_deltas - quem planeja as operacoes
-- ----------------------------------------------------------------------------
create table if not exists public.operational_deltas (
  id             text primary key default gen_random_uuid()::text,
  candidate_id   text not null,
  full_name      text not null,
  whatsapp       text not null,
  image          text,
  -- Credencial do link do painel. Duas uuids sem hifen: 64 caracteres.
  access_token   text not null default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  source         text not null default 'manual',   -- manual | qrcode
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_access_at timestamptz
);

create unique index if not exists idx_op_deltas_token
  on public.operational_deltas (access_token);
-- O mesmo telefone pode planejar para clientes diferentes: sao cadastros
-- distintos, como na equipe de campo.
create unique index if not exists idx_op_deltas_cliente_whatsapp
  on public.operational_deltas (candidate_id, whatsapp);
create index if not exists idx_op_deltas_cliente
  on public.operational_deltas (candidate_id);

-- ----------------------------------------------------------------------------
-- 2. operational_invites - o QR Code de uso unico do Delta Operacional
-- ----------------------------------------------------------------------------
-- Igual ao convite da equipe de campo, e separado dele de proposito: quem le
-- este QR vira alguem que cria operacoes, e nao pode ser o mesmo papel
-- escolhido por engano num menu.
create table if not exists public.operational_invites (
  id           text primary key default gen_random_uuid()::text,
  token        text not null unique,
  candidate_id text not null,
  note         text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  used_at      timestamptz,
  used_by      text,
  revoked_at   timestamptz
);

create index if not exists idx_op_invites_cliente on public.operational_invites (candidate_id);

-- ----------------------------------------------------------------------------
-- 3. operations - as operacoes planejadas
-- ----------------------------------------------------------------------------
-- center = { lat, lng } e radius em metros: o raio que o Delta desenhou.
-- targets = os pontos escolhidos dentro do raio, com uma copia do que eles
--   eram no momento da escolha: [{ id, tipo: 'pin'|'checkin', titulo, lat, lng }].
--   A copia e o que mantem a operacao legivel se o ponto for apagado depois.
-- action_plan = as etapas do plano: [{ id, texto, feita }].
create table if not exists public.operations (
  id              text primary key default gen_random_uuid()::text,
  candidate_id    text not null,
  created_by      text references public.operational_deltas (id) on delete set null,
  created_by_name text,
  title           text not null,
  objective       text,
  action_plan     jsonb not null default '[]'::jsonb,
  priority        text,            -- id em priority_levels
  turno           text,            -- manha | tarde | noite
  due_date        date,
  status          text not null default 'planejada',
  center          jsonb not null,
  radius          numeric not null,
  targets         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint operations_status_valido
    check (status in ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  constraint operations_raio_positivo check (radius > 0)
);

create index if not exists idx_operations_cliente on public.operations (candidate_id, created_at desc);
create index if not exists idx_operations_autor   on public.operations (created_by);

-- ----------------------------------------------------------------------------
-- 4. Leitura publica do convite (a pessoa abre o QR sem estar logada)
-- ----------------------------------------------------------------------------
create or replace function public.get_operational_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  convite public.operational_invites%rowtype;
  cliente public.candidates%rowtype;
begin
  select * into convite from public.operational_invites where token = p_token;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'nao_encontrado');
  end if;
  if convite.used_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'ja_utilizado');
  end if;
  if convite.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'cancelado');
  end if;
  if convite.expires_at is not null and convite.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expirado');
  end if;

  select * into cliente from public.candidates where id = convite.candidate_id;

  return jsonb_build_object(
    'valid', true,
    'candidateId', convite.candidate_id,
    'candidateName', coalesce(cliente.name, ''),
    'candidateImage', coalesce(cliente.image, '')
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Conclusao do cadastro pelo QR Code
-- ----------------------------------------------------------------------------
-- O convite e consumido e o Delta criado na mesma transacao; o update com
-- "used_at is null" garante o uso unico. Quem ja estava cadastrado com o
-- mesmo telefone neste cliente e atualizado e reativado, e recebe o link que
-- ja tinha -- o link nao muda so porque a pessoa leu um QR de novo.
--
-- Devolve o token do link: a pessoa sai do cadastro direto para o painel.
create or replace function public.claim_operational_invite(
  p_token    text,
  p_name     text,
  p_whatsapp text,
  p_image    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  convite  public.operational_invites%rowtype;
  telefone text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  delta    public.operational_deltas%rowtype;
begin
  if coalesce(btrim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'nome_obrigatorio');
  end if;
  if length(telefone) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'telefone_invalido');
  end if;

  update public.operational_invites
     set used_at = now()
   where token = p_token
     and used_at is null
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning * into convite;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'convite_invalido');
  end if;

  select * into delta
    from public.operational_deltas
   where candidate_id = convite.candidate_id and whatsapp = telefone;

  if found then
    update public.operational_deltas
       set full_name = btrim(p_name),
           image = coalesce(nullif(btrim(p_image), ''), image),
           active = true
     where id = delta.id
    returning * into delta;
    update public.operational_invites set used_by = delta.id where id = convite.id;
    return jsonb_build_object('ok', true, 'id', delta.id, 'token', delta.access_token, 'updated', true);
  end if;

  insert into public.operational_deltas (candidate_id, full_name, whatsapp, image, source)
  values (convite.candidate_id, btrim(p_name), telefone, nullif(btrim(p_image), ''), 'qrcode')
  returning * into delta;

  update public.operational_invites set used_by = delta.id where id = convite.id;
  return jsonb_build_object('ok', true, 'id', delta.id, 'token', delta.access_token, 'updated', false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Entrada no painel: o link E o telefone
-- ----------------------------------------------------------------------------
-- O telefone e comparado pelos digitos finais (pelo menos 8 em comum), para
-- "82 98888-7777" e "+55 82988887777" serem o mesmo numero -- a mesma regra
-- que a tela de check-in usa.
--
-- Os motivos da recusa sao distintos porque a tela diz coisas distintas:
-- link que nao existe mais (foi trocado) pede um link novo ao administrador;
-- acesso pausado e decisao dele; telefone errado e so digitar de novo.
create or replace function public.enter_operational_panel(p_token text, p_whatsapp text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  delta    public.operational_deltas%rowtype;
  cliente  public.candidates%rowtype;
  digitado text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  gravado  text;
begin
  select * into delta from public.operational_deltas where access_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'link_invalido');
  end if;

  select * into cliente from public.candidates where id = delta.candidate_id;

  if not delta.active then
    return jsonb_build_object(
      'ok', false,
      'reason', 'acesso_pausado',
      'client', jsonb_build_object('name', coalesce(cliente.name, ''), 'image', coalesce(cliente.image, ''))
    );
  end if;

  gravado := regexp_replace(coalesce(delta.whatsapp, ''), '\D', '', 'g');
  if length(digitado) < 8 or length(gravado) < 8
     or not (right(gravado, length(digitado)) = digitado or right(digitado, length(gravado)) = gravado) then
    return jsonb_build_object('ok', false, 'reason', 'telefone_nao_confere');
  end if;

  update public.operational_deltas set last_access_at = now() where id = delta.id;

  return jsonb_build_object(
    'ok', true,
    'delta', jsonb_build_object(
      'id', delta.id,
      'full_name', delta.full_name,
      'whatsapp', delta.whatsapp,
      'image', coalesce(delta.image, ''),
      'candidate_id', delta.candidate_id
    ),
    'client', jsonb_build_object(
      'id', delta.candidate_id,
      'name', coalesce(cliente.name, ''),
      'image', coalesce(cliente.image, ''),
      'city', coalesce(cliente.city, ''),
      'estado', coalesce(cliente.estado, '')
    )
  );
end;
$$;

-- A tela de entrada so conhece o token: ela precisa saber de quem e o painel
-- (o cliente) para desenhar a marca, sem saber quem e a pessoa.
create or replace function public.peek_operational_panel(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  delta   public.operational_deltas%rowtype;
  cliente public.candidates%rowtype;
begin
  select * into delta from public.operational_deltas where access_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'link_invalido');
  end if;
  select * into cliente from public.candidates where id = delta.candidate_id;
  return jsonb_build_object(
    'ok', true,
    'active', delta.active,
    'client', jsonb_build_object('name', coalesce(cliente.name, ''), 'image', coalesce(cliente.image, ''))
  );
end;
$$;

do $$
begin
  execute 'grant execute on function public.get_operational_invite(text) to anon, authenticated';
  execute 'grant execute on function public.claim_operational_invite(text, text, text, text) to anon, authenticated';
  execute 'grant execute on function public.enter_operational_panel(text, text) to anon, authenticated';
  execute 'grant execute on function public.peek_operational_panel(text) to anon, authenticated';
exception when others then
  raise notice 'grants do Delta Operacional nao aplicados (%).', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Acesso (RLS) - o mesmo regime das outras tabelas do app
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['operational_deltas', 'operational_invites', 'operations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "acesso_app" on public.%I', t);
    execute format(
      'create policy "acesso_app" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;



-- ============================================================================
-- Observacao de seguranca
--
-- A senha do painel nao fica mais legivel: auth_users guarda so o hash bcrypt,
-- a tabela esta fora da policy aberta da chave anon e a conferencia acontece
-- na funcao login_admin, com security definer. Rode tambem a migracao
-- db/migrations/2026-09-19-senhas-em-hash.sql num banco que ja existia: ela
-- converte as senhas antigas e apaga o texto puro.
--
-- O resto do sistema continua falando com o banco pela chave anon, que vai no
-- pacote do navegador: as demais tabelas sao legiveis por quem tiver essa
-- chave. Fechar isso de vez pede Supabase Auth ou leitura por funcao, tabela
-- por tabela.
-- ============================================================================
