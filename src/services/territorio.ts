/**
 * Território e Censo, do lado do navegador.
 *
 * Fala com a rota `/api/territorio` deste projeto, que é quem tem a chave do
 * CCO. As regras do manual que valem para quem consome estão aqui, no tipo e
 * no comentário, para não se perderem no caminho:
 *
 * - `null` não é zero. No setor, `null` é "não divulgado" e `0` é "medido, e
 *   é zero". Somar os dois como zero é o erro mais fácil de cometer.
 * - Somar bairros não dá o município: parte do território fica fora da
 *   divisão por bairros (ver `setoresSemBairro`).
 * - `setoresSemDado > 0` num indicador significa soma **parcial**.
 * - Na área desenhada, `estimativa` é estimativa; `exato` é o piso contado.
 */

export interface UfDoTerritorio {
  sigla: string;
  nome: string;
  codigoIbge: number;
  territorioDisponivel: boolean;
  indicadoresDisponiveis: boolean;
}

export interface MunicipioDoTerritorio {
  codigo: string;
  nome: string;
  uf: string;
  populacao: number | null;
  domicilios: number | null;
  totalSetores: number | null;
  totalBairros: number | null;
  caixa?: { bboxGeoJson: [number, number, number, number] } | null;
  /** Só vem na ficha de um município: setores fora da divisão por bairros. */
  setoresSemBairro?: number;
}

export interface BairroDoTerritorio {
  codigo: string;
  nome: string;
  municipioCodigo: string;
  municipioNome: string;
  areaKm2: number | null;
  populacao: number | null;
  domicilios: number | null;
  domiciliosParticulares: number | null;
  domiciliosColetivos: number | null;
  domiciliosParticularesOcupados: number | null;
  mediaMoradoresPorDomicilioOcupado: number | null;
  totalSetores: number | null;
  geometria: any | null;
}

export interface IndicadorDoCenso {
  id: string;
  rotulo: string;
  unidade: string;
  valor: number | null;
  origem: "direto" | "derivado";
  motivoIndisponivel: string | null;
  /** Maior que zero: a soma do recorte está incompleta. */
  setoresSemDado: number;
}

export interface GrupoDeIndicadores {
  id: string;
  titulo: string;
  principais: IndicadorDoCenso[];
  detalhes: IndicadorDoCenso[];
}

export interface IndicadoresDoRecorte {
  /** "ok" tem dados; "sem_indicadores" é estado do sistema, não erro seu. */
  status: "ok" | "sem_indicadores";
  nivel: string;
  codigo: string;
  fonte: {
    censo: string;
    conjunto: string;
    instituto: string;
    anoReferencia: number;
    versaoCatalogo: string;
  } | null;
  totalSetores: number | null;
  grupos: GrupoDeIndicadores[];
}

export interface AnaliseDeArea {
  areaKm2: number;
  setores: { tocados: number; inteiros: number; parciais: number };
  /** Aproximação: parciais entram pela fração de área coberta. */
  estimativa: { populacao: number; domicilios: number; densidade: number };
  /** Piso contado: só os setores inteiramente dentro da área. */
  exato: { populacao: number; domicilios: number };
  temSetoresParciais: boolean;
  /** Distingue "não toca dado nenhum" de "tem zero habitantes". */
  foraDaCobertura: boolean;
  parcialmenteForaDaCobertura: boolean;
  contribuicoes: {
    codigo: string;
    fracaoCoberta: number;
    inteiro: boolean;
    populacao: number | null;
    domicilios: number | null;
  }[];
}

export interface ErroDoTerritorio {
  codigo: string;
  mensagem: string;
  debugId?: string | null;
}

/** Mensagens nossas para os códigos que o manual define. */
const RECADOS: { [codigo: string]: string } = {
  CHAVE_AUSENTE:
    "O acesso à base de dados não está configurado neste ambiente. Fale com o administrador.",
  CHAVE_INVALIDA:
    "O acesso à base de dados não foi aceito. Confira o que foi cadastrado.",
  CHAVE_REVOGADA:
    "O acesso à base de dados foi revogado. Fale com o administrador do sistema.",
  PARAMETRO_INVALIDO: "A consulta não foi aceita como está escrita.",
  UF_INVALIDA: "Esta sigla de UF não existe.",
  NAO_ENCONTRADO:
    "Este recorte não existe, ou esta UF ainda não teve os dados publicados.",
  METODO_NAO_PERMITIDO: "Esta consulta só responde a leitura.",
  SERVICO_INDISPONIVEL:
    "O serviço do território não respondeu agora. Tente de novo em instantes.",
  ERRO_INTERNO: "Algo falhou na consulta. Tente de novo.",
};

