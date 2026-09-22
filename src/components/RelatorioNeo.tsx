import { useEffect, useRef, useState } from 'react';
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
  ImageOff,
  Layers,
  Loader2,
  Megaphone,
  RefreshCw,
  Save,
  MapPin,
  ScanSearch,
  Scale,
  ShieldAlert,
  Target,
  X
} from 'lucide-react';
import type { ForcaDaEvidencia, RelatorioDoNeo } from '../neo';
import type { PecaDoDossie } from '../services/neo';

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
 * 2. O VEREDITO VEM PRIMEIRO. Manchete, números, as imagens de destaque e a
 *    conclusão estão antes de qualquer seção numerada. Quem tiver quinze
 *    segundos lê só isso e já decide; quem tiver quinze minutos desce e
 *    confere.
 * 3. O QUE NÃO SE PODE DIZER TAMBÉM É RESPOSTA. A seção de comunicação existe
 *    porque a pergunta seguinte de quem lê é sempre "e o que eu falo?" — e sem
 *    ela essa decisão é tomada com pressa, diante de um microfone.
 *
 * A TELA NÃO É A FOLHA.
 *
 * Isto era uma folha A4 de pé boiando num fundo escuro: num monitor de 27
 * polegadas, 768 pixels de documento e o resto de nada. Pior que o desperdício
 * era a navegação — oito seções numeradas em rolagem corrida, sem saber onde
 * se está, quanto falta, nem como voltar ao achado que se leu dois minutos
 * atrás.
 *
 * Agora a tela é uma bancada de três faixas: o índice à esquerda diz onde você
 * está e leva a qualquer seção num toque; o documento no meio mantém a largura
 * de leitura (linha comprida demais cansa, e é ela que vira PDF); e o material
 * da missão à direita mostra TUDO que a equipe mandou — inclusive o que o NEO
 * não citou, que é justamente o que ninguém veria de outro jeito.
 *
 * As faixas ficam FORA de `.relatorio-neo-documento`, de propósito: é esse nó
 * que vira PDF, e o arquivo continua sendo o documento, do mesmo tamanho de
 * sempre, sem barra lateral nenhuma.
 *
 * O PDF sai desenhado em canvas e fatiado em A4 — não pela caixa de impressão
 * do navegador, que carimba a URL do sistema em toda página.
 */

