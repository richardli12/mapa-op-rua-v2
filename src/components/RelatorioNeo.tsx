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
  Loader2,
  ScanSearch,
  Scale,
  Target,
  X
} from 'lucide-react';
import type { RelatorioDoNeo } from '../neo';
import type { CoberturaDoNeo } from '../services/neo';

/**
 * O relatório do NEO, na tela e no papel.
 *
 * Um documento, não um painel: ele é lido de cima a baixo, é impresso e é
 * mandado para quem não estava na reunião. Por isso a ordem das seções segue a
 * de um relatório de inteligência de verdade — o veredito no começo, para quem
 * só tem três minutos; a prova no meio, para quem vai questionar; o que faltou
 * no fim, sem esconder.
 *
 * O PDF sai pela impressão do próprio navegador, e não por uma biblioteca que
 * fotografa a tela. A diferença aparece no arquivo: o texto continua texto --
 * dá para buscar, copiar e o zoom não borra --, a quebra de página respeita as
 * seções, e o sistema não carrega mais dois megabytes de dependência para
 * fazer o que o Ctrl+P já faz melhor.
 *
 * Vai para fora da árvore do app, via portal, por dois motivos que valem o
 * portal: o card da missão está dentro de um modal com overflow, que cortaria
 * o documento, e a impressão precisa de um elemento solto no body para poder
 * esconder todo o resto.
 */

