import React, { useEffect, useRef } from 'react';
import {
  Layers3,
  ChevronDown,
  Users,
  Home,
  Gauge,
  Vote,
  Loader2,
  AlertTriangle
} from 'lucide-react';

/** Qual número pinta as áreas. `null` é o mapa sem mancha nenhuma. */
export type MetricaDaCamada = 'populacao' | 'domicilios' | 'densidade' | null;

export interface EstadoDasCamadas {
  metrica: MetricaDaCamada;
  /** O recorte que é desenhado: o bairro inteiro ou o setor censitário. */
  nivel: 'bairros' | 'setores';
  /** 0 a 1. A mancha é contexto; quem manda na força dela é quem olha. */
  opacidade: number;
}

interface Props {
  aberto: boolean;
  onAbrir: (aberto: boolean) => void;
  valor: EstadoDasCamadas;
  onMudar: (novo: EstadoDasCamadas) => void;
  /** O painel de análise, que é a camada mais funda desta mesma gaveta. */
  inteligenciaAberta: boolean;
  onInteligencia: (aberta: boolean) => void;
  /** O que a camada está fazendo agora, contado por quem carrega os dados. */
  estado?: {
    carregando: boolean;
    progresso: { lidos: number; total: number } | null;
    municipio: string | null;
    desenhados: number;
    erro: string | null;
  };
}

const CAMADAS: {
  id: Exclude<MetricaDaCamada, null>;
  rotulo: string;
  Icone: typeof Users;
}[] = [
  { id: 'populacao', rotulo: 'População', Icone: Users },
  { id: 'domicilios', rotulo: 'Domicílios', Icone: Home },
  { id: 'densidade', rotulo: 'Densidade (hab/km²)', Icone: Gauge }
];

/** A chavinha. Uma só forma para todas as linhas da gaveta. */
function Chave({ ligada }: { ligada: boolean }) {
  return (
    <span
      className={`w-[38px] h-[22px] rounded-full shrink-0 relative transition-colors ${
        ligada ? 'bg-[#015FC9]' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
          ligada ? 'left-[19px]' : 'left-[3px]'
        }`}
      />
    </span>
  );
}

/**
 * As camadas de inteligência do mapa, numa gaveta ao lado do filtro de data.
 *
 * Elas viviam dentro do painel de meia tela: para trocar de população para
 * densidade era preciso abrir o painel, achar a aba e mexer lá dentro — com o
 * painel tapando metade do mapa que a troca ia mudar. Ligar uma camada é
 * gesto de barra, não de painel: fica ao lado do recorte de data, que é o
 * outro filtro do que se vê.
 *
 * Só uma métrica pinta por vez, e por isso as chaves se apagam entre si:
 * duas manchas de cor no mesmo polígono não são duas informações, são
 * nenhuma. Desligar a que está ligada devolve o mapa limpo.
 */
