import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail
} from 'lucide-react';
import BrandMark from './BrandMark';

/**
 * A porta de entrada do Mapa Operacional.
 *
 * A tela antiga era um cartão branco com um celular desenhado no canto — podia
 * ser o login de qualquer aplicativo. Esta aqui mostra, antes de qualquer
 * senha, o que existe do outro lado: um mapa da cidade com a operação
 * acontecendo. A equipe andando pelas avenidas, as missões pulsando, os
 * check-ins acendendo em verde, os setores do Censo pintados por densidade e
 * um deles fixado em âmbar — as mesmas cores e os mesmos gestos que a pessoa
 * vai encontrar ao entrar.
 *
 * O mapa é ilustração, e por isso não mostra número nenhum: um "146 check-ins
 * hoje" numa tela sem login seria lido como dado de verdade, e não é. O que o
 * mapa responde é "o que é este sistema", não "como está a operação".
 *
 * O cursor sobre o mapa vira uma mira com a coordenada real daquele ponto de
 * Maceió, em graus, minutos e segundos. É o primeiro gesto de quem abre a tela
 * — mexer o mouse — respondido na língua do sistema.
 *
 * Toda a lógica de autenticação continua em App.tsx: esta tela só desenha e
 * repassa o que foi digitado.
 */

// ---------------------------------------------------------------------------
// O mapa tático
// ---------------------------------------------------------------------------

/** Enquadramento do desenho sobre Maceió, para a mira falar a coordenada real. */
const LIMITES = { norte: -9.545, sul: -9.735, oeste: -35.815, leste: -35.665 };

const grausMinSeg = (valor: number, pos: string, neg: string) => {
  const abs = Math.abs(valor);
  const g = Math.floor(abs);
  const m = Math.floor((abs - g) * 60);
  const s = Math.round(((abs - g) * 60 - m) * 60);
  const pad = (n: number, t = 2) => String(n).padStart(t, '0');
  return `${pad(g)}°${pad(m)}'${pad(Math.min(59, s))}"${valor < 0 ? neg : pos}`;
};

/** Aleatório com semente: o mapa nasce igual toda vez, sem pular entre aberturas. */
const semente = (i: number, j: number) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Avenidas por onde a equipe anda. Os ids viram trilhos do animateMotion. */
const AVENIDAS = [
  { id: 'lg-av-1', d: 'M 40 170 C 220 210, 360 150, 520 250 S 700 330, 760 300' },
  { id: 'lg-av-2', d: 'M 120 980 C 200 800, 300 690, 420 560 S 560 360, 620 60' },
  { id: 'lg-av-3', d: 'M 0 520 C 180 500, 330 560, 480 520 S 620 470, 700 520' },
  { id: 'lg-av-4', d: 'M 260 40 C 300 220, 250 380, 330 520 S 470 820, 520 980' },
  { id: 'lg-av-5', d: 'M 60 380 C 200 330, 320 400, 420 360 S 600 200, 700 160' }
];

/** Quem anda por onde, e em quanto tempo percorre a avenida. */
const EQUIPE = [
  { trilho: 'lg-av-1', dur: 24, atraso: 0 },
  { trilho: 'lg-av-2', dur: 30, atraso: -9 },
  { trilho: 'lg-av-3', dur: 21, atraso: -4 },
  { trilho: 'lg-av-4', dur: 27, atraso: -15 },
  { trilho: 'lg-av-5', dur: 19, atraso: -7 },
  { trilho: 'lg-av-2', dur: 30, atraso: -22 }
];

const MISSOES = [
  { x: 432, y: 408 },
  { x: 292, y: 610 },
  { x: 560, y: 262 }
];

const CHECKINS = [
  { x: 470, y: 452 },
  { x: 395, y: 372 },
  { x: 318, y: 660 },
  { x: 250, y: 560 },
  { x: 540, y: 305 },
  { x: 600, y: 210 },
  { x: 360, y: 470 },
  { x: 210, y: 300 }
];

const BAIRROS = [
  { nome: 'Benedito Bentes', x: 330, y: 130 },
  { nome: 'Tabuleiro', x: 170, y: 250 },
  { nome: 'Jacintinho', x: 615, y: 478 },
  { nome: 'Farol', x: 390, y: 560 },
  { nome: 'Ponta Verde', x: 612, y: 640 },
  { nome: 'Pajuçara', x: 560, y: 770 }
];

