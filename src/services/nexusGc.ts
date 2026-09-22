/**
 * Nexu-GC, do lado do navegador.
 *
 * Fala com `/api/nexus-gc`, que é quem tem a chave. Nada aqui conhece o
 * endereço do Nexu-GC nem o `Bearer` — e é assim que tem de ser: a chave cria
 * e cancela missões de qualquer cliente, e no bundle ela estaria publicada.
 *
 * O QUE O MANUAL DO NEXU-GC PEDE, E QUE VALE PARA QUEM CONSOME:
 *
 * - São três chamadas até criar: cliente, time, destinatários. Id inventado ou
 *   vindo de outra origem é recusado — e cliente bloqueado, time inativo e
 *   membro desligado simplesmente não aparecem nessas listas, o que já protege
 *   quem usa só o que elas devolvem.
 * - A criação é tudo-ou-nada: um destinatário fora do time derruba a chamada
 *   inteira, e nada é criado.
 * - NÃO HÁ PROTEÇÃO CONTRA ENVIO DUPLICADO. Requisição que estourou o tempo
 *   pode ter criado a missão; repetir cria a segunda. É para isso que existe
 *   `referencia` — um rótulo nosso, invisível para a equipe, que permite
 *   perguntar "já mandei esta?" antes de mandar de novo.
 */

/** O rótulo que liga uma missão do Nexu-GC à ordem daqui. */
export const referenciaDaMissao = (tipo: string, id: string) =>
  `mapa-op-rua:${tipo}:${id}`;

export type PrioridadeDoNexus = "baixa" | "normal" | "alta" | "critica";

export interface ClienteDoNexus {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

export interface TimeDoNexus {
  id: string;
  nome: string;
  descricao: string | null;
  membros_ativos: number;
}

export interface DestinatarioDoNexus {
  id: string;
  nome: string;
  telefone: string | null;
  /** Quando a pessoa entrou no sistema pela última vez; `null` é nunca. */
  ultimo_acesso: string | null;
}

export interface MissaoDoNexus {
  id: string;
  status: "rascunho" | "publicada" | "cancelada" | "arquivada";
  titulo: string;
  descricao: string;
  prioridade: PrioridadeDoNexus;
  pontos: number;
  prazo: string;
  feedback_obrigatorio: boolean;
  cliente: { id: string; nome: string };
  time: { id: string; nome: string };
  referencia: string | null;
  criada_em: string;
  publicada_em: string | null;
  cancelada_em: string | null;
  /** Na listagem vem só o total; no detalhe, a lista inteira. */
  materiais?: { total: number; itens?: unknown[] };
  destinatarios: {
    total: number;
    concluidos: number;
    itens: {
      id: string;
      nome: string;
      status: "pendente" | "em_andamento" | "concluida" | "cancelada";
      concluida_em: string | null;
      pontos_creditados: number;
    }[];
  };
}

/** O erro do Nexu-GC, já no formato que a tela mostra. */
export interface ErroDoNexus {
  code: string;
  message: string;
  campo: string | null;
  /** Ids recusados quando a criação cai por causa de destinatário. */
  destinatariosRecusados?: string[];
}

/** Recados nossos para os códigos que o manual define. */
const RECADOS: { [code: string]: string } = {
  missing_api_key:
    "O acesso ao Nexu-GC não está configurado neste ambiente. Fale com o administrador.",
  invalid_api_key:
    "O Nexu-GC não aceitou a chave deste sistema. Ela pode ter sido revogada.",
  not_found: "Este cliente, time ou missão não existe mais no Nexu-GC.",
  conflict:
    "O Nexu-GC recusou: cliente bloqueado, time inativo, ou a missão já está num estado que não permite isso.",
  payload_too_large: "A descrição ficou grande demais para uma chamada só.",
  timeout:
    "O Nexu-GC demorou demais para responder. Confira se a missão entrou antes de mandar de novo.",
  internal_error: "O Nexu-GC falhou. Tente de novo em instantes.",
};

async function chamar<T>(
  recurso: string,
  opcoes: {
    params?: { [chave: string]: string | number | boolean | undefined };
    corpo?: any;
  } = {},
): Promise<T> {
  const url = new URL("/api/nexus-gc", window.location.origin);
  url.searchParams.set("recurso", recurso);
  Object.entries(opcoes.params || {}).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, String(valor));
    }
  });

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: opcoes.corpo !== undefined ? "POST" : "GET",
      headers: opcoes.corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err: any) {
    const erro: ErroDoNexus = {
      code: err?.name === "TimeoutError" ? "timeout" : "internal_error",
      message:
        err?.name === "TimeoutError"
          ? RECADOS.timeout
          : "Não deu para falar com o Nexu-GC agora.",
      campo: null,
    };
    throw erro;
  }

  const bruto = await resposta.text();
  let corpo: any = null;
  try {
    corpo = bruto ? JSON.parse(bruto) : null;
  } catch {
    // Resposta que não é JSON só acontece quando algo quebrou no caminho.
  }

  if (!resposta.ok) {
    const code = corpo?.error?.code || "internal_error";
    const erro: ErroDoNexus = {
      code,
      /*
       * A mensagem do Nexu-GC manda quando ela é específica.
       *
       * Em `validation_error` ela diz exatamente o campo e os valores aceitos
       * — trocar isso por uma frase nossa seria apagar a única informação que
       * resolve o problema. Nos códigos genéricos, o recado nosso explica
       * melhor o que fazer.
       */
      message:
        code === "validation_error"
          ? corpo?.error?.message || "O Nexu-GC recusou os dados enviados."
          : RECADOS[code] || corpo?.error?.message || "O Nexu-GC recusou a chamada.",
      campo: corpo?.error?.campo ?? null,
      destinatariosRecusados: corpo?.error?.destinatarios_recusados || corpo?.destinatarios_recusados,
    };
    throw erro;
  }

  return corpo as T;
}

