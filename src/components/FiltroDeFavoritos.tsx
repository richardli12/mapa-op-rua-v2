import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, Crown, ChevronDown, MapPin, Clock, Eye } from 'lucide-react';
import { CheckIn } from '../types';

/**
 * Só os favoritos, com um clique — e só os Super Favoritos, com outro.
 *
 * A estrela na ficha do check-in marca o que importa — a foto que vai para a
 * reunião, o buraco que virou pauta. Filtrar por ela morava num menu dentro
 * de outro menu, e filtro que ninguém acha é filtro que não existe. Agora ele
 * fica na barra do mapa, ao lado do período, contando quantos há.
 *
 * A coroa é o degrau de cima. Quando a estrela vira comum, os coroados são os
 * poucos que precisam ser achados sem procurar: a metade da direita do botão
 * liga o filtro deles, e a setinha abre a lista — tocar num nome leva o mapa
 * até ele e abre a ficha.
 */
export default function FiltroDeFavoritos({
  ligado,
  quantos,
  onAlternar,
  superLigado = false,
  superFavoritos = [],
  onAlternarSuper,
  onAbrirCheckIn
}: {
  ligado: boolean;
  /** Favoritos dentro do recorte de agora (período e cliente). */
  quantos: number;
  onAlternar: () => void;
  superLigado?: boolean;
  /** Os coroados do recorte de agora, do mais novo ao mais antigo. */
  superFavoritos?: CheckIn[];
  onAlternarSuper?: () => void;
  /** Voa até o check-in e abre a ficha dele. */
  onAbrirCheckIn?: (checkIn: CheckIn) => void;
}) {
  const [estouro, setEstouro] = useState(0);
  const [pouso, setPouso] = useState(0);
  const [listaAberta, setListaAberta] = useState(false);
  const antes = useRef(ligado);
  const superAntes = useRef(superLigado);
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  /**
   * A lista mora num portal, com posição fixa.
   *
   * A barra do mapa rola de lado no celular, e um absoluto dentro dela era
   * cortado pela rolagem — metade da lista ficava fora da tela. Aqui ela se
   * ancora no botão, mas nunca sai da tela: encosta na margem quando falta
   * espaço.
   */
  const [posicao, setPosicao] = useState<{ top: number; left: number; largura: number } | null>(null);
  const quantosSuper = superFavoritos.length;
  const comSuper = !!onAlternarSuper;

  useEffect(() => {
    if (ligado && !antes.current) setEstouro((n) => n + 1);
    antes.current = ligado;
  }, [ligado]);

  useEffect(() => {
    if (superLigado && !superAntes.current) setPouso((n) => n + 1);
    superAntes.current = superLigado;
  }, [superLigado]);

  useLayoutEffect(() => {
    if (!listaAberta) return;
    const medir = () => {
      const caixa = caixaRef.current?.getBoundingClientRect();
      if (!caixa) return;
      const largura = Math.min(320, window.innerWidth - 32);
      const left = Math.max(16, Math.min(caixa.right - largura, window.innerWidth - 16 - largura));
      setPosicao({ top: caixa.bottom + 8, left, largura });
    };
    medir();
    window.addEventListener('resize', medir);
    // A barra rola de lado: a lista acompanha o botão.
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [listaAberta]);

  // Um toque fora (ou o Esc) fecha a lista: ela é um atalho, não uma tela.
  useEffect(() => {
    if (!listaAberta) return;
    const fora = (ev: PointerEvent) => {
      const alvo = ev.target as Node;
      if (caixaRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return;
      setListaAberta(false);
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setListaAberta(false);
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [listaAberta]);

  const quando = (c: CheckIn) => {
    const d = new Date(c.createdAt);
    if (isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString(
      'pt-BR',
      { hour: '2-digit', minute: '2-digit' }
    )}`;
  };

  const capa = (c: CheckIn) =>
    (c.media || []).find((m) => m.type === 'image')?.url || c.photo || null;

  return (
    <div ref={caixaRef} className="relative flex items-stretch h-[42px] font-sans">
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
        className={`relative flex items-center gap-2 pl-3 pr-3.5 shadow-xl border transition-all duration-300 cursor-pointer active:scale-95 ${
          comSuper ? 'rounded-l-2xl border-r-0' : 'rounded-2xl'
        } ${
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

      {comSuper && (
        <div
          className={`relative flex items-stretch rounded-r-2xl shadow-xl border transition-all duration-300 ${
            superLigado
              ? 'super-botao-ligado border-amber-500 text-white'
              : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <button
            type="button"
            onClick={onAlternarSuper}
            aria-pressed={superLigado}
            title={
              superLigado
                ? 'Mostrando só os Super Favoritos. Clique para ver tudo de novo.'
                : quantosSuper > 0
                  ? `Mostrar só os ${quantosSuper} Super Favoritos`
                  : 'Nenhum Super Favorito neste recorte. Coroe pela coroa na ficha do check-in.'
            }
            className={`relative flex items-center gap-1.5 pl-2.5 pr-2 cursor-pointer active:scale-95 transition-colors border-l ${
              superLigado ? 'border-white/30' : 'border-slate-200 hover:bg-amber-50/60'
            }`}
          >
            <span className="relative flex w-5 h-5 items-center justify-center">
              <Crown
                key={pouso}
                className={`w-[18px] h-[18px] ${superLigado && pouso > 0 ? 'super-coroa-pousa' : ''}`}
                fill={superLigado ? '#fff' : quantosSuper > 0 ? '#FCD34D' : 'none'}
                color={superLigado ? '#fff' : quantosSuper > 0 ? '#D97706' : '#94A3B8'}
                strokeWidth={2.25}
              />
              {superLigado && pouso > 0 && <span key={`o-${pouso}`} className="super-onda" aria-hidden="true" />}
            </span>
            <span
              className={`px-1.5 h-[18px] min-w-[18px] rounded-full text-[10px] font-black flex items-center justify-center tabular-nums transition-colors ${
                superLigado
                  ? 'bg-white text-amber-700'
                  : quantosSuper > 0
                    ? 'bg-gradient-to-br from-amber-200 to-amber-300 text-amber-900'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {quantosSuper}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setListaAberta((v) => !v)}
            aria-expanded={listaAberta}
            title="Lista dos Super Favoritos"
            className={`flex items-center pl-1 pr-2 rounded-r-2xl cursor-pointer transition-colors ${
              superLigado ? 'hover:bg-white/15' : 'hover:bg-amber-50/60 text-slate-400'
            }`}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${listaAberta ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {listaAberta && posicao && createPortal(
        <div
          ref={listaRef}
          style={{ top: posicao.top, left: posicao.left, width: posicao.largura }}
          className="fixed z-[3000] rounded-2xl bg-white border border-amber-200 shadow-2xl overflow-hidden super-lista-entra font-sans"
        >
          <div className="super-cabecalho px-4 py-3 text-white flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Crown className="w-4.5 h-4.5" fill="#fff" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black leading-tight">Super Favoritos</p>
              <p className="text-[10.5px] font-semibold text-amber-50/90 leading-tight">
                {quantosSuper === 0
                  ? 'Nenhum coroado neste recorte'
                  : `${quantosSuper} coroado${quantosSuper > 1 ? 's' : ''} · toque para ir até ele`}
              </p>
            </div>
            {quantosSuper > 0 && onAlternarSuper && (
              <button
                type="button"
                onClick={() => {
                  if (!superLigado) onAlternarSuper();
                  setListaAberta(false);
                }}
                title="Deixar só os Super Favoritos no mapa"
                className="h-7 px-2 rounded-lg bg-white/20 hover:bg-white hover:text-amber-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Eye className="w-3 h-3" />
                Só eles
              </button>
            )}
          </div>

          {quantosSuper === 0 ? (
            <div className="px-5 py-6 text-center">
              <span className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-2.5">
                <Crown className="w-6 h-6 text-amber-400" />
              </span>
              <p className="text-[12px] font-semibold text-slate-500 leading-snug">
                Abra a ficha de um check-in e toque na <strong className="text-amber-600">coroa</strong>{' '}
                ao lado da estrela. Ele sobe de degrau e fica aqui, a um toque.
              </p>
            </div>
          ) : (
            <ul className="max-h-[340px] overflow-y-auto p-1.5">
              {superFavoritos.map((c, i) => {
                const foto = capa(c);
                return (
                  <li key={c.id} className="anim-cascata" style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
                    <button
                      type="button"
                      onClick={() => {
                        setListaAberta(false);
                        onAbrirCheckIn?.(c);
                      }}
                      className="group w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-amber-50 transition-colors cursor-pointer"
                    >
                      <span className="relative shrink-0">
                        {foto ? (
                          <img
                            src={foto}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-xl object-cover ring-2 ring-amber-300"
                          />
                        ) : (
                          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 ring-2 ring-amber-300 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-amber-600" />
                          </span>
                        )}
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 border-2 border-white flex items-center justify-center shadow">
                          <Crown className="w-2.5 h-2.5 text-white" fill="#fff" />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold text-slate-800 truncate group-hover:text-amber-800">
                          {c.name || 'Check-in'}
                        </span>
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-400 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{[c.rua, c.bairro].filter(Boolean).join(', ') || 'Sem endereço'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                          <Clock className="w-3 h-3 shrink-0" />
                          {quando(c)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-amber-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                        Ir
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
