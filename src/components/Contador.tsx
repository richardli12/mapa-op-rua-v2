import React, { useEffect, useRef, useState } from 'react';

const semMovimento = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Um número que chega contando.
 *
 * O painel é feito de números — clientes, equipe, check-ins — e número que
 * simplesmente aparece não chama o olho para ele. Este sobe do anterior até o
 * novo em menos de um segundo, desacelerando no fim, e quando o valor muda
 * (chegou um check-in) ele anda do que era para o que é: a mudança se vê.
 *
 * Quem pediu menos movimento no sistema recebe o número direto.
 */
export default function Contador({
  valor,
  duracao = 900,
  formatar = (n: number) => n.toLocaleString('pt-BR')
}: {
  valor: number;
  duracao?: number;
  formatar?: (n: number) => string;
}) {
  const [mostrado, setMostrado] = useState(() => (semMovimento() ? valor : 0));
  const deOnde = useRef(mostrado);

  useEffect(() => {
    if (semMovimento()) {
      setMostrado(valor);
      deOnde.current = valor;
      return;
    }
    const inicio = performance.now();
    const origem = deOnde.current;
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 3);
      const atual = Math.round(origem + (valor - origem) * suave);
      setMostrado(atual);
      deOnde.current = atual;
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao]);

  return <span className="tabular-nums">{formatar(mostrado)}</span>;
}
