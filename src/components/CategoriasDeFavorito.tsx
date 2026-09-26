import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Pencil, Trash2, Tags, X, Search } from 'lucide-react';
import { CategoriaDeFavorito } from '../types';

/**
 * CATEGORIAS DE FAVORITOS — as gavetas da estrela.
 *
 * A estrela diz "isto importa", mas não diz para quê. Aqui o comitê cria as
 * próprias gavetas ("Pauta da reunião", "Imprensa", "Retorno à comunidade"),
 * cada uma com cor e emoji, e guarda cada check-in em quantas precisar. A cor
 * é a mesma em todo lugar — no selo da ficha, no anel do marcador no mapa, no
 * filtro da barra — para a categoria ser reconhecida antes de ser lida.
 */

/** Cores que se leem sobre o mapa claro e sobre o branco da ficha. */
export const CORES_DE_CATEGORIA = [
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#84CC16',
  '#64748B'
];

export const EMOJIS_DE_CATEGORIA = [
  '📌', '📰', '🎤', '📸', '🗳️', '🚧', '🕳️', '💡',
  '🌳', '🏥', '🎓', '🤝', '🔥', '⚠️', '🏆', '❤️'
];

/**
 * O anel do marcador: um gradiente cônico com uma fatia por categoria.
 * Um check-in em três gavetas ganha um anel de três cores — dá para ver de
 * longe em que ele está, sem abrir nada.
 */
export const anelDeCategorias = (cores: string[]) => {
  if (cores.length === 0) return '';
  if (cores.length === 1) return cores[0];
  const fatia = 360 / cores.length;
  const partes = cores.map((cor, i) => `${cor} ${Math.round(i * fatia)}deg ${Math.round((i + 1) * fatia)}deg`);
  return `conic-gradient(${partes.join(', ')})`;
};

/** As categorias de um check-in, na ordem da lista do cliente. */
export const categoriasDoCheckIn = (
  todas: CategoriaDeFavorito[],
  ids: string[] | undefined | null
) => {
  if (!ids || ids.length === 0) return [];
  return todas.filter((c) => ids.includes(c.id));
};

