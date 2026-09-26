/**
 * Gerar ícone com NEO — o lado do navegador.
 *
 * Quem fala com o modelo é a rota `/api/icone-neo` (a chave é de servidor).
 * Aqui a pergunta é montada, e cada desenho que volta é reconstruído pela
 * limpeza de iconeSvg.ts antes de existir para a tela: o que não sobrevive à
 * limpeza nem aparece como opção.
 */
import { OPERATION_ICONS } from '../operationIcons';
import { limparSvg } from '../iconeSvg';

export interface VarianteNeo {
  id: string;
  nome: string;
  stroked: boolean;
  /** Miolo já limpo, pronto para o SVG. */
  body: string;
  /** Em que rodada ela nasceu, para o histórico. */
  rodada: number;
}

export interface SugestaoDaBiblioteca {
  key: string;
  motivo: string;
}

export type RespostaDoNeo =
  | { ok: true; entendimento: string; sugestoes: SugestaoDaBiblioteca[]; variantes: VarianteNeo[] }
  | { ok: false; mensagem: string };

let contador = 0;

export async function pedirIconesAoNeo(pedido: {
  nome: string;
  descricao?: string;
  observacao?: string;
  /** Nomes das ideias já mostradas, para o NEO não repetir. */
  jaMostradas?: string[];
  rodada: number;
}): Promise<RespostaDoNeo> {
  try {
    const resposta = await fetch('/api/icone-neo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: pedido.nome,
        descricao: pedido.descricao || '',
        observacao: pedido.observacao || '',
        jaMostradas: pedido.jaMostradas || [],
        biblioteca: OPERATION_ICONS.map((i) => ({ key: i.key, label: i.label }))
      })
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados) {
      return {
        ok: false,
        mensagem:
          dados?.erro?.mensagem ||
          (resposta.status === 404
            ? 'A rota do NEO não respondeu. Em ambiente local ela só funciona com o servidor de funções ligado.'
            : 'O NEO não conseguiu desenhar agora. Tente de novo.')
      };
    }
    const variantes: VarianteNeo[] = (Array.isArray(dados.variantes) ? dados.variantes : [])
      .map((v: any) => ({
        id: `neo-${Date.now().toString(36)}-${(contador++).toString(36)}`,
        nome: String(v?.nome || 'Ícone do NEO'),
        stroked: true,
        body: limparSvg(String(v?.svg || '')),
        rodada: pedido.rodada
      }))
      .filter((v: VarianteNeo) => v.body);
    const sugestoes: SugestaoDaBiblioteca[] = (Array.isArray(dados.sugestoes) ? dados.sugestoes : [])
      .filter((s: any) => OPERATION_ICONS.some((i) => i.key === s?.key))
      .map((s: any) => ({ key: String(s.key), motivo: String(s.motivo || '') }));
    if (variantes.length === 0 && sugestoes.length === 0) {
      return { ok: false, mensagem: 'O NEO não trouxe nenhum desenho aproveitável. Tente de novo.' };
    }
    return { ok: true, entendimento: String(dados.entendimento || ''), sugestoes, variantes };
  } catch {
    return { ok: false, mensagem: 'Sem conexão com o NEO. Confira a internet e tente de novo.' };
  }
}

/** SVG completo de uma variante, com o mesmo traço dos ícones da biblioteca. */
export function svgDaVariante(v: { body: string; stroked: boolean }, tamanho: number, desenhando = false) {
  const pintura = v.stroked
    ? 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'
    : 'fill="currentColor"';
  // pathLength="1" é o que deixa o traço "se desenhar" na tela: um texto fixo
  // nosso, acrescentado a um desenho que já passou pela limpeza.
  const miolo = desenhando
    ? v.body.replace(/<(path|circle|rect|line|polyline|polygon|ellipse)\b/g, '<$1 pathLength="1"')
    : v.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${pintura} width="${tamanho}" height="${tamanho}"${
    desenhando ? ' class="neo-desenha"' : ''
  }>${miolo}</svg>`;
}
