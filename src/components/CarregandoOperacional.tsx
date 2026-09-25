import React, { useEffect, useState } from 'react';

/**
 * A tela de espera do Mapa Operacional: um radar de central de comando.
 *
 * O que estava aqui era uma carinha sorrindo, de biblioteca pronta — simpática,
 * mas de outro produto. Quem abre este sistema está abrindo uma operação: gente
 * na rua, missões espalhadas, território para cobrir. A espera tem de falar a
 * mesma língua.
 *
 * O radar varre e, a cada passada, os pontos acendem no instante em que o
 * feixe passa por cima deles — âmbar para missão, ciano para equipe, verde
 * para check-in, as mesmas cores que o mapa usa depois. Embaixo, a linha de
 * status diz o que está sendo montado (em vez de um "Carregando..." que não
 * informa nada), e a telemetria conta o tempo desde que a espera começou.
 *
 * Quando `ativo` vira falso, a tela não some de estalo: o radar "trava" no
 * alvo, a linha diz "Operação pronta" e tudo se desfaz em meio segundo. Sumir
 * no meio de um frame é o que faz a espera parecer um defeito.
 */

/** Uma volta do feixe, em segundos. Os pontos acendem sincronizados com ela. */
const VOLTA = 2.6;

type Tom = 'missao' | 'equipe' | 'checkin';

/** Ângulo em graus (0 = norte, sentido horário) e distância do centro, 0 a 1. */
const CONTATOS: { angulo: number; distancia: number; tom: Tom }[] = [
  { angulo: 24, distancia: 0.64, tom: 'missao' },
  { angulo: 71, distancia: 0.86, tom: 'equipe' },
  { angulo: 118, distancia: 0.4, tom: 'checkin' },
  { angulo: 163, distancia: 0.74, tom: 'equipe' },
  { angulo: 214, distancia: 0.55, tom: 'missao' },
  { angulo: 256, distancia: 0.9, tom: 'checkin' },
  { angulo: 297, distancia: 0.68, tom: 'equipe' },
  { angulo: 336, distancia: 0.32, tom: 'missao' }
];

const ETAPAS_PADRAO = [
  'Sincronizando a equipe em campo',
  'Posicionando as missões',
  'Lendo os check-ins do território',
  'Enquadrando a área de operação'
];

const SEGMENTOS = 16;

/**
 * Coordenadas que se embaralham: é o "decodificando" da telemetria.
 *
 * Sempre dentro do Brasil — latitude de 0 a -33, longitude de -34 a -73.
 * Número de telemetria impossível ("LAT -99") é o tipo de detalhe que quem
 * trabalha com mapa percebe, e aí o painel inteiro vira cenário.
 */
const embaralhar = () => {
  const entre = (min: number, max: number) => min + Math.random() * (max - min);
  const fmt = (v: number) => {
    const [int, dec] = Math.abs(v).toFixed(4).split('.');
    return `-${int.padStart(2, '0')}.${dec}`;
  };
  return { lat: fmt(entre(0.5, 33.5)), lng: fmt(entre(34.8, 73.9)) };
};

