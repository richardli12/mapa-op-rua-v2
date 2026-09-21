-- ============================================================================
-- Escolas: a base passa a ser a municipal de 2026
--
-- O que mudou na fonte, e por que a tabela precisa mudar junto:
--
-- 1. DUAS CONTAGENS ONDE ANTES HAVIA UMA. A base nova separa a PESSOA do
--    VINCULO: `alunos_unicos` conta cada aluno uma vez; `matriculas` conta os
--    vinculos, e quem faz Ensino Fundamental e AEE aparece nos dois. Genero,
--    faixa etaria e cor/raca fecham em alunos_unicos; tipo de ensino fecha em
--    matriculas. Somar um recorte contra o total errado e o engano facil
--    daqui para a frente -- por isso as duas colunas existem, com nomes que
--    nao deixam trocar.
--
-- 2. ZONA DA ESCOLA. Urbana ou rural. Numa cidade com distrito e aldeia a
--    quilometros do centro, isso muda quem chega na escola e como.
--
-- 3. RECORTES NOVOS. A faixa "18 ou mais" virou "18 a 24" e "25 ou mais" --
--    e a diferenca importa, porque uma e juventude e a outra e adulto
--    voltando a estudar. Cor/raca ganhou "Indigena Xikrin", "Albina" e um
--    "Nao informado" separado do "Nao declarada" (quem nao respondeu nao e o
--    mesmo que quem recusou responder). E o AEE, que e servico e nao etapa,
--    ganhou coluna propria em vez de entrar na conta como se fosse.
--
-- 4. ESCOLA SEM COORDENADA EXISTE. Oito vieram sem latitude/longitude. Antes
--    a coluna era NOT NULL e isso era impossivel; agora a escola entra sem
--    pino, conta nos totais e nas listas, e o mapa so nao a desenha. Zero
--    seria pior: jogaria a escola no meio do Atlantico.
--
-- As colunas do Censo 2025 que a base nova nao tem (creche, pre-escola, anos
-- iniciais e finais, medio, profissional, EJA por etapa, educacao especial)
-- CONTINUAM NA TABELA, vazias. Nao sao apagadas porque a proxima carga de
-- censo pode traze-las de volta, e dropar coluna e perder historico sem
-- precisar.
--
-- Rode este arquivo antes de 2026-09-21-escolas-2026-dados.sql.
-- ============================================================================

-- A pessoa e o vinculo, separados.
alter table public.escolas add column if not exists alunos_unicos integer;

-- Urbana ou rural.
alter table public.escolas add column if not exists zona text;

-- Genero: quem nao informou tambem e uma pessoa na conta.
alter table public.escolas add column if not exists mat_genero_nao_informado integer;

-- AEE e servico de apoio, nao etapa: coluna propria, nunca somada as outras.
alter table public.escolas add column if not exists mat_aee integer;

-- Faixa etaria nova.
alter table public.escolas add column if not exists mat_18_24 integer;
alter table public.escolas add column if not exists mat_25_mais integer;
alter table public.escolas add column if not exists mat_idade_nao_informada integer;

-- Cor/raca nova.
alter table public.escolas add column if not exists mat_indigena_xikrin integer;
alter table public.escolas add column if not exists mat_albina integer;
alter table public.escolas add column if not exists mat_raca_nao_informada integer;

-- Escola sem coordenada entra sem pino, em vez de nao entrar.
alter table public.escolas alter column latitude  drop not null;
alter table public.escolas alter column longitude drop not null;

create index if not exists idx_escolas_zona on public.escolas (zona);

notify pgrst, 'reload schema';
