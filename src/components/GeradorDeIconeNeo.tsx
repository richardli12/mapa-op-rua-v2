import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, History, Library, RefreshCw, X } from 'lucide-react';
import { buildOperationIconSvg, getOperationIconDef } from '../operationIcons';
import { codificarIconeNeo } from '../iconeSvg';
import {
  SugestaoDaBiblioteca,
  VarianteNeo,
  pedirIconesAoNeo,
  svgDaVariante
} from '../services/iconeNeo';

type Escolha = { tipo: 'neo'; variante: VarianteNeo } | { tipo: 'biblioteca'; key: string } | null;

interface Estudio {
  entendimento: string;
  sugestoes: SugestaoDaBiblioteca[];
  rodadas: VarianteNeo[][];
}

/**
 * O que já foi desenhado para cada nome, enquanto a página está aberta.
 *
 * Fechar o estúdio sem querer não pode custar as rodadas que já saíram: quem
 * reabre para "Buracos" encontra os desenhos onde deixou.
 */
const memoria = new Map<string, Estudio>();

const FRASES_DE_ESPERA = [
  'Entendendo o que é',
  'Procurando na biblioteca',
  'Esboçando três ideias',
  'Acertando o traço',
  'Conferindo a 16 pixels'
];

/**
 * Gerar ícone com NEO.
 *
 * Um estúdio pequeno: o NEO lê o nome do tipo, diz o que entendeu, aponta o
 * que a biblioteca já tem de parecido e desenha três ideias novas — que se
 * desenham na tela, traço a traço. Escolhida uma, a coluna da direita mostra
 * como ela fica de verdade: dentro do marcador do mapa, na cor do tipo, e no
 * tamanho da lista.
 *
 * Não gostou? Escreve o porquê ("mais simples", "com um cone") e pede outras;
 * as rodadas anteriores ficam guardadas embaixo, para voltar a uma delas se
 * a nova ficar pior. Nada vai para o tipo sem "Confirmar ícone".
 */
