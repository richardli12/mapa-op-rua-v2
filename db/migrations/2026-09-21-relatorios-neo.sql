-- ============================================================================
-- Relatorios do NEO
--
-- O relatorio custa uma chamada ao modelo, com imagens -- e ate um minuto de
-- espera. Sem lugar para guarda-lo, abrir de novo o mesmo documento significa
-- pagar e esperar de novo, e duas leituras da mesma missao podem sair
-- diferentes: quem mostrasse o relatorio numa reuniao veria um texto que nao e
-- o que leu antes.
--
-- Guardado, o documento e o mesmo para sempre. Uma linha por missao: gerar de
-- novo substitui o que estava la, de proposito -- historico de versoes de
-- relatorio e outra funcionalidade, e ninguem pediu duas.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create table if not exists public.mission_reports (
  mission_id text primary key,
  titulo     text,
  relatorio  jsonb not null,
  -- As pecas vao junto porque o relatorio cita imagens pelo rotulo: sem o
  -- mapa de rotulo para endereco, o documento reaberto perde as provas.
  pecas      jsonb not null default '[]'::jsonb,
  criado_em  timestamptz not null default now()
);

do $$
begin
  execute 'alter table public.mission_reports enable row level security';
  execute 'drop policy if exists "acesso_app" on public.mission_reports';
  execute 'create policy "acesso_app" on public.mission_reports for all to anon, authenticated using (true) with check (true)';
exception when others then
  raise notice 'mission_reports: policy nao aplicada (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';
