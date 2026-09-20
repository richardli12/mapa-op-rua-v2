/**
 * Ponte para as rotas de território e Censo do CCO.
 *
 * Mesma regra da pesquisa de estabelecimentos: a chave mora só aqui. Tudo que
 * entra no bundle é público, e a API do CCO não envia CORS justamente para
 * impedir a chamada direta da página.
 *
 * Uma rota só atende as oito do CCO, escolhidas pelo parâmetro `recurso`.
 * Cada recurso declara o que repassa — parâmetro que não está na lista não
 * atravessa, para a ponte não virar um proxy aberto.
 */

const CCO_BASE = "https://centraldecomando.nodcco.xyz/api/v1/territorio";

/** A carga territorial é pesada; o manual pede 60 s no mínimo. */
const TEMPO_LIMITE = 60_000;

/** Recursos atendidos, e os parâmetros que cada um aceita. */
const RECURSOS: {
  [nome: string]: { caminho: string; params: string[]; post?: boolean };
} = {
  ufs: { caminho: "ufs", params: [] },
  municipios: { caminho: "municipios", params: ["uf", "inicio", "limite"] },
  municipio: { caminho: "municipios/:codigo", params: ["uf"] },
  bairros: {
    caminho: "bairros",
    params: ["uf", "municipio", "geometria", "inicio", "limite"],
  },
  setores: {
    caminho: "setores",
    params: ["uf", "municipio", "bairro", "geometria", "inicio", "limite"],
  },
  indicadores: { caminho: "indicadores", params: ["uf", "nivel", "codigo"] },
  catalogo: { caminho: "catalogo", params: [] },
  analise: { caminho: "analise", params: [], post: true },
};

const falhar = (
  res: any,
  status: number,
  codigo: string,
  mensagem: string,
  debugId?: string | null,
) => {
  res.status(status).json({ erro: { codigo, mensagem, debugId: debugId || null } });
};

/** Lê o corpo da requisição, que na Vercel pode vir cru ou já em objeto. */
const lerCorpo = async (req: any) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  const pedacos: Buffer[] = [];
  for await (const pedaco of req) pedacos.push(pedaco);
  if (pedacos.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(pedacos).toString("utf8"));
  } catch {
    return null;
  }
};

export default async function handler(req: any, res: any) {
  const entrada = new URL(req.url || "", "http://localhost").searchParams;
  const nome = String(entrada.get("recurso") || "");
  const recurso = RECURSOS[nome];

  if (!recurso) {
    falhar(
      res,
      400,
      "PARAMETRO_INVALIDO",
      `Recurso desconhecido: ${nome || "(vazio)"}.`,
    );
    return;
  }

  const metodo = recurso.post ? "POST" : "GET";
  if (req.method !== metodo) {
    falhar(
      res,
      405,
      "METODO_NAO_PERMITIDO",
      `Este recurso responde apenas a ${metodo}.`,
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

  // O caminho de um município leva o código embutido; os outros são fixos.
  let caminho = recurso.caminho;
  if (caminho.includes(":codigo")) {
    const codigo = String(entrada.get("codigo") || "");
    if (!/^\d{7}$/.test(codigo)) {
      falhar(
        res,
        400,
        "PARAMETRO_INVALIDO",
        "O código do município tem 7 dígitos.",
      );
      return;
    }
    caminho = caminho.replace(":codigo", codigo);
  }

  const destino = new URL(`${CCO_BASE}/${caminho}`);
  recurso.params.forEach((chave) => {
    const valor = entrada.get(chave);
    if (valor !== null && valor !== "") destino.searchParams.set(chave, valor);
  });

  try {
    const opcoes: any = {
      method: metodo,
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    };

    if (recurso.post) {
      const corpo = await lerCorpo(req);
      if (!corpo || typeof corpo !== "object") {
        falhar(
          res,
          400,
          "PARAMETRO_INVALIDO",
          "Envie a área a analisar no corpo da requisição.",
        );
        return;
      }
      opcoes.headers["Content-Type"] = "application/json";
      opcoes.body = JSON.stringify(corpo);
    }

    const resposta = await fetch(destino, opcoes);
    const texto = await resposta.text();
    const debugId = resposta.headers.get("X-Debug-Id");

    // O debugId vem em toda resposta, e é com ele que o administrador do CCO
    // acha a chamada exata nos registros. Sem ele, suporte vira adivinhação.
    if (debugId) {
      console.log(
        `[territorio] recurso=${nome} status=${resposta.status} debugId=${debugId}`,
      );
      res.setHeader("X-Debug-Id", debugId);
    }

    res
      .status(resposta.status)
      .setHeader("Content-Type", "application/json")
      .send(texto);
  } catch (err: any) {
    const expirou = err?.name === "TimeoutError" || err?.name === "AbortError";
    falhar(
      res,
      expirou ? 504 : 502,
      expirou ? "SERVICO_INDISPONIVEL" : "ERRO_INTERNO",
      expirou
        ? "A consulta ao território demorou demais para responder."
        : `Falha ao consultar o CCO: ${err?.message || err}`,
    );
  }
}
