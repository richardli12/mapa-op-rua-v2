# Banco de dados

`schema.sql` cria o banco inteiro do sistema, do login ao check-in em campo.

## Como aplicar num banco novo

1. Painel do banco de dados → **SQL Editor** → **New query**.
2. Cole o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.
3. Troque a senha do usuário inicial:
   ```sql
   select public.set_admin_password(
     'admin@totalmapa.com',   -- conta
     'a-sua-senha',           -- senha nova (mínimo 8 caracteres)
     'troque-esta-senha'      -- senha atual, a que o schema criou
   );
   ```
   A resposta vem como `{"ok": true, ...}`. Não troque a senha com um
   `update ... set password = '...'`: a senha fica em hash na coluna
   `password_hash`, e o login não olha mais a coluna `password` — a conta
   continuaria com a senha antiga, e a nova daria "usuário ou senha
   inválidos".
4. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (nomes mantidos por compatibilidade) no `.env` (ou nas
   Environment Variables da Vercel) com a URL e a chave pública do projeto.

O script pode ser executado mais de uma vez sem problema: ele só cria o que
ainda não existe e nunca apaga dados.

Este arquivo é a única cópia do script: ele saiu da tela de Configurações do
app de propósito, porque o pacote que vai para o navegador é público e o script
cita o fornecedor de banco em cada comentário.

## O que o script cria

| Tabela | Para quê |
| --- | --- |
| `auth_users` | Login do painel administrativo |
| `candidates` | Clientes do sistema (cadastro manual ou vinculado de base externa) |
| `parties` | Partidos (usados nos rótulos dos clientes) |
| `time_delta` | Equipe em campo, identificada pelo WhatsApp |
| `operation_types` | Tipos de Operação dos pontos, cadastrados pelo usuário |
| `panfletagem_areas` | Áreas de panfletagem (círculos no mapa) |
| `campaign_pins` | Pontos estratégicos (pinos no mapa) |
| `check_ins` | Registros de campo: missão e livre, com fotos e vídeos |
| `escolas` | Escolas do município, camada de contexto do mapa |
| `ubs` | Unidades Básicas de Saúde, camada de contexto do mapa |

Além das tabelas: o bucket `imagens` de arquivos (fotos e vídeos do check-in),
o Realtime das tabelas do mapa e as políticas de acesso da chave `anon`.

## Login do painel

A senha do painel fica só em hash bcrypt, em `auth_users.password_hash`, e a
tabela está fora da policy aberta da chave `anon`. Quem confere a senha é a
função `login_admin`, dentro do banco: o hash nunca sai de lá. Para cadastrar
ou trocar uma senha, use `set_admin_password` (exemplo no passo 3 acima).

Num banco que já existia antes disso, rode também
[`migrations/2026-09-19-senhas-em-hash.sql`](./migrations/2026-09-19-senhas-em-hash.sql):
ela converte as senhas antigas e apaga o texto puro.

### Ninguém entra: "usuário ou senha inválidos" com a senha certa

Quase sempre é uma destas duas:

- **A senha foi trocada por `update ... set password = '...'`.** Não vale mais:
  o login lê `password_hash`. Refaça com `set_admin_password`.
- **As funções não estão no banco** (schema antigo, aplicado antes delas). A
  tela diz *"O banco de dados precisa ser atualizado para conferir a senha"*.
  Rode
  [`migrations/2026-09-21-login-admin-funcoes.sql`](./migrations/2026-09-21-login-admin-funcoes.sql):
  ele cria só as duas funções, sem tocar em conta nem em senha. Depois entre
  com a senha de sempre — uma conta que ainda estivesse em texto puro é aceita
  e convertida em hash na hora. Rodar o `schema.sql` inteiro de novo também
  resolve.

Para conferir o que o banco tem:

```sql
select email,
       password_hash is not null as tem_hash,
       password_changed_at
  from public.auth_users;

select proname from pg_proc
 where proname in ('login_admin', 'set_admin_password');
```

E, se o e-mail tiver sido gravado com maiúsculas, o login não acha a conta —
ele procura sempre em minúsculas:

```sql
update public.auth_users set email = lower(btrim(email)) where email <> lower(btrim(email));
```

## Segurança

Fora `auth_users`, o resto do sistema fala com o banco pela chave `anon`, que
vai no pacote do navegador: as demais tabelas são legíveis por quem tiver essa
chave. Fechar isso de vez pede o serviço de autenticação do banco ou leitura
por função, tabela por tabela.
