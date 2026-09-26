-- ============================================================================
-- Categorias de favoritos: a estrela ganha gavetas
--
-- A estrela diz "isto importa", mas não diz PARA QUÊ. Numa operação de verdade
-- o que importa se divide: a foto que vai para a reunião, o buraco que virou
-- pauta, o que a imprensa pediu, o que precisa de retorno à comunidade. As
-- categorias são essas gavetas, criadas pelo próprio comitê, por cliente, com
-- nome, cor e um emoji — e um check-in pode estar em quantas precisar.
--
-- Regra: estar numa categoria é estar favoritado. Tirar a estrela esvazia as
-- categorias do check-in (a regra mora no sistema e numa constraint aqui).
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create table if not exists public.favorite_categories (
  id           text primary key default gen_random_uuid()::text,
  candidate_id text,
  nome         text not null,
  cor          text not null default '#F59E0B',
  emoji        text,
  posicao      integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_favorite_categories_cliente
  on public.favorite_categories (candidate_id, posicao);

alter table public.check_ins
  add column if not exists favorite_categories text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_categoria_e_favorito'
  ) then
    alter table public.check_ins
      add constraint check_ins_categoria_e_favorito
      check (coalesce(cardinality(favorite_categories), 0) = 0 or coalesce(favorite, false));
  end if;
end $$;

-- "Quais check-ins estão nesta categoria?" é a pergunta do filtro.
create index if not exists idx_check_ins_categorias
  on public.check_ins using gin (favorite_categories);

do $$
begin
  execute 'alter table public.favorite_categories enable row level security';
  execute 'drop policy if exists "acesso_app" on public.favorite_categories';
  execute 'create policy "acesso_app" on public.favorite_categories for all to anon, authenticated using (true) with check (true)';
end $$;

notify pgrst, 'reload schema';
