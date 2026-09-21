-- ============================================================================
-- Senhas do painel em hash
--
-- Ate aqui auth_users guardava a senha em texto puro e o login comparava
-- "email = ? and password = ?" direto da tabela -- com a chave anonima, que vai
-- no pacote do navegador. Na pratica, qualquer pessoa com o endereco do app
-- conseguia ler as senhas do painel.
--
-- Agora a senha vira hash bcrypt (pgcrypto), o texto puro e apagado da tabela e
-- a conferencia acontece dentro do banco, numa funcao: o hash nunca sai de la,
-- e a comparacao e feita com crypt(), que refaz o hash com o mesmo sal.
--
-- As senhas que ja existem sao convertidas por este mesmo arquivo -- ninguem
-- precisa cadastrar senha de novo.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga conta nenhuma.
-- ============================================================================

create extension if not exists pgcrypto;

alter table public.auth_users add column if not exists password_hash text;
alter table public.auth_users add column if not exists password_changed_at timestamptz;

-- ----------------------------------------------------------------------------
-- 1. Converte as senhas que ja estao la
-- ----------------------------------------------------------------------------
-- So as que ainda nao tem hash. Rodar de novo nao mexe em nada.
update public.auth_users
   set password_hash = crypt(password, gen_salt('bf', 10)),
       password_changed_at = coalesce(password_changed_at, now())
 where password_hash is null
   and password is not null
   and btrim(password) <> '';

-- ----------------------------------------------------------------------------
-- 2. Apaga o texto puro
-- ----------------------------------------------------------------------------
-- A coluna continua existindo para nao quebrar um app antigo que ainda a leia,
-- mas vazia: nao ha mais senha legivel na tabela.
update public.auth_users set password = '' where password_hash is not null;

alter table public.auth_users alter column password drop not null;
alter table public.auth_users alter column password set default '';

-- ----------------------------------------------------------------------------
-- 3. Login dentro do banco
-- ----------------------------------------------------------------------------
-- security definer: a funcao le a tabela mesmo quando quem chama nao pode. Ela
-- devolve so o que a tela precisa -- nunca o hash.
--
-- O search_path leva "extensions" junto de proposito. crypt() e gen_salt() vem
-- do pgcrypto, e o Supabase instala as extensoes no schema "extensions", nao no
-- "public". Com "set search_path = public" sozinho, a funcao nao enxerga
-- crypt() e morre com "function crypt(text, text) does not exist" -- so na hora
-- do login, porque os updates deste arquivo rodam com o search_path da sessao,
-- que ja inclui extensions, e passam sem reclamar. Num banco que guarde o
-- pgcrypto no public, o schema a mais no caminho nao atrapalha.
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

  -- Conta que ficou sem hash (criada por fora) ainda pode entrar pelo texto
  -- puro, e a senha e convertida na hora -- assim ninguem fica trancado.
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

-- ----------------------------------------------------------------------------
-- 4. Trocar ou cadastrar senha
-- ----------------------------------------------------------------------------
-- A senha nova entra so em hash. Para trocar a de uma conta que ja existe, a
-- senha atual e exigida; para criar a primeira conta, nao ha o que exigir.
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
-- 5. Fecha a tabela
-- ----------------------------------------------------------------------------
-- Com o login e a troca de senha dentro do banco, a chave anonima nao precisa
-- mais enxergar auth_users. A policy aberta cai; quem entra e a funcao.
do $$
begin
  execute 'alter table public.auth_users enable row level security';
  execute 'drop policy if exists "acesso_app" on public.auth_users';
exception when others then
  raise notice 'auth_users: policy nao alterada (%).', sqlerrm;
end $$;

do $$
begin
  execute 'revoke all on table public.auth_users from anon';
  execute 'revoke all on table public.auth_users from authenticated';
exception when others then
  raise notice 'auth_users: acesso nao revogado (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';
