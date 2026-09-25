-- ============================================================================
-- Delta Operacional
--
-- O Delta Operacional e a pessoa do time do cliente que PLANEJA: ela entra
-- num painel proprio, desenha um raio no mapa, escolhe os pontos que estao
-- dentro dele e monta a operacao -- titulo, prioridade, turno, prazo e o
-- plano de acao em etapas.
--
-- Quem cria o Delta Operacional e o administrador, a mao (nome, telefone e
-- foto opcional) ou por um QR Code de uso unico que a propria pessoa le.
--
-- A ENTRADA NO PAINEL. Cada Delta Operacional tem um link proprio, com um
-- token longo e aleatorio (access_token). O link sozinho nao basta: o painel
-- pede o telefone cadastrado, e so entra quem acerta os dois. Gerar um link
-- novo troca o token -- o antigo para de funcionar na hora -- e pausar o
-- acesso (active = false) fecha a porta sem apagar ninguem.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

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

notify pgrst, 'reload schema';