/** O mar a leste e ao sul, como em Maceió; a lagoa Mundaú a sudoeste. */
const MAR = 'M 760 0 C 720 170, 790 300, 712 470 C 660 590, 690 700, 590 820 C 520 900, 430 930, 330 1000 L 1000 1000 L 1000 0 Z';
const LAGOA =
  'M 0 700 C 70 680, 150 720, 190 790 C 230 860, 200 930, 120 960 C 80 975, 30 1000, 0 1000 Z';

/**
 * A malha de setores: uma grade torta, com vértices compartilhados, para os
 * polígonos se encaixarem como setores censitários de verdade.
 */
function useSetores() {
  return useMemo(() => {
    const colunas = 8;
    const linhas = 9;
    const x0 = 120;
    const y0 = 90;
    const passoX = 78;
    const passoY = 88;
    const v: { x: number; y: number }[][] = [];
    for (let i = 0; i <= colunas; i++) {
      v[i] = [];
      for (let j = 0; j <= linhas; j++) {
        const borda = i === 0 || j === 0 || i === colunas || j === linhas;
        const jx = borda ? 0 : (semente(i, j) - 0.5) * 38;
        const jy = borda ? 0 : (semente(j + 7, i + 3) - 0.5) * 38;
        v[i][j] = { x: x0 + i * passoX + jx + j * 6, y: y0 + j * passoY + jy };
      }
    }
    const tons = ['#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD'];
    const setores: { d: string; cor: string; opacidade: number; id: string }[] = [];
    for (let i = 0; i < colunas; i++) {
      for (let j = 0; j < linhas; j++) {
        const p = [v[i][j], v[i + 1][j], v[i + 1][j + 1], v[i][j + 1]];
        const r = semente(i * 3 + 1, j * 5 + 2);
        setores.push({
          id: `${i}-${j}`,
          d: `M ${p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L ')} Z`,
          cor: tons[Math.floor(r * tons.length)],
          opacidade: 0.1 + r * 0.22
        });
      }
    }
    return setores;
  }, []);
}

