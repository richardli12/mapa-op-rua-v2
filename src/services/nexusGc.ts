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

/**
 * DOIS RÓTULOS NOSSOS, PARA DUAS PERGUNTAS DIFERENTES.
 *
 * `referencia` AGRUPA: "quais missões saíram desta ordem?". Repete à vontade —
 * uma ordem pode ser despachada mais de uma vez, e todas carregam a mesma.
 *
 * `id_externo` APONTA: "qual missão do Nexu-GC é ESTE envio?". Vale para um
 * envio só, e é por ele que se descobre, depois de uma resposta perdida no
 * caminho, se a missão entrou ou não.
 *
 * Nenhum dos dois aparece para a equipe: ficam no banco do Nexu-GC, e voltam
 * nas respostas desta API.
 */
export const referenciaDaMissao = (tipo: string, id: string) =>
  `mapa-op-rua:${tipo}:${id}`;

/**
 * O id deste envio, gerado aqui.
 *
 * Carrega a ordem de origem por inteiro — para ler o rótulo e saber de onde
 * ele veio, sem consultar nada — e termina num sufixo aleatório, que é o que
 * separa dois despachos da mesma ordem.
 *
 * O alfabeto não tem I, O, 0 nem 1: este texto vai ser lido em voz alta e
 * digitado à mão em algum suporte, e é ali que "O" vira zero.
 */
export function novoIdExterno(tipo: string, id: string): string {
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const sorteio = new Uint8Array(6);
  crypto.getRandomValues(sorteio);
  const sufixo = Array.from(sorteio)
    .map((n) => ALFABETO[n % ALFABETO.length])
    .join('');
  return `MOR-${tipo.toUpperCase()}-${id}-${sufixo}`.slice(0, 200);
}

/**
 * Esta missão do Nexu-GC saiu DESTA ordem?
 *
 * A pergunta é respondida pelo id do envio, não pelo rótulo de agrupamento: o
 * id carrega a ordem de origem por inteiro, e é ele que amarra uma coisa à
 * outra. Missão sem id nosso não é desta ordem — pode ser de qualquer outra
 * origem que use a mesma chave.
 */
export const ehDaOrdem = (
  idExterno: string | null | undefined,
  tipo: string,
  id: string,
) => Boolean(idExterno) && idExterno!.startsWith(`MOR-${tipo.toUpperCase()}-${id}-`);

export type PrioridadeDoNexus = "baixa" | "normal" | "alta" | "critica";

/**
 * A foto de um cadastro do Nexu-GC.
 *
 * É URL ASSINADA, e expira em cerca de uma hora. O bucket é privado e não
 * existe endereço fixo de foto neste produto — então ela serve para mostrar
 * agora, nunca para guardar. Gravada em algum lugar, vira imagem quebrada
 * algumas horas depois, e quem olha não tem como saber se o cadastro perdeu a
 * foto ou se o endereço venceu.
 *
 * Aqui ela só existe em memória, enquanto o bloco está aberto — e toda parte
 * que a mostra cai nas iniciais quando o endereço não responde.
 */
export type FotoDoNexus = string | null;

export interface ClienteDoNexus {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  foto_url: FotoDoNexus;
}

export interface TimeDoNexus {
  id: string;
  nome: string;
  descricao: string | null;
  membros_ativos: number;
  foto_url: FotoDoNexus;
}

export interface DestinatarioDoNexus {
  id: string;
  nome: string;
  telefone: string | null;
  /** Quando a pessoa entrou no sistema pela última vez; `null` é nunca. */
  ultimo_acesso: string | null;
  foto_url: FotoDoNexus;
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
  cliente: { id: string; nome: string; foto_url?: FotoDoNexus };
  time: { id: string; nome: string; foto_url?: FotoDoNexus };
  referencia: string | null;
  /** O id que este sistema deu ao envio. Só o banco do Nexu-GC o vê. */
  id_externo: string | null;
  criada_em: string;
  publicada_em: string | null;
  cancelada_em: string | null;
  /** Na listagem vem só o total; no detalhe, a lista inteira. */
  materiais?: { total: number; itens?: unknown[] };
  /**
   * Calculado NA LEITURA, contra o instante da chamada.
   *
   * Não existe coluna "atrasada" esperando alguém virar uma chave: um minuto
   * depois do prazo, a resposta já diz `true`.
   */
  atrasada?: boolean;
  prazo_restante_segundos?: number | null;
  progresso?: {
    total: number;
    visualizados: number;
    iniciados: number;
    concluidos: number;
    percentual: number;
  };
  destinatarios: {
    total: number;
    visualizados?: number;
    iniciados?: number;
    concluidos: number;
    itens: DestinatarioDaMissao[];
  };
}