/** Uma chamada à ponte, com o tratamento de erro que o manual pede. */
async function chamar<T>(
  recurso: string,
  params: { [chave: string]: string | number | undefined } = {},
  corpo?: any,
): Promise<T> {
  const url = new URL("/api/territorio", window.location.origin);
  url.searchParams.set("recurso", recurso);
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, String(valor));
    }
  });

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: corpo ? "POST" : "GET",
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err: any) {
    const erro: ErroDoTerritorio = {
      codigo: "SERVICO_INDISPONIVEL",
      mensagem:
        err?.name === "TimeoutError"
          ? "A consulta demorou demais para responder."
          : "Não deu para falar com o serviço do território agora.",
    };
    throw erro;
  }

  const debugIdDoCabecalho = resposta.headers.get("X-Debug-Id");

  if (!resposta.ok) {
    let codigo = "ERRO_INTERNO";
    let mensagem = "";
    let rastreio = debugIdDoCabecalho;
    try {
      const corpoDoErro = await resposta.json();
      codigo = corpoDoErro?.erro?.codigo || codigo;
      mensagem = corpoDoErro?.erro?.mensagem || "";
      // O debugId do corpo manda: cabeçalho se perde em proxy pelo caminho.
      rastreio = corpoDoErro?.erro?.debugId || debugIdDoCabecalho;
    } catch {
      // Sem JSON: fica o código genérico.
    }
    if (rastreio) console.warn(`[territorio] ${codigo} debugId=${rastreio}`);
    const erro: ErroDoTerritorio = {
      codigo,
      mensagem: RECADOS[codigo] || mensagem || "Algo falhou na consulta.",
      debugId: rastreio,
    };
    throw erro;
  }

  return (await resposta.json()) as T;
}

/**
 * As 27 UFs e o que existe de dado em cada uma.
 *
 * É a primeira chamada de qualquer integração: malha e indicadores são cargas
 * separadas, e uma UF sem malha responde 404 em todas as outras rotas — o que
 * não é erro de quem chamou, é dado que ainda não foi importado.
 */
export const lerUfs = () =>
  chamar<{ total: number; comTerritorio: string[]; comIndicadores: string[]; ufs: UfDoTerritorio[] }>(
    "ufs",
  );

export const lerMunicipios = (uf: string, inicio = 0) =>
  chamar<{
    uf: string;
    paginacao: { proximoInicio: number | null; total: number };
    municipios: MunicipioDoTerritorio[];
  }>("municipios", { uf, inicio, limite: 1000 });

export const lerMunicipio = (uf: string, codigo: string) =>
  chamar<{ municipio: MunicipioDoTerritorio }>("municipio", { uf, codigo });

/**
 * Bairros de um município.
 *
 * `comGeometria` liga o polígono — e o teto de linhas por página cai de 1000
 * para 200, porque a geometria é o dado mais pesado da base. Por isso ela só
 * é pedida quando o mapa vai desenhar; para somar e ordenar números, o
 * polígono só atrasa.
 */
export const lerBairros = (
  uf: string,
  municipio: string,
  inicio = 0,
  comGeometria = false,
) =>
  chamar<{
    paginacao: { proximoInicio: number | null; total: number };
    bairros: BairroDoTerritorio[];
  }>("bairros", {
    uf,
    municipio,
    inicio,
    limite: comGeometria ? 200 : 1000,
    geometria: comGeometria ? "true" : undefined,
  });

export interface SetorDoTerritorio {
  codigo: string;
  municipioCodigo: string;
  bairroCodigo: string | null;
  areaKm2: number | null;
  populacao: number | null;
  domicilios: number | null;
  domiciliosParticularesOcupados: number | null;
  mediaMoradoresPorDomicilioOcupado: number | null;
  /** Quanto do setor foi estimado pelo instituto em vez de coletado. */
  percentualDomiciliosImputados: number | null;
  geometria: any | null;
}

/**
 * Setores de um bairro — o recorte mais fino que existe.
 *
 * Só de um bairro por vez, de propósito: com geometria o teto é de 100 por
 * página, e uma cidade grande tem mais de mil setores. Puxar todos seria
 * dezenas de megabytes para desenhar um mapa que ninguém consegue ler inteiro.
 */
export const lerSetores = (
  uf: string,
  municipio: string,
  bairro?: string,
  inicio = 0,
  comGeometria = false,
) =>
  chamar<{
    paginacao: { proximoInicio: number | null; total: number };
    setores: SetorDoTerritorio[];
  }>("setores", {
    uf,
    municipio,
    bairro,
    inicio,
    limite: comGeometria ? 100 : 500,
    geometria: comGeometria ? "true" : undefined,
  });

/**
 * Percorre todas as páginas de uma listagem.
 *
 * O fim é sempre o `proximoInicio` vindo `null` — nunca uma conta nossa de
 * quantos vêm por página, que o CCO não garante. O teto de páginas existe
 * para um engano não virar uma sessão de download sem fim.
 */
export async function todasAsPaginas<T>(
  buscar: (inicio: number) => Promise<{
    paginacao: { proximoInicio: number | null };
  } & { [chave: string]: any }>,
  campo: string,
  maximoDePaginas = 20,
): Promise<T[]> {
  const tudo: T[] = [];
  let inicio: number | null = 0;
  let paginas = 0;

  while (inicio !== null && paginas < maximoDePaginas) {
    const pagina = await buscar(inicio);
    tudo.push(...((pagina as any)[campo] || []));
    inicio = pagina.paginacao?.proximoInicio ?? null;
    paginas += 1;
  }

  return tudo;
}

export const lerIndicadores = (uf: string, nivel: string, codigo: string) =>
  chamar<IndicadoresDoRecorte>("indicadores", { uf, nivel, codigo });

/**
 * População dentro de um círculo desenhado.
 *
 * O círculo é enviado como centro e raio de propósito: gerar o polígono de um
 * círculo à mão é o tipo de conta que sai errada em silêncio, com o raio
 * virando graus em vez de metros.
 */
export const analisarRaio = (
  uf: string,
  latitude: number,
  longitude: number,
  raioMetros: number,
) =>
  chamar<{ uf: string; analise: AnaliseDeArea }>("analise", {}, {
    uf,
    circulo: { latitude, longitude, raioMetros },
  });
