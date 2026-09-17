-- ============================================================================
-- Niveis de prioridade criados pelo administrador
--
-- Ate aqui os niveis eram quatro, fixos no codigo (baixa, media, alta,
-- urgente). Agora quem cria a lista e o administrador, em Configuracoes, e os
-- check-ins passam a guardar o id do nivel escolhido.
--
-- Os quatro antigos entram como primeira carga, com os mesmos valores que o
-- codigo usava -- assim os check-ins ja gravados continuam sendo reconhecidos.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create table if not exists public.priority_levels (
  id          text primary key,
  label       text not null,
  description text,
  color       text not null default '#64748b',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_priority_levels_ordem on public.priority_levels (position);

-- Primeira carga: os niveis que o sistema usava fixos no codigo. O id e o
-- mesmo valor gravado nos check-ins antigos, entao nada deixa de ser lido.
insert into public.priority_levels (id, label, description, color, position) values
  ('baixa',   'Baixa',   'Pode ser resolvido sem pressa.',      '#10b981', 0),
  ('media',   'Média',   'Precisa entrar na fila de serviço.',  '#f59e0b', 1),
  ('alta',    'Alta',    'Atrapalha a rotina do bairro.',       '#f97316', 2),
  ('urgente', 'Urgente', 'Risco imediato à população.',         '#dc2626', 3)
on conflict (id) do nothing;

do $$
begin
  execute 'alter table public.priority_levels enable row level security';
  execute 'drop policy if exists "acesso_app" on public.priority_levels';
  execute 'create policy "acesso_app" on public.priority_levels for all to anon, authenticated using (true) with check (true)';
exception when others then
  raise notice 'priority_levels: policy nao aplicada (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';
