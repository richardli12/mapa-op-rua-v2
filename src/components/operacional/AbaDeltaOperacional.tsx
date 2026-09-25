import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pause,
  Phone,
  Play,
  PlusCircle,
  QrCode,
  Radar,
  Send,
  Trash2,
  User,
  X
} from 'lucide-react';
import { Candidate, PriorityLevel } from '../../types';
import { DatabaseService } from '../../databaseClient';
import type { ConfirmRequest } from '../ConfirmDialog';
import MapaDeOperacoes from './MapaDeOperacoes';
import DetalheDaOperacao, { dataCurta } from './DetalheDaOperacao';
import {
  DeltaOperacional,
  DeltaOperacionalService,
  Operacao,
  PontoDoMapa,
  STATUS_DA_OPERACAO,
  formatarDistancia,
  formatarTelefone,
  linkDoCadastroOperacional,
  linkDoPainelOperacional,
  mascararTelefone,
  soDigitos,
  whatsappComLink
} from '../../services/deltaOperacional';

type Aviso = (texto: string, tipo?: 'success' | 'error' | 'info') => void;

const quandoFoi = (iso?: string | null) => {
  if (!iso) return 'Nunca entrou';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return 'Entrou agora';
  if (min < 60) return `Entrou há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Entrou há ${h} h`;
  return `Entrou em ${new Date(iso).toLocaleDateString('pt-BR')}`;
};

const copiar = async (texto: string) => {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Navegador sem permissão de área de transferência: cai no jeito antigo.
    const campo = document.createElement('textarea');
    campo.value = texto;
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand('copy');
    campo.remove();
    return ok;
  }
};

function Retrato({ pessoa, tamanho = 'w-12 h-12', texto = 'text-[13px]' }: { pessoa: { full_name: string; image?: string | null }; tamanho?: string; texto?: string }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className={`${tamanho} rounded-2xl bg-gradient-to-br from-[#0D233A] to-[#15395E] text-white overflow-hidden flex items-center justify-center shrink-0 ${texto} font-black uppercase`}>
      {pessoa.image && !falhou ? (
        <img src={pessoa.image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setFalhou(true)} />
      ) : (
        (pessoa.full_name || 'DO')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0])
          .join('')
      )}
    </span>
  );
}

/**
 * A aba "Delta Operacional" da ficha do cliente.
 *
 * Em cima, as pessoas: quem planeja as operações deste cliente, cada uma com
 * o link do painel dela a um clique — copiar, mandar no WhatsApp, abrir. É o
 * gesto que o administrador repete: cadastrar e entregar o acesso.
 *
 * Embaixo, o que elas planejaram: as operações no mapa, com a mesma ficha que
 * o Delta vê. O administrador acompanha e pode mudar o andamento; o desenho
 * da operação (raio, pontos, plano) é de quem a criou.
 */
