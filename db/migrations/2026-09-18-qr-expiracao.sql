-- ============================================================================
-- QR Code: prazo de validade escolhido pelo ADM e expiracao em tempo real
-- Rode depois de 2026-09-18-equipe.sql. Idempotente.
-- ============================================================================

-- O convite ja tem expires_at; aqui a leitura passa a devolver esse prazo,
-- para a pagina aberta saber a hora exata em que precisa se encerrar.
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
  if convite.expires_at is not null and convite.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expirado');
  end if;

  select * into cliente from public.candidates where id = convite.candidate_id;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.position, f.created_at), '[]'::jsonb)
    into campos
    from public.team_field_defs f
   where f.candidate_id = convite.candidate_id;

  return jsonb_build_object(
    'valid', true,
    'candidateId', convite.candidate_id,
    'candidateName', coalesce(cliente.name, ''),
    'candidateImage', coalesce(cliente.image, ''),
    'expiresAt', convite.expires_at,
    'serverNow', now(),
    'fields', campos
  );
end;
$$;

-- O prazo tambem vale na hora de gravar: a contagem na tela e conforto, a
-- recusa de verdade acontece aqui.
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
       set full_name = p_name, image = p_image, extra_fields = p_extra, source = 'qrcode'
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

-- Realtime: sem isto a pagina aberta so descobre o cancelamento ao recarregar.
do $$
begin
  alter publication supabase_realtime add table public.team_invites;
exception when others then
  raise notice 'Realtime ja ativo para team_invites';
end $$;

create index if not exists idx_team_invites_expira on public.team_invites (expires_at);

notify pgrst, 'reload schema';
