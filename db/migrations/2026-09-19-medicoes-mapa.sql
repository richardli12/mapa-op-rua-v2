-- ============================================================================
-- Medicoes da regua do mapa
--
-- A regua deixa de ser um rascunho que some ao fechar a tela: cada medicao
-- tem nome, cor e os pontos marcados, pertence a um cliente e fica guardada
-- para a equipe inteira ver.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create table if not exists public.map_measurements (
  id            text primary key,
  candidate_id  text,
  name          text not null,
  color         text not null default '#F58220',
  points        jsonb not null,          -- [{ lat, lng }, ...] na ordem marcada
  total_meters  numeric not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_map_measurements_cliente
  on public.map_measurements (candidate_id, created_at);

do $$
begin
  execute 'alter table public.map_measurements enable row level security';
  execute 'drop policy if exists "acesso_app" on public.map_measurements';
  execute 'create policy "acesso_app" on public.map_measurements for all to anon, authenticated using (true) with check (true)';
exception when others then
  raise notice 'map_measurements: policy nao aplicada (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';
