import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  LogOut,
  MapPin,
  Phone,
  Plus,
  Radar,
  Search
} from 'lucide-react';
import BrandMark from '../BrandMark';
import CarregandoOperacional from '../CarregandoOperacional';
import Contador from '../Contador';
import MapaDeOperacoes, { ModoDoMapa, Raio, chaveDoPonto } from './MapaDeOperacoes';
import CriarOperacao, { RASCUNHO_VAZIO, RascunhoDaOperacao } from './CriarOperacao';
import DetalheDaOperacao, { AnelDeProgresso, dataCurta } from './DetalheDaOperacao';
import { DatabaseService } from '../../databaseClient';
import { PriorityLevel } from '../../types';
import { NOME_DO_TURNO, TurnoId } from '../../turnos';
import {
  DeltaOperacionalService,
  Operacao,
  PontoDoMapa,
  STATUS_DA_OPERACAO,
  StatusDaOperacao,
  distanciaEmMetros,
  formatarDistancia,
  mascararTelefone,
  novoId,
  soDigitos
} from '../../services/deltaOperacional';

interface Sessao {
  token: string;
  delta: { id: string; full_name: string; whatsapp: string; image: string; candidate_id: string };
  client: { id: string; name: string; image: string; city?: string; estado?: string };
}

const CHAVE_SESSAO = 'delta_operacional_sessao';

const lerSessao = (token: string): Sessao | null => {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
    return s && s.token === token ? s : null;
  } catch {
    return null;
  }
};

const MOTIVOS: Record<string, string> = {
  link_invalido: 'Este link não funciona mais. Peça um link novo à coordenação.',
  acesso_pausado: 'O seu acesso está pausado pela coordenação.',
  telefone_nao_confere: 'Este número não é o cadastrado para este link. Confira e tente de novo.'
};

// ===========================================================================
// A PORTA: link + telefone
// ===========================================================================

/**
 * O painel do Delta Operacional.
 *
 * O link é a primeira metade da credencial; o telefone cadastrado é a
 * segunda. Um link encaminhado por engano num grupo não abre o painel de
 * ninguém — quem recebeu não sabe o número.
 *
 * A entrada fica lembrada neste aparelho, mas é conferida a cada abertura:
 * link trocado ou acesso pausado pela coordenação derruba a sessão na hora.
 */
