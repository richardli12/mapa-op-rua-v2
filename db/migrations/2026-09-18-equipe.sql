-- ============================================================================
-- Equipe por cliente: campos de coleta, convite de QR Code e cadastro
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. time_delta - integrantes da equipe
-- ----------------------------------------------------------------------------
alter table public.time_delta add column if not exists extra_fields jsonb;
alter table public.time_delta add column if not exists source text default 'manual';
alter table public.time_delta add column if not exists created_at timestamptz default now();

-- O mesmo telefone pode pertencer a equipes de clientes diferentes: sao
-- cadastros distintos. Por isso a unicidade passa a ser por cliente, e nao
-- global. O indice antigo, global, e derrubado junto.
do $$
declare nome text;
begin
  for nome in
    select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
     where t.relname = 'time_delta'
       and c.contype = 'u'
       and (select count(*) from unnest(c.conkey)) = 1
  loop
    execute format('alter table public.time_delta drop constraint %I', nome);
  end loop;
end $$;

drop index if exists time_delta_whatsapp_key;

create unique index if not exists idx_time_delta_cliente_whatsapp
  on public.time_delta (candidate_id, whatsapp);

create index if not exists idx_time_delta_origem on public.time_delta (source);

-- ----------------------------------------------------------------------------
-- 2. team_field_defs - campos de coleta que o ADM configura por cliente
-- ----------------------------------------------------------------------------
create table if not exists public.team_field_defs (
  id           text primary key default gen_random_uuid()::text,
  candidate_id text not null,
  label        text not null,
  type         text not null default 'text',  -- text | number | date | email | select
  options      jsonb,                         -- alternativas, quando type = 'select'
  required     boolean default false,
  position     integer default 0,
  created_at   timestamptz default now()
);

create index if not exists idx_team_fields_cliente
  on public.team_field_defs (candidate_id, position);

-- ----------------------------------------------------------------------------
-- 3. team_invites - o QR Code de uso unico
-- ----------------------------------------------------------------------------
-- Um convite vale para um cliente e para uma pessoa so: assim que alguem
-- conclui o cadastro, used_at e preenchido e o mesmo QR nao serve mais.
create table if not exists public.team_invites (
  id           text primary key default gen_random_uuid()::text,
  token        text not null unique,
  candidate_id text not null,
  note         text,                    -- lembrete de para quem o QR foi gerado
  created_at   timestamptz default now(),
  expires_at   timestamptz,
  used_at      timestamptz,
  used_by      text,                    -- id do integrante criado
  revoked_at   timestamptz
);

create index if not exists idx_team_invites_cliente on public.team_invites (candidate_id);
create index if not exists idx_team_invites_token on public.team_invites (token);

-- ----------------------------------------------------------------------------
-- 4. Leitura publica do convite (a pessoa abre o link sem estar logada)
-- ----------------------------------------------------------------------------
-- Devolve so o necessario para montar a tela: se o convite vale, de qual
-- cliente ele e e quais campos aquele cliente pede. Nada mais da tabela vaza.
create or replace function public.get_team_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  convite public.team_invites%rowtype;
  cliente public.candidates%rowtype;
  campos  jsonb;
begin
  select * into convite from public.team_invites where token = p_token;

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

  select coalesce(
           jsonb_agg(to_jsonb(f) order by f.position, f.created_at),
           '[]'::jsonb
         )
    into campos
    from public.team_field_defs f
   where f.candidate_id = convite.candidate_id;

  return jsonb_build_object(
    'valid', true,
    'candidateId', convite.candidate_id,
    'candidateName', coalesce(cliente.name, ''),
    'candidateImage', coalesce(cliente.image, ''),
    'fields', campos
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Conclusao do cadastro pelo QR Code
-- ----------------------------------------------------------------------------
-- O convite e consumido e o integrante criado na mesma transacao. O update
-- com "used_at is null" e o que garante o uso unico: duas pessoas lendo o
-- mesmo QR ao mesmo tempo, so a primeira grava - a segunda nao encontra linha
-- para atualizar e recebe a recusa.
create or replace function public.claim_team_invite(
  p_token    text,
  p_name     text,
  p_whatsapp text,
  p_image    text,
  p_extra    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  convite   public.team_invites%rowtype;
  telefone  text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  novo_id   text := gen_random_uuid()::text;
  existente text;
begin
  if coalesce(btrim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'nome_obrigatorio');
  end if;
  if length(telefone) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'telefone_invalido');
  end if;
  if coalesce(btrim(p_image), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'foto_obrigatoria');
  end if;

  update public.team_invites
     set used_at = now(), used_by = novo_id
   where token = p_token
     and used_at is null
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning * into convite;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'convite_invalido');
  end if;

  select id into existente
    from public.time_delta
   where candidate_id = convite.candidate_id and whatsapp = telefone;

  if existente is not null then
    update public.time_delta
       set full_name = p_name,
           image = p_image,
           extra_fields = p_extra,
           source = 'qrcode'
     where id = existente;

    update public.team_invites set used_by = existente where id = convite.id;
    return jsonb_build_object('ok', true, 'id', existente, 'updated', true);
  end if;

  insert into public.time_delta
    (id, full_name, whatsapp, candidate_id, image, extra_fields, source)
  values
    (novo_id, p_name, telefone, convite.candidate_id, p_image, p_extra, 'qrcode');

  return jsonb_build_object('ok', true, 'id', novo_id, 'updated', false);
end;
$$;

grant execute on function public.get_team_invite(text) to anon, authenticated;
grant execute on function public.claim_team_invite(text, text, text, text, jsonb) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Acesso
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['team_field_defs', 'team_invites']
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
