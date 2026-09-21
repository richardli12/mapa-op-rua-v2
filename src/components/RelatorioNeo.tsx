import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileWarning,
  Gavel,
  Loader2,
  Megaphone,
  MapPin,
  ScanSearch,
  Scale,
  ShieldAlert,
  Target,
  X
} from 'lucide-react';
import type { ForcaDaEvidencia, RelatorioDoNeo } from '../neo';
import type { CoberturaDoNeo, PecaDoDossie } from '../services/neo';

/**
 * O relatório do NEO: um documento de decisão, na tela e no papel.
 *
 * Quem lê é alguém que decide — se manda equipe, se responde em público e o
 * que diz. Três coisas seguem dessa premissa e explicam o desenho inteiro:
 *
 * 1. A PROVA MORA AO LADO DA AFIRMAÇÃO. O NEO cita cada peça pelo rótulo, e a
 *    página troca o rótulo pela imagem. Um relatório que afirma "sete buracos"
 *    e manda procurar a foto noutra tela é um relatório que será lido pela
 *    metade — e a metade que fica de fora é justamente a que sustenta.
 * 2. O VEREDITO VEM PRIMEIRO. Manchete, números e as imagens de destaque estão
 *    antes de qualquer seção numerada. Quem tiver quinze segundos lê só isso e
 *    já decide; quem tiver quinze minutos desce e confere.
 * 3. O QUE NÃO SE PODE DIZER TAMBÉM É RESPOSTA. A seção de comunicação existe
 *    porque a pergunta seguinte de quem lê é sempre "e o que eu falo?" — e sem
 *    ela essa decisão é tomada com pressa, diante de um microfone.
 *
 * O PDF sai pela impressão do próprio navegador, e não por uma biblioteca que
 * fotografa a tela: no arquivo o texto continua texto, dá para buscar e
 * copiar, e a quebra de página respeita as seções.
 */

const SEVERIDADE = {
  alta: { texto: 'Severidade alta', classe: 'bg-rose-500 text-white' },
  media: { texto: 'Severidade média', classe: 'bg-amber-400 text-amber-950' },
  baixa: { texto: 'Severidade baixa', classe: 'bg-emerald-500 text-white' }
};

const URGENCIA = {
  alta: { texto: 'Urgência alta', classe: 'bg-white/15 text-white border border-white/25' },
  media: { texto: 'Urgência média', classe: 'bg-white/10 text-white/90 border border-white/20' },
  baixa: { texto: 'Urgência baixa', classe: 'bg-white/10 text-white/70 border border-white/15' }
};

