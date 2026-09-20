/**
 * Ponte para a pesquisa de lugares do SerpApi (motor Google Maps).
 *
 * A chave do SerpApi fica só aqui, no servidor. Ela nunca pode ir para o
 * navegador: tudo que entra no bundle é público, e uma chave de SerpApi é
 * cobrada por pesquisa — vazar a chave é vazar a conta.
 *
 * A ponte é de leitura, repassa apenas o termo e o centro do mapa, e devolve
 * uma lista já no formato que o mapa usa. Traduzir aqui e não no front é de
 * propósito: quem desenha a lista não deveria saber que o SerpApi responde
 * "place_results" quando acerta um lugar só e "local_results" quando acha
 * vários.
 */

const SERPAPI_URL = "https://serpapi.com/search.json";

/** A pesquisa consulta o Google ao vivo; abaixo disso ela corta boa busca. */
const TEMPO_LIMITE = 30_000;

/** O SerpApi aceita de 3z a 21z; fora disso ele recusa a chamada inteira. */
const ZOOM_MIN = 3;
const ZOOM_MAX = 21;

const falhar = (
  res: any,
  status: number,
  codigo: string,
  mensagem: string,
) => {
  res.status(status).json({ erro: { codigo, mensagem } });
};

/** Número de verdade ou nada: coordenada quebrada leva o mapa para o oceano. */
const numero = (v: any): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const texto = (v: any): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
};

/**
 * Um resultado do SerpApi no formato do mapa.
 *
 * Devolve `null` para o que não tem coordenada: um lugar que não dá para
 * mostrar no mapa não é resultado de pesquisa no mapa, é ruído na lista.
 */
const traduzir = (bruto: any, indice: number) => {
  if (!bruto || typeof bruto !== "object") return null;

  const gps = bruto.gps_coordinates || {};
  const latitude = numero(gps.latitude);
  const longitude = numero(gps.longitude);
  if (latitude === null || longitude === null) return null;

  return {
    id: texto(bruto.place_id) || texto(bruto.data_id) || `lugar-${indice}`,
    titulo: texto(bruto.title) || "Sem nome",
    endereco: texto(bruto.address),
    categoria: texto(bruto.type) || texto((bruto.types || [])[0]),
    avaliacao: numero(bruto.rating),
    totalAvaliacoes: numero(bruto.reviews),
    telefone: texto(bruto.phone),
    site: texto(bruto.website),
    situacao: texto(bruto.open_state),
    placeId: texto(bruto.place_id),
    latitude,
    longitude,
  };
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    falhar(res, 405, "METODO_NAO_PERMITIDO", "Esta rota responde apenas a GET.");
    return;
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    falhar(
      res,
      500,
      "CHAVE_AUSENTE",
      "SERPAPI_API_KEY não configurada nas variáveis de ambiente do projeto.",
    );
    return;
  }

  const entrada = new URL(req.url || "", "http://localhost").searchParams;
  const termo = (entrada.get("q") || "").trim();

  if (!termo) {
    falhar(res, 400, "PARAMETRO_INVALIDO", "Informe o que pesquisar no parâmetro q.");
    return;
  }
  if (termo.length > 200) {
    falhar(res, 400, "PARAMETRO_INVALIDO", "A pesquisa aceita no máximo 200 caracteres.");
    return;
  }

  const destino = new URL(SERPAPI_URL);
  destino.searchParams.set("engine", "google_maps");
  destino.searchParams.set("q", termo);
  destino.searchParams.set("type", "search");
  // Resposta em português do Brasil: quem lê a lista está no Brasil, e é o
  // idioma que devolve "Avenida" em vez de "Avenue" no nome das ruas.
  destino.searchParams.set("hl", "pt-br");
  destino.searchParams.set("gl", "br");
  destino.searchParams.set("google_domain", "google.com.br");
  destino.searchParams.set("api_key", apiKey);

  /*
   * Centro da busca.
   *
   * Sem ele, "avenida ana karina" pode voltar uma avenida de mesmo nome em
   * outro estado. Com o centro do mapa que a pessoa está olhando, o Google
   * procura perto do que ela vê — que é o que ela quis dizer.
   */
  const lat = numero(entrada.get("lat")?.replace(",", "."));
  const lng = numero(entrada.get("lng")?.replace(",", "."));
  const zoomBruto = numero(entrada.get("zoom")?.replace(",", "."));
  if (lat !== null && lng !== null) {
    const zoom = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.round(zoomBruto ?? 14)),
    );
    destino.searchParams.set("ll", `@${lat},${lng},${zoom}z`);
  }

  let resposta: Response;
  let dados: any;
  try {
    resposta = await fetch(destino, { signal: AbortSignal.timeout(TEMPO_LIMITE) });
    dados = await resposta.json();
  } catch (err: any) {
    const expirou = err?.name === "TimeoutError" || err?.name === "AbortError";
    falhar(
      res,
      expirou ? 504 : 502,
      expirou ? "SERVICO_INDISPONIVEL" : "ERRO_INTERNO",
      expirou
        ? "A pesquisa demorou demais para responder. Tente de novo."
        : "Não deu para falar com o serviço de pesquisa agora.",
    );
    return;
  }

  if (!resposta.ok) {
    // O texto do erro do SerpApi é para quem mantém o sistema, não para quem
    // está na rua: o front troca pelo recado certo usando o código.
    const detalhe = texto(dados?.error) || `HTTP ${resposta.status}`;
    console.warn(`[mapa-busca] status=${resposta.status} erro="${detalhe}"`);
    const codigo =
      resposta.status === 401
        ? "CHAVE_INVALIDA"
        : resposta.status === 429
          ? "LIMITE_EXCEDIDO"
          : resposta.status >= 500
            ? "SERVICO_INDISPONIVEL"
            : "ERRO_INTERNO";
    falhar(res, resposta.status, codigo, detalhe);
    return;
  }

  /*
   * O SerpApi responde de duas formas para a mesma pergunta: "place_results"
   * (um objeto) quando ele decide que a busca aponta para um lugar só, e
   * "local_results" (uma lista) quando acha vários. As duas viram uma lista
   * só aqui — o lugar exato na frente, que é o que a pessoa pediu.
   */
  const brutos = [
    dados?.place_results,
    ...(Array.isArray(dados?.local_results) ? dados.local_results : []),
  ];

  const lugares: any[] = [];
  const vistos = new Set<string>();
  brutos.forEach((bruto, i) => {
    const lugar = traduzir(bruto, i);
    if (!lugar || vistos.has(lugar.id)) return;
    vistos.add(lugar.id);
    lugares.push(lugar);
  });

  res.status(200).json({
    consulta: { termo },
    lugares,
    // Quando o Google não achou nada, ele diz por quê. Repassar esse aviso é
    // melhor do que uma lista vazia sem explicação.
    aviso: texto(dados?.search_information?.local_results_state) || null,
  });
}
