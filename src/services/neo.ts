/**
 * O dossiê que vai para o NEO, montado no navegador.
 *
 * Quem fala com o modelo é /api/neo-relatorio — a chave é de servidor. O
 * trabalho daqui é outro, e é o que decide a qualidade do relatório: reunir
 * num pacote só o que hoje está espalhado por quatro cantos do card (a ordem,
 * o material de apoio, o que a equipe trouxe, o que circulou por fora) e dar
 * a cada arquivo um rótulo estável.
 *
 * O rótulo importa mais do que parece. Sem ele o modelo escreve "na terceira
 * foto vê-se o asfalto rompido" e quem lê o relatório não tem como saber qual
 * é a terceira foto. Com ele, cada afirmação do relatório aponta para uma peça
 * que existe no card, com o mesmo nome nos dois lugares.
 */

import type { RelatorioDoNeo } from '../neo';

/** Um arquivo mandado para análise, já batizado. */
export interface PecaDoDossie {
  referencia: string;
  url: string;
  tipo: 'imagem' | 'video' | 'audio' | 'documento';
}

export interface CoberturaDoNeo {
  modelo: string;
  imagensAnalisadas: number;
  audiosTranscritos: number;
  naoAnalisado: string[];
  geradoEm: string;
}

export interface RespostaDoNeo {
  ok: boolean;
  relatorio?: RelatorioDoNeo;
  cobertura?: CoberturaDoNeo;
  /**
   * As peças, com o mesmo rótulo que o NEO cita.
   *
   * Voltam para quem pediu porque o relatório mostra as imagens ao lado do
   * texto: sem esta lista, a tela teria o rótulo "Imagem 3" e nenhum endereço
   * para buscá-la.
   */
  pecas?: PecaDoDossie[];
  erro?: string;
}

/**
 * O que o card sabe e o registro cru não diz.
 *
 * Prioridade e turno são guardados por id -- "p2", "tarde" --, e o tipo de
 * operação vira um rótulo só. Mandar os ids para o analista seria mandar um
 * código de barras: ele precisa de "Grave — risco à vida", "Tarde, 12h às
 * 18h", e do endereço por extenso, que o próprio card já descobriu pela
 * coordenada.
 */
export interface ContextoDaMissao {
  endereco?: string | null;
  prioridade?: { label?: string; description?: string } | null;
  turno?: { rotulo?: string; inicio?: string; fim?: string } | null;
  tipoDeOperacao?: { label?: string; description?: string } | null;
  cliente?: string | null;
}