const MapaTatico = React.memo(function MapaTatico({ calmo }: { calmo: boolean }) {
  const setores = useSetores();
  const fixado = setores.find((s) => s.id === '4-3');

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <pattern id="lg-ruas" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
          <path d="M 34 0 L 0 0 0 34" fill="none" stroke="#38BDF8" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
        <linearGradient id="lg-mar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B2F4D" />
          <stop offset="100%" stopColor="#061A2C" />
        </linearGradient>
        <pattern id="lg-ondas" width="26" height="12" patternUnits="userSpaceOnUse">
          <path d="M 0 6 Q 6.5 1, 13 6 T 26 6" fill="none" stroke="#7DD3FC" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
        <radialGradient id="lg-brilho-missao">
          <stop offset="0%" stopColor="#F58220" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F58220" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Terra, ruas miúdas e a mancha do Censo */}
      <rect width="1000" height="1000" fill="#0A1E33" />
      <rect width="1000" height="1000" fill="url(#lg-ruas)" />
      {setores.map((s) => (
        <path
          key={s.id}
          d={s.d}
          fill={s.cor}
          fillOpacity={s.opacidade}
          stroke="#7DD3FC"
          strokeOpacity="0.12"
          strokeWidth="1"
        />
      ))}

      {/* Avenidas */}
      {AVENIDAS.map((a) => (
        <g key={a.id}>
          <path d={a.d} fill="none" stroke="#0A1E33" strokeWidth="9" strokeLinecap="round" />
          <path id={a.id} d={a.d} fill="none" stroke="#5B8DB8" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}

      {/* Mar e lagoa por cima, que é o que recorta a cidade */}
      <path d={MAR} fill="url(#lg-mar)" />
      <path d={MAR} fill="url(#lg-ondas)" />
      <path d={MAR} fill="none" stroke="#38BDF8" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d={LAGOA} fill="url(#lg-mar)" />
      <path d={LAGOA} fill="url(#lg-ondas)" />
      <path d={LAGOA} fill="none" stroke="#38BDF8" strokeOpacity="0.35" strokeWidth="1.5" />

      {/* O setor fixado, em âmbar, como no mapa de dentro */}
      {fixado && (
        <>
          <path d={fixado.d} fill="none" stroke="#F59E0B" strokeWidth="10" strokeOpacity="0.3" className={calmo ? '' : 'setor-fixado-halo'} strokeLinejoin="round" />
          <path d={fixado.d} fill="#F59E0B" fillOpacity="0.14" stroke="#FBBF24" strokeWidth="2.5" strokeLinejoin="round" />
        </>
      )}

      {/* A área de uma missão, com o raio desenhado */}
      <circle cx="432" cy="408" r="118" fill="url(#lg-brilho-missao)" />
      <circle cx="432" cy="408" r="118" fill="none" stroke="#F58220" strokeOpacity="0.8" strokeWidth="1.8" strokeDasharray="8 7" className={calmo ? '' : 'lg-raio-gira'} />

      {/* Nomes */}
      {BAIRROS.map((b) => (
        <text
          key={b.nome}
          x={b.x}
          y={b.y}
          textAnchor="middle"
          fill="#BAE6FD"
          fillOpacity="0.38"
          fontSize="13"
          fontWeight="800"
          letterSpacing="3"
          style={{ textTransform: 'uppercase', fontFamily: 'inherit' }}
        >
          {b.nome}
        </text>
      ))}
      <text x="800" y="560" transform="rotate(-68 800 560)" textAnchor="middle" fill="#7DD3FC" fillOpacity="0.3" fontSize="12" fontWeight="800" letterSpacing="6" style={{ fontStyle: 'italic' }}>
        OCEANO ATLÂNTICO
      </text>
      <text x="92" y="870" textAnchor="middle" fill="#7DD3FC" fillOpacity="0.28" fontSize="11" fontWeight="800" letterSpacing="3" style={{ fontStyle: 'italic' }}>
        LAGOA MUNDAÚ
      </text>

      {/* Check-ins acendendo em verde, cada um no seu tempo */}
      {CHECKINS.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y})`}>
          <g className={calmo ? '' : 'lg-checkin'} style={{ animationDelay: `${i * 1.35}s` }}>
            <circle r="14" fill="none" stroke="#34D399" strokeWidth="1.5" className={calmo ? '' : 'lg-checkin-onda'} style={{ animationDelay: `${i * 1.35}s` }} />
            <circle r="5.5" fill="#34D399" stroke="#052E2B" strokeWidth="1.5" />
          </g>
        </g>
      ))}

      {/* Missões: o pino na cor da marca, com o pulso */}
      {MISSOES.map((m, i) => (
        <g key={i} transform={`translate(${m.x} ${m.y})`}>
          <circle r="10" fill="none" stroke="#F58220" strokeWidth="2" className={calmo ? '' : 'lg-pulso'} style={{ animationDelay: `${i * 0.7}s` }} />
          <g transform="translate(-13 -34)">
            <path
              d="M13 1C6.4 1 1 6.2 1 12.7 1 21.3 11.6 31.2 12.1 31.6a1.3 1.3 0 0 0 1.8 0C14.4 31.2 25 21.3 25 12.7 25 6.2 19.6 1 13 1Z"
              fill="#F58220"
              stroke="#0A1E33"
              strokeWidth="1.5"
            />
            <circle cx="13" cy="12.6" r="4.4" fill="#0A1E33" />
          </g>
        </g>
      ))}

      {/* A equipe andando pelas avenidas */}
      {!calmo &&
        EQUIPE.map((p, i) => (
          <g key={i}>
            <circle r="11" fill="#22D3EE" fillOpacity="0.16">
              <animateMotion dur={`${p.dur}s`} begin={`${p.atraso}s`} repeatCount="indefinite" rotate="auto">
                <mpath href={`#${p.trilho}`} />
              </animateMotion>
            </circle>
            <circle r="5" fill="#67E8F9" stroke="#083344" strokeWidth="1.5">
              <animateMotion dur={`${p.dur}s`} begin={`${p.atraso}s`} repeatCount="indefinite" rotate="auto">
                <mpath href={`#${p.trilho}`} />
              </animateMotion>
            </circle>
          </g>
        ))}
    </svg>
  );
});

