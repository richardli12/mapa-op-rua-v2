/**
 * Ponte para a API do Nexus.
 *
 * A chave fica só aqui, no servidor. Ela é lida de NEXUS_PUBLIC_API_KEY, a
 * variável já configurada na Vercel, e nunca é enviada ao navegador — o que
 * aconteceria se o front chamasse o Nexus direto, já que tudo que vai para o
 * bundle é público.
 */

const NEXUS_BASE = "https://nexus-v3-1-gules.vercel.app/api/public-api/v1";

/** Só estes caminhos são repassados, para a ponte não virar um proxy aberto. */
const ALLOWED_PATHS = new Set(["candidatos", "partidos"]);

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const apiKey = process.env.NEXUS_PUBLIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "NEXUS_PUBLIC_API_KEY não configurada nas variáveis de ambiente do projeto.",
    });
    return;
  }

  const url = new URL(req.url || "", "http://localhost");
  const path = String(url.searchParams.get("path") || "candidatos");

  if (!ALLOWED_PATHS.has(path)) {
    res.status(400).json({ error: `Caminho não permitido: ${path}` });
    return;
  }

  const page = String(url.searchParams.get("page") || "1");
  const pageSize = String(url.searchParams.get("page_size") || "100");

  try {
    const response = await fetch(
      `${NEXUS_BASE}/${path}?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    const body = await response.text();
    res
      .status(response.status)
      .setHeader("Content-Type", "application/json")
      .send(body);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: `Falha ao consultar o Nexus: ${err?.message || err}` });
  }
}