export default function CarregandoOperacional({
  ativo = true,
  etapas = ETAPAS_PADRAO,
  fixo = true
}: {
  /** Falso dispara a saída: trava no alvo e se desfaz. */
  ativo?: boolean;
  /** O que a linha de status vai dizendo, em ciclo. */
  etapas?: string[];
  /** Cobre a tela por cima de tudo; falso ocupa o lugar de uma página. */
  fixo?: boolean;
}) {
  const [visivel, setVisivel] = useState(ativo);
  const [saindo, setSaindo] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [inicio] = useState(() => Date.now());
  const [decorrido, setDecorrido] = useState(0);
  const [coords, setCoords] = useState(embaralhar);

  // Entrada e saída: a saída espera a animação terminar antes de desmontar.
  useEffect(() => {
    if (ativo) {
      setVisivel(true);
      setSaindo(false);
      return;
    }
    if (!visivel) return;
    setSaindo(true);
    const fim = setTimeout(() => {
      setVisivel(false);
      setSaindo(false);
    }, 780);
    return () => clearTimeout(fim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  useEffect(() => {
    if (!visivel || saindo) return;
    const troca = setInterval(
      () => setEtapa((atual) => (atual + 1) % Math.max(1, etapas.length)),
      1500
    );
    const relogio = setInterval(() => {
      setDecorrido(Date.now() - inicio);
      setCoords(embaralhar());
    }, 90);
    return () => {
      clearInterval(troca);
      clearInterval(relogio);
    };
  }, [visivel, saindo, etapas.length, inicio]);

  if (!visivel) return null;

  const segundos = decorrido / 1000;
  const relogio = `T+${String(Math.floor(segundos / 60)).padStart(2, '0')}:${(
    segundos % 60
  )
    .toFixed(1)
    .padStart(4, '0')}`;
  const texto = saindo ? 'Operação pronta' : etapas[etapa % etapas.length];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={saindo ? 'Operação pronta' : 'Carregando o mapa operacional'}
      className={`op-carregando ${fixo ? 'fixed inset-0 z-[10000]' : 'min-h-screen w-full'} ${
        saindo ? 'op-saindo' : ''
      } flex flex-col items-center justify-center overflow-hidden select-none font-sans`}
    >
      <div className="op-grade" aria-hidden="true" />
      <div className="op-linha-de-varredura" aria-hidden="true" />

      <div className="relative flex flex-col items-center px-6">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.32em] text-sky-200/70">
          <span className="op-led" />
          Mapa Operacional
        </p>

        {/* O RADAR */}
        <div className="op-radar mt-7" aria-hidden="true">
          <span className="op-canto op-canto-a" />
          <span className="op-canto op-canto-b" />
          <span className="op-canto op-canto-c" />
          <span className="op-canto op-canto-d" />

          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
            <defs>
              <radialGradient id="op-fundo-radar" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0E3A5C" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#081B2E" stopOpacity="0.95" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="url(#op-fundo-radar)" />
            {[98, 73.5, 49, 24.5].map((r) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="#38BDF8"
                strokeOpacity={r === 98 ? 0.55 : 0.18}
                strokeWidth={r === 98 ? 1.2 : 0.8}
              />
            ))}
            <line x1="100" y1="2" x2="100" y2="198" stroke="#38BDF8" strokeOpacity="0.14" strokeWidth="0.8" />
            <line x1="2" y1="100" x2="198" y2="100" stroke="#38BDF8" strokeOpacity="0.14" strokeWidth="0.8" />
            {/* Régua da borda: um traço a cada 10°, maior a cada 30°. */}
            {Array.from({ length: 36 }, (_, i) => {
              const grande = i % 3 === 0;
              const a = (i * 10 * Math.PI) / 180;
              const r1 = 98;
              const r2 = grande ? 90 : 94;
              return (
                <line
                  key={i}
                  x1={100 + r1 * Math.sin(a)}
                  y1={100 - r1 * Math.cos(a)}
                  x2={100 + r2 * Math.sin(a)}
                  y2={100 - r2 * Math.cos(a)}
                  stroke="#7DD3FC"
                  strokeOpacity={grande ? 0.7 : 0.35}
                  strokeWidth={grande ? 1.2 : 0.8}
                />
              );
            })}
          </svg>

          <div className="op-feixe" style={{ animationDuration: `${VOLTA}s` }} />

          {CONTATOS.map((c, i) => {
            const a = (c.angulo * Math.PI) / 180;
            const x = 50 + c.distancia * 46 * Math.sin(a);
            const y = 50 - c.distancia * 46 * Math.cos(a);
            return (
              <span
                key={i}
                className={`op-contato op-contato-${c.tom}`}
                style={
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    animationDuration: `${VOLTA}s`,
                    animationDelay: `${(c.angulo / 360) * VOLTA}s`,
                    '--atraso': `${(c.angulo / 360) * VOLTA}s`,
                    '--volta': `${VOLTA}s`
                  } as React.CSSProperties
                }
              />
            );
          })}

          <span className="op-centro" />
          <span className="op-mira" />

          <span className="op-rumo top-1.5 left-1/2 -translate-x-1/2">N</span>
          <span className="op-rumo right-2 top-1/2 -translate-y-1/2">L</span>
          <span className="op-rumo bottom-1.5 left-1/2 -translate-x-1/2">S</span>
          <span className="op-rumo left-2 top-1/2 -translate-y-1/2">O</span>
        </div>

        {/* A LINHA DE STATUS */}
        <div className="mt-8 h-5 flex items-center justify-center">
          <p
            key={texto}
            className={`op-status text-[12.5px] font-bold tracking-wide ${
              saindo ? 'text-emerald-300' : 'text-white'
            }`}
          >
            <span className={saindo ? 'text-emerald-400' : 'text-sky-400'}>
              {saindo ? '✓' : '›'}
            </span>{' '}
            {texto}
            {!saindo && <span className="op-cursor" />}
          </p>
        </div>

        {/* Barra em segmentos, como painel de equipamento. */}
        <div className="mt-4 flex items-center gap-[3px]" aria-hidden="true">
          {Array.from({ length: SEGMENTOS }, (_, i) => (
            <span
              key={i}
              className="op-segmento"
              style={{ animationDelay: `${i * 0.07}s` }}
            />
          ))}
        </div>

        {/* Telemetria */}
        <div
          className="mt-4 flex items-center gap-3 text-[9.5px] font-bold tracking-[0.14em] text-sky-200/45 tabular-nums"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
          aria-hidden="true"
        >
          <span>LAT {coords.lat}</span>
          <span className="w-1 h-1 rounded-full bg-sky-300/30" />
          <span>LNG {coords.lng}</span>
          <span className="w-1 h-1 rounded-full bg-sky-300/30" />
          <span className="text-sky-200/70">{relogio}</span>
        </div>

        <div className="mt-6 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.18em] text-sky-100/40" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Missões
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" /> Equipe
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Check-ins
          </span>
        </div>
      </div>
    </div>
  );
}
