import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CircleDot,
  Crosshair,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';
import { PriorityLevel } from '../../types';
import { COR_DO_TURNO, NOME_DO_TURNO, TURNOS, TurnoId } from '../../turnos';
import {
  EtapaDoPlano,
  PontoDoMapa,
  distanciaEmMetros,
  formatarDistancia,
  novoId
} from '../../services/deltaOperacional';
import { Raio, chaveDoPonto } from './MapaDeOperacoes';

export interface RascunhoDaOperacao {
  title: string;
  objective: string;
  priority: string;
  turno: TurnoId | '';
  due_date: string;
  etapas: EtapaDoPlano[];
}

export const RASCUNHO_VAZIO: RascunhoDaOperacao = {
  title: '',
  objective: '',
  priority: '',
  turno: '',
  due_date: '',
  etapas: []
};

/** Etapas que quase toda operação tem: um clique em vez de digitar. */
const SUGESTOES = [
  'Reunir a equipe no ponto de encontro',
  'Percorrer os pontos escolhidos',
  'Registrar check-in com foto em cada ponto',
  'Conversar com os moradores e anotar demandas',
  'Relatar o resultado à coordenação'
];

const PASSOS = [
  { id: 1, rotulo: 'Raio' },
  { id: 2, rotulo: 'Pontos' },
  { id: 3, rotulo: 'Plano' }
] as const;

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * O assistente de nova operação, na lateral do painel.
 *
 * Três passos, na ordem em que a operação se pensa: ONDE (o raio), O QUÊ (os
 * pontos dentro dele) e COMO (o plano). O mapa acompanha cada passo — é nele
 * que o raio se desenha e os pontos se escolhem; a lateral diz o que fazer e
 * mostra a conta.
 *
 * A barra de baixo mostra sempre o resumo — raio e pontos — porque é o que
 * quem planeja confere antes de cada "continuar".
 */
