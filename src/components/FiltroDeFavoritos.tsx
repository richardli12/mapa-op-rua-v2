import React, { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';

/**
 * Só os favoritos, com um clique.
 *
 * A estrela na ficha do check-in marca o que importa — a foto que vai para a
 * reunião, o buraco que virou pauta. Filtrar por ela morava num menu dentro
 * de outro menu, e filtro que ninguém acha é filtro que não existe. Agora ele
 * fica na barra do mapa, ao lado do período, contando quantos há.
 *
 * Ligar acende a estrela com um estouro de faíscas: o mapa inteiro muda, e o
 * botão precisa dizer que foi ele.
 */
export default function FiltroDeFavoritos({
  ligado,
  quantos,
  onAlternar
}: {
  ligado: boolean;
  /** Favoritos dentro do recorte de agora (período e cliente). */
  quantos: number;
  onAlternar: () => void;
}) {
  const [estouro, setEstouro] = useState(0);
  const antes = useRef(ligado);

  useEffect(() => {
    if (ligado && !antes.current) setEstouro((n) => n + 1);
    antes.current = ligado;
  }, [ligado]);

  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-pressed={ligado}
      title={
        ligado
          ? 'Mostrando só os check-ins favoritos. Clique para ver tudo de novo.'
          : quantos > 0
            ? `Mostrar só os ${quantos} check-ins favoritos`
            : 'Nenhum check-in favoritado neste recorte. Favorite pela estrela na ficha do check-in.'
      }
      className={`relative flex items-center gap-2 h-[42px] pl-3 pr-3.5 rounded-2xl shadow-xl border transition-all duration-300 cursor-pointer active:scale-95 font-sans ${
        ligado
          ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-400 text-white shadow-amber-500/30'
          : 'bg-white border-slate-200/80 text-slate-800 hover:bg-amber-50/60 hover:border-amber-200'
      }`}
    >
      <span className="relative flex w-5 h-5 items-center justify-center">
        <Star
          key={estouro}
          className={`w-[18px] h-[18px] ${ligado ? 'fav-estrela-acende' : ''}`}
          fill={ligado ? '#fff' : quantos > 0 ? '#FCD34D' : 'none'}
          color={ligado ? '#fff' : quantos > 0 ? '#F59E0B' : '#94A3B8'}
          strokeWidth={2.25}
        />
        {estouro > 0 && ligado && (
          <span key={`f-${estouro}`} className="fav-faiscas" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{ '--ang': `${i * 45}deg` } as React.CSSProperties} />
            ))}
          </span>
        )}
      </span>
      <span className="text-xs font-bold leading-none whitespace-nowrap">
        {ligado ? 'Só favoritos' : 'Favoritos'}
      </span>
      <span
        className={`px-1.5 h-[18px] min-w-[18px] rounded-full text-[10px] font-black flex items-center justify-center tabular-nums transition-colors ${
          ligado ? 'bg-white text-orange-600' : quantos > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {quantos}
      </span>
    </button>
  );
}
