-- ============================================================================
-- Configuracoes do sistema
--
-- Guarda ajustes que o administrador muda em tela e valem para todo mundo --
-- hoje, o endereco para onde vai quem abre os dominios de acesso sem link.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

do $$
begin
  execute 'alter table public.app_settings enable row level security';
  execute 'drop policy if exists "acesso_app" on public.app_settings';
  execute 'create policy "acesso_app" on public.app_settings for all to anon, authenticated using (true) with check (true)';
end $$;

notify pgrst, 'reload schema';
