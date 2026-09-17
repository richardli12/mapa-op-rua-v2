interface ItemDaBarra {
  rotulo: string;
  valor?: number | null;
  /** Linha pequena embaixo, para o que o número sozinho não explica. */
  detalhe?: string;
}

interface BarrasDaEscolaProps {
  titulo: string;
  /** Aviso curto, quando os números do bloco precisam de contexto. */
  nota?: string;
  total: number;
  itens: ItemDaBarra[];
}

/**
 * Bloco de números da ficha da escola, com a barra proporcional ao total.
 *
 * Itens zerados ficam de fora: numa escola só de educação infantil, listar
 * "Ensino Médio 0" é ruído que empurra o que importa para baixo.
 */
export default function BarrasDaEscola({
  titulo,
  nota,
  total,
  itens
}: BarrasDaEscolaProps) {
  const visiveis = itens.filter(i => (i.valor || 0) > 0);
  if (visiveis.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
        {titulo}
      </p>
      {nota && (
        <p className="text-[10.5px] font-semibold text-slate-400 mb-2 leading-snug">
          {nota}
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {visiveis.map(item => {
          const valor = item.valor || 0;
          const parte = total > 0 ? (valor / total) * 100 : 0;
          return (
            <div key={item.rotulo}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-bold text-slate-700 truncate">
                  {item.rotulo}
                </span>
                <span className="text-[12px] font-black text-[#0D233A] shrink-0">
                  {valor.toLocaleString('pt-BR')}
                  <span className="text-[10.5px] font-bold text-slate-400 ml-1.5">
                    {parte.toFixed(0)}%
                  </span>
                </span>
              </div>
              <span className="mt-1 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-[#015FC9]"
                  style={{ width: `${Math.min(100, parte)}%` }}
                />
              </span>
              {item.detalhe && (
                <p className="text-[10.5px] font-semibold text-slate-400 mt-0.5">
                  {item.detalhe}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
