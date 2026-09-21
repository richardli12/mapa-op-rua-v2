/**
 * Arquivo que o comitê manda junto com a missão.
 *
 * A arte do panfleto, a planilha das ruas, um recado gravado. Vive dentro do
 * jsonb de posição da missão (`center` na área, `position` no ponto), que já
 * carrega dado que não é coordenada — assim a função funciona no banco que já
 * está no ar, sem depender de migração para o material aparecer no campo.
 */
export interface MaterialDeApoio {
  id: string;
  tipo: 'imagem' | 'video' | 'audio' | 'documento';
  url: string;
  /** Caminho no Storage, para o arquivo sair junto quando a missão sai. */
  storagePath?: string;
  nome: string;
  tamanho?: number;
  /** Só no áudio: a pessoa precisa saber se são 20 segundos ou 4 minutos. */
  duracao?: number;
}

/**
 * A postagem que saiu da missão.
 *
 * O arquivo prova que a ação aconteceu; o link prova que ela foi publicada —
 * e é o link que se manda para o grupo, que se abre para ver o alcance e que
 * some do histórico se ninguém o guardar. Mora no mesmo jsonb do resto.
 */
export interface LinkDeAcao {
  id: string;
  url: string;
  /** O que a pessoa escreveu para lembrar o que é aquilo. Pode faltar. */
  titulo?: string;
  criadoEm: string;
}

/**
 * Quando, dentro do dia, e o quanto importa.
 *
 * Mora no mesmo jsonb do material, pelo mesmo motivo: a missão nasce com
 * turno e prioridade em todo banco que já está no ar, sem esperar migração.
 * `turno` é um id de `src/turnos.ts`; `priority`, o id de um nível cadastrado
 * pelo administrador — o mesmo que o check-in usa.
 */
export interface QuandoDaMissao {
  turno?: 'manha' | 'tarde' | 'noite';
  priority?: string;
}

export interface PanfletagemArea {
  id: string;
  title: string;
  description: string;
  bairro: string;
  center: {
    lat: number;
    lng: number;
    assignedDeltas?: string[];
    material?: MaterialDeApoio[];
    /**
     * Controle de narrativas: o que a missão produziu ou encontrou.
     *
     * Mora no mesmo jsonb do material, e pelo mesmo motivo — funciona no banco
     * que já está no ar. Não se confunde com ele: material é o que o comitê
     * manda ANTES; narrativa é o que volta e serve para contar a história
     * depois. Misturar os dois faria a missão perder a diferença entre a ordem
     * e o resultado.
     */
    narrativas?: MaterialDeApoio[];
    /** Links das postagens que saíram desta missão. */
    acoesLinks?: LinkDeAcao[];
  } & QuandoDaMissao;
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
  /**
   * Onde o ponto fica.
   *
   * `semLocal` marca a missão que não tem lugar no mapa -- "ligar para o
   * presidente do bairro" nao se desenha na rua. A lat/lng continua
   * preenchida porque a coluna do banco é `not null`, mas ela não vale nada
   * nesse caso: quem manda é a marca, e o mapa deixa esse ponto de fora.
   */
  position: {
    lat: number;
    lng: number;
    assignedDeltas?: string[];
    semLocal?: boolean;
    material?: MaterialDeApoio[];
    /** Ver `narrativas` na área: o que a missão produziu, não o que ela manda. */
    narrativas?: MaterialDeApoio[];
    /** Links das postagens que saíram desta missão. */
    acoesLinks?: LinkDeAcao[];
  } & QuandoDaMissao;
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
 * Escola do município.
 *
 * É uma camada pública do mapa: não pertence a nenhum cliente, e sim ao
 * município.
 *
 * DUAS CONTAGENS, E ELAS NÃO SÃO A MESMA COISA. `alunosUnicos` é a pessoa,
 * contada uma vez; `matriculas` são os vínculos, e quem faz Ensino
 * Fundamental e AEE aparece nos dois. Gênero, faixa etária e cor/raça fecham
 * em `alunosUnicos`. Tipo de ensino fecha em `matriculas`. Usar um recorte
 * contra o total errado é o engano fácil desta base.
 *
 * SEM COORDENADA É UM ESTADO VÁLIDO: escola que a fonte mandou sem
 * latitude/longitude entra com os dois em `null`, conta nos totais e nas
 * listas, e o mapa não a desenha. Zero jogaria a escola no meio do Atlântico.
 *
 * Os campos do Censo 2025 (`matMedio`, `matCreche`, `matEspecial`, ...)
 * continuam declarados porque a tabela ainda os guarda, mas a base municipal
 * de 2026 não os preenche — chegam nulos. As colunas de etapa se sobrepõem
 * entre si e nunca devem ser somadas.
 */
export interface Escola {
  codigoInep: string;
  nome: string;
  endereco?: string;
  /** `null` quando a fonte não mandou a localização: existe, mas não no mapa. */
  latitude: number | null;
  longitude: number | null;
  /** Urbana ou Rural. */
  zona?: string | null;
  /** A pessoa, contada uma vez — o total de gênero, idade e cor/raça. */
  alunosUnicos?: number | null;
  municipio?: string;
  uf?: string;
  dependencia?: string;
  situacao?: string;
  restricao?: string;
  telefone?: string;
  etapas?: string[];
  matriculas?: number | null;
  matFeminino?: number | null;
  matMasculino?: number | null;
  matGeneroNaoInformado?: number | null;
  matRacaNaoDeclarada?: number | null;
  matBranca?: number | null;
  matPreta?: number | null;
  matParda?: number | null;
  matAmarela?: number | null;
  matIndigena?: number | null;
  matIndigenaXikrin?: number | null;
  matAlbina?: number | null;
  /** Quem não respondeu — diferente de quem recusou responder. */
  matRacaNaoInformada?: number | null;
  mat0a3?: number | null;
  mat4a5?: number | null;
  mat6a10?: number | null;
  mat11a14?: number | null;
  mat15a17?: number | null;
  mat18a24?: number | null;
  mat25Mais?: number | null;
  matIdadeNaoInformada?: number | null;
  /** Só na base do Censo 2025; a de 2026 separa em 18 a 24 e 25 ou mais. */
  mat18Mais?: number | null;
  matInfantil?: number | null;
  matCreche?: number | null;
  matPreEscola?: number | null;
  matFundamental?: number | null;
  matFundIniciais?: number | null;
  matFundFinais?: number | null;
  matMedio?: number | null;
  matProfissional?: number | null;
  matEja?: number | null;
  /** Atendimento Educacional Especializado: é serviço, não etapa. */
  matAee?: number | null;
  matEjaFundamental?: number | null;
  matEjaMedio?: number | null;
  matEspecial?: number | null;
}

/** Cor de cada rede de ensino, no mapa e nas listas. */
export const CORES_DEPENDENCIA: Record<string, string> = {
  Municipal: '#0ea5e9',
  Estadual: '#8b5cf6',
  Federal: '#059669',
  Privada: '#f59e0b'
};

export function corDaDependencia(dependencia?: string) {
  return CORES_DEPENDENCIA[dependencia || ''] || '#64748b';
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
  favorite?: boolean; // marcado como favorito pelo administrador
  trashed?: boolean; // na lixeira: some das telas, mas dá para restaurar
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


