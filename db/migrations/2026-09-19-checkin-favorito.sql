-- ============================================================================
-- Check-in favorito: a estrela que o administrador liga na lista e no mapa
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

alter table public.check_ins add column if not exists favorite boolean default false;

update public.check_ins set favorite = false where favorite is null;

-- O mapa e a lista filtram por favorito dentro de um cliente so.
create index if not exists idx_check_ins_favorito
  on public.check_ins ("candidateId", favorite);