export default function CamadasDeInteligencia({
  aberto,
  onAbrir,
  valor,
  onMudar,
  inteligenciaAberta,
  onInteligencia,
  estado
}: Props) {
  const caixa = useRef<HTMLDivElement | null>(null);

  // Clique fora e Esc fecham: gaveta que só fecha no próprio botão é armadilha
  // para quem já voltou a atenção para o mapa.
  useEffect(() => {
    if (!aberto) return;
    const foraDaCaixa = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) onAbrir(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAbrir(false);
    };
    document.addEventListener('mousedown', foraDaCaixa);
    window.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa);
      window.removeEventListener('keydown', tecla);
    };
  }, [aberto, onAbrir]);

  const ligado = valor.metrica !== null || inteligenciaAberta;
  const carregando = !!estado?.carregando && valor.metrica !== null;

  const alternar = (id: Exclude<MetricaDaCamada, null>) =>
    onMudar({ ...valor, metrica: valor.metrica === id ? null : id });

  return (
    <div ref={caixa} className="relative font-sans">
      <button
        type="button"
        onClick={() => onAbrir(!aberto)}
        title="Camadas de inteligência do território"
        className={`flex items-center gap-2.5 h-[42px] px-4 rounded-2xl shadow-xl border transition-all cursor-pointer active:scale-95 ${
          ligado
            ? 'bg-[#0D233A] border-[#0D233A] text-white hover:bg-[#123054]'
            : 'bg-white border-slate-200/80 text-slate-800 hover:bg-slate-50'
        }`}
      >
        {/* O botão conta que está trabalhando: gaveta fechada e mapa ainda
            limpo é o momento em que a pessoa acha que o sistema quebrou. */}
        {carregando ? (
          <Loader2 className="w-4 h-4 shrink-0 animate-spin text-white" />
        ) : (
          <Layers3
            className={`w-4 h-4 shrink-0 ${ligado ? 'text-white' : 'text-[#0D9488]'}`}
          />
        )}
        <span className="text-xs font-bold leading-none">Camadas de Inteligência</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            aberto ? 'rotate-180' : ''
          } ${ligado ? 'text-white/70' : 'text-slate-400'}`}
        />
      </button>

      {aberto && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] w-[320px] bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="divide-y divide-slate-100">
            {CAMADAS.map(({ id, rotulo, Icone }) => {
              const ligada = valor.metrica === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => alternar(id)}
                  className="w-full flex items-center gap-2.5 px-1.5 py-2.5 cursor-pointer group"
                >
                  <Icone
                    className={`w-4 h-4 shrink-0 ${
                      ligada ? 'text-[#015FC9]' : 'text-slate-300'
                    }`}
                  />
                  <span
                    className={`text-[12.5px] font-bold text-left flex-1 min-w-0 truncate ${
                      ligada ? 'text-[#0D233A]' : 'text-slate-500'
                    }`}
                  >
                    {rotulo}
                  </span>
                  {/* A etiqueta responde "e daí?" sem precisar de legenda. */}
                  {ligada && (
                    <span className="flex items-center gap-1 px-2 h-[19px] rounded-full bg-[#015FC9]/10 text-[#015FC9] text-[9.5px] font-black shrink-0">
                      <span className="w-1 h-1 rounded-full bg-[#015FC9]" />
                      colore o mapa
                    </span>
                  )}
                  <Chave ligada={ligada} />
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onInteligencia(!inteligenciaAberta)}
              className="w-full flex items-center gap-2.5 px-1.5 py-2.5 cursor-pointer"
            >
              <Vote
                className={`w-4 h-4 shrink-0 ${
                  inteligenciaAberta ? 'text-[#015FC9]' : 'text-slate-300'
                }`}
              />
              <span
                className={`text-[12.5px] font-bold text-left flex-1 min-w-0 truncate ${
                  inteligenciaAberta ? 'text-[#0D233A]' : 'text-slate-500'
                }`}
              >
                Inteligência Eleitoral
              </span>
              <Chave ligada={inteligenciaAberta} />
            </button>
          </div>

          {/*
            O RECORTE DO DESENHO.

            Bairro e setor respondem perguntas diferentes: o bairro é o nome
            que a equipe usa, o setor é onde o dado do Censo realmente mora.
            Fica junto das camadas porque é a mesma decisão — o que o mapa
            está pintando.
          */}
          <div className="mt-1 grid grid-cols-2 gap-1 p-1 bg-slate-100/70 rounded-xl">
            {(['bairros', 'setores'] as const).map((nivel) => (
              <button
                key={nivel}
                type="button"
                onClick={() => onMudar({ ...valor, nivel })}
                className={`h-8 rounded-lg text-[11.5px] font-bold capitalize cursor-pointer transition-all ${
                  valor.nivel === nivel
                    ? 'bg-white text-[#015FC9] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {nivel}
              </button>
            ))}
          </div>

          {/*
            O RECIBO DA CAMADA.

            Liga-se a camada e o mapa continua limpo por meio minuto enquanto
            a malha vem em páginas. Sem uma linha dizendo isso, o silêncio é
            indistinguível de defeito — e foi exatamente assim que pareceu.
          */}
          {valor.metrica !== null && (
            <div className="mt-2 px-1.5">
              {estado?.erro ? (
                <p className="text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 leading-snug flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                  {estado.erro}
                </p>
              ) : !estado?.municipio ? (
                <p className="text-[10.5px] font-semibold text-slate-500 leading-snug">
                  Nenhuma cidade resolvida ainda. Abra a Inteligência Eleitoral
                  para escolher a UF e o município.
                </p>
              ) : carregando ? (
                <p className="text-[10.5px] font-bold text-slate-500 leading-snug flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  {estado.progresso && estado.progresso.total > 0
                    ? `${estado.municipio}: ${estado.progresso.lidos.toLocaleString(
                        'pt-BR'
                      )} de ${estado.progresso.total.toLocaleString('pt-BR')} setores`
                    : `Carregando ${estado.municipio}...`}
                </p>
              ) : (
                <p className="text-[10.5px] font-semibold text-slate-400 leading-snug">
                  {estado.desenhados > 0
                    ? `${estado.municipio} · ${estado.desenhados.toLocaleString(
                        'pt-BR'
                      )} ${valor.nivel === 'setores' ? 'setores' : 'bairros'} no mapa`
                    : `${estado.municipio} não devolveu ${valor.nivel} com desenho.`}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 px-1.5 pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500">
                Opacidade das áreas
              </span>
              <span className="text-[11px] font-black text-slate-400 tabular-nums">
                {Math.round(valor.opacidade * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(valor.opacidade * 100)}
              onChange={(e) =>
                onMudar({ ...valor, opacidade: Number(e.target.value) / 100 })
              }
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-[#015FC9]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
