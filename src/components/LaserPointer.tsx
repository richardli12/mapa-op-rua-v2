import { useEffect, useRef } from 'react';

interface LaserPointerProps {
  /** Ligado, o cursor some e o laser assume a tela. */
  ativo: boolean;
}

/** Quanto tempo um pedaço do rastro leva para sumir, em milissegundos. */
const VIDA_DO_RASTRO = 800;

/** Teto do buffer: a 60 quadros por segundo, 800 ms cabem com folga aqui. */
const MAXIMO_DE_PONTOS = 180;

interface Ponto {
  x: number;
  y: number;
  t: number;
}

/**
 * Ponteiro laser da apresentação, com rastro.
 *
 * Serve para quem está mostrando o painel numa reunião ou num telão: a seta
 * do sistema some e no lugar dela fica um ponto vermelho brilhante que deixa
 * uma cauda luminosa pelo caminho, como um laser de verdade apontado para a
 * parede. A cauda afina e apaga sozinha em 800 ms — isto não é ferramenta de
 * desenho, nada fica gravado na tela.
 *
 * Quatro decisões seguram o desenho:
 *
 * 1. **Um canvas só.** As posições vivem num buffer com o instante de cada
 *    uma, e cada quadro redesenha o traço inteiro. Fazer isso com elementos
 *    do DOM seria uma bolinha por quadro — centenas de nós nascendo e
 *    morrendo por segundo, que é exatamente o "efeito bolinha" que se quer
 *    evitar, além do custo.
 * 2. **Curvas, não retas.** O traço passa por curvas quadráticas ancoradas
 *    nos pontos médios entre as amostras. É o que transforma a sequência de
 *    coordenadas do mouse num gesto contínuo, mesmo numa curva fechada.
 * 3. **Brilho por soma.** Duas passadas em `lighter` — uma larga e suave por
 *    baixo, uma fina e clara por cima — dão o halo quente do laser sem
 *    borrão cinza nas sobreposições.
 * 4. **Nada de atrapalhar.** O canvas é `fixed` com `pointer-events: none`,
 *    então clique, arrasto, hover e rolagem continuam chegando em quem está
 *    embaixo. E o laço de animação para sozinho quando o rastro acaba, para
 *    não gastar quadro à toa com a tela parada.
 */
