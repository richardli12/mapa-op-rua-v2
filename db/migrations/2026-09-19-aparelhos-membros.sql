-- ============================================================================
-- Aparelhos dos integrantes
--
-- Guarda de que aparelho cada integrante se cadastrou pelo QR Code e prende o
-- acesso ao painel a esse aparelho: digitar o numero certo em outro celular
-- nao abre o painel de ninguem.
--
-- O que e guardado e o que o navegador entrega sobre o proprio aparelho --
-- tipo, navegador, sistema, tela, fuso, idiomas -- mais dois valores que nao
-- identificam sozinhos: o hash do identificador aleatorio guardado no cookie
-- (o valor cru nunca chega ao banco) e o HMAC do IP publico, gravado so quando
-- DEVICE_IP_HMAC_KEY esta configurada no servidor.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.member_devices (
  id                uuid primary key default gen_random_uuid(),
  member_id         text references public.time_delta (id) on delete cascade,
  candidate_id      text,
  whatsapp          text,

  -- Vinculo do aparelho
  device_id_hash    text,        -- hash do identificador aleatorio do cookie
  fingerprint       text,        -- impressao dos sinais estaveis do aparelho
  trusted           boolean not null default true,

  -- Ficha tecnica entregue pelo navegador
  device_type       text,        -- 'celular' | 'tablet' | 'computador'
  browser           text,
  os                text,
  platform          text,
  user_agent        text,
  screen_resolution text,
  timezone          text,
  language          text,
  languages         text[],
  touch_points      integer,

  -- Rede: nunca o IP em si
  ip_hash           text,

  origin            text not null default 'cadastro',  -- 'cadastro' | 'login'
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now()
);

create index if not exists idx_member_devices_membro  on public.member_devices (member_id);
create index if not exists idx_member_devices_whats   on public.member_devices (whatsapp);
create index if not exists idx_member_devices_cliente on public.member_devices (candidate_id);
create index if not exists idx_member_devices_hash    on public.member_devices (device_id_hash);

-- Um aparelho aparece uma vez por integrante.
create unique index if not exists idx_member_devices_unico
  on public.member_devices (member_id, device_id_hash)
  where member_id is not null and device_id_hash is not null;

-- Mesma politica das demais tabelas do projeto: RLS ligado, com uma policy
-- liberando a chave anonima usada pelo aplicativo.
--
-- ATENCAO: isto NAO esconde a tabela de quem tiver a chave anonima, que vai no
-- pacote do navegador. "So o administrador ve" vale na interface: nenhuma tela
-- de integrante mostra estes dados. Esconder de verdade pede Supabase Auth ou
-- ler esta tabela por uma funcao no servidor, com a chave de servico.
do $$
begin
  execute 'alter table public.member_devices enable row level security';
  execute 'drop policy if exists "acesso_app" on public.member_devices';
  execute 'create policy "acesso_app" on public.member_devices for all to anon, authenticated using (true) with check (true)';
end $$;

notify pgrst, 'reload schema';
