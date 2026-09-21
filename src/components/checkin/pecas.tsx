import React, { useEffect, useState } from 'react';
import BrandMark from '../BrandMark';

/**
 * As peças soltas da conversa do check-in.
 *
 * Cor, bolha, anel, avatar e botão principal moram aqui porque são usados por
 * todas as partes da tela — cabeçalho, fio, doca e conclusão. Sem este arquivo
 * cada uma delas redesenhava o mesmo azul com um tom de diferença.
 */

/** Cores da marca. O fio inteiro fala esta língua. */
export const AZUL = '#0C3556';
export const AZUL_CLARO = '#124A74';
export const VERDE = '#08A47B';
export const FUNDO = '#F3F6FA';

/** '1 foto' / '3 fotos' sem espalhar ternário pela tela. */
export const contar = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

export const horaAgora = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Um tranco curto no aparelho.
 *
 * Quem está na rua olha a tela de esguelha, com sol batendo e o celular na
 * mão suja. O toque no vidro não avisa que a etapa fechou; a vibração avisa.
 * Navegador que não tem `vibrate` simplesmente não faz nada.
 */
export const vibrar = (padrao: number | number[] = 12) => {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    /* aparelho sem vibração: a tela continua funcionando igual */
  }
};

/** Foto do integrante, do lado direito da conversa. */
export function Avatar({
  nome,
  foto,
  tamanho = 28
}: {
  nome: string;
  foto?: string;
  tamanho?: number;
}) {
  return (
    <span
      className="rounded-full bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center"
      style={{ width: tamanho, height: tamanho }}
    >
      {foto ? (
        <img
          src={foto}
          alt={nome}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className="font-black text-slate-500 uppercase"
          style={{ fontSize: Math.round(tamanho * 0.36) }}
        >
          {nome.substring(0, 2)}
        </span>
      )}
    </span>
  );
}

/** Os três pontinhos de "o sistema está escrevendo". */
export function Digitando() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="ck-ponto w-1.5 h-1.5 rounded-full bg-slate-400"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

/**
 * Fala do sistema, à esquerda.
 *
 * Com `atraso`, a bolha nasce como os três pontinhos e só depois mostra o
 * texto. É o que separa uma conversa de um formulário que se desdobra: a
 * pergunta seguinte chega, ela não estava lá o tempo todo. O atraso só vale
 * na primeira montagem — voltar para corrigir uma etapa não faz o sistema
 * "reescrever" o que já foi dito.
 */
export function Fala({
  children,
  hora,
  atraso = 0,
  destaque = false
}: {
  children: React.ReactNode;
  hora?: string;
  atraso?: number;
  /** Fala de abertura: um pouco maior, porque é ela que dá o tom. */
  destaque?: boolean;
}) {
  const [escrevendo, setEscrevendo] = useState(atraso > 0);

  useEffect(() => {
    if (!atraso) return;
    const t = setTimeout(() => setEscrevendo(false), atraso);
    return () => clearTimeout(t);
  }, [atraso]);

  return (
    <div className="ck-entra flex items-end gap-2">
      <span className="shrink-0">
        <BrandMark size={28} rounded={8} />
      </span>
      <div className="max-w-[80%]">
        <div
          className={`px-3.5 py-2.5 leading-snug shadow-sm bg-white text-slate-700 rounded-2xl rounded-bl-md border border-slate-100 ${
            destaque ? 'text-[14px]' : 'text-[13.5px]'
          }`}
        >
          {escrevendo ? <Digitando /> : children}
        </div>
        {!escrevendo && hora && (
          <span className="block text-[10px] text-slate-400 font-semibold mt-1">{hora}</span>
        )}
      </div>
    </div>
  );
}