export default function CriarOperacao({
  passo,
  onPasso,
  raio,
  onRaio,
  onRedesenhar,
  pontosDentro,
  selecionados,
  onAlternar,
  onMarcar,
  niveis,
  dados,
  onDados,
  salvando,
  onSalvar,
  onCancelar,
  editando,
  onFocarPonto
}: {
  passo: 1 | 2 | 3;
  onPasso: (p: 1 | 2 | 3) => void;
  raio: Raio | null;
  onRaio: (r: Raio) => void;
  onRedesenhar: () => void;
  pontosDentro: PontoDoMapa[];
  selecionados: Set<string>;
  onAlternar: (chave: string) => void;
  onMarcar: (chaves: string[], marcar: boolean) => void;
  niveis: PriorityLevel[];
  dados: RascunhoDaOperacao;
  onDados: (d: RascunhoDaOperacao) => void;
  salvando: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
  editando: boolean;
  onFocarPonto: (p: PontoDoMapa) => void;
}) {
  const [filtro, setFiltro] = useState<'todos' | 'pin' | 'checkin'>('todos');
  const [etapaNova, setEtapaNova] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const campoEtapa = useRef<HTMLInputElement | null>(null);

  const escolhidos = pontosDentro.filter((p) => selecionados.has(chaveDoPonto(p)));
  const porDistancia = [...pontosDentro]
    .map((p) => ({ p, d: raio ? distanciaEmMetros(raio.center, p) : 0 }))
    .sort((a, b) => a.d - b.d);
  const visiveis = porDistancia.filter(({ p }) => filtro === 'todos' || p.tipo === filtro);
  const qtd = {
    pin: pontosDentro.filter((p) => p.tipo === 'pin').length,
    checkin: pontosDentro.filter((p) => p.tipo === 'checkin').length
  };
  const naoEscolhidos = pontosDentro.filter((p) => !selecionados.has(chaveDoPonto(p)));

  const faltaTitulo = !dados.title.trim();
  const faltaPrioridade = !dados.priority;
  const podeSalvar = !faltaTitulo && !faltaPrioridade && escolhidos.length > 0 && !!raio;

  const mudar = (parcial: Partial<RascunhoDaOperacao>) => onDados({ ...dados, ...parcial });

  const adicionarEtapa = (texto: string) => {
    const t = texto.trim();
    if (!t) return;
    mudar({ etapas: [...dados.etapas, { id: novoId(), texto: t, feita: false }] });
  };

  const moverEtapa = (i: number, passoDe: -1 | 1) => {
    const lista = [...dados.etapas];
    const j = i + passoDe;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    mudar({ etapas: lista });
  };

  const area = raio ? Math.PI * (raio.radius / 1000) ** 2 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* ------------------------------------------------ cabeçalho ---- */}
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cancelar
          </button>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FDBA74]">
            {editando ? 'Editar operação' : 'Nova operação'}
          </span>
        </div>

        {/* Os passos, clicáveis para trás */}
        <div className="mt-4 flex items-center gap-2">
          {PASSOS.map((p, i) => {
            const feito = passo > p.id;
            const atual = passo === p.id;
            const alcancavel = p.id < passo || (p.id === 2 && !!raio) || (p.id === 3 && !!raio && escolhidos.length > 0);
            return (
              <React.Fragment key={p.id}>
                {i > 0 && (
                  <span className={`flex-1 h-px ${passo > i ? 'bg-[#F58220]' : 'bg-white/10'}`} />
                )}
                <button
                  type="button"
                  disabled={!alcancavel}
                  onClick={() => onPasso(p.id)}
                  className="flex items-center gap-2 cursor-pointer disabled:cursor-default"
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-colors ${
                      atual
                        ? 'bg-[#F58220] text-white shadow-[0_0_0_4px_rgba(245,130,32,0.18)]'
                        : feito
                          ? 'bg-[#F58220]/20 text-[#FDBA74]'
                          : 'bg-white/[0.06] text-slate-500'
                    }`}
                  >
                    {feito ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : p.id}
                  </span>
                  <span
                    className={`text-[11.5px] font-bold ${atual ? 'text-white' : 'text-slate-500'}`}
                  >
                    {p.rotulo}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------- corpo ---- */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        {/* PASSO 1 — O RAIO */}
        {passo === 1 && (
          <div className="space-y-5 op-nasce">
            <div>
              <h2 className="text-[19px] font-black tracking-tight">Onde vai ser a operação?</h2>
              <p className="mt-1.5 text-[12.5px] text-slate-400 leading-relaxed">
                Desenhe o raio no mapa. Tudo que ficar dentro dele pode entrar
                na operação.
              </p>
            </div>

            {!raio ? (
              <div className="rounded-2xl border border-dashed border-[#F58220]/40 bg-[#F58220]/[0.06] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#F58220]/20 text-[#FDBA74] flex items-center justify-center shrink-0 text-[12px] font-black">
                    1
                  </span>
                  <p className="text-[12.5px] text-slate-300 leading-snug pt-1">
                    <strong className="text-white">Clique no mapa</strong> onde fica o
                    centro da operação.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#F58220]/20 text-[#FDBA74] flex items-center justify-center shrink-0 text-[12px] font-black">
                    2
                  </span>
                  <p className="text-[12.5px] text-slate-300 leading-snug pt-1">
                    <strong className="text-white">Mova o cursor</strong> para abrir o raio
                    e <strong className="text-white">clique de novo</strong> para fechar.
                  </p>
                </div>
                <p className="flex items-center gap-2 text-[11px] font-bold text-[#FDBA74] pt-1">
                  <Crosshair className="w-3.5 h-3.5 animate-pulse" />
                  O mapa está esperando o seu clique
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Raio
                    </p>
                    <p className="text-[34px] font-black tabular-nums leading-none mt-1">
                      {formatarDistancia(raio.radius)}
                    </p>
                  </div>
                  <p className="text-right text-[11px] font-semibold text-slate-400 leading-snug">
                    {area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km²
                    <br />
                    <span className="text-white font-black">{pontosDentro.length}</span>{' '}
                    {pontosDentro.length === 1 ? 'ponto dentro' : 'pontos dentro'}
                  </p>
                </div>
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={10}
                  value={Math.min(5000, raio.radius)}
                  onChange={(e) => onRaio({ ...raio, radius: Number(e.target.value) })}
                  className="op-regua mt-4 w-full"
                  aria-label="Tamanho do raio"
                />
                <div className="mt-1 flex justify-between text-[9.5px] font-bold text-slate-600 tabular-nums">
                  <span>50 m</span>
                  <span>5 km</span>
                </div>
                <p className="mt-3 text-[11px] text-slate-500 leading-snug">
                  No mapa, arraste a alça do centro para mover e a da borda para
                  mudar o tamanho.
                </p>
                <button
                  type="button"
                  onClick={onRedesenhar}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Desenhar outro raio
                </button>
              </div>
            )}
          </div>
        )}

        {/* PASSO 2 — OS PONTOS */}
        {passo === 2 && (
          <div className="space-y-4 op-nasce">
            <div>
              <h2 className="text-[19px] font-black tracking-tight">Quais pontos entram?</h2>
              <p className="mt-1.5 text-[12.5px] text-slate-400 leading-relaxed">
                Clique nos pontos do mapa ou marque aqui. Só entra o que está
                dentro do raio.
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'todos', rotulo: 'Todos', n: pontosDentro.length },
                  { id: 'pin', rotulo: 'Pontos', n: qtd.pin },
                  { id: 'checkin', rotulo: 'Check-ins', n: qtd.checkin }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    filtro === f.id
                      ? 'bg-white text-slate-900'
                      : 'bg-white/[0.05] text-slate-400 hover:text-white'
                  }`}
                >
                  {f.rotulo}
                  <span className={`tabular-nums ${filtro === f.id ? 'text-slate-500' : 'text-slate-600'}`}>
                    {f.n}
                  </span>
                </button>
              ))}
            </div>

            {pontosDentro.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold text-slate-300">
                  <span className="text-[#FDBA74] font-black tabular-nums">{escolhidos.length}</span>{' '}
                  de {pontosDentro.length} escolhidos
                </p>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => onMarcar(visiveis.map(({ p }) => chaveDoPonto(p)), true)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarcar(visiveis.map(({ p }) => chaveDoPonto(p)), false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Nenhum
                  </button>
                </div>
              </div>
            )}

            {naoEscolhidos.length > 0 && escolhidos.length > 0 && (
              <button
                type="button"
                onClick={() => onMarcar(naoEscolhidos.map(chaveDoPonto), true)}
                className="w-full rounded-xl border border-[#F58220]/30 bg-[#F58220]/[0.07] px-3 py-2.5 text-left text-[11.5px] font-semibold text-[#FDBA74] flex items-center gap-2 cursor-pointer hover:bg-[#F58220]/[0.12]"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                {naoEscolhidos.length === 1
                  ? '1 ponto dentro do raio ficou de fora — incluir'
                  : `${naoEscolhidos.length} pontos dentro do raio ficaram de fora — incluir todos`}
              </button>
            )}

            {pontosDentro.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
                <CircleDot className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="mt-2 text-[12.5px] font-bold text-slate-300">Nenhum ponto neste raio</p>
                <p className="mt-1 text-[11.5px] text-slate-500 leading-snug">
                  Estique o raio pela alça da borda, ou mova-o pela alça do centro.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {visiveis.map(({ p, d }) => {
                  const chave = chaveDoPonto(p);
                  const marcado = selecionados.has(chave);
                  return (
                    <li key={chave}>
                      <div
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors cursor-pointer ${
                          marcado
                            ? 'bg-[#F58220]/[0.09] border-[#F58220]/35'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                        }`}
                        onClick={() => onAlternar(chave)}
                      >
                        <span
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            marcado ? 'bg-[#F58220] border-[#F58220]' : 'border-slate-600'
                          }`}
                        >
                          {marcado && <Check className="w-3 h-3 text-white stroke-[3.5]" />}
                        </span>
                        {p.tipo === 'pin' ? (
                          <MapPin className="w-4 h-4 shrink-0" style={{ color: p.cor }} />
                        ) : (
                          <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/25" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-bold text-white truncate">{p.titulo}</span>
                          <span className="block text-[10.5px] font-semibold text-slate-500 truncate">
                            {p.detalhe || (p.tipo === 'pin' ? 'Ponto estratégico' : 'Check-in')}
                          </span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 tabular-nums shrink-0">
                          {formatarDistancia(d)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocarPonto(p);
                          }}
                          title="Ver no mapa"
                          className="w-7 h-7 -mr-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <LocateFixed className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* PASSO 3 — O PLANO */}
        {passo === 3 && (
          <div className="space-y-5 op-nasce">
            <div>
              <h2 className="text-[19px] font-black tracking-tight">Qual é o plano?</h2>
              <p className="mt-1.5 text-[12.5px] text-slate-400 leading-relaxed">
                Dê um nome, diga a urgência e escreva as etapas na ordem em que
                a equipe vai cumprir.
              </p>
            </div>

            <Rotulo texto="Título da operação" obrigatorio erro={tentouSalvar && faltaTitulo}>
              <input
                value={dados.title}
                onChange={(e) => mudar({ title: e.target.value })}
                placeholder="Ex.: Mutirão da Rua Nova"
                maxLength={120}
                autoFocus
                className={`op-campo ${tentouSalvar && faltaTitulo ? 'op-campo-erro' : ''}`}
              />
            </Rotulo>

            <Rotulo texto="Grau de prioridade" obrigatorio erro={tentouSalvar && faltaPrioridade}>
              {niveis.length === 0 ? (
                <p className="text-[11.5px] text-slate-500">Nenhum nível cadastrado pela coordenação.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {niveis.map((n) => {
                    const ativo = dados.priority === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => mudar({ priority: n.id })}
                        title={n.description || n.label}
                        className="h-11 rounded-xl border px-3 flex items-center gap-2 text-[12px] font-bold cursor-pointer transition-all"
                        style={{
                          borderColor: ativo ? n.color : 'rgba(255,255,255,0.08)',
                          background: ativo ? `${n.color}26` : 'rgba(255,255,255,0.02)',
                          color: ativo ? '#fff' : '#94A3B8',
                          boxShadow: ativo ? `0 0 0 3px ${n.color}22` : undefined
                        }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: n.color }} />
                        <span className="truncate">{n.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Rotulo>

            <div className="grid grid-cols-2 gap-3">
              <Rotulo texto="Turno">
                <div className="flex gap-1">
                  {TURNOS.map((t) => {
                    const ativo = dados.turno === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => mudar({ turno: ativo ? '' : t })}
                        className="flex-1 h-11 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors"
                        style={{
                          borderColor: ativo ? COR_DO_TURNO[t] : 'rgba(255,255,255,0.08)',
                          background: ativo ? `${COR_DO_TURNO[t]}33` : 'rgba(255,255,255,0.02)',
                          color: ativo ? '#fff' : '#94A3B8'
                        }}
                      >
                        {NOME_DO_TURNO[t]}
                      </button>
                    );
                  })}
                </div>
              </Rotulo>
              <Rotulo texto="Prazo">
                <input
                  type="date"
                  value={dados.due_date}
                  min={editando ? undefined : hoje()}
                  onChange={(e) => mudar({ due_date: e.target.value })}
                  className="op-campo [color-scheme:dark]"
                />
              </Rotulo>
            </div>

            <Rotulo texto="Objetivo">
              <textarea
                value={dados.objective}
                onChange={(e) => mudar({ objective: e.target.value })}
                placeholder="O que esta operação precisa deixar resolvido?"
                rows={3}
                className="op-campo !h-auto py-3 resize-y leading-snug"
              />
            </Rotulo>

            <Rotulo texto={`Plano de ação${dados.etapas.length ? ` · ${dados.etapas.length} etapas` : ''}`}>
              {dados.etapas.length > 0 && (
                <ol className="space-y-1.5 mb-2">
                  {dados.etapas.map((e, i) => (
                    <li
                      key={e.id}
                      className="group flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.07] pl-2 pr-1 py-1"
                    >
                      <span className="w-6 h-6 rounded-lg bg-[#F58220]/15 text-[#FDBA74] text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <input
                        value={e.texto}
                        onChange={(ev) =>
                          mudar({
                            etapas: dados.etapas.map((x) =>
                              x.id === e.id ? { ...x, texto: ev.target.value } : x
                            )
                          })
                        }
                        className="flex-1 min-w-0 h-8 bg-transparent text-[12.5px] font-semibold text-white focus:outline-none"
                      />
                      <span className="flex items-center opacity-60 group-hover:opacity-100">
                        <button type="button" onClick={() => moverEtapa(i, -1)} disabled={i === 0} title="Subir" className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 flex items-center justify-center cursor-pointer">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => moverEtapa(i, 1)} disabled={i === dados.etapas.length - 1} title="Descer" className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 flex items-center justify-center cursor-pointer">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => mudar({ etapas: dados.etapas.filter((x) => x.id !== e.id) })}
                          title="Tirar etapa"
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex gap-2">
                <input
                  ref={campoEtapa}
                  value={etapaNova}
                  onChange={(e) => setEtapaNova(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      adicionarEtapa(etapaNova);
                      setEtapaNova('');
                    }
                  }}
                  placeholder={dados.etapas.length ? 'Próxima etapa' : 'Primeira etapa do plano'}
                  className="op-campo flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    adicionarEtapa(etapaNova);
                    setEtapaNova('');
                    campoEtapa.current?.focus();
                  }}
                  disabled={!etapaNova.trim()}
                  className="w-11 h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer"
                  title="Adicionar etapa (Enter)"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {(() => {
                const livres = SUGESTOES.filter(
                  (s) => !dados.etapas.some((e) => e.texto.trim() === s)
                );
                if (livres.length === 0) return null;
                return (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {livres.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => adicionarEtapa(s)}
                        className="h-7 px-2.5 rounded-lg border border-white/[0.08] text-[10.5px] font-semibold text-slate-400 hover:text-white hover:border-[#F58220]/40 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        {s}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </Rotulo>
          </div>
        )}
      </div>

      {/* ------------------------------------------------- rodapé ---- */}
      <div className="px-5 py-4 border-t border-white/[0.06] bg-[#06111D]">
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 mb-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border-2 border-[#F58220]" />
            {raio ? formatarDistancia(raio.radius) : 'sem raio'}
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span>
            <span className="text-white tabular-nums">{escolhidos.length}</span>{' '}
            {escolhidos.length === 1 ? 'ponto' : 'pontos'}
          </span>
          {passo === 3 && tentouSalvar && !podeSalvar && (
            <span className="ml-auto text-rose-300">
              {faltaTitulo ? 'Falta o título' : faltaPrioridade ? 'Falta a prioridade' : 'Falta ponto'}
            </span>
          )}
        </div>
        {passo < 3 ? (
          <button
            type="button"
            disabled={!raio || (passo === 2 && escolhidos.length === 0)}
            onClick={() => onPasso((passo + 1) as 2 | 3)}
            className="op-botao-principal"
          >
            {passo === 1 ? 'Escolher os pontos' : 'Montar o plano'}
            <ArrowRight className="w-4 h-4 stroke-[2.75]" />
          </button>
        ) : (
          <button
            type="button"
            disabled={salvando}
            onClick={() => {
              setTentouSalvar(true);
              if (podeSalvar) onSalvar();
            }}
            className="op-botao-principal"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando
              </>
            ) : (
              <>
                {editando ? 'Salvar alterações' : 'Criar operação'}
                <Check className="w-4 h-4 stroke-[3]" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Rotulo({
  texto,
  obrigatorio,
  erro,
  children
}: {
  texto: string;
  obrigatorio?: boolean;
  erro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={`mb-2 text-[10px] font-black uppercase tracking-[0.16em] ${erro ? 'text-rose-300' : 'text-slate-500'}`}>
        {texto}
        {obrigatorio && <span className="text-[#F58220]"> *</span>}
      </p>
      {children}
    </div>
  );
}
