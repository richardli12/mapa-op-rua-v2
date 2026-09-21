/**
 * As Unidades Básicas de Saúde do município, como camada do mapa.
 *
 * Vem de planilha, não de API: a lista muda pouco (uma inauguração por ano) e
 * depender de serviço externo para desenhar vinte e cinco pontos fixos seria
 * uma falha de rede a mais entre a equipe e o mapa.
 *
 * SOBRE AS COORDENADAS. A planilha de origem traz latitude e longitude sem a
 * casa decimal: "-59.802, -499.234" no lugar de "-5.9802, -49.9234". Longitude
 * abaixo de -180 não existe no planeta, então o erro é de digitação/formato, e
 * a correção (dividir por dez) põe todas as unidades dentro de Parauapebas.
 * Os valores abaixo já estão corrigidos — se a planilha for atualizada, a
 * conferência tem de ser refeita antes de colar aqui.
 */
export interface UnidadeDeSaude {
  id: string;
  nome: string;
  endereco: string | null;
  celular: string | null;
  email: string | null;
  responsaveis: { nome: string | null; celular: string | null }[];
  lat: number;
  lng: number;
}

export const UNIDADES_DE_SAUDE: UnidadeDeSaude[] = [
  {
    id: "ubs-01",
    nome: "UBS Adriano Walter (Nova Carajás)",
    endereco: "Rua 70, Qd. 443, Lt. 13, 4ª etapa - Bairro Nova Carajás",
    celular: "(94) 99219-1452",
    email: "ubs.novacarajasaps@gmail.com",
    responsaveis: [
      {
        nome: "Rosângela Carvalho Marques",
        celular: "(94) 98443-3574"
      },
      {
        nome: "Nara Danyelle Barros Silva",
        celular: "(94) 98104-3119"
      }
    ],
    lat: -5.9802,
    lng: -49.9234
  },
  {
    id: "ubs-02",
    nome: "UBS Albany",
    endereco: "Vila Albany, S/N",
    celular: null,
    email: "ubs.vilaalbanyaps@gmail.com",
    responsaveis: [
      {
        nome: "Nina Dolores",
        celular: "(94) 98406-0963"
      }
    ],
    lat: -6.0554,
    lng: -49.8943
  },
  {
    id: "ubs-03",
    nome: "UBS Altamira",
    endereco: "Rua Pedro Alvares Cabral, S/N - B. Altamira",
    celular: "(94) 99123-2752",
    email: "ubs.altamiraaps@gmail.com",
    responsaveis: [
      {
        nome: "Tayana Neves Costa Assunção",
        celular: "(94) 98444-6685"
      },
      {
        nome: "Ana Célia Alves da Silva",
        celular: "(94) 98174-6777"
      }
    ],
    lat: -6.0711,
    lng: -49.8978
  },
  {
    id: "ubs-04",
    nome: "UBS APA",
    endereco: "Vila APA, S/N",
    celular: null,
    email: "ubsapa23parauapebas@gmail.com",
    responsaveis: [
      {
        nome: "Danielle Farias Costa",
        celular: "(87) 98182-4688"
      }
    ],
    lat: -6.0543,
    lng: -49.8789
  },
  {
    id: "ubs-05",
    nome: "UBS Casas Populares",
    endereco: "Rua Rio Majé, Qd. 15, Lt. 21 e 22 - B. Casas Populares I",
    celular: "(94) 99122-6097",
    email: "ubs.casaspopularesaps@gmail.com",
    responsaveis: [
      {
        nome: "Vera Ferreira dos Passos",
        celular: "(94) 99188-7279"
      },
      {
        nome: "Edna de Pinho Ribeiro Agostini",
        celular: "(94) 98404-8279"
      }
    ],
    lat: -6.0664,
    lng: -49.9015
  },
  {
    id: "ubs-06",
    nome: "UBS Cedere I",
    endereco: "Av. Principal, 02 - Vila Cedere I",
    celular: "(94) 99256-4131",
    email: "ubscedere@gmail.com",
    responsaveis: [
      {
        nome: "Elias Gomes da Silva",
        celular: "(94) 99210-2131"
      }
    ],
    lat: -6.0541,
    lng: -49.9048
  },
  {
    id: "ubs-07",
    nome: "UBS Cidade Nova",
    endereco: "Rua A, quadra especial - B. Cidade Nova",
    celular: "(94) 99215-0160",
    email: "ubs.cidadenovaaps@gmail.com",
    responsaveis: [
      {
        nome: "Regiane Sobral dos Reis",
        celular: "(94) 99179-7307"
      },
      {
        nome: "Edna Fernandes de Sousa",
        celular: "(94) 99109-2168"
      }
    ],
    lat: -6.0772,
    lng: -49.8893
  },
  {
    id: "ubs-08",
    nome: "UBS da Paz",
    endereco: "Rua Santa Maria, Qd. 30, Lt. 05, 07, 09 e 11 - B. da Paz",
    celular: "(94) 99269-6648",
    email: "ubs.dapazaps@gmail.com",
    responsaveis: [
      {
        nome: "Leonice Lima da Silva",
        celular: "(94) 98173-2549"
      },
      {
        nome: "Nasiel da Silva Monteiro",
        celular: "(94) 98447-2812"
      }
    ],
    lat: -6.0374,
    lng: -49.9136
  },
  {
    id: "ubs-09",
    nome: "UBS Dr Bento Torres Pinto (Rio Verde)",
    endereco: "Rua Minas Gerais, esquina c/ a Av. JK - B. Rio Verde",
    celular: "(94) 99166-4198",
    email: "ubs.drbento@gmail.com",
    responsaveis: [
      {
        nome: "Maria Gicele Silva Macedo",
        celular: "(94) 98125-8889"
      },
      {
        nome: "Dinélia Silva Oliveira",
        celular: "(94) 99134-4174"
      }
    ],
    lat: -6.0465,
    lng: -49.8752
  },
  {
    id: "ubs-10",
    nome: "UBS Fortaleza",
    endereco: "Av. Fortaleza, 60 - B. Rio Verde",
    celular: "(94) 99197-3384",
    email: "ubsfortaleza2023@gmail.com",
    responsaveis: [
      {
        nome: "Rosângela Marcia Duarte",
        celular: "(94) 98143-3291"
      },
      {
        nome: "Daniela Alves Silva",
        celular: "(94) 98155-5642"
      }
    ],
    lat: -6.0441,
    lng: -49.9261
  },
  {
    id: "ubs-11",
    nome: "UBS Garimpo das Pedras",
    endereco: "Vila Garimpo das Pedras, S/N",
    celular: null,
    email: "ubsgarimpodaspedras@gmail.com",
    responsaveis: [
      {
        nome: "Nina Dolores",
        celular: "(94) 98406-0963"
      }
    ],
    lat: -6.0645,
    lng: -49.8791
  },
  {
    id: "ubs-12",
    nome: "UBS Grazielly Caetano",
    endereco: "Rua N6, esquina com a Avenida Q - bairro Cidade Jardim",
    celular: null,
    email: "ubs.graziellycaetano@gmail.com",
    responsaveis: [
      {
        nome: "Katia Fernandes do Amorim",
        celular: "(94) 99166-7812"
      },
      {
        nome: "Odaias Araujo do Nascimento",
        celular: "(94) 98168-5409"
      }
    ],
    lat: -6.0689,
    lng: -49.8764
  },
  {
    id: "ubs-13",
    nome: "UBS Guanabara",
    endereco: "Rua Mané Garrincha S/N - B. Guanabara",
    celular: "(94) 99194-2185",
    email: "UBS.guanabara23@gmail.com",
    responsaveis: [
      {
        nome: "Rafael Coelho Rodrigues",
        celular: "(94) 99228-5030"
      },
      {
        nome: "Lucia Maria Silva Ferreira",
        celular: "(94) 99901-8746"
      }
    ],
    lat: -6.0912,
    lng: -49.8821
  },
  {
    id: "ubs-14",
    nome: "UBS Jardim Canadá",
    endereco: "Rua 77, Lot-03 Qd-36 - B. Jardim Canadá",
    celular: "(94) 99304-7238",
    email: "ubsjardimcanadapbs@gmail.com",
    responsaveis: [
      {
        nome: "Genilson Alves Carvalho",
        celular: "(93) 99146-1426"
      }
    ],
    lat: -6.0245,
    lng: -49.8512
  },
  {
    id: "ubs-15",
    nome: "UBS Jerônimo de Freitas",
    endereco: "Av. Zumbi dos Palmares, 27 - Palmares II",
    celular: "(94) 99180-7383",
    email: "ubs.jeronimodefreitas@gmail.com",
    responsaveis: [
      {
        nome: "Monalisa Cristina Lobato Neri",
        celular: "(94) 98436-4498"
      },
      {
        nome: "Iza Lopes da Silva",
        celular: "(94) 98103-9765"
      }
    ],
    lat: -6.0823,
    lng: -49.8641
  },
  {
    id: "ubs-16",
    nome: "UBS Liberdade I",
    endereco: "Rua Gonçalves Dias, esq. Com Perimetral Norte - B. Liberdade I",
    celular: "(94) 99205-7968",
    email: "ubs.liberdade1aps@gmail.com",
    responsaveis: [
      {
        nome: "Flávia Silva Martins",
        celular: "(94) 98401-0338"
      },
      {
        nome: "Clarice Costa de Sousa",
        celular: "(94) 98105-7220"
      }
    ],
    lat: -6.0312,
    lng: -49.8694
  },
  {
    id: "ubs-17",
    nome: "UBS Liberdade II",
    endereco: "Av. Vinicius de Morais, esquina com a Goiás - B. Liberdade II",
    celular: "(94) 99181-5563",
    email: "ubs.liberdade2aps@gmail.com",
    responsaveis: [
      {
        nome: "Eline Nascimento Lima de Sousa",
        celular: "(94) 99287-7546"
      },
      {
        nome: "Maria das Graças Ferreira de Araujo",
        celular: "(94) 98134-9880"
      }
    ],
    lat: -6.2135,
    lng: -49.6128
  },
  {
    id: "ubs-18",
    nome: "UBS Maria de Lourdes (Tropical)",
    endereco: "Av. Jatobá, esquina com a Av. Jequitibá - B. Jardim Tropical I",
    celular: "(94) 99226-0420",
    email: "ubs.tropicalaps@gmail.com",
    responsaveis: [
      {
        nome: "Gilvanilson Mendonça Teixeira",
        celular: "(94) 98142-4898"
      },
      {
        nome: "Roberta Lira Passos Gouvea",
        celular: "(94) 98191-3016"
      }
    ],
    lat: -6.871,
    lng: -50.1445
  },
  {
    id: "ubs-19",
    nome: "UBS Minérios",
    endereco: "Rua 19, Próxima à praça - B. Minérios",
    celular: "(94) 99140-1913",
    email: "ubs.mineriosaps@gmail.com",
    responsaveis: [
      {
        nome: "Odaias Araujo do Nascimento",
        celular: "(94) 98168-5409"
      }
    ],
    lat: -6.2296,
    lng: -49.8918
  },
  {
    id: "ubs-20",
    nome: "UBS Novo Brasil",
    endereco: "Av. Salvador Flauzino Qd. 31 Lt. 37 - B. Amazonas",
    celular: "(94) 99186-7527",
    email: "ubs.novobrasilaps@gmail.com",
    responsaveis: [
      {
        nome: "Maria Helena Correa dos Santos",
        celular: "(94) 98146-1188"
      },
      {
        nome: "Aurilio da Silva Ferreira",
        celular: "(94) 99143-2883"
      }
    ],
    lat: -6.1685,
    lng: -49.712
  },
  {
    id: "ubs-21",
    nome: "UBS Palmares I",
    endereco: "Rua João Pessoa, 25 - Palmares I",
    celular: "(94) 99228-6676",
    email: "ubs.palmares01@gmail.com",
    responsaveis: [
      {
        nome: "Moisés Batista Pinto da Silva",
        celular: "(94) 99123-4300"
      },
      {
        nome: "Dayana Lima da Silva",
        celular: "(94) 99155-2449"
      }
    ],
    lat: -6.103,
    lng: -49.8164
  },
  {
    id: "ubs-22",
    nome: "UBS Paulo Fonteles",
    endereco: "Estrada Paulo Fonteles, S/N - Vila Paulo Fonteles",
    celular: "(94) 99182-1925",
    email: "ubs.paulofontelesaps@gmail.com",
    responsaveis: [
      {
        nome: "Rozilene Soares Mendonça",
        celular: "(94) 98806-4520"
      }
    ],
    lat: -6.1162,
    lng: -49.7941
  },
  {
    id: "ubs-23",
    nome: "UBS Rio Branco",
    endereco: "Rua Principal, S/N - Vila Rio Branco",
    celular: "(94) 99182-5925",
    email: null,
    responsaveis: [
      {
        nome: "Danielle Farias Costa",
        celular: "(87) 98182-4688"
      }
    ],
    lat: -6.341,
    lng: -49.699
  },
  {
    id: "ubs-24",
    nome: "UBS Sanção",
    endereco: "Avenida Principal, S/N, Vila Sansão",
    celular: "(94) 99182-5925",
    email: "ubssansao@gmail.com",
    responsaveis: [
      {
        nome: "Danielle Farias Costa",
        celular: "(87) 98182-4688"
      }
    ],
    lat: -6.276,
    lng: -49.6216
  },
  {
    id: "ubs-25",
    nome: "UBS VS-10",
    endereco: "Av. VS-10, 03 e 04, B. Residencial Bela Vista",
    celular: "(94) 99133-9592",
    email: "ubs.vs10@gmail.com",
    responsaveis: [
      {
        nome: "Sunamita Silva Vieira Vidal",
        celular: "(94) 99242-4210"
      },
      {
        nome: "Cirleia Alves da Silva",
        celular: "(94) 99237-2728"
      }
    ],
    lat: -6.918,
    lng: -49.6845
  }
];
