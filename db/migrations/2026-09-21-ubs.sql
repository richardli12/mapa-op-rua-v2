-- ============================================================================
-- UBS - Unidades Basicas de Saude do municipio, para a camada do mapa
--
-- Como usar: Painel do Supabase -> SQL Editor -> New query -> cole este
-- arquivo inteiro -> Run. E idempotente: rodar de novo atualiza os dados de
-- cada unidade pelo nome, sem duplicar nenhuma linha.
--
-- SOBRE AS COORDENADAS. A planilha de origem traz latitude e longitude sem
-- uma casa decimal ("-59.802, -499.234" no lugar de "-5.9802, -49.9234").
-- Longitude abaixo de -180 nao existe no planeta, entao e erro de formato e
-- nao de medicao: todas as linhas tem a mesma casa faltando. Os valores
-- abaixo ja estao corrigidos (divididos por dez) e caem dentro de
-- Parauapebas e das vilas do municipio. Planilha nova precisa da mesma
-- conferencia antes de virar INSERT.
-- ============================================================================

create table if not exists public.ubs (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  celular text,
  email text,
  -- Os responsaveis sao poucos e fixos (um ou dois por unidade): colunas
  -- proprias evitam uma tabela filha para ler sempre junto com a unidade.
  responsavel_1 text,
  celular_responsavel_1 text,
  responsavel_2 text,
  celular_responsavel_2 text,
  -- Unidade sem coordenada entra sem pino, em vez de nao entrar.
  latitude double precision,
  longitude double precision,
  municipio text,
  uf text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O nome e a identidade da unidade na planilha: e por ele que a recarga
-- atualiza em vez de duplicar.
create unique index if not exists idx_ubs_nome on public.ubs (lower(nome));
create index if not exists idx_ubs_municipio on public.ubs (lower(municipio));

alter table public.ubs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ubs' and policyname = 'ubs_leitura'
  ) then
    create policy ubs_leitura on public.ubs for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ubs' and policyname = 'ubs_escrita'
  ) then
    create policy ubs_escrita on public.ubs for all using (true) with check (true);
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- Dados: as unidades de Parauapebas (PA)
-- ----------------------------------------------------------------------------
insert into public.ubs
  (nome, endereco, celular, email, responsavel_1, celular_responsavel_1,
   responsavel_2, celular_responsavel_2, latitude, longitude, municipio, uf)
