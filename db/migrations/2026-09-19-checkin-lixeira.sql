-- ============================================================================
-- Lixeira do check-in: o registro sai das telas sem sair do banco
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

alter table public.check_ins add column if not exists trashed boolean default false;

update public.check_ins set trashed = false where trashed is null;

-- As telas pedem sempre "os deste cliente que nao estao na lixeira".
create index if not exists idx_check_ins_lixeira
  on public.check_ins ("candidateId", trashed);
