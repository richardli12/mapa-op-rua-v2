import React, { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

/**
 * O trilho de ferramentas do mapa.
 *
 * Antes era uma pilha de botões coloridos sem nome, um por cima do outro:
 * em tela de notebook a lista passava da altura da janela e a primeira e a
 * última ferramenta ficavam cortadas, sem rolagem e sem aviso. E como cada
 * botão tinha uma cor própria, a cor não queria dizer nada -- não dava para
 * saber o que estava ligado olhando.
 *
 * Aqui o trilho é um painel de verdade: abre com os nomes à vista, fecha em
 * uma faixa de ícones para devolver mapa a quem já sabe onde fica cada coisa,
 * rola por dentro quando não cabe, e a cor só acende no que está ligado.
 *
 * O componente não sabe o que cada ferramenta faz: recebe a lista pronta e
 * cuida de desenhar, agrupar, rolar e lembrar do estado. Quem decide o que
 * existe no trilho é a tela do mapa.
 */

export interface FerramentaDoMapa {
  id: string;
  /** Nome curto, como aparece aberto e na dica quando fechado. */
  rotulo: string;
  icone: ReactNode;
  /** Cor de destaque da ferramenta: tinge o ícone e preenche quando liga. */
  cor: string;
  /** Ligada agora — acende a cor e marca o indicador na borda. */
  ativa?: boolean;
  /** Número que a ferramenta quer mostrar (itens achados, filtros ligados). */
  contador?: number;
  /** Tecla de atalho, mostrada como pista discreta. */
  atalho?: string;
  /** Explicação de uma linha; vira o title do botão. */
  ajuda?: string;
  grupo: string;
  aoClicar: (e: React.MouseEvent) => void;
}

export interface GrupoDeFerramentas {
  id: string;
  titulo: string;
}

const CHAVE_ABERTO = 'mapa:ferramentas-abertas';

const LARGURA_ABERTO = 232;
const LARGURA_FECHADO = 64;

/** Preferência salva; em tela estreita começa fechado para sobrar mapa. */
const estadoInicial = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const salvo = window.localStorage.getItem(CHAVE_ABERTO);
    if (salvo === '1') return true;
    if (salvo === '0') return false;
  } catch {
    /* navegador sem storage: cai na regra da largura */
  }
  return window.innerWidth >= 1280;
};