values
  ('UBS Adriano Walter (Nova Carajás)', 'Rua 70, Qd. 443, Lt. 13, 4ª etapa - Bairro Nova Carajás', '(94) 99219-1452', 'ubs.novacarajasaps@gmail.com', 'Rosângela Carvalho Marques', '(94) 98443-3574', 'Nara Danyelle Barros Silva', '(94) 98104-3119', -5.9802, -49.9234, 'Parauapebas', 'PA'),
  ('UBS Albany', 'Vila Albany, S/N', null, 'ubs.vilaalbanyaps@gmail.com', 'Nina Dolores', '(94) 98406-0963', null, null, -6.0554, -49.8943, 'Parauapebas', 'PA'),
  ('UBS Altamira', 'Rua Pedro Alvares Cabral, S/N - B. Altamira', '(94) 99123-2752', 'ubs.altamiraaps@gmail.com', 'Tayana Neves Costa Assunção', '(94) 98444-6685', 'Ana Célia Alves da Silva', '(94) 98174-6777', -6.0711, -49.8978, 'Parauapebas', 'PA'),
  ('UBS APA', 'Vila APA, S/N', null, 'ubsapa23parauapebas@gmail.com', 'Danielle Farias Costa', '(87) 98182-4688', null, null, -6.0543, -49.8789, 'Parauapebas', 'PA'),
  ('UBS Casas Populares', 'Rua Rio Majé, Qd. 15, Lt. 21 e 22 - B. Casas Populares I', '(94) 99122-6097', 'ubs.casaspopularesaps@gmail.com', 'Vera Ferreira dos Passos', '(94) 99188-7279', 'Edna de Pinho Ribeiro Agostini', '(94) 98404-8279', -6.0664, -49.9015, 'Parauapebas', 'PA'),
  ('UBS Cedere I', 'Av. Principal, 02 - Vila Cedere I', '(94) 99256-4131', 'ubscedere@gmail.com', 'Elias Gomes da Silva', '(94) 99210-2131', null, null, -6.0541, -49.9048, 'Parauapebas', 'PA'),
  ('UBS Cidade Nova', 'Rua A, quadra especial - B. Cidade Nova', '(94) 99215-0160', 'ubs.cidadenovaaps@gmail.com', 'Regiane Sobral dos Reis', '(94) 99179-7307', 'Edna Fernandes de Sousa', '(94) 99109-2168', -6.0772, -49.8893, 'Parauapebas', 'PA'),
  ('UBS da Paz', 'Rua Santa Maria, Qd. 30, Lt. 05, 07, 09 e 11 - B. da Paz', '(94) 99269-6648', 'ubs.dapazaps@gmail.com', 'Leonice Lima da Silva', '(94) 98173-2549', 'Nasiel da Silva Monteiro', '(94) 98447-2812', -6.0374, -49.9136, 'Parauapebas', 'PA'),
  ('UBS Dr Bento Torres Pinto (Rio Verde)', 'Rua Minas Gerais, esquina c/ a Av. JK - B. Rio Verde', '(94) 99166-4198', 'ubs.drbento@gmail.com', 'Maria Gicele Silva Macedo', '(94) 98125-8889', 'Dinélia Silva Oliveira', '(94) 99134-4174', -6.0465, -49.8752, 'Parauapebas', 'PA'),
  ('UBS Fortaleza', 'Av. Fortaleza, 60 - B. Rio Verde', '(94) 99197-3384', 'ubsfortaleza2023@gmail.com', 'Rosângela Marcia Duarte', '(94) 98143-3291', 'Daniela Alves Silva', '(94) 98155-5642', -6.0441, -49.9261, 'Parauapebas', 'PA'),
  ('UBS Garimpo das Pedras', 'Vila Garimpo das Pedras, S/N', null, 'ubsgarimpodaspedras@gmail.com', 'Nina Dolores', '(94) 98406-0963', null, null, -6.0645, -49.8791, 'Parauapebas', 'PA'),
  ('UBS Grazielly Caetano', 'Rua N6, esquina com a Avenida Q - bairro Cidade Jardim', null, 'ubs.graziellycaetano@gmail.com', 'Katia Fernandes do Amorim', '(94) 99166-7812', 'Odaias Araujo do Nascimento', '(94) 98168-5409', -6.0689, -49.8764, 'Parauapebas', 'PA'),
  ('UBS Guanabara', 'Rua Mané Garrincha S/N - B. Guanabara', '(94) 99194-2185', 'UBS.guanabara23@gmail.com', 'Rafael Coelho Rodrigues', '(94) 99228-5030', 'Lucia Maria Silva Ferreira', '(94) 99901-8746', -6.0912, -49.8821, 'Parauapebas', 'PA'),
  ('UBS Jardim Canadá', 'Rua 77, Lot-03 Qd-36 - B. Jardim Canadá', '(94) 99304-7238', 'ubsjardimcanadapbs@gmail.com', 'Genilson Alves Carvalho', '(93) 99146-1426', null, null, -6.0245, -49.8512, 'Parauapebas', 'PA'),
  ('UBS Jerônimo de Freitas', 'Av. Zumbi dos Palmares, 27 - Palmares II', '(94) 99180-7383', 'ubs.jeronimodefreitas@gmail.com', 'Monalisa Cristina Lobato Neri', '(94) 98436-4498', 'Iza Lopes da Silva', '(94) 98103-9765', -6.0823, -49.8641, 'Parauapebas', 'PA'),
  ('UBS Liberdade I', 'Rua Gonçalves Dias, esq. Com Perimetral Norte - B. Liberdade I', '(94) 99205-7968', 'ubs.liberdade1aps@gmail.com', 'Flávia Silva Martins', '(94) 98401-0338', 'Clarice Costa de Sousa', '(94) 98105-7220', -6.0312, -49.8694, 'Parauapebas', 'PA'),
  ('UBS Liberdade II', 'Av. Vinicius de Morais, esquina com a Goiás - B. Liberdade II', '(94) 99181-5563', 'ubs.liberdade2aps@gmail.com', 'Eline Nascimento Lima de Sousa', '(94) 99287-7546', 'Maria das Graças Ferreira de Araujo', '(94) 98134-9880', -6.2135, -49.6128, 'Parauapebas', 'PA'),
  ('UBS Maria de Lourdes (Tropical)', 'Av. Jatobá, esquina com a Av. Jequitibá - B. Jardim Tropical I', '(94) 99226-0420', 'ubs.tropicalaps@gmail.com', 'Gilvanilson Mendonça Teixeira', '(94) 98142-4898', 'Roberta Lira Passos Gouvea', '(94) 98191-3016', -6.871, -50.1445, 'Parauapebas', 'PA'),
  ('UBS Minérios', 'Rua 19, Próxima à praça - B. Minérios', '(94) 99140-1913', 'ubs.mineriosaps@gmail.com', 'Odaias Araujo do Nascimento', '(94) 98168-5409', null, null, -6.2296, -49.8918, 'Parauapebas', 'PA'),
  ('UBS Novo Brasil', 'Av. Salvador Flauzino Qd. 31 Lt. 37 - B. Amazonas', '(94) 99186-7527', 'ubs.novobrasilaps@gmail.com', 'Maria Helena Correa dos Santos', '(94) 98146-1188', 'Aurilio da Silva Ferreira', '(94) 99143-2883', -6.1685, -49.712, 'Parauapebas', 'PA'),
  ('UBS Palmares I', 'Rua João Pessoa, 25 - Palmares I', '(94) 99228-6676', 'ubs.palmares01@gmail.com', 'Moisés Batista Pinto da Silva', '(94) 99123-4300', 'Dayana Lima da Silva', '(94) 99155-2449', -6.103, -49.8164, 'Parauapebas', 'PA'),
  ('UBS Paulo Fonteles', 'Estrada Paulo Fonteles, S/N - Vila Paulo Fonteles', '(94) 99182-1925', 'ubs.paulofontelesaps@gmail.com', 'Rozilene Soares Mendonça', '(94) 98806-4520', null, null, -6.1162, -49.7941, 'Parauapebas', 'PA'),
  ('UBS Rio Branco', 'Rua Principal, S/N - Vila Rio Branco', '(94) 99182-5925', null, 'Danielle Farias Costa', '(87) 98182-4688', null, null, -6.341, -49.699, 'Parauapebas', 'PA'),
  ('UBS Sanção', 'Avenida Principal, S/N, Vila Sansão', '(94) 99182-5925', 'ubssansao@gmail.com', 'Danielle Farias Costa', '(87) 98182-4688', null, null, -6.276, -49.6216, 'Parauapebas', 'PA'),
  ('UBS VS-10', 'Av. VS-10, 03 e 04, B. Residencial Bela Vista', '(94) 99133-9592', 'ubs.vs10@gmail.com', 'Sunamita Silva Vieira Vidal', '(94) 99242-4210', 'Cirleia Alves da Silva', '(94) 99237-2728', -6.918, -49.6845, 'Parauapebas', 'PA')
on conflict (lower(nome)) do update set
  endereco              = excluded.endereco,
  celular               = excluded.celular,
  email                 = excluded.email,
  responsavel_1         = excluded.responsavel_1,
  celular_responsavel_1 = excluded.celular_responsavel_1,
  responsavel_2         = excluded.responsavel_2,
  celular_responsavel_2 = excluded.celular_responsavel_2,
  latitude              = excluded.latitude,
  longitude             = excluded.longitude,
  municipio             = excluded.municipio,
  uf                    = excluded.uf,
  updated_at            = now();

notify pgrst, 'reload schema';