export default function AbaDeltaOperacional({
  client,
  notify,
  askConfirmation
}: {
  client: Candidate;
  notify: Aviso;
  askConfirmation: (pedido: ConfirmRequest) => void;
}) {
  const [deltas, setDeltas] = useState<DeltaOperacional[]>([]);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [pontos, setPontos] = useState<PontoDoMapa[]>([]);
  const [niveis, setNiveis] = useState<PriorityLevel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<'cadastro' | 'qrcode' | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [opAberta, setOpAberta] = useState<string | null>(null);
  /** A ficha lateral; a operação continua destacada no mapa com ela fechada. */
  const [fichaAberta, setFichaAberta] = useState(false);
  const mapaRef = useRef<HTMLDivElement | null>(null);

  /** Da ficha para o mapa: recolhe a ficha, que tapa o mapa, e vai até ele. */
  const verNoMapa = (alvo: { lat: number; lng: number; raio?: number; zoom?: number }) => {
    setFichaAberta(false);
    mapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFocar({ ...alvo, pedido: Date.now() });
  };
  const [focar, setFocar] = useState<{ lat: number; lng: number; raio?: number; zoom?: number; pedido: number } | null>(null);

  const carregar = useCallback(async () => {
    const [d, o, p, n] = await Promise.all([
      DeltaOperacionalService.listar(client.id),
      DeltaOperacionalService.listarOperacoes(client.id),
      DeltaOperacionalService.lerPontosDoCliente(client.id),
      DatabaseService.fetchPriorityLevels()
    ]);
    if (!d.success) setErro(d.error || '');
    else setErro('');
    setDeltas(d.data);
    setOperacoes(o.data);
    setPontos(p.data);
    setNiveis(((n as any).data || []) as PriorityLevel[]);
    setCarregando(false);
  }, [client.id]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  useEffect(() => {
    const fechar = () => setMenuAberto(null);
    window.addEventListener('click', fechar);
    return () => window.removeEventListener('click', fechar);
  }, []);

  const corDaPrioridade = useCallback(
    (id?: string | null) => niveis.find((n) => n.id === id)?.color || '#64748B',
    [niveis]
  );

  const opsPorDelta = useMemo(() => {
    const c: Record<string, number> = {};
    operacoes.forEach((o) => {
      if (o.created_by) c[o.created_by] = (c[o.created_by] || 0) + 1;
    });
    return c;
  }, [operacoes]);

  const copiarLink = async (d: DeltaOperacional) => {
    const ok = await copiar(linkDoPainelOperacional(d.access_token));
    if (!ok) return notify('Não foi possível copiar. Use "Abrir painel" e copie da barra.', 'error');
    setCopiado(d.id);
    window.setTimeout(() => setCopiado((c) => (c === d.id ? null : c)), 2200);
    notify(`Link do painel de ${d.full_name.split(' ')[0]} copiado.`, 'success');
  };

  const gerarNovoLink = (d: DeltaOperacional) =>
    askConfirmation({
      title: 'Gerar novo link',
      message: `O link atual de ${d.full_name} para de funcionar agora.`,
      details:
        'Use quando o link vazou ou foi parar no celular errado. Quem estiver com o painel aberto é desconectado na próxima vez que abrir, e só entra de novo com o link novo.',
      confirmLabel: 'Gerar novo link',
      onConfirm: async () => {
        const res = await DeltaOperacionalService.gerarNovoLink(d.id);
        if (!res.success) return notify(res.error || 'Não foi possível gerar.', 'error');
        const atualizado = { ...d, access_token: res.token };
        setDeltas((l) => l.map((x) => (x.id === d.id ? atualizado : x)));
        const ok = await copiar(linkDoPainelOperacional(res.token));
        notify(ok ? 'Link novo gerado e copiado.' : 'Link novo gerado.', 'success');
      }
    });

  const alternarAcesso = async (d: DeltaOperacional) => {
    const res = await DeltaOperacionalService.atualizar(d.id, { active: !d.active });
    if (!res.success) return notify(res.error || 'Não foi possível mudar o acesso.', 'error');
    setDeltas((l) => l.map((x) => (x.id === d.id ? { ...x, active: !d.active } : x)));
    notify(d.active ? `Acesso de ${d.full_name} pausado.` : `Acesso de ${d.full_name} reativado.`, 'info');
  };

  const remover = (d: DeltaOperacional) =>
    askConfirmation({
      title: 'Remover Delta Operacional',
      message: `${d.full_name} perde o acesso ao painel.`,
      details:
        'As operações que essa pessoa criou continuam no sistema, com o nome dela. Para só suspender o acesso por um tempo, use "Pausar acesso".',
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        const res = await DeltaOperacionalService.remover(d.id);
        if (!res.success) return notify(res.error || 'Não foi possível remover.', 'error');
        setDeltas((l) => l.filter((x) => x.id !== d.id));
        notify('Delta Operacional removido.', 'info');
      }
    });

  const op = operacoes.find((o) => o.id === opAberta) || null;

  const atualizarAndamento = async (atual: Operacao, mudanca: Partial<Operacao>) => {
    const nova = { ...atual, ...mudanca };
    setOperacoes((l) => l.map((o) => (o.id === atual.id ? nova : o)));
    const res = await DeltaOperacionalService.salvarOperacao(nova);
    if (!res.success) {
      setOperacoes((l) => l.map((o) => (o.id === atual.id ? atual : o)));
      notify(res.error || 'Não foi possível salvar.', 'error');
    }
  };

  const excluirOperacao = (alvo: Operacao) =>
    askConfirmation({
      title: 'Excluir operação',
      message: `"${alvo.title}" sai do painel de todos os Deltas.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        const res = await DeltaOperacionalService.apagarOperacao(alvo.id);
        if (!res.success) return notify(res.error || 'Não foi possível excluir.', 'error');
        setOperacoes((l) => l.filter((o) => o.id !== alvo.id));
        setOpAberta(null);
        setFichaAberta(false);
        notify('Operação excluída.', 'info');
      }
    });

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    operacoes.forEach((o) => (c[o.status] = (c[o.status] || 0) + 1));
    return c;
  }, [operacoes]);

  if (carregando) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl py-16 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando o Delta Operacional
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------- cabeçalho ---- */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-[#FFF3E8] text-[#EA580C] flex items-center justify-center shrink-0">
            <Radar className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-black text-[#0D233A] leading-tight flex items-center gap-2 flex-wrap">
              Delta Operacional
              <span className="px-2.5 py-1 rounded-full bg-[#FFF3E8] text-[#C2410C] text-[11px] font-black">
                {deltas.length} {deltas.length === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </h3>
            <p className="text-[12px] text-slate-400 font-semibold">
              Quem planeja as operações deste cliente, num painel próprio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setModal('qrcode')}
            className="h-11 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <QrCode className="w-4 h-4 text-[#EA580C]" />
            QR Code
          </button>
          <button
            onClick={() => setModal('cadastro')}
            className="h-11 px-4 bg-[#0D233A] hover:bg-[#123255] text-white font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            Cadastrar Delta Operacional
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[12px] font-bold text-amber-800 leading-snug">{erro}</p>
        </div>
      )}

      {/* ---------------------------------------------------- pessoas ---- */}
      {deltas.length === 0 && !erro ? (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
          <p className="text-center text-[15px] font-black text-[#0D233A]">Ninguém planejando ainda</p>
          <p className="text-center text-[12.5px] text-slate-400 font-semibold mt-1">
            Três passos e a primeira operação sai do papel.
          </p>
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            {[
              { n: 1, t: 'Cadastre', d: 'Nome e WhatsApp, à mão ou pelo QR Code que a pessoa lê.' },
              { n: 2, t: 'Mande o link', d: 'Cada Delta tem o link do painel dele. Um clique copia ou manda no WhatsApp.' },
              { n: 3, t: 'Ele planeja', d: 'Desenha o raio no mapa, escolhe os pontos e monta o plano de ação.' }
            ].map((p) => (
              <div key={p.n} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <span className="w-7 h-7 rounded-lg bg-[#FFF3E8] text-[#C2410C] text-[12px] font-black flex items-center justify-center">
                  {p.n}
                </span>
                <p className="mt-3 text-[13px] font-black text-[#0D233A]">{p.t}</p>
                <p className="mt-1 text-[11.5px] text-slate-500 font-semibold leading-snug">{p.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setModal('cadastro')}
              className="h-11 px-5 bg-[#0D233A] hover:bg-[#123255] text-white font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Cadastrar o primeiro
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {deltas.map((d) => {
            const link = linkDoPainelOperacional(d.access_token);
            return (
              <div
                key={d.id}
                className={`bg-white border rounded-3xl shadow-sm p-5 flex flex-col gap-4 transition-opacity ${
                  d.active ? 'border-slate-200' : 'border-slate-200 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Retrato pessoa={d} />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        d.active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      title={d.active ? 'Acesso liberado' : 'Acesso pausado'}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-black text-[#0D233A] truncate">{d.full_name}</p>
                    <p className="text-[12px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {formatarTelefone(d.whatsapp)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider ${
                          d.source === 'qrcode' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-[#015FC9]'
                        }`}
                      >
                        {d.source === 'qrcode' ? 'QR Code' : 'Cadastro manual'}
                      </span>
                      {!d.active && (
                        <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider bg-slate-100 text-slate-500">
                          Acesso pausado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAberto(menuAberto === d.id ? null : d.id);
                      }}
                      className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                      aria-label="Mais ações"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {menuAberto === d.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-10 z-30 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1.5"
                      >
                        <button
                          onClick={() => {
                            setMenuAberto(null);
                            gerarNovoLink(d);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl text-left text-[12px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <KeyRound className="w-4 h-4 text-slate-400" />
                          Gerar novo link
                        </button>
                        <button
                          onClick={() => {
                            setMenuAberto(null);
                            alternarAcesso(d);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl text-left text-[12px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          {d.active ? <Pause className="w-4 h-4 text-slate-400" /> : <Play className="w-4 h-4 text-slate-400" />}
                          {d.active ? 'Pausar acesso' : 'Reativar acesso'}
                        </button>
                        <button
                          onClick={() => {
                            setMenuAberto(null);
                            remover(d);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl text-left text-[12px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">Operações</p>
                    <p className="text-[20px] font-black text-[#0D233A] leading-tight tabular-nums">{opsPorDelta[d.id] || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">Acesso</p>
                    <p className="text-[12px] font-bold text-slate-600 leading-tight mt-1.5">{quandoFoi(d.last_access_at)}</p>
                  </div>
                </div>

                {/* O LINK DO PAINEL: a razão de existir desta ficha */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-2 flex items-center gap-2">
                  <span
                    className="flex-1 min-w-0 px-2 text-[11px] font-semibold text-slate-500 truncate font-mono"
                    title={link}
                  >
                    {link.replace(/^https?:\/\//, '')}
                  </span>
                  <button
                    onClick={() => copiarLink(d)}
                    disabled={!d.active}
                    className={`h-9 px-3.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      copiado === d.id ? 'bg-emerald-500 text-white' : 'bg-[#015FC9] hover:bg-blue-600 text-white'
                    }`}
                  >
                    {copiado === d.id ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado === d.id ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <a
                    href={d.active ? whatsappComLink(d, client.name) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!d.active}
                    className={`flex-1 h-10 rounded-xl border text-[11.5px] font-bold flex items-center justify-center gap-2 no-underline ${
                      d.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                        : 'border-slate-200 text-slate-300 pointer-events-none'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Mandar no WhatsApp
                  </a>
                  <a
                    href={d.active ? link : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!d.active}
                    className={`h-10 px-3.5 rounded-xl border text-[11.5px] font-bold flex items-center justify-center gap-2 no-underline ${
                      d.active
                        ? 'border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                        : 'border-slate-200 text-slate-300 pointer-events-none'
                    }`}
                    title="Abrir o painel numa aba nova"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --------------------------------------------------- operações ---- */}
      {!erro && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
            <div>
              <h3 className="text-[15px] font-black text-[#0D233A]">Operações planejadas</h3>
              <p className="text-[12px] text-slate-400 font-semibold">O que os Deltas Operacionais montaram no mapa</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATUS_DA_OPERACAO) as (keyof typeof STATUS_DA_OPERACAO)[]).map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-lg text-[10.5px] font-black flex items-center gap-1.5"
                  style={{ background: STATUS_DA_OPERACAO[s].fundo, color: STATUS_DA_OPERACAO[s].cor }}
                >
                  <span className="tabular-nums">{contagem[s] || 0}</span>
                  {STATUS_DA_OPERACAO[s].rotulo}
                </span>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div ref={mapaRef} className="relative h-[420px] bg-[#0A1826]">
              <MapaDeOperacoes
                pontos={pontos}
                operacoes={operacoes}
                corDaPrioridade={corDaPrioridade}
                modo="navegar"
                raio={null}
                selecionados={op ? new Set(op.targets.map((a) => `${a.tipo}:${a.id}`)) : undefined}
                operacaoEmFoco={op?.id || null}
                onAbrirOperacao={(id) => {
                  setOpAberta(id);
                  setFichaAberta(true);
                }}
                focar={focar}
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto p-4 space-y-2 border-t lg:border-t-0 lg:border-l border-slate-100">
              {operacoes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 px-6">
                  <MapPin className="w-7 h-7 text-slate-300" />
                  <p className="mt-3 text-[13px] font-black text-slate-600">Nenhuma operação ainda</p>
                  <p className="mt-1 text-[11.5px] text-slate-400 font-semibold leading-snug">
                    Quando um Delta Operacional criar uma operação, ela aparece aqui e no mapa ao lado.
                  </p>
                </div>
              ) : (
                operacoes.map((o) => {
                  const st = STATUS_DA_OPERACAO[o.status] || STATUS_DA_OPERACAO.planejada;
                  const feitas = o.action_plan.filter((e) => e.feita).length;
                  return (
                    <button
                      key={o.id}
                      onClick={() => {
                        setOpAberta(o.id);
                        setFichaAberta(true);
                        setFocar({ lat: o.center.lat, lng: o.center.lng, raio: o.radius, pedido: Date.now() });
                      }}
                      className={`w-full text-left rounded-2xl border p-3.5 transition-colors cursor-pointer relative overflow-hidden ${
                        opAberta === o.id ? 'border-[#015FC9] bg-blue-50/40' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="absolute left-0 inset-y-0 w-1" style={{ background: corDaPrioridade(o.priority) }} />
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-black text-[#0D233A] leading-snug">{o.title}</p>
                        <span
                          className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider shrink-0"
                          style={{ background: st.fundo, color: st.cor }}
                        >
                          {st.rotulo}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {o.targets.length} {o.targets.length === 1 ? 'ponto' : 'pontos'} · {formatarDistancia(o.radius)}
                        {o.action_plan.length > 0 && ` · ${feitas}/${o.action_plan.length} etapas`}
                        {o.due_date && ` · até ${dataCurta(o.due_date)}`}
                      </p>
                      <p className="mt-1 text-[10.5px] font-semibold text-slate-400">
                        por {o.created_by_name || 'Delta removido'} · {dataCurta(o.created_at)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* A ficha da operação, na mesma cara escura que o Delta vê. */}
      {op && fichaAberta && (
        <div className="fixed inset-0 z-[11000] flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setFichaAberta(false)}>
          <div
            className="w-full max-w-[440px] h-full bg-[#081624] text-white shadow-2xl op-nasce"
            onClick={(e) => e.stopPropagation()}
          >
            <DetalheDaOperacao
              op={op}
              niveis={niveis}
              podeEditar
              onVoltar={() => setFichaAberta(false)}
              onStatus={(s) => atualizarAndamento(op, { status: s })}
              onEtapa={(id) =>
                atualizarAndamento(op, {
                  action_plan: op.action_plan.map((e) => (e.id === id ? { ...e, feita: !e.feita } : e))
                })
              }
              onExcluir={() => excluirOperacao(op)}
              onFocarAlvo={(a) => verNoMapa({ lat: a.lat, lng: a.lng, zoom: 17 })}
              onFocarOperacao={() => verNoMapa({ lat: op.center.lat, lng: op.center.lng, raio: op.radius })}
            />
          </div>
        </div>
      )}

      {modal === 'cadastro' && (
        <CadastroModal
          client={client}
          notify={notify}
          onClose={() => setModal(null)}
          onCriado={(d) => setDeltas((l) => [...l, d])}
        />
      )}
      {modal === 'qrcode' && (
        <QrModal
          client={client}
          notify={notify}
          onClose={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Cadastro manual
// ===========================================================================

const fundo = 'fixed inset-0 bg-[#0c1322]/40 backdrop-blur-xs flex items-center justify-center z-[12000] p-4';
const caixa = 'bg-white rounded-3xl w-full shadow-3xl overflow-hidden border border-slate-100 font-sans flex flex-col max-h-[92vh]';
const campo =
  'w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#015FC9]/25 focus:border-[#015FC9]';

function Cabecalho({ titulo, subtitulo, onClose }: { titulo: string; subtitulo: string; onClose: () => void }) {
  return (
    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-black text-slate-800">{titulo}</h3>
        <p className="text-[10px] uppercase tracking-widest text-[#8492A6] font-bold mt-0.5">{subtitulo}</p>
      </div>
      <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Fechar">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Cadastro manual: nome, telefone e a foto se houver. E, no mesmo modal, a
 * entrega do acesso — o cadastro só está pronto quando o link chegou à pessoa.
 */
function CadastroModal({
  client,
  notify,
  onClose,
  onCriado
}: {
  client: Candidate;
  notify: Aviso;
  onClose: () => void;
  onCriado: (d: DeltaOperacional) => void;
}) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [foto, setFoto] = useState<{ arquivo: File; previa: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [criado, setCriado] = useState<DeltaOperacional | null>(null);
  const [copiado, setCopiado] = useState(false);
  const entrada = useRef<HTMLInputElement | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro('Escreva o nome.');
    if (soDigitos(telefone).length < 10) return setErro('Confira o telefone, com DDD.');
    setSalvando(true);
    setErro('');
    let imagem: string | null = null;
    if (foto) {
      const envio = await DatabaseService.uploadMedia(foto.arquivo);
      if (envio.success && envio.url) imagem = envio.url;
      else notify('A foto não subiu; o cadastro segue sem ela.', 'info');
    }
    const res = await DeltaOperacionalService.cadastrar({
      candidateId: client.id,
      nome,
      whatsapp: telefone,
      image: imagem
    });
    setSalvando(false);
    if (!res.success || !res.data) return setErro(res.error || 'Não foi possível cadastrar.');
    onCriado(res.data);
    setCriado(res.data);
  };

  if (criado) {
    const link = linkDoPainelOperacional(criado.access_token);
    return (
      <div className={fundo}>
        <div className={`${caixa} max-w-md`}>
          <Cabecalho titulo="Pronto!" subtitulo="Agora é só entregar o acesso" onClose={onClose} />
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Retrato pessoa={criado} tamanho="w-14 h-14" texto="text-[15px]" />
              <div className="min-w-0">
                <p className="text-[15px] font-black text-[#0D233A] truncate">{criado.full_name}</p>
                <p className="text-[12px] font-semibold text-slate-500">{formatarTelefone(criado.whatsapp)}</p>
              </div>
              <span className="ml-auto w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[3]" />
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8492A6] mb-2">Link do painel</p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11.5px] font-mono text-slate-600 break-all">
                {link}
              </div>
              <p className="mt-2 text-[11.5px] text-slate-400 font-semibold leading-snug">
                Na primeira vez, o painel pede o WhatsApp cadastrado para confirmar
                que é mesmo {criado.full_name.split(' ')[0]}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  if (await copiar(link)) {
                    setCopiado(true);
                    notify('Link copiado.', 'success');
                  }
                }}
                className={`h-11 rounded-xl text-[12px] font-black flex items-center justify-center gap-2 cursor-pointer ${
                  copiado ? 'bg-emerald-500 text-white' : 'bg-[#015FC9] hover:bg-blue-600 text-white'
                }`}
              >
                {copiado ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                {copiado ? 'Copiado' : 'Copiar link'}
              </button>
              <a
                href={whatsappComLink(criado, client.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[12px] font-black flex items-center justify-center gap-2 no-underline"
              >
                <Send className="w-4 h-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={fundo}>
      <form onSubmit={salvar} className={`${caixa} max-w-md`}>
        <Cabecalho titulo="Cadastrar Delta Operacional" subtitulo={`Time de ${client.name}`} onClose={onClose} />
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-[#015FC9] overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Escolher foto"
            >
              {foto ? <img src={foto.previa} alt="" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-slate-400" />}
            </button>
            <div>
              <p className="text-[13px] font-black text-slate-700">
                Foto <span className="text-slate-400 font-semibold">(opcional)</span>
              </p>
              {foto ? (
                <button type="button" onClick={() => setFoto(null)} className="text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer">
                  Tirar foto
                </button>
              ) : (
                <p className="text-[11.5px] text-slate-400 font-semibold">Aparece no painel e nas operações dele.</p>
              )}
            </div>
            <input
              ref={entrada}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = '';
                if (!arquivo) return;
                if (arquivo.size > 8 * 1024 * 1024) return setErro('A foto pode ter até 8 MB.');
                setFoto({ arquivo, previa: URL.createObjectURL(arquivo) });
              }}
            />
          </div>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-widest text-[#8492A6] mb-1.5">Nome</span>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input value={nome} onChange={(e) => { setNome(e.target.value); setErro(''); }} autoFocus placeholder="Nome completo" className={`${campo} pl-10`} />
            </div>
          </label>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-widest text-[#8492A6] mb-1.5">WhatsApp</span>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                inputMode="tel"
                value={telefone}
                onChange={(e) => { setTelefone(mascararTelefone(e.target.value)); setErro(''); }}
                placeholder="(82) 99999-9999"
                className={`${campo} pl-10 tabular-nums`}
              />
            </div>
            <span className="block mt-1.5 text-[11px] text-slate-400 font-semibold">
              É com ele que a pessoa confirma a entrada no painel.
            </span>
          </label>
          {erro && (
            <p className="text-[12px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{erro}</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl text-[12px] font-bold text-slate-500 hover:bg-slate-50 cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="h-11 px-5 rounded-xl bg-[#0D233A] hover:bg-[#123255] disabled:opacity-60 text-white text-[12px] font-black flex items-center gap-2 cursor-pointer"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Cadastrar e gerar link
          </button>
        </div>
      </form>
    </div>
  );
}

// ===========================================================================
// QR Code de uso único
// ===========================================================================

const PRAZOS = [
  { minutos: 10, rotulo: '10 minutos' },
  { minutos: 30, rotulo: '30 minutos' },
  { minutos: 60, rotulo: '1 hora' },
  { minutos: 60 * 24, rotulo: '24 horas' },
  { minutos: 60 * 24 * 7, rotulo: '7 dias' }
];

function QrModal({ client, notify, onClose }: { client: Candidate; notify: Aviso; onClose: () => void }) {
  const [convites, setConvites] = useState<any[]>([]);
  const [nota, setNota] = useState('');
  const [minutos, setMinutos] = useState(30);
  const [gerando, setGerando] = useState(false);
  const [ativo, setAtivo] = useState<any>(null);
  const [imagem, setImagem] = useState('');
  const [agora, setAgora] = useState(Date.now());

  const carregar = useCallback(async () => {
    const res = await DeltaOperacionalService.listarConvites(client.id);
    if (res.success) {
      setConvites(res.data);
      // O QR aberto acompanha o que aconteceu com ele: usado, some da tela.
      setAtivo((a: any) => (a ? res.data.find((c: any) => c.id === a.id) || a : a));
    }
  }, [client.id]);

  useEffect(() => {
    carregar();
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    const r = window.setInterval(carregar, 5000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(r);
    };
  }, [carregar]);

  useEffect(() => {
    if (!ativo) return setImagem('');
    QRCode.toDataURL(linkDoCadastroOperacional(ativo.token), { width: 320, margin: 1, color: { dark: '#0D233A' } })
      .then(setImagem)
      .catch(() => setImagem(''));
  }, [ativo?.token]);

  const expirado = (c: any) => !!c.expires_at && new Date(c.expires_at).getTime() <= agora;
  const situacao = (c: any) =>
    c.used_at ? 'Utilizado' : c.revoked_at ? 'Cancelado' : expirado(c) ? 'Expirado' : 'Aguardando';
  const restante = (c: any) => {
    const ms = new Date(c.expires_at).getTime() - agora;
    if (ms <= 0) return '';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const gerar = async () => {
    setGerando(true);
    const res = await DeltaOperacionalService.criarConvite(client.id, nota.trim(), minutos);
    setGerando(false);
    if (!res.success || !res.data) return notify(res.error || 'Não foi possível gerar.', 'error');
    setNota('');
    setAtivo(res.data);
    carregar();
  };

  const usado = ativo?.used_at;

  return (
    <div className={fundo}>
      <div className={`${caixa} max-w-2xl`}>
        <Cabecalho titulo="QR Code do Delta Operacional" subtitulo={`Um QR por pessoa · ${client.name}`} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Para quem é este QR? (opcional)" className={campo} />
            <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} className={`${campo} sm:w-48 cursor-pointer`}>
              {PRAZOS.map((p) => (
                <option key={p.minutos} value={p.minutos}>
                  Vale por {p.rotulo}
                </option>
              ))}
            </select>
            <button
              onClick={gerar}
              disabled={gerando}
              className="h-11 px-5 bg-[#0D233A] hover:bg-[#123255] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              Gerar QR Code
            </button>
          </div>

          {ativo && (
            <div className="rounded-3xl bg-[#081624] text-white p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-52 h-52 rounded-2xl bg-white p-3 shrink-0">
                {imagem ? (
                  <img src={imagem} alt="QR Code do cadastro" className={`w-full h-full ${usado ? 'opacity-15' : ''}`} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
                {usado && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-xl">
                      <Check className="w-8 h-8 text-white stroke-[3]" />
                    </span>
                    <span className="mt-2 text-[12px] font-black text-emerald-700">Cadastro feito</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FDBA74]">Aponte a câmera</p>
                <p className="mt-2 text-[16px] font-black leading-snug">
                  {usado
                    ? 'Pronto! A pessoa já está cadastrada e entrou direto no painel.'
                    : `Mostre para ${ativo.note || 'a pessoa'}. Ela se cadastra e já cai no painel dela.`}
                </p>
                {!usado && !expirado(ativo) && (
                  <p className="mt-2 text-[12px] font-semibold text-slate-400">
                    Vale para uma pessoa só · expira em{' '}
                    <span className="font-mono text-[#FDBA74]">{restante(ativo)}</span>
                  </p>
                )}
                {expirado(ativo) && !usado && <p className="mt-2 text-[12px] font-bold text-rose-300">Este QR expirou.</p>}
                {!usado && (
                  <button
                    onClick={async () => {
                      if (await copiar(linkDoCadastroOperacional(ativo.token))) notify('Link do cadastro copiado.', 'success');
                    }}
                    className="mt-4 h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-black flex items-center gap-1.5 cursor-pointer mx-auto sm:mx-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar link do cadastro
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-extrabold text-[11px] text-[#0D233A] uppercase tracking-widest">Convites ({convites.length})</h4>
            {convites.length === 0 ? (
              <p className="text-[11.5px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center font-semibold">
                Nenhum QR Code gerado ainda.
              </p>
            ) : (
              convites.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      c.used_at
                        ? 'bg-emerald-50 text-emerald-700'
                        : c.revoked_at || expirado(c)
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {situacao(c)}
                  </span>
                  <span className="flex-1 text-xs font-bold text-slate-700 truncate">{c.note || 'Sem identificação'}</span>
                  {!c.used_at && !c.revoked_at && !expirado(c) && (
                    <>
                      <span className="text-[10px] font-black font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">{restante(c)}</span>
                      <button onClick={() => setAtivo(c)} className="text-[10px] font-black uppercase tracking-wider text-[#015FC9] cursor-pointer">
                        Ver QR
                      </button>
                      <button
                        onClick={async () => {
                          const r = await DeltaOperacionalService.cancelarConvite(c.id);
                          if (!r.success) return notify('Não foi possível cancelar.', 'error');
                          if (ativo?.id === c.id) setAtivo(null);
                          carregar();
                        }}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Cancelar convite"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