const CONFIANCA = {
  alta: { texto: 'Confiança alta na análise', classe: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' },
  media: { texto: 'Confiança média na análise', classe: 'bg-white/10 text-white/80 border border-white/20' },
  baixa: { texto: 'Confiança baixa na análise', classe: 'bg-amber-400/20 text-amber-200 border border-amber-300/30' }
};

const PESO = { alto: 'bg-rose-500', medio: 'bg-amber-500', baixo: 'bg-slate-300' };

const IMPACTO = {
  alto: { texto: 'Impacto alto', classe: 'bg-rose-100 text-rose-800' },
  medio: { texto: 'Impacto médio', classe: 'bg-amber-100 text-amber-800' },
  baixo: { texto: 'Impacto baixo', classe: 'bg-slate-200 text-slate-700' }
};

const PRAZO = {
  imediato: { texto: 'Imediato', classe: 'bg-rose-600 text-white' },
  curto: { texto: 'Curto prazo', classe: 'bg-amber-500 text-white' },
  medio: { texto: 'Médio prazo', classe: 'bg-slate-500 text-white' }
};

const FORCA: Record<ForcaDaEvidencia, { texto: string; classe: string }> = {
  prova: { texto: 'Prova', classe: 'bg-emerald-600 text-white' },
  indicio: { texto: 'Indício', classe: 'bg-amber-500 text-white' },
  contexto: { texto: 'Contexto', classe: 'bg-slate-400 text-white' }
};

/** Título de seção: o mesmo desenho em todas, para o olho pular de uma à outra. */
function Secao({
  numero,
  titulo,
  Icone,
  children
}: {
  numero: string;
  titulo: string;
  Icone: any;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5 border-b-2 border-slate-900 pb-2">
        <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
          <Icone className="w-3.5 h-3.5" />
        </span>
        <h3 className="font-black text-slate-900 text-[13px] uppercase tracking-wider">
          {titulo}
        </h3>
        <span className="ml-auto text-[11px] font-black text-slate-300 tabular-nums">
          {numero}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function RelatorioNeo({
  aberto,
  carregando,
  erro,
  relatorio,
  cobertura,
  pecas,
  missaoTitulo,
  onFechar,
  onTentarDeNovo
}: {
  aberto: boolean;
  carregando: boolean;
  erro: string | null;
  relatorio: RelatorioDoNeo | null;
  cobertura: CoberturaDoNeo | null;
  /** As peças do dossiê: é por elas que o rótulo citado vira imagem. */
  pecas: PecaDoDossie[];
  missaoTitulo: string;
  onFechar: () => void;
  onTentarDeNovo: () => void;
}) {
  if (!aberto) return null;

  /** Rótulo → endereço da imagem. O que transforma citação em prova na página. */
  const imagemDe = (referencia: string) =>
    pecas.find(p => p.referencia === referencia && p.tipo === 'imagem')?.url || null;

  /**
   * A prova, do tamanho do papel que ela faz.
   *
   * `grande` é a peça que o leitor precisa ver antes de ler qualquer coisa;
   * as outras entram como miniatura ao lado do texto que as cita. Peça que
   * não é imagem (um áudio transcrito, um documento) não vira caixa vazia:
   * some, e o texto que a cita continua de pé sozinho.
   */
  const Prova = ({
    referencia,
    legenda,
    grande
  }: {
    referencia: string;
    legenda?: string;
    grande?: boolean;
    key?: string;
  }) => {
    const url = imagemDe(referencia);
    if (!url) return null;
    return (
      <figure className={grande ? 'quebra-evitar' : 'quebra-evitar w-[92px] shrink-0'}>
        <img
          src={url}
          alt={referencia}
          referrerPolicy="no-referrer"
          className={`w-full object-cover rounded-lg border border-slate-200 bg-slate-100 ${
            grande ? 'max-h-[320px]' : 'h-[92px]'
          }`}
        />
        <figcaption
          className={`text-slate-400 font-bold leading-snug mt-1 ${
            grande ? 'text-[10.5px]' : 'text-[8.5px]'
          }`}
        >
          {legenda || referencia}
        </figcaption>
      </figure>
    );
  };

  /** Tira de miniaturas das peças que sustentam um item. */
  const Provas = ({ refs }: { refs: string[] }) => {
    const comImagem = refs.filter(r => imagemDe(r));
    if (comImagem.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {comImagem.map(r => (
          <Prova key={r} referencia={r} />
        ))}
      </div>
    );
  };

  /**
   * Imprimir marca o body e devolve ao normal quando a janela fecha.
   *
   * A classe é o que faz o resto da página sumir no papel. Tirá-la no
   * afterprint, e não num tempo fixo, evita a tela ficar estranha se a pessoa
   * demorar para escolher o destino da impressão.
   */
  const baixarPdf = () => {
    const limpar = () => {
      document.body.classList.remove('imprimindo-neo');
      window.removeEventListener('afterprint', limpar);
    };
    window.addEventListener('afterprint', limpar);
    document.body.classList.add('imprimindo-neo');
    window.print();
  };

  const destaques = (relatorio?.evidencias || []).filter(e => e.destaque && imagemDe(e.referencia));
  const galeria = (relatorio?.evidencias || []).filter(e => !e.destaque || !imagemDe(e.referencia));

  const conteudo = (
    <div className="relatorio-neo-raiz fixed inset-0 z-[5000] bg-slate-900/70 backdrop-blur-xs overflow-y-auto p-4 md:p-8 font-sans">
      <div className="relatorio-neo-folha bg-white rounded-3xl shadow-2xl max-w-3xl mx-auto overflow-hidden">
        {/* Barra da janela: some no papel, onde ela não é conteúdo. */}
        <div className="nao-imprimir sticky top-0 z-10 bg-slate-950 text-white px-6 py-3.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <Brain className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="min-w-0">
              <span className="block font-black text-[13px] leading-none tracking-wide">NEO</span>
              <span className="block text-[10px] text-slate-400 font-semibold truncate">
                Relatório de inteligência de campo
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {relatorio && (
              <button
                type="button"
                onClick={baixarPdf}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar PDF
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
        </div>

        {carregando && (
          <div className="px-6 py-20 flex flex-col items-center text-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <div>
              <p className="font-black text-slate-800 text-sm">O NEO está lendo a missão</p>
              <p className="text-[11.5px] text-slate-500 font-semibold mt-1 max-w-sm leading-snug">
                Entendendo a ordem e a prioridade, abrindo cada imagem do material
                de apoio e do feedback, transcrevendo os áudios e cruzando o que
                foi alegado com o que a equipe encontrou. Leva até um minuto.
              </p>
            </div>
          </div>
        )}

        {erro && !carregando && (
          <div className="px-6 py-16 flex flex-col items-center text-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
              <FileWarning className="w-6 h-6" />
            </span>
            <div>
              <p className="font-black text-slate-800 text-sm">O relatório não saiu</p>
              <p className="text-[11.5px] text-slate-500 font-semibold mt-1 max-w-sm leading-snug">
                {erro}
              </p>
            </div>
            <button
              type="button"
              onClick={onTentarDeNovo}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {relatorio && !carregando && (
          <article className="text-slate-800">
            {/* =================================================== CAPA === */}
            <header className="quebra-evitar bg-slate-950 text-white px-6 md:px-10 py-8 space-y-5">
              <div className="flex items-center gap-2 text-[9.5px] font-black uppercase tracking-[0.25em] text-emerald-400">
                <Brain className="w-3.5 h-3.5" />
                Relatório de inteligência · NEO
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl md:text-[30px] font-black leading-[1.15]">
                  {relatorio.titulo}
                </h1>
                {relatorio.subtitulo && (
                  <p className="text-[12.5px] font-semibold text-slate-400 leading-snug">
                    {relatorio.subtitulo}
                  </p>
                )}
              </div>

              {/* A manchete: o veredito antes de qualquer seção. */}
              {relatorio.manchete && (
                <p className="text-[16px] md:text-[18px] font-bold leading-snug border-l-4 border-emerald-500 pl-4">
                  {relatorio.manchete}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {relatorio.naturezaDaMissao && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-slate-900">
                    {relatorio.naturezaDaMissao}
                  </span>
                )}
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    SEVERIDADE[relatorio.severidade]?.classe || SEVERIDADE.media.classe
                  }`}
                >
                  {SEVERIDADE[relatorio.severidade]?.texto}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    URGENCIA[relatorio.urgencia]?.classe || URGENCIA.media.classe
                  }`}
                >
                  {URGENCIA[relatorio.urgencia]?.texto}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    CONFIANCA[relatorio.confianca]?.classe || CONFIANCA.media.classe
                  }`}
                >
                  {CONFIANCA[relatorio.confianca]?.texto}
                </span>
              </div>

              <p className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1.5 pt-1 border-t border-white/10">
                <MapPin className="w-3 h-3" />
                Missão: {missaoTitulo}
              </p>
            </header>

            <div className="px-6 md:px-10 py-8 space-y-8">
              {/* ------------------------------------------ indicadores --- */}
              {relatorio.indicadores.length > 0 && (
                <div className="quebra-evitar grid grid-cols-2 md:grid-cols-4 gap-2">
                  {relatorio.indicadores.map((n, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                    >
                      <p className="text-[21px] font-black text-slate-900 leading-none tabular-nums">
                        {n.valor}
                      </p>
                      <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 mt-1.5 leading-tight">
                        {n.rotulo}
                      </p>
                      {n.nota && (
                        <p className="text-[9.5px] font-semibold text-slate-400 leading-snug mt-0.5">
                          {n.nota}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* -------------------------------- as provas de destaque --- */}
              {destaques.length > 0 && (
                <div className="quebra-evitar space-y-3">
                  <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400">
                    O que você precisa ver
                  </p>
                  <div
                    className={`grid gap-3 ${destaques.length > 1 ? 'md:grid-cols-2' : ''}`}
                  >
                    {destaques.map(e => (
                      <div key={e.referencia} className="quebra-evitar space-y-2">
                        <Prova referencia={e.referencia} legenda={e.referencia} grande />
                        <p className="text-[11.5px] font-bold text-slate-700 leading-snug">
                          {e.oQueMostra}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --------------------------------- resumo e pergunta --- */}
              <div className="quebra-evitar bg-slate-100 border-l-4 border-slate-900 rounded-r-2xl p-5 space-y-3">
                <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Resumo executivo
                </p>
                <p className="text-[14px] leading-relaxed font-semibold text-slate-800">
                  {relatorio.resumoExecutivo}
                </p>
                {relatorio.perguntaReal && (
                  <p className="text-[11.5px] leading-snug text-slate-600 border-t border-slate-300 pt-3">
                    <span className="font-black text-slate-900">
                      A pergunta por trás da missão:{' '}
                    </span>
                    {relatorio.perguntaReal}
                  </p>
                )}
              </div>

              {/* ------------------------------- por que e o que voltou --- */}
              <Secao numero="01" titulo="Por que esta missão existiu" Icone={Target}>
                <div className="space-y-3">
                  {relatorio.porQueFoiPedido && (
                    <p className="text-[12.5px] leading-relaxed font-semibold text-slate-700">
                      {relatorio.porQueFoiPedido}
                    </p>
                  )}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        A ordem
                      </p>
                      <p className="text-[12px] leading-relaxed font-semibold text-slate-700">
                        {relatorio.oQueFoiPedido || '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 mb-1.5">
                        O que voltou da rua
                      </p>
                      <p className="text-[12px] leading-relaxed font-semibold text-slate-700">
                        {relatorio.oQueFoiEncontrado || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </Secao>

              {/* ---------------------------------------- contradições --- */}
              {relatorio.contradicoes.length > 0 && (
                <Secao numero="02" titulo="Alegação x evidência" Icone={Scale}>
                  <div className="space-y-2.5">
                    {relatorio.contradicoes.map((c, i) => (
                      <div
                        key={i}
                        className="quebra-evitar rounded-xl border-2 border-amber-300 overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-amber-50">
                          <p className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 mb-1">
                            O que se alega
                          </p>
                          <p className="text-[11.5px] font-semibold text-slate-700 leading-relaxed">
                            {c.alegacao}
                          </p>
                        </div>
                        <div className="px-4 py-3 bg-white border-t-2 border-amber-300">
                          <p className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />O que as evidências mostram
                          </p>
                          <p className="text-[11.5px] font-bold text-slate-800 leading-relaxed">
                            {c.oQueAsEvidenciasMostram}
                          </p>
                          <Provas refs={c.evidencias} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Secao>
              )}

              {/* --------------------------------------------- achados --- */}
              {relatorio.achados.length > 0 && (
                <Secao numero="03" titulo="Achados" Icone={ScanSearch}>
                  <div className="space-y-2">
                    {relatorio.achados.map((a, i) => (
                      <div
                        key={i}
                        className="quebra-evitar flex gap-3 rounded-xl border border-slate-200 p-3.5 bg-white"
                      >
                        <span
                          className={`w-1.5 rounded-full shrink-0 ${PESO[a.peso] || PESO.medio}`}
                        />
                        <div className="min-w-0">
                          <p className="font-black text-[12.5px] text-slate-900 leading-snug">
                            {a.titulo}
                          </p>
                          <p className="text-[11.5px] text-slate-600 font-semibold leading-relaxed mt-1">
                            {a.detalhe}
                          </p>
                          <Provas refs={a.evidencias} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Secao>
              )}

              {/* ----------------------------------- linha do tempo --- */}
              {relatorio.linhaDoTempo.length > 0 && (
                <Secao numero="04" titulo="Linha do tempo" Icone={Clock}>
                  <ol>
                    {relatorio.linhaDoTempo.map((m, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 mt-1.5" />
                          {i < relatorio.linhaDoTempo.length - 1 && (
                            <span className="w-px grow bg-slate-200 my-1" />
                          )}
                        </div>
                        <div className="pb-4 min-w-0">
                          <p className="text-[10.5px] font-black text-slate-400 tabular-nums uppercase tracking-wider">
                            {m.quando}
                          </p>
                          <p className="text-[12px] font-semibold text-slate-700 leading-snug mt-0.5">
                            {m.evento}
                          </p>
                          {m.fonte && (
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                              Fonte: {m.fonte}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Secao>
              )}

              {/* --------------------------------- dossiê de evidências --- */}
              {galeria.length > 0 && (
                <Secao numero="05" titulo="Dossiê de evidências" Icone={Eye}>
                  <div className="space-y-2">
                    {galeria.map((e, i) => (
                      <div
                        key={i}
                        className="quebra-evitar flex gap-3 rounded-xl border border-slate-200 p-3"
                      >
                        <Prova referencia={e.referencia} legenda=" " />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                                FORCA[e.forca]?.classe || FORCA.contexto.classe
                              }`}
                            >
                              {FORCA[e.forca]?.texto || FORCA.contexto.texto}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                              {e.referencia}
                            </span>
                          </div>
                          <p className="text-[11.5px] font-semibold text-slate-700 leading-relaxed mt-1.5">
                            {e.oQueMostra}
                          </p>
                          <p className="text-[11px] font-bold text-slate-500 leading-snug mt-1">
                            {e.porQueImporta}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Secao>
              )}

              {/* ---------------------------------------------- riscos --- */}
              {relatorio.riscos.length > 0 && (
                <Secao numero="06" titulo="Riscos" Icone={ShieldAlert}>
                  <div className="space-y-2">
                    {relatorio.riscos.map((r, i) => (
                      <div
                        key={i}
                        className="quebra-evitar rounded-xl border border-slate-200 p-3.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-slate-800 leading-snug">
                              {r.risco}
                            </p>
                            <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-relaxed">
                              <span className="font-black text-slate-600">Mitigação: </span>
                              {r.mitigacao}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${
                              IMPACTO[r.impacto]?.classe || IMPACTO.medio.classe
                            }`}
                          >
                            {IMPACTO[r.impacto]?.texto}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Secao>
              )}

              {/* ----------------------------------------- o que fazer --- */}
              {relatorio.recomendacoes.length > 0 && (
                <Secao numero="07" titulo="O que fazer agora" Icone={CheckCircle2}>
                  <ol className="space-y-2">
                    {relatorio.recomendacoes.map((r, i) => (
                      <li
                        key={i}
                        className="quebra-evitar flex gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3.5"
                      >
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-[12.5px] text-slate-900 leading-snug">
                            {r.acao}
                          </p>
                          <p className="text-[11px] text-slate-600 font-semibold leading-relaxed mt-1">
                            {r.porQue}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                PRAZO[r.prazo]?.classe || PRAZO.medio.classe
                              }`}
                            >
                              {PRAZO[r.prazo]?.texto}
                            </span>
                            {r.responsavelSugerido && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                {r.responsavelSugerido}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Secao>
              )}

              {/* ----------------------------------------- comunicação --- */}
              {(relatorio.comunicacao.podeSerDito.length > 0 ||
                relatorio.comunicacao.naoDeveSerDito.length > 0 ||
                relatorio.comunicacao.notaSugerida) && (
                <Secao numero="08" titulo="Comunicação pública" Icone={Megaphone}>
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      {relatorio.comunicacao.podeSerDito.length > 0 && (
                        <div className="quebra-evitar rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                          <p className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 mb-2">
                            O material sustenta dizer
                          </p>
                          <ul className="space-y-1.5">
                            {relatorio.comunicacao.podeSerDito.map((t, i) => (
                              <li
                                key={i}
                                className="text-[11.5px] font-semibold text-slate-700 leading-snug flex gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {relatorio.comunicacao.naoDeveSerDito.length > 0 && (
                        <div className="quebra-evitar rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                          <p className="text-[9.5px] font-black uppercase tracking-wider text-rose-700 mb-2">
                            O material NÃO sustenta dizer
                          </p>
                          <ul className="space-y-1.5">
                            {relatorio.comunicacao.naoDeveSerDito.map((t, i) => (
                              <li
                                key={i}
                                className="text-[11.5px] font-semibold text-slate-700 leading-snug flex gap-2"
                              >
                                <X className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {relatorio.comunicacao.notaSugerida && (
                      <div className="quebra-evitar rounded-xl border border-slate-300 bg-white p-4">
                        <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          Nota sugerida — rascunho, a ser conferido antes de sair
                        </p>
                        <p className="text-[12px] font-semibold text-slate-700 leading-relaxed italic">
                          "{relatorio.comunicacao.notaSugerida}"
                        </p>
                      </div>
                    )}
                  </div>
                </Secao>
              )}

              {/* -------------------------------------------- lacunas --- */}
              {relatorio.lacunas.length > 0 && (
                <Secao numero="09" titulo="O que faltou" Icone={FileWarning}>
                  <ul className="space-y-1.5">
                    {relatorio.lacunas.map((l, i) => (
                      <li
                        key={i}
                        className="text-[11.5px] font-semibold text-slate-600 leading-relaxed flex gap-2"
                      >
                        <span className="text-slate-300 font-black shrink-0">—</span>
                        {l}
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}

              {/* ------------------------------------------- veredito --- */}
              {relatorio.veredito && (
                <div className="quebra-evitar bg-slate-950 text-white rounded-2xl p-6">
                  <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2.5 flex items-center gap-1.5">
                    <Gavel className="w-3.5 h-3.5" />
                    Veredito
                  </p>
                  <p className="text-[14.5px] leading-relaxed font-bold">
                    {relatorio.veredito}
                  </p>
                </div>
              )}

              {/*
                A COBERTURA.

                Todo relatório de análise precisa dizer sobre o que ele foi
                feito. Quem lê decide quanto peso dar sabendo que foram nove
                imagens e dois áudios -- e sabendo, principalmente, o que ficou
                de fora.
              */}
              {cobertura && (
                <footer className="quebra-evitar border-t-2 border-slate-900 pt-4 space-y-2">
                  <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                    Sobre o que este relatório foi feito
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                    {cobertura.imagensAnalisadas} imagem(ns) analisada(s) ·{' '}
                    {cobertura.audiosTranscritos} áudio(s) transcrito(s) · modelo{' '}
                    {cobertura.modelo} · gerado em{' '}
                    {new Date(cobertura.geradoEm).toLocaleString('pt-BR')}
                  </p>
                  {cobertura.naoAnalisado.length > 0 && (
                    <ul className="space-y-0.5 pt-1">
                      {cobertura.naoAnalisado.map((n, i) => (
                        <li key={i} className="text-[10.5px] font-semibold text-amber-700">
                          • {n}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] font-semibold text-slate-400 leading-snug pt-1">
                    Documento gerado por um modelo de linguagem a partir do material
                    desta missão. É uma leitura do material, não uma perícia: o que
                    for usado publicamente deve ser conferido contra as evidências
                    citadas, que estão reproduzidas acima.
                  </p>
                </footer>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}
