/**
 * Pesquisa de estabelecimentos, do lado do navegador.
 *
 * O front nunca fala com o CCO direto: a chave é de servidor, e a API de lá
 * nem envia CORS. Quem conversa com o CCO é a rota `/api/estabelecimentos`
 * deste projeto — aqui só montamos o pedido e traduzimos a resposta.
 */

export interface Estabelecimento {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  endereco: string | null;
  telefone: string | null;
  site: string | null;
  categoria: string | null;
  categorias: string[];
  avaliacao: number | null;
  totalAvaliacoes: number | null;
  faixaDePreco: string | null;
  situacao: string | null;
  horarios: { [dia: string]: string } | null;
  imagem: string | null;
  placeId: string | null;
  dataId: string | null;
}

export interface PaginaDeEstabelecimentos {
  estabelecimentos: Estabelecimento[];
  /** Onde continuar. `null` quando acabou — é a resposta que decide, não nós. */
  proximoInicio: number | null;
  temMais: boolean;
  termo: string;
}

export interface ErroDaPesquisa {
  codigo: string;
  mensagem: string;
  debugId?: string | null;
}

/** Mensagens nossas para os códigos que o manual do CCO define. */
const RECADOS: { [codigo: string]: string } = {
  CHAVE_AUSENTE:
    "O acesso à base de dados não está configurado neste ambiente. Fale com o administrador.",
  CHAVE_INVALIDA:
    "O acesso à base de dados não foi aceito. Confira o que foi cadastrado.",
  CHAVE_REVOGADA:
    "O acesso à base de dados foi revogado. Fale com o administrador do sistema.",
  PARAMETRO_INVALIDO: "A pesquisa não foi aceita como está escrita.",
  METODO_NAO_PERMITIDO: "Esta pesquisa só responde a leitura.",
  LIMITE_EXCEDIDO:
    "A cota de pesquisas deste período foi atingida. Espere um pouco antes de tentar de novo.",
  SERVICO_INDISPONIVEL:
    "O serviço de pesquisa não respondeu agora. Tente de novo em instantes.",
  ERRO_INTERNO: "Algo falhou na pesquisa. Tente de novo.",
};

export interface ParametrosDaPesquisa {
  termo: string;
  /** Centro da busca. Os três andam juntos: ou vão todos, ou nenhum. */
  centro?: { lat: number; lng: number; zoom: number } | null;
  inicio?: number;
}

/**
 * Uma página de resultados.
 *
 * Erro vira exceção com o código do CCO junto: quem chama decide o que fazer
 * pelo `codigo`, nunca pelo texto — é o que o manual pede, e o texto pode
 * mudar a qualquer momento.
 */
export async function pesquisarEstabelecimentos({
  termo,
  centro,
  inicio = 0,
}: ParametrosDaPesquisa): Promise<PaginaDeEstabelecimentos> {
  const url = new URL("/api/estabelecimentos", window.location.origin);
  url.searchParams.set("q", termo.trim());
  if (inicio > 0) url.searchParams.set("inicio", String(inicio));
  if (centro) {
    url.searchParams.set("lat", String(centro.lat));
    url.searchParams.set("lng", String(centro.lng));
    url.searchParams.set("zoom", String(centro.zoom));
  }

  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch (err: any) {
    const erro: ErroDaPesquisa = {
      codigo: "SERVICO_INDISPONIVEL",
      mensagem:
        err?.name === "TimeoutError"
          ? "A pesquisa demorou demais para responder."
          : "Não deu para falar com o serviço de pesquisa agora.",
    };
    throw erro;
  }

  const debugId = resposta.headers.get("X-Debug-Id");

  if (!resposta.ok) {
    let codigo = "ERRO_INTERNO";
    let mensagem = "";
    let rastreio = debugId;
    try {
      const corpo = await resposta.json();
      codigo = corpo?.erro?.codigo || codigo;
      mensagem = corpo?.erro?.mensagem || "";
      // O debugId vem no corpo e no cabeçalho. O do corpo manda: cabeçalho se
      // perde em proxy e em ferramenta pelo caminho, o corpo chega inteiro.
      rastreio = corpo?.erro?.debugId || debugId;
    } catch {
      // Resposta sem JSON: fica o código genérico mesmo.
    }
    // É esse código que o suporte do CCO pede; sem ele vira adivinhação.
    if (rastreio) console.warn(`[estabelecimentos] ${codigo} debugId=${rastreio}`);
    const erro: ErroDaPesquisa = {
      codigo,
      mensagem: RECADOS[codigo] || mensagem || "Algo falhou na pesquisa.",
      debugId: rastreio,
    };
    throw erro;
  }

  const dados = await resposta.json();
  return {
    estabelecimentos: (dados?.estabelecimentos || []) as Estabelecimento[],
    proximoInicio: dados?.paginacao?.proximoInicio ?? null,
    temMais: Boolean(dados?.paginacao?.temMais),
    termo: dados?.consulta?.termo || termo,
  };
}

