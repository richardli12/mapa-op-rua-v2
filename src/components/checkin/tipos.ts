/**
 * O que a pessoa junta durante o check-in, antes de virar registro no banco.
 *
 * Mídia e observação passam pela mesma vida: nascem locais (uma prévia que o
 * navegador criou), sobem para o Storage com um progresso, e só então têm
 * URL pública. Por isso os dois carregam `estado` e `progresso` — a tela
 * precisa distinguir "ainda subindo" de "subiu" de "falhou", e o botão de
 * confirmar depende disso.
 */

export type MidiaTipo = 'image' | 'video';

export interface MidiaItem {
  id: string;
  tipo: MidiaTipo;
  /** Prévia local (objectURL) enquanto sobe; depois a URL pública do arquivo. */
  previa: string;
  url?: string;
  storagePath?: string;
  progresso: number;
  estado: 'enviando' | 'pronto' | 'erro';
  erro?: string;
}

export interface ObservacaoItem {
  id: string;
  tipo: 'texto' | 'audio';
  texto?: string;
  /** Áudio: prévia local enquanto sobe, depois a URL pública. */
  previa?: string;
  url?: string;
  storagePath?: string;
  duracao?: number;
  progresso: number;
  estado: 'enviando' | 'pronto' | 'erro';
  erro?: string;
}

/** '1:07' a partir de segundos. */
export const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
