-- ============================================================================
-- Check-in Super Favorito: a coroa acima da estrela
--
-- A estrela ficou comum: numa operacao grande, dezenas de check-ins viram
-- favoritos e achar "aquele" volta a ser procurar agulha. O super favorito e
-- o degrau de cima -- poucos, escolhidos a dedo, com lugar proprio no mapa e
-- na lista.
--
-- Regra: todo super favorito tambem e favorito. Tirar a estrela tira a coroa.
-- A regra mora no sistema e e reforcada aqui por uma constraint, para nenhum
-- caminho gravar uma coroa sem estrela.
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

alter table public.check_ins add column if not exists super_favorite boolean default false;

update public.check_ins set super_favorite = false where super_favorite is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_super_e_favorito'
  ) then
    alter table public.check_ins
      add constraint check_ins_super_e_favorito
      check (not coalesce(super_favorite, false) or coalesce(favorite, false));
  end if;
end $$;

-- O mapa e a lista filtram os super favoritos dentro de um cliente so.
create index if not exists idx_check_ins_super_favorito
  on public.check_ins ("candidateId", super_favorite);
