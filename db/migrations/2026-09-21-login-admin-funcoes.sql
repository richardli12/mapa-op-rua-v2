-- ============================================================================
-- Login do painel: as funcoes que conferem a senha
--
-- Sintoma que este arquivo resolve: a tela de login recusa a senha certa, e o
-- app diz "O banco de dados precisa ser atualizado para conferir a senha".
--
-- O app confere a senha chamando login_admin dentro do banco. A funcao nasceu
-- na migracao 2026-09-19-senhas-em-hash.sql, mas o schema.sql nao a criava --
-- entao um banco montado so pelo schema, ou que nunca recebeu aquela migracao,
-- fica sem ela. Sem a funcao o app cai na comparacao antiga, em texto puro, e
-- essa porta nao existe mais: a coluna password fica vazia desde o hash, e
-- nenhuma senha casa com ela.
--
-- Este arquivo cria as duas funcoes e nada mais. Nao apaga conta, nao troca
-- senha e pode ser rodado mais de uma vez.
--
-- COMO USAR: SQL Editor -> New query -> cole tudo -> Run. Depois tente entrar
-- com a sua senha de sempre. Se a conta ainda estiver em texto puro, a propria
-- login_admin aceita a senha antiga e a converte em hash na hora -- ninguem
-- precisa cadastrar senha de novo.
--
-- O search_path leva "extensions" junto de proposito. crypt() e gen_salt() vem
-- do pgcrypto, e o Supabase instala as extensoes no schema "extensions", nao no
-- "public". Com "set search_path = public" sozinho, a funcao nao enxerga
-- crypt() e morre com "function crypt(text, text) does not exist" -- so na hora
-- do login, porque os updates deste arquivo rodam com o search_path da sessao,
-- que ja inclui extensions, e passam sem reclamar. Num banco que guarde o
-- pgcrypto no public, o schema a mais no caminho nao atrapalha.
-- ============================================================================

create extension if not exists pgcrypto;

-- As colunas do hash, para o caso de o banco nunca ter recebido a migracao.
alter table public.auth_users add column if not exists password_hash text;
alter table public.auth_users add column if not exists password_changed_at timestamptz;
alter table public.auth_users alter column password drop not null;

create or replace function public.login_admin(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  conta public.auth_users%rowtype;
begin
  select * into conta
    from public.auth_users
   where email = lower(btrim(p_email));

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  -- Conta que ficou sem hash (criada por fora, direto na tabela) ainda entra
  -- pelo texto puro, e a senha e convertida na hora -- assim ninguem fica
  -- trancado do lado de fora.
  if conta.password_hash is null then
    if coalesce(conta.password, '') <> '' and conta.password = p_password then
      update public.auth_users
         set password_hash = crypt(p_password, gen_salt('bf', 10)),
             password = '',
             password_changed_at = now()
       where auth_users.email = conta.email;
      return jsonb_build_object(
        'ok', true,
        'email', conta.email,
        'name', coalesce(conta.name, '')
      );
    end if;
    return jsonb_build_object('ok', false);
  end if;

  if conta.password_hash = crypt(p_password, conta.password_hash) then
    return jsonb_build_object(
      'ok', true,
      'email', conta.email,
      'name', coalesce(conta.name, '')
    );
  end if;

  return jsonb_build_object('ok', false);
end;
$$;

do $$
begin
  execute 'grant execute on function public.login_admin(text, text) to anon, authenticated';
exception when others then
  raise notice 'grant de login_admin nao aplicado (%).', sqlerrm;
end $$;

-- A senha nova entra so em hash. Para trocar a de uma conta que ja existe, a
-- senha atual e exigida; para criar a primeira, nao ha o que exigir.
create or replace function public.set_admin_password(
  p_email        text,
  p_new_password text,
  p_old_password text default null,
  p_name         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  conta   public.auth_users%rowtype;
  -- Nome diferente do da coluna de proposito: chamada de "email", a variavel
  -- sombrearia a coluna e o "where" viraria uma comparacao dela com ela mesma,
  -- que e sempre verdadeira -- qualquer conta serviria.
  v_email text := lower(btrim(p_email));
begin
  if length(coalesce(p_new_password, '')) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'senha_curta');
  end if;

  select * into conta from public.auth_users where auth_users.email = v_email;

  if not found then
    insert into public.auth_users (email, password, password_hash, name, password_changed_at)
    values (v_email, '', crypt(p_new_password, gen_salt('bf', 10)), coalesce(p_name, ''), now());
    return jsonb_build_object('ok', true, 'criado', true);
  end if;

  if conta.password_hash is not null then
    if p_old_password is null
       or conta.password_hash <> crypt(p_old_password, conta.password_hash) then
      return jsonb_build_object('ok', false, 'reason', 'senha_atual_incorreta');
    end if;
  elsif coalesce(conta.password, '') <> '' and conta.password <> coalesce(p_old_password, '') then
    return jsonb_build_object('ok', false, 'reason', 'senha_atual_incorreta');
  end if;

  update public.auth_users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         password = '',
         name = coalesce(p_name, name),
         password_changed_at = now()
   where auth_users.email = conta.email;

  return jsonb_build_object('ok', true, 'criado', false);
end;
$$;

do $$
begin
  execute 'grant execute on function public.set_admin_password(text, text, text, text) to anon, authenticated';
exception when others then
  raise notice 'grant de set_admin_password nao aplicado (%).', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- Recarrega o cache do PostgREST
-- ----------------------------------------------------------------------------
-- Sem este aviso a API do banco ainda nao enxerga as funcoes recem-criadas, e
-- o app continua recebendo o mesmo erro por alguns minutos.
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- Se mesmo assim a senha for recusada
-- ----------------------------------------------------------------------------
-- 1. Confira se a conta existe com o e-mail em minusculas -- e assim que o
--    login procura:
--
--      select email, password_hash is not null as tem_hash from public.auth_users;
--      update public.auth_users set email = lower(btrim(email))
--       where email <> lower(btrim(email));
--
-- 2. Para definir uma senha nova sem saber a atual (so daqui do SQL Editor,
--    que nao passa pela conferencia):
--
--      update public.auth_users
--         set password_hash = crypt('SuaSenhaNova123', gen_salt('bf', 10)),
--             password = '',
--             password_changed_at = now()
--       where email = lower(btrim('seu@email.com'));