const dataHora = (iso?: string) => {
  if (!iso) return 'sem data';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'sem data';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

/** Tipo do arquivo pelo que o sistema guardou, e não pela extensão da URL. */
const tipoDaMidia = (m: any): PecaDoDossie['tipo'] => {
  const bruto = String(m?.type || m?.tipo || m?.kind || 'imagem').toLowerCase();
  if (bruto.includes('video')) return 'video';
  if (bruto.includes('audio')) return 'audio';
  if (bruto.includes('doc')) return 'documento';
  return 'imagem';
};

/**
 * Monta o dossiê e chama o NEO.
 *
 * `missao` é o objeto que o card já tem em mãos, e `retornos` são os check-ins
 * vinculados. Nada é buscado de novo: o que está na tela é o que vai para a
 * análise, então o relatório fala da missão que a pessoa está olhando.
 */
export async function gerarRelatorioDaMissao(
  missao: any,
  retornos: any[],
  prompt: string,
  contexto: ContextoDaMissao = {}
): Promise<RespostaDoNeo> {
  const pecas: PecaDoDossie[] = [];

  /*
   * Os contadores são por tipo, e não por origem.
   *
   * "Imagem 7" é uma só no relatório inteiro, venha ela do material de apoio
   * ou do feedback: dois contadores independentes dariam duas "Imagem 3", e a
   * citação deixaria de apontar para algo.
   */
  const contagem = { imagem: 0, video: 0, audio: 0, documento: 0 };
  const rotulo = (tipo: PecaDoDossie['tipo'], origem: string) => {
    contagem[tipo] += 1;
    const nome =
      tipo === 'imagem'
        ? 'Imagem'
        : tipo === 'video'
          ? 'Vídeo'
          : tipo === 'audio'
            ? 'Áudio'
            : 'Documento';
    return `${nome} ${contagem[tipo]} — ${origem}`;
  };

  const juntar = (itens: any[] | undefined, origem: string) =>
    (itens || [])
      .filter((m: any) => m?.url)
      .map((m: any) => {
        const tipo = tipoDaMidia(m);
        const peca: PecaDoDossie = {
          referencia: rotulo(tipo, origem),
          url: String(m.url),
          tipo
        };
        pecas.push(peca);
        return { referencia: peca.referencia, nome: m.nome || null, tipo };
      });

  const materialDeApoio = juntar(missao?.material, 'material de apoio');
  const narrativas = juntar(missao?.narrativas, 'narrativa da missão');
  const feedbackOrganico = juntar(missao?.organicas, 'feedback orgânico');

  const retornosDescritos = (retornos || []).map((c: any) => {
    const quem = c?.name || 'Integrante';
    const quando = dataHora(c?.createdAt);
    const origem = `feedback de ${quem}, ${quando}`;

    const midias =
      c?.media && c.media.length > 0
        ? c.media
        : c?.photo
          ? [{ url: c.photo, type: 'image' }]
          : [];
    const arquivos = juntar(midias, origem);

    /*
     * Observação digitada vira texto do dossiê; áudio vira peça para
     * transcrever. São a mesma coisa para quem escreveu — "o que eu tenho a
     * dizer sobre este ponto" — e precisam chegar juntos ao analista.
     */
    const escritas: string[] = [];
    (c?.notes || []).forEach((n: any) => {
      if (n?.kind === 'audio' && n?.url) {
        pecas.push({
          referencia: rotulo('audio', `observação de ${quem}`),
          url: String(n.url),
          tipo: 'audio'
        });
        return;
      }
      if (n?.content) escritas.push(String(n.content));
    });

    return {
      quem,
      quando,
      concluido: c?.status !== 'rascunho',
      onde: [c?.rua, c?.bairro].filter(Boolean).join(', ') || null,
      /*
       * O rótulo vem com dois nomes.
       *
       * A linha da tabela `check_in_operations` chega crua, em
       * `operation_type_label`; o registro montado em memória usa
       * `operationTypeLabel`. Ler os dois evita que o tipo de operação suma do
       * dossiê dependendo de onde o check-in foi lido.
       */
      tiposDeOperacao: (c?.operations || [])
        .map((o: any) => o?.operationTypeLabel || o?.operation_type_label)
        .filter(Boolean),
      observacoesEscritas: escritas,
      arquivos
    };
  });

  /*
   * O tempo de resposta é calculado aqui, e não pedido ao analista.
   *
   * São duas datas subtraídas; o modelo erraria essa conta de vez em quando, e
   * um relatório com aritmética errada perde a confiança inteira por causa da
   * parte mais barata dele.
   */
  const primeiroRetorno = retornosDescritos.length > 0 ? (retornos || [])[0] : null;
  const tempoDeResposta = (() => {
    if (!missao?.criadaEm || !primeiroRetorno?.createdAt) return null;
    const ordem = new Date(missao.criadaEm).getTime();
    const chegada = Math.min(
      ...(retornos || []).map((c: any) => new Date(c.createdAt).getTime()).filter(n => !Number.isNaN(n))
    );
    if (Number.isNaN(ordem) || !Number.isFinite(chegada)) return null;
    const minutos = Math.max(0, Math.round((chegada - ordem) / 60000));
    const horas = Math.floor(minutos / 60);
    return horas > 0 ? `${horas}h ${minutos % 60}min` : `${minutos} min`;
  })();

  const dossie = {
    missao: {
      titulo: missao?.titulo || null,
      tipoDeOperacao: contexto.tipoDeOperacao?.label || missao?.etiqueta || null,
      oQueEsseTipoDeOperacaoSignifica: contexto.tipoDeOperacao?.description || null,
      ordem: missao?.descricao || null,
      cliente: contexto.cliente || null,
      criadaEm: dataHora(missao?.criadaEm),
      prazo: missao?.prazo || null,
      turno: contexto.turno?.rotulo
        ? `${contexto.turno.rotulo}${
            contexto.turno.inicio ? ` (${contexto.turno.inicio} às ${contexto.turno.fim})` : ''
          }`
        : missao?.turno || null,
      prioridade: contexto.prioridade?.label || missao?.prioridade || null,
      oQueEssaPrioridadeSignifica: contexto.prioridade?.description || null,
      tempoAteOPrimeiroRetorno: tempoDeResposta,
      formato: missao?.tipo === 'area' ? 'área de trabalho (raio)' : 'ponto no mapa',
      local: missao?.semLocal
        ? 'missão sem local definido'
        : {
            endereco: contexto.endereco || null,
            bairro: missao?.bairro || null,
            coordenadas: missao?.coords || null,
            raioMetros: missao?.raio || null
          },
      equipe: (missao?.pessoas || []).map(
        (p: any) => p?.full_name || p?.nome_completo || p?.nome || p?.name || 'Integrante'
      ),
      totalDesignados: missao?.totalDesignados || 0
    },
    materialDeApoio,
    narrativas,
    feedbackOrganico,
    linksPublicados: (missao?.links || []).map((l: any) => ({
      titulo: l?.titulo || null,
      url: l?.url || null
    })),
    retornos: retornosDescritos,
    semRetorno: retornosDescritos.length === 0
  };

  try {
    const resposta = await fetch('/api/neo-relatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossie, pecas, prompt })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      return { ok: false, erro: dados?.erro?.mensagem || 'O NEO não respondeu.' };
    }
    return {
      ok: true,
      relatorio: dados.relatorio,
      cobertura: dados.cobertura,
      pecas
    };
  } catch {
    return {
      ok: false,
      erro: 'Não foi possível falar com o NEO. Confira a conexão e tente de novo.'
    };
  }
}