/**
 * O andamento de UMA pessoa na missão.
 *
 * A missão tem o estado dela e cada pessoa tem o seu: uma concluir não conclui
 * a das outras. O que existe é quantas concluíram.
 *
 * Os booleanos vêm junto com os carimbos de propósito — para ninguém precisar
 * deduzir "já viu?" comparando datas com nulo.
 */
export interface DestinatarioDaMissao {
  id: string;
  /** Id deste vínculo pessoa+missão. */
  atribuicao_id?: string;
  nome: string;
  telefone?: string | null;
  foto_url?: FotoDoNexus;
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  recebida_em?: string | null;
  visualizada?: boolean;
  vista_em?: string | null;
  iniciada?: boolean;
  iniciada_em?: string | null;
  concluida?: boolean;
  concluida_em: string | null;
  concluida_com_atraso?: boolean;
  /**
   * O que a pessoa ESCREVEU ao concluir.
   *
   * É o que responde "o que ela entregou?". Com `feedback_obrigatorio`, nunca
   * vem vazio numa conclusão: sem o texto, o membro não consegue concluir.
   */
  resultado?: string | null;
  pontos_creditados: number;
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
    /** Só quando não for o par GET/POST que o corpo já decide. */
    metodo?: "PUT";
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
      method: opcoes.metodo || (opcoes.corpo !== undefined ? "POST" : "GET"),
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
      time: { id: string; nome: string; cliente_id: string; foto_url?: FotoDoNexus };
      destinatarios: DestinatarioDoNexus[];
    };
    meta: { total: number };
  }>("destinatarios", { params: { time } });

/** As missões que ESTA chave criou com um rótulo nosso. */
export const lerMissoesPorReferencia = (referencia: string) =>
  chamar<{ data: MissaoDoNexus[]; meta: { total: number } }>("missoes", {
    params: { minhas: "true", referencia, por_pagina: 100 },
  });

/**
 * A missão deste envio, se ela existe.
 *
 * É a pergunta que o manual do Nexu-GC manda fazer antes de reenviar: não há
 * proteção contra duplicado, e uma resposta perdida no caminho não significa
 * que a missão não entrou. Aqui ela é feita sozinha, antes de qualquer
 * segunda tentativa — repetir às cegas mandaria a mesma ordem duas vezes para
 * a equipe.
 */
export const lerMissaoPorIdExterno = async (idExterno: string) => {
  const resposta = await chamar<{ data: MissaoDoNexus[] }>("missoes", {
    params: { minhas: "true", id_externo: idExterno, por_pagina: 5 },
  });
  return resposta.data?.[0] || null;
};

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
  id_externo?: string;
}

export const criarMissao = (missao: NovaMissaoDoNexus) =>
  chamar<{ data: MissaoDoNexus }>("criar", { corpo: missao });

/**
 * Muda o que já foi mandado — só o que vier no corpo.
 *
 * A edição do Nexu-GC é PARCIAL, e isso é uma proteção: corrigir o prazo não
 * exige reenviar título e descrição, e mandar o objeto inteiro "para garantir"
 * é justamente o que apaga conteúdo sem intenção. Então aqui só entra o campo
 * que mudou.
 *
 * Duas regras de lá que valem lembrar: prazo novo precisa estar no futuro (para
 * encerrar existe o cancelar), e mexer nos pontos não tira o que já foi
 * creditado a quem concluiu — o valor novo vale para as conclusões seguintes.
 */
export const editarMissao = (missao: string, mudancas: MudancasDaMissao) =>
  chamar<{ data: MissaoDoNexus }>("editar", {
    params: { missao },
    corpo: mudancas,
    metodo: "PUT",
  });

export interface MudancasDaMissao {
  titulo?: string;
  descricao?: string;
  prioridade?: PrioridadeDoNexus;
  pontos?: number;
  prazo?: string;
  prazo_hora?: string;
  feedback_obrigatorio?: boolean;
}

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