export default function PainelDeltaOperacional({ token }: { token: string }) {
  const [fase, setFase] = useState<'verificando' | 'entrada' | 'invalido' | 'dentro'>('verificando');
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [cliente, setCliente] = useState<{ name: string; image: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    document.title = 'Delta Operacional';
    (async () => {
      const res = await DeltaOperacionalService.espiarPainel(token);
      const guardada = lerSessao(token);
      if (!res.success) {
        // Sem conexão com o banco: quem já tinha entrado segue trabalhando.
        if (guardada) {
          setSessao(guardada);
          setFase('dentro');
        } else {
          setMotivo(res.error || 'Não foi possível abrir o painel.');
          setFase('invalido');
        }
        return;
      }
      if (!res.data?.ok) {
        localStorage.removeItem(CHAVE_SESSAO);
        setMotivo(MOTIVOS.link_invalido);
        setFase('invalido');
        return;
      }
      setCliente(res.data.client);
      if (!res.data.active) {
        localStorage.removeItem(CHAVE_SESSAO);
        setMotivo(MOTIVOS.acesso_pausado);
        setFase('invalido');
        return;
      }
      if (guardada) {
        setSessao(guardada);
        setFase('dentro');
        return;
      }
      setFase('entrada');
    })();
  }, [token]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soDigitos(telefone).length < 10 || entrando) return;
    setEntrando(true);
    setErro('');
    const res = await DeltaOperacionalService.entrarNoPainel(token, telefone);
    setEntrando(false);
    if (!res.success) {
      setErro(res.error || 'Não foi possível entrar.');
      return;
    }
    if (!res.data?.ok) {
      const razao = res.data?.reason || '';
      if (razao === 'telefone_nao_confere') {
        setErro(MOTIVOS.telefone_nao_confere);
        return;
      }
      setMotivo(MOTIVOS[razao] || 'Não foi possível entrar.');
      setFase('invalido');
      return;
    }
    const nova: Sessao = { token, delta: res.data.delta, client: res.data.client };
    try {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(nova));
    } catch {
      /* sem armazenamento, entra só nesta aba */
    }
    setSessao(nova);
    setFase('dentro');
  };

  const sair = () => {
    localStorage.removeItem(CHAVE_SESSAO);
    setSessao(null);
    setTelefone('');
    setFase('entrada');
  };

  if (fase === 'verificando') {
    return (
      <CarregandoOperacional
        etapas={['Conferindo o seu acesso', 'Abrindo a sala de operações']}
      />
    );
  }

  if (fase === 'dentro' && sessao) return <CentralDoOperacional sessao={sessao} onSair={sair} />;

  return (
    <div className="op-carregando min-h-[100dvh] w-full flex items-center justify-center px-5 py-10 font-sans text-white">
      <div className="op-grade" aria-hidden="true" />
      <div className="relative w-full max-w-[400px] lg-cartao">
        <div className="flex flex-col items-center text-center">
          {cliente?.image ? (
            <img
              src={cliente.image}
              alt=""
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-full object-cover border-2 border-white/15 shadow-2xl"
            />
          ) : (
            <BrandMark size={64} rounded={18} />
          )}
          <p className="mt-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#FDBA74]">
            <Radar className="w-3.5 h-3.5" />
            Delta Operacional
          </p>
          <h1 className="mt-2 text-[26px] font-black tracking-tight leading-tight">
            {cliente?.name || 'Painel de operações'}
          </h1>
        </div>

        {fase === 'invalido' ? (
          <div className="mt-8 rounded-2xl bg-rose-500/10 border border-rose-400/25 p-5 text-center">
            <AlertTriangle className="w-6 h-6 text-rose-300 mx-auto" />
            <p className="mt-3 text-[14px] font-bold text-rose-50 leading-snug">{motivo}</p>
          </div>
        ) : (
          <form onSubmit={entrar} className="mt-8 space-y-4">
            <div>
              <label htmlFor="op-telefone" className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                Seu WhatsApp
              </label>
              <div className={`lg-campo ${erro ? 'lg-campo-erro' : ''}`}>
                <Phone className="w-[18px] h-[18px] shrink-0 text-slate-500 lg-campo-icone" />
                <input
                  id="op-telefone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  autoFocus
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(mascararTelefone(e.target.value));
                    setErro('');
                  }}
                  placeholder="(82) 99999-9999"
                  className="flex-1 min-w-0 h-full bg-transparent border-none text-[16px] font-semibold text-white placeholder:text-slate-600 focus:outline-none tabular-nums"
                />
              </div>
              <p className="mt-2 text-[11.5px] text-slate-500 leading-snug">
                O número cadastrado pela coordenação. Ele confirma que o link é seu.
              </p>
            </div>
            {erro && (
              <div role="alert" className="lg-erro flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-300" />
                <p className="text-[12.5px] font-semibold text-rose-100 leading-snug">{erro}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={soDigitos(telefone).length < 10 || entrando}
              className="lg-entrar group relative w-full h-[54px] rounded-2xl overflow-hidden font-black text-[12.5px] uppercase tracking-[0.16em] text-white flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {entrando ? (
                <>
                  <span className="lg-mini-radar" aria-hidden="true" />
                  Conferindo
                </>
              ) : (
                <>
                  Entrar no painel
                  <ArrowRight className="w-4 h-4 stroke-[2.75]" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// A SALA: lista, mapa e o assistente
// ===========================================================================

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'criar'; passo: 1 | 2 | 3; editandoId?: string }
  | { tipo: 'detalhe'; id: string };

const tempoAtras = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
};

function CentralDoOperacional({ sessao, onSair }: { sessao: Sessao; onSair: () => void }) {
  const clienteId = sessao.delta.candidate_id || sessao.client.id;
  const [pontos, setPontos] = useState<PontoDoMapa[]>([]);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [niveis, setNiveis] = useState<PriorityLevel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [raio, setRaio] = useState<Raio | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [rascunho, setRascunho] = useState<RascunhoDaOperacao>(RASCUNHO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [focar, setFocar] = useState<{ lat: number; lng: number; zoom?: number; raio?: number; pedido: number } | null>(null);
  const [filtro, setFiltro] = useState<'todas' | StatusDaOperacao>('todas');
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);

  const avisar = (texto: string, tipo: 'ok' | 'erro' = 'ok') => {
    setAviso({ texto, tipo });
    window.setTimeout(() => setAviso((a) => (a?.texto === texto ? null : a)), 3200);
  };

  const recarregarOperacoes = useCallback(async () => {
    const res = await DeltaOperacionalService.listarOperacoes(clienteId);
    if (res.success) setOperacoes(res.data);
    return res;
  }, [clienteId]);

  useEffect(() => {
    (async () => {
      const [p, o, n] = await Promise.all([
        DeltaOperacionalService.lerPontosDoCliente(clienteId),
        DeltaOperacionalService.listarOperacoes(clienteId),
        DatabaseService.fetchPriorityLevels()
      ]);
      if (p.success) setPontos(p.data);
      if (o.success) setOperacoes(o.data);
      else setErroGeral(o.error || '');
      setNiveis(((n as any).data || []) as PriorityLevel[]);
      setCarregando(false);
    })();
  }, [clienteId]);

  // As operações dos outros Deltas chegam sozinhas, de tempos em tempos e
  // quando a aba volta a ter foco — sem atropelar quem está salvando.
  useEffect(() => {
    const atualizar = () => {
      if (!salvando && document.visibilityState === 'visible') recarregarOperacoes();
    };
    const t = window.setInterval(atualizar, 45000);
    window.addEventListener('focus', atualizar);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', atualizar);
    };
  }, [recarregarOperacoes, salvando]);

  const corDaPrioridade = useCallback(
    (id?: string | null) => niveis.find((n) => n.id === id)?.color || '#64748B',
    [niveis]
  );

  const opAberta = vista.tipo === 'detalhe' ? operacoes.find((o) => o.id === vista.id) || null : null;
  const editando = vista.tipo === 'criar' && vista.editandoId
    ? operacoes.find((o) => o.id === vista.editandoId) || null
    : null;

  /** Os pontos do mapa, mais os da operação em edição que já não existem. */
  const pontosNoMapa = useMemo(() => {
    if (!editando) return pontos;
    const chaves = new Set(pontos.map(chaveDoPonto));
    const orfaos: PontoDoMapa[] = editando.targets
      .filter((a) => !chaves.has(chaveDoPonto(a)))
      .map((a) => ({ ...a, detalhe: 'Não está mais no mapa', cor: a.cor || '#94A3B8' }));
    return [...pontos, ...orfaos];
  }, [pontos, editando]);

  const pontosDentro = useMemo(
    () => (raio ? pontosNoMapa.filter((p) => distanciaEmMetros(raio.center, p) <= raio.radius) : []),
    [pontosNoMapa, raio]
  );

  const modoDoMapa: ModoDoMapa =
    vista.tipo === 'criar' ? (raio ? 'selecionar' : 'desenhar') : 'navegar';

  const destaquesDoMapa = useMemo(() => {
    if (vista.tipo === 'criar') return selecionados;
    if (opAberta) return new Set(opAberta.targets.map(chaveDoPonto));
    return undefined;
  }, [vista.tipo, selecionados, opAberta]);

  /* ------------------------------------------------------ o assistente ---- */
  const novaOperacao = () => {
    setRaio(null);
    setSelecionados(new Set());
    setRascunho({ ...RASCUNHO_VAZIO, priority: '' });
    setVista({ tipo: 'criar', passo: 1 });
  };

  const aoMudarRaio = (r: Raio) => {
    const dentro = (p: PontoDoMapa) => distanciaEmMetros(r.center, p) <= r.radius;
    if (!raio) {
      // O primeiro raio já chega com tudo o que está dentro dele marcado: é o
      // caso comum, e desmarcar dois é mais rápido que marcar vinte.
      setSelecionados(new Set(pontosNoMapa.filter(dentro).map(chaveDoPonto)));
      setRaio(r);
      if (vista.tipo === 'criar' && vista.passo === 1) setVista({ ...vista, passo: 2 });
      return;
    }
    // Raio ajustado: quem saiu do círculo sai da operação; quem entrou fica à
    // disposição, pulsando, mas não entra sozinho.
    setSelecionados((atual) => {
      const noRaio = new Set(pontosNoMapa.filter(dentro).map(chaveDoPonto));
      return new Set([...atual].filter((k) => noRaio.has(k)));
    });
    setRaio(r);
  };

  const alternar = (chave: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const marcar = (chaves: string[], sim: boolean) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      chaves.forEach((k) => (sim ? novo.add(k) : novo.delete(k)));
      return novo;
    });

  const salvar = async () => {
    if (!raio || vista.tipo !== 'criar') return;
    setSalvando(true);
    const agora = new Date().toISOString();
    const alvos = pontosDentro
      .filter((p) => selecionados.has(chaveDoPonto(p)))
      .map((p) => ({ id: p.id, tipo: p.tipo, titulo: p.titulo, lat: p.lat, lng: p.lng, cor: p.cor }));
    const op: Operacao = {
      id: editando?.id || novoId(),
      candidate_id: clienteId,
      created_by: editando ? editando.created_by : sessao.delta.id,
      created_by_name: editando ? editando.created_by_name : sessao.delta.full_name,
      title: rascunho.title.trim(),
      objective: rascunho.objective.trim() || null,
      action_plan: rascunho.etapas.filter((e) => e.texto.trim()).map((e) => ({ ...e, texto: e.texto.trim() })),
      priority: rascunho.priority || null,
      turno: rascunho.turno || null,
      due_date: rascunho.due_date || null,
      status: editando?.status || 'planejada',
      center: raio.center,
      radius: raio.radius,
      targets: alvos,
      created_at: editando?.created_at || agora,
      updated_at: agora
    };
    const res = await DeltaOperacionalService.salvarOperacao(op);
    setSalvando(false);
    if (!res.success || !res.data) {
      avisar(res.error || 'Não foi possível salvar a operação.', 'erro');
      return;
    }
    const salva = res.data;
    setOperacoes((lista) =>
      editando ? lista.map((o) => (o.id === salva.id ? salva : o)) : [salva, ...lista]
    );
    setRaio(null);
    setSelecionados(new Set());
    setVista({ tipo: 'detalhe', id: salva.id });
    setFocar({ lat: salva.center.lat, lng: salva.center.lng, raio: salva.radius, pedido: Date.now() });
    avisar(editando ? 'Operação atualizada.' : 'Operação criada. Ela já aparece para a coordenação.');
  };

  const editar = (op: Operacao) => {
    setRaio({ center: op.center, radius: op.radius });
    setSelecionados(new Set(op.targets.map(chaveDoPonto)));
    setRascunho({
      title: op.title,
      objective: op.objective || '',
      priority: op.priority || '',
      turno: (op.turno as TurnoId) || '',
      due_date: op.due_date || '',
      etapas: op.action_plan.map((e) => ({ ...e }))
    });
    setVista({ tipo: 'criar', passo: 3, editandoId: op.id });
  };

  /** Mudança de andamento: aparece na hora e desfaz se o banco recusar. */
  const atualizarAndamento = async (op: Operacao, mudanca: Partial<Operacao>) => {
    const nova = { ...op, ...mudanca };
    setOperacoes((l) => l.map((o) => (o.id === op.id ? nova : o)));
    const res = await DeltaOperacionalService.salvarOperacao(nova);
    if (!res.success) {
      setOperacoes((l) => l.map((o) => (o.id === op.id ? op : o)));
      avisar(res.error || 'Não foi possível salvar.', 'erro');
    }
  };

  const excluir = async (op: Operacao) => {
    const res = await DeltaOperacionalService.apagarOperacao(op.id);
    if (!res.success) return avisar(res.error || 'Não foi possível excluir.', 'erro');
    setOperacoes((l) => l.filter((o) => o.id !== op.id));
    setVista({ tipo: 'lista' });
    avisar('Operação excluída.');
  };

  /* ------------------------------------------------------------ a lista ---- */
  const contagem = useMemo(() => {
    const c: Record<string, number> = { todas: operacoes.length };
    operacoes.forEach((o) => (c[o.status] = (c[o.status] || 0) + 1));
    return c;
  }, [operacoes]);

  const termo = busca.trim().toLowerCase();
  const listadas = operacoes.filter(
    (o) =>
      (filtro === 'todas' || o.status === filtro) &&
      (!termo || o.title.toLowerCase().includes(termo) || (o.created_by_name || '').toLowerCase().includes(termo))
  );

  const primeiroNome = (sessao.delta.full_name || '').trim().split(/\s+/)[0];

  if (carregando) {
    return (
      <CarregandoOperacional
        etapas={['Carregando o mapa do cliente', 'Posicionando os pontos', 'Trazendo as operações']}
      />
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#06111D] text-white font-sans overflow-hidden">
      {/* ------------------------------------------------------ topo ---- */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#040C16]">
        <div className="flex items-center gap-3 min-w-0">
          {sessao.client.image ? (
            <img src={sessao.client.image} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-xl object-cover" />
          ) : (
            <BrandMark size={36} rounded={10} />
          )}
          <div className="min-w-0">
            <p className="text-[9.5px] font-black uppercase tracking-[0.24em] text-[#FDBA74] leading-none">
              Delta Operacional
            </p>
            <p className="mt-1 text-[13.5px] font-black truncate leading-none">{sessao.client.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[11px] font-black">
              {sessao.delta.image ? (
                <img src={sessao.delta.image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                (sessao.delta.full_name || 'D').slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="text-[12px] font-bold text-slate-300 max-w-[160px] truncate">{sessao.delta.full_name}</span>
          </div>
          <button
            type="button"
            onClick={onSair}
            className="h-9 px-3 rounded-xl border border-white/[0.08] text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/[0.05] flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* --------------------------------------------------- lateral ---- */}
        <aside className="order-2 md:order-1 flex-1 md:flex-none md:w-[420px] min-h-0 flex flex-col border-t md:border-t-0 md:border-r border-white/[0.06] bg-[#081624] op-rolagem">
          {vista.tipo === 'criar' ? (
            <CriarOperacao
              passo={vista.passo}
              onPasso={(p) => setVista({ ...vista, passo: p })}
              raio={raio}
              onRaio={aoMudarRaio}
              onRedesenhar={() => {
                setRaio(null);
                setSelecionados(new Set());
                setVista({ ...vista, passo: 1 });
              }}
              pontosDentro={pontosDentro}
              selecionados={selecionados}
              onAlternar={alternar}
              onMarcar={marcar}
              niveis={niveis}
              dados={rascunho}
              onDados={setRascunho}
              salvando={salvando}
              onSalvar={salvar}
              onCancelar={() => {
                setRaio(null);
                setSelecionados(new Set());
                setVista(editando ? { tipo: 'detalhe', id: editando.id } : { tipo: 'lista' });
              }}
              editando={!!editando}
              onFocarPonto={(p) => setFocar({ lat: p.lat, lng: p.lng, zoom: 17, pedido: Date.now() })}
            />
          ) : opAberta ? (
            <DetalheDaOperacao
              op={opAberta}
              niveis={niveis}
              podeEditar={opAberta.created_by === sessao.delta.id}
              onVoltar={() => setVista({ tipo: 'lista' })}
              onStatus={(s) => atualizarAndamento(opAberta, { status: s })}
              onEtapa={(id) =>
                atualizarAndamento(opAberta, {
                  action_plan: opAberta.action_plan.map((e) => (e.id === id ? { ...e, feita: !e.feita } : e))
                })
              }
              onEditar={() => editar(opAberta)}
              onExcluir={() => excluir(opAberta)}
              onFocarAlvo={(a) => setFocar({ lat: a.lat, lng: a.lng, zoom: 17, pedido: Date.now() })}
              onFocarOperacao={() =>
                setFocar({ lat: opAberta.center.lat, lng: opAberta.center.lng, raio: opAberta.radius, pedido: Date.now() })
              }
            />
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-5 pt-5 pb-4 space-y-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-[12px] font-semibold text-slate-400">Olá, {primeiroNome}</p>
                  <h1 className="text-[24px] font-black tracking-tight leading-tight">Operações</h1>
                </div>
                <button type="button" onClick={novaOperacao} className="op-botao-principal">
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Nova operação
                </button>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'todas', rotulo: 'Todas', cor: '#E2E8F0' },
                      { id: 'planejada', rotulo: 'Planejadas', cor: STATUS_DA_OPERACAO.planejada.cor },
                      { id: 'em_andamento', rotulo: 'Em campo', cor: STATUS_DA_OPERACAO.em_andamento.cor },
                      { id: 'concluida', rotulo: 'Concluídas', cor: STATUS_DA_OPERACAO.concluida.cor }
                    ] as const
                  ).map((f) => {
                    const ativo = filtro === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFiltro(f.id)}
                        className={`rounded-xl px-2 py-2 text-left border transition-colors cursor-pointer ${
                          ativo ? 'bg-white/[0.08] border-white/20' : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="block text-[18px] font-black tabular-nums leading-none" style={{ color: f.cor }}>
                          <Contador valor={contagem[f.id] || 0} duracao={600} />
                        </span>
                        <span className="block mt-1 text-[9.5px] font-bold text-slate-400 truncate">{f.rotulo}</span>
                      </button>
                    );
                  })}
                </div>
                {operacoes.length > 3 && (
                  <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <Search className="w-4 h-4 text-slate-500" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar operação"
                      className="flex-1 bg-transparent text-[12.5px] font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2.5">
                {erroGeral && (
                  <p className="text-[12px] font-semibold text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded-xl p-3">
                    {erroGeral}
                  </p>
                )}
                {listadas.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <div className="w-16 h-16 mx-auto rounded-full border-2 border-dashed border-[#F58220]/40 flex items-center justify-center">
                      <Radar className="w-7 h-7 text-[#FDBA74]" />
                    </div>
                    <p className="mt-4 text-[14px] font-black">
                      {operacoes.length === 0 ? 'Nenhuma operação ainda' : 'Nada com esse filtro'}
                    </p>
                    <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed">
                      {operacoes.length === 0
                        ? 'Toque em "Nova operação", desenhe um raio no mapa e escolha os pontos que entram.'
                        : 'Troque o filtro ou a busca para ver as outras.'}
                    </p>
                  </div>
                ) : (
                  listadas.map((op, indice) => {
                    const cor = corDaPrioridade(op.priority);
                    const nivel = niveis.find((n) => n.id === op.priority);
                    const st = STATUS_DA_OPERACAO[op.status] || STATUS_DA_OPERACAO.planejada;
                    const feitas = op.action_plan.filter((e) => e.feita).length;
                    const total = op.action_plan.length;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setVista({ tipo: 'detalhe', id: op.id });
                          setFocar({ lat: op.center.lat, lng: op.center.lng, raio: op.radius, pedido: Date.now() });
                        }}
                        style={{ '--i': Math.min(indice, 8) } as React.CSSProperties}
                        className="anim-cascata group w-full text-left rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] p-4 transition-colors cursor-pointer relative overflow-hidden"
                      >
                        <span className="absolute left-0 inset-y-0 w-1" style={{ background: cor }} />
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <span className="w-2 h-2 rounded-full" style={{ background: cor }} />
                            {nivel?.label || 'Sem prioridade'}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider"
                            style={{ background: `${st.cor}26`, color: st.cor === '#64748B' ? '#CBD5E1' : '#fff' }}
                          >
                            {st.rotulo}
                          </span>
                        </div>
                        <p className="mt-2 text-[15px] font-black leading-snug text-white">{op.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {op.targets.length} {op.targets.length === 1 ? 'ponto' : 'pontos'}
                          </span>
                          <span>{formatarDistancia(op.radius)}</span>
                          {op.turno && NOME_DO_TURNO[op.turno as TurnoId] && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {NOME_DO_TURNO[op.turno as TurnoId]}
                            </span>
                          )}
                          {op.due_date && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {dataCurta(op.due_date)}
                            </span>
                          )}
                        </div>
                        {total > 0 && (
                          <div className="mt-3 flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(feitas / total) * 100}%`,
                                  background: feitas === total ? '#34D399' : '#F58220'
                                }}
                              />
                            </div>
                            <span className="text-[10.5px] font-black tabular-nums text-slate-400">
                              {feitas}/{total}
                            </span>
                          </div>
                        )}
                        <p className="mt-3 text-[10.5px] font-semibold text-slate-600">
                          {op.created_by === sessao.delta.id ? 'Criada por você' : `Criada por ${op.created_by_name || 'outro Delta'}`}{' '}
                          · {tempoAtras(op.created_at)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ------------------------------------------------------ mapa ---- */}
        <main className="order-1 md:order-2 relative h-[42vh] md:h-auto md:flex-1 shrink-0">
          <MapaDeOperacoes
            pontos={pontosNoMapa}
            operacoes={vista.tipo === 'criar' && editando ? operacoes.filter((o) => o.id !== editando.id) : operacoes}
            corDaPrioridade={corDaPrioridade}
            modo={modoDoMapa}
            raio={vista.tipo === 'criar' ? raio : null}
            onRaio={aoMudarRaio}
            selecionados={destaquesDoMapa}
            onAlternarPonto={alternar}
            operacaoEmFoco={opAberta?.id || null}
            onAbrirOperacao={(id) => setVista({ tipo: 'detalhe', id })}
            focar={focar}
          />

          {modoDoMapa === 'desenhar' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
              <div className="flex items-center gap-2.5 pl-3 pr-4 h-10 rounded-full bg-[#06111D]/90 border border-[#F58220]/40 backdrop-blur shadow-2xl text-[12px] font-bold whitespace-nowrap">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="absolute inset-0 rounded-full bg-[#F58220] animate-ping opacity-70" />
                  <span className="relative w-2.5 h-2.5 rounded-full bg-[#F58220]" />
                </span>
                Clique para marcar o centro, e de novo para fechar o raio
              </div>
            </div>
          )}

          {modoDoMapa === 'selecionar' && vista.tipo === 'criar' && vista.passo === 2 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
              <div className="flex items-center gap-2 px-4 h-10 rounded-full bg-[#06111D]/90 border border-white/10 backdrop-blur shadow-2xl text-[12px] font-bold whitespace-nowrap">
                <Check className="w-4 h-4 text-[#FDBA74]" />
                Clique nos pontos para incluir ou tirar
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 z-[500] hidden sm:flex items-center gap-3 px-3 h-9 rounded-xl bg-[#06111D]/85 border border-white/[0.08] backdrop-blur text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 pointer-events-none">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F58220]" /> Pontos</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Check-ins</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-sky-300" /> Operações</span>
          </div>

          {vista.tipo === 'lista' && operacoes.length > 0 && (
            <div className="absolute top-4 right-4 z-[500] hidden lg:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#06111D]/85 border border-white/[0.08] backdrop-blur pointer-events-none">
              <AnelDeProgresso
                feitas={operacoes.reduce((s, o) => s + o.action_plan.filter((e) => e.feita).length, 0)}
                total={operacoes.reduce((s, o) => s + o.action_plan.length, 0)}
                tamanho={40}
              />
              <div>
                <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-slate-500">Plano geral</p>
                <p className="text-[12.5px] font-black">
                  {operacoes.reduce((s, o) => s + o.targets.length, 0)} pontos em {operacoes.length}{' '}
                  {operacoes.length === 1 ? 'operação' : 'operações'}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {aviso && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[3000] lg-toast">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-[12.5px] font-bold ${
              aviso.tipo === 'ok'
                ? 'bg-[#0C2A45] border-emerald-400/30 text-white'
                : 'bg-[#3B0D16] border-rose-400/30 text-rose-50'
            }`}
          >
            {aviso.tipo === 'ok' ? (
              <Check className="w-4 h-4 text-emerald-300" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-300" />
            )}
            {aviso.texto}
          </div>
        </div>
      )}
    </div>
  );
}
