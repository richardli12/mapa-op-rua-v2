import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  Pencil,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  Users,
  X
} from 'lucide-react';
import {
  FORMATOS_DE_MATERIAL,
  TAMANHO_MAXIMO_DE_MATERIAL,
  anexarMaterial,
  cancelarMissao,
  criarMissao,
  editarMissao,
  ehDaOrdem,
  lerClientes,
  lerDestinatarios,
  lerMissaoPorIdExterno,
  lerMissoesPorReferencia,
  lerTimes,
  novoIdExterno,
  publicarMissao,
  referenciaDaMissao,
  type ClienteDoNexus,
  type DestinatarioDoNexus,
  type ErroDoNexus,
  type DestinatarioDaMissao,
  type MissaoDoNexus,
  type MudancasDaMissao,
  type PrioridadeDoNexus,
  type TimeDoNexus
} from '../../services/nexusGc';

/**
 * Despachar esta ordem para a equipe Delta, que trabalha noutro sistema.
 *
 * A equipe Delta não abre este mapa: ela recebe missão pelo Nexu-GC. Até aqui,
 * mandar uma ordem para ela era copiar título, descrição e prazo na mão, de
 * uma tela para a outra — e o que se perde nesse caminho não é tempo, é
 * rastro: ninguém sabia depois se a ordem tinha sido mandada, para quem, nem
 * se alguém concluiu.
 *
 * Este bloco faz os três passos que a API do Nexu-GC exige (cliente, time,
 * destinatários) e manda a missão já preenchida com o que esta ordem diz.
 *
 * DUAS REGRAS DO MANUAL DO NEXU-GC APARECEM NA TELA, E NÃO SÓ NO CÓDIGO:
 *
 * 1. NÃO HÁ PROTEÇÃO CONTRA ENVIO DUPLICADO. Requisição que estourou o tempo
 *    pode ter criado a missão; repetir cria a segunda, e a equipe recebe a
 *    mesma ordem duas vezes. Por isso toda missão sai com uma `referencia`
 *    que aponta para esta ordem, e o bloco começa perguntando ao Nexu-GC o
 *    que já foi mandado por ela — o que já existe fica listado antes de
 *    qualquer botão de enviar.
 * 2. A CRIAÇÃO É TUDO-OU-NADA. Um destinatário que não é do time derruba a
 *    chamada inteira e nada é criado. Não há envio pela metade para
 *    desfazer — e por isso a lista de quem pode receber vem do próprio
 *    Nexu-GC, nunca de um id digitado aqui.
 *
 * A chave nunca passa por esta tela: quem fala com o Nexu-GC é
 * `/api/nexus-gc`, no servidor.
 */

const COR = '#4F46E5';

const PRIORIDADES: { id: PrioridadeDoNexus; rotulo: string; ajuda: string }[] = [
  { id: 'baixa', rotulo: 'Baixa', ajuda: 'Rotina, sem urgência.' },
  { id: 'normal', rotulo: 'Normal', ajuda: 'O padrão.' },
  { id: 'alta', rotulo: 'Alta', ajuda: 'Aparece com destaque na lista do membro.' },
  { id: 'critica', rotulo: 'Crítica', ajuda: 'Vai para o topo da fila do membro.' }
];

const ESTADOS: { [chave: string]: { texto: string; classe: string } } = {
  publicada: { texto: 'Publicada', classe: 'bg-emerald-100 text-emerald-700' },
  rascunho: { texto: 'Rascunho', classe: 'bg-slate-200 text-slate-600' },
  cancelada: { texto: 'Cancelada', classe: 'bg-rose-100 text-rose-700' },
  arquivada: { texto: 'Arquivada', classe: 'bg-slate-200 text-slate-500' }
};

const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Nome e tamanho identificam um arquivo bem o bastante para esta lista. */
const chaveDoArquivo = (arquivo: File) => `${arquivo.name}:${arquivo.size}`;

const tamanhoLegivel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * O prazo que voltou em UTC, escrito de novo no horário de Maceió.
 *
 * A conta é exata porque Maceió é UTC-3 fixo, sem horário de verão — e é ela
 * que impede o formulário de edição de mostrar 21:00 para um prazo que foi
 * escrito como 18:00.
 */
const prazoEmMaceio = (iso: string | null | undefined) => {
  if (!iso) return { data: '', hora: '' };
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return { data: '', hora: '' };
  const local = new Date(instante.getTime() - 3 * 3600_000).toISOString();
  return { data: local.slice(0, 10), hora: local.slice(11, 16) };
};

/** "2026-09-30T18:00" no horário de Maceió vira o instante certo. */
const instanteEmMaceio = (data: string, hora: string) =>
  new Date(`${data}T${(hora || '23:59').slice(0, 5)}:00-03:00`);

/**
 * Toda data desta tela é escrita no horário de Maceió.
 *
 * O Nexu-GC devolve tudo em UTC e lê tudo como Maceió — é o fuso da operação.
 * Deixar o navegador formatar no fuso DELE faria a mesma missão mostrar horas
 * diferentes para quem abre de outro estado, e ninguém saberia qual das duas é
 * a que vale para o prazo.
 */
const dataCurta = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', {
        timeZone: 'America/Maceio',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
};