/** Confere se a chave está configurada e vale. */
export const conferirAcesso = () => chamar<{ data?: any }>("raiz");

export const lerClientes = (busca?: string) =>
  chamar<{ data: ClienteDoNexus[]; meta: { total: number } }>("clientes", {
    params: { busca },
  });

export const lerTimes = (cliente: string) =>
  chamar<{ data: TimeDoNexus[]; meta: { total: number } }>("times", {
    params: { cliente },
  });

export const lerDestinatarios = (time: string) =>
  chamar<{
    data: {
      time: { id: string; nome: string; cliente_id: string };
      destinatarios: DestinatarioDoNexus[];
    };
    meta: { total: number };
  }>("destinatarios", { params: { time } });

/** As missões que ESTA chave criou com um rótulo nosso. */
export const lerMissoesPorReferencia = (referencia: string) =>
  chamar<{ data: MissaoDoNexus[]; meta: { total: number } }>("missoes", {
    params: { minhas: "true", referencia, por_pagina: 100 },
  });

export const lerMissao = (missao: string) =>
  chamar<{ data: MissaoDoNexus }>("missao", { params: { missao } });

export interface NovaMissaoDoNexus {
  cliente_id: string;
  time_id: string;
  titulo: string;
  descricao: string;
  prioridade?: PrioridadeDoNexus;
  pontos: number;
  /** "2026-09-30", "2026-09-30T18:00" (horário de Maceió) ou ISO com fuso. */
  prazo: string;
  prazo_hora?: string;
  feedback_obrigatorio?: boolean;
  destinatarios?: string[];
  todos_do_time?: boolean;
  /** `false` cria rascunho — e aí destinatários são proibidos aqui. */
  publicar?: boolean;
  referencia?: string;
}

export const criarMissao = (missao: NovaMissaoDoNexus) =>
  chamar<{ data: MissaoDoNexus }>("criar", { corpo: missao });

export const cancelarMissao = (missao: string) =>
  chamar<{ data: MissaoDoNexus }>("cancelar", { params: { missao }, corpo: {} });

/* ====================================================== material de apoio === */

/**
 * O material de apoio não vai no corpo da criação.
 *
 * A missão nasce primeiro e o arquivo é anexado a ela pelo id — e a ordem que
 * o manual do Nexu-GC recomenda é rascunho → material → publicar, para que
 * ninguém abra a missão antes do arquivo que ela exige estar lá.
 */
export interface MaterialDoNexus {
  id: string;
  /** O que o membro vê na tela ("PDF 1"), e não o nome do arquivo enviado. */
  rotulo: string;
  tipo: string;
  formato: string;
  tamanho_bytes: number;
  tamanho: string;
  criado_em: string;
  /** Temporária, de 10 minutos: serve para conferir, não como link fixo. */
  url: string | null;
}

/** Formatos que o Nexu-GC aceita, no formato do atributo `accept`. */
export const FORMATOS_DE_MATERIAL =
  'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

