import React from 'react';
import { Check, Loader2 } from 'lucide-react';

/**
 * As peças de que toda seção de Configurações é feita.
 *
 * Existem para que as seções não inventem cada uma o seu cartão, o seu jeito
 * de dizer "não salvo" e a sua chave de liga-desliga. Tela de configuração
 * ganha seção nova todo mês; quando cada uma tem a própria aparência, em um
 * ano a página vira uma colcha de retalhos e ninguém acha mais nada.
 */

export type EstadoDoCartao = 'salvo' | 'pendente' | 'salvando' | 'instantaneo';

/** O selo que diz em que pé a seção está. */
export function SeloDeEstado({ estado }: { estado: EstadoDoCartao }) {
  if (estado === 'salvando') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        Salvando
      </span>
    );
  }
  if (estado === 'pendente') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Não salvo
      </span>
    );
  }
  if (estado === 'instantaneo') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-400 border border-slate-200">
        Salva sozinho
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Check className="w-3 h-3" />
      Salvo
    </span>
  );
}

/**
 * O cartão de uma seção.
 *
 * Carrega a âncora usada pela navegação lateral e pelo painel de saúde: é por
 * ela que "3 níveis cadastrados" leva ao lugar onde se cadastram níveis.
 */
export function Cartao({
  id,
  titulo,
  subtitulo,
  Icone,
  estado,
  acessorio,
  children
}: {
  id: string;
  titulo: string;
  subtitulo: string;
  Icone: React.ComponentType<{ className?: string }>;
  estado?: EstadoDoCartao;
  /** Algo à direita do cabeçalho — um "agora é noite", uma contagem. */
  acessorio?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      // A âncora precisa parar abaixo do topo, senão o cabeçalho fixo come o
      // título da seção para onde a pessoa acabou de pular.
      className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl shadow-sm p-6"
    >
      <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
          <Icone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider leading-tight">
            {titulo}
          </h3>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{subtitulo}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {acessorio}
          {estado && <SeloDeEstado estado={estado} />}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * A chave de liga-desliga.
 *
 * Grava no momento em que é tocada, de propósito: botão de salvar para uma
 * chave é cerimônia demais, e ninguém lembra de apertar. O que a tela deve a
 * quem tocou é dizer que gravou — por isso ela tem um estado de "salvando".
 */
export function Interruptor({
  ligado,
  onMudar,
  ocupado = false,
  desabilitado = false,
  rotulo
}: {
  ligado: boolean;
  onMudar: () => void;
  ocupado?: boolean;
  desabilitado?: boolean;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado || ocupado}
      onClick={onMudar}
      className={`w-14 h-8 rounded-full shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed relative ${
        ligado ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`block w-6 h-6 bg-white rounded-full shadow transition-transform flex items-center justify-center ${
          ligado ? 'translate-x-7' : 'translate-x-1'
        }`}
      >
        {ocupado && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
      </span>
    </button>
  );
}

/** Campo de texto com a mesma cara em todas as seções. */
export function Campo({
  children,
  rotulo,
  dica
}: {
  children: React.ReactNode;
  rotulo: string;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-black tracking-widest text-[#8492A6] mb-1.5">
        {rotulo}
      </span>
      {children}
      {dica && (
        <span className="block text-[11px] text-slate-400 font-semibold leading-relaxed mt-1.5">
          {dica}
        </span>
      )}
    </label>
  );
}