export default function GeradorDeIconeNeo({
  nome,
  descricao,
  cor,
  iconeAtual,
  onConfirmar,
  onFechar
}: {
  nome: string;
  descricao?: string;
  cor: string;
  iconeAtual?: string;
  /** Chave da biblioteca, ou o ícone do NEO já codificado para o campo `icon`. */
  onConfirmar: (icone: string) => void;
  onFechar: () => void;
}) {
  const chaveDaMemoria = `${nome.trim().toLowerCase()}|${(descricao || '').trim().toLowerCase()}`;
  const [estudio, setEstudio] = useState<Estudio>(
    () => memoria.get(chaveDaMemoria) || { entendimento: '', sugestoes: [], rodadas: [] }
  );
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [observacao, setObservacao] = useState('');
  const [escolha, setEscolha] = useState<Escolha>(null);
  const [frase, setFrase] = useState(0);
  const iniciou = useRef(false);

  useEffect(() => {
    memoria.set(chaveDaMemoria, estudio);
  }, [chaveDaMemoria, estudio]);

  const rodadaAtual = estudio.rodadas[estudio.rodadas.length - 1] || [];
  const anteriores = estudio.rodadas.slice(0, -1).flat().reverse();

  const gerar = useCallback(async () => {
    if (gerando) return;
    setGerando(true);
    setErro('');
    const jaMostradas = estudio.rodadas.flat().map((v) => v.nome);
    const r = await pedirIconesAoNeo({
      nome,
      descricao,
      observacao: observacao.trim(),
      jaMostradas,
      rodada: estudio.rodadas.length + 1
    });
    setGerando(false);
    if ('mensagem' in r) {
      setErro(r.mensagem);
      return;
    }
    setEstudio((e) => ({
      entendimento: r.entendimento || e.entendimento,
      sugestoes: r.sugestoes.length ? r.sugestoes : e.sugestoes,
      rodadas: r.variantes.length ? [...e.rodadas, r.variantes] : e.rodadas
    }));
    if (r.variantes[0]) setEscolha({ tipo: 'neo', variante: r.variantes[0] });
    setObservacao('');
  }, [gerando, estudio.rodadas, nome, descricao, observacao]);

  // A primeira rodada sai sozinha: abrir o estúdio já é o pedido.
  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    if (estudio.rodadas.length === 0) gerar();
    else if (rodadaAtual[0]) setEscolha({ tipo: 'neo', variante: rodadaAtual[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gerando) return;
    setFrase(0);
    const t = window.setInterval(() => setFrase((f) => (f + 1) % FRASES_DE_ESPERA.length), 1600);
    return () => window.clearInterval(t);
  }, [gerando]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);

  const confirmar = () => {
    if (!escolha) return;
    onConfirmar(escolha.tipo === 'neo' ? codificarIconeNeo(escolha.variante) : escolha.key);
  };

  /** O SVG da escolha, no tamanho pedido — para a prévia do mapa e da lista. */
  const svgEscolhido = useMemo(
    () => (tamanho: number) =>
      escolha?.tipo === 'neo'
        ? svgDaVariante(escolha.variante, tamanho)
        : escolha?.tipo === 'biblioteca'
          ? buildOperationIconSvg(escolha.key, tamanho)
          : '',
    [escolha]
  );

  const nomeDaEscolha =
    escolha?.tipo === 'neo'
      ? escolha.variante.nome
      : escolha?.tipo === 'biblioteca'
        ? getOperationIconDef(escolha.key).label
        : '';

  const primeiraVez = estudio.rodadas.length === 0 && estudio.sugestoes.length === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[6000] bg-[#020617]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-sans animate-in fade-in duration-200"
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="neo-estudio relative w-full max-w-4xl max-h-[94vh] overflow-hidden rounded-[28px] bg-[#0B1220] text-white border border-white/10 shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-300"
      >
        <div className="neo-aurora" aria-hidden="true" />

        {/* ----------------------------------------------------- topo ---- */}
        <div className="relative px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="neo-selo w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-[11px] font-black tracking-[0.08em] text-white">NEO</span>
            </span>
            <div className="min-w-0">
              <h3 className="text-[18px] font-black tracking-tight leading-tight">Gerar ícone com NEO</h3>
              <p className="text-[12px] font-semibold text-slate-400 truncate">
                para <span className="text-white">“{nome}”</span>
                {estudio.entendimento && (
                  <>
                    {' '}· <span key={estudio.entendimento} className="neo-escreve">{estudio.entendimento}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ---------------------------------------------------- corpo ---- */}
        <div className="relative flex-1 min-h-0 overflow-y-auto grid md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="p-6 space-y-6 min-w-0">
            {/* Criados pelo NEO */}
            <section>
              <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
                Criados pelo NEO
                {estudio.rodadas.length > 1 && (
                  <span className="text-slate-500 normal-case tracking-normal font-bold">
                    · rodada {estudio.rodadas.length}
                  </span>
                )}
              </p>

              <div className="relative grid grid-cols-3 gap-3">
                {(gerando && rodadaAtual.length === 0 ? [0, 1, 2] : rodadaAtual).map((v: any, i: number) =>
                  typeof v === 'number' ? (
                    <div key={`esboco-${i}`} className="neo-cartao neo-esbocando aspect-[4/5] rounded-2xl" style={{ animationDelay: `${i * 0.25}s` }}>
                      <span className="neo-grade" />
                      <span className="neo-lapis" style={{ animationDelay: `${i * 0.4}s` }} />
                    </div>
                  ) : (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setEscolha({ tipo: 'neo', variante: v })}
                      className={`neo-cartao relative group aspect-[4/5] rounded-2xl flex flex-col items-center justify-center gap-3 p-3 cursor-pointer transition-all anim-cascata ${
                        escolha?.tipo === 'neo' && escolha.variante.id === v.id ? 'neo-escolhido' : ''
                      } ${gerando ? 'opacity-40 pointer-events-none' : ''}`}
                      style={{ '--i': i } as React.CSSProperties}
                    >
                      <span
                        className="w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] flex items-center justify-center text-white"
                        dangerouslySetInnerHTML={{ __html: svgDaVariante(v, 64, true) }}
                      />
                      <span className="text-[11.5px] font-bold text-slate-300 text-center leading-tight line-clamp-2">{v.nome}</span>
                      {escolha?.tipo === 'neo' && escolha.variante.id === v.id && (
                        <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center baixar-visto">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  )
                )}
                {gerando && rodadaAtual.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="px-4 py-2 rounded-full bg-[#0B1220]/90 border border-violet-400/30 text-[12px] font-bold flex items-center gap-2">
                      <span className="lg-mini-radar !w-4 !h-4" />
                      Redesenhando{observacao.trim() ? ' com a sua observação' : ''}…
                    </span>
                  </div>
                )}
              </div>

              {gerando && (
                <p key={frase} className="mt-3 text-[12px] font-bold text-violet-200/80 lg-registro flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  {FRASES_DE_ESPERA[frase]}{frase === 0 ? ` “${nome}”` : ''}…
                </p>
              )}

              {erro && !gerando && (
                <div className="mt-3 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-300" />
                  <p className="text-[12.5px] font-semibold text-rose-100 leading-snug flex-1">{erro}</p>
                  <button type="button" onClick={gerar} className="text-[11px] font-black text-rose-200 hover:text-white cursor-pointer shrink-0">
                    Tentar de novo
                  </button>
                </div>
              )}
            </section>

            {/* Da biblioteca */}
            {estudio.sugestoes.length > 0 && (
              <section>
                <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Library className="w-3.5 h-3.5" />
                  Já existe na biblioteca
                </p>
                <div className="flex flex-wrap gap-2">
                  {estudio.sugestoes.map((s, i) => {
                    const ativo = escolha?.tipo === 'biblioteca' && escolha.key === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        title={s.motivo}
                        onClick={() => setEscolha({ tipo: 'biblioteca', key: s.key })}
                        style={{ '--i': i } as React.CSSProperties}
                        className={`anim-cascata h-11 pl-2 pr-3.5 rounded-xl border flex items-center gap-2.5 text-left cursor-pointer transition-colors ${
                          ativo ? 'border-violet-400 bg-violet-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ background: cor }}
                          dangerouslySetInnerHTML={{ __html: buildOperationIconSvg(s.key, 15) }}
                        />
                        <span className="min-w-0">
                          <span className="block text-[12px] font-bold leading-tight">{getOperationIconDef(s.key).label}</span>
                          {s.motivo && (
                            <span className="block text-[10.5px] text-slate-500 leading-tight truncate max-w-[210px]">{s.motivo}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Rodadas anteriores */}
            {anteriores.length > 0 && (
              <section>
                <p className="mb-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <History className="w-3.5 h-3.5" />
                  Rodadas anteriores
                </p>
                <div className="flex flex-wrap gap-2">
                  {anteriores.map((v) => {
                    const ativo = escolha?.tipo === 'neo' && escolha.variante.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        title={`${v.nome} (rodada ${v.rodada})`}
                        onClick={() => setEscolha({ tipo: 'neo', variante: v })}
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center text-slate-300 cursor-pointer transition-colors ${
                          ativo ? 'border-violet-400 bg-violet-500/15 text-white' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                        }`}
                        dangerouslySetInnerHTML={{ __html: svgDaVariante(v, 20) }}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ---------------------------------------- como fica ---- */}
          <aside className="border-t md:border-t-0 md:border-l border-white/[0.07] bg-black/20 p-6 flex flex-col gap-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Como fica</p>
            {escolha ? (
              <>
                <div className="neo-mapinha relative h-36 rounded-2xl overflow-hidden flex items-center justify-center">
                  <span className="neo-pulso" style={{ borderColor: cor }} />
                  <span
                    key={`${nomeDaEscolha}-${cor}`}
                    className="relative w-12 h-12 rounded-full border-[3px] border-white flex items-center justify-center text-white shadow-xl neo-marcador"
                    style={{ background: cor, boxShadow: `0 6px 18px ${cor}88` }}
                    dangerouslySetInnerHTML={{ __html: svgEscolhido(22) }}
                  />
                </div>
                <div className="rounded-xl bg-white p-2.5 flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ background: cor }}
                    dangerouslySetInnerHTML={{ __html: svgEscolhido(16) }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-black text-slate-800 truncate">{nome}</span>
                    <span className="block text-[10.5px] font-semibold text-slate-400 truncate">na lista de tipos</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white"
                    dangerouslySetInnerHTML={{ __html: svgEscolhido(30) }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black leading-tight">{nomeDaEscolha}</span>
                    <span className="block text-[11px] font-semibold text-slate-500">
                      {escolha.tipo === 'neo' ? 'Desenhado pelo NEO' : 'Da biblioteca'}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-[140px] rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-center px-4">
                <p className="text-[12px] font-semibold text-slate-500">
                  {primeiraVez && gerando ? 'O NEO está desenhando…' : 'Escolha um ícone para ver aqui.'}
                </p>
              </div>
            )}
          </aside>
        </div>

        {/* ---------------------------------------------------- rodapé ---- */}
        <div className="relative px-6 py-4 border-t border-white/[0.07] bg-[#0B1220] flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2 h-11 px-3.5 rounded-xl bg-white/[0.04] border border-white/10 focus-within:border-violet-400/60 focus-within:bg-violet-500/[0.06] transition-colors">
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  gerar();
                }
              }}
              maxLength={300}
              disabled={gerando}
              placeholder="Não gostou? Diga o porquê: “mais simples”, “com um cone de trânsito”…"
              className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
            className="h-11 px-4 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-50 text-[12px] font-black flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${gerando ? 'animate-spin' : ''}`} />
            {estudio.rodadas.length ? 'Gerar outros' : 'Gerar'}
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!escolha || gerando}
            className="neo-confirmar h-11 px-5 rounded-xl text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Confirmar ícone
          </button>
        </div>
        {iconeAtual && <span className="sr-only">Ícone atual: {getOperationIconDef(iconeAtual).label}</span>}
      </div>
    </div>,
    document.body
  );
}
