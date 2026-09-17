# Banco de dados

`schema.sql` cria o banco inteiro do sistema, do login ao check-in em campo.

## Como aplicar num banco novo

1. Painel do Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.
3. Troque a senha do usuário inicial:
   ```sql
   update public.auth_users
      set password = 'a-sua-senha'
    where email = 'admin@totalmapa.com';
   ```
4. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` (ou nas
   Environment Variables da Vercel) com a URL e a chave `anon` do projeto.

O script pode ser executado mais de uma vez sem problema: ele só cria o que
ainda não existe e nunca apaga dados.

O mesmo texto aparece dentro do app, em **Configurações → Supabase**, com um
botão de copiar. Os dois vivem juntos: ao mexer no `schema.sql`, atualize
também a constante `SUPABASE_SQL_SETUP` em `src/supabaseClient.ts`.

## O que o script cria

| Tabela | Para quê |
| --- | --- |
| `auth_users` | Login do painel administrativo |
| `candidates` | Candidatos (espelho do que vem do Nexus + cadastros locais) |
| `parties` | Partidos |
| `time_delta` | Equipe em campo, identificada pelo WhatsApp |
| `operation_types` | Tipos de Operação dos pontos, cadastrados pelo usuário |
| `panfletagem_areas` | Áreas de panfletagem (círculos no mapa) |
| `campaign_pins` | Pontos estratégicos (pinos no mapa) |
| `check_ins` | Registros de campo: missão e livre, com fotos e vídeos |

Além das tabelas: o bucket `imagens` do Storage (fotos e vídeos do check-in),
o Realtime das tabelas do mapa e as políticas de acesso da chave `anon`.

## Segurança

`auth_users` guarda a senha em texto puro e fica legível pela chave `anon`, que
vai no bundle do navegador. É o formato que o login do app compara hoje. Para
fechar isso, o caminho é migrar o login para o Supabase Auth ou guardar só o
hash e comparar numa função RPC — as duas mudanças pedem ajuste no código.
