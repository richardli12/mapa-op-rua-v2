# Banco de dados

`schema.sql` cria o banco inteiro do sistema, do login ao check-in em campo.

## Como aplicar num banco novo

1. Painel do banco de dados → **SQL Editor** → **New query**.
2. Cole o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.
3. Troque a senha do usuário inicial:
   ```sql
   update public.auth_users
      set password = 'a-sua-senha'
    where email = 'admin@totalmapa.com';
   ```
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

Além das tabelas: o bucket `imagens` de arquivos (fotos e vídeos do check-in),
o Realtime das tabelas do mapa e as políticas de acesso da chave `anon`.

## Segurança

`auth_users` guarda a senha em texto puro e fica legível pela chave `anon`, que
vai no bundle do navegador. É o formato que o login do app compara hoje. Para
fechar isso, o caminho é migrar o login para o serviço de autenticação do banco ou guardar só o
hash e comparar numa função RPC — as duas mudanças pedem ajuste no código.