/** Teto do produto: 200 MB por arquivo. */
export const TAMANHO_MAXIMO_DE_MATERIAL = 200 * 1024 * 1024;

/**
 * O caminho por dentro da nossa função só vale para arquivo pequeno.
 *
 * A hospedagem recusa corpo acima de ~4 MB, e essa recusa acontece antes do
 * nosso código rodar. Por isso o envio direto ao Storage é o caminho normal, e
 * este é a reserva.
 */
const TETO_DO_CAMINHO_RESERVA = 4 * 1024 * 1024;

interface UrlAssinada {
  url_envio: string;
  metodo: string;
  cabecalhos: { [chave: string]: string };
  caminho: string;
  expira_em_minutos: number;
}

/**
 * Anexa um arquivo à missão.
 *
 * O CAMINHO NORMAL NÃO PASSA PELO NOSSO SERVIDOR. Pedimos ao Nexu-GC uma URL
 * assinada, o navegador manda o arquivo direto para o Storage e depois só
 * registramos o caminho. Assim o arquivo não atravessa a nossa função — que
 * tem teto de corpo — e o limite volta a ser o do produto, 200 MB.
 *
 * A URL assinada não é a nossa chave: ela vale para um caminho só, por duas
 * horas. Mandá-la ao navegador não expõe nada além daquele envio.
 *
 * Quando o envio direto não acontece — o Storage pode recusar a chamada vinda
 * do navegador —, o arquivo pequeno ainda vai pela nossa função. "Não deu para
 * anexar" não pode ser a resposta enquanto existir um caminho que funciona.
 */
export async function anexarMaterial(
  missao: string,
  arquivo: File,
): Promise<MaterialDoNexus> {
  const assinatura = await chamar<{ data: UrlAssinada }>("material-url", {
    params: { missao },
    corpo: { nome_arquivo: arquivo.name },
  });

  const envio = assinatura.data;
  let subiu = false;
  try {
    const resposta = await fetch(envio.url_envio, {
      method: envio.metodo || "PUT",
      headers: envio.cabecalhos || undefined,
      body: arquivo,
    });
    subiu = resposta.ok;
  } catch {
    // Storage inalcançável do navegador: cai na reserva logo abaixo.
  }

  if (subiu) {
    const registro = await chamar<{ data: MaterialDoNexus }>("material-registrar", {
      params: { missao },
      corpo: { caminho: envio.caminho, nome_arquivo: arquivo.name },
    });
    return registro.data;
  }

  if (arquivo.size > TETO_DO_CAMINHO_RESERVA) {
    const erro: ErroDoNexus = {
      code: "upload_failed",
      message: `Não deu para enviar "${arquivo.name}" direto para o Nexu-GC, e ele é grande demais para o caminho alternativo (acima de 4 MB).`,
      campo: "arquivo",
    };
    throw erro;
  }

  const pacote = new FormData();
  pacote.append("arquivo", arquivo, arquivo.name);
  pacote.append("nome_arquivo", arquivo.name);

  const url = new URL("/api/nexus-gc", window.location.origin);
  url.searchParams.set("recurso", "material-arquivo");
  url.searchParams.set("missao", missao);

  // Sem `Content-Type` à mão de propósito: o navegador escreve a fronteira do
  // multipart nele, e uma fronteira escrita por nós não bateria com o corpo.
  const resposta = await fetch(url, { method: "POST", body: pacote });
  const bruto = await resposta.text();
  let corpo: any = null;
  try {
    corpo = bruto ? JSON.parse(bruto) : null;
  } catch {
    // Resposta que não é JSON só acontece quando algo quebrou no caminho.
  }
  if (!resposta.ok) {
    const erro: ErroDoNexus = {
      code: corpo?.error?.code || "internal_error",
      message:
        corpo?.error?.message ||
        `Não deu para anexar "${arquivo.name}" ao Nexu-GC.`,
      campo: corpo?.error?.campo ?? null,
    };
    throw erro;
  }
  return corpo.data as MaterialDoNexus;
}

/** Publica um rascunho, escolhendo quem recebe. */
export const publicarMissao = (
  missao: string,
  para: { destinatarios?: string[]; todos_do_time?: boolean },
) => chamar<{ data: MissaoDoNexus }>("publicar", { params: { missao }, corpo: para });

/** O que já está anexado a uma missão, com URL temporária para conferir. */
export const lerMateriais = (missao: string) =>
  chamar<{ data: MaterialDoNexus[]; meta?: { total: number } }>("materiais", {
    params: { missao },
  });