const SEVERIDADE = {
  alta: { texto: 'Severidade alta', classe: 'bg-rose-100 text-rose-800 border-rose-200' },
  media: { texto: 'Severidade média', classe: 'bg-amber-100 text-amber-800 border-amber-200' },
  baixa: { texto: 'Severidade baixa', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
};

const CONFIANCA = {
  alta: { texto: 'Confiança alta', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  media: { texto: 'Confiança média', classe: 'bg-slate-100 text-slate-700 border-slate-200' },
  baixa: { texto: 'Confiança baixa', classe: 'bg-amber-50 text-amber-800 border-amber-200' }
};

const PESO = {
  alto: 'bg-rose-500',
  medio: 'bg-amber-500',
  baixo: 'bg-slate-300'
};

const PRAZO = {
  imediato: { texto: 'Imediato', classe: 'bg-rose-100 text-rose-800' },
  curto: { texto: 'Curto prazo', classe: 'bg-amber-100 text-amber-800' },
  medio: { texto: 'Médio prazo', classe: 'bg-slate-200 text-slate-700' }
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
    <section className="quebra-evitar space-y-3">
      <div className="flex items-center gap-2.5 border-b border-slate-200 pb-2">
        <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
          <Icone className="w-3.5 h-3.5" />
        </span>
        <h3 className="font-black text-slate-900 text-[13px] uppercase tracking-wider">
          {titulo}
        </h3>
        <span className="ml-auto text-[10px] font-black text-slate-300 tabular-nums">
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
  missaoTitulo,
  onFechar,
  onTentarDeNovo
}: {
  aberto: boolean;
  carregando: boolean;
  erro: string | null;
  relatorio: RelatorioDoNeo | null;
  cobertura: CoberturaDoNeo | null;
  missaoTitulo: string;
  onFechar: () => void;
  onTentarDeNovo: () => void;
}) {
  if (!aberto) return null;

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

  const conteudo = (
    <div className="relatorio-neo-raiz fixed inset-0 z-[5000] bg-slate-900/70 backdrop-blur-xs overflow-y-auto p-4 md:p-8 font-sans">
      <div className="relatorio-neo-folha bg-white rounded-3xl shadow-2xl max-w-3xl mx-auto overflow-hidden">
        {/* Cabeçalho da janela: some no papel, onde ele não é conteúdo. */}
        <div className="nao-imprimir sticky top-0 z-10 bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <Brain className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="min-w-0">
              <span className="block font-black text-[13px] leading-none">NEO</span>
              <span className="block text-[10px] text-slate-400 font-semibold truncate">
                Relatório de missão
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
              <p className="font-black text-slate-800 text-sm">
                O NEO está lendo a missão
              </p>
              <p className="text-[11.5px] text-slate-500 font-semibold mt-1 max-w-sm leading-snug">
                Abrindo cada imagem, transcrevendo os áudios e cruzando o que foi
                pedido com o que voltou da rua. Leva até um minuto.
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
              <p className="font-black text-slate-800 text-sm">
                O relatório não saiu
              </p>
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
          <article className="px-6 md:px-10 py-8 space-y-8 text-slate-800">
            {/* ---------------------------------------------- capa --- */}
            <header className="space-y-3 pb-5 border-b-2 border-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                Relatório de inteligência · NEO
              </p>
              <h1 className="text-2xl md:text-[28px] font-black leading-tight text-slate-900">
                {relatorio.titulo}
              </h1>
              <p className="text-[11.5px] font-bold text-slate-500">
                Missão: {missaoTitulo}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {relatorio.naturezaDaMissao && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white">
                    {relatorio.naturezaDaMissao}
                  </span>
                )}
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                    SEVERIDADE[relatorio.severidade]?.classe || SEVERIDADE.media.classe
                  }`}
                >
                  {SEVERIDADE[relatorio.severidade]?.texto || SEVERIDADE.media.texto}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                    CONFIANCA[relatorio.confianca]?.classe || CONFIANCA.media.classe
                  }`}
                >
                  {CONFIANCA[relatorio.confianca]?.texto || CONFIANCA.media.texto}
                </span>
              </div>
            </header>

            {/* ------------------------------------ resumo e pergunta --- */}
            <div className="quebra-evitar bg-slate-900 text-white rounded-2xl p-5 space-y-3">
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-emerald-400">
                Resumo executivo
              </p>
              <p className="text-[14.5px] leading-relaxed font-semibold">
                {relatorio.resumoExecutivo}
              </p>
              {relatorio.perguntaReal && (
                <p className="text-[11.5px] leading-snug text-slate-300 border-t border-white/15 pt-3">
                  <span className="font-black text-white">A pergunta por trás da missão: </span>
                  {relatorio.perguntaReal}
                </p>
              )}
            </div>

            {/* ------------------------------- pedido x encontrado --- */}
            <Secao numero="01" titulo="Ordem e retorno" Icone={Target}>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    O que foi pedido
                  </p>
                  <p className="text-[12px] leading-relaxed font-semibold text-slate-700">
                    {relatorio.oQueFoiPedido || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 mb-1.5">
                    O que foi encontrado
                  </p>
                  <p className="text-[12px] leading-relaxed font-semibold text-slate-700">
                    {relatorio.oQueFoiEncontrado || '—'}
                  </p>
                </div>
              </div>
            </Secao>

            {/* ---------------------------------------- linha do tempo --- */}
            {relatorio.linhaDoTempo.length > 0 && (
              <Secao numero="02" titulo="Linha do tempo" Icone={Clock}>
                <ol className="space-y-0">
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
                      </div>
                    </li>
                  ))}
                </ol>
              </Secao>
            )}

            {/* ---------------------------------------------- achados --- */}
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
                      </div>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {/* ------------------------------------------ contradições --- */}
            {relatorio.contradicoes.length > 0 && (
              <Secao numero="04" titulo="Alegação x evidência" Icone={Scale}>
                <div className="space-y-2">
                  {relatorio.contradicoes.map((c, i) => (
                    <div
                      key={i}
                      className="quebra-evitar rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden"
                    >
                      <p className="text-[11.5px] font-semibold text-slate-700 leading-relaxed px-4 py-3 border-b border-amber-200/70">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 block mb-1">
                          Alegado
                        </span>
                        {c.alegacao}
                      </p>
                      <p className="text-[11.5px] font-semibold text-slate-800 leading-relaxed px-4 py-3 bg-white/70 flex gap-2">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                        <span>
                          <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 block mb-1">
                            O que as evidências mostram
                          </span>
                          {c.oQueAsEvidenciasMostram}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {/* -------------------------------------------- evidências --- */}
            {relatorio.evidencias.length > 0 && (
              <Secao numero="05" titulo="Leitura das evidências" Icone={Eye}>
                <div className="space-y-2">
                  {relatorio.evidencias.map((e, i) => (
                    <div
                      key={i}
                      className="quebra-evitar rounded-xl border border-slate-200 p-3.5"
                    >
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-900 text-white text-[9.5px] font-black uppercase tracking-wider">
                        {e.referencia}
                      </span>
                      <p className="text-[11.5px] font-semibold text-slate-700 leading-relaxed mt-2">
                        {e.oQueMostra}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 leading-snug mt-1.5 border-t border-slate-100 pt-1.5">
                        {e.porQueImporta}
                      </p>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {/* ------------------------------------------------ riscos --- */}
            {relatorio.riscos.length > 0 && (
              <Secao numero="06" titulo="Riscos" Icone={AlertTriangle}>
                <div className="space-y-2">
                  {relatorio.riscos.map((r, i) => (
                    <div key={i} className="quebra-evitar flex gap-3 items-start">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11.5px] font-semibold text-slate-700 leading-relaxed">
                        {r.risco}
                        <span className="block text-[11px] text-slate-500 font-bold mt-0.5">
                          Mitigação: {r.mitigacao}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {/* ----------------------------------------- recomendações --- */}
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
                      <div className="min-w-0">
                        <p className="font-black text-[12.5px] text-slate-900 leading-snug">
                          {r.acao}
                        </p>
                        <p className="text-[11px] text-slate-600 font-semibold leading-relaxed mt-1">
                          {r.porQue}
                        </p>
                        <span
                          className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider ${
                            PRAZO[r.prazo]?.classe || PRAZO.medio.classe
                          }`}
                        >
                          {PRAZO[r.prazo]?.texto || PRAZO.medio.texto}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </Secao>
            )}

            {/* ------------------------------------------------ lacunas --- */}
            {relatorio.lacunas.length > 0 && (
              <Secao numero="08" titulo="O que faltou" Icone={FileWarning}>
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

            {/* ----------------------------------------------- veredito --- */}
            {relatorio.veredito && (
              <div className="quebra-evitar border-l-4 border-emerald-600 bg-emerald-50/40 rounded-r-2xl p-5">
                <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-2">
                  Veredito
                </p>
                <p className="text-[13.5px] leading-relaxed font-bold text-slate-800">
                  {relatorio.veredito}
                </p>
              </div>
            )}

            {/*
              A COBERTURA.

              Todo relatório de análise precisa dizer sobre o que ele foi feito.
              Quem lê decide quanto peso dar sabendo que foram nove imagens e
              dois áudios -- e sabendo, principalmente, o que ficou de fora.
            */}
            {cobertura && (
              <footer className="quebra-evitar border-t border-slate-200 pt-4 space-y-2">
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
                  citadas.
                </p>
              </footer>
            )}
          </article>
        )}
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}