/**
 * O que o mapa conta, em fila, como o registro de uma sala de operações.
 *
 * Sem hora e sem nome de gente: são as coisas que o sistema faz, escritas do
 * jeito que elas aparecem quando acontecem — não eventos que aconteceram.
 */
const REGISTRO = [
  { cor: 'bg-orange-400', texto: 'Missão despachada para a equipe Delta' },
  { cor: 'bg-emerald-400', texto: 'Check-in chegou com foto, áudio e localização' },
  { cor: 'bg-cyan-300', texto: 'Equipe em deslocamento pela avenida' },
  { cor: 'bg-amber-400', texto: 'Setor fixado: o Censo inteiro de um quarteirão' },
  { cor: 'bg-violet-400', texto: 'Relatório do NEO pronto para a coordenação' }
];

// ---------------------------------------------------------------------------
// A tela
// ---------------------------------------------------------------------------

export default function TelaDeLogin({
  email,
  onEmail,
  senha,
  onSenha,
  verificando,
  onEntrar,
  bancoConfigurado,
  onDemonstracao,
  aviso
}: {
  email: string;
  onEmail: (valor: string) => void;
  senha: string;
  onSenha: (valor: string) => void;
  verificando: boolean;
  onEntrar: (e: React.FormEvent) => void;
  bancoConfigurado: boolean;
  onDemonstracao: () => void;
  /** O aviso do sistema: o de erro vira mensagem no próprio formulário. */
  aviso: { text: string; type: 'success' | 'info' | 'error' } | null;
}) {
  const [verSenha, setVerSenha] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tremendo, setTremendo] = useState(false);
  const [linha, setLinha] = useState(0);
  const [calmo] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  const mapaRef = useRef<HTMLDivElement | null>(null);
  const leituraRef = useRef<HTMLSpanElement | null>(null);
  const [mira, setMira] = useState(false);

  /*
   * Erro de credencial fica escrito no formulário, e o cartão treme uma vez.
   * O aviso lá no alto da tela some em segundos e fica longe de onde o olho
   * está — que é no campo que acabou de ser digitado.
   */
  useEffect(() => {
    if (aviso?.type === 'error') {
      setErro(aviso.text);
      setTremendo(true);
    }
  }, [aviso]);

  useEffect(() => {
    if (calmo) return;
    const troca = setInterval(() => setLinha((n) => (n + 1) % REGISTRO.length), 3200);
    return () => clearInterval(troca);
  }, [calmo]);

  /** A mira: segue o cursor e escreve a coordenada daquele ponto. */
  const moverMira = (e: React.MouseEvent<HTMLDivElement>) => {
    const caixa = mapaRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const fx = (e.clientX - caixa.left) / caixa.width;
    const fy = (e.clientY - caixa.top) / caixa.height;
    mapaRef.current!.style.setProperty('--mx', `${e.clientX - caixa.left}px`);
    mapaRef.current!.style.setProperty('--my', `${e.clientY - caixa.top}px`);
    mapaRef.current!.style.setProperty('--px', `${(fx - 0.5) * -14}px`);
    mapaRef.current!.style.setProperty('--py', `${(fy - 0.5) * -14}px`);
    if (leituraRef.current) {
      const lat = LIMITES.norte + (LIMITES.sul - LIMITES.norte) * fy;
      const lng = LIMITES.oeste + (LIMITES.leste - LIMITES.oeste) * fx;
      leituraRef.current.textContent = `${grausMinSeg(lat, 'N', 'S')}  ${grausMinSeg(lng, 'L', 'O')}`;
    }
  };

  const podeEntrar = !!email.trim() && !!senha.trim() && !verificando;
  const registro = REGISTRO[linha];

  const lerCaps = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(!!e.getModifierState?.('CapsLock'));

  return (
    <div className="lg-tela relative min-h-[100dvh] w-full flex font-sans text-white overflow-hidden selection:bg-orange-500 selection:text-white">
      {/* Aviso que não é erro (o modo demonstração, por exemplo) */}
      {aviso && aviso.type !== 'error' && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] max-w-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-sky-400/20 bg-[#0C2A45]/95 backdrop-blur text-white lg-toast"
        >
          <Info className="w-4.5 h-4.5 shrink-0 text-sky-300" />
          <span className="text-xs font-semibold">{aviso.text}</span>
        </div>
      )}

      {/* ------------------------------------------------------------ MAPA */}
      <div
        ref={mapaRef}
        onMouseMove={moverMira}
        onMouseEnter={() => setMira(true)}
        onMouseLeave={() => setMira(false)}
        className="absolute inset-0 lg:relative lg:inset-auto lg:flex-[1.35] overflow-hidden lg:cursor-crosshair"
      >
        <div className="lg-paralaxe absolute -inset-4">
          <MapaTatico calmo={calmo} />
        </div>

        {/* Varredura lenta, e a vinheta que funde o mapa com o painel */}
        {!calmo && <div className="lg-varredura" aria-hidden="true" />}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_40%_45%,transparent_35%,rgba(4,12,22,0.75)_100%)]" />
        <div className="hidden lg:block absolute inset-y-0 right-0 w-40 pointer-events-none bg-gradient-to-r from-transparent to-[#06111D]" />
        {/* No celular o mapa é fundo: escurece para o cartão ler bem. */}
        <div className="lg:hidden absolute inset-0 bg-[#040C16]/45 pointer-events-none" />
        {/* Chão escuro sob a frase: o mapa continua, mas não atravessa o texto. */}
        <div className="hidden lg:block absolute inset-x-0 bottom-0 h-[58%] pointer-events-none bg-gradient-to-t from-[#040C16] via-[#040C16]/80 to-transparent" />

        {/* A mira */}
        {mira && (
          <div className="hidden lg:block pointer-events-none" aria-hidden="true">
            <div className="lg-mira-h" />
            <div className="lg-mira-v" />
            <div className="lg-mira-alvo" />
            <span ref={leituraRef} className="lg-mira-leitura" />
          </div>
        )}

        {/* Régua de coordenadas nas bordas, como carta náutica */}
        <div className="hidden lg:block pointer-events-none" aria-hidden="true">
          {['09°33\'S', '09°36\'S', '09°39\'S', '09°42\'S'].map((t, i) => (
            <span key={t} className="lg-regua left-3" style={{ top: `${18 + i * 20}%` }}>
              {t}
            </span>
          ))}
          {['35°48\'O', '35°45\'O', '35°42\'O'].map((t, i) => (
            <span key={t} className="lg-regua bottom-3" style={{ left: `${20 + i * 22}%` }}>
              {t}
            </span>
          ))}
        </div>

        {/* O cabeçalho do mapa */}
        <div className="hidden lg:flex absolute top-7 left-8 items-center gap-3 pointer-events-none">
          <BrandMark size={40} rounded={11} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-200/70 leading-none">
            Mapa Operacional
          </p>
        </div>

        {/* A frase, e o registro que passa */}
        <div className="hidden lg:block absolute left-8 bottom-10 right-10 max-w-xl pointer-events-none">
          <h2 className="text-[40px] xl:text-[46px] font-black leading-[1.02] tracking-tight">
            Toda a operação,
            <br />
            <span className="lg-titulo-destaque">num mapa só.</span>
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-sky-100/65 max-w-md font-medium">
            Missões, equipe em campo, check-ins com foto e áudio e o Censo de
            cada setor — na mesma tela.
          </p>

          <div className="mt-6 flex items-center gap-4 text-[9.5px] font-black uppercase tracking-[0.18em] text-sky-100/55">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F58220]" /> Missões</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-300" /> Equipe</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Check-ins</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-[2px] bg-blue-500" /> Censo</span>
          </div>

          <div className="mt-5 h-9 inline-flex items-center gap-2.5 pl-3 pr-4 rounded-xl bg-[#06111D]/75 border border-white/10 backdrop-blur-sm">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-300/70">
              Ao vivo
            </span>
            <span className="w-px h-4 bg-white/10" />
            <span key={linha} className="lg-registro flex items-center gap-2 text-[12px] font-semibold text-white/85">
              <span className={`w-1.5 h-1.5 rounded-full ${registro.cor}`} />
              {registro.texto}
            </span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- ACESSO */}
      <div className="relative z-10 w-full lg:w-[480px] xl:w-[520px] lg:shrink-0 flex flex-col lg:bg-[#06111D] lg:border-l lg:border-white/[0.06]">
        <div className="hidden lg:block absolute inset-0 lg-painel-grade pointer-events-none" aria-hidden="true" />

        <div className="relative flex-1 flex items-center justify-center px-5 py-10 sm:px-10">
          <div
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setTremendo(false);
            }}
            className={`w-full max-w-[380px] lg-cartao ${tremendo ? 'lg-treme' : ''} rounded-[28px] lg:rounded-none p-7 sm:p-8 lg:p-0 bg-[#07182A]/80 lg:bg-transparent border border-white/10 lg:border-0 backdrop-blur-xl lg:backdrop-blur-none shadow-2xl lg:shadow-none`}
          >
            {/* Marca no celular, onde o mapa é só fundo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-7">
              <BrandMark size={36} rounded={10} />
              <p className="text-[9.5px] font-black uppercase tracking-[0.28em] text-sky-200/70 leading-none">
                Mapa Operacional
              </p>
            </div>

            <h1 className="text-[30px] sm:text-[34px] font-black tracking-tight leading-[1.05]">
              Inteligência
              <br />
              Territorial
            </h1>

            <form onSubmit={onEntrar} className="mt-8 space-y-5" noValidate>
              {/* E-mail */}
              <div>
                <label htmlFor="lg-email" className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                  E-mail
                </label>
                <div className={`lg-campo ${erro ? 'lg-campo-erro' : ''}`}>
                  <Mail className="w-[18px] h-[18px] shrink-0 text-slate-500 lg-campo-icone" />
                  <input
                    id="lg-email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    required
                    value={email}
                    placeholder="voce@coordenacao.com"
                    onChange={(e) => {
                      onEmail(e.target.value);
                      setErro(null);
                    }}
                    className="flex-1 min-w-0 h-full bg-transparent border-none text-[15px] font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="lg-senha" className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                  Senha
                </label>
                <div className={`lg-campo ${erro ? 'lg-campo-erro' : ''}`}>
                  <Lock className="w-[18px] h-[18px] shrink-0 text-slate-500 lg-campo-icone" />
                  <input
                    id="lg-senha"
                    type={verSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={senha}
                    placeholder="••••••••"
                    onKeyDown={lerCaps}
                    onKeyUp={lerCaps}
                    onBlur={() => setCapsLock(false)}
                    onChange={(e) => {
                      onSenha(e.target.value);
                      setErro(null);
                    }}
                    className="flex-1 min-w-0 h-full bg-transparent border-none text-[15px] font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    className="shrink-0 w-8 h-8 -mr-1.5 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    aria-label={verSenha ? 'Esconder a senha' : 'Mostrar a senha'}
                    title={verSenha ? 'Esconder a senha' : 'Mostrar a senha'}
                  >
                    {verSenha ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                {/* Caps Lock ligado é a causa mais comum de "senha errada"
                    que está certa. Avisar antes do clique poupa a volta. */}
                {capsLock && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Caps Lock está ligado
                  </p>
                )}
              </div>

              {erro && (
                <div role="alert" className="lg-erro flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-300" />
                  <p className="text-[12.5px] font-semibold text-rose-100 leading-snug">{erro}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!podeEntrar}
                className="lg-entrar group relative w-full h-[54px] rounded-2xl overflow-hidden font-black text-[12.5px] uppercase tracking-[0.16em] text-white flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed active:scale-[0.985] transition-transform"
              >
                {verificando ? (
                  <>
                    <span className="lg-mini-radar" aria-hidden="true" />
                    Verificando credenciais
                  </>
                ) : (
                  <>
                    Entrar na operação
                    <ArrowRight className="w-4 h-4 stroke-[2.75] transition-transform group-enabled:group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {!bancoConfigurado && (
              <div className="mt-7 pt-6 border-t border-white/[0.07]">
                <p className="text-[11.5px] leading-relaxed text-slate-400">
                  <strong className="text-amber-300">Integração offline:</strong>{' '}
                  as credenciais do banco não foram configuradas. Para testar o
                  fluxo, entre em modo demonstração.
                </p>
                <button
                  type="button"
                  onClick={onDemonstracao}
                  className="mt-3 w-full h-11 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[11.5px] font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  Entrar em modo demonstração
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
