import { createHmac } from "node:crypto";

/**
 * HMAC do IP publico de quem chamou.
 *
 * O IP so existe aqui, no servidor: a pagina nunca ve o proprio IP publico, e
 * ele tambem nao pode ser gravado como esta -- e dado pessoal. O que volta e um
 * HMAC, que serve para comparar acessos entre si sem guardar o endereco.
 *
 * Sem DEVICE_IP_HMAC_KEY configurada, nada e calculado e a resposta vem vazia:
 * hash de IP sem chave secreta e reversivel por forca bruta em minutos, porque
 * o universo de enderecos e pequeno.
 */
export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const chave = process.env.DEVICE_IP_HMAC_KEY;
  if (!chave) {
    res.status(200).json({ ipHash: null, configured: false });
    return;
  }

  const encaminhado = String(req.headers["x-forwarded-for"] || "");
  const ip =
    encaminhado.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "";

  if (!ip) {
    res.status(200).json({ ipHash: null, configured: true });
    return;
  }

  const ipHash = createHmac("sha256", chave).update(String(ip)).digest("hex");
  res.status(200).json({ ipHash, configured: true });
}
