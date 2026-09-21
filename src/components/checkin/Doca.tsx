import React from 'react';

/**
 * A doca: a faixa fixa no rodapé onde mora a ação da etapa.
 *
 * É a mudança que faz esta tela virar conversa de verdade. Antes, o botão que
 * fechava cada etapa ficava dentro do fio: quem tinha mandado seis fotos
 * precisava rolar a tela para trás para achar "confirmar", e quem voltava a
 * uma etapa antiga encontrava dois botões parecidos em lugares diferentes.
 *
 * Aqui é sempre o mesmo lugar, sempre ao alcance do polegar, e o que muda é
 * só o conteúdo — câmera na etapa das fotos, campo de escrever na das
 * observações, botão grande na revisão. Exatamente como qualquer aplicativo
 * de mensagem se comporta, que é o que a pessoa na rua já sabe usar.
 */
export default function Doca({
  children,
  /** Muda a cada etapa: é a chave que reanima a doca na troca. */
  chave
}: {
  children: React.ReactNode;
  chave: string | number;
}) {
  return (
    <div
      className="shrink-0 bg-white border-t border-slate-150"
      style={{
        paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
        boxShadow: '0 -10px 30px -22px rgba(12,53,86,.55)'
      }}
    >
      <div key={chave} className="ck-doca px-3 pt-2.5 pb-1 space-y-2.5">
        {children}
      </div>
    </div>
  );
}

/**
 * A fileira de atalhos da doca — câmera, vídeo, galeria, mapa.
 *
 * Botões redondos e largos, porque o dedo na rua não é o mouse na mesa.
 */
export function AtalhoDaDoca({
  icone,
  rotulo,
  onClick,
  disabled,
  cor
}: {
  icone: React.ReactNode;
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
  cor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 min-w-0 h-[46px] rounded-2xl border border-slate-200 bg-white text-slate-700 text-[12.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={cor ? { color: cor } : undefined}
    >
      {icone}
      <span className="truncate">{rotulo}</span>
    </button>
  );
}
