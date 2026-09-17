-- ============================================================================
-- Tipos de operacao: descricao, liga/desliga e ordem de exibicao
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

-- Explicacao curta que aparece embaixo do nome, na tela do cliente.
alter table public.operation_types add column if not exists description text;

-- Tipo desligado some dos formularios de check-in, mas os registros antigos
-- continuam mostrando o rotulo dele: nada de historico e perdido.
alter table public.operation_types add column if not exists active boolean default true;

-- Ordem em que os tipos aparecem no check-in, definida arrastando na lista.
alter table public.operation_types add column if not exists position integer default 0;

update public.operation_types set active = true where active is null;

create index if not exists idx_operation_types_ordem
  on public.operation_types (candidateid, position);
