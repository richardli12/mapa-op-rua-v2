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
 * Não existe tipo fixo no sistema: cada cliente tem os seus, cadastrados por
 * quem opera o painel. Um cliente novo começa sem nenhum tipo, e os tipos de
 * um cliente não aparecem para os outros.
 */
export interface OperationType {
  id: string;
  label: string;
  /** Chave do ícone em operationIcons.ts. */
  icon: string;
  /** Cor sugerida ao criar um ponto deste tipo. */
  color: string;
  /** Cliente dono deste tipo. Tipo sem dono não aparece em lugar nenhum. */
  candidateId?: string;
  createdAt?: string;
  /** Explicação curta mostrada embaixo do nome. */
  description?: string;
  /** Tipo desligado sai dos formulários; o histórico continua intacto. */
  active?: boolean;
  /** Ordem em que aparece no check-in. */
  position?: number;
}

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

/**
 * Nível de prioridade criado pelo administrador.
 *
 * O `id` é o que fica gravado no check-in. Os quatro níveis antigos, que eram
 * fixos no código, entram no banco com os mesmos ids — por isso registro
 * antigo continua sendo reconhecido.
 */
export interface PriorityLevel {
  id: string;
  label: string;
  description?: string;
  color: string;
  position: number;
}

export type CheckInMediaType = 'image' | 'video';

/** Cada foto ou vídeo anexado ao check-in. */
export interface CheckInMedia {
  url: string;
  type: CheckInMediaType;
  /** Caminho dentro do bucket: e por ele que o arquivo e apagado do Storage. */
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
}

/** Observacao do check-in: um texto digitado ou um audio gravado em campo. */
export interface CheckInNote {
  id: string;
  kind: 'texto' | 'audio';
  content?: string;
  url?: string;
  storagePath?: string;
  durationSeconds?: number;
}

/** Tipo de operacao escolhido no check-in, com o rotulo do dia congelado. */
export interface CheckInOperationRef {
  operationTypeId: string;
  operationTypeLabel: string;
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
  status?: 'rascunho' | 'confirmado'; // rascunho enquanto o fluxo não terminou
  notes?: CheckInNote[]; // observações digitadas e áudios gravados
  operations?: CheckInOperationRef[]; // todos os tipos de operação escolhidos
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

/**
 * Cliente do sistema.
 *
 * É a entidade principal do painel: cada área, ponto e check-in do mapa aponta
 * para um cliente. O cadastro pode nascer de dois jeitos, e o campo `source`
 * diz qual deles:
 *
 * - 'manual'    — o administrador digitou os dados na mão;
 * - 'vinculado' — o administrador escolheu alguém de uma base externa e o
 *                 sistema copiou a ficha inteira para o nosso banco, incluindo
 *                 a foto e o id de origem (guardado em `externalId` e também
 *                 usado como `id`, para os vínculos continuarem batendo).
 *
 * O nome do tipo continua Candidate porque é assim que o resto do código o
 * chama desde o começo; na tela, ele aparece como Cliente.
 */
export interface Candidate {
  id: string;
  name: string;
  phone: string;
  instagram_handle: string;
  city: string;
  estado?: string;
  office: string;
  image?: string;
  status_active?: boolean;
  partyId?: string;

  /** Origem do cadastro. */
  source?: 'manual' | 'vinculado';
  /** Id na base de origem, quando o cliente veio de um vínculo. */
  externalId?: string;

  email?: string;
  campanha?: string;
  numeroCampanha?: string;
  linkGrupoWhatsapp?: string;
  favorito?: boolean;

  /** Partido copiado junto com a ficha, para a tela não depender de outra lista. */
  partyName?: string;
  partyInitials?: string;
  partyLogoUrl?: string;
  partyColor?: string;

  /**
   * Se a equipe deste cliente deve ser trazida da base de origem.
   *
   * Nasce desligado de proposito: trazer a equipe e uma escolha do
   * administrador, cliente por cliente, e nao algo que acontece sozinho.
   */
  syncTeam?: boolean;

  /** Data de cadastro na base de origem. */
  externalCreatedAt?: string;
  /** Ficha crua da origem, guardada inteira para não perder nada. */
  raw?: any;
}

/** Nome que a interface usa para a mesma entidade. */
export type Client = Candidate;

export interface Party {
  id: string; // uuid
  name: string;
  initials: string;
  logo_url: string;
  color?: string; // cor primária do partido, vinda da base externa
}


