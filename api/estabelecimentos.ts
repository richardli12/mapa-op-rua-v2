/**
 * Ponte para a pesquisa de estabelecimentos do CCO.
 *
 * A chave do CCO fica só aqui, no servidor. Ela nunca pode ir para o
 * navegador: tudo que entra no bundle é público, e a própria API do CCO não
 * envia cabeçalhos de CORS justamente para impedir a chamada direta da
 * página. Então o front fala com esta rota, e só esta rota fala com o CCO.
 *
 * A ponte é de leitura e repassa apenas os parâmetros documentados — nada
 * mais atravessa. O `debugId` que o CCO devolve é registrado no log do
 * servidor: é com ele que o administrador do CCO acha a chamada exata.
 */

const CCO_URL = "https://centraldecomando.nodcco.xyz/api/v1/estabelecimentos";

/** A pesquisa consulta a fonte externa ao vivo; 60 s é o mínimo do manual. */
const TEMPO_LIMITE = 60_000;

/** Devolve um erro no mesmo formato da API do CCO, para o front ter um só. */
const falhar = (
  res: any,
  status: number,
  codigo: string,
  mensagem: string,
  debugId?: string,
) => {
  res.status(status).json({ erro: { codigo, mensagem, debugId: debugId || null } });
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    falhar(
      res,
      405,
      "METODO_NAO_PERMITIDO",
      "Esta rota responde apenas a GET.",
    );
    return;
  }

  const apiKey = process.env.CCO_API_KEY;
  if (!apiKey) {
    falhar(
      res,
      500,
      "CHAVE_AUSENTE",
      "CCO_API_KEY não configurada nas variáveis de ambiente do projeto.",
    );
    return;
  }

  const entrada = new URL(req.url || "", "http://localhost").searchParams;
  const termo = (entrada.get("q") || "").trim();

  if (!termo) {
    falhar(
      res,
      400,
      "PARAMETRO_INVALIDO",
      "Informe o que pesquisar no parâmetro q.",
    );
    return;
  }
  if (termo.length > 200) {
    falhar(
      res,
      400,
      "PARAMETRO_INVALIDO",
      "A pesquisa aceita no máximo 200 caracteres.",
    );
    return;
  }

  const destino = new URL(CCO_URL);
  destino.searchParams.set("q", termo);

  // lat, lng e zoom andam sempre juntos: mandar pela metade é recusado lá, e
  // é melhor recusar aqui, com uma mensagem que diz o que fazer.
  const lat = entrada.get("lat");
  const lng = entrada.get("lng");
  const zoom = entrada.get("zoom");
  const centro = [lat, lng, zoom].filter((v) => v !== null && v !== "");

  if (centro.length > 0 && centro.length < 3) {
    falhar(
      res,
      400,
      "PARAMETRO_INVALIDO",
      "lat, lng e zoom vão juntos: envie os três ou nenhum.",
    );
    return;
  }
  if (centro.length === 3) {
    // Vírgula decimal é recusada pelo CCO; a troca acontece aqui porque quem
    // digita no painel escreve como o teclado brasileiro manda.
    destino.searchParams.set("lat", String(lat).replace(",", "."));
    destino.searchParams.set("lng", String(lng).replace(",", "."));
    destino.searchParams.set("zoom", String(zoom).replace(",", "."));
  }

  const inicio = entrada.get("inicio");
  if (inicio) destino.searchParams.set("inicio", inicio);

  try {
    const resposta = await fetch(destino, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });

    const corpo = await resposta.text();
    const debugId = resposta.headers.get("X-Debug-Id");

    // O debugId vem em toda resposta, inclusive nas de sucesso. Sem ele
    // guardado, pedir suporte ao CCO vira adivinhação.
    if (debugId) {
      console.log(
        `[estabelecimentos] status=${resposta.status} debugId=${debugId} q="${termo}"`,
      );
      res.setHeader("X-Debug-Id", debugId);
    }

    res
      .status(resposta.status)
      .setHeader("Content-Type", "application/json")
      .send(corpo);
  } catch (err: any) {
    const expirou = err?.name === "TimeoutError" || err?.name === "AbortError";
    falhar(
      res,
      expirou ? 504 : 502,
      expirou ? "SERVICO_INDISPONIVEL" : "ERRO_INTERNO",
      expirou
        ? "A pesquisa demorou demais para responder. Tente de novo."
        : `Falha ao consultar o CCO: ${err?.message || err}`,
    );
  }
}
