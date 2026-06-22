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
  iconType: 'flag' | 'megaphone' | 'star' | 'group' | 'home' | 'sound';
  active: boolean;
  createdAt: string;
  date?: string;
  candidateId?: string; // ID do candidato associado
  assignedDeltas?: string[]; // Array de IDs ou WhatsApps atribuídos do Time Delta
}

export interface CheckIn {
  id: string;
  name: string;
  bairro: string;
  rua: string;
  municipio?: string;
  estado?: string;
  photo?: string; // string Base64 da imagem enviada
  coordinates: { lat: number; lng: number };
  userLatitude?: number;  // Localização física exata capturada no check-in
  userLongitude?: number; // Localização física exata capturada no check-in
  createdAt: string;
  candidateId?: string; // ID do candidato associado
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

export const PIN_ICONS = [
  { type: 'flag', label: 'Bandeira / Comitê' },
  { type: 'megaphone', label: 'MegaFone / Caminhada' },
  { type: 'star', label: 'Destaque / Evento' },
  { type: 'group', label: 'Apoio de Lideranças' },
  { type: 'home', label: 'Casa de Apoio' },
  { type: 'sound', label: 'Carro de Som' }
] as const;

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
}

export interface Party {
  id: string; // uuid
  name: string;
  initials: string;
  logo_url: string;
}