export default function MissaoParaODelta({
  missao,
  clienteSugerido,
  prioridadeSugerida = 'normal'
}: {
  /**
   * A ordem que está aberta.
   *
   * Dela sai só o que é fato — o prazo e a identidade, que vira a referência
   * do envio. Título e descrição são escritos aqui: o que se manda para outra
   * equipe quase nunca é o mesmo texto que a ordem interna usa, e um campo já
   * preenchido convida a mandar sem reler.
   */
  missao: { tipo: string; id: string; prazo?: string };
  /** O cliente em foco no mapa, para achar o mesmo no Nexu-GC. */
  clienteSugerido?: string | null;
  prioridadeSugerida?: PrioridadeDoNexus;
}) {
  const referencia = referenciaDaMissao(missao.tipo, missao.id);

  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<ErroDoNexus | null>(null);

  const [clientes, setClientes] = useState<ClienteDoNexus[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [times, setTimes] = useState<TimeDoNexus[]>([]);
  const [timeId, setTimeId] = useState('');
  const [destinatarios, setDestinatarios] = useState<DestinatarioDoNexus[]>([]);
  const [carregandoTimes, setCarregandoTimes] = useState(false);
  const [carregandoDestinatarios, setCarregandoDestinatarios] = useState(false);

  const [todosDoTime, setTodosDoTime] = useState(true);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeDoNexus>(prioridadeSugerida);
  const [pontos, setPontos] = useState(10);
  const [data, setData] = useState(
    /^\d{4}-\d{2}-\d{2}/.test(String(missao.prazo || '')) ? String(missao.prazo).slice(0, 10) : ''
  );
  const [hora, setHora] = useState('18:00');
  const [feedbackObrigatorio, setFeedbackObrigatorio] = useState(true);

  const [arquivos, setArquivos] = useState<File[]>([]);
  /** Quais arquivos já subiram: uma retomada não anexa o mesmo duas vezes. */
  const [anexados, setAnexados] = useState<string[]>([]);
  /**
   * O rascunho que ficou no meio do caminho.
   *
   * Com material, a missão nasce como rascunho, recebe os arquivos e só então
   * é publicada. Se algo falhar entre um passo e outro, existe um rascunho no
   * Nexu-GC que ninguém vê — e criar outro do zero deixaria o primeiro lá,
   * invisível, para sempre. Guardado aqui, o botão retoma de onde parou.
   */
  const [rascunhoPendente, setRascunhoPendente] = useState<MissaoDoNexus | null>(null);
  const [progresso, setProgresso] = useState<{ feito: number; total: number; nome: string } | null>(
    null
  );
  /**
   * O id que este sistema deu ao envio em curso.
   *
   * Nasce no primeiro toque em "enviar" e só morre quando a missão sai
   * publicada. Enquanto ele existe, uma segunda tentativa NÃO cria outra
   * missão: pergunta primeiro ao Nexu-GC se a do id já está lá. É o que
   * protege do caso em que a missão entrou e a resposta se perdeu na volta —
   * o único que nem o rascunho guardado aqui consegue enxergar, porque dele
   * nunca chegou objeto nenhum.
   */
  const [idExterno, setIdExterno] = useState<string | null>(null);
  const [idCopiado, setIdCopiado] = useState<string | null>(null);
  /** Qual missão está com o painel de respostas aberto. */
  const [respostasAbertas, setRespostasAbertas] = useState<string | null>(null);
  /** Qual missão está sendo editada, e o que já foi mexido nela. */
  const [editando, setEditando] = useState<string | null>(null);
  const [mudancas, setMudancas] = useState<MudancasDaMissao>({});
  const [salvando, setSalvando] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [jaEnviadas, setJaEnviadas] = useState<MissaoDoNexus[]>([]);
  const [insistindo, setInsistindo] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);

  /**
   * Ao abrir: o que já foi mandado, e a lista de clientes.
   *
   * Nesta ordem de importância — a primeira pergunta de quem abre este bloco
   * pela segunda vez é "já mandei?", e respondê-la depois de mostrar um
   * formulário pronto para enviar é responder tarde demais.
   */
  useEffect(() => {
    if (!aberto || carregando || clientes.length > 0) return;
    let cancelado = false;
    setCarregando(true);
    setErro(null);

    Promise.all([lerMissoesPorReferencia(referencia), lerClientes()])
      .then(([enviadas, lista]) => {
        if (cancelado) return;
        setJaEnviadas(enviadas.data || []);
        const disponiveis = lista.data || [];
        setClientes(disponiveis);

        /*
         * O cliente do mapa é o cliente do Nexu-GC, quando o nome bate.
         *
         * São dois cadastros diferentes, então isto é um palpite — por isso é
         * só uma pré-seleção numa caixa que continua aberta para trocar, e
         * não um envio automático.
         */
        const alvo = semAcento(clienteSugerido || '');
        const achado = alvo
          ? disponiveis.find((c) => semAcento(c.nome) === alvo) ||
            disponiveis.find((c) => semAcento(c.nome).includes(alvo))
          : null;
        if (achado) setClienteId(achado.id);
        else if (disponiveis.length === 1) setClienteId(disponiveis[0].id);
      })
      .catch((falha: ErroDoNexus) => {
        if (!cancelado) setErro(falha);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  /** Escolhido o cliente, vêm os times dele. */
  useEffect(() => {
    if (!clienteId) {
      setTimes([]);
      setTimeId('');
      return;
    }
    let cancelado = false;
    setCarregandoTimes(true);
    setErro(null);
    lerTimes(clienteId)
      .then((resposta) => {
        if (cancelado) return;
        const lista = resposta.data || [];
        setTimes(lista);
        setTimeId(lista.length === 1 ? lista[0].id : '');
      })
      .catch((falha: ErroDoNexus) => {
        if (!cancelado) setErro(falha);
      })
      .finally(() => {
        if (!cancelado) setCarregandoTimes(false);
      });
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  /** Escolhido o time, vem quem pode receber. */
  useEffect(() => {
    if (!timeId) {
      setDestinatarios([]);
      setEscolhidos([]);
      return;
    }
    let cancelado = false;
    setCarregandoDestinatarios(true);
    setErro(null);
    lerDestinatarios(timeId)
      .then((resposta) => {
        if (cancelado) return;
        setDestinatarios(resposta.data?.destinatarios || []);
        setEscolhidos([]);
      })
      .catch((falha: ErroDoNexus) => {
        if (!cancelado) setErro(falha);
      })
      .finally(() => {
        if (!cancelado) setCarregandoDestinatarios(false);
      });
    return () => {
      cancelado = true;
    };
  }, [timeId]);

  /**
   * SÓ A MISSÃO DESTA ORDEM APARECE AQUI.
   *
   * A consulta é por `referencia`, que agrupa — mas agrupar não é o mesmo que
   * identificar: a mesma chave de API serve outras origens, e nada impede que
   * um rótulo se repita fora daqui. Quem responde "esta missão é desta ordem?"
   * é o id do envio, que carrega a ordem por inteiro. Os dois precisam
   * concordar; qualquer coisa que passe só pelo rótulo fica de fora.
   */
  const daOrdem = jaEnviadas.filter((m) => ehDaOrdem(m.id_externo, missao.tipo, missao.id));
  const vivas = daOrdem.filter((m) => m.status !== 'cancelada');
  const quantosRecebem = todosDoTime
    ? times.find((t) => t.id === timeId)?.membros_ativos ?? destinatarios.length
    : escolhidos.length;

  /** O que impede o envio, dito antes de gastar uma chamada. */
  const impedimento = (): string | null => {
    if (!clienteId) return 'Escolha o cliente no Nexu-GC.';
    if (!timeId) return 'Escolha o time que vai receber.';
    if (!todosDoTime && escolhidos.length === 0)
      return 'Marque quem recebe, ou mande para o time inteiro.';
    if (!todosDoTime && escolhidos.length > 200)
      return 'O Nexu-GC aceita no máximo 200 destinatários por missão.';
    if (titulo.trim().length < 3) return 'O título precisa de pelo menos 3 caracteres.';
    if (titulo.trim().length > 160) return 'O título passa de 160 caracteres.';
    if (descricao.trim().length < 3) return 'Escreva o que precisa ser feito.';
    if (descricao.trim().length > 8000) return 'A descrição passa de 8000 caracteres.';
    if (!Number.isInteger(pontos) || pontos < 1 || pontos > 100000)
      return 'Os pontos vão de 1 a 100000.';
    if (!data) return 'Defina o prazo.';
    const quando = instanteEmMaceio(data, hora);
    if (Number.isNaN(quando.getTime())) return 'Esta data não existe no calendário.';
    if (quando.getTime() <= Date.now()) return 'O prazo precisa estar no futuro.';
    const grande = arquivos.find((a) => a.size > TAMANHO_MAXIMO_DE_MATERIAL);
    if (grande) return `"${grande.name}" passa de 200 MB, que é o teto do Nexu-GC.`;
    return null;
  };

  const enviar = async () => {
    const problema = impedimento();
    if (problema) {
      setErro({ code: 'validation_error', message: problema, campo: null });
      return;
    }
    if (vivas.length > 0 && !insistindo) {
      setInsistindo(true);
      return;
    }

    setEnviando(true);
    setErro(null);
    const paraQuem = todosDoTime
      ? { todos_do_time: true }
      : { destinatarios: escolhidos };
    const idDoEnvio = idExterno || novoIdExterno(missao.tipo, missao.id);
    setIdExterno(idDoEnvio);

    try {
      /*
       * SEGUNDA TENTATIVA NÃO CRIA OUTRA MISSÃO.
       *
       * `idExterno` já existir quer dizer que uma tentativa anterior falhou —
       * e falha não é o mesmo que "não criou". Antes de qualquer coisa,
       * perguntamos ao Nexu-GC se a missão deste id está lá; estando, é ela
       * que segue para os arquivos e para a publicação.
       */
      let adotada: MissaoDoNexus | null = null;
      if (idExterno && !rascunhoPendente) {
        adotada = await lerMissaoPorIdExterno(idExterno);
      }

      /*
       * COM MATERIAL, A ORDEM MUDA: RASCUNHO → ARQUIVOS → PUBLICAR.
       *
       * É a ordem que o manual recomenda, e a razão é de quem executa: anexar
       * depois de publicada funciona, mas abre a janela em que alguém abre a
       * missão e o arquivo que ela exige ainda não está lá. Sem material, a
       * missão nasce publicada de uma vez — não há o que esperar.
       */
      let criada: MissaoDoNexus =
        rascunhoPendente ||
        adotada ||
        (
          await criarMissao({
            cliente_id: clienteId,
            time_id: timeId,
            titulo: titulo.trim(),
            descricao: descricao.trim(),
            prioridade,
            pontos,
            /*
             * Data e hora separadas, como o manual manda.
             *
             * "prazo" com hora dentro E "prazo_hora" juntos é erro no Nexu-GC
             * — de propósito, para não haver dúvida sobre qual dos dois vale.
             */
            prazo: data,
            prazo_hora: hora || undefined,
            feedback_obrigatorio: feedbackObrigatorio,
            ...(arquivos.length > 0 ? { publicar: false } : paraQuem),
            referencia,
            id_externo: idDoEnvio
          })
        ).data;

      if (arquivos.length > 0) {
        // Guardado antes do primeiro arquivo: se o próximo passo falhar, o
        // botão retoma este rascunho em vez de criar outro.
        setRascunhoPendente(criada);

        const faltando = arquivos.filter((a) => !anexados.includes(chaveDoArquivo(a)));
        for (let i = 0; i < faltando.length; i += 1) {
          const arquivo = faltando[i];
          setProgresso({ feito: i, total: faltando.length, nome: arquivo.name });
          await anexarMaterial(criada.id, arquivo);
          setAnexados((atual) => [...atual, chaveDoArquivo(arquivo)]);
        }
        setProgresso(null);

        if (criada.status === 'rascunho') {
          criada = (await publicarMissao(criada.id, paraQuem)).data;
        }
        setRascunhoPendente(null);
      }

      setJaEnviadas((atual) => [criada, ...atual.filter((m) => m.id !== criada.id)]);
      setArquivos([]);
      setAnexados([]);
      setInsistindo(false);
      // O envio fechou: o próximo despacho desta ordem ganha um id novo.
      setIdExterno(null);
    } catch (falha: any) {
      setProgresso(null);
      setErro(falha as ErroDoNexus);
      /*
       * Tempo esgotado não é "não criou".
       *
       * A missão pode ter entrado e a resposta ter se perdido no caminho. Em
       * vez de deixar a pessoa apertar de novo às cegas, relemos pela
       * referência: se ela entrou, aparece na lista aqui em cima.
       */
      if ((falha as ErroDoNexus)?.code === 'timeout') {
        try {
          const conferencia = await lerMissoesPorReferencia(referencia);
          setJaEnviadas(conferencia.data || []);
        } catch {
          // Sem a conferência, fica o aviso do tempo esgotado — e o `idExterno`
          // guardado, que faz a próxima tentativa perguntar antes de criar.
        }
      }
    } finally {
      setEnviando(false);
    }
  };

  const atualizar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await lerMissoesPorReferencia(referencia);
      setJaEnviadas(resposta.data || []);
    } catch (falha: any) {
      setErro(falha as ErroDoNexus);
    } finally {
      setCarregando(false);
    }
  };

  /** Manda só o que mudou — a edição do Nexu-GC é parcial de propósito. */
  const salvarEdicao = async (m: MissaoDoNexus) => {
    if (Object.keys(mudancas).length === 0) {
      setEditando(null);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await editarMissao(m.id, mudancas);
      setJaEnviadas((atual) => atual.map((x) => (x.id === m.id ? resposta.data : x)));
      setEditando(null);
      setMudancas({});
    } catch (falha: any) {
      setErro(falha as ErroDoNexus);
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async (id: string) => {
    setCancelando(id);
    setErro(null);
    try {
      const resposta = await cancelarMissao(id);
      setJaEnviadas((atual) => atual.map((m) => (m.id === id ? resposta.data : m)));
    } catch (falha: any) {
      setErro(falha as ErroDoNexus);
    } finally {
      setCancelando(null);
    }
  };

  const problemaAgora = impedimento();

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      {/* ------------------------------------------------------ faixa --- */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 border-l-[3px] cursor-pointer text-left"
        style={{ borderLeftColor: COR, backgroundColor: `${COR}0F` }}
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
          style={{ backgroundColor: COR }}
        >
          <Send className="w-4 h-4 text-white stroke-[2.5]" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[13px] font-black leading-tight tracking-tight"
            style={{ color: COR }}
          >
            Missão para a equipe Delta
          </p>
        </div>
        <span
          className="shrink-0 px-2.5 h-[22px] rounded-full bg-white text-[10px] font-black uppercase tracking-wider flex items-center border"
          style={{ color: COR, borderColor: `${COR}33` }}
        >
          {vivas.length === 0
            ? 'não enviada'
            : `${vivas.length} ${vivas.length === 1 ? 'enviada' : 'enviadas'}`}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
          style={{ color: COR }}
        />
      </button>

      {aberto && (
        <div className="p-3 space-y-3">
          {carregando && jaEnviadas.length === 0 && clientes.length === 0 && (
            <p className="py-6 text-center text-[11.5px] font-bold text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando...
            </p>
          )}

          {erro && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
              <p className="text-[11.5px] font-bold text-rose-700 leading-snug flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {erro.message}
              </p>
              {erro.campo && (
                <p className="text-[10.5px] font-bold text-rose-400 mt-1 pl-5">
                  Campo: {erro.campo}
                </p>
              )}
              {idExterno && (
                <p className="text-[10px] font-bold text-rose-400 mt-1 pl-5 leading-snug">
                  Id deste envio: <span className="font-mono">{idExterno}</span>. Enviar
                  de novo pergunta por ele antes de criar — não sai missão repetida.
                </p>
              )}
              {erro.destinatariosRecusados && erro.destinatariosRecusados.length > 0 && (
                <p className="text-[10.5px] font-semibold text-rose-500 mt-1 pl-5 leading-snug">
                  Nada foi criado: {erro.destinatariosRecusados.length} destinatário(s)
                  não fazem mais parte deste time. Atualize a lista e mande de novo.
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------ já enviadas --- */}
          {daOrdem.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                  Já mandado por esta ordem
                </p>
                <button
                  type="button"
                  onClick={atualizar}
                  disabled={carregando}
                  title="Reler o andamento no Nexu-GC"
                  className="ml-auto text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${carregando ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>

              {daOrdem.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <Retrato nome={m.time?.nome || 'Time'} url={m.time?.foto_url} tamanho={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-slate-800 leading-snug">
                        {m.titulo}
                      </p>
                      <p className="text-[10.5px] font-semibold text-slate-400 mt-0.5">
                        {m.time?.nome} · prazo {dataCurta(m.prazo)} · {m.pontos} pontos
                        {m.materiais && m.materiais.total > 0
                          ? ` · ${m.materiais.total} ${
                              m.materiais.total === 1 ? 'material' : 'materiais'
                            }`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                        ESTADOS[m.status]?.classe || ESTADOS.rascunho.classe
                      }`}
                    >
                      {ESTADOS[m.status]?.texto || m.status}
                    </span>
                  </div>

                  {/*
                    Atrasada é contado na leitura, contra a hora da chamada —
                    não existe lá um campo esperando alguém virar uma chave. Por
                    isso ele aparece junto do "Atualizar", e não como estado
                    guardado aqui.
                  */}
                  {m.atrasada && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[9.5px] font-black uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      Prazo estourado
                    </p>
                  )}

                  {/*
                    O id que demos a este envio.

                    Ele não aparece em tela nenhuma do Nexu-GC — só no banco de
                    lá e nas respostas da API. Fica aqui porque é o que liga
                    esta ordem àquela missão quando alguém precisar perguntar
                    por ela, e é curto o bastante para ser lido em voz alta.
                  */}
                  {m.id_externo && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(m.id_externo as string);
                        setIdCopiado(m.id_externo);
                        setTimeout(() => setIdCopiado(null), 1800);
                      }}
                      title="Copiar o id deste envio"
                      className="mt-1.5 max-w-full flex items-center gap-1.5 text-[9.5px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                    >
                      {idCopiado === m.id_externo ? (
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate font-mono">{m.id_externo}</span>
                    </button>
                  )}

                  {/* O andamento: quantos dos que receberam já concluíram. */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${
                            m.destinatarios.total > 0
                              ? (m.destinatarios.concluidos / m.destinatarios.total) * 100
                              : 0
                          }%`
                        }}
                      />
                    </span>
                    <span className="shrink-0 text-[10.5px] font-black text-slate-500 tabular-nums">
                      {m.destinatarios.concluidos}/{m.destinatarios.total} concluíram
                    </span>
                  </div>

                  {/*
                    O funil, quando o Nexu-GC manda os passos.

                    "Recebeu" não é "viu", e "viu" não é "começou". Sem a
                    distinção, missão parada por falta de gente e missão parada
                    porque ninguém abriu o aplicativo são a mesma barra em
                    zero — e a decisão de quem despachou é diferente em cada
                    caso.
                  */}
                  {m.progresso && (
                    <p className="mt-1.5 text-[10px] font-bold text-slate-400 tabular-nums">
                      {m.progresso.total} receberam · {m.progresso.visualizados} viram ·{' '}
                      {m.progresso.iniciados} começaram · {m.progresso.concluidos}{' '}
                      concluíram
                    </p>
                  )}

                  {/*
                    Quem recebeu, pela cara.

                    "6 destinatários" é uma contagem; seis rostos são as seis
                    pessoas. Quem já concluiu ganha o anel verde — é a mesma
                    informação da barra acima, mas com nome e rosto em vez de
                    fração.
                  */}
                  {m.destinatarios.itens && m.destinatarios.itens.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      {m.destinatarios.itens.slice(0, 10).map((pessoa) => (
                        <span
                          key={pessoa.id}
                          title={`${pessoa.nome} — ${
                            pessoa.status === 'concluida' ? 'concluiu' : pessoa.status
                          }`}
                          className={`rounded-full ${
                            pessoa.status === 'concluida' ? 'ring-2 ring-emerald-500' : ''
                          }`}
                        >
                          <Retrato nome={pessoa.nome} url={pessoa.foto_url} tamanho={24} />
                        </span>
                      ))}
                      {m.destinatarios.itens.length > 10 && (
                        <span className="text-[10px] font-black text-slate-400 tabular-nums pl-1">
                          +{m.destinatarios.itens.length - 10}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ------------------------------------ o que dá para fazer --- */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {m.destinatarios.itens && m.destinatarios.itens.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setRespostasAbertas(respostasAbertas === m.id ? null : m.id)
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        {respostasAbertas === m.id ? 'Fechar respostas' : 'Ver respostas'}
                      </button>
                    )}

                    {/*
                      Missão cancelada ou arquivada não é editável no Nexu-GC:
                      ela saiu da operação, e mexer no texto de um histórico só
                      confunde quem lê depois.
                    */}
                    {(m.status === 'publicada' || m.status === 'rascunho') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(editando === m.id ? null : m.id);
                          setMudancas({});
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        {editando === m.id ? 'Fechar' : 'Editar'}
                      </button>
                    )}

                    {m.status === 'publicada' && (
                      <button
                        type="button"
                        onClick={() => cancelar(m.id)}
                        disabled={cancelando === m.id}
                        title="Encerra as atribuições em aberto; quem já concluiu mantém os pontos"
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        {cancelando === m.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        Cancelar no Nexu-GC
                      </button>
                    )}
                  </div>

                  {/* ------------------------------------------ respostas --- */}
                  {respostasAbertas === m.id && m.destinatarios.itens && (
                    <div className="mt-2.5 rounded-xl border border-slate-200 divide-y divide-slate-100">
                      {m.destinatarios.itens.map((pessoa) => (
                        <LinhaDaPessoa key={pessoa.atribuicao_id || pessoa.id} pessoa={pessoa} />
                      ))}
                    </div>
                  )}

                  {/* -------------------------------------------- edição --- */}
                  {editando === m.id && (
                    <FormularioDeEdicao
                      missao={m}
                      mudancas={mudancas}
                      onMudar={setMudancas}
                      salvando={salvando}
                      onSalvar={() => salvarEdicao(m)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ---------------------------------------------- formulário --- */}
          {clientes.length > 0 && (
            <div className="space-y-3 pt-1">
              <div className="grid sm:grid-cols-2 gap-2">
                <Campo rotulo="Cliente no Nexu-GC">
                  <select
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:border-slate-300"
                  >
                    <option value="">Escolha o cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.cidade ? ` — ${c.cidade}` : ''}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo rotulo="Time que recebe">
                  <select
                    value={timeId}
                    onChange={(e) => setTimeId(e.target.value)}
                    disabled={!clienteId || carregandoTimes}
                    className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:border-slate-300 disabled:opacity-50"
                  >
                    <option value="">
                      {carregandoTimes
                        ? 'Carregando times...'
                        : clienteId
                          ? times.length === 0
                            ? 'Este cliente não tem time ativo'
                            : 'Escolha o time'
                          : 'Escolha o cliente antes'}
                    </option>
                    {times.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} ({t.membros_ativos})
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>

              {/* ---------------------------------- destinatários --- */}
              {timeId && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={todosDoTime}
                      onChange={(e) => setTodosDoTime(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <Retrato
                      nome={times.find((t) => t.id === timeId)?.nome || 'Time'}
                      url={times.find((t) => t.id === timeId)?.foto_url}
                      tamanho={24}
                    />
                    <span className="text-[12px] font-bold text-slate-700">
                      Mandar para o time inteiro
                    </span>
                    <span className="ml-auto text-[10.5px] font-black text-slate-400 tabular-nums">
                      {carregandoDestinatarios ? '...' : `${quantosRecebem} recebe(m)`}
                    </span>
                  </label>

                  {!todosDoTime && (
                    <div className="mt-2.5 max-h-44 overflow-y-auto divide-y divide-slate-50 border-t border-slate-100 pt-1">
                      {carregandoDestinatarios ? (
                        <p className="py-3 text-center text-[11px] font-bold text-slate-400">
                          Carregando quem pode receber...
                        </p>
                      ) : destinatarios.length === 0 ? (
                        <p className="py-3 text-center text-[11px] font-bold text-slate-400 leading-snug">
                          Ninguém neste time pode receber missão agora.
                        </p>
                      ) : (
                        destinatarios.map((d) => {
                          const marcado = escolhidos.includes(d.id);
                          return (
                            <label
                              key={d.id}
                              className="flex items-center gap-2.5 py-1.5 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() =>
                                  setEscolhidos((atual) =>
                                    marcado
                                      ? atual.filter((i) => i !== d.id)
                                      : [...atual, d.id]
                                  )
                                }
                                className="w-4 h-4 accent-indigo-600 cursor-pointer"
                              />
                              {/*
                                A cara de quem vai receber.

                                Despachar para a equipe errada é o erro mais
                                caro deste bloco, e o mais fácil de cometer: os
                                nomes de dois times se parecem, os ids não
                                dizem nada. Um rosto conhecido na lista é o que
                                faz esse engano aparecer antes do envio.
                              */}
                              <Retrato nome={d.nome} url={d.foto_url} />
                              <span className="min-w-0 flex-1">
                                <span className="block text-[11.5px] font-bold text-slate-700 truncate">
                                  {d.nome}
                                </span>
                                {/*
                                  Último acesso na tela porque o Nexu-GC não
                                  barra ninguém por causa dele: mandar para
                                  quem nunca abriu o aplicativo é uma decisão
                                  de quem despacha, e ela precisa do dado.
                                */}
                                <span className="block text-[9.5px] font-semibold text-slate-400">
                                  {d.ultimo_acesso
                                    ? `último acesso ${dataCurta(d.ultimo_acesso)}`
                                    : 'nunca abriu o aplicativo'}
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------- o conteúdo --- */}
              <Campo rotulo="Título da missão">
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={160}
                  placeholder="O que a equipe Delta vê na lista dela"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-hidden focus:border-slate-300"
                />
              </Campo>

              <Campo rotulo="O que precisa ser feito">
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  maxLength={8000}
                  placeholder="A instrução que a equipe Delta vai ler: o que fazer, onde, e o que precisa voltar."
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 placeholder:text-slate-300 leading-relaxed resize-y focus:outline-hidden focus:border-slate-300"
                />
              </Campo>

              {/* ------------------------------ material de apoio --- */}
              {/*
                O arquivo não vai no corpo da criação — a missão nasce primeiro
                e o material é anexado a ela pelo id. Por isso, com arquivo, a
                missão nasce como RASCUNHO: assim ninguém abre a missão antes
                do material que ela exige estar lá.
              */}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                    Material de apoio
                  </p>
                  <label className="ml-auto px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors">
                    <Paperclip className="w-3 h-3" />
                    Anexar arquivo
                    <input
                      type="file"
                      multiple
                      accept={FORMATOS_DE_MATERIAL}
                      onChange={(e) => {
                        const novos: File[] = Array.from(e.target.files || []);
                        setArquivos((atual) => {
                          const chaves = new Set(atual.map(chaveDoArquivo));
                          return [
                            ...atual,
                            ...novos.filter((a) => !chaves.has(chaveDoArquivo(a)))
                          ];
                        });
                        // Sem isto, escolher o mesmo arquivo de novo depois de
                        // tirá-lo da lista não dispara evento nenhum.
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {arquivos.length === 0 ? (
                  <p className="mt-2 text-[10.5px] font-semibold text-slate-400 leading-snug">
                    Foto, vídeo, PDF, Word, Excel ou PowerPoint, até 200 MB cada.
                    O arquivo fica no Nexu-GC, e o membro abre pela tela de lá.
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {arquivos.map((arquivo) => {
                      const jaSubiu = anexados.includes(chaveDoArquivo(arquivo));
                      return (
                        <div
                          key={chaveDoArquivo(arquivo)}
                          className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5"
                        >
                          <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11.5px] font-bold text-slate-700 truncate leading-tight">
                              {arquivo.name}
                            </span>
                            <span className="block text-[9.5px] font-semibold text-slate-400">
                              {tamanhoLegivel(arquivo.size)}
                              {jaSubiu && ' · já anexado'}
                            </span>
                          </span>
                          {/*
                            Arquivo que já subiu não sai daqui: ele está na
                            missão do Nexu-GC, e o manual só permite removê-lo
                            enquanto ela é rascunho — pela tela de lá.
                          */}
                          {!jaSubiu && (
                            <button
                              type="button"
                              title="Tirar da lista"
                              onClick={() =>
                                setArquivos((atual) =>
                                  atual.filter(
                                    (a) => chaveDoArquivo(a) !== chaveDoArquivo(arquivo)
                                  )
                                )
                              }
                              className="w-6 h-6 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-[9.5px] font-semibold text-slate-400 leading-snug pt-0.5">
                      Com material, a missão é criada, recebe os arquivos e só
                      então é publicada — ninguém abre a missão antes do anexo
                      estar lá.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Campo rotulo="Prioridade">
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as PrioridadeDoNexus)}
                    title={PRIORIDADES.find((p) => p.id === prioridade)?.ajuda}
                    className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:border-slate-300"
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.rotulo}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Pontos">
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={pontos}
                    onChange={(e) => setPontos(Math.trunc(Number(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
                  />
                </Campo>
                <Campo rotulo="Prazo">
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
                  />
                </Campo>
                <Campo rotulo="Hora">
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
                  />
                </Campo>
              </div>

              {/*
                O fuso dito na tela.
                O Nexu-GC lê data sem fuso como horário de Maceió. Num
                navegador em outro fuso, o que se digita e o que vale
                divergem — e nada na resposta denuncia isso, só o prazo
                estourado.
              */}
              <p className="text-[10px] font-semibold text-slate-400 leading-snug">
                O prazo vale no horário de Maceió (UTC-3). Sem hora, o Nexu-GC
                assume 23:59.
              </p>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedbackObrigatorio}
                  onChange={(e) => setFeedbackObrigatorio(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
                <span className="text-[11.5px] font-bold text-slate-700">
                  Exigir retorno escrito para concluir
                </span>
              </label>

              {/* ------------------------------------------ enviar --- */}
              {insistindo && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-[11.5px] font-bold text-amber-800 leading-snug">
                    Esta ordem já tem {vivas.length}{' '}
                    {vivas.length === 1 ? 'missão' : 'missões'} no Nexu-GC. O
                    Nexu-GC não recusa repetição — enviar de novo faz a equipe
                    receber a mesma ordem duas vezes.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={enviar}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Enviar mesmo assim
                    </button>
                    <button
                      type="button"
                      onClick={() => setInsistindo(false)}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Deixar como está
                    </button>
                  </div>
                </div>
              )}

              {progresso && (
                <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Anexando {progresso.feito + 1} de {progresso.total}: {progresso.nome}
                </p>
              )}

              {/*
                O rascunho que ficou no caminho.

                Existe no Nexu-GC e ninguém o vê — nem a equipe, nem quem
                mandou. Dizer isso é o mínimo; o botão que retoma de onde parou
                é o que evita um segundo rascunho invisível ao lado do
                primeiro.
              */}
              {rascunhoPendente && !enviando && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-[11.5px] font-bold text-amber-800 leading-snug">
                    A missão foi criada no Nexu-GC como rascunho, mas o envio
                    parou antes de publicar — ninguém recebeu nada ainda.
                    Enviar retoma daqui, sem criar outra.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={enviar}
                  disabled={enviando || Boolean(problemaAgora)}
                  title={problemaAgora || 'Criar a missão no Nexu-GC'}
                  className="h-10 px-4 text-white rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  style={{ backgroundColor: COR }}
                >
                  {enviando ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {enviando
                    ? 'Enviando...'
                    : rascunhoPendente
                      ? 'Retomar o envio'
                      : 'Enviar para o Delta'}
                </button>

                {problemaAgora ? (
                  <p className="text-[10.5px] font-semibold text-slate-400 leading-snug">
                    {problemaAgora}
                  </p>
                ) : (
                  <p className="text-[10.5px] font-semibold text-slate-400 leading-snug flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {quantosRecebem} {quantosRecebem === 1 ? 'pessoa recebe' : 'pessoas recebem'}
                    , cada uma com a sua conclusão
                  </p>
                )}
              </div>
            </div>
          )}

          {/*
            Sem clientes e sem erro: a chave vale, mas não há cliente ativo.
            É estado do Nexu-GC, não falha daqui — e dizer isso evita a
            procura por um defeito que não existe.
          */}
          {!carregando && !erro && clientes.length === 0 && (
            <p className="py-4 text-center text-[11.5px] font-bold text-slate-400 leading-snug">
              O Nexu-GC não tem nenhum cliente ativo para receber missão.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A foto de quem recebe — e as iniciais quando ela não vem.
 *
 * A URL do Nexu-GC é assinada e vence em cerca de uma hora. Um bloco aberto
 * desde a manhã continuaria apontando para um endereço morto, e o que
 * apareceria seria o ícone de imagem quebrada — que quem olha lê como defeito
 * do sistema, não como assinatura vencida.
 *
 * Por isso a queda para as iniciais não é só para `foto_url` nula: é também
 * para o carregamento que falhou. Os dois casos têm a mesma resposta na tela,
 * e nenhum deles tem por que assustar.
 */
function Retrato({
  nome,
  url,
  tamanho = 28
}: {
  nome: string;
  url?: string | null;
  tamanho?: number;
}) {
  const [quebrou, setQuebrou] = useState(false);
  const iniciais = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => parte[0])
    .filter((letra, i, todas) => i === 0 || i === todas.length - 1)
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const estilo = { width: tamanho, height: tamanho };

  if (!url || quebrou) {
    return (
      <span
        aria-hidden
        style={estilo}
        className="shrink-0 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-[9.5px] font-black"
      >
        {iniciais || '—'}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={nome}
      title={nome}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setQuebrou(true)}
      style={estilo}
      className="shrink-0 rounded-full object-cover border border-slate-200 bg-slate-100"
    />
  );
}

const PASSOS: {
  [chave: string]: { texto: string; classe: string };
} = {
  concluida: { texto: 'Concluiu', classe: 'bg-emerald-100 text-emerald-700' },
  em_andamento: { texto: 'Começou', classe: 'bg-blue-100 text-blue-700' },
  pendente: { texto: 'Não começou', classe: 'bg-slate-100 text-slate-500' },
  cancelada: { texto: 'Saiu da missão', classe: 'bg-rose-100 text-rose-700' }
};

/**
 * Uma pessoa, e o que ela fez com a missão.
 *
 * O QUE ELA ESCREVEU É O QUE IMPORTA AQUI. "Concluída" é um carimbo; o
 * resultado é a entrega — e é a única coisa desta tela que responde "o que
 * voltou?". Por isso ele aparece por extenso, e não atrás de outro clique.
 *
 * Os passos vêm como booleano junto com o carimbo de hora, então nada aqui
 * precisa deduzir "já viu?" comparando data com nulo.
 */
function LinhaDaPessoa({ pessoa }: { pessoa: DestinatarioDaMissao; key?: string }) {
  const passo = PASSOS[pessoa.status] || PASSOS.pendente;
  return (
    <div className="p-3">
      <div className="flex items-start gap-2.5">
        <Retrato nome={pessoa.nome} url={pessoa.foto_url} tamanho={30} />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-black text-slate-800 leading-tight truncate">
            {pessoa.nome}
          </p>
          <p className="text-[9.5px] font-semibold text-slate-400 leading-snug mt-0.5">
            {pessoa.visualizada ? `Abriu ${dataCurta(pessoa.vista_em || null)}` : 'Não abriu'}
            {pessoa.iniciada && ` · começou ${dataCurta(pessoa.iniciada_em || null)}`}
            {pessoa.concluida && ` · concluiu ${dataCurta(pessoa.concluida_em)}`}
          </p>
        </div>
        <span className="shrink-0 flex flex-col items-end gap-1">
          <span
            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${passo.classe}`}
          >
            {passo.texto}
          </span>
          {pessoa.pontos_creditados > 0 && (
            <span className="text-[9.5px] font-black text-slate-400 tabular-nums">
              +{pessoa.pontos_creditados} pontos
            </span>
          )}
        </span>
      </div>

      {pessoa.concluida_com_atraso && (
        <p className="mt-1.5 ml-[38px] text-[9.5px] font-black uppercase tracking-wider text-amber-600">
          Entregou depois do prazo
        </p>
      )}

      {pessoa.resultado ? (
        <p className="mt-2 ml-[38px] rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 text-[11.5px] font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">
          {pessoa.resultado}
        </p>
      ) : (
        pessoa.concluida && (
          <p className="mt-1.5 ml-[38px] text-[10px] font-semibold text-slate-400 italic">
            Concluiu sem escrever retorno.
          </p>
        )
      )}
    </div>
  );
}

/**
 * Mudar o que já foi mandado.
 *
 * SÓ SAI O QUE FOI MEXIDO. A edição do Nexu-GC é parcial, e reenviar o objeto
 * inteiro "para garantir" é justamente o que apaga conteúdo sem intenção — um
 * campo que a tela não sabia existir voltaria nulo. Então cada controle grava
 * a sua chave em `mudancas`, e só essas chaves viajam.
 */
function FormularioDeEdicao({
  missao,
  mudancas,
  onMudar,
  salvando,
  onSalvar
}: {
  missao: MissaoDoNexus;
  mudancas: MudancasDaMissao;
  onMudar: (m: MudancasDaMissao) => void;
  salvando: boolean;
  onSalvar: () => void;
}) {
  const prazo = prazoEmMaceio(missao.prazo);
  const data = mudancas.prazo ?? prazo.data;
  const hora = mudancas.prazo_hora ?? prazo.hora;

  const mexer = (campo: keyof MudancasDaMissao, valor: any) =>
    onMudar({ ...mudancas, [campo]: valor });

  const quando = data ? instanteEmMaceio(data, hora) : null;
  const problema =
    (mudancas.titulo !== undefined && mudancas.titulo.trim().length < 3 && 'O título precisa de 3 caracteres.') ||
    (mudancas.descricao !== undefined && mudancas.descricao.trim().length < 3 && 'A descrição precisa de 3 caracteres.') ||
    (mudancas.pontos !== undefined && (mudancas.pontos < 1 || mudancas.pontos > 100000) && 'Os pontos vão de 1 a 100000.') ||
    ((mudancas.prazo !== undefined || mudancas.prazo_hora !== undefined) &&
      quando &&
      quando.getTime() <= Date.now() &&
      'O prazo novo precisa estar no futuro — para encerrar, use cancelar.') ||
    null;

  const mexidos = Object.keys(mudancas).length;

  return (
    <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
      <Campo rotulo="Título">
        <input
          value={mudancas.titulo ?? missao.titulo}
          onChange={(e) => mexer('titulo', e.target.value)}
          maxLength={160}
          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
        />
      </Campo>
      <Campo rotulo="O que precisa ser feito">
        <textarea
          value={mudancas.descricao ?? missao.descricao}
          onChange={(e) => mexer('descricao', e.target.value)}
          rows={3}
          maxLength={8000}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 leading-relaxed resize-y focus:outline-hidden focus:border-slate-300"
        />
      </Campo>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Campo rotulo="Prioridade">
          <select
            value={mudancas.prioridade ?? missao.prioridade}
            onChange={(e) => mexer('prioridade', e.target.value as PrioridadeDoNexus)}
            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:border-slate-300"
          >
            {PRIORIDADES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Pontos">
          <input
            type="number"
            min={1}
            max={100000}
            value={mudancas.pontos ?? missao.pontos}
            onChange={(e) => mexer('pontos', Math.trunc(Number(e.target.value) || 0))}
            className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
          />
        </Campo>
        <Campo rotulo="Prazo">
          <input
            type="date"
            value={data}
            onChange={(e) => {
              // O prazo viaja como data + hora separadas, como na criação.
              onMudar({ ...mudancas, prazo: e.target.value, prazo_hora: hora || '23:59' });
            }}
            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
          />
        </Campo>
        <Campo rotulo="Hora">
          <input
            type="time"
            value={hora}
            onChange={(e) =>
              onMudar({ ...mudancas, prazo: data, prazo_hora: e.target.value })
            }
            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={mudancas.feedback_obrigatorio ?? missao.feedback_obrigatorio}
          onChange={(e) => mexer('feedback_obrigatorio', e.target.checked)}
          className="w-4 h-4 accent-indigo-600 cursor-pointer"
        />
        <span className="text-[11.5px] font-bold text-slate-700">
          Exigir retorno escrito para concluir
        </span>
      </label>

      {/*
        Mexer nos pontos não tira o que já foi creditado a quem concluiu: o
        valor novo vale para as conclusões seguintes. Dizer isso aqui evita a
        decisão tomada achando que se está corrigindo o passado.
      */}
      {mudancas.pontos !== undefined && missao.destinatarios.concluidos > 0 && (
        <p className="text-[10px] font-semibold text-amber-700 leading-snug">
          Quem já concluiu mantém os pontos que recebeu — o valor novo vale para
          as próximas conclusões.
        </p>
      )}

      <div className="flex items-center gap-2.5 pt-0.5">
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando || mexidos === 0 || Boolean(problema)}
          title={problema || undefined}
          className="h-9 px-3.5 rounded-lg text-white text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          style={{ backgroundColor: COR }}
        >
          {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Salvar
        </button>
        <p className="text-[10px] font-semibold text-slate-400 leading-snug">
          {problema ||
            (mexidos === 0
              ? 'Mude alguma coisa para salvar.'
              : `Só ${mexidos === 1 ? 'o campo mexido vai' : `os ${mexidos} campos mexidos vão`} para o Nexu-GC.`)}
        </p>
      </div>
    </div>
  );
}

/** Rótulo em cima, campo embaixo — o mesmo par em toda linha do formulário. */
function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1">
        {rotulo}
      </span>
      {children}
    </label>
  );
}
