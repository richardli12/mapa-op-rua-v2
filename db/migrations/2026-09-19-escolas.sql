-- ============================================================================
-- Escolas do municipio (Censo Escolar 2025)
--
-- Camada publica do mapa: as escolas nao pertencem a um cliente, pertencem ao
-- municipio. Qualquer cliente que atue em Parauapebas ve a mesma camada, e o
-- botao so aparece quando a cidade do cliente tem escolas cadastradas aqui.
--
-- Sobre as colunas de matricula:
--   . matriculas = feminino + masculino
--   . matriculas = soma das cores/racas
--   . matriculas = soma das faixas de idade
--   . educacao_infantil = creche + pre_escola
--   . fundamental = fund_anos_iniciais + fund_anos_finais
--   . eja = eja_fundamental + eja_medio
-- As colunas de ETAPA, porem, se sobrepoem entre si e NUNCA devem ser somadas:
-- no ensino medio integrado o mesmo aluno conta em medio e em profissional, e
-- educacao_especial e um recorte transversal (aluno de inclusao contado dentro
-- da etapa regular). Somar essas colunas infla o total.
--
-- Escola paralisada fica com as matriculas em NULL, nao em zero: "nao teve
-- censo" e diferente de "teve zero aluno".
--
-- Rode este arquivo no SQL Editor. E idempotente e nao apaga nada.
-- ============================================================================

create table if not exists public.escolas (
  codigo_inep   text primary key,
  nome          text not null,
  endereco      text,
  latitude      double precision not null,
  longitude     double precision not null,
  municipio     text not null default 'Parauapebas',
  uf            text not null default 'PA',
  dependencia   text,        -- Municipal / Estadual / Privada / Federal
  situacao      text,        -- EM ATIVIDADE / SEM MATRICULA EM 2025 ...
  restricao     text,
  telefone      text,        -- como veio da fonte, sem normalizar
  etapas        text[],      -- rotulos do cadastro, para exibicao

  -- totais
  matriculas             integer,
  mat_feminino           integer,
  mat_masculino          integer,

  -- cor/raca
  mat_raca_nao_declarada integer,
  mat_branca             integer,
  mat_preta              integer,
  mat_parda              integer,
  mat_amarela            integer,
  mat_indigena           integer,

  -- faixa etaria
  mat_0_3                integer,
  mat_4_5                integer,
  mat_6_10               integer,
  mat_11_14              integer,
  mat_15_17              integer,
  mat_18_mais            integer,

  -- etapas (se sobrepoem: nao somar)
  mat_infantil           integer,
  mat_creche             integer,
  mat_pre_escola         integer,
  mat_fundamental        integer,
  mat_fund_iniciais      integer,
  mat_fund_finais        integer,
  mat_medio              integer,
  mat_profissional       integer,
  mat_eja                integer,
  mat_eja_fundamental    integer,
  mat_eja_medio          integer,
  mat_especial           integer,

  atualizado_em timestamptz not null default now()
);

-- Colunas adicionadas depois da primeira versao da tabela entram por aqui.
alter table public.escolas add column if not exists etapas text[];
alter table public.escolas add column if not exists atualizado_em timestamptz default now();

create index if not exists idx_escolas_municipio  on public.escolas (municipio);
create index if not exists idx_escolas_coord      on public.escolas (latitude, longitude);
create index if not exists idx_escolas_dependencia on public.escolas (dependencia);
create index if not exists idx_escolas_etapas     on public.escolas using gin (etapas);

-- A camada e so de leitura no app: quem escreve e o administrador, pelo SQL.
do $$
begin
  execute 'alter table public.escolas enable row level security';
  execute 'drop policy if exists "leitura_app" on public.escolas';
  execute 'create policy "leitura_app" on public.escolas for select to anon, authenticated using (true)';
exception when others then
  raise notice 'escolas: policy nao aplicada (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';
