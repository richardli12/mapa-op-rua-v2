import { MaterialDeApoio } from '../../types';
import { TurnoId } from '../../turnos';

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

/**
 * Missão enviada pelo comitê e mostrada no alto da conversa.
 *
 * Área e ponto viram a mesma coisa aqui de propósito: na rua os dois são um
 * lugar para ir com uma instrução junto, e a diferença entre círculo e pino
 * só importa no mapa do painel.
 */
export interface MissaoDoCampo {
  id: string;
  tipo: 'area' | 'pin';
  title: string;
  description: string;
  bairro?: string;
  color: string;
  lat: number;
  lng: number;
  /** Só na área: o raio em metros que o comitê desenhou. */
  raio?: number;
  /** Id do tipo de operação que o comitê escolheu para a missão. */
  tipoId?: string;
  /** Rótulo do tipo de operação, quando o comitê escolheu um. */
  tipoLabel?: string;
  /** Missão sem lugar no mapa: a tarefa é a missão, e o local é onde ela estiver. */
  semLocal?: boolean;
  /** O que o comitê mandou junto: arte, planilha, um recado gravado. */
  material?: MaterialDeApoio[];
  /** Parte do dia em que a missão deve acontecer, quando o comitê marcou uma. */
  turno?: TurnoId;
  /** Id do nível de prioridade que o comitê deu à missão. */
  priority?: string;
  createdAt?: string;
}
