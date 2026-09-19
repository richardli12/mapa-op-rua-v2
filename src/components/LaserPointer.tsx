import { useEffect, useRef, useState } from 'react';

interface LaserPointerProps {
  /** Ligado, o cursor some e o ponto vermelho assume. */
  ativo: boolean;
}

/**
 * Ponteiro laser da apresentação.
 *
 * Serve para quem está mostrando o painel numa reunião ou numa tela grande:
 * o cursor de seta some e no lugar dele fica um ponto vermelho com halo, que
 * a sala inteira enxerga de longe.
 *
 * Três cuidados guiam o código aqui:
 *
 * 1. O ponto nunca atrapalha. Ele é `position: fixed` com `pointer-events:
 *    none`, então clique, hover, arrasto e rolagem continuam chegando em
 *    quem está embaixo — o laser é enfeite, não uma camada de vidro.
 * 2. Nada de re-render por movimento. A posição vai direto no `transform` do
 *    elemento, dentro de um requestAnimationFrame, então mover o mouse não
 *    faz o React redesenhar nada. Num painel deste tamanho, um setState por
 *    pixel travaria a tela.
 * 3. No toque, o ponto acompanha o dedo e some quando ele sai. Os avisos são
 *    todos `passive`, para a rolagem do celular continuar leve.
 */
export default function LaserPointer({ ativo }: LaserPointerProps) {
  const pontoRef = useRef<HTMLDivElement>(null);
  const alvoRef = useRef({ x: -999, y: -999 });
  const quadroRef = useRef<number | null>(null);
  /** Só aparece depois do primeiro movimento: sem isso nasceria no canto. */
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!ativo) {
      setVisivel(false);
      return;
    }

    const raiz = document.documentElement;
    // A seta do sistema sai de cena enquanto o laser está ligado.
    raiz.classList.add('laser-ligado');

    const desenhar = () => {
      quadroRef.current = null;
      const elemento = pontoRef.current;
      if (!elemento) return;
      const { x, y } = alvoRef.current;
      elemento.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    const agendar = () => {
      if (quadroRef.current === null) {
        quadroRef.current = requestAnimationFrame(desenhar);
      }
    };

    const mover = (x: number, y: number) => {
      alvoRef.current = { x, y };
      setVisivel(true);
      agendar();
    };

    const noMouse = (e: MouseEvent) => mover(e.clientX, e.clientY);
    const noToque = (e: TouchEvent) => {
      const dedo = e.touches[0];
      if (dedo) mover(dedo.clientX, dedo.clientY);
    };
    const sumir = () => setVisivel(false);
    /** Mouse que saiu da janela não deixa um ponto parado na borda. */
    const saiuDaJanela = (e: MouseEvent) => {
      if (!e.relatedTarget) sumir();
    };

    window.addEventListener('mousemove', noMouse, { passive: true });
    window.addEventListener('dragover', noMouse as any, { passive: true });
    window.addEventListener('touchstart', noToque, { passive: true });
    window.addEventListener('touchmove', noToque, { passive: true });
    window.addEventListener('touchend', sumir, { passive: true });
    window.addEventListener('touchcancel', sumir, { passive: true });
    document.addEventListener('mouseout', saiuDaJanela);

    return () => {
      raiz.classList.remove('laser-ligado');
      window.removeEventListener('mousemove', noMouse);
      window.removeEventListener('dragover', noMouse as any);
      window.removeEventListener('touchstart', noToque);
      window.removeEventListener('touchmove', noToque);
      window.removeEventListener('touchend', sumir);
      window.removeEventListener('touchcancel', sumir);
      document.removeEventListener('mouseout', saiuDaJanela);
      if (quadroRef.current !== null) cancelAnimationFrame(quadroRef.current);
      quadroRef.current = null;
    };
  }, [ativo]);

  if (!ativo) return null;

  return (
    <div
      ref={pontoRef}
      aria-hidden="true"
      className="fixed top-0 left-0 z-[99999] pointer-events-none select-none"
      style={{
        opacity: visivel ? 1 : 0,
        transition: 'opacity 140ms ease-out',
        willChange: 'transform'
      }}
    >
      {/* Halo: o brilho que faz o ponto ser visto do fundo da sala */}
      <span
        className="block rounded-full laser-halo"
        style={{
          width: 42,
          height: 42,
          background:
            'radial-gradient(circle, rgba(255,40,40,.55) 0%, rgba(255,40,40,.22) 42%, rgba(255,40,40,0) 70%)'
        }}
      />
      {/* Miolo: o ponto em si, com o branco quente de um laser de verdade */}
      <span
        className="absolute top-1/2 left-1/2 block rounded-full"
        style={{
          width: 12,
          height: 12,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at 50% 42%, #fff 0%, #ff6b6b 38%, #e60000 100%)',
          boxShadow:
            '0 0 6px 2px rgba(255,30,30,.9), 0 0 16px 6px rgba(255,0,0,.45)'
        }}
      />
    </div>
  );
}
