export interface PanfletagemArea {
  id: string;
  title: string;
  description: string;
  bairro: string;
  center: { lat: number; lng: number; assignedDeltas?: string[] };
  radius: number; // in meters (default 500)
  color: string; // Hex color for circle
  active: boolean;
  teamSize?: number;
  contactName?: string;
  createdAt: string;
  candidateId?: string; // ID do candidato associado
  assignedDeltas?: string[]; // Array de IDs ou WhatsApps atribuídos do Time Delta
}

export interface CampaignPin {
  id: string;
  title: string;
  description: string;
  position: { lat: number; lng: number; assignedDeltas?: string[] };
  color: string;
  /** Id do Tipo de Operação (ver OperationType). Fica solto de propósito: os tipos são cadastrados pelo próprio usuário. */
  iconType: string;
  active: boolean;
  createdAt: string;
  date?: string;
  candidateId?: string; // ID do candidato associado
  assignedDeltas?: string[]; // Array de IDs ou WhatsApps atribuídos do Time Delta
}

/**
 * Tipo de Operação de um ponto no mapa.
 *
 * Os tipos não são fixos no código: quem opera o sistema cadastra, edita e
 * apaga os seus próprios. Os padrões abaixo servem só como ponto de partida
 * de uma instalação nova — e os ids dos seis primeiros são os mesmos que os
 * pontos antigos já gravaram, então nada do que está no mapa se perde.
 */
export interface OperationType {
  id: string;
  label: string;
  /** Chave do ícone em operationIcons.ts. */
  icon: string;
  /** Cor sugerida ao criar um ponto deste tipo. */
  color: string;
  createdAt?: string;
}

export const DEFAULT_OPERATION_TYPES: OperationType[] = [
  { id: 'flag', label: 'Base Operacional', icon: 'flag', color: '#2563eb' },
  { id: 'group', label: 'Reunião de Equipe', icon: 'group', color: '#7c3aed' },
  { id: 'star', label: 'Evento / Ação', icon: 'star', color: '#ca8a04' },
  { id: 'megaphone', label: 'Divulgação', icon: 'megaphone', color: '#ea580c' },
  { id: 'home', label: 'Visita / Atendimento', icon: 'home', color: '#16a34a' },
  { id: 'sound', label: 'Veículo de Som', icon: 'sound', color: '#0891b2' }
];

/** Busca um tipo pelo id, tolerando pontos gravados com um tipo já apagado. */
export function findOperationType(
  types: OperationType[],
  id?: string
): OperationType | undefined {
  return types.find(t => t.id === id);
}

/**
 * Modalidades de check-in disponíveis no app de campo:
 * - 'missao': o integrante da equipe marca presença numa missão/área enviada pelo comitê.
 * - 'livre':  o integrante encontrou algo em campo (um buraco na rua, um poste apagado)
 *             e registra por conta própria, sem missão atribuída.
 */
export type CheckInMode = 'missao' | 'livre';

/** Grau de prioridade/impacto informado no check-in livre. */
export type CheckInPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export const CHECKIN_PRIORITIES: {
  value: CheckInPriority;
  label: string;
  description: string;
  color: string;
}[] = [
  { value: 'baixa', label: 'Baixa', description: 'Pode ser resolvido sem pressa.', color: '#10b981' },
  { value: 'media', label: 'Média', description: 'Precisa entrar na fila de serviço.', color: '#f59e0b' },
  { value: 'alta', label: 'Alta', description: 'Atrapalha a rotina do bairro.', color: '#f97316' },
  { value: 'urgente', label: 'Urgente', description: 'Risco imediato à população.', color: '#dc2626' }
];

export function getCheckInPriority(value?: string) {
  return CHECKIN_PRIORITIES.find(p => p.value === value);
}

export type CheckInMediaType = 'image' | 'video';

/** Cada foto ou vídeo anexado ao check-in. */
export interface CheckInMedia {
  url: string;
  type: CheckInMediaType;
}

export const CHECKIN_MAX_MEDIA = 6;
export const CHECKIN_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const CHECKIN_MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

