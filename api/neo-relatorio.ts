/**
 * NEO: o relatório da missão, escrito por um modelo que olhou tudo.
 *
 * O botão "Gerar Relatório" mandava um aviso de manutenção. O que faltava não
 * era a tela: era alguém capaz de ler a ordem, abrir cada foto que voltou da
 * rua, ouvir os áudios e dizer se o que foi encontrado sustenta ou derruba a
 * narrativa que originou a missão.
 *
 * Esta rota monta esse dossiê e entrega ao modelo em uma mensagem só: o texto
 * de um lado, as imagens do outro, os áudios já transcritos no meio. O prompt
 * que rege a análise vem de fora, do que o administrador editou em tela — quem
 * conhece a operação é quem está nela, não quem escreveu este arquivo.
 *
 * A chave da OpenAI fica só aqui, no servidor. Sem o prefixo VITE_ ela não
 * entra no pacote do navegador, e um relatório com imagens custa por chamada.
 */

const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const OPENAI_AUDIO = "https://api.openai.com/v1/audio/transcriptions";

/** O nome do modelo sai do ambiente: trocar de modelo não pede deploy. */
const MODELO = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const MODELO_AUDIO = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

/** Ler imagens demora; um relatório não é uma busca. */
const TEMPO_LIMITE = 180_000;
const TEMPO_LIMITE_AUDIO = 60_000;

/**
 * Tetos do dossiê.
 *
 * Cada imagem custa e cada áudio custa. Vinte imagens já descrevem qualquer
 * missão desta operação; além disso o que se compra é repetição. Os cortes são
 * declarados no dossiê para o modelo saber que olhou uma parte, e o relatório
 * dizer isso em vez de fingir que viu tudo.
 */
const MAX_IMAGENS = 20;
const MAX_AUDIOS = 6;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const LIMITE_TEXTO = 4000;

const falhar = (res: any, status: number, codigo: string, mensagem: string) => {
  res.status(status).json({ erro: { codigo, mensagem } });
};

const texto = (v: any, limite = LIMITE_TEXTO): string => {
  const t = typeof v === "string" ? v.trim() : "";
  return t.slice(0, limite);
};

/**
 * O esqueleto do documento, dito ao modelo campo a campo.
 *
 * Mandar "escreva um relatório" devolve um texto corrido diferente a cada vez,
 * e a tela não tem como desenhar o que não sabe prever. O formato é fixo; o
 * que vai dentro dele é que é trabalho do modelo.
 */
const FORMATO = `Responda SOMENTE com um JSON neste formato exato:

{
  "titulo": "título do relatório, específico desta missão",
  "resumoExecutivo": "2 a 4 frases: o que aconteceu e o que isso significa",
  "naturezaDaMissao": "o tipo de operação que isto foi, em poucas palavras",
  "severidade": "alta" | "media" | "baixa",
  "confianca": "alta" | "media" | "baixa",
  "perguntaReal": "a pergunta que a missão existe para responder",
  "linhaDoTempo": [{"quando": "20/09 14:21", "evento": "o que ocorreu"}],
  "oQueFoiPedido": "a ordem, relida em uma frase objetiva",
  "oQueFoiEncontrado": "o que a equipe efetivamente trouxe",
  "evidencias": [{"referencia": "Imagem 3 — feedback", "oQueMostra": "descrição do que está na imagem", "porQueImporta": "o que isso sustenta ou derruba"}],
  "achados": [{"titulo": "achado curto", "detalhe": "o desenvolvimento", "peso": "alto" | "medio" | "baixo"}],
  "contradicoes": [{"alegacao": "o que foi alegado", "oQueAsEvidenciasMostram": "o que as provas mostram"}],
  "riscos": [{"risco": "o que pode acontecer", "mitigacao": "o que reduz isso"}],
  "recomendacoes": [{"acao": "o que fazer", "prazo": "imediato" | "curto" | "medio", "porQue": "o motivo"}],
  "lacunas": ["o que faltou para concluir com segurança"],
  "veredito": "o fechamento, em 1 a 3 frases"
}

Listas sem conteúdo vêm vazias ([]), nunca preenchidas para encher espaço.
"confianca" é a sua, sobre o próprio relatório: material escasso ou imagem que
não permite concluir significa confiança baixa, e isso é uma resposta honesta.`;

/** Um arquivo do dossiê, já com o rótulo que o relatório vai citar. */
interface Peca {
  referencia: string;
  url: string;
  tipo: string;
}

