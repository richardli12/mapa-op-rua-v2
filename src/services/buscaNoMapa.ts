/**
 * Pesquisa de lugares no mapa, do lado do navegador.
 *
 * O front nunca fala com o SerpApi direto: a chave é de servidor e é cobrada
 * por pesquisa. Quem conversa com o SerpApi é a rota `/api/mapa-busca` deste
 * projeto — aqui só montamos o pedido e traduzimos a resposta.
 */

export interface LugarEncontrado {
  id: string;
  titulo: string;
  endereco: string | null;
  categoria: string | null;
  avaliacao: number | null;
  totalAvaliacoes: number | null;
  telefone: string | null;
  site: string | null;
  situacao: string | null;
  placeId: string | null;
  latitude: number;
  longitude: number;
}

export interface ResultadoDaBusca {
  termo: string;
  lugares: LugarEncontrado[];
  /** O que o Google disse quando não achou o que foi pedido. */
  aviso: string | null;
}

export interface ErroDaBusca {
  codigo: string;
  mensagem: string;
}

/** Mensagens nossas para os códigos que a ponte devolve. */
const RECADOS: { [codigo: string]: string } = {
  CHAVE_AUSENTE:
    "A pesquisa de lugares não está configurada neste ambiente. Fale com o administrador.",
  CHAVE_INVALIDA:
    "A chave da pesquisa de lugares não foi aceita. Fale com o administrador.",
  PARAMETRO_INVALIDO: "A pesquisa não foi aceita como está escrita.",
  METODO_NAO_PERMITIDO: "Esta pesquisa só responde a leitura.",
  LIMITE_EXCEDIDO:
    "A cota de pesquisas foi atingida. Espere um pouco antes de tentar de novo.",
  SERVICO_INDISPONIVEL:
    "O serviço de pesquisa não respondeu agora. Tente de novo em instantes.",
  ERRO_INTERNO: "Algo falhou na pesquisa. Tente de novo.",
};

export interface ParametrosDaBusca {
  termo: string;
  /** Centro do mapa, para o Google procurar perto do que a pessoa está vendo. */
  centro?: { lat: number; lng: number; zoom: number } | null;
  /** Deixa a busca anterior ser cancelada quando outra começa. */
  sinal?: AbortSignal;
}

/**
 * Procura lugares pelo termo escrito.
 *
 * Erro vira exceção com código junto: quem chama decide o que fazer pelo
 * `codigo`, nunca pelo texto — o texto é para a pessoa ler e pode mudar.
 */
export async function buscarLugares({
  termo,
  centro,
  sinal,
}: ParametrosDaBusca): Promise<ResultadoDaBusca> {
  const url = new URL("/api/mapa-busca", window.location.origin);
  url.searchParams.set("q", termo.trim());
  if (centro) {
    url.searchParams.set("lat", String(centro.lat));
    url.searchParams.set("lng", String(centro.lng));
    url.searchParams.set("zoom", String(centro.zoom));
  }

  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: sinal });
  } catch (err: any) {
    // Busca cancelada não é falha: é a pessoa digitando de novo. Sobe como
    // está para quem chamou simplesmente ignorar.
    if (err?.name === "AbortError") throw err;
    const erro: ErroDaBusca = {
      codigo: "SERVICO_INDISPONIVEL",
      mensagem: "Não deu para falar com o serviço de pesquisa agora.",
    };
    throw erro;
  }

  if (!resposta.ok) {
    let codigo = "ERRO_INTERNO";
    let mensagem = "";
    try {
      const corpo = await resposta.json();
      codigo = corpo?.erro?.codigo || codigo;
      mensagem = corpo?.erro?.mensagem || "";
    } catch {
      // Resposta sem JSON: fica o código genérico mesmo.
    }
    if (mensagem) console.warn(`[mapa-busca] ${codigo}: ${mensagem}`);
    const erro: ErroDaBusca = {
      codigo,
      mensagem: RECADOS[codigo] || "Algo falhou na pesquisa. Tente de novo.",
    };
    throw erro;
  }

  const dados = await resposta.json();
  return {
    termo: dados?.consulta?.termo || termo,
    lugares: (dados?.lugares || []) as LugarEncontrado[],
    aviso: dados?.aviso ?? null,
  };
}
