-- ============================================================================
-- Check-in em formato de conversa: operacao escolhida, precisao do GPS e
-- autoria do integrante. Idempotente.
-- ============================================================================

alter table public.check_ins add column if not exists "operationTypeId" text;
alter table public.check_ins add column if not exists "operationTypeLabel" text;
alter table public.check_ins add column if not exists accuracy numeric;
alter table public.check_ins add column if not exists "memberId" text;
alter table public.check_ins add column if not exists "memberPhoto" text;

create index if not exists idx_check_ins_operacao on public.check_ins ("operationTypeId");
create index if not exists idx_check_ins_membro   on public.check_ins ("memberId");

notify pgrst, 'reload schema';
