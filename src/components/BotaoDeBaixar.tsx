import React, { useEffect, useRef, useState } from 'react';
import { Check, Download } from 'lucide-react';
import { baixarArquivo } from '../baixar';

/**
 * O botão de baixar, que baixa.
 *
 * Três estados que a pessoa enxerga: parado, chegando (o anel enche com o
 * quanto do arquivo já veio — um vídeo de 40 MB no 4G leva tempo, e botão
 * que não responde é botão apertado de novo) e pronto (o visto, que some
 * sozinho). Em nenhum deles a tela sai do lugar.
 */
export default function BotaoDeBaixar({
  url,
  nome,
  variante = 'icone',
  rotulo = 'Baixar',
  className = ''
}: {
  url: string;
  nome: string;
  /** 'icone': bolinha, para cima de foto e vídeo. 'bloco': botão largo com texto. */
  variante?: 'icone' | 'bloco';
  rotulo?: string;
  className?: string;
}) {
  const [estado, setEstado] = useState<'parado' | 'baixando' | 'pronto'>('parado');
  const [fracao, setFracao] = useState<number | null>(0);
  const vivo = useRef(true);

  // Liga ao montar, e não só na criação da ref: o React monta, desmonta e
  // remonta em desenvolvimento, e a trava ficaria desligada para sempre.
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const baixar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (estado === 'baixando') return;
    setEstado('baixando');
    setFracao(0);
    await baixarArquivo(url, nome, (f) => vivo.current && setFracao(f));
    if (!vivo.current) return;
    setEstado('pronto');
    window.setTimeout(() => vivo.current && setEstado('parado'), 1800);
  };

  const r = 15;
  const volta = 2 * Math.PI * r;
  const anel = (
    <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={volta}
        strokeDashoffset={fracao === null ? volta * 0.72 : volta * (1 - fracao)}
        className={fracao === null ? 'baixar-girando' : ''}
        style={{ transition: 'stroke-dashoffset 0.25s ease-out', transformOrigin: 'center' }}
      />
    </svg>
  );

  const dica =
    estado === 'baixando'
      ? fracao === null
        ? 'Baixando…'
        : `Baixando… ${Math.round(fracao * 100)}%`
      : estado === 'pronto'
        ? 'Baixado'
        : rotulo;

  if (variante === 'bloco') {
    return (
      <button
        type="button"
        onClick={baixar}
        aria-label={dica}
        className={`relative overflow-hidden inline-flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider cursor-pointer ${className}`}
      >
        {estado === 'baixando' && (
          <span
            className="absolute inset-y-0 left-0 bg-white/15 transition-[width] duration-200"
            style={{ width: fracao === null ? '100%' : `${Math.round(fracao * 100)}%` }}
          />
        )}
        <span className="relative inline-flex items-center gap-1.5">
          {estado === 'pronto' ? (
            <Check className="w-3.5 h-3.5 stroke-[3] baixar-visto" />
          ) : (
            <Download className={`w-3.5 h-3.5 ${estado === 'baixando' ? 'baixar-desce' : ''}`} />
          )}
          {dica}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={baixar}
      aria-label={dica}
      title={dica}
      className={`relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
        estado === 'pronto' ? 'bg-emerald-500 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
      } ${className}`}
    >
      {estado === 'baixando' && anel}
      {estado === 'pronto' ? (
        <Check className="w-4 h-4 stroke-[3] baixar-visto" />
      ) : (
        <Download className={`w-4 h-4 ${estado === 'baixando' ? 'baixar-desce scale-75' : ''}`} />
      )}
    </button>
  );
}
