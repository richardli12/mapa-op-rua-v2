-- ============================================================================
-- Check-in em conversa: midias, observacoes e operacoes em tabelas proprias
--
-- O check-in deixa de guardar tudo dentro de uma coluna jsonb. Cada foto,
-- video, texto, audio e tipo de operacao passa a ser uma linha ligada ao
-- check-in, com o caminho do arquivo no Storage ao lado da URL publica -- e o
-- caminho que permite apagar o arquivo junto com a linha, sem deixar orfao.
--
-- O check-in nasce como rascunho e so vira 'confirmado' no fim do fluxo.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. check_ins - rascunho ate a confirmacao final
-- ----------------------------------------------------------------------------
alter table public.check_ins add column if not exists status text default 'confirmado';
alter table public.check_ins add column if not exists "confirmedAt" timestamptz;
alter table public.check_ins add column if not exists "updatedAt" timestamptz default now();

-- Registros antigos foram todos confirmados: nenhum deles e rascunho.
update public.check_ins set status = 'confirmado' where status is null;

create index if not exists idx_check_ins_status on public.check_ins (status);

-- ----------------------------------------------------------------------------
-- 2. check_in_media - fotos e videos, na ordem em que foram anexados
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
-- 3. check_in_notes - observacoes digitadas e audios gravados
-- ----------------------------------------------------------------------------
-- kind = 'texto'  -> o conteudo esta em content
-- kind = 'audio'  -> o conteudo esta em url/storage_path, com duracao em segundos
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

  -- Texto sem conteudo ou audio sem arquivo nao sao observacao nenhuma.
  constraint check_in_notes_conteudo check (
    (kind = 'texto' and content is not null and length(btrim(content)) > 0)
    or (kind = 'audio' and url is not null)
  )
);

create index if not exists idx_check_in_notes_checkin
  on public.check_in_notes (check_in_id, position);

-- ----------------------------------------------------------------------------
-- 4. check_in_operations - um check-in pode ter varios tipos de operacao
-- ----------------------------------------------------------------------------
-- O rotulo fica gravado junto: se o tipo for renomeado ou apagado no cadastro
-- do cliente, o check-in continua contando o que foi feito naquele dia.
create table if not exists public.check_in_operations (
  id                  uuid primary key default gen_random_uuid(),
  check_in_id         text not null references public.check_ins (id) on delete cascade,
  operation_type_id   text not null,
  operation_type_label text,
  position            integer not null default 0,
  created_at          timestamptz not null default now(),
  unique (check_in_id, operation_type_id)
);

create index if not exists idx_check_in_operations_checkin
  on public.check_in_operations (check_in_id, position);
create index if not exists idx_check_in_operations_tipo
  on public.check_in_operations (operation_type_id);

-- ----------------------------------------------------------------------------
-- 5. Acesso pelo aplicativo
-- ----------------------------------------------------------------------------
-- Mesma politica das demais tabelas do projeto: RLS ligado, com uma policy
-- liberando leitura e escrita para a chave anonima usada pelo aplicativo.
do $$
declare t text;
begin
  foreach t in array array['check_in_media', 'check_in_notes', 'check_in_operations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "acesso_app" on public.%I', t);
    execute format(
      'create policy "acesso_app" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
