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
    "A chave do CCO não está configurada neste ambiente. Fale com o administrador.",
  CHAVE_INVALIDA:
    "A chave do CCO não foi aceita. Confira o que foi copiado no cadastro dela.",
  CHAVE_REVOGADA:
    "A chave do CCO foi revogada. Peça uma nova ao administrador do sistema.",
  PARAMETRO_INVALIDO: "A pesquisa não foi aceita como está escrita.",
  METODO_NAO_PERMITIDO: "Esta pesquisa só responde a leitura.",
  LIMITE_EXCEDIDO:
    "A cota de pesquisas do CCO foi atingida. Espere um pouco antes de tentar de novo.",
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
