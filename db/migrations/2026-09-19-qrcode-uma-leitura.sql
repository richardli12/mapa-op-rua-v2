-- ============================================================================
-- QR Code de uma leitura so
--
-- Ate aqui o convite so era consumido no fim do cadastro: qualquer pessoa que
-- lesse o mesmo QR abria a tela e podia se cadastrar antes da outra. Agora o
-- primeiro aparelho que abre o link prende o convite para si -- outro aparelho
-- recebe "ja utilizado" e nao ve tela nenhuma.
--
-- O aparelho e reconhecido pelo mesmo identificador do check-in, que chega
-- aqui so em hash. Recarregar a pagina, ou voltar nela, continua funcionando
-- para quem abriu.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

alter table public.team_invites add column if not exists opened_by text;
alter table public.team_invites add column if not exists opened_at timestamptz;

create index if not exists idx_team_invites_aberto on public.team_invites (opened_by);

-- ----------------------------------------------------------------------------
-- Abre o convite prendendo-o ao aparelho que chegou primeiro
-- ----------------------------------------------------------------------------
-- O update com "opened_by is null or opened_by = p_device" e o que garante a
-- leitura unica: e uma instrucao so, entao dois aparelhos lendo o mesmo QR no
-- mesmo instante disputam a mesma linha e so um grava. O segundo nao encontra
-- linha para atualizar e leva a recusa.
create or replace function public.open_team_invite(p_token text, p_device text)
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

  -- Sem aparelho identificado nao ha como prender o convite a ninguem; melhor
  -- recusar do que deixar o QR aberto para qualquer um.
  if coalesce(btrim(p_device), '') = '' then
    return jsonb_build_object('valid', false, 'reason', 'convite_invalido');
  end if;

  update public.team_invites
     set opened_by = p_device,
         opened_at = coalesce(opened_at, now())
   where id = convite.id
     and (opened_by is null or opened_by = p_device)
  returning * into convite;

  if not found then
    -- Outro aparelho chegou antes.
    return jsonb_build_object('valid', false, 'reason', 'ja_utilizado');
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
    'fields', campos,
    'expiresAt', convite.expires_at,
    'serverNow', now()
  );
end;
$$;

grant execute on function public.open_team_invite(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Conclusao do cadastro: so o aparelho que abriu pode concluir
-- ----------------------------------------------------------------------------
create or replace function public.claim_team_invite_device(
  p_token    text,
  p_name     text,
  p_whatsapp text,
  p_image    text,
  p_extra    jsonb,
  p_device   text
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
     and (opened_by is null or opened_by = p_device)
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

grant execute on function public.claim_team_invite_device(text, text, text, text, jsonb, text) to anon, authenticated;

notify pgrst, 'reload schema';
