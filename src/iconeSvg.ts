/**
 * Ícones desenhados pelo NEO: como são guardados e como são limpos.
 *
 * GUARDADOS no mesmo campo `icon` do tipo de operação, onde a biblioteca
 * guarda uma chave ("wrench", "truck"). O ícone do NEO vai inteiro, como texto:
 *
 *     neo:1:<path d="..."/><circle .../>
 *         └ 1 = desenho por traço (como os da biblioteca), 0 = preenchido
 *
 * Sem tabela nova e sem migração: um tipo com ícone do NEO é um tipo como
 * outro qualquer, e tudo que já desenha ícone — o marcador do mapa, a lista, o
 * formulário — passa a desenhar este também.
 *
 * LIMPOS antes de chegar à tela, sempre. O SVG vem de um modelo de linguagem
 * e fica num campo que o banco deixa gravar; o que vai para o HTML precisa ser
 * só desenho. A limpeza aqui não conserta — ela RECONSTRÓI: lê só as formas
 * geométricas conhecidas, só os atributos de geometria e de traço, cada valor
 * conferido pelo formato, e monta um SVG novo com isso. O que não está na lista
 * (script, evento, link, imagem, texto, estilo, qualquer coisa) simplesmente
 * não existe no resultado.
 */

export const PREFIXO_NEO = 'neo:';

export interface IconeNeo {
  /** Desenho por traço (padrão da biblioteca) ou preenchido. */
  stroked: boolean;
  /** Miolo do SVG, já limpo, em viewBox 0 0 24 24. */
  body: string;
}

const FORMAS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);

const NUMERO = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i;
const VALIDADORES: Record<string, (v: string) => boolean> = {
  d: (v) => v.length <= 4000 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/.test(v),
  points: (v) => v.length <= 2000 && /^[0-9eE.,\s+-]+$/.test(v),
  cx: (v) => NUMERO.test(v),
  cy: (v) => NUMERO.test(v),
  r: (v) => NUMERO.test(v),
  rx: (v) => NUMERO.test(v),
  ry: (v) => NUMERO.test(v),
  x: (v) => NUMERO.test(v),
  y: (v) => NUMERO.test(v),
  x1: (v) => NUMERO.test(v),
  y1: (v) => NUMERO.test(v),
  x2: (v) => NUMERO.test(v),
  y2: (v) => NUMERO.test(v),
  width: (v) => NUMERO.test(v),
  height: (v) => NUMERO.test(v),
  'stroke-width': (v) => NUMERO.test(v) && Number(v) <= 4,
  opacity: (v) => NUMERO.test(v) && Number(v) >= 0 && Number(v) <= 1,
  // Cor, só a de quem desenha: o ícone sempre pinta com a cor do tipo.
  fill: (v) => v === 'none' || v === 'currentColor',
  stroke: (v) => v === 'none' || v === 'currentColor',
  'stroke-linecap': (v) => /^(butt|round|square)$/.test(v),
  'stroke-linejoin': (v) => /^(miter|round|bevel)$/.test(v),
  'fill-rule': (v) => /^(nonzero|evenodd)$/.test(v),
  'clip-rule': (v) => /^(nonzero|evenodd)$/.test(v),
  transform: (v) =>
    v.length <= 200 &&
    /^\s*((translate|rotate|scale)\([0-9eE.,\s+-]+\)\s*)+$/.test(v)
};

const escaparAtributo = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Reconstrói o SVG só com formas e atributos permitidos.
 *
 * Aceita o miolo ou o SVG inteiro (o `<svg>` de fora é ignorado: o sistema
 * põe o seu, com o viewBox e o tamanho certos). Devolve '' quando não sobra
 * nenhuma forma — e aí não há ícone.
 */
export function limparSvg(bruto: string, maxFormas = 40): string {
  if (!bruto || typeof bruto !== 'string' || bruto.length > 20000) return '';
  // Comentários e CDATA saem antes: dentro deles cabe qualquer coisa.
  const texto = bruto.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const saida: string[] = [];
  let grupos = 0;
  let formas = 0;
  const etiqueta = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)([^<>]*?)(\/?)\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = etiqueta.exec(texto)) && formas < maxFormas) {
    const fecha = m[1] === '/';
    const nome = m[2].toLowerCase();
    if (nome === 'g') {
      if (fecha) {
        if (grupos > 0) {
          saida.push('</g>');
          grupos -= 1;
        }
        continue;
      }
      if (m[4] === '/') continue; // <g/> vazio não desenha nada
      saida.push(`<g${atributos(m[3])}>`);
      grupos += 1;
      continue;
    }
    if (fecha || !FORMAS.has(nome)) continue;
    const attrs = atributos(m[3]);
    // Forma sem geometria não desenha: não entra.
    if (nome === 'path' && !/\sd="/.test(attrs)) continue;
    if (nome === 'polyline' || nome === 'polygon') {
      if (!/\spoints="/.test(attrs)) continue;
    }
    saida.push(`<${nome}${attrs}/>`);
    formas += 1;
  }
  while (grupos-- > 0) saida.push('</g>');
  return formas > 0 ? saida.join('') : '';
}

function atributos(trecho: string): string {
  const achados: string[] = [];
  const vistos = new Set<string>();
  const par = /([a-zA-Z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let a: RegExpExecArray | null;
  while ((a = par.exec(trecho))) {
    const nome = a[1].toLowerCase() === 'stroke-width' ? 'stroke-width' : a[1];
    const valor = (a[3] ?? a[4] ?? '').trim();
    const valida = VALIDADORES[nome];
    if (!valida || vistos.has(nome) || !valida(valor)) continue;
    vistos.add(nome);
    achados.push(` ${nome}="${escaparAtributo(valor)}"`);
  }
  return achados.join('');
}

export const ehIconeNeo = (chave?: string | null): chave is string =>
  typeof chave === 'string' && chave.startsWith(PREFIXO_NEO);

/** Grava o ícone do NEO no formato do campo `icon`. */
export function codificarIconeNeo(icone: IconeNeo): string {
  return `${PREFIXO_NEO}${icone.stroked ? '1' : '0'}:${limparSvg(icone.body)}`;
}

const cache = new Map<string, IconeNeo | null>();

/**
 * Lê (e limpa) o ícone do NEO gravado no campo `icon`.
 *
 * Lembra do resultado: o mapa redesenha dezenas de marcadores a cada filtro,
 * e limpar o mesmo texto a cada vez seria trabalho jogado fora.
 */
export function lerIconeNeo(chave: string): IconeNeo | null {
  if (cache.has(chave)) return cache.get(chave)!;
  let icone: IconeNeo | null = null;
  const m = /^neo:([01]):([\s\S]*)$/.exec(chave);
  if (m) {
    const body = limparSvg(m[2]);
    icone = body ? { stroked: m[1] === '1', body } : null;
  }
  if (cache.size > 500) cache.clear();
  cache.set(chave, icone);
  return icone;
}
