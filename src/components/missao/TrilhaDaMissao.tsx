import React from 'react';
import { Check, ChevronRight } from 'lucide-react';

/**
 * A trilha do formulário de missão.
 *
 * Criar missão é responder cinco perguntas — onde, o quê, quando, para quem,
 * com o quê — e o formulário antigo as empilhava numa coluna de 450 pixels,
 * todas com o mesmo peso: o seletor de cor tinha o mesmo destaque que a
 * instrução que a equipe vai ler na rua. Numa lista sem hierarquia, quem
 * preenche desiste no meio e salva o que deu.
 *
 * A trilha devolve a hierarquia: diz quantos passos existem, qual deles já
 * está respondido e leva direto ao que falta.
 */

export interface PassoDaMissao {
  id: string;
  rotulo: string;
  /** Resumo do que já foi respondido — some quando ainda não há resposta. */
  resumo?: string;
  estado: 'feito' | 'falta' | 'opcional';
}

export default function TrilhaDaMissao({
  passos,
  ativo,
  onIr
}: {
  passos: PassoDaMissao[];
  ativo: string;
  onIr: (id: string) => void;
}) {
  return (
    <nav className="space-y-1">
      {passos.map((passo, i) => {
        const selecionado = ativo === passo.id;
        return (
          <button
            key={passo.id}
            type="button"
            onClick={() => onIr(passo.id)}
            aria-current={selecionado ? 'true' : undefined}
            className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors ${
              selecionado ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black border ${
                passo.estado === 'feito'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : passo.estado === 'falta'
                    ? 'bg-white border-rose-300 text-rose-500'
                    : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              {passo.estado === 'feito' ? <Check className="w-3 h-3 stroke-[3]" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[11.5px] font-black leading-none truncate ${
                  selecionado ? 'text-indigo-900' : 'text-slate-700'
                }`}
              >
                {passo.rotulo}
              </span>
              <span
                className={`block text-[9.5px] font-bold leading-none mt-1 truncate ${
                  passo.estado === 'falta' ? 'text-rose-500' : 'text-slate-400'
                }`}
              >
                {passo.resumo || (passo.estado === 'falta' ? 'falta preencher' : 'opcional')}
              </span>
            </span>
            <ChevronRight
              className={`w-3 h-3 shrink-0 ${selecionado ? 'text-indigo-400' : 'text-slate-300'}`}
            />
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Um passo do formulário, com âncora e número.
 *
 * O número não é enfeite: é o que liga o campo à trilha da esquerda, e o que
 * deixa dizer "falta o 2" em vez de "falta aquele campo lá em cima".
 */
export function PassoDoFormulario({
  id,
  numero,
  titulo,
  descricao,
  acessorio,
  children
}: {
  id: string;
  numero: number;
  titulo: string;
  descricao?: string;
  acessorio?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={`passo-${id}`} className="scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-extrabold text-[10px] text-indigo-600 shrink-0">
          {numero}
        </span>
        <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none">
          {titulo}
        </h4>
        {descricao && (
          <span className="text-[10px] font-semibold text-slate-400 truncate">{descricao}</span>
        )}
        <span className="flex-1" />
        {acessorio}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