export function FerramentasDoMapa({
  grupos,
  ferramentas,
  children
}: {
  grupos: GrupoDeFerramentas[];
  ferramentas: FerramentaDoMapa[];
  /** Painéis que se ancoram na borda direita do trilho (o filtro de camadas). */
  children?: ReactNode;
}) {
  const [aberto, setAberto] = useState<boolean>(estadoInicial);
  const [sombras, setSombras] = useState({ topo: false, base: false });
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_ABERTO, aberto ? '1' : '0');
    } catch {
      /* sem storage a preferência vale só nesta sessão */
    }
  }, [aberto]);

  /**
   * Diz se ainda há trilho acima ou abaixo do que está à vista.
   *
   * Sem isso a lista cortada parece uma lista completa: quem não sabe que
   * existe mais coisa não rola atrás. As sombras são o único aviso, porque a
   * barra de rolagem fica escondida para o trilho não ganhar uma listra.
   */
  const medir = () => {
    const el = areaRef.current;
    if (!el) return;
    setSombras({
      topo: el.scrollTop > 4,
      base: el.scrollTop + el.clientHeight < el.scrollHeight - 4
    });
  };

  useLayoutEffect(medir, [aberto, ferramentas.length]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, []);

  /** Rola um naco do trilho; 1 desce, -1 sobe. */
  const rolar = (sentido: 1 | -1) =>
    areaRef.current?.scrollBy({ top: sentido * 140, behavior: 'smooth' });

  const ligadas = ferramentas.filter(f => f.ativa).length;

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-[1000] flex items-start pointer-events-none font-sans">
      <motion.nav
        aria-label="Ferramentas do mapa"
        initial={false}
        animate={{ width: aberto ? LARGURA_ABERTO : LARGURA_FECHADO }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        className="pointer-events-auto flex flex-col bg-[#0c1322]/95 backdrop-blur-md border border-slate-800/80 rounded-[26px] shadow-2xl shadow-black/40 overflow-hidden"
      >
        {/* Cabeçalho: quem abre e fecha, e o que está ligado agora */}
        <div className="shrink-0 flex items-center gap-2 h-12 px-2.5 border-b border-slate-800/70">
          {aberto && (
            <div className="min-w-0 flex-1 pl-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">
                Ferramentas
              </p>
              <p className="text-[9.5px] font-bold text-slate-600 leading-none mt-1 truncate">
                {ligadas > 0
                  ? `${ligadas} ${ligadas === 1 ? 'ligada' : 'ligadas'}`
                  : 'nada ligado'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAberto(v => !v)}
            aria-expanded={aberto}
            title={aberto ? 'Recolher o menu' : 'Abrir o menu'}
            className={`group relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
              aberto ? '' : 'mx-auto'
            }`}
          >
            {aberto ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
            {!aberto && <Dica texto="Abrir o menu" />}
          </button>
        </div>

        <div className="relative">
          {/*
           * Avisos de rolagem.
           *
           * A sombra sozinha não bastava: com a mesma cor do painel, a lista
           * cortada continuava parecendo uma lista inteira. A seta é o aviso
           * de verdade -- e, de quebra, rola sozinha para quem preferir
           * clicar a arrastar.
           */}
          <BordaDeRolagem visivel={sombras.topo} sentido="cima" aoRolar={() => rolar(-1)} />
          <BordaDeRolagem visivel={sombras.base} sentido="baixo" aoRolar={() => rolar(1)} />

          <div
            ref={areaRef}
            onScroll={medir}
            className="max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain rolagem-invisivel px-2.5 py-3 space-y-3"
          >
            {grupos.map(grupo => {
              const doGrupo = ferramentas.filter(f => f.grupo === grupo.id);
              if (doGrupo.length === 0) return null;
              return (
                <section key={grupo.id} className="space-y-1">
                  {aberto ? (
                    <p className="px-2 pb-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">
                      {grupo.titulo}
                    </p>
                  ) : (
                    <div className="mx-auto w-7 h-px bg-slate-700/80" aria-hidden="true" />
                  )}
                  {doGrupo.map(f => (
                    // Fragment segura a chave: sem os tipos do React neste
                    // projeto, `key` entraria na checagem das props do botão.
                    <React.Fragment key={f.id}>
                      <Botao ferramenta={f} aberto={aberto} />
                    </React.Fragment>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      </motion.nav>

      {children && <div className="pointer-events-auto">{children}</div>}
    </div>
  );
}

/**
 * A borda que avisa que a lista continua, com a seta para seguir.
 *
 * Fica por cima do conteúdo: a sombra apaga o corte seco e a seta diz para
 * onde ir. Some assim que a rolagem chega na ponta.
 */
function BordaDeRolagem({
  visivel,
  sentido,
  aoRolar
}: {
  visivel: boolean;
  sentido: 'cima' | 'baixo';
  aoRolar: () => void;
}) {
  const emCima = sentido === 'cima';
  return (
    <div
      aria-hidden={!visivel}
      className={`absolute inset-x-0 h-10 z-20 flex items-center justify-center transition-opacity duration-200 ${
        emCima
          ? 'top-0 bg-gradient-to-b from-[#0c1322] via-[#0c1322]/85 to-transparent'
          : 'bottom-0 bg-gradient-to-t from-[#0c1322] via-[#0c1322]/85 to-transparent'
      } ${visivel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <button
        type="button"
        tabIndex={visivel ? 0 : -1}
        onClick={aoRolar}
        aria-label={emCima ? 'Ver as ferramentas acima' : 'Ver as ferramentas abaixo'}
        className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center shadow-lg cursor-pointer transition-colors"
      >
        {emCima ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/** A dica que aparece ao lado do ícone quando o trilho está fechado. */
function Dica({ texto, atalho }: { texto: string; atalho?: string }) {
  return (
    <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 text-white text-[10px] uppercase font-black tracking-widest rounded-lg whitespace-nowrap shadow-xl transition-all pointer-events-none z-[1100] flex items-center gap-1.5">
      {texto}
      {atalho && (
        <kbd className="px-1 py-px rounded bg-white/10 border border-white/15 text-[8.5px] font-black tracking-normal">
          {atalho}
        </kbd>
      )}
    </span>
  );
}

function Botao({ ferramenta, aberto }: { ferramenta: FerramentaDoMapa; aberto: boolean }) {
  const { rotulo, icone, cor, ativa, contador, atalho, ajuda, aoClicar } = ferramenta;

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativa}
      aria-label={rotulo}
      title={ajuda || rotulo}
      className={`group relative w-full flex items-center rounded-2xl cursor-pointer transition-all active:scale-[0.97] ${
        aberto ? 'gap-2.5 h-11 px-2' : 'h-11 justify-center'
      } ${ativa ? 'text-white' : 'text-slate-300 hover:bg-white/8'}`}
      style={
        ativa
          ? { backgroundColor: cor, boxShadow: `0 6px 18px -8px ${cor}` }
          : undefined
      }
    >
      {/*
       * O ícone guarda a cor mesmo desligado, só que apagada: é ela que
       * identifica a ferramenta na varredura de olho. Ligada, o fundo assume
       * a cor e o ícone vira branco -- o que está aceso salta sozinho.
       */}
      <span
        className="relative shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
        style={
          ativa
            ? { backgroundColor: 'rgba(255,255,255,0.16)', color: '#fff' }
            : { backgroundColor: `${cor}1F`, color: cor }
        }
      >
        {icone}
        {!aberto && !!contador && contador > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F58220] border-2 border-[#0c1322] text-white text-[8.5px] font-black flex items-center justify-center">
            {contador}
          </span>
        )}
      </span>

      {aberto && (
        <>
          <span className="min-w-0 flex-1 text-left text-[11.5px] font-bold truncate">
            {rotulo}
          </span>
          {!!contador && contador > 0 && (
            <span
              className={`shrink-0 min-w-[19px] h-[19px] px-1.5 rounded-full text-[9.5px] font-black flex items-center justify-center ${
                ativa ? 'bg-white/20 text-white' : 'bg-[#F58220] text-white'
              }`}
            >
              {contador}
            </span>
          )}
          {!contador && atalho && (
            <kbd
              className={`shrink-0 px-1.5 py-0.5 rounded-md text-[8.5px] font-black border ${
                ativa
                  ? 'bg-white/15 border-white/20 text-white'
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {atalho}
            </kbd>
          )}
        </>
      )}

      {!aberto && <Dica texto={rotulo} atalho={atalho} />}
    </button>
  );
}