/** Os selos: bolinha de emoji na cor da categoria e o nome ao lado. */
export function SelosDeCategorias({
  categorias,
  compacto = false,
  claro = false
}: {
  categorias: CategoriaDeFavorito[];
  /** Só as bolinhas, sem o nome (linhas de tabela). */
  compacto?: boolean;
  /** Sobre fundo colorido (cabeçalho da ficha): selo branco. */
  claro?: boolean;
}) {
  if (categorias.length === 0) return null;
  if (compacto) {
    return (
      <span className="inline-flex items-center -space-x-1">
        {categorias.map((c, i) => (
          <span
            key={c.id}
            title={c.nome}
            className="cat-selo-entra w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] leading-none shadow-sm"
            style={{ backgroundColor: c.cor, '--i': i } as React.CSSProperties}
          >
            {c.emoji || ''}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {categorias.map((c, i) => (
        <span
          key={c.id}
          className={`cat-selo-entra inline-flex items-center gap-1 h-[20px] pl-1 pr-2 rounded-full text-[10px] font-black whitespace-nowrap ${
            claro ? 'bg-white shadow-sm' : ''
          }`}
          style={
            {
              '--i': i,
              color: claro ? c.cor : c.cor,
              backgroundColor: claro ? '#fff' : `${c.cor}1F`,
              boxShadow: claro ? undefined : `inset 0 0 0 1px ${c.cor}40`
            } as React.CSSProperties
          }
        >
          <span
            className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8.5px] leading-none"
            style={{ backgroundColor: c.cor }}
          >
            {c.emoji || ''}
          </span>
          {c.nome}
        </span>
      ))}
    </span>
  );
}

/** Paleta de cor e de emoji, usada ao criar e ao editar. */
function Paletas({
  cor,
  emoji,
  onCor,
  onEmoji
}: {
  cor: string;
  emoji: string | null;
  onCor: (cor: string) => void;
  onEmoji: (emoji: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CORES_DE_CATEGORIA.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCor(c)}
            aria-label={`Cor ${c}`}
            className={`w-6 h-6 rounded-full cursor-pointer transition-transform duration-200 ${
              cor === c ? 'scale-110 ring-2 ring-offset-2' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: c, '--tw-ring-color': c } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {EMOJIS_DE_CATEGORIA.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onEmoji(emoji === e ? null : e)}
            className={`w-7 h-7 rounded-lg text-[14px] leading-none flex items-center justify-center cursor-pointer transition-all ${
              emoji === e ? 'bg-slate-900/5 ring-2 scale-105' : 'hover:bg-slate-100'
            }`}
            style={{ '--tw-ring-color': cor } as React.CSSProperties}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * O seletor: abre ancorado no botão que o chamou, em portal (a ficha e a
 * tabela cortam o que sai delas), e nunca sai da tela.
 *
 * Um campo só serve para procurar e para criar: digitou um nome que não
 * existe, a linha "Criar" aparece embaixo, já com cor e emoji para escolher.
 */
export function SeletorDeCategorias({
  ancora,
  onFechar,
  categorias,
  selecionadas,
  onAlternar,
  onCriar,
  onEditar,
  onExcluir
}: {
  ancora: HTMLElement | null;
  onFechar: () => void;
  /** As categorias do cliente deste check-in. */
  categorias: CategoriaDeFavorito[];
  selecionadas: string[];
  onAlternar: (id: string) => void;
  /** Cria e devolve a categoria (para já marcá-la no check-in). */
  onCriar: (dados: { nome: string; cor: string; emoji: string | null }) => Promise<CategoriaDeFavorito | null>;
  onEditar: (categoria: CategoriaDeFavorito) => void;
  onExcluir: (categoria: CategoriaDeFavorito) => void;
}) {
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const [posicao, setPosicao] = useState<{ top: number; left: number; largura: number; paraCima: boolean } | null>(null);
  const [termo, setTermo] = useState('');
  const [corNova, setCorNova] = useState(CORES_DE_CATEGORIA[categorias.length % CORES_DE_CATEGORIA.length]);
  const [emojiNovo, setEmojiNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<CategoriaDeFavorito | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [recemCriada, setRecemCriada] = useState<string | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const r = ancora?.getBoundingClientRect();
      if (!r) return;
      const largura = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.right - largura, window.innerWidth - 12 - largura));
      const paraCima = r.bottom + 420 > window.innerHeight && r.top > 420;
      setPosicao({ top: paraCima ? r.top - 8 : r.bottom + 8, left, largura, paraCima });
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [ancora]);

  useEffect(() => {
    const fora = (ev: PointerEvent) => {
      const alvo = ev.target as Node;
      if (caixaRef.current?.contains(alvo) || ancora?.contains(alvo)) return;
      onFechar();
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        onFechar();
      }
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [ancora, onFechar]);

  const busca = termo.trim().toLowerCase();
  const visiveis = useMemo(
    () => categorias.filter((c) => !busca || c.nome.toLowerCase().includes(busca)),
    [categorias, busca]
  );
  const existe = categorias.some((c) => c.nome.trim().toLowerCase() === busca);
  const podeCriar = busca.length > 0 && !existe;

  const criar = async () => {
    if (!podeCriar || criando) return;
    setCriando(true);
    const nova = await onCriar({ nome: termo.trim(), cor: corNova, emoji: emojiNovo });
    setCriando(false);
    if (nova) {
      setRecemCriada(nova.id);
      setTermo('');
      setEmojiNovo(null);
      setCorNova(CORES_DE_CATEGORIA[(categorias.length + 1) % CORES_DE_CATEGORIA.length]);
    }
  };

  if (!posicao) return null;

  return createPortal(
    <div
      ref={caixaRef}
      role="dialog"
      aria-label="Categorias de favoritos"
      style={{
        left: posicao.left,
        width: posicao.largura,
        ...(posicao.paraCima ? { bottom: window.innerHeight - posicao.top } : { top: posicao.top })
      }}
      className={`fixed z-[3100] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden font-sans text-left ${
        posicao.paraCima ? 'cat-painel-sobe' : 'cat-painel-desce'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3.5 pt-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-pink-500 text-white flex items-center justify-center shadow-sm">
            <Tags className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-black text-slate-800 leading-tight">Categorias</p>
            <p className="text-[10.5px] font-semibold text-slate-400 leading-tight">
              Guarde este check-in em quantas precisar
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2.5 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (podeCriar) criar();
                else if (visiveis.length === 1) onAlternar(visiveis[0].id);
              }
            }}
            maxLength={40}
            placeholder={categorias.length ? 'Buscar ou criar categoria…' : 'Nome da primeira categoria…'}
            className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-[12px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-300/60 focus:bg-white"
          />
        </div>
      </div>

      <ul className="max-h-[240px] overflow-y-auto p-1.5">
        {visiveis.map((c, i) => {
          const marcada = selecionadas.includes(c.id);
          if (editando?.id === c.id) {
            return (
              <li key={c.id} className="p-2 rounded-xl bg-slate-50 space-y-2 cat-linha-entra">
                <div className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] shrink-0 shadow-sm"
                    style={{ backgroundColor: editando.cor }}
                  >
                    {editando.emoji || ''}
                  </span>
                  <input
                    autoFocus
                    value={editando.nome}
                    maxLength={40}
                    onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editando.nome.trim()) {
                        onEditar({ ...editando, nome: editando.nome.trim() });
                        setEditando(null);
                      }
                    }}
                    className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-300/60"
                  />
                </div>
                <Paletas
                  cor={editando.cor}
                  emoji={editando.emoji || null}
                  onCor={(cor) => setEditando({ ...editando, cor })}
                  onEmoji={(emoji) => setEditando({ ...editando, emoji })}
                />
                <div className="flex items-center gap-1.5 pt-0.5">
                  {apagando === c.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        onExcluir(c);
                        setApagando(null);
                        setEditando(null);
                      }}
                      className="h-8 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black cursor-pointer cat-treme"
                    >
                      Apagar de vez?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setApagando(c.id)}
                      title="Apagar a categoria (os check-ins continuam com a estrela)"
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(null);
                      setApagando(null);
                    }}
                    className="h-8 px-2.5 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px] font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!editando.nome.trim()}
                    onClick={() => {
                      onEditar({ ...editando, nome: editando.nome.trim() });
                      setEditando(null);
                    }}
                    className="h-8 px-3 rounded-lg text-white text-[11px] font-black cursor-pointer disabled:opacity-40"
                    style={{ backgroundColor: editando.cor }}
                  >
                    Salvar
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li
              key={c.id}
              className={`anim-cascata ${recemCriada === c.id ? 'cat-linha-nova' : ''}`}
              style={{ '--i': Math.min(i, 10) } as React.CSSProperties}
            >
              <div
                role="button"
                tabIndex={0}
                aria-pressed={marcada}
                onClick={() => onAlternar(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAlternar(c.id);
                  }
                }}
                className="group w-full flex items-center gap-2.5 p-1.5 pr-2 rounded-xl cursor-pointer transition-colors hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-300"
                style={marcada ? { backgroundColor: `${c.cor}14` } : undefined}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[15px] shrink-0 shadow-sm transition-transform duration-300 ${
                    marcada ? 'scale-105' : 'group-hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.cor }}
                >
                  {c.emoji || ''}
                </span>
                <span className="flex-1 min-w-0 text-[12.5px] font-bold text-slate-800 truncate">{c.nome}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setApagando(null);
                    setEditando(c);
                  }}
                  title="Editar nome, cor e emoji"
                  className="w-7 h-7 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-white opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <span
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                    marcada ? 'border-transparent' : 'border-slate-200 bg-white'
                  }`}
                  style={marcada ? { backgroundColor: c.cor } : undefined}
                >
                  {marcada && <Check key="v" className="w-3.5 h-3.5 text-white cat-check" strokeWidth={3.5} />}
                </span>
              </div>
            </li>
          );
        })}

        {visiveis.length === 0 && !podeCriar && (
          <li className="px-3 py-5 text-center text-[11.5px] font-semibold text-slate-400">
            Nenhuma categoria ainda. Escreva um nome acima para criar a primeira.
          </li>
        )}
      </ul>

      {podeCriar && (
        <div className="border-t border-slate-100 p-3 space-y-2.5 bg-gradient-to-b from-slate-50/80 to-white cat-linha-entra">
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] shrink-0 shadow-sm transition-colors duration-300"
              style={{ backgroundColor: corNova }}
            >
              {emojiNovo || ''}
            </span>
            <p className="flex-1 min-w-0 text-[12px] font-bold text-slate-700 truncate">
              Nova: <span style={{ color: corNova }}>{termo.trim()}</span>
            </p>
          </div>
          <Paletas cor={corNova} emoji={emojiNovo} onCor={setCorNova} onEmoji={setEmojiNovo} />
          <button
            type="button"
            onClick={criar}
            disabled={criando}
            className="w-full h-9 rounded-xl text-white text-[12px] font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: corNova }}
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            {criando ? 'Criando…' : `Criar e guardar aqui`}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