export default function LaserPointer({ ativo }: LaserPointerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pontosRef = useRef<Ponto[]>([]);
  const quadroRef = useRef<number | null>(null);
  /** Onde a ponta está agora, e se ela deve estar visível. */
  const cabecaRef = useRef<{ x: number; y: number; visivel: boolean }>({
    x: -999,
    y: -999,
    visivel: false
  });

  useEffect(() => {
    if (!ativo) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const raiz = document.documentElement;
    raiz.classList.add('laser-ligado');

    // Cada ativação começa limpa: rastro velho não volta do nada.
    pontosRef.current = [];
    cabecaRef.current = { x: -999, y: -999, visivel: false };

    const semAnimacao = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    )?.matches;

    let largura = 0;
    let altura = 0;

    /** Acerta o canvas com o tamanho da janela e a densidade da tela. */
    const medir = () => {
      const densidade = Math.min(window.devicePixelRatio || 1, 2.5);
      largura = window.innerWidth;
      altura = window.innerHeight;
      canvas.width = Math.floor(largura * densidade);
      canvas.height = Math.floor(altura * densidade);
      canvas.style.width = `${largura}px`;
      canvas.style.height = `${altura}px`;
      // Desenhar em pixels de CSS: a densidade fica por conta da matriz.
      ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
    };
    medir();

    const limpar = () => ctx.clearRect(0, 0, largura, altura);

    /**
     * Um quadro do rastro.
     *
     * Os pontos vencidos saem do buffer, e o que sobra vira um traço cuja
     * espessura e brilho caem do mais novo para o mais velho.
     */
    const desenhar = () => {
      quadroRef.current = null;
      const agora = performance.now();
      const pontos = pontosRef.current;

      // Fora os vencidos. Como o buffer está em ordem de tempo, basta cortar
      // pela frente.
      let vivos = 0;
      while (vivos < pontos.length && agora - pontos[vivos].t > VIDA_DO_RASTRO) {
        vivos++;
      }
      if (vivos > 0) pontos.splice(0, vivos);

      limpar();

      const cabeca = cabecaRef.current;
      ctx.save();
      // A fita é desenhada em composição normal de propósito: somada, cada
      // sobreposição clarearia e devolveria as contas ao traço.
      ctx.lineJoin = 'round';

      // ---------------------------------------------------------- o rastro
      if (pontos.length > 1) {
        const vidaDe = (i: number) =>
          Math.max(0, 1 - (agora - pontos[i].t) / VIDA_DO_RASTRO);

        /** Direção do traço no ponto, olhando o vizinho de cada lado. */
        const normalDe = (i: number) => {
          const antes = pontos[Math.max(0, i - 1)];
          const depois = pontos[Math.min(pontos.length - 1, i + 1)];
          const dx = depois.x - antes.x;
          const dy = depois.y - antes.y;
          const tamanho = Math.hypot(dx, dy) || 1;
          // Perpendicular unitária: é ela que abre a fita para os dois lados.
          return { x: -dy / tamanho, y: dx / tamanho };
        };

        /** Desenha um lado da fita com curvas, não com linha quebrada. */
        const tracarLado = (lado: { x: number; y: number }[], comecar: boolean) => {
          if (comecar) ctx.moveTo(lado[0].x, lado[0].y);
          else ctx.lineTo(lado[0].x, lado[0].y);
          for (let i = 1; i < lado.length - 1; i++) {
            const meio = {
              x: (lado[i].x + lado[i + 1].x) / 2,
              y: (lado[i].y + lado[i + 1].y) / 2
            };
            ctx.quadraticCurveTo(lado[i].x, lado[i].y, meio.x, meio.y);
          }
          const ultimo = lado[lado.length - 1];
          ctx.lineTo(ultimo.x, ultimo.y);
        };

        /**
         * Uma fatia da fita, de um ponto a outro do buffer.
         *
         * O traço é um polígono preenchido, não uma sequência de linhas com
         * ponta redonda: linhas separadas se sobrepõem nas junções e, com
         * brilho somado, cada junção vira uma bolinha clara — exatamente o
         * efeito de contas que um laser não tem. Fatias vizinhas dividem a
         * mesma borda, então não há sobreposição nem emenda à vista.
         */
        const fatia = (
          de: number,
          ate: number,
          espessura: (vida: number) => number,
          cor: string
        ) => {
          const esquerda: { x: number; y: number }[] = [];
          const direita: { x: number; y: number }[] = [];

          for (let i = de; i <= ate; i++) {
            const vida = vidaDe(i);
            const normal = normalDe(i);
            const meia = espessura(vida) / 2;
            esquerda.push({
              x: pontos[i].x + normal.x * meia,
              y: pontos[i].y + normal.y * meia
            });
            direita.push({
              x: pontos[i].x - normal.x * meia,
              y: pontos[i].y - normal.y * meia
            });
          }

          ctx.beginPath();
          tracarLado(esquerda, true);
          tracarLado(direita.reverse(), false);
          ctx.closePath();
          ctx.fillStyle = cor;
          ctx.fill();
        };

        // O brilho cai do mais novo para o mais velho, e é essa variação que
        // exige repartir a fita: uma cor só não teria como se apagar ao longo
        // do caminho.
        const faixas = Math.min(14, pontos.length - 1);
        for (let f = 0; f < faixas; f++) {
          const de = Math.floor((f * (pontos.length - 1)) / faixas);
          const ate = Math.floor(((f + 1) * (pontos.length - 1)) / faixas);
          if (ate <= de) continue;

          const vida = (vidaDe(de) + vidaDe(ate)) / 2;
          if (vida <= 0) continue;

          // Halo difuso por baixo, agora mais aberto e mais presente...
          fatia(
            de,
            ate,
            (v) => 6 + 24 * v,
            `rgba(255, 40, 40, ${0.15 * vida * vida})`
          );
          // ...uma camada intermediária que engrossa o vermelho...
          fatia(
            de,
            ate,
            (v) => 2 + 11 * v,
            `rgba(255, 25, 25, ${0.3 * vida * vida})`
          );
          // ...e o fio quente por cima, que clareia perto da ponta.
          fatia(
            de,
            ate,
            (v) => 1.2 + 7.3 * v,
            `rgba(255, ${Math.round(60 + 150 * vida)}, ${Math.round(
              60 + 120 * vida
            )}, ${Math.min(1, 1.15 * vida * Math.sqrt(vida))})`
          );
        }
      }

      // ----------------------------------------------------------- a ponta
      // Aqui, sim, brilho somado: é o que dá o miolo incandescente do laser.
      ctx.globalCompositeOperation = 'lighter';
      if (cabeca.visivel) {
        // Respiração lenta do halo; parada para quem pediu menos animação.
        const pulso = semAnimacao
          ? 1
          : 1 + 0.12 * Math.sin(agora / 260);

        const halo = ctx.createRadialGradient(
          cabeca.x,
          cabeca.y,
          0,
          cabeca.x,
          cabeca.y,
          29 * pulso
        );
        halo.addColorStop(0, 'rgba(255, 40, 40, 0.68)');
        halo.addColorStop(0.45, 'rgba(255, 30, 30, 0.26)');
        halo.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cabeca.x, cabeca.y, 29 * pulso, 0, Math.PI * 2);
        ctx.fill();

        const miolo = ctx.createRadialGradient(
          cabeca.x,
          cabeca.y - 1,
          0,
          cabeca.x,
          cabeca.y,
          7.6
        );
        miolo.addColorStop(0, 'rgba(255, 255, 255, 1)');
        miolo.addColorStop(0.38, 'rgba(255, 120, 120, 1)');
        miolo.addColorStop(1, 'rgba(230, 0, 0, 0.9)');
        ctx.fillStyle = miolo;
        ctx.beginPath();
        ctx.arc(cabeca.x, cabeca.y, 7.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Tela parada e rastro apagado: o laço descansa até o próximo gesto.
      if (pontos.length > 0 || cabeca.visivel) agendar();
    };

    const agendar = () => {
      if (quadroRef.current === null) {
        quadroRef.current = requestAnimationFrame(desenhar);
      }
    };

    /**
     * Acrescenta um pedaço de rastro.
     *
     * Num movimento rápido o navegador entrega saltos grandes entre um aviso
     * e outro; os pontos intermediários entram aqui para a curva não virar
     * uma corda esticada de um canto ao outro.
     */
    const rastrear = (x: number, y: number) => {
      const pontos = pontosRef.current;
      const ultimo = pontos[pontos.length - 1];
      const agora = performance.now();

      if (ultimo) {
        const distancia = Math.hypot(x - ultimo.x, y - ultimo.y);
        if (distancia > 34) {
          const pedacos = Math.min(Math.floor(distancia / 17), 12);
          for (let i = 1; i < pedacos; i++) {
            const fracao = i / pedacos;
            pontos.push({
              x: ultimo.x + (x - ultimo.x) * fracao,
              y: ultimo.y + (y - ultimo.y) * fracao,
              // O tempo também é interpolado: o pedaço do meio do salto
              // apaga na hora certa, não tudo de uma vez.
              t: ultimo.t + (agora - ultimo.t) * fracao
            });
          }
        }
      }

      pontos.push({ x, y, t: agora });
      if (pontos.length > MAXIMO_DE_PONTOS) {
        pontos.splice(0, pontos.length - MAXIMO_DE_PONTOS);
      }
    };

    /* --------------------------------------------------------- o gesto ---
     * O ponto segue o cursor o tempo todo, mas o rastro é riscado: ele só
     * nasce com o botão esquerdo apertado (ou o dedo na tela) e para no
     * instante em que ele é solto. Sem isso, atravessar a tela para alcançar
     * um menu deixaria um risco vermelho que ninguém pediu.
     */
    let riscando = false;
    let inicio = { x: 0, y: 0 };
    let arrastou = false;
    /** Um arrasto não pode virar clique em quem estava embaixo do dedo. */
    let bloquearClique = false;

    const aoDescer = (e: PointerEvent) => {
      // Só o botão principal risca; o direito e o do meio têm dono no mapa.
      if (!e.isPrimary || e.button !== 0) return;
      riscando = true;
      arrastou = false;
      inicio = { x: e.clientX, y: e.clientY };
      cabecaRef.current = { x: e.clientX, y: e.clientY, visivel: true };
      // O traço novo começa do zero, e não emendado no que sobrou do último.
      pontosRef.current = [];
      rastrear(e.clientX, e.clientY);
      agendar();
    };

    const aoMover = (e: PointerEvent) => {
      cabecaRef.current = { x: e.clientX, y: e.clientY, visivel: true };

      // O botão pode ter sido solto fora da janela: `buttons` é a verdade do
      // momento, e sem ele o rastro continuaria sozinho.
      if (riscando && !(e.buttons & 1)) {
        riscando = false;
      }

      if (riscando) {
        if (
          !arrastou &&
          Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6
        ) {
          arrastou = true;
        }
        rastrear(e.clientX, e.clientY);
      }

      agendar();
    };

    const aoSubir = (e: PointerEvent) => {
      if (riscando && arrastou) {
        // Só o arrasto bloqueia o clique. Um toque seco continua clicando,
        // senão o laser transformaria o painel numa vitrine.
        bloquearClique = true;
      }
      riscando = false;
      arrastou = false;
      // No toque não há cursor pairando: tirou o dedo, a ponta sai junto.
      if (e.pointerType !== 'mouse') {
        cabecaRef.current = { ...cabecaRef.current, visivel: false };
      }
      agendar();
    };

    const aoCancelar = () => {
      riscando = false;
      arrastou = false;
      cabecaRef.current = { ...cabecaRef.current, visivel: false };
      agendar();
    };

    const aoClicar = (e: MouseEvent) => {
      if (!bloquearClique) return;
      bloquearClique = false;
      e.stopPropagation();
      e.preventDefault();
    };

    /** Mouse que saiu da janela não deixa um ponto parado na borda. */
    const saiuDaJanela = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        riscando = false;
        cabecaRef.current = { ...cabecaRef.current, visivel: false };
        agendar();
      }
    };

    const aoRedimensionar = () => {
      medir();
      agendar();
    };

    window.addEventListener('pointerdown', aoDescer, { passive: true });
    window.addEventListener('pointermove', aoMover, { passive: true });
    window.addEventListener('pointerup', aoSubir, { passive: true });
    window.addEventListener('pointercancel', aoCancelar, { passive: true });
    // Captura: o clique precisa ser barrado antes de chegar em quem escuta.
    window.addEventListener('click', aoClicar, true);
    window.addEventListener('resize', aoRedimensionar);
    document.addEventListener('mouseout', saiuDaJanela);

    return () => {
      raiz.classList.remove('laser-ligado');
      window.removeEventListener('pointerdown', aoDescer);
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSubir);
      window.removeEventListener('pointercancel', aoCancelar);
      window.removeEventListener('click', aoClicar, true);
      window.removeEventListener('resize', aoRedimensionar);
      document.removeEventListener('mouseout', saiuDaJanela);

      if (quadroRef.current !== null) cancelAnimationFrame(quadroRef.current);
      quadroRef.current = null;
      // Desligou: ponta e rastro saem na mesma hora, sem despedida.
      pontosRef.current = [];
      cabecaRef.current = { x: -999, y: -999, visivel: false };
      limpar();
    };
  }, [ativo]);

  if (!ativo) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[99999] pointer-events-none select-none"
    />
  );
}