/* ------------------------------------------------------------------ raio ---
 *
 * BUSCA DENTRO DE UM CÍRCULO DESENHADO NO MAPA.
 *
 * A API do CCO não recebe raio: ela recebe um ponto e um zoom, que é uma
 * dica de escala, não um limite. Pedir "farmácia" com o mapa em cima da
 * praça devolve farmácias da praça, da avenida e do bairro vizinho, sem
 * fronteira nenhuma — e a pessoa que marcou cem metros quer cem metros.
 *
 * Então o círculo é honrado aqui, em duas etapas:
 *
 * 1. O ZOOM SAI DO RAIO. Mandar o zoom do mapa faria a fonte procurar numa
 *    escala que não é a do círculo — raio de 100 m com o mapa aberto na
 *    cidade traz o centro inteiro, e o filtro depois jogaria quase tudo
 *    fora. O zoom é calculado para o círculo caber na busca.
 * 2. A DISTÂNCIA É MEDIDA UMA POR UMA. Cada resultado é medido em metros
 *    contra o centro; o que passa do raio não entra. Nada de "quase dentro".
 *
 * O que ficou de fora não é jogado no lixo: volta contado, com o mais
 * próximo, para a tela poder oferecer o raio que o alcançaria.
 */

/** Um estabelecimento com a distância até o centro do círculo, em metros. */
export interface EstabelecimentoNoRaio extends Estabelecimento {
  distancia: number;
}

export interface VarreduraDeRaio {
  /** Dentro do círculo, do mais perto para o mais longe. */
  dentro: EstabelecimentoNoRaio[];
  /**
   * Tudo que a fonte devolveu, medido e ordenado — inclusive o que ficou
   * fora.
   *
   * É isto que deixa o raio virar um controle ao vivo: mudar de cem para
   * duzentos metros refiltra o que já está na mão, na hora, sem esperar a
   * rede. A busca é refeita depois, por baixo, porque um círculo maior pode
   * alcançar lugares que a escala anterior nem chegou a pedir.
   */
  todos: EstabelecimentoNoRaio[];
  /** Quantos a fonte devolveu e o círculo recusou. */
  fora: number;
  /** Distância do recusado mais próximo, para sugerir um raio que o pegue. */
  maisPerto: number | null;
  /** Quantas páginas foram lidas da fonte. */
  paginas: number;
  /** A fonte ainda tinha mais e paramos por limite nosso. */
  truncado: boolean;
}

const RAIO_DA_TERRA = 6_371_000;

/** Distância em metros entre dois pontos (haversine). */
export function distanciaEmMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * O zoom em que um círculo deste raio cabe na tela.
 *
 * É a conta do Mercator: a 156543,034 m/px no equador, cada nível divide por
 * dois, e o cosseno da latitude corrige a distorção. O diâmetro é encaixado
 * numa janela de 640 px — a medida que a fonte usa para uma busca de mapa.
 */
export function zoomParaRaio(lat: number, raio: number): number {
  const metrosPorPixel = (2 * raio) / 640;
  const zoom = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metrosPorPixel);
  return Math.round(Math.min(20, Math.max(3, zoom)));
}

/** Até onde vamos atrás de páginas: o círculo é pequeno, a cota não é nossa. */
const MAXIMO_DE_PAGINAS = 4;

/**
 * Varre um círculo atrás de um termo.
 *
 * Páginas são pedidas enquanto a fonte disser que há mais e enquanto elas
 * ainda estiverem trazendo gente de dentro do círculo: quando uma página
 * inteira cai fora, a fonte já passou do bairro e continuar só gasta cota.
 */
export async function varrerRaio({
  termo,
  centro,
  raio,
}: {
  termo: string;
  centro: { lat: number; lng: number };
  raio: number;
}): Promise<VarreduraDeRaio> {
  const zoom = zoomParaRaio(centro.lat, raio);
  const dentro: EstabelecimentoNoRaio[] = [];
  const todos: EstabelecimentoNoRaio[] = [];
  const vistos = new Set<string>();
  let fora = 0;
  let maisPerto: number | null = null;
  let inicio = 0;
  let paginas = 0;
  let temMais = false;

  while (paginas < MAXIMO_DE_PAGINAS) {
    const pagina = await pesquisarEstabelecimentos({
      termo,
      centro: { lat: centro.lat, lng: centro.lng, zoom },
      inicio,
    });
    paginas += 1;

    let entraramNestaPagina = 0;
    for (const lugar of pagina.estabelecimentos) {
      // A fonte repete lugares entre páginas quando o recorte é apertado.
      const chave = lugar.id || `${lugar.latitude},${lugar.longitude},${lugar.nome}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      const distancia = distanciaEmMetros(centro, {
        lat: lugar.latitude,
        lng: lugar.longitude,
      });
      const medido: EstabelecimentoNoRaio = { ...lugar, distancia };
      todos.push(medido);
      if (distancia <= raio) {
        dentro.push(medido);
        entraramNestaPagina += 1;
      } else {
        fora += 1;
        if (maisPerto === null || distancia < maisPerto) maisPerto = distancia;
      }
    }

    temMais = pagina.temMais && pagina.proximoInicio !== null;
    if (!temMais) break;
    // Página inteira fora do círculo: a fonte já saiu da vizinhança.
    if (entraramNestaPagina === 0 && paginas > 1) break;
    inicio = pagina.proximoInicio as number;
  }

  const porDistancia = (a: EstabelecimentoNoRaio, b: EstabelecimentoNoRaio) =>
    a.distancia - b.distancia;
  dentro.sort(porDistancia);
  todos.sort(porDistancia);
  return { dentro, todos, fora, maisPerto, paginas, truncado: temMais };
}
