/**
 * Ponte para a API pública do Nexu-GC.
 *
 * A DECISÃO QUE EXPLICA ESTE ARQUIVO: a chave do Nexu-GC não pode chegar ao
 * navegador. O manual dela é explícito — "é um segredo de servidor para
 * servidor" — e a razão é dura: quem tem a chave cria e cancela missões de
 * QUALQUER cliente do Nexu-GC, não só do nosso. Uma chave dessas embutida no
 * bundle é uma chave publicada: basta abrir as ferramentas do navegador.
 *
 * Então a tela nunca fala com o Nexu-GC. Ela fala com esta rota, que mora no
 * servidor, guarda a chave em variável de ambiente e só sabe fazer as oito
 * chamadas que o fluxo precisa. Um parâmetro que não está na lista não
 * atravessa, e não existe repasse de caminho livre — senão a ponte viraria um
 * proxy aberto para a API inteira, com a nossa chave.
 *
 * É o mesmo desenho de `api/territorio.ts`, de propósito: dois jeitos
 * diferentes de esconder chave no mesmo projeto é um deles envelhecer errado.
 *
 * Configure `NEXUS_GC_API_KEY` no ambiente (a chave começa com `nxs_live_`).
 * `NEXUS_GC_BASE_URL` existe para apontar para outro ambiente sem mexer no
 * código; sem ela vale a URL de produção do manual.
 */

const BASE_PADRAO =
  "https://706161646d.74696d656f7065726163696f6e616c63636f.online/api/publica/v1";

/** A carga é leve; 30 s já é folga sobre qualquer resposta normal. */
const TEMPO_LIMITE = 30_000;

type Consulta = { [chave: string]: string };

/** Os recursos atendidos, e nada além deles. */
const RECURSOS: {
  [nome: string]: {
    metodo: "GET" | "POST";
    /** Monta o caminho no Nexu-GC a partir dos parâmetros de rota. */
    caminho: (q: Consulta) => string;
    /** Parâmetros de rota obrigatórios, validados como UUID. */
    exige?: string[];
    /** Parâmetros de consulta repassados. Fora desta lista, nada passa. */
    params?: string[];
  };
} = {
  raiz: { metodo: "GET", caminho: () => "" },
  clientes: { metodo: "GET", caminho: () => "/clientes", params: ["busca"] },
  times: {
    metodo: "GET",
    caminho: (q) => `/clientes/${q.cliente}/times`,
    exige: ["cliente"],
  },
  destinatarios: {
    metodo: "GET",
    caminho: (q) => `/times/${q.time}/destinatarios`,
    exige: ["time"],
  },
  missoes: {
    metodo: "GET",
    caminho: () => "/missoes",
    params: [
      "minhas",
      "referencia",
      "cliente_id",
      "time_id",
      "status",
      "prioridade",
      "pagina",
      "por_pagina",
    ],
  },
  missao: {
    metodo: "GET",
    caminho: (q) => `/missoes/${q.missao}`,
    exige: ["missao"],
  },
  criar: { metodo: "POST", caminho: () => "/missoes" },
  cancelar: {
    metodo: "POST",
    caminho: (q) => `/missoes/${q.missao}/cancelar`,
    exige: ["missao"],
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O erro sai no formato do próprio Nexu-GC.
 *
 * A tela trata uma forma só de erro, venha ela de lá ou daqui. Dois formatos
 * significariam dois caminhos de tratamento, e o segundo é sempre o que
 * ninguém testa.
 */
const falhar = (
  res: any,
  status: number,
  code: string,
  message: string,
  campo?: string,
) => {
  res.status(status).json({ error: { code, message, campo: campo || null } });
};

/** Lê o corpo, que na Vercel pode vir cru ou já em objeto. */
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
      "validation_error",
      `Recurso desconhecido: ${nome || "(vazio)"}.`,
      "recurso",
    );
    return;
  }

  if (req.method !== recurso.metodo) {
    falhar(
      res,
      405,
      "method_not_allowed",
      `Este recurso responde apenas a ${recurso.metodo}.`,
    );
    return;
  }

  const apiKey = process.env.NEXUS_GC_API_KEY;
  if (!apiKey) {
    falhar(
      res,
      500,
      "missing_api_key",
      "NEXUS_GC_API_KEY não está configurada neste ambiente. Fale com o administrador do sistema.",
    );
    return;
  }

  /*
   * Id de rota só entra validado.
   *
   * Sem isto, um `cliente` com barra dentro montaria outro caminho no
   * Nexu-GC — e a ponte, que existe justamente para expor oito chamadas e não
   * a API inteira, passaria a expor o que quem chamou escrevesse.
   */
  const rota: Consulta = {};
  for (const chave of recurso.exige || []) {
    const valor = String(entrada.get(chave) || "");
    if (!UUID.test(valor)) {
      falhar(
        res,
        400,
        "validation_error",
        `O parâmetro "${chave}" precisa ser um id do Nexu-GC.`,
        chave,
      );
      return;
    }
    rota[chave] = valor;
  }

  const base = process.env.NEXUS_GC_BASE_URL || BASE_PADRAO;
  const destino = new URL(`${base}${recurso.caminho(rota)}`);
  for (const chave of recurso.params || []) {
    const valor = entrada.get(chave);
    if (valor !== null && valor !== "") destino.searchParams.set(chave, valor);
  }

  try {
    const opcoes: any = {
      method: recurso.metodo,
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    };

    if (recurso.metodo === "POST") {
      /*
       * "cancelar" não leva corpo; "criar" leva o da missão. Repassamos o que
       * a tela mandou sem reescrever campo nenhum: a validação de verdade é a
       * do Nexu-GC, e duplicá-la aqui só criaria duas regras para divergirem.
       */
      if (nome === "criar") {
        const corpo = await lerCorpo(req);
        if (!corpo || typeof corpo !== "object") {
          falhar(
            res,
            400,
            "validation_error",
            "Envie os dados da missão no corpo da requisição.",
          );
          return;
        }
        opcoes.headers["Content-Type"] = "application/json";
        opcoes.body = JSON.stringify(corpo);
      }
    }

    const resposta = await fetch(destino, opcoes);
    const texto = await resposta.text();

    // O caminho entra no registro; a chave, nunca.
    console.log(`[nexus-gc] recurso=${nome} status=${resposta.status}`);

    res
      .status(resposta.status)
      .setHeader("Content-Type", "application/json")
      .send(texto);
  } catch (err: any) {
    const expirou = err?.name === "TimeoutError" || err?.name === "AbortError";
    falhar(
      res,
      expirou ? 504 : 502,
      expirou ? "timeout" : "internal_error",
      expirou
        ? "O Nexu-GC demorou demais para responder. Confira em seguida se a missão entrou antes de mandar de novo."
        : `Falha ao falar com o Nexu-GC: ${err?.message || err}`,
    );
  }
}
