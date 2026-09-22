import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Send,
  Users,
  X
} from 'lucide-react';
import {
  cancelarMissao,
  criarMissao,
  lerClientes,
  lerDestinatarios,
  lerMissoesPorReferencia,
  lerTimes,
  referenciaDaMissao,
  type ClienteDoNexus,
  type DestinatarioDoNexus,
  type ErroDoNexus,
  type MissaoDoNexus,
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

/** "2026-09-30T18:00" no horário de Maceió vira o instante certo. */
const instanteEmMaceio = (data: string, hora: string) =>
  new Date(`${data}T${(hora || '23:59').slice(0, 5)}:00-03:00`);

const dataCurta = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', {
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
  /** A ordem que está aberta: é dela que sai o conteúdo da missão. */
  missao: { tipo: string; id: string; titulo: string; descricao?: string; prazo?: string };
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

  const [titulo, setTitulo] = useState(missao.titulo || '');
  const [descricao, setDescricao] = useState(missao.descricao || '');
  const [prioridade, setPrioridade] = useState<PrioridadeDoNexus>(prioridadeSugerida);
  const [pontos, setPontos] = useState(10);
  const [data, setData] = useState(
    /^\d{4}-\d{2}-\d{2}/.test(String(missao.prazo || '')) ? String(missao.prazo).slice(0, 10) : ''
  );
  const [hora, setHora] = useState('18:00');
  const [feedbackObrigatorio, setFeedbackObrigatorio] = useState(true);

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

  const vivas = jaEnviadas.filter((m) => m.status !== 'cancelada');
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
    try {
      const resposta = await criarMissao({
        cliente_id: clienteId,
        time_id: timeId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prioridade,
        pontos,
        /*
         * Data e hora separadas, como o manual manda.
         *
         * "prazo" com hora dentro E "prazo_hora" juntos é erro no Nexu-GC —
         * de propósito, para não haver dúvida sobre qual dos dois vale.
         */
        prazo: data,
        prazo_hora: hora || undefined,
        feedback_obrigatorio: feedbackObrigatorio,
        ...(todosDoTime ? { todos_do_time: true } : { destinatarios: escolhidos }),
        referencia
      });
      setJaEnviadas((atual) => [resposta.data, ...atual]);
      setInsistindo(false);
    } catch (falha: any) {
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
          // Sem a conferência, fica o aviso do tempo esgotado.
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
              Falando com o Nexu-GC...
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
              {erro.destinatariosRecusados && erro.destinatariosRecusados.length > 0 && (
                <p className="text-[10.5px] font-semibold text-rose-500 mt-1 pl-5 leading-snug">
                  Nada foi criado: {erro.destinatariosRecusados.length} destinatário(s)
                  não fazem mais parte deste time. Atualize a lista e mande de novo.
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------ já enviadas --- */}
          {jaEnviadas.length > 0 && (
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

              {jaEnviadas.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-slate-800 leading-snug">
                        {m.titulo}
                      </p>
                      <p className="text-[10.5px] font-semibold text-slate-400 mt-0.5">
                        {m.time?.nome} · prazo {dataCurta(m.prazo)} · {m.pontos} pontos
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

                  {m.status === 'publicada' && (
                    <button
                      type="button"
                      onClick={() => cancelar(m.id)}
                      disabled={cancelando === m.id}
                      title="Encerra as atribuições em aberto; quem já concluiu mantém os pontos"
                      className="mt-2.5 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
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
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 focus:outline-hidden focus:border-slate-300"
                />
              </Campo>

              <Campo rotulo="O que precisa ser feito">
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  maxLength={8000}
                  placeholder="A instrução que a equipe Delta vai ler. Material de apoio (foto, PDF) não vai por aqui — anexe no painel do Nexu-GC depois."
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 placeholder:text-slate-300 leading-relaxed resize-y focus:outline-hidden focus:border-slate-300"
                />
              </Campo>

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
                  {enviando ? 'Enviando...' : 'Enviar para o Delta'}
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