const SEVERIDADE = {
  alta: { texto: 'Severidade alta', curto: 'Alta', classe: 'bg-rose-500 text-white' },
  media: { texto: 'Severidade média', curto: 'Média', classe: 'bg-amber-400 text-amber-950' },
  baixa: { texto: 'Severidade baixa', curto: 'Baixa', classe: 'bg-emerald-500 text-white' }
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

/**
 * Título de seção: o mesmo desenho em todas, para o olho pular de uma à outra.
 *
 * `id` é o que o índice da esquerda usa para saltar, e `data-secao` é o que a
 * rolagem lê para saber em qual seção o leitor está.
 */
function Secao({
  id,
  numero,
  titulo,
  Icone,
  children
}: {
  id: string;
  numero: string;
  titulo: string;
  Icone: any;
  children: ReactNode;
  key?: string;
}) {
  return (
    <section id={id} data-secao={id} className="scroll-mt-6 space-y-3">
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
  pecas,
  missaoTitulo,
  guardado,
  salvando,
  onSalvar,
  onFechar,
  onTentarDeNovo
}: {
  aberto: boolean;
  carregando: boolean;
  erro: string | null;
  relatorio: RelatorioDoNeo | null;
  /** As peças do dossiê: é por elas que o rótulo citado vira imagem. */
  pecas: PecaDoDossie[];
  missaoTitulo: string;
  /** Já está guardado no banco: o botão de salvar vira um selo. */
  guardado: boolean;
  salvando: boolean;
  onSalvar: () => void;
  onFechar: () => void;
  /**
   * Gera de novo, descartando o que está na tela.
   *
   * Opcional: a estante de relatórios abre um documento guardado sem ter em
   * mãos a missão que o originou, e um botão que não tem o que fazer é pior
   * do que botão nenhum.
   */
  onTentarDeNovo?: () => void;
}) {
  /*
   * A peça aberta em tela cheia.
   *
   * O relatório mostra as provas no tamanho que o texto pede -- miniatura ao
   * lado do achado, maior no destaque --, e nesse tamanho não dá para conferir
   * o que a imagem mostra. Clicar abre a peça no meio da tela, sobre o
   * documento, e o documento continua exatamente onde estava.
   */
  const [pecaAberta, setPecaAberta] = useState<{ url: string; titulo: string } | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroDoPdf, setErroDoPdf] = useState<string | null>(null);

  /** A área que rola: o índice e a barra de progresso leem dela. */
  const areaRef = useRef<HTMLDivElement>(null);
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);

  /**
   * Onde o leitor está, e quanto falta.
   *
   * Rolagem, e não `IntersectionObserver`: a pergunta aqui não é "esta seção
   * está visível" — com seções curtas, três ficam visíveis ao mesmo tempo e o
   * índice pisca entre elas. É "qual foi a última seção que passou pelo terço
   * de cima da tela", que é a que a pessoa está lendo.
   */
  useEffect(() => {
    const area = areaRef.current;
    if (!area || !relatorio) return;

    const aoRolar = () => {
      const total = area.scrollHeight - area.clientHeight;
      setProgresso(total > 0 ? Math.min(1, Math.max(0, area.scrollTop / total)) : 0);

      const marcos = Array.from(
        area.querySelectorAll('[data-secao]')
      ) as HTMLElement[];

      /*
       * No fim da rolagem, a última seção manda.
       *
       * A última seção costuma ser curta demais para alcançar o terço de cima
       * da tela — o documento acaba antes. Sem esta linha, saltar para
       * "Comunicação pública" acendia "O que fazer agora" no índice: o leitor
       * está olhando para uma seção e o índice aponta para outra.
       */
      if (area.scrollTop + area.clientHeight >= area.scrollHeight - 4) {
        setSecaoAtiva(marcos[marcos.length - 1]?.dataset.secao ?? null);
        return;
      }

      const limite = area.getBoundingClientRect().top + area.clientHeight * 0.3;
      let atual = marcos[0]?.dataset.secao ?? null;
      marcos.forEach((m) => {
        if (m.getBoundingClientRect().top <= limite) atual = m.dataset.secao ?? atual;
      });
      setSecaoAtiva(atual);
    };

    aoRolar();
    area.addEventListener('scroll', aoRolar, { passive: true });
    return () => area.removeEventListener('scroll', aoRolar);
  }, [relatorio]);

  /** Esc fecha — a peça ampliada primeiro, o relatório depois. */
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      if (pecaAberta) {
        setPecaAberta(null);
        return;
      }
      onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, pecaAberta, onFechar]);

  if (!aberto) return null;

  /** Rótulo → endereço da imagem. O que transforma citação em prova na página. */
  const imagemDe = (referencia: string) =>
    pecas.find(p => p.referencia === referencia && p.tipo === 'imagem')?.url || null;

  const irPara = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          onClick={() => setPecaAberta({ url, titulo: referencia })}
          title="Abrir em tamanho grande"
          className={`w-full object-cover rounded-lg border border-slate-200 bg-slate-100 cursor-zoom-in hover:border-slate-400 transition-colors ${
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
   * O PDF é gerado e baixado aqui, sem passar pela impressão.
   *
   * A caixa de imprimir do navegador entregava o arquivo só depois de a pessoa
   * achar "Salvar como PDF" num menu, e carimbava cabeçalho e rodapé próprios
   * -- com o endereço do sistema e a data -- em toda página. Endereço interno
   * num documento que vai para fora não é detalhe de acabamento.
   *
   * Aqui o documento é desenhado num canvas e fatiado em páginas A4. Sai um
   * arquivo com o nome do relatório, sem uma URL em lugar nenhum.
   *
   * As duas bibliotecas entram por import dinâmico: juntas passam de meio
   * megabyte, e quem só abre o mapa não deveria baixá-las para nada.
   */
  const baixarPdf = async () => {
    const folha = document.querySelector('.relatorio-neo-documento') as HTMLElement | null;
    if (!folha || gerandoPdf) return;

    setGerandoPdf(true);
    setErroDoPdf(null);
    try {
      /*
       * html2canvas-pro, e não o html2canvas.
       *
       * O original parou em 2022 e não conhece as funções de cor modernas. O
       * Tailwind 4, que este sistema usa, escreve as 91 cores da folha em
       * oklch() -- e a montagem do PDF morria na primeira delas, com
       * "unsupported color function". O fork mantido lê oklch, lab e color().
       */
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf')
      ]);

      const canvas = await html2canvas(folha, {
        scale: 2,
        // As imagens vêm de outro domínio; sem isto o canvas fica marcado como
        // contaminado e o navegador recusa transformá-lo em arquivo.
        useCORS: true,
        imageTimeout: 20000,
        backgroundColor: '#ffffff',
        logging: false
      });

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const larguraPagina = pdf.internal.pageSize.getWidth();
      const alturaPagina = pdf.internal.pageSize.getHeight();

      /*
       * ONDE A PÁGINA PODE SER CORTADA.
       *
       * Fatiar o documento de 297 em 297 milímetros parte um cartão de
       * evidência ao meio: metade da foto no fim de uma página, a legenda no
       * começo da outra. É o defeito que faz um relatório parecer improvisado.
       *
       * Cada bloco que não deve ser partido carrega a classe `quebra-evitar`.
       * Aqui medimos onde cada um começa e termina, em pixels do canvas, e a
       * página que fosse cair no meio de um deles termina antes dele -- a
       * sobra de papel é preferível ao corte.
       */
      const escala = canvas.width / folha.offsetWidth;
      const topoDaFolha = folha.getBoundingClientRect().top;
      const blocos = Array.from(
        folha.querySelectorAll('.quebra-evitar')
      ).map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return {
          topo: (r.top - topoDaFolha) * escala,
          base: (r.bottom - topoDaFolha) * escala
        };
      });

      const alturaDaPaginaEmPixels = (alturaPagina * canvas.width) / larguraPagina;

      let inicio = 0;
      let primeira = true;
      while (inicio < canvas.height) {
        let fim = Math.min(inicio + alturaDaPaginaEmPixels, canvas.height);

        if (fim < canvas.height) {
          // O bloco mais alto que o corte atravessa manda a página terminar
          // onde ele começa. Bloco maior que uma folha inteira não tem jeito:
          // aí o corte normal vale, senão a página sairia vazia.
          const atravessado = blocos
            .filter((b) => b.topo > inicio + 40 && b.topo < fim && b.base > fim)
            .sort((a, b) => a.topo - b.topo)[0];
          if (atravessado) fim = atravessado.topo;
        }

        const altura = Math.max(1, Math.round(fim - inicio));
        const pedaco = document.createElement('canvas');
        pedaco.width = canvas.width;
        pedaco.height = altura;
        const pincel = pedaco.getContext('2d');
        if (!pincel) break;
        pincel.fillStyle = '#ffffff';
        pincel.fillRect(0, 0, pedaco.width, pedaco.height);
        pincel.drawImage(canvas, 0, -inicio);

        if (!primeira) pdf.addPage();
        primeira = false;
        pdf.addImage(
          pedaco.toDataURL('image/jpeg', 0.92),
          'JPEG',
          0,
          0,
          larguraPagina,
          (altura * larguraPagina) / canvas.width
        );

        inicio = fim;
      }

      const nome =
        (relatorio?.titulo || 'relatorio-neo')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60) || 'relatorio-neo';

      pdf.save(`${nome}.pdf`);
    } catch (err: any) {
      console.error('Erro ao gerar o PDF:', err);
      /*
       * O erro de verdade vai para a tela.
       *
       * Aqui se mostrava sempre a mesma frase, chutando que a culpa era de
       * alguma imagem -- e a causa real era outra, dita pelo navegador e
       * jogada fora aqui. Quem for consertar precisa do que quebrou, não do
       * nosso palpite sobre o que pode ter quebrado.
       */
      const motivo = String(err?.message || err || '');
      setErroDoPdf(
        /SecurityError|tainted/i.test(motivo)
          ? 'Não deu para montar o PDF: o navegador bloqueou a leitura de uma das imagens do relatório.'
          : `Não deu para montar o PDF. ${motivo}`
      );
    } finally {
      setGerandoPdf(false);
    }
  };

  const destaques = (relatorio?.evidencias || []).filter(e => e.destaque && imagemDe(e.referencia));
  const galeria = (relatorio?.evidencias || []).filter(e => !e.destaque || !imagemDe(e.referencia));

  /**
   * Os rótulos que o relatório cita em algum lugar.
   *
   * Serve à faixa da direita: ela mostra TUDO que a equipe mandou, e precisa
   * marcar o que virou argumento. O que não foi citado é informação — pode ser
   * material fraco, pode ser algo que passou batido, e num relatório fechado
   * ninguém jamais saberia que existiu.
   */
  const citadas = new Set<string>([
    ...(relatorio?.evidencias || []).map(e => e.referencia),
    ...(relatorio?.achados || []).flatMap(a => a.evidencias),
    ...(relatorio?.contradicoes || []).flatMap(c => c.evidencias)
  ]);

  const imagensDaMissao = pecas.filter(p => p.tipo === 'imagem');
  const outrasPecas = pecas.filter(p => p.tipo !== 'imagem');

  /*
   * AS SEÇÕES, NUMA LISTA — E A NUMERAÇÃO SAINDO DELA.
   *
   * O número de cada seção era escrito à mão ("01", "02"...) no lugar onde ela
   * era desenhada. Como cada uma só aparece se tiver conteúdo, um relatório sem
   * contradições saía numerado 01, 03, 04: o leitor procurava a seção 02 que
   * nunca existiu. Aqui a lista é filtrada primeiro e numerada depois, e o
   * índice da esquerda lê exatamente esta lista — uma fonte só para as duas
   * coisas.
   */
  const secoes = !relatorio
    ? []
    : (
        [
          {
            id: 'origem',
            titulo: 'Por que esta missão existiu',
            Icone: Target,
            mostrar: true,
            conteudo: (
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
            )
          },
          {
            id: 'contradicoes',
            titulo: 'Alegação x evidência',
            Icone: Scale,
            mostrar: relatorio.contradicoes.length > 0,
            conteudo: (
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
            )
          },
          {
            id: 'achados',
            titulo: 'Achados',
            Icone: ScanSearch,
            mostrar: relatorio.achados.length > 0,
            conteudo: (
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
            )
          },
          {
            id: 'linha-do-tempo',
            titulo: 'Linha do tempo',
            Icone: Clock,
            mostrar: relatorio.linhaDoTempo.length > 0,
            conteudo: (
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
            )
          },
          {
            id: 'dossie',
            titulo: 'Dossiê de evidências',
            Icone: Eye,
            mostrar: galeria.length > 0,
            conteudo: (
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
            )
          },
          {
            id: 'riscos',
            titulo: 'Riscos',
            Icone: ShieldAlert,
            mostrar: relatorio.riscos.length > 0,
            conteudo: (
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
            )
          },
          {
            id: 'o-que-fazer',
            titulo: 'O que fazer agora',
            Icone: CheckCircle2,
            mostrar: relatorio.recomendacoes.length > 0,
            conteudo: (
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
            )
          },
          {
            id: 'comunicacao',
            titulo: 'Comunicação pública',
            Icone: Megaphone,
            mostrar:
              relatorio.comunicacao.podeSerDito.length > 0 ||
              relatorio.comunicacao.naoDeveSerDito.length > 0 ||
              Boolean(relatorio.comunicacao.notaSugerida),
            conteudo: (
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
            )
          }
        ] as const
      )
        .filter(s => s.mostrar)
        .map((s, i) => ({ ...s, numero: String(i + 1).padStart(2, '0') }));

  /* ------------------------------------------------------------- ações --- */
  const acoes = relatorio && (
    <>
      {/*
        Gerar de novo é uma decisão, e por isso é um botão -- e não o que
        acontece sozinho ao reabrir a missão. Custa uma chamada com imagens, e
        o texto sai diferente do que já foi lido.
      */}
      {onTentarDeNovo && (
        <button
          type="button"
          onClick={onTentarDeNovo}
          title="Descartar este e pedir uma leitura nova ao NEO"
          className="px-3 py-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Gerar de novo</span>
        </button>
      )}
      <button
        type="button"
        onClick={onSalvar}
        disabled={salvando || guardado}
        title={
          guardado
            ? 'Este relatório está guardado: abrir a missão de novo mostra ele.'
            : 'Guardar este relatório'
        }
        className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
          guardado
            ? 'bg-white/10 text-emerald-300 cursor-default'
            : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-95'
        }`}
      >
        {salvando ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : guardado ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        <span className="hidden lg:inline">{guardado ? 'Guardado' : 'Salvar'}</span>
      </button>
      <button
        type="button"
        onClick={baixarPdf}
        disabled={gerandoPdf}
        title="Baixar o documento em PDF"
        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-wait text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
      >
        {gerandoPdf ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span className="hidden md:inline">{gerandoPdf ? 'Montando...' : 'Baixar PDF'}</span>
      </button>
    </>
  );

  const conteudo = (
    <div className="relatorio-neo-raiz fixed inset-0 z-[5000] bg-[#0B1120] flex flex-col font-sans">
      {/* ===================================================== BARRA === */}
      {/*
        Fora do documento, e por isso fora do PDF: aqui moram o nome do que se
        está lendo, o estado do caso e o que se pode fazer com ele. No papel
        nada disso é conteúdo.
      */}
      <div className="relative shrink-0 bg-slate-950 border-b border-white/10 px-4 md:px-5 h-14 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 min-w-0">
          <Brain className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="min-w-0">
            <span className="block font-black text-[12.5px] leading-tight text-white truncate">
              {relatorio?.titulo || 'Relatório de inteligência de campo'}
            </span>
            <span className="block text-[10px] text-slate-400 font-semibold truncate">
              NEO · {missaoTitulo}
            </span>
          </span>
        </span>

        <span className="flex items-center gap-2 shrink-0">
          {relatorio && (
            <span className="hidden xl:flex items-center gap-1.5 mr-1">
              <span
                className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider ${
                  SEVERIDADE[relatorio.severidade]?.classe || SEVERIDADE.media.classe
                }`}
              >
                {SEVERIDADE[relatorio.severidade]?.texto}
              </span>
              <span
                className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider ${
                  URGENCIA[relatorio.urgencia]?.classe || URGENCIA.media.classe
                }`}
              >
                {URGENCIA[relatorio.urgencia]?.texto}
              </span>
            </span>
          )}
          {acoes}
          <button
            type="button"
            onClick={onFechar}
            className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </span>

        {/* Quanto já passou do documento — a régua que a rolagem corrida não dá. */}
        {relatorio && (
          <span className="absolute left-0 bottom-0 h-[2px] bg-emerald-500 transition-[width] duration-150"
            style={{ width: `${progresso * 100}%` }}
          />
        )}
      </div>

      {erroDoPdf && (
        <p className="shrink-0 px-5 py-2.5 bg-rose-950/60 border-b border-rose-900 text-[11px] font-bold text-rose-200 flex items-center gap-2">
          <ImageOff className="w-3.5 h-3.5 shrink-0" />
          {erroDoPdf}
        </p>
      )}

      {/* ===================================================== CORPO === */}
      <div className="flex-1 min-h-0 flex">
        {/* -------------------------------------------------- índice --- */}
        {relatorio && secoes.length > 0 && (
          <nav className="hidden lg:flex w-[196px] xl:w-[228px] shrink-0 flex-col border-r border-white/10 bg-slate-950/60 overflow-y-auto py-5">
            <p className="px-4 xl:px-5 text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5">
              Neste relatório
            </p>
            <button
              type="button"
              onClick={() => irPara('briefing')}
              className={`text-left px-4 xl:px-5 py-2 flex items-center gap-2.5 cursor-pointer border-l-2 transition-colors ${
                secaoAtiva === 'briefing'
                  ? 'border-emerald-400 bg-white/5 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Gavel className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span className="text-[11.5px] font-bold leading-tight">Veredito e resumo</span>
            </button>
            {secoes.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => irPara(s.id)}
                className={`text-left px-4 xl:px-5 py-2 flex items-center gap-2.5 cursor-pointer border-l-2 transition-colors ${
                  secaoAtiva === s.id
                    ? 'border-emerald-400 bg-white/5 text-white'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-[9.5px] font-black tabular-nums text-slate-600 shrink-0 w-4">
                  {s.numero}
                </span>
                <span className="text-[11.5px] font-bold leading-tight">{s.titulo}</span>
              </button>
            ))}

          </nav>
        )}

        {/* ------------------------------------------------ documento --- */}
        <div ref={areaRef} className="flex-1 min-w-0 overflow-y-auto bg-[#111A2B] p-4 lg:p-5 xl:p-7">
          {carregando && (
            <div className="min-h-[60vh] px-8 flex flex-col items-center justify-center text-center gap-5">
              <span className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center border border-white/10">
                <Brain className="w-6 h-6" />
              </span>
              <p className="font-black text-white text-sm">O NEO está lendo a missão</p>
              {/*
                Barra sem porcentagem, de propósito.
                O modelo não informa progresso, e um número inventado subindo até
                90% para travar ali é pior do que barra nenhuma: ensina a não
                confiar na próxima. A faixa varre a barra enquanto se espera --
                diz "está andando", que é tudo que se sabe de verdade.
              */}
              <span className="block w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
                <span className="barra-do-neo block h-full w-2/5 rounded-full bg-emerald-500" />
              </span>
            </div>
          )}

          {erro && !carregando && (
            <div className="min-h-[60vh] px-6 flex flex-col items-center justify-center text-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <FileWarning className="w-6 h-6" />
              </span>
              <div>
                <p className="font-black text-white text-sm">O relatório não saiu</p>
                <p className="text-[11.5px] text-slate-400 font-semibold mt-1 max-w-sm leading-snug">
                  {erro}
                </p>
              </div>
              {onTentarDeNovo && (
                <button
                  type="button"
                  onClick={onTentarDeNovo}
                  className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-200 rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95"
                >
                  Tentar de novo
                </button>
              )}
            </div>
          )}

          {relatorio && !carregando && (
            <div className="relatorio-neo-folha max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
              <article className="relatorio-neo-documento bg-white text-slate-800">
                {/* =========================================== CAPA === */}
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
                  {/* -------------------------------- indicadores --- */}
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

                  {/* --------------------- as provas de destaque --- */}
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

                  {/* ----------------------------- briefing --- */}
                  {/*
                    RESUMO, PERGUNTA E VEREDITO NO MESMO BLOCO, LOGO NO COMEÇO.

                    O veredito ficava no rodapé, depois de oito seções: para
                    saber a conclusão era preciso ler o documento inteiro ou
                    rolar até o fim às cegas. Num documento de decisão isso é
                    o avesso — quem tem quinze segundos precisa da conclusão
                    nesses quinze segundos, e quem tem quinze minutos desce
                    para conferir como se chegou nela.
                  */}
                  <div id="briefing" data-secao="briefing" className="scroll-mt-6 space-y-3">
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
                  </div>

                  {/* ------------------------------- as seções --- */}
                  {secoes.map(s => (
                    <Secao
                      key={s.id}
                      id={s.id}
                      numero={s.numero}
                      titulo={s.titulo}
                      Icone={s.Icone}
                    >
                      {s.conteudo}
                    </Secao>
                  ))}
                </div>
              </article>
            </div>
          )}
        </div>

        {/* ------------------------------------ material da missão --- */}
        {/*
          TUDO QUE A EQUIPE MANDOU — INCLUSIVE O QUE O NEO NÃO CITOU.

          O documento mostra as peças que sustentam alguma afirmação, e só
          elas: é o que faz dele um argumento e não um álbum. Mas isso deixava
          invisível uma informação que só existe aqui — o que voltou da rua e
          NÃO virou argumento. Pode ser material fraco, pode ser algo que
          passou batido pela leitura. De relatório fechado, ninguém nunca
          saberia que essas peças existiram.

          Fica fora do documento porque não é parte da peça que vai para fora:
          é bancada de trabalho de quem está lendo.
        */}
        {relatorio && imagensDaMissao.length > 0 && (
          <aside className="hidden 2xl:flex w-[268px] shrink-0 flex-col border-l border-white/10 bg-slate-950/60 overflow-y-auto">
            <div className="px-4 py-4 border-b border-white/10">
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                Material da missão
              </p>
              <p className="text-[10.5px] font-bold text-slate-400 mt-1.5 leading-snug">
                {imagensDaMissao.length}{' '}
                {imagensDaMissao.length === 1 ? 'imagem' : 'imagens'} ·{' '}
                <span className="text-emerald-400">
                  {imagensDaMissao.filter(p => citadas.has(p.referencia)).length} citadas
                </span>{' '}
                no relatório
              </p>
            </div>

            <div className="p-3 grid grid-cols-2 gap-2">
              {imagensDaMissao.map(p => {
                const citada = citadas.has(p.referencia);
                return (
                  <button
                    key={p.referencia}
                    type="button"
                    onClick={() => setPecaAberta({ url: p.url, titulo: p.referencia })}
                    title={
                      citada
                        ? `${p.referencia} — citada no relatório`
                        : `${p.referencia} — o NEO não citou esta peça`
                    }
                    className="group relative block rounded-lg overflow-hidden border border-white/10 hover:border-emerald-400/60 cursor-zoom-in transition-colors"
                  >
                    <img
                      src={p.url}
                      alt={p.referencia}
                      referrerPolicy="no-referrer"
                      className={`w-full h-[78px] object-cover transition-opacity ${
                        citada ? '' : 'opacity-40 group-hover:opacity-80'
                      }`}
                    />
                    {citada && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                    )}
                  </button>
                );
              })}
            </div>

            {outrasPecas.length > 0 && (
              <p className="px-4 pb-5 text-[10px] font-bold text-slate-500 leading-snug">
                Mais {outrasPecas.length}{' '}
                {outrasPecas.length === 1 ? 'peça' : 'peças'} sem imagem (áudio,
                vídeo ou documento) — o NEO leu, mas não há o que mostrar aqui.
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );

  /*
   * A PEÇA EM TELA CHEIA.
   *
   * Fora do elemento que vira PDF, e acima dele: o documento é fotografado
   * pela classe `relatorio-neo-documento`, e uma imagem aberta por cima
   * entraria no arquivo, gigante, no meio do texto.
   */
  const visor = pecaAberta && (
    <div
      onClick={() => setPecaAberta(null)}
      className="fixed inset-0 z-[6000] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-10 cursor-zoom-out font-sans"
    >
      <button
        type="button"
        onClick={() => setPecaAberta(null)}
        className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
        title="Fechar"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={pecaAberta.url}
        alt={pecaAberta.titulo}
        referrerPolicy="no-referrer"
        onClick={e => e.stopPropagation()}
        className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl cursor-default"
      />
      <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-300 text-center max-w-2xl">
        {pecaAberta.titulo}
      </p>
    </div>
  );

  return createPortal(
    <>
      {conteudo}
      {visor}
    </>,
    document.body
  );
}
