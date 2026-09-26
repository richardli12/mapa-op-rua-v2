import React, { useEffect, useRef } from 'react';
import { CalendarDays, ChevronDown, RotateCcw, AlertTriangle, Clock, CalendarClock, CalendarOff, Layers, Check, Star } from 'lucide-react';

/** Situação do prazo de uma missão, do ponto de vista de hoje. */
export type SituacaoDePrazo = 'atrasada' | 'hoje' | 'proximos' | 'sem';

export interface EstadoDoPeriodo {
  de: string;
  ate: string;
  /** Camadas ligadas. Desligar uma tira ela do mapa, período ou não. */
  verCheckIns: boolean;
  verMissoes: boolean;
  /** Só os check-ins com estrela. Liga junto com as missões desligadas. */
  soFavoritos: boolean;
  prazos: SituacaoDePrazo[];
}

interface Props {
  aberto: boolean;
  onAbrir: (aberto: boolean) => void;
  valor: EstadoDoPeriodo;
  onMudar: (novo: EstadoDoPeriodo) => void;
  /** Quanto sobrou e quanto existe, para a barra dizer o que escondeu. */
  contagem: {
    checkInsVisiveis: number;
    checkInsTotal: number;
    missoesVisiveis: number;
    missoesTotal: number;
    /** Favoritos dentro do recorte de data. */
    favoritos: number;
  };
  /** O corte de favoritos é o da coroa: a pastilha diz "super favoritos". */
  soSuper?: boolean;
}

/** Data no formato do <input type="date">, no fuso de quem está olhando. */
const dia = (data: Date) => data.toLocaleDateString('sv-SE');

export const hojeISO = () => dia(new Date());

const somarDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return dia(d);
};

/** Primeiro e último dia do mês, N meses atrás. */
const mes = (atras: number) => {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - atras, 1);
  const fim = new Date(agora.getFullYear(), agora.getMonth() - atras + 1, 0);
  return { de: dia(inicio), ate: dia(fim) };
};

/**
 * Os cortes de calendário que um dia de operação pede.
 *
 * Não é uma lista de conveniências: é a rotina. De manhã se olha "hoje";
 * na reunião do fim do dia, "ontem"; na cobrança de resultado, a semana e o
 * mês; no fechamento, o mês passado. Quem precisa de outro recorte digita
 * nas duas datas.
 */
const ATALHOS: { rotulo: string; calcular: () => { de: string; ate: string } }[] = [
  { rotulo: 'Hoje', calcular: () => ({ de: hojeISO(), ate: hojeISO() }) },
  { rotulo: 'Ontem', calcular: () => ({ de: somarDias(-1), ate: somarDias(-1) }) },
  { rotulo: '7 dias', calcular: () => ({ de: somarDias(-6), ate: hojeISO() }) },
  { rotulo: '30 dias', calcular: () => ({ de: somarDias(-29), ate: hojeISO() }) },
  { rotulo: 'Este mês', calcular: () => mes(0) },
  { rotulo: 'Mês passado', calcular: () => mes(1) }
];

const PRAZOS: { id: SituacaoDePrazo; rotulo: string; cor: string; Icone: typeof Clock }[] = [
  { id: 'atrasada', rotulo: 'Atrasadas', cor: '#dc2626', Icone: AlertTriangle },
  { id: 'hoje', rotulo: 'Para hoje', cor: '#b45309', Icone: Clock },
  { id: 'proximos', rotulo: 'Próximos 7 dias', cor: '#015FC9', Icone: CalendarClock },
  { id: 'sem', rotulo: 'Sem prazo', cor: '#64748b', Icone: CalendarOff }
];

/** 2026-09-22 vira 22/09; o ano só aparece quando não é o corrente. */
const curto = (iso: string) => {
  if (!iso) return '';
  const [ano, m, d] = iso.split('-');
  const anoAtual = String(new Date().getFullYear());
  return ano === anoAtual ? `${d}/${m}` : `${d}/${m}/${ano.slice(2)}`;
};

/** O nome do recorte ligado, do jeito que a pessoa o escolheu. */
export const rotuloDoPeriodo = (de: string, ate: string) => {
  if (!de && !ate) return 'Todo o período';
  const atalho = ATALHOS.find(a => {
    const v = a.calcular();
    return v.de === de && v.ate === ate;
  });
  if (atalho) return atalho.rotulo;
  if (de && ate) return de === ate ? curto(de) : `${curto(de)} – ${curto(ate)}`;
  if (de) return `De ${curto(de)}`;
  return `Até ${curto(ate)}`;
};

/**
 * O relógio do mapa.
 *
 * O mapa mostrava tudo o que já existiu, para sempre: seis meses de
 * check-ins e a missão da eleição passada no mesmo quadro da missão de
 * amanhã. Sem recorte de tempo não dá para responder a pergunta que abre o
 * dia — o que aconteceu ontem, o que está atrasado, o que é para hoje.
 *
 * Fica em cima e sempre visível, nunca escondido num menu: mapa filtrado que
 * parece vazio, sem dizer por quê, faz alguém concluir que a equipe não
 * trabalhou.
 */
