import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * As peças de que as telas do território são feitas.
 *
 * Moram fora de `PainelDoCenso` porque a medida de um círculo desenhado no
 * mapa mostra os mesmos cartões e os mesmos selos que a visão geral de um
 * município — e duas cópias do mesmo cartão divergem no primeiro ajuste de
 * padding que só uma delas recebe.
 */

/* ---------------------------------------------------------------- texto --- */

export const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export const numero = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? '—'
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

/** Uma casa decimal, e o '%' colado — o jeito de escrever um indicador. */
export const valorComUnidade = (valor: number, unidade: string) => {
  const escrito = valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (!unidade) return escrito;
  return unidade === '%' ? `${escrito}%` : `${escrito} ${unidade}`;
};

export const porcento = (fracao: number, casas = 1) =>
  `${(fracao * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  })}%`;

/* ----------------------------------------------------------------- selo --- */

const DICA_DERIVADO =
  'Derivado: não vem publicado assim. É calculado aqui a partir dos números do Censo deste recorte.';

/**
 * O selo de origem do número.
 *
 * Verde e curto para o que o instituto publicou; azul e com o "i" para o que
 * foi calculado. É a diferença entre "está escrito lá" e "a conta é nossa" —
 * e quem decide alguma coisa olhando para o número precisa saber qual é.
 *
 * `rotulo` e `dica` existem para a medida de área, onde "derivado" é curto
 * demais para o que está acontecendo: ali o número é ESTIMATIVA, com setor
 * entrando pela fração de área coberta.
 */
export function Selo({
  origem,
  instituto,
  rotulo,
  dica
}: {
  origem: 'direto' | 'derivado';
  instituto: string;
  rotulo?: string;
  dica?: string;
}) {
  if (origem === 'derivado') {
    return (
      <span
        title={dica || DICA_DERIVADO}
        className="shrink-0 inline-flex items-center gap-1 px-[5px] py-[3px] rounded-[5px] bg-[#F0F9FF] text-[#1575B0] text-[8px] font-bold leading-none"
      >
        {rotulo || 'derivado'}
        <Info className="w-[10px] h-[10px]" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      title={dica || `Publicado pelo ${instituto} para este recorte.`}
      className="shrink-0 inline-flex items-center px-[5px] py-[3px] rounded-[5px] bg-[#ECFDF5] text-[#188765] text-[8px] font-bold leading-none"
    >
      {rotulo || instituto}
    </span>
  );
}

/* -------------------------------------------------------------- cartões --- */

/** Cartão branco: a moldura de toda seção destas telas. */
export function Cartao({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[14px] bg-white border border-slate-100 shadow-[0_1px_2px_rgba(15,23,43,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function TituloDeCartao({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] font-bold text-[#0F172B]">{children}</p>;
}

/** Um cartão de número, para as grades de três colunas. */
export function CartaoDeNumero({
  rotulo,
  valor,
  origem,
  instituto,
  seloRotulo,
  seloDica
}: {
  rotulo: string;
  valor: string;
  origem: 'direto' | 'derivado';
  instituto: string;
  seloRotulo?: string;
  seloDica?: string;
}) {
  return (
    <Cartao className="p-3.5">
      {/*
        Rótulo e selo no mesmo fluxo, de propósito: em "População" o selo cabe
        na linha do rótulo, em "Alfabetização (15+)" ele desce sozinho. É a
        quebra natural do texto fazendo o trabalho que uma grade fixa faria
        pior num painel que muda de largura.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-[11px] text-[#62748E] leading-tight">{rotulo}</p>
        <Selo origem={origem} instituto={instituto} rotulo={seloRotulo} dica={seloDica} />
      </div>
      <p className="mt-1.5 text-[20px] font-bold text-[#0F172B] leading-none tracking-tight">
        {valor}
      </p>
    </Cartao>
  );
}
