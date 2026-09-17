-- ============================================================================
-- Clientes: colunas da ficha completa em candidates
--
-- Rode este arquivo se o app reclamar de coluna que nao existe ao vincular um
-- cliente ("Could not find the 'campanha' column of 'candidates'").
--
-- E o mesmo que ja esta no schema.sql: rodar os dois nao faz mal nenhum, cada
-- comando so age se a coluna ainda faltar.
-- ============================================================================

alter table public.candidates add column if not exists source text default 'manual';
alter table public.candidates add column if not exists external_id text;
alter table public.candidates add column if not exists email text;
alter table public.candidates add column if not exists campanha text;
alter table public.candidates add column if not exists numero_campanha text;
alter table public.candidates add column if not exists link_grupo_whatsapp text;
alter table public.candidates add column if not exists favorito boolean;
alter table public.candidates add column if not exists party_id text;
alter table public.candidates add column if not exists party_name text;
alter table public.candidates add column if not exists party_initials text;
alter table public.candidates add column if not exists party_logo_url text;
alter table public.candidates add column if not exists party_color text;
alter table public.candidates add column if not exists external_created_at text;
alter table public.candidates add column if not exists raw jsonb;
alter table public.candidates add column if not exists status_active boolean default true;
alter table public.candidates add column if not exists estado text;
alter table public.candidates add column if not exists created_at timestamptz default now();

-- O id do cliente pode vir da base de origem, entao precisa aceitar texto
-- livre. Num banco onde a coluna ja e uuid, o cast nao perde nada.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'candidates'
       and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.candidates alter column id drop default;
    alter table public.candidates alter column id type text using id::text;
    alter table public.candidates alter column id set default gen_random_uuid()::text;
  end if;
end $$;

create index if not exists idx_candidates_origem on public.candidates (source);
create unique index if not exists idx_candidates_external
  on public.candidates (external_id) where external_id is not null;

-- Sem isto o PostgREST continua servindo o desenho antigo da tabela e o app
-- segue dizendo que a coluna nao existe.
notify pgrst, 'reload schema';