export default function FiltroDePeriodo({ aberto, onAbrir, valor, onMudar, contagem, soSuper = false }: Props) {
  const caixa = useRef<HTMLDivElement | null>(null);
  const { de, ate, verCheckIns, verMissoes, prazos, soFavoritos } = valor;

  const ligado =
    !!de || !!ate || prazos.length > 0 || !verCheckIns || !verMissoes || soFavoritos;

  useEffect(() => {
    if (!aberto) return;
    const foraDaCaixa = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) onAbrir(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onAbrir(false);
    document.addEventListener('mousedown', foraDaCaixa);
    window.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa);
      window.removeEventListener('keydown', tecla);
    };
  }, [aberto, onAbrir]);

  const aplicarAtalho = (calcular: () => { de: string; ate: string }) => {
    const v = calcular();
    onMudar({ ...valor, de: v.de, ate: v.ate });
  };

  const atalhoLigado = (calcular: () => { de: string; ate: string }) => {
    const v = calcular();
    return v.de === de && v.ate === ate;
  };

  const alternarPrazo = (id: SituacaoDePrazo) =>
    onMudar({
      ...valor,
      prazos: prazos.includes(id) ? prazos.filter(p => p !== id) : [...prazos, id]
    });

  const limpar = () =>
    onMudar({ de: '', ate: '', verCheckIns: true, verMissoes: true, soFavoritos: false, prazos: [] });

  const escondidos =
    contagem.checkInsTotal -
    contagem.checkInsVisiveis +
    (contagem.missoesTotal - contagem.missoesVisiveis);

  return (
    <div ref={caixa} className="relative font-sans">
      {/* A pastilha: o recorte de agora, sempre à vista. */}
      <button
        type="button"
        onClick={() => onAbrir(!aberto)}
        title="Filtrar por data"
        className={`flex items-center gap-2.5 h-[42px] px-4 rounded-2xl shadow-xl border transition-all cursor-pointer active:scale-95 ${
          ligado
            ? 'bg-[#015FC9] border-[#015FC9] text-white hover:bg-[#0154b3]'
            : 'bg-white border-slate-200/80 text-slate-800 hover:bg-slate-50'
        }`}
      >
        <CalendarDays className={`w-4 h-4 shrink-0 ${ligado ? 'text-white' : 'text-[#015FC9]'}`} />
        <span className="flex flex-col items-start leading-none">
          <span className="text-xs font-bold leading-none">{rotuloDoPeriodo(de, ate)}</span>
          {ligado && (
            <span className="text-[9.5px] font-semibold text-white/75 leading-none mt-1">
              {[
                verCheckIns &&
                  `${contagem.checkInsVisiveis} ${
                    soFavoritos ? (soSuper ? 'super favorito' : 'favorito') : 'check-in'
                  }${contagem.checkInsVisiveis === 1 ? '' : 's'}`,
                verMissoes &&
                  `${contagem.missoesVisiveis} missã${
                    contagem.missoesVisiveis === 1 ? 'o' : 'es'
                  }`
              ]
                .filter(Boolean)
                .join(' · ') || 'mapa sem camadas'}
            </span>
          )}
        </span>
        {prazos.length > 0 && (
          <span className="px-1.5 h-[17px] min-w-[17px] rounded-full bg-white text-[#015FC9] text-[10px] font-black flex items-center justify-center shrink-0">
            {prazos.length}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''} ${
            ligado ? 'text-white/70' : 'text-slate-400'
          }`}
        />
      </button>

      {aberto && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] w-[330px] max-h-[78vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* PERÍODO */}
          <section>
            <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5 mb-2">
              <CalendarDays className="w-3.5 h-3.5" />
              Período
            </h4>

            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={() => onMudar({ ...valor, de: '', ate: '' })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                  !de && !ate
                    ? 'bg-[#015FC9] border-[#015FC9] text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Tudo
              </button>
              {ATALHOS.map(a => (
                <button
                  key={a.rotulo}
                  type="button"
                  onClick={() => aplicarAtalho(a.calcular)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                    atalhoLigado(a.calcular)
                      ? 'bg-[#015FC9] border-[#015FC9] text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[9.5px] uppercase tracking-wider font-black text-slate-400 mb-1">
                  De
                </span>
                <input
                  type="date"
                  value={de}
                  max={ate || undefined}
                  onChange={e => onMudar({ ...valor, de: e.target.value })}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11.5px] font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                />
              </label>
              <label className="block">
                <span className="block text-[9.5px] uppercase tracking-wider font-black text-slate-400 mb-1">
                  Até
                </span>
                <input
                  type="date"
                  value={ate}
                  min={de || undefined}
                  onChange={e => onMudar({ ...valor, ate: e.target.value })}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11.5px] font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                />
              </label>
            </div>
          </section>

          {/* CAMADAS */}
          <section className="pt-3.5 border-t border-slate-100">
            <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5 mb-2">
              <Layers className="w-3.5 h-3.5" />
              Mostrar no mapa
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  chave: 'verCheckIns' as const,
                  rotulo: 'Check-ins',
                  visiveis: contagem.checkInsVisiveis,
                  total: contagem.checkInsTotal
                },
                {
                  chave: 'verMissoes' as const,
                  rotulo: 'Missões',
                  visiveis: contagem.missoesVisiveis,
                  total: contagem.missoesTotal
                }
              ].map(op => {
                const marcado = valor[op.chave];
                return (
                  <button
                    key={op.chave}
                    type="button"
                    onClick={() =>
                      onMudar({
                        ...valor,
                        [op.chave]: !marcado,
                        // Missões de volta desfazem o "só favoritos": favorito
                        // é um corte dos check-ins, não do mapa inteiro.
                        ...(op.chave === 'verMissoes' && !marcado ? { soFavoritos: false } : {}),
                        ...(op.chave === 'verCheckIns' && marcado ? { soFavoritos: false } : {})
                      })
                    }
                    className={`px-3 py-2 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-2 ${
                      marcado
                        ? 'bg-blue-50/70 border-[#015FC9]/40 text-[#0D233A]'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        marcado ? 'bg-[#015FC9] border-[#015FC9]' : 'bg-white border-slate-300'
                      }`}
                    >
                      {marcado && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] font-black leading-none truncate">
                        {op.rotulo}
                      </span>
                      <span className="block text-[10px] font-bold mt-1 leading-none opacity-70">
                        {marcado ? `${op.visiveis} de ${op.total}` : 'oculto'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {verCheckIns && (
              <button
                type="button"
                onClick={() =>
                  onMudar({
                    ...valor,
                    soFavoritos: !soFavoritos,
                    verMissoes: soFavoritos ? valor.verMissoes : false
                  })
                }
                className={`mt-2 w-full px-3 py-2 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-2.5 ${
                  soFavoritos
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200'
                }`}
              >
                <Star
                  className="w-4 h-4 shrink-0"
                  fill={soFavoritos || contagem.favoritos > 0 ? '#FCD34D' : 'none'}
                  color={soFavoritos || contagem.favoritos > 0 ? '#F59E0B' : '#94A3B8'}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[11.5px] font-black leading-none">Só os favoritos</span>
                  <span className="block text-[10px] font-bold mt-1 leading-none opacity-70">
                    {contagem.favoritos} {contagem.favoritos === 1 ? 'check-in com estrela' : 'check-ins com estrela'}
                  </span>
                </span>
                <span
                  className={`w-8 h-[18px] rounded-full flex items-center px-0.5 transition-colors ${
                    soFavoritos ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-3.5 h-3.5 bg-white rounded-full block shadow" />
                </span>
              </button>
            )}
            <p className="text-[10px] text-slate-400 font-semibold leading-snug mt-2">
              Desligar uma camada tira ela do mapa. O que fica é cortado pelo
              período: o check-in pela data em que foi registrado, a missão
              pelo prazo — e, sem prazo, pelo dia em que foi enviada.
            </p>
          </section>

          {/* PRAZO DA MISSÃO */}
          {verMissoes && (
            <section className="pt-3.5 border-t border-slate-100">
              <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">
                Prazo da missão
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {PRAZOS.map(({ id, rotulo, cor, Icone }) => {
                  const marcado = prazos.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => alternarPrazo(id)}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                        marcado
                          ? 'text-white border-transparent'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                      style={marcado ? { backgroundColor: cor } : undefined}
                    >
                      <Icone
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: marcado ? '#ffffff' : cor }}
                      />
                      <span className="truncate">{rotulo}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 font-semibold leading-snug mt-2">
                Vale só para as missões, e é independente do período: dá para
                ver o que está atrasado sem mexer nas datas acima.
              </p>
            </section>
          )}

          {/* RODAPÉ */}
          <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-slate-500 leading-tight">
              {escondidos > 0 ? (
                <>
                  <span className="text-slate-800 font-black">{escondidos}</span> fora
                  do recorte
                </>
              ) : (
                'Nada está escondido'
              )}
            </p>
            <button
              type="button"
              onClick={limpar}
              disabled={!ligado}
              className="h-8 px-3 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:border-slate-200 disabled:cursor-not-allowed text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A missão entra no período por qual data?
 *
 * Pelo prazo, quando ele existe: é o dia em que a missão acontece, e é isso
 * que alguém quer ver ao pedir "esta semana". Sem prazo, vale o dia em que
 * ela foi enviada — é a única data que ela tem.
 */
export const diaDaMissao = (prazo?: string, criadaEm?: string) => {
  if (prazo) return prazo;
  if (!criadaEm) return '';
  const d = new Date(criadaEm);
  return Number.isNaN(d.getTime()) ? '' : dia(d);
};

/** A missão passa pelos chips de prazo ligados? Nenhum ligado deixa passar. */
export const passaNoPrazo = (prazo: string | undefined, selecionados: SituacaoDePrazo[]) => {
  if (selecionados.length === 0) return true;
  const hoje = hojeISO();
  const limite = somarDias(7);
  if (!prazo) return selecionados.includes('sem');
  if (prazo < hoje) return selecionados.includes('atrasada');
  if (prazo === hoje) return selecionados.includes('hoje');
  if (prazo <= limite) return selecionados.includes('proximos');
  return false;
};
