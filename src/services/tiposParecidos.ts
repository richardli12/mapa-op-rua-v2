/**
 * Conferência de Tipo de Operação repetido, do lado do navegador.
 *
 * Quem fala com o modelo é a rota `/api/tipo-operacao-parecido` — a chave é de
 * servidor. Aqui só montamos a pergunta e traduzimos a resposta.
 */

import type { OperationType } from '../types';

export interface TipoParecido {
  /** Tipo que já existe e quer dizer a mesma coisa. */
  id: string;
  label: string;
  /** Por que o modelo achou que é a mesma coisa. Pode faltar. */
  motivo: string | null;
}

/**
 * Procura, entre os tipos do cliente, um que já signifique o mesmo.
 *
 * Devolve `null` quando não há repetição — e também quando a conferência não
 * pôde ser feita (sem chave, modelo fora do ar, rede caída). É de propósito:
 * esta é uma segunda opinião, não uma tranca. Se ela falha, o cadastro segue
 * como sempre seguiu, e ninguém perde o que digitou porque um serviço externo
 * escolheu essa hora para cair.
 */
export async function procurarTipoParecido(
  novo: { label: string; description?: string },
  existentes: OperationType[]
): Promise<TipoParecido | null> {
  try {
    const resposta = await fetch('/api/tipo-operacao-parecido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novo: { label: novo.label, description: novo.description || '' },
        existentes: existentes.map(t => ({
          id: t.id,
          label: t.label,
          description: t.description || ''
        }))
      })
    });

    if (!resposta.ok) return null;

    const dados = await resposta.json();
    if (!dados?.parecido || !dados?.id || !dados?.label) return null;

    return {
      id: String(dados.id),
      label: String(dados.label),
      motivo: dados.motivo ? String(dados.motivo) : null
    };
  } catch {
    return null;
  }
}
