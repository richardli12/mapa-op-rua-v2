import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tags, ChevronDown, Check, X } from 'lucide-react';
import { CategoriaDeFavorito } from '../types';

/**
 * O filtro de categorias da barra do mapa.
 *
 * Um toque em cada gaveta que interessa, e o mapa fica só com os check-ins
 * guardados nelas — em QUALQUER uma das escolhidas, porque a pergunta de quem
 * filtra é "o que eu levo para a reunião e para a imprensa", e não "o que é
 * das duas ao mesmo tempo".
 *
 * Ligado, o próprio botão veste as cores das categorias escolhidas: dá para
 * saber o que o mapa está mostrando sem abrir nada.
 */
export default function FiltroDeCategorias({
  categorias,
  contagem,
  selecionadas,
  onMudar
}: {
  /** As categorias do cliente em foco. */
  categorias: CategoriaDeFavorito[];
  /** Quantos check-ins do recorte de agora estão em cada categoria. */
  contagem: Record<string, number>;
  selecionadas: string[];
  onMudar: (ids: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number; largura: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const painelRef = useRef<HTMLDivElement | null>(null);
  const [pulso, setPulso] = useState(0);

  const escolhidas = categorias.filter((c) => selecionadas.includes(c.id));
  const ligado = escolhidas.length > 0;
  const total = escolhidas.reduce((s, c) => s + (contagem[c.id] || 0), 0);

  useLayoutEffect(() => {
    if (!aberto) return;
    const medir = () => {
      const r = botaoRef.current?.getBoundingClientRect();
      if (!r) return;
      const largura = Math.min(340, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.left, window.innerWidth - 16 - largura));
      setPosicao({ top: r.bottom + 8, left, largura });
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: PointerEvent) => {
      const alvo = ev.target as Node;
      if (botaoRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  const alternar = (id: string) => {
    setPulso((n) => n + 1);
    onMudar(selecionadas.includes(id) ? selecionadas.filter((x) => x !== id) : [...selecionadas, id]);
  };

  // O botão ligado veste as cores do que está filtrado.
  const fundo =
    escolhidas.length === 1
      ? escolhidas[0].cor
      : `linear-gradient(120deg, ${escolhidas.map((c) => c.cor).join(', ')})`;

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-pressed={ligado}
        title={
          categorias.length === 0
            ? 'Nenhuma categoria ainda. Crie pela etiqueta na ficha de um check-in.'
            : ligado
              ? `Filtrando por ${escolhidas.map((c) => c.nome).join(', ')}`
              : 'Filtrar os check-ins por categoria de favoritos'
        }
        className={`relative flex items-center gap-2 h-[42px] pl-3 pr-2.5 rounded-2xl shadow-xl border transition-all duration-300 cursor-pointer active:scale-95 font-sans ${
          ligado
            ? 'cat-botao-ligado border-transparent text-white'
            : 'bg-white border-slate-200/80 text-slate-800 hover:bg-slate-50'
        }`}
        style={ligado ? ({ backgroundImage: escolhidas.length > 1 ? fundo : undefined, backgroundColor: escolhidas.length === 1 ? fundo : undefined } as React.CSSProperties) : undefined}
      >
        <Tags key={pulso} className={`w-[18px] h-[18px] ${ligado ? 'cat-etiqueta-balanca' : categorias.length ? 'text-pink-500' : 'text-slate-400'}`} />
        <span className="text-xs font-bold leading-none whitespace-nowrap">
          {ligado ? (escolhidas.length === 1 ? escolhidas[0].nome : `${escolhidas.length} categorias`) : 'Categorias'}
        </span>
        {ligado ? (
          <span className="px-1.5 h-[18px] min-w-[18px] rounded-full bg-white text-slate-800 text-[10px] font-black flex items-center justify-center tabular-nums">
            {total}
          </span>
        ) : (
          categorias.length > 0 && (
            <span className="flex -space-x-1">
              {categorias.slice(0, 4).map((c) => (
                <span key={c.id} className="w-2.5 h-2.5 rounded-full border border-white" style={{ backgroundColor: c.cor }} />
              ))}
            </span>
          )
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${aberto ? 'rotate-180' : ''} ${ligado ? 'text-white/80' : 'text-slate-400'}`} />
      </button>

      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={painelRef}
            style={{ top: posicao.top, left: posicao.left, width: posicao.largura }}
            className="fixed z-[3000] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden font-sans cat-painel-desce"
          >
            <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-violet-500 text-white flex items-center justify-center shadow-md shrink-0">
                <Tags className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-slate-800 leading-tight">Filtrar por categoria</p>
                <p className="text-[10.5px] font-semibold text-slate-400 leading-snug">
                  O mapa mostra quem está em qualquer uma das escolhidas
                </p>
              </div>
              {ligado && (
                <button
                  type="button"
                  onClick={() => onMudar([])}
                  className="h-7 px-2 rounded-lg text-[10.5px] font-black text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>

            {categorias.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <span className="mx-auto w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mb-2.5">
                  <Tags className="w-6 h-6 text-pink-400" />
                </span>
                <p className="text-[12px] font-semibold text-slate-500 leading-snug">
                  Abra a ficha de um check-in e toque na <strong className="text-pink-600">etiqueta</strong>{' '}
                  ao lado da estrela para criar a primeira categoria.
                </p>
              </div>
            ) : (
              <div className="p-3 flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto">
                {categorias.map((c, i) => {
                  const marcada = selecionadas.includes(c.id);
                  const n = contagem[c.id] || 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => alternar(c.id)}
                      aria-pressed={marcada}
                      className={`anim-cascata group inline-flex items-center gap-1.5 h-9 pl-1 pr-2.5 rounded-full text-[12px] font-bold cursor-pointer transition-all duration-300 active:scale-95 ${
                        marcada ? 'text-white shadow-md' : 'text-slate-700 hover:shadow-sm'
                      } ${n === 0 && !marcada ? 'opacity-55' : ''}`}
                      style={
                        {
                          '--i': Math.min(i, 12),
                          backgroundColor: marcada ? c.cor : `${c.cor}14`,
                          boxShadow: marcada ? `0 6px 16px -6px ${c.cor}` : `inset 0 0 0 1.5px ${c.cor}40`
                        } as React.CSSProperties
                      }
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] leading-none transition-transform duration-300 ${
                          marcada ? 'bg-white/25 scale-105' : 'group-hover:scale-110'
                        }`}
                        style={marcada ? undefined : { backgroundColor: c.cor }}
                      >
                        {marcada ? <Check className="w-4 h-4 text-white cat-check" strokeWidth={3.5} /> : c.emoji || ''}
                      </span>
                      <span className="max-w-[150px] truncate">{c.nome}</span>
                      <span
                        className={`px-1.5 h-[18px] min-w-[18px] rounded-full text-[10px] font-black flex items-center justify-center tabular-nums ${
                          marcada ? 'bg-white/25 text-white' : 'bg-white text-slate-500'
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