export interface CheckIn {
  id: string;
  name: string;
  bairro: string;
  rua: string;
  municipio?: string;
  estado?: string;
  photo?: string; // primeira foto do check-in (mantido para os registros antigos)
  media?: CheckInMedia[]; // todas as fotos e vídeos anexados
  coordinates: { lat: number; lng: number };
  userLatitude?: number;  // Localização física exata capturada no check-in
  userLongitude?: number; // Localização física exata capturada no check-in
  createdAt: string;
  candidateId?: string; // ID do candidato associado
  mode?: CheckInMode; // Modalidade do check-in (missão enviada x registro livre)
  priority?: CheckInPriority; // Grau de prioridade/impacto (check-in livre)
  missionId?: string; // Área ou ponto vinculado quando o check-in é de missão
  missionTitle?: string; // Título da missão no momento do check-in
}

export interface BairroData {
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

export const MACEIO_BAIRROS: BairroData[] = [
  { name: 'Ponta Verde', lat: -9.6631, lng: -35.7011, description: 'Região litorânea densa, ideal para panfletagem em comércios e calçadão.' },
  { name: 'Jatiúca', lat: -9.6548, lng: -35.7058, description: 'Alta concentração de edifícios residenciais e corredores comerciais.' },
  { name: 'Pajuçara', lat: -9.6705, lng: -35.7118, description: 'Área turística, feiras de artesanato e grande movimentação de pedestres.' },
  { name: 'Farol', lat: -9.6544, lng: -35.7297, description: 'Região de colégios, faculdades, clínicas e tráfego intenso nos semáforos.' },
  { name: 'Centro', lat: -9.6658, lng: -35.7350, description: 'Calçadões principais do comércio de rua. Fluxo massivo de pessoas em horário comercial.' },
  { name: 'Jacintinho', lat: -9.6416, lng: -35.7161, description: 'Bairro extremamente populoso. Comércio popular dinâmico e feira livre.' },
  { name: 'Benedito Bentes', lat: -9.5540, lng: -35.7042, description: 'O maior complexo habitacional de Maceió. Alta densidade demográfica.' },
  { name: 'Tabuleiro do Martins', lat: -9.5851, lng: -35.7601, description: 'Extensão de avenidas de grande fluxo e conexões industriais.' },
  { name: 'Clima Bom', lat: -9.5786, lng: -35.7865, description: 'Bairro periférico populoso, perfeito para caminhadas e corpo a corpo.' },
  { name: 'Cruz das Almas', lat: -9.6366, lng: -35.7019, description: 'Zona hoteleira e proximidade de shoppings e praias.' },
  { name: 'Feitosa', lat: -9.6300, lng: -35.7280, description: 'Área predominantemente residencial com praças movimentadas no final de tarde.' },
  { name: 'Serraria', lat: -9.6105, lng: -35.7285, description: 'Múltiplos condomínios fechados e galerias comerciais.' },
  { name: 'Poço', lat: -9.6610, lng: -35.7185, description: 'Zona de transição importante com comércios variados e órgãos públicos.' }
];

export const PRESET_COLORS = [
  { name: 'Azul Campanha', value: '#2563eb' },
  { name: 'Vermelho Vitória', value: '#dc2626' },
  { name: 'Laranja Renovação', value: '#ea580c' },
  { name: 'Verde Esperança', value: '#16a34a' },
  { name: 'Amarelo Aliança', value: '#ca8a04' },
  { name: 'Roxo União', value: '#9333ea' },
  { name: 'Rosa Mobilização', value: '#db2777' },
  { name: 'Teal Gestão', value: '#0d9488' }
];

export interface Candidate {
  id: string; // uuid
  name: string;
  phone: string;
  instagram_handle: string;
  city: string;
  estado?: string;
  office: string;
  image?: string;
  status_active?: boolean; // optional client-side helper or extra column
  partyId?: string; // vínculo com o partido, vindo do Nexus
}

export interface Party {
  id: string; // uuid
  name: string;
  initials: string;
  logo_url: string;
  color?: string; // cor primária do partido, vinda do Nexus
}