/** Resposta do integrante, à direita. */
export function Resposta({
  children,
  hora,
  avatar,
  largura = '80%'
}: {
  children: React.ReactNode;
  hora?: string;
  avatar: React.ReactNode;
  largura?: string;
}) {
  return (
    <div className="ck-entra flex items-end gap-2 flex-row-reverse">
      {avatar}
      <div className="flex flex-col items-end" style={{ maxWidth: largura }}>
        <div
          className="px-3.5 py-2.5 text-[13.5px] leading-snug shadow-sm text-white rounded-2xl rounded-br-md font-semibold"
          style={{ backgroundColor: AZUL }}
        >
          {children}
        </div>
        {hora && (
          <span className="block text-[10px] text-slate-400 font-semibold mt-1 text-right">
            {hora}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Bloco do integrante que não é bolha de texto: mapa, grade de fotos, cartões.
 *
 * Alinha à direita como uma resposta, mas deixa o filho desenhar o que quiser
 * — e reserva a coluna do avatar para as bordas não dançarem entre um bloco e
 * outro.
 */
export function BlocoDoIntegrante({
  children,
  avatar,
  largura = '86%'
}: {
  children: React.ReactNode;
  /** Sem avatar, o espaço dele continua reservado: a margem não muda. */
  avatar?: React.ReactNode;
  largura?: string;
}) {
  return (
    <div className="ck-entra flex items-end gap-2 flex-row-reverse">
      {avatar || <span className="w-7 shrink-0" />}
      <div className="w-full flex flex-col items-stretch gap-2" style={{ maxWidth: largura }}>
        {children}
      </div>
    </div>
  );
}

/**
 * O anel da meta.
 *
 * Um número solto ("3") não diz nada; o anel diz quanto falta antes de a
 * pessoa ler qualquer coisa. `risca` liga a animação de preenchimento, usada
 * só na tela de conclusão, quando o número acabou de mudar.
 */
export function AnelDeProgresso({
  feito,
  alvo,
  tamanho = 40,
  espessura = 4,
  cor,
  corDoTrilho = 'rgba(255,255,255,0.22)',
  risca = false,
  children
}: {
  feito: number;
  alvo: number;
  tamanho?: number;
  espessura?: number;
  cor: string;
  corDoTrilho?: string;
  risca?: boolean;
  children?: React.ReactNode;
}) {
  const raio = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * raio;
  const parte = alvo > 0 ? Math.min(1, feito / alvo) : 0;

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: tamanho, height: tamanho }}
    >
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden="true">
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke={corDoTrilho}
          strokeWidth={espessura}
        />
        <circle
          className={risca ? 'ck-risca' : undefined}
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - parte)}
          style={{ ['--ck-volta' as any]: volta, transition: 'stroke-dashoffset .5s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}

/**
 * O botão que fecha a etapa, sempre no mesmo lugar da doca.
 *
 * Alto o bastante para o polegar acertar sem olhar, e com uma linha embaixo
 * dizendo por que ele está apagado quando está apagado — botão desabilitado
 * sem explicação é a forma mais rápida de travar alguém na rua.
 */
export function BotaoPrincipal({
  children,
  onClick,
  disabled,
  carregando,
  motivo,
  cor = AZUL,
  icone
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  carregando?: boolean;
  /** O que falta para o botão acender, ou a confirmação do que já está feito. */
  motivo?: string;
  cor?: string;
  icone?: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => {
          if (disabled || carregando) return;
          vibrar();
          onClick();
        }}
        disabled={disabled || carregando}
        className="w-full h-[52px] text-white text-[13px] font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.985] disabled:opacity-45 disabled:cursor-not-allowed shadow-lg"
        style={{
          backgroundColor: cor,
          boxShadow: disabled || carregando ? 'none' : `0 10px 22px -12px ${cor}`
        }}
      >
        {icone}
        {children}
      </button>
      {motivo && (
        <p className="mt-1.5 text-[11px] font-bold text-slate-400 text-center leading-snug">
          {motivo}
        </p>
      )}
    </div>
  );
}
