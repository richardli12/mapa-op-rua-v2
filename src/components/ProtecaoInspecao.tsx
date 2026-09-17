import { useEffect, useRef, useState } from 'react';

/**
 * Bloqueio de inspeção do código.
 *
 * Cobre a tela inteira assim que alguém tenta abrir as ferramentas do
 * navegador — por F12, pelos atalhos, pelo botão direito ou deixando o painel
 * aberto. O aviso fica por cima de tudo, então o conteúdo do sistema some da
 * tela no mesmo instante.
 *
 * Só vale no computador: no celular não há painel para abrir, e as pistas que
 * o bloqueio usa apontariam para quem não fez nada.
 *
 * Vale o que vale: isto afasta o curioso, não o determinado. Quem sabe
 * desligar o JavaScript ou ler o pacote já baixado passa por aqui. Segredo de
 * verdade (chave, regra de negócio, dado de outro cliente) continua sendo
 * coisa de servidor, nunca do navegador.
 *
 * Em desenvolvimento o bloqueio fica desligado: senão ninguém trabalha.
 */
export default function ProtecaoInspecao() {
  const [bloqueado, setBloqueado] = useState(false);
  /**
   * Por que a tela travou.
   *
   * 'painel' some sozinho quando o painel fecha — assim um vão falso (barra do
   * sistema, zoom, janela redimensionada) não deixa ninguém preso. 'acao' é
   * tentativa deliberada: fica até a pessoa recarregar a página.
   */
  const motivoRef = useRef<'painel' | 'acao' | null>(null);

  useEffect(() => {
    if ((import.meta as any).env?.DEV) return;

    let vivo = true;
    const bloquear = (motivo: 'painel' | 'acao') => {
      if (!vivo) return;
      if (motivoRef.current !== 'acao') motivoRef.current = motivo;
      setBloqueado(true);
    };

    /**
     * Aparelho de toque (celular, tablet).
     *
     * Ali não existe painel de ferramentas para vigiar, e as duas pistas que
     * este bloqueio usa mentem: a barra de endereço do navegador deixa um vão
     * enorme entre a janela e a página, e o toque demorado sobre a tela dispara
     * o mesmo evento do botão direito. Por isso o celular fica de fora — antes
     * disso, quem só abria a tela de login pelo iPhone já caía no bloqueio.
     */
    const aparelhoDeToque =
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches);

    const teclado = (e: KeyboardEvent) => {
      const tecla = e.key?.toUpperCase();
      const atalhoInspecao =
        tecla === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(tecla)) ||
        ((e.ctrlKey || e.metaKey) && tecla === 'U');
      if (atalhoInspecao) {
        e.preventDefault();
        bloquear('acao');
      }
    };

    const menu = (e: MouseEvent) => {
      e.preventDefault();
      bloquear('acao');
    };

    /**
     * Painel aberto acoplado à janela: sobra um vão entre a janela e a página.
     *
     * A medida de partida é a do próprio navegador em uso — barra lateral,
     * zoom e barra do sistema já entram nela. O bloqueio só vem quando o vão
     * cresce bem acima desse ponto de partida, que é o que acontece quando o
     * painel de ferramentas abre.
     */
    const FOLGA = 200;
    const base = {
      largura: window.outerWidth - window.innerWidth,
      altura: window.outerHeight - window.innerHeight
    };
    const vigiar = () => {
      const aberto =
        window.outerWidth - window.innerWidth > base.largura + FOLGA ||
        window.outerHeight - window.innerHeight > base.altura + FOLGA;
      if (aberto) {
        bloquear('painel');
        return;
      }
      // Fechado o painel, a tela volta — mas só se foi ele quem travou.
      if (vivo && motivoRef.current === 'painel') {
        motivoRef.current = null;
        setBloqueado(false);
      }
    };

    // No celular só ficam os atalhos de teclado (teclado externo), sem o menu
    // de toque longo e sem a vigilância de tamanho.
    if (aparelhoDeToque) {
      window.addEventListener('keydown', teclado, true);
      return () => {
        vivo = false;
        window.removeEventListener('keydown', teclado, true);
      };
    }

    window.addEventListener('keydown', teclado, true);
    window.addEventListener('contextmenu', menu, true);
    const relogio = window.setInterval(vigiar, 700);
    vigiar();

    return () => {
      vivo = false;
      window.removeEventListener('keydown', teclado, true);
      window.removeEventListener('contextmenu', menu, true);
      window.clearInterval(relogio);
    };
  }, []);

  useEffect(() => {
    if (!bloqueado) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, [bloqueado]);

  if (!bloqueado) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Acesso bloqueado"
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ zIndex: 2147483647, backgroundColor: '#050505' }}
    >
      <style>{`
        @keyframes bloqueio-grade { from { background-position: 0 0; } to { background-position: 0 116px; } }
        @keyframes bloqueio-brilho {
          0%, 100% { opacity: .35; transform: scale(1); }
          50%      { opacity: .85; transform: scale(1.08); }
        }
        @keyframes bloqueio-anel {
          0%   { transform: scale(.55); opacity: .55; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        @keyframes bloqueio-piscar {
          0%, 92%, 96%, 100% { opacity: 1; }
          94%                { opacity: .35; }
        }
        @keyframes bloqueio-varredura {
          0%   { transform: translateY(-12vh); }
          100% { transform: translateY(112vh); }
        }
        @keyframes bloqueio-entrada {
          from { opacity: 0; transform: translateY(14px) scale(.96); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>

      {/* Grade de cruzes vermelhas, descendo devagar ao fundo */}
      {/* A cruz vem desenhada num tile SVG: máscara composta não se comporta
          igual em todo navegador, e aqui o desenho precisa ser o mesmo sempre. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='116' height='116'%3E%3Cpath d='M12 4 V20 M4 12 H20' stroke='%23dc2626' stroke-width='1.7' stroke-linecap='round' opacity='.8'/%3E%3C/svg%3E\")",
          backgroundSize: '116px 116px',
          animation: 'bloqueio-grade 7s linear infinite'
        }}
      />

      {/* Clarão vermelho no centro */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 'min(120vw, 900px)',
          height: 'min(120vw, 900px)',
          background: 'radial-gradient(circle, rgba(220,38,38,.22) 0%, transparent 62%)'
        }}
      />

      {/* Linha de varredura */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,.85), transparent)',
          animation: 'bloqueio-varredura 3.6s linear infinite'
        }}
      />

      <div
        className="relative flex flex-col items-center px-6 text-center"
        style={{ animation: 'bloqueio-entrada .45s ease-out both' }}
      >
        {/* Anéis que abrem a partir do símbolo */}
        <span className="relative flex items-center justify-center">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 'min(72vw, 380px)',
                height: 'min(72vw, 380px)',
                border: '1px dashed rgba(239,68,68,.45)',
                animation: `bloqueio-anel 3.2s ease-out ${i * 1.05}s infinite`
              }}
            />
          ))}

          <svg
            viewBox="0 0 100 88"
            className="relative"
            style={{
              width: 'min(58vw, 300px)',
              filter: 'drop-shadow(0 0 28px rgba(239,68,68,.75))',
              animation: 'bloqueio-brilho 1.8s ease-in-out infinite'
            }}
            aria-hidden="true"
          >
            <path
              d="M50 6 L96 84 L4 84 Z"
              fill="none"
              stroke="#EF4444"
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <rect x="45" y="30" width="10" height="27" rx="5" fill="#EF4444" />
            <circle cx="50" cy="68" r="6" fill="#EF4444" />
          </svg>
        </span>

        <h1
          className="mt-6 text-white font-black tracking-tight leading-none"
          style={{
            fontSize: 'clamp(34px, 11vw, 82px)',
            letterSpacing: '-0.02em',
            textShadow: '0 0 30px rgba(239,68,68,.45)',
            animation: 'bloqueio-piscar 4s linear infinite'
          }}
        >
          ACESSO BLOQUEADO
        </h1>

        <p
          className="mt-3 text-white font-bold"
          style={{ fontSize: 'clamp(12px, 3.6vw, 17px)' }}
        >
          Esta página é monitorada 24 horas por dia.
        </p>
      </div>

      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          bottom: '21%',
          height: 1,
          backgroundColor: 'rgba(239,68,68,.9)',
          boxShadow: '0 0 12px rgba(239,68,68,.55)'
        }}
      />
    </div>
  );
}