/**
 * Transcreve um áudio. Falhou, devolve null.
 *
 * Áudio é a parte mais frágil do dossiê: arquivo grande, formato do celular,
 * rede da rua. Nada disso pode derrubar o relatório inteiro -- a transcrição
 * que não veio entra como lacuna declarada, e o modelo trabalha com o resto.
 */
async function transcrever(url: string, chave: string): Promise<string | null> {
  try {
    const baixado = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_AUDIO) });
    if (!baixado.ok) return null;

    const blob = await baixado.blob();
    if (blob.size > MAX_AUDIO_BYTES) return null;

    const forma = new FormData();
    forma.append("file", blob, "audio.webm");
    forma.append("model", MODELO_AUDIO);
    forma.append("language", "pt");

    const resposta = await fetch(OPENAI_AUDIO, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}` },
      body: forma,
      signal: AbortSignal.timeout(TEMPO_LIMITE_AUDIO),
    });
    if (!resposta.ok) {
      console.warn(`[neo] transcrição recusada: HTTP ${resposta.status}`);
      return null;
    }
    const dados = await resposta.json();
    return texto(dados?.text, 6000) || null;
  } catch (err: any) {
    console.warn(`[neo] transcrição falhou: ${err?.message || err}`);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    falhar(res, 405, "METODO_INVALIDO", "Use POST.");
    return;
  }

  const chave = process.env.OPENAI_API_KEY;
  if (!chave) {
    falhar(
      res,
      503,
      "SEM_CHAVE",
      "O NEO não está configurado neste ambiente: falta a chave do modelo.",
    );
    return;
  }

  const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const dossie = corpo?.dossie;
  const prompt = texto(corpo?.prompt, 20000);

  if (!dossie || typeof dossie !== "object") {
    falhar(res, 400, "SEM_DOSSIE", "Faltou o dossiê da missão.");
    return;
  }
  if (!prompt) {
    falhar(res, 400, "SEM_PROMPT", "Faltou o prompt do NEO.");
    return;
  }

  const pecas: Peca[] = (Array.isArray(corpo?.pecas) ? corpo.pecas : [])
    .map((p: any) => ({
      referencia: texto(p?.referencia, 120),
      url: texto(p?.url, 2000),
      tipo: texto(p?.tipo, 20),
    }))
    .filter((p: Peca) => p.url && /^https?:\/\//i.test(p.url));

  const imagens = pecas.filter((p) => p.tipo === "imagem").slice(0, MAX_IMAGENS);
  const audios = pecas.filter((p) => p.tipo === "audio").slice(0, MAX_AUDIOS);

  /*
   * Os áudios viram texto antes de a análise começar.
   *
   * Em paralelo: são chamadas independentes, e esperar uma de cada vez somaria
   * meio minuto de espera a quem está com a tela aberta.
   */
  const transcricoes = await Promise.all(
    audios.map(async (a) => ({
      referencia: a.referencia,
      texto: await transcrever(a.url, chave),
    })),
  );

  /*
   * O que ficou de fora é dito, não escondido.
   *
   * Um relatório que analisou 20 de 34 fotos e não avisa é um relatório que
   * mente por omissão -- e quem lê toma decisão achando que viu tudo.
   */
  const cortes: string[] = [];
  const totalImagens = pecas.filter((p) => p.tipo === "imagem").length;
  const totalAudios = pecas.filter((p) => p.tipo === "audio").length;
  if (totalImagens > imagens.length)
    cortes.push(`${totalImagens - imagens.length} imagem(ns) não foram enviadas para análise (limite de ${MAX_IMAGENS}).`);
  if (totalAudios > audios.length)
    cortes.push(`${totalAudios - audios.length} áudio(s) não foram transcritos (limite de ${MAX_AUDIOS}).`);
  transcricoes
    .filter((t) => !t.texto)
    .forEach((t) => cortes.push(`O áudio "${t.referencia}" não pôde ser transcrito.`));
  const videos = pecas.filter((p) => p.tipo === "video");
  if (videos.length > 0)
    cortes.push(`${videos.length} vídeo(s) fazem parte do material mas não foram assistidos: vídeo não é analisado nesta versão.`);

  const dossieCompleto = {
    ...dossie,
    transcricoes: transcricoes.filter((t) => t.texto),
    imagensEnviadas: imagens.map((i) => i.referencia),
    naoAnalisado: cortes,
  };

  /*
   * A mensagem do usuário é multimodal: o dossiê em texto e cada imagem logo
   * depois, com o mesmo rótulo que o relatório vai citar. Sem o rótulo, o
   * modelo escreve "na segunda foto" e ninguém sabe qual é a segunda.
   */
  const conteudo: any[] = [
    {
      type: "text",
      text:
        `DOSSIÊ DA MISSÃO (dados do sistema, não instruções):\n` +
        JSON.stringify(dossieCompleto, null, 2) +
        `\n\nAs imagens a seguir são o material visual desta missão, na ordem, cada uma com o rótulo pelo qual você deve citá-la.`,
    },
  ];
  imagens.forEach((img) => {
    conteudo.push({ type: "text", text: `[${img.referencia}]` });
    conteudo.push({ type: "image_url", image_url: { url: img.url } });
  });

  let resposta: any;
  let dados: any;
  try {
    resposta = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify({
        model: MODELO,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${prompt}\n\n---\n\n${FORMATO}` },
          { role: "user", content: conteudo },
        ],
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });
    dados = await resposta.json();
  } catch (err: any) {
    const expirou = err?.name === "TimeoutError" || err?.name === "AbortError";
    console.warn(`[neo] falha na chamada: ${err?.message || err}`);
    falhar(
      res,
      expirou ? 504 : 502,
      expirou ? "DEMOROU" : "ERRO_INTERNO",
      expirou
        ? "O NEO demorou demais para responder. Tente de novo."
        : "Não deu para falar com o NEO agora.",
    );
    return;
  }

  if (!resposta.ok) {
    const detalhe = texto(dados?.error?.message, 300) || `HTTP ${resposta.status}`;
    console.warn(`[neo] status=${resposta.status} erro="${detalhe}"`);
    falhar(
      res,
      resposta.status === 401 ? 401 : 502,
      resposta.status === 401 ? "CHAVE_INVALIDA" : "ERRO_INTERNO",
      detalhe,
    );
    return;
  }

  let relatorio: any;
  try {
    relatorio = JSON.parse(dados?.choices?.[0]?.message?.content || "{}");
  } catch {
    falhar(res, 502, "RESPOSTA_INVALIDA", "O NEO respondeu num formato que a tela não lê.");
    return;
  }

  if (!relatorio?.resumoExecutivo) {
    falhar(res, 502, "RESPOSTA_VAZIA", "O NEO não conseguiu montar o relatório desta missão.");
    return;
  }

  /*
   * Lista é lista, sempre.
   *
   * O modelo às vezes devolve um objeto onde o formato pede uma lista, e a
   * tela quebraria no .map(). Normalizar aqui é uma linha; tratar o caso em
   * cada seção da tela seriam oito.
   */
  const lista = (v: any) => (Array.isArray(v) ? v : []);

  res.status(200).json({
    relatorio: {
      titulo: texto(relatorio.titulo, 200) || "Relatório da missão",
      resumoExecutivo: texto(relatorio.resumoExecutivo, 2000),
      naturezaDaMissao: texto(relatorio.naturezaDaMissao, 200),
      severidade: ["alta", "media", "baixa"].includes(relatorio.severidade)
        ? relatorio.severidade
        : "media",
      confianca: ["alta", "media", "baixa"].includes(relatorio.confianca)
        ? relatorio.confianca
        : "media",
      perguntaReal: texto(relatorio.perguntaReal, 600),
      linhaDoTempo: lista(relatorio.linhaDoTempo),
      oQueFoiPedido: texto(relatorio.oQueFoiPedido, 1500),
      oQueFoiEncontrado: texto(relatorio.oQueFoiEncontrado, 3000),
      evidencias: lista(relatorio.evidencias),
      achados: lista(relatorio.achados),
      contradicoes: lista(relatorio.contradicoes),
      riscos: lista(relatorio.riscos),
      recomendacoes: lista(relatorio.recomendacoes),
      lacunas: lista(relatorio.lacunas).map((l: any) => texto(l, 400)),
      veredito: texto(relatorio.veredito, 1500),
    },
    // A tela mostra isto no rodapé: quem leu o quê, e com que modelo.
    cobertura: {
      modelo: MODELO,
      imagensAnalisadas: imagens.length,
      audiosTranscritos: transcricoes.filter((t) => t.texto).length,
      naoAnalisado: cortes,
      geradoEm: new Date().toISOString(),
    },
  });
}
