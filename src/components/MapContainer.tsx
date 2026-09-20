import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { candidateLocationText } from '../services/candidateLocation';
import { DatabaseService } from '../databaseClient';
import {
  expandBox,
  fetchCepStreets,
  fetchNeighborhoodArea,
  fetchOsmStreets,
  fetchStreetGeometry,
  isInsideBox,
  mergeStreetLists,
  StreetOption,
} from '../services/streetSources';
import { Search, X, MapPin, Loader2, Compass, ChevronDown, ChevronUp, Check, Building2, Layers, Calendar, Clock, User, Navigation, MessageSquare, Mic, Flag, Ruler, Undo2, Trash2, Star } from 'lucide-react';
import { PanfletagemArea, CampaignPin, CheckIn, Candidate, OperationType, PriorityLevel, Escola, corDaDependencia, getCheckInPriority } from '../types';
import { buildOperationIconSvg } from '../operationIcons';

// Função inteligente de normalização para ignorar acentos e caracteres especiais
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .replace(/[.-]/g, " ") // pontos e hifens viram espaços
    .replace(/\s+/g, " ") // remove espaços extras
    .trim();
};

// Remove prefixos comuns de endereços para otimizar busca semântica
const cleanStreetPrefixes = (text: string): string => {
  let cleaned = normalizeText(text);
  const prefixes = [
    /^avenida\s+/, /^av\s+/,
    /^rua\s+/, /^r\s+/,
    /^travessa\s+/, /^tv\s+/,
    /^alameda\s+/, /^al\s+/,
    /^praça\s+/, /^pr\s+/
  ];
  for (const prefix of prefixes) {
    if (prefix.test(cleaned)) {
      cleaned = cleaned.replace(prefix, '');
      break;
    }
  }
  return cleaned.trim();
};

// Casamento inteligente de nomes de ruas tolerante a erros de digitação e termos incompletos
const matchStreetName = (streetName: string, query: string): boolean => {
  const q = query.trim();
  if (!q) return true;

  const normalizedQuery = normalizeText(q);
  const normalizedStreet = normalizeText(streetName);

  // 1. Caso direto (se contém a query inteira)
  if (normalizedStreet.includes(normalizedQuery)) return true;

  // 2. Limpeza de prefixos ("avenida pilar" vs "pilar", etc.)
  const cleanedQuery = cleanStreetPrefixes(q);
  const cleanedStreet = cleanStreetPrefixes(streetName);
  if (cleanedQuery.length > 0 && (cleanedStreet.includes(cleanedQuery) || cleanedQuery.includes(cleanedStreet))) return true;

  // 3. Comparação de tokens (palavras quebradas)
  const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
  const streetTokens = normalizedStreet.split(/\s+/).filter(t => t.length > 0);
  
  if (queryTokens.length === 0) return false;

  // Verifica se cada termo buscado bate de alguma forma com os termos da rua
  return queryTokens.every((qToken, index) => {
    // Ignora termos de preposição comuns de 1 ou 2 letras na busca se tivermos outros termos
    if (qToken.length <= 2 && queryTokens.length > 1) return true;
    
    const isLastToken = index === queryTokens.length - 1;

    return streetTokens.some(sToken => {
      // Se for a última palavra digitada, ela pode ser um prefixo incompleto (ex: "antônie" -> "antonieta")
      if (isLastToken && sToken.startsWith(qToken)) {
        return true;
      }
      if (sToken.startsWith(qToken) || qToken.startsWith(sToken) || sToken.includes(qToken)) {
        return true;
      }
      // Cálculo de similaridade para tolerância a pequenos erros de escrita
      if (Math.abs(sToken.length - qToken.length) <= 3) {
        let commonChars = 0;
        const minLen = Math.min(sToken.length, qToken.length);
        for (let i = 0; i < minLen; i++) {
          if (sToken[i] === qToken[i]) commonChars++;
        }
        // Se bate quase todas as letras
        if (commonChars >= minLen - 2 && minLen > 3) return true;
      }
      return false;
    });
  });
};

export const NEIGHBORHOOD_DATA = [
  {
    id: 'ponta_verde',
    name: 'Ponta Verde',
    center: { lat: -9.6611, lng: -35.7029 },
    ruas: [
      { name: 'Av. Silvio Carlos Viana', lat: -9.6644, lng: -35.7029 },
      { name: 'Av. Álvaro Otacílio', lat: -9.6585, lng: -35.7011 },
      { name: 'Rua Durval Guimarães', lat: -9.6609, lng: -35.7035 },
      { name: 'Rua Eng. Mario de Gusmão', lat: -9.6617, lng: -35.7051 },
      { name: 'Rua Hélio Pradines', lat: -9.6593, lng: -35.7042 },
      { name: 'Rua Deputado José Lages', lat: -9.6565, lng: -35.7075 },
      { name: 'Rua Prof. Sandoval Arroxelas', lat: -9.6582, lng: -35.7082 },
      { name: 'Rua Senador Rui Palmeira', lat: -9.6558, lng: -35.7062 }
    ]
  },
  {
    id: 'jatiuca',
    name: 'Jatiúca',
    center: { lat: -9.6508, lng: -35.7042 },
    ruas: [
      { name: 'Av. Dr. Antônio Gomes de Barros (Amélia Rosa)', lat: -9.6479, lng: -35.7061 },
      { name: 'Av. Álvaro Otacílio (Jatiúca)', lat: -9.6525, lng: -35.7024 },
      { name: 'Rua Dr. Augusto Cardoso', lat: -9.6508, lng: -35.7052 },
      { name: 'Av. João Davino (Jatiúca)', lat: -9.6384, lng: -35.7112 },
      { name: 'Rua Maria Kikuti', lat: -9.6450, lng: -35.7085 },
      { name: 'Rua José Luiz Calazans', lat: -9.6425, lng: -35.7071 },
      { name: 'Av. Júlio Marques Luz', lat: -9.6465, lng: -35.7070 },
      { name: 'Rua Dr. Paulo Brandão Nogueira', lat: -9.6445, lng: -35.7050 }
    ]
  },
  {
    id: 'pajucara',
    name: 'Pajuçara',
    center: { lat: -9.6685, lng: -35.7171 },
    ruas: [
      { name: 'Av. Dr. Antônio Gouveia', lat: -9.6698, lng: -35.7185 },
      { name: 'Rua Jangadeiros Alagoanos', lat: -9.6678, lng: -35.7165 },
      { name: 'Rua Epaminondas Gracindo', lat: -9.6661, lng: -35.7191 },
      { name: 'Av. Robert Kennedy', lat: -9.6684, lng: -35.7152 },
      { name: 'Rua Conselheiro Sebastião Lima', lat: -9.6659, lng: -35.7225 },
      { name: 'Rua Melo Póvoas', lat: -9.6652, lng: -35.7201 }
    ]
  },
  {
    id: 'farol',
    name: 'Farol',
    center: { lat: -9.6542, lng: -35.7289 },
    ruas: [
      { name: 'Av. Fernandes Lima', lat: -9.6482, lng: -35.7245 },
      { name: 'Rua Dom Antônio Brandão', lat: -9.6535, lng: -35.7285 },
      { name: 'Rua Clementino do Monte', lat: -9.6558, lng: -35.7298 },
      { name: 'Rua Pinheiro Machado', lat: -9.6512, lng: -35.7321 },
      { name: 'Avenida Rotary', lat: -9.6395, lng: -35.7248 },
      { name: 'Rua Prof. José da Silveira Camerino', lat: -9.6438, lng: -35.7265 }
    ]
  },
  {
    id: 'benedito_bentes',
    name: 'Benedito Bentes',
    center: { lat: -9.5630, lng: -35.7510 },
    ruas: [
      { name: 'Av. Benedito Bentes', lat: -9.5615, lng: -35.7525 },
      { name: 'Av. Cachoeira do Meirim', lat: -9.5645, lng: -35.7482 },
      { name: 'Rua Mário Palmeira Senior', lat: -9.5575, lng: -35.7562 },
      { name: 'Av. Pratagy', lat: -9.5540, lng: -35.7535 },
      { name: 'Rua Cincinato Pinto', lat: -9.5495, lng: -35.7510 }
    ]
  },
  {
    id: 'tabuleiro_martins',
    name: 'Tabuleiro do Martins',
    center: { lat: -9.5936, lng: -35.7538 },
    ruas: [
      { name: 'Av. Durval de Góes Monteiro', lat: -9.5942, lng: -35.7545 },
      { name: 'Rua General Hermes', lat: -9.5891, lng: -35.7512 },
      { name: 'Av. Maceió (Tabuleiro)', lat: -9.5915, lng: -35.7585 },
      { name: 'Rua Pão de Açúcar', lat: -9.5855, lng: -35.7480 },
      { name: 'Rua Santana do Ipanema', lat: -9.5872, lng: -35.7520 }
    ]
  },
  {
    id: 'centro',
    name: 'Centro',
    center: { lat: -9.6644, lng: -35.7350 },
    ruas: [
      { name: 'Rua do Livramento', lat: -9.6631, lng: -35.7365 },
      { name: 'Rua do Comércio', lat: -9.6642, lng: -35.7352 },
      { name: 'Av. Moreira Lima', lat: -9.6628, lng: -35.7345 },
      { name: 'Praça Marechal Deodoro', lat: -9.6651, lng: -35.7375 },
      { name: 'Rua Cansanção', lat: -9.6612, lng: -35.7390 },
      { name: 'Rua do Sol', lat: -9.6655, lng: -35.7340 }
    ]
  },
  {
    id: 'serraria',
    name: 'Serraria',
    center: { lat: -9.6133, lng: -35.7214 },
    ruas: [
      { name: 'Av. Menino Marcelo (Serraria)', lat: -9.6105, lng: -35.7218 },
      { name: 'Rua Adolfo Gustavo', lat: -9.6148, lng: -35.7252 },
      { name: 'Av. Getúlio Vargas (Serraria)', lat: -9.6175, lng: -35.7290 },
      { name: 'Rua Nelson Marinho de Araújo', lat: -9.6085, lng: -35.7230 }
    ]
  },
  {
    id: 'cruz_das_almas',
    name: 'Cruz das Almas',
    center: { lat: -9.6295, lng: -35.7077 },
    ruas: [
      { name: 'Av. Brigadeiro Eduardo Gomes', lat: -9.6285, lng: -35.7058 },
      { name: 'Av. Josepha de Mello', lat: -9.6258, lng: -35.7114 },
      { name: 'Rua Padre Luiz de Souza', lat: -9.6308, lng: -35.7092 },
      { name: 'Rua Gustavo Paiva (Cruz das Almas)', lat: -9.6240, lng: -35.7082 },
      { name: 'Avenida Pilar', lat: -9.6272, lng: -35.7031 },
      { name: 'Rua Maria Antonieta Teixeira Leite', lat: -9.6265, lng: -35.7015 }
    ]
  },
  {
    id: 'mangabeiras',
    name: 'Mangabeiras',
    center: { lat: -9.6453, lng: -35.7118 },
    ruas: [
      { name: 'Av. Comendador Gustavo Paiva', lat: -9.6436, lng: -35.7110 },
      { name: 'Av. João Davino (Mangabeiras)', lat: -9.6398, lng: -35.7125 },
      { name: 'Rua Desportista Humberto Guimarães', lat: -9.6465, lng: -35.7099 },
      { name: 'Av. Dona Constança de Nelore', lat: -9.6408, lng: -35.7145 }
    ]
  },
  {
    id: 'barro_duro',
    name: 'Barro Duro',
    center: { lat: -9.6136, lng: -35.7335 },
    ruas: [
      { name: 'Av. Menino Marcelo (Barro Duro)', lat: -9.6120, lng: -35.7350 },
      { name: 'Rua Jofre Novo', lat: -9.6140, lng: -35.7315 },
      { name: 'Av. Juca Sampaio', lat: -9.6165, lng: -35.7410 }
    ]
  },
  {
    id: 'feitosa',
    name: 'Feitosa',
    center: { lat: -9.6385, lng: -35.7270 },
    ruas: [
      { name: 'Av. Governador Lamenha Filho', lat: -9.6345, lng: -35.7285 },
      { name: 'Rua Platina', lat: -9.6360, lng: -35.7250 },
      { name: 'Rua do Engenho', lat: -9.6320, lng: -35.7310 }
    ]
  },
  {
    id: 'antares',
    name: 'Antares',
    center: { lat: -9.5982, lng: -35.7275 },
    ruas: [
      { name: 'Av. Menino Marcelo (Antares)', lat: -9.5960, lng: -35.7210 },
      { name: 'Rua Dr. José Fábio Lins', lat: -9.5995, lng: -35.7290 },
      { name: 'Via Expressa (Antares)', lat: -9.5870, lng: -35.7150 }
    ]
  }
];

interface MapContainerProps {
  areas: PanfletagemArea[];
  pins: CampaignPin[];
  checkIns?: CheckIn[];
  /** Escolas do municipio do cliente, camada publica do mapa. */
  escolas?: Escola[];
  /** A camada de escolas so desenha quando esta ligada no dock. */
  escolasVisiveis?: boolean;
  /** Clique numa escola: quem mostra a ficha e a tela de cima. */
  onEscolaSelecionada?: (escola: Escola) => void;
  selectedId: string | null;
  onSelectItem: (id: string, type: 'area' | 'pin') => void;
  clickToPickCoords: boolean;
  /** Esconde o painel de busca enquanto um ponto está sendo colocado. */
  esconderBusca?: boolean;
  /** Estabelecimentos achados na pesquisa do CCO, desenhados como lojinhas. */
  estabelecimentos?: {
    id: string;
    nome: string;
    latitude: number;
    longitude: number;
    endereco: string | null;
    categoria: string | null;
    avaliacao: number | null;
    situacao: string | null;
  }[];
  /** Qual deles está em foco: o mapa voa até ele e destaca o marcador. */
  estabelecimentoEmFoco?: string | null;
  /** Clique num marcador de estabelecimento. */
  onEstabelecimentoSelecionado?: (id: string) => void;
  /** Entrega ao painel o centro e o zoom de agora, para a busca por área. */
  aoRegistrarVista?: (ler: () => { lat: number; lng: number; zoom: number } | null) => void;
  onCoordsPicked: (coords: { lat: number; lng: number }) => void;
  tempPlacementCoords: { lat: number; lng: number } | null;
  tempPlacementColor: string;
  tempPlacementRadius?: number;
  tempPlacementType?: 'area' | 'pin';
  /** Avisa o raio novo enquanto o circulo e arrastado no mapa. */
  onTempRadiusChange?: (metros: number) => void;
  externalBairroName?: string | null;
  externalRuaName?: string | null;
  onExternalBairroChange?: (name: string | null) => void;
  onExternalRuaChange?: (name: string | null, lat: number, lng: number) => void;
  externalStateShortName?: string | null;
  externalStateName?: string | null;
  externalCityIbgeId?: number | null;
  externalCityName?: string | null;
  externalDistrictId?: number | null;
  onExternalStateChange?: (shortName: string | null, name: string | null) => void;
  onExternalCityChange?: (ibgeId: number | null, name: string | null) => void;
  onExternalDistrictIdChange?: (id: number | null) => void;
  defaultLocation?: {
    uf: string;
    stateName: string;
    cityIbgeId: number | null;
    cityName: string | null;
  } | null;
  selectedCandidateId?: string;
  candidates?: Candidate[];
  mapFilter?: 'all' | 'checkins' | 'markers' | 'favoritos';
  onMapFilterChange?: (filter: 'all' | 'checkins' | 'markers' | 'favoritos') => void;
  /** Liga ou desliga a estrela de um check-in, direto do mapa. */
  onToggleCheckInFavorite?: (checkIn: CheckIn) => void;
  /** Exclusão do check-in pelo administrador, direto do mapa. */
  onDeleteCheckIn?: (checkIn: CheckIn) => void;
  /** Tipos de Operação cadastrados, usados para achar o ícone de cada ponto. */
  operationTypes?: OperationType[];
  /** Níveis de prioridade criados pelo administrador. */
  priorityLevels?: PriorityLevel[];

  /* ------------------------------------------------------------- régua ---
   * A régua é comandada pelo menu lateral: aqui o mapa só desenha o que
   * recebe e avisa onde a pessoa tocou. Assim a ferramenta tem um dono só, e
   * cor, nome e histórico ficam junto do resto dos controles.
   */
  rulerActive?: boolean;
  /** Pontos da medição em andamento. */
  rulerPoints?: { lat: number; lng: number }[];
  rulerColor?: string;
  onRulerPoint?: (coords: { lat: number; lng: number }) => void;
}

/**
 * Ícone do marcador, vindo da mesma lista que o restante do sistema usa.
 * `type` é a chave do ícone do Tipo de Operação cadastrado pelo usuário.
 */
const getSvgIconString = (type: string) => buildOperationIconSvg(type, 16);

const getCustomPinIcon = (color: string, iconType: string, isSelected: boolean) => {
  const scaledSize = isSelected ? 44 : 36;
  const borderSize = isSelected ? 4 : 3;
  const shadowClass = isSelected ? 'drop-shadow-lg' : 'drop-shadow-md';

  return L.divIcon({
    className: `custom-div-icon ${shadowClass}`,
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${scaledSize}px;
        height: ${scaledSize}px;
        background: white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: ${borderSize}px solid ${color};
        position: relative;
        transition: all 0.2s ease-in-out;
      ">
        <div style="
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${color};
          width: 22px;
          height: 22px;
        ">
          ${getSvgIconString(iconType)}
        </div>
      </div>
      <div style="
        width: 10px;
        height: 10px;
        background: ${color};
        border-radius: 50%;
        position: absolute;
        top: ${scaledSize - 5}px;
        left: ${(scaledSize / 2) - 5}px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        border: 1px solid white;
      "></div>
    `,
    iconSize: [scaledSize, scaledSize + 10],
    iconAnchor: [scaledSize / 2, scaledSize + 8],
    popupAnchor: [0, -scaledSize]
  });
};

export default function MapContainer({
  areas,
  pins,
  checkIns,
  escolas,
  escolasVisiveis = false,
  onEscolaSelecionada,
  selectedId,
  onSelectItem,
  clickToPickCoords,
  esconderBusca = false,
  estabelecimentos,
  estabelecimentoEmFoco,
  onEstabelecimentoSelecionado,
  aoRegistrarVista,
  onCoordsPicked,
  tempPlacementCoords,
  tempPlacementColor,
  tempPlacementRadius = 0,
  tempPlacementType = 'area',
  onTempRadiusChange,
  externalBairroName,
  externalRuaName,
  onExternalBairroChange,
  onExternalRuaChange,
  externalStateShortName,
  externalStateName,
  externalCityIbgeId,
  externalCityName,
  externalDistrictId,
  onExternalStateChange,
  onExternalCityChange,
  onExternalDistrictIdChange,
  defaultLocation,
  selectedCandidateId,
  candidates,
  mapFilter: propMapFilter,
  onMapFilterChange,
  onToggleCheckInFavorite,
  onDeleteCheckIn,
  operationTypes = [],
  priorityLevels = [],
  rulerActive = false,
  rulerPoints = [],
  rulerColor = '#F58220',
  onRulerPoint
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  /** Camada de desenho da régua e das medições salvas. */
  const reguaGroupRef = useRef<L.LayerGroup | null>(null);
  /** Lidos dentro dos avisos do mapa, que nascem uma vez só. */
  const reguaAtivaRef = useRef(rulerActive);
  const onRulerPointRef = useRef(onRulerPoint);
  reguaAtivaRef.current = rulerActive;
  onRulerPointRef.current = onRulerPoint;
  const circlesGroupRef = useRef<L.LayerGroup | null>(null);
  const pinsGroupRef = useRef<L.LayerGroup | null>(null);
  const tempGroupRef = useRef<L.LayerGroup | null>(null);
  // O circulo temporario e o puxador da borda vivem fora do ciclo de render:
  // enquanto o raio esta sendo arrastado, refazer as camadas cortaria o gesto.
  const tempCircleRef = useRef<any>(null);
  const tempHandleRef = useRef<any>(null);
  const arrastandoRaioRef = useRef(false);
  /** Escreve a medida no miolo do círculo temporário, quando ele existe. */
  const tempMedidaRef = useRef<((metros: number) => void) | null>(null);
  /** Desfaz o aviso de zoom do círculo fantasma quando a camada é refeita. */
  const limparZoomRef = useRef<(() => void) | null>(null);
  /** Tamanho do círculo fantasma, em metros, no zoom de agora. */
  const tempFantasmaRef = useRef<(() => number) | null>(null);
  /**
   * Espelhos lidos de dentro do mapa.
   *
   * Os avisos do Leaflet são registrados uma vez só, na criação do mapa, e
   * enxergariam para sempre o primeiro valor de cada prop. Guardados em ref,
   * eles leem o valor de agora.
   */
  const pegandoCoordenadaRef = useRef(clickToPickCoords);
  pegandoCoordenadaRef.current = clickToPickCoords;
  const aoEscolherCoordenadaRef = useRef(onCoordsPicked);
  aoEscolherCoordenadaRef.current = onCoordsPicked;
  const aoMudarRaioRef = useRef(onTempRadiusChange);
  aoMudarRaioRef.current = onTempRadiusChange;
  /** Último ponto para onde o mapa já andou sozinho. */
  const ultimoPanRef = useRef<string>('');
  /** Cliente cujo conteúdo o mapa já enquadrou; não se enquadra duas vezes. */
  const ultimoEnquadradoRef = useRef<string>('');
  const raioRef = useRef(tempPlacementRadius);
  raioRef.current = tempPlacementRadius;
  const checkInsGroupRef = useRef<L.LayerGroup | null>(null);
  const escolasGroupRef = useRef<L.LayerGroup | null>(null);
  const lojasGroupRef = useRef<L.LayerGroup | null>(null);
  /** Marcadores por id, para destacar o que a lista escolheu. */
  const lojasPorIdRef = useRef<{ [id: string]: any }>({});
  // Guarda se a camada ja estava ligada: o enquadramento acontece na virada,
  // e nao a cada vez que a lista de escolas e recalculada.
  const camadaEscolasLigadaRef = useRef(false);
  // O clique da escola muda a cada render; o marcador le pela ref e nao
  // precisa ser refeito so por isso.
  const aoClicarEscolaRef = useRef(onEscolaSelecionada);
  aoClicarEscolaRef.current = onEscolaSelecionada;
  const delimitationGroupRef = useRef<L.LayerGroup | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [localMapFilter, setLocalMapFilter] = useState<'all' | 'checkins' | 'markers' | 'favoritos'>('all');
  const mapFilter = propMapFilter !== undefined ? propMapFilter : localMapFilter;
  const setMapFilter = onMapFilterChange !== undefined ? onMapFilterChange : setLocalMapFilter;
  const [selectedCheckInForModal, setSelectedCheckInForModal] = useState<CheckIn | null>(null);
  /**
   * Observações, operações e mídias do check-in aberto.
   *
   * Moram em tabelas próprias, então a ficha as busca ao abrir. Banco sem as
   * tabelas novas devolve listas vazias e o resto da ficha continua de pé.
   */
  const [detalhesCheckIn, setDetalhesCheckIn] = useState<{
    notas: any[];
    operacoes: any[];
    midias: any[];
  }>({ notas: [], operacoes: [], midias: [] });

  useEffect(() => {
    if (!selectedCheckInForModal?.id) {
      setDetalhesCheckIn({ notas: [], operacoes: [], midias: [] });
      return;
    }
    let vivo = true;
    (async () => {
      const res = await DatabaseService.lerDetalhesCheckIn(selectedCheckInForModal.id);
      if (!vivo) return;
      setDetalhesCheckIn({ notas: res.notas, operacoes: res.operacoes, midias: res.midias });
    })();
    return () => {
      vivo = false;
    };
  }, [selectedCheckInForModal?.id]);
  const [reverseGeocodedAddress, setReverseGeocodedAddress] = useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);

  useEffect(() => {
    if (selectedCheckInForModal && selectedCheckInForModal.userLatitude && selectedCheckInForModal.userLongitude) {
      setReverseGeocodedAddress(null);
      setIsReverseGeocoding(true);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${selectedCheckInForModal.userLatitude}&lon=${selectedCheckInForModal.userLongitude}&accept-language=pt-BR`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.display_name) {
            setReverseGeocodedAddress(data.display_name);
          } else {
            setReverseGeocodedAddress(null);
          }
        })
        .catch((err) => {
          console.error("Erro na geocodificação reversa do GPS físico:", err);
          setReverseGeocodedAddress(null);
        })
        .finally(() => {
          setIsReverseGeocoding(false);
        });
    } else {
      setReverseGeocodedAddress(null);
      setIsReverseGeocoding(false);
    }
  }, [selectedCheckInForModal]);

  // Controle de visibilidade do painel de navegação cascata
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Brasil Aberto lists & selections
  const [brasilStates, setBrasilStates] = useState<{ name: string; shortName: string }[]>([]);
  const [brasilCities, setBrasilCities] = useState<{ id: number; ibgeId: number; name: string }[]>([]);
  const [brasilDistricts, setBrasilDistricts] = useState<{ id: number; name: string }[]>([]);
  const [brasilStreets, setBrasilStreets] = useState<StreetOption[]>([]);

  const [selectedStateShortName, setSelectedStateShortName] = useState<string | null>(externalStateShortName || 'AL');
  const [selectedStateName, setSelectedStateName] = useState<string | null>(externalStateName || 'Alagoas');
  const [selectedCityIbgeId, setSelectedCityIbgeId] = useState<number | null>(externalCityIbgeId || 2704302);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(externalCityName || 'Maceió');
  const [selectedBairroName, setSelectedBairroName] = useState<string | null>(externalBairroName || null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(externalDistrictId || null);
  const [selectedRuaName, setSelectedRuaName] = useState<string | null>(externalRuaName || null);
  const [selectedStreetId, setSelectedStreetId] = useState<number | null>(null);

  const [isMapLoading, setIsMapLoading] = useState(() => {
    return !!(selectedCandidateId && selectedCandidateId !== 'all');
  });

  // Search inputs for filtering dropdowns
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [bairroSearch, setBairroSearch] = useState('');
  const [ruaSearch, setRuaSearch] = useState('');

  // Dropdown open states
  const [openStateDropdown, setOpenStateDropdown] = useState(false);
  const [openCityDropdown, setOpenCityDropdown] = useState(false);
  const [openBairroDropdown, setOpenBairroDropdown] = useState(false);
  const [openRuaDropdown, setOpenRuaDropdown] = useState(false);

  // Loading states
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingStreets, setLoadingStreets] = useState(false);
  const [loadingOsmStreets, setLoadingOsmStreets] = useState(false);

  // Search Results Marker State
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const [searchMarkerCoords, setSearchMarkerCoords] = useState<{ lat: number; lng: number; name: string } | null>(null);

  // Sincronização externa -> interna de Bairro, Rua, Estado e Cidade
  useEffect(() => {
    if (externalStateShortName !== undefined) setSelectedStateShortName(externalStateShortName);
  }, [externalStateShortName]);

  useEffect(() => {
    if (externalStateName !== undefined) setSelectedStateName(externalStateName);
  }, [externalStateName]);

  useEffect(() => {
    if (externalCityIbgeId !== undefined) setSelectedCityIbgeId(externalCityIbgeId);
  }, [externalCityIbgeId]);

  useEffect(() => {
    if (externalCityName !== undefined) setSelectedCityName(externalCityName);
  }, [externalCityName]);

  useEffect(() => {
    if (externalBairroName !== undefined) {
      setSelectedBairroName(externalBairroName);
      if (externalBairroName) {
        setIsPanelOpen(true); // Abre o menu do mapa para feedback visual
      }
    }
  }, [externalBairroName]);

  useEffect(() => {
    if (externalDistrictId !== undefined) setSelectedDistrictId(externalDistrictId);
  }, [externalDistrictId]);

  useEffect(() => {
    if (externalRuaName !== undefined) setSelectedRuaName(externalRuaName);
  }, [externalRuaName]);

  // Load States initially when panel is open
  useEffect(() => {
    const loadStates = async () => {
      setLoadingStates(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch('https://api.brasilaberto.com/v1/states', { headers });
        if (response.ok) {
          const res = await response.json();
          if (res && res.result) {
            setBrasilStates(res.result);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar estados no mapa:", err);
      } finally {
        setLoadingStates(false);
      }
    };
    if (isPanelOpen) {
      loadStates();
    }
  }, [isPanelOpen]);

  // Load Cities when state selected changes
  useEffect(() => {
    if (!selectedStateShortName) {
      setBrasilCities([]);
      return;
    }
    const loadCities = async () => {
      setLoadingCities(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`https://api.brasilaberto.com/v1/cities/${selectedStateShortName}`, { headers });
        if (response.ok) {
          const res = await response.json();
          if (res && res.result) {
            setBrasilCities(res.result);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar cidades no mapa:", err);
      } finally {
        setLoadingCities(false);
      }
    };
    loadCities();
  }, [selectedStateShortName]);

  // Load Districts when city selected changes
  useEffect(() => {
    if (!selectedCityIbgeId) {
      setBrasilDistricts([]);
      return;
    }
    const loadDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`https://api.brasilaberto.com/v1/districts-by-ibge-code/${selectedCityIbgeId}`, { headers });
        if (response.ok) {
          const res = await response.json();
          if (res && res.result) {
            setBrasilDistricts(res.result);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar bairros no mapa:", err);
      } finally {
        setLoadingDistricts(false);
      }
    };
    loadDistricts();
  }, [selectedCityIbgeId]);

  // Load Streets when district selected changes.
  // Duas fontes: a base de CEP (rápida, porém incompleta em cidades que usam CEP
  // geral) e o OpenStreetMap (as ruas que o usuário está vendo no mapa). A lista
  // de CEP aparece assim que chega e as ruas do mapa entram nela quando o
  // Overpass responde, sem repetir nenhuma rua.
  useEffect(() => {
    if (!selectedDistrictId) {
      setBrasilStreets([]);
      setLoadingOsmStreets(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const bairro = selectedBairroName || '';
    const city = selectedCityName || '';
    const state = selectedStateShortName || '';

    setLoadingStreets(true);
    setLoadingOsmStreets(true);

    (async () => {
      const cepRequest = fetchCepStreets(selectedDistrictId, controller.signal);
      const osmRequest = fetchOsmStreets(bairro, city, state, controller.signal);

      const cepStreets = await cepRequest;
      if (!active) return;
      setBrasilStreets(mergeStreetLists([cepStreets]));
      setLoadingStreets(false);

      const osmStreets = await osmRequest;
      if (!active) return;
      setBrasilStreets(mergeStreetLists([cepStreets, osmStreets]));
      setLoadingOsmStreets(false);
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedDistrictId, selectedBairroName, selectedCityName, selectedStateShortName]);

  // Geocode address using OpenStreetMap Nominatim with multi-stage fallback strategy
  /** Desenha o traçado exato da rua sobre o mapa. */
  const drawStreetLines = (lines: [number, number][][], label: string) => {
    const tooltipHtml = `
      <div class="px-2.5 py-1 font-sans text-xs">
        <span class="font-bold text-indigo-600">🛣️ Rua Delimitada:</span>
        <p class="font-semibold text-slate-850 mt-0.5">${label}</p>
      </div>
    `;

    lines.forEach((latlngs) => {
      const glowLine = L.polyline(latlngs, { color: '#3b82f6', weight: 12, opacity: 0.35 });
      const mainLine = L.polyline(latlngs, { color: '#4f46e5', weight: 5, opacity: 0.95 });

      glowLine.bindTooltip(tooltipHtml, { sticky: true });
      mainLine.bindTooltip(tooltipHtml, { sticky: true });

      delimitationGroupRef.current?.addLayer(glowLine);
      delimitationGroupRef.current?.addLayer(mainLine);
    });
  };

  const geocodeAddress = async (street: string | null, bair: string, city: string, state: string) => {
    // Clear any previous delimitation
    delimitationGroupRef.current?.clearLayers();

    // Caixa do bairro escolhido. Tudo que for procurado a partir daqui fica
    // preso a ela: é o que impede o resultado de cair em outro bairro.
    const area = bair && bair.trim()
      ? await fetchNeighborhoodArea(bair, city, state)
      : null;
    const allowedBox = area ? expandBox(area.box, 0.005) : null;

    // Caminho preciso: procura a rua pela geometria real do OpenStreetMap,
    // por nome exato e dentro do bairro. Quando encontra, o marcador e a
    // demarcação vêm da mesma fonte, então não há como um apontar para uma rua
    // e o outro para outra.
    if (street && street.trim() && area) {
      const geometry = await fetchStreetGeometry(street, area.box);
      if (geometry) {
        const { lat, lng } = geometry.center;
        mapRef.current?.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
        setSearchMarkerCoords({ lat, lng, name: `${geometry.name}, ${bair}` });
        drawStreetLines(geometry.lines, `${geometry.name}, ${bair}`);
        return { lat, lng };
      }
    }

    const queries: string[] = [];
    if (street && street.trim()) {
      queries.push(`${street}, ${bair}, ${city}, ${state}, Brasil`);
      queries.push(`${street}, ${city}, ${state}, Brasil`);

      // Try clean street names if they have common prefixes
      const cleanStreet = street.replace(/^(Rua|Avenida|Av\.|Travessa|Al\.|Alameda|Rodovia|Rod\.)\s+/i, '');
      if (cleanStreet !== street) {
        queries.push(`${cleanStreet}, ${bair}, ${city}, ${state}, Brasil`);
        queries.push(`${cleanStreet}, ${city}, ${state}, Brasil`);
      }
    }

    // Quantas consultas acima são de rua. Um acerto de rua precisa cair dentro
    // do bairro; um acerto de bairro ou município, não.
    const streetQueryCount = queries.length;

    if (bair && bair.trim()) {
      queries.push(`${bair}, ${city}, ${state}, Brasil`);
    }
    queries.push(`${city}, ${state}, Brasil`);

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&polygon_geojson=1`
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const item = data[0];
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);

            // Uma rua encontrada fora do bairro escolhido é uma homônima de
            // outro lugar, não a rua pedida. Descarta e tenta a próxima
            // consulta, em vez de marcar o ponto errado.
            const isStreetQuery = i < streetQueryCount;
            if (isStreetQuery && allowedBox && !isInsideBox(allowedBox, lat, lng)) {
              continue;
            }

            const isExactMatch = isStreetQuery;
            
            // Fly map to exact or neighborhood center
            mapRef.current?.flyTo([lat, lng], isExactMatch ? 16 : 14, {
              animate: true,
              duration: 1.2
            });
            
            // Só cita a rua quando o acerto foi de rua. Cair no centro do
            // bairro e ainda assim rotular "Rua X" faria o sistema afirmar uma
            // localização que ele não encontrou.
            setSearchMarkerCoords({
              lat,
              lng,
              name: isStreetQuery && street ? `${street}, ${bair}` : bair
            });

            // Traçado da rua, buscado por nome exato e restrito à vizinhança do
            // ponto encontrado. Sem essa restrição de nome, procurar "Rua B"
            // acabava desenhando qualquer rua com "b" no nome por perto.
            // Quando o bairro foi localizado, o caminho preciso lá em cima já
            // procurou o traçado; aqui só resta o caso em que ele não rodou.
            if (street && street.trim() && !area) {
              const searchBox = expandBox(
                { south: lat, west: lng, north: lat, east: lng },
                0.02,
              );
              (async () => {
                const geometry = await fetchStreetGeometry(street, searchBox);
                if (geometry) {
                  drawStreetLines(geometry.lines, `${geometry.name}, ${bair}`);
                }
              })();
            }

            // Draw visual delimitation overlay (ruas e bairros)
            if (item.geojson && (item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon' || item.geojson.type === 'LineString' || item.geojson.type === 'MultiLineString')) {
              try {
                const geojsonLayer = L.geoJSON(item.geojson, {
                  style: {
                    color: '#4f46e5', // Vibrant indigo
                    weight: 4,
                    opacity: 0.85,
                    dashArray: item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon' ? '6, 6' : undefined,
                    fillColor: '#818cf8',
                    fillOpacity: 0.15,
                  }
                });

                // Bind a nice tooltip detailing the delimited area
                geojsonLayer.bindTooltip(`
                  <div class="px-2.5 py-1 font-sans text-xs">
                    <span class="font-bold text-indigo-600">📍 Limites de:</span>
                    <p class="font-semibold text-slate-850 mt-0.5">${street ? `${street}, ${bair}` : bair}</p>
                  </div>
                `, { sticky: true });

                delimitationGroupRef.current?.addLayer(geojsonLayer);
              } catch (err) {
                console.warn('Erro ao desenhar polígono GeoJSON:', err);
              }
            } else if (item.boundingbox) {
              // Bounding box fallback delimitation
              try {
                const bounds = L.latLngBounds(
                  [parseFloat(item.boundingbox[0]), parseFloat(item.boundingbox[2])],
                  [parseFloat(item.boundingbox[1]), parseFloat(item.boundingbox[3])]
                );
                
                // Draw a beautiful rectangle to define the outline limits
                const rect = L.rectangle(bounds, {
                  color: '#4f46e5',
                  weight: 3,
                  dashArray: '5, 5',
                  fillColor: '#818cf8',
                  fillOpacity: 0.12,
                });

                rect.bindTooltip(`
                  <div class="px-2.5 py-1 font-sans text-xs">
                    <span class="font-bold text-indigo-600">📍 Delimitação aproximada:</span>
                    <p class="font-semibold text-slate-850 mt-0.5">${street ? `${street}, ${bair}` : bair}</p>
                  </div>
                `, { sticky: true });

                delimitationGroupRef.current?.addLayer(rect);
              } catch (err) {
                console.warn('Erro ao desenhar boundingbox:', err);
              }
            }
            
            return { lat, lng };
          }
        }
      } catch (err) {
        console.warn(`Erro no geocoder do mapa tentativa ${i + 1} ("${q}"):`, err);
        const errMsg = String(err).toLowerCase();
        if (errMsg.includes('failed to fetch') || errMsg.includes('networkerror') || errMsg.includes('cors')) {
          break;
        }
      }
    }
    return null;
  };

  // Handle search result marker on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    // We no longer draw the blue magnifying glass pin/marker on the map,
    // so only the visual bounding block/street lines are drawn.

    return () => {
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }
    };
  }, [searchMarkerCoords]);

  // Filtering lists for dropdowns
  const filteredStates = brasilStates.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.shortName.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const filteredCities = brasilCities.filter(c =>
    c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  const districtsToUse = selectedStateShortName === 'AL' && selectedCityName === 'Maceió' && brasilDistricts.length === 0
    ? NEIGHBORHOOD_DATA.map((b, idx) => ({ id: idx + 1000, name: b.name }))
    : brasilDistricts;

  const filteredDistricts = districtsToUse.filter(d =>
    d.name.toLowerCase().includes(bairroSearch.toLowerCase())
  );

  const filteredStreets = brasilStreets.filter(s =>
    s.name.toLowerCase().includes(ruaSearch.toLowerCase())
  );

  const handleStateSelect = (stateShort: string, stateName: string) => {
    setSelectedStateShortName(stateShort);
    setSelectedStateName(stateName);
    setSelectedCityIbgeId(null);
    setSelectedCityName(null);
    setSelectedBairroName(null);
    setSelectedDistrictId(null);
    setSelectedRuaName(null);
    setSelectedStreetId(null);
    setCitySearch('');
    setBairroSearch('');
    setRuaSearch('');
    setOpenStateDropdown(false);

    if (onExternalStateChange) onExternalStateChange(stateShort, stateName);
  };

  const handleCitySelect = (ibgeId: number, cityName: string) => {
    setSelectedCityIbgeId(ibgeId);
    setSelectedCityName(cityName);
    setSelectedBairroName(null);
    setSelectedDistrictId(null);
    setSelectedRuaName(null);
    setSelectedStreetId(null);
    setBairroSearch('');
    setRuaSearch('');
    setOpenCityDropdown(false);

    if (onExternalCityChange) onExternalCityChange(ibgeId, cityName);
  };

  const handleBairroSelect = async (bairroName: string, districtId: number) => {
    setSelectedBairroName(bairroName);
    setSelectedDistrictId(districtId);
    setSelectedRuaName(null);
    setSelectedStreetId(null);
    setRuaSearch('');
    setOpenBairroDropdown(false);

    if (onExternalBairroChange) onExternalBairroChange(bairroName);
    if (onExternalDistrictIdChange) onExternalDistrictIdChange(districtId);
    if (onExternalRuaChange) onExternalRuaChange(null, 0, 0);

    const city = selectedCityName || 'Maceió';
    const state = selectedStateShortName || 'AL';
    await geocodeAddress(null, bairroName, city, state);
  };

  const handleRuaSelect = async (ruaSelectedName: string, streetId?: number) => {
    setSelectedRuaName(ruaSelectedName);
    if (streetId) setSelectedStreetId(streetId);
    setOpenRuaDropdown(false);

    const bName = selectedBairroName || '';
    const cName = selectedCityName || 'Maceió';
    const sName = selectedStateShortName || 'AL';
    const coords = await geocodeAddress(ruaSelectedName, bName, cName, sName);

    if (onExternalRuaChange) {
      if (coords) {
        onExternalRuaChange(ruaSelectedName, coords.lat, coords.lng);
      } else {
        onExternalRuaChange(ruaSelectedName, 0, 0);
      }
    }
  };

  const handleClearSelection = () => {
    // Limpar devolve ao ponto de partida do candidato, não a um lugar fixo.
    const fallback = defaultLocation ?? {
      uf: 'AL',
      stateName: 'Alagoas',
      cityIbgeId: 2704302,
      cityName: 'Maceió',
    };

    setSelectedStateShortName(fallback.uf);
    setSelectedStateName(fallback.stateName);
    setSelectedCityIbgeId(fallback.cityIbgeId);
    setSelectedCityName(fallback.cityName);
    setSelectedBairroName(null);
    setSelectedDistrictId(null);
    setSelectedRuaName(null);
    setSelectedStreetId(null);
    setBairroSearch('');
    setRuaSearch('');
    setStateSearch('');
    setCitySearch('');
    setOpenStateDropdown(false);
    setOpenCityDropdown(false);
    setOpenBairroDropdown(false);
    setOpenRuaDropdown(false);
    setSearchMarkerCoords(null);
    delimitationGroupRef.current?.clearLayers();

    if (onExternalStateChange) onExternalStateChange(fallback.uf, fallback.stateName);
    if (onExternalCityChange) onExternalCityChange(fallback.cityIbgeId, fallback.cityName);
    if (onExternalBairroChange) onExternalBairroChange(null);
    if (onExternalDistrictIdChange) onExternalDistrictIdChange(null);
    if (onExternalRuaChange) onExternalRuaChange(null, 0, 0);
  };

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Maceió approximate coordinates
    const maceioCoords: L.LatLngTuple = [-9.6548, -35.715];

    const map = L.map(containerRef.current, {
      center: maceioCoords,
      zoom: 13,
      zoomControl: false, // Add premium styled zoom in custom location later
      attributionControl: false
    });

    // OpenStreetMap standard tiles: no API key required and free to use
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Custom Zoom control at bottom right for a professional layout
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initialize overlay groups
    const circlesGroup = L.layerGroup().addTo(map);
    const pinsGroup = L.layerGroup().addTo(map);
    const tempGroup = L.layerGroup().addTo(map);
    const checkInsGroup = L.layerGroup().addTo(map);
    const escolasGroup = L.layerGroup().addTo(map);
    const lojasGroup = L.layerGroup().addTo(map);
    const delimitationGroup = L.layerGroup().addTo(map);

    circlesGroupRef.current = circlesGroup;
    pinsGroupRef.current = pinsGroup;
    tempGroupRef.current = tempGroup;
    checkInsGroupRef.current = checkInsGroup;
    escolasGroupRef.current = escolasGroup;
    lojasGroupRef.current = lojasGroup;
    delimitationGroupRef.current = delimitationGroup;
    mapRef.current = map;

    // Listeners for map coordinate picking
    map.on('click', (e: L.LeafletMouseEvent) => {
      setOpenBairroDropdown(false);
      setOpenRuaDropdown(false);
      if (reguaAtivaRef.current) {
        // Com a régua ligada o clique é dela: o mesmo toque não pode marcar
        // ponto e escolher coordenada ao mesmo tempo.
        onRulerPointRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      // Fora do modo de escolha, clicar no mapa não move nada. Sem esta
      // guarda qualquer clique — o fim de um arrasto, o par de cliques de um
      // duplo-clique de zoom, um toque na borda do círculo — reposicionava o
      // ponto que estava sendo criado e ainda arrastava o mapa atrás dele.
      if (!pegandoCoordenadaRef.current) return;
      // Um arrasto de raio acabou de acontecer: o clique que o navegador
      // dispara em seguida é resto do gesto, não uma escolha nova.
      if (arrastandoRaioRef.current) return;
      aoEscolherCoordenadaRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle container resizing to invalidate size and redraw maps flawlessly
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
    };
  }, []);

  // Update interactivity cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (clickToPickCoords) {
      L.DomUtil.addClass(map.getContainer(), 'pointer-cursor');
      map.getContainer().style.cursor = 'crosshair';
    } else {
      L.DomUtil.removeClass(map.getContainer(), 'pointer-cursor');
      map.getContainer().style.cursor = '';
    }
  }, [clickToPickCoords]);

  /** Formata a distância como se lê em campo: metros até 1 km, depois km. */
  const medida = (metros: number) =>
    metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(2)} km`;

  /**
   * Desenha a medição em andamento.
   *
   * A linha branca por baixo é o que mantém a medição legível tanto sobre
   * telhado claro quanto sobre mata escura.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // A camada é reposta a cada desenho: o mapa é recriado quando o cliente
    // muda, e uma camada presa ao mapa antigo não aparece em lugar nenhum.
    if (!reguaGroupRef.current) reguaGroupRef.current = L.layerGroup();
    const camada = reguaGroupRef.current;
    if (!map.hasLayer(camada)) camada.addTo(map);
    camada.clearLayers();

    const desenhar = (pontos: { lat: number; lng: number }[], cor: string) => {
      if (pontos.length === 0) return;
      const caminho = pontos.map(p => L.latLng(p.lat, p.lng));

      if (caminho.length > 1) {
        L.polyline(caminho, { color: '#ffffff', weight: 6, opacity: 0.9 }).addTo(camada);
        L.polyline(caminho, { color: cor, weight: 3 }).addTo(camada);
      }

      let acumulado = 0;
      caminho.forEach((ponto, i) => {
        if (i > 0) acumulado += map.distance(caminho[i - 1], ponto);
        L.marker(ponto, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: '',
            html:
              `<span style="display:block;width:12px;height:12px;border-radius:50%;` +
              `background:${cor};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          })
        }).addTo(camada);

        if (i > 0) {
          const texto = medida(acumulado);
          L.marker(ponto, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: '',
              html:
                '<span style="white-space:nowrap;transform:translate(10px,-50%);display:inline-block;' +
                `background:${cor};color:#fff;font:700 10px/1 ui-sans-serif,system-ui;` +
                'padding:4px 6px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.3)">' +
                texto +
                '</span>',
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            })
          }).addTo(camada);
        }
      });
    };

    if (rulerPoints.length > 0) desenhar(rulerPoints, rulerColor);
  }, [rulerPoints, rulerColor]);

  // Se mudar o candidato, ativa o loader imediatamente para não piscar no mapa antigo
  useEffect(() => {
    if (selectedCandidateId && selectedCandidateId !== 'all') {
      setIsMapLoading(true);
    }
  }, [selectedCandidateId]);

  // Shift map view or center based on selected candidate's city / data points
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCandidateId || selectedCandidateId === 'all') {
      setIsMapLoading(false);
      return;
    }

    const cand = candidates?.find(c => c.id === selectedCandidateId);
    if (!cand) {
      setIsMapLoading(false);
      return;
    }

    /**
     * O enquadramento automático acontece uma vez por cliente.
     *
     * Este efeito também observa áreas, pontos e check-ins, e essas listas
     * chegam recriadas a cada render da tela de cima. Sem esta trava, digitar
     * um raio, mexer o mouse ou receber um aviso refazia o fitBounds e
     * devolvia o mapa ao enquadramento inicial — era isso que desfazia o zoom
     * de quem estava trabalhando.
     */
    if (ultimoEnquadradoRef.current === selectedCandidateId) {
      setIsMapLoading(false);
      return;
    }
    ultimoEnquadradoRef.current = selectedCandidateId;

    let active = true;

    // Phase 1: Try shifting based on candidate's own mapped coordinates (using their pins, areas, checkins)
    const candPoints: L.LatLng[] = [];
    areas.forEach(a => {
      if (a.candidateId === selectedCandidateId && a.active) {
        candPoints.push(L.latLng(a.center.lat, a.center.lng));
      }
    });

    pins.forEach(p => {
      if (p.candidateId === selectedCandidateId && p.active) {
        candPoints.push(L.latLng(p.position.lat, p.position.lng));
      }
    });

    if (checkIns) {
      checkIns.forEach(c => {
        if (c.candidateId === selectedCandidateId && c.coordinates) {
          candPoints.push(L.latLng(c.coordinates.lat, c.coordinates.lng));
        }
      });
    }

    if (candPoints.length > 0) {
      // Fit map bounds to encompass those coordinates nicely
      try {
        const bounds = L.latLngBounds(candPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true, duration: 1.5 });
        
        const timer = setTimeout(() => {
          if (active) setIsMapLoading(false);
        }, 1200);

        return () => {
          active = false;
          clearTimeout(timer);
        };
      } catch (err) {
        console.warn("Could not fit candidate bounds, falling back:", err);
        setIsMapLoading(false);
      }
    }

    // Phase 2: If there's no mapped elements yet, geocode the candidate's city / state
    const candidateLocation = candidateLocationText(cand);
    if (candidateLocation) {
      const cityQuery = candidateLocation.trim();
      
      // Se for Maceió, centralizar instantaneamente reduzindo latência e evitando erros de rede
      if (cityQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("maceio")) {
        map.flyTo([-9.6658, -35.7350], 12, { animate: true, duration: 1.5 });
        setTimeout(() => {
          if (active) setIsMapLoading(false);
        }, 1500);
        return () => {
          active = false;
        };
      }

      const query = cityQuery.toLowerCase().includes('brasil') ? cityQuery : `${cityQuery}, Brasil`;

      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Geocoding failed");
        })
        .then(data => {
          if (!active) return;
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            map.flyTo([lat, lng], 12, { animate: true, duration: 1.5 });
            
            // Wait for fly animation to settle
            setTimeout(() => {
              if (active) setIsMapLoading(false);
            }, 1500);
          } else {
            setIsMapLoading(false);
          }
        })
        .catch(err => {
          console.log("Status do geocode da cidade sugerida (recuperação silenciosa):", err?.message || err);
          if (active) setIsMapLoading(false);
        });

      return () => {
        active = false;
      };
    } else {
      setIsMapLoading(false);
    }
  }, [selectedCandidateId, candidates, areas, pins, checkIns]);

  // Center on newly selected item
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;

    // Search inside areas first
    const selectedArea = areas.find(a => a.id === selectedId);
    if (selectedArea && selectedArea.active) {
      map.setView([selectedArea.center.lat, selectedArea.center.lng], 14, { animate: true });
      return;
    }

    // Search in pins
    const selectedPin = pins.find(p => p.id === selectedId);
    if (selectedPin && selectedPin.active) {
      map.setView([selectedPin.position.lat, selectedPin.position.lng], 15, { animate: true });
      return;
    }

    // Search in check-ins
    if (checkIns) {
      const selectedCheckIn = checkIns.find(c => c.id === selectedId);
      if (selectedCheckIn) {
        map.setView([selectedCheckIn.coordinates.lat, selectedCheckIn.coordinates.lng], 16, { animate: true });
      }
    }
  }, [selectedId, areas, pins, checkIns]);

  // Render Areas (Circles)
  useEffect(() => {
    const circlesGroup = circlesGroupRef.current;
    const map = mapRef.current;
    if (!circlesGroup || !map) return;

    circlesGroup.clearLayers();

    if (mapFilter === 'checkins' || mapFilter === 'favoritos') {
      return;
    }

    areas.forEach(area => {
      if (!area.active) return;

      const isSelected = area.id === selectedId;

      // Draw Radius Circle
      const circle = L.circle([area.center.lat, area.center.lng], {
        radius: area.radius,
        color: area.color,
        weight: isSelected ? 4 : 2,
        opacity: 0.85,
        fillColor: area.color,
        fillOpacity: isSelected ? 0.35 : 0.20,
        className: 'transition-all duration-300'
      });

      // Simple click handler
      circle.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectItem(area.id, 'area');
      });

      // Add a small center point marker to make it clickable and visible
      const centerMarker = L.circleMarker([area.center.lat, area.center.lng], {
        radius: isSelected ? 8 : 5,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillColor: area.color,
        fillOpacity: 1
      });

      centerMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectItem(area.id, 'area');
      });

      // Tooltip/Label on circle hover
      circle.bindTooltip(`
        <div class="px-2 py-1 font-sans text-xs">
          <p class="font-bold text-gray-900">${area.title}</p>
          <p class="text-gray-500">Unidade: ${area.bairro}</p>
          <p class="text-gray-600">Raio: ${area.radius}m</p>
          ${area.teamSize ? `<p class="text-blue-600 font-semibold mt-0.5">Equipe: ${area.teamSize} pessoas</p>` : ''}
        </div>
      `, {
        permanent: false,
        direction: 'top',
        opacity: 0.95
      });

      // Add to group
      circlesGroup.addLayer(circle);
      circlesGroup.addLayer(centerMarker);
    });
  }, [areas, selectedId, mapFilter]);

  // Render Pins
  useEffect(() => {
    const pinsGroup = pinsGroupRef.current;
    const map = mapRef.current;
    if (!pinsGroup || !map) return;

    pinsGroup.clearLayers();

    if (mapFilter === 'checkins' || mapFilter === 'favoritos') {
      return;
    }

    pins.forEach(pin => {
      if (!pin.active) return;

      const isSelected = pin.id === selectedId;
      // pin.iconType guarda o id do Tipo de Operação; o desenho vem do tipo.
      // Se o tipo foi apagado, o próprio id ainda serve de chave de ícone
      // (é o caso dos pontos antigos, cujo id já era 'flag', 'star'...).
      const operationType = operationTypes.find(t => t.id === pin.iconType);
      const customIcon = getCustomPinIcon(pin.color, operationType?.icon || pin.iconType, isSelected);

      const marker = L.marker([pin.position.lat, pin.position.lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : 0
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectItem(pin.id, 'pin');
      });

      const dateText = pin.date ? `<p class="text-[10px] text-blue-600 font-bold mt-0.5">📅 ${pin.date.split('-').reverse().join('/')}</p>` : '';
      marker.bindTooltip(`
        <div class="px-2 py-1 font-sans text-xs">
          <p class="font-bold text-gray-900">${pin.title}</p>
          <p class="text-gray-500">${pin.description || 'Ponto de Campanha'}</p>
          ${dateText}
        </div>
      `, {
        permanent: false,
        direction: 'top',
        offset: [0, -10]
      });

      pinsGroup.addLayer(marker);
    });
  }, [pins, selectedId, mapFilter, operationTypes]);

  // Render Check-ins
  useEffect(() => {
    const checkInsGroup = checkInsGroupRef.current;
    const map = mapRef.current;
    if (!checkInsGroup || !map) return;

    checkInsGroup.clearLayers();

    if (mapFilter === 'markers') {
      return;
    }

    if (!checkIns) return;

    const visiveis =
      mapFilter === 'favoritos' ? checkIns.filter(c => c.favorite) : checkIns;

    visiveis.forEach(checkIn => {
      // Check-in por missão usa o bonequinho verde de sempre. O check-in livre
      // vira um alerta pintado com a cor do grau de prioridade informado.
      const isFree = checkIn.mode === 'livre';
      const nivel = (priorityLevels || []).find(n => n.id === checkIn.priority);
      const priority = nivel
        ? { label: nivel.label, color: nivel.color }
        : getCheckInPriority(checkIn.priority);
      const markerColor = isFree ? (priority?.color || '#f97316') : '#10b981';
      const markerIcon = isFree
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
            <path d="M12 9v4"/>
            <path d="M12 17h.01"/>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>`;

      const avatarHtml = `
        <div style="
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: ${markerColor};
          border: 3px solid white;
          box-shadow: 0 4px 10px ${markerColor}66;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all 0.2s ease;
        ">
          ${markerIcon}
        </div>
      `;

      // Estrela no canto: o favorito se acha no meio dos outros marcadores.
      const estrelaHtml = checkIn.favorite
        ? `<span style="position:absolute;top:-2px;right:-2px;width:18px;height:18px;border-radius:50%;
             background:#F59E0B;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);
             display:flex;align-items:center;justify-content:center;">
             <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
           </span>`
        : '';

      const checkInIcon = L.divIcon({
        className: 'custom-div-icon drop-shadow-md',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
            ${avatarHtml}
            ${estrelaHtml}
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([checkIn.coordinates.lat, checkIn.coordinates.lng], { icon: checkInIcon });

      const dateText = new Date(checkIn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date(checkIn.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' });

      const media = checkIn.media && checkIn.media.length > 0
        ? checkIn.media
        : checkIn.photo
          ? [{ url: checkIn.photo, type: 'image' as const }]
          : [];
      const coverImage = media.find(m => m.type === 'image');
      const videoCount = media.filter(m => m.type === 'video').length;

      const countHtml = media.length > 1
        ? `<p class="text-[9px] text-slate-500 font-bold mt-1">📎 ${media.length} arquivos${videoCount > 0 ? ` • ${videoCount} vídeo${videoCount > 1 ? 's' : ''}` : ''}</p>`
        : videoCount > 0
          ? `<p class="text-[9px] text-slate-500 font-bold mt-1">🎬 Vídeo anexado</p>`
          : '';

      const photoHtml = coverImage ? `
        <div class="mt-2 rounded-lg overflow-hidden border border-slate-100 max-w-[150px] max-h-[100px] shadow-2xs">
          <img src="${coverImage.url}" class="w-full h-full object-cover animate-in fade-in duration-300" />
        </div>
      ` : '';

      const headerHtml = isFree
        ? `<p class="font-extrabold uppercase tracking-wider text-[9px] mb-0.5" style="color:${markerColor}">⚠️ Check-in Livre${priority ? ` • Prioridade ${priority.label}` : ''}</p>`
        : `<p class="font-extrabold text-emerald-600 uppercase tracking-wider text-[9px] mb-0.5">✅ Check-in de Voluntário</p>`;

      marker.bindTooltip(`
        <div class="px-2.5 py-2 font-sans text-xs min-w-[160px]">
          ${headerHtml}
          <p class="font-bold text-slate-900 text-sm">${checkIn.name}</p>
          <p class="text-[10px] text-slate-500 font-semibold mt-0.5">📍 ${checkIn.rua}, ${checkIn.bairro}</p>
          <p class="text-[9px] text-slate-400 mt-1 font-medium bg-slate-50 border border-slate-100 p-1 rounded inline-block">🕒 ${dateText}</p>
          ${countHtml}
          <p class="text-[8px] text-slate-400 font-bold uppercase mt-1">💡 Clique para ver detalhes</p>
          ${photoHtml}
        </div>
      `, {
        permanent: false,
        direction: 'top',
        offset: [0, -10]
      });

      // Evento de clique para mostrar todas as informações no meio da tela
      marker.on('click', () => {
        setSelectedCheckInForModal(checkIn);
      });

      checkInsGroup.addLayer(marker);
    });
  }, [checkIns, mapFilter]);

  /**
   * Estabelecimentos da pesquisa.
   *
   * Eles não são pontos da campanha: são referência do terreno, então saem
   * num marcador diferente — uma pastilha branca com a inicial — para não se
   * confundir com pino, área ou check-in. O que está em foco cresce e ganha
   * anel, que é como a lista e o mapa conversam.
   */
  useEffect(() => {
    const grupo = lojasGroupRef.current;
    const map = mapRef.current;
    if (!grupo || !map) return;

    grupo.clearLayers();
    lojasPorIdRef.current = {};

    (estabelecimentos || []).forEach(lugar => {
      if (typeof lugar.latitude !== 'number' || typeof lugar.longitude !== 'number') return;
      const emFoco = estabelecimentoEmFoco === lugar.id;
      const tamanho = emFoco ? 42 : 34;

      /**
       * O mesmo pino de localização do resto do mapa — gota branca com a
       * borda colorida e a bolinha da base. O que muda é a cor: roxo é a
       * pesquisa, então dá para ver num relance o que é da campanha e o que
       * veio de fora, sem inventar um símbolo novo para quem olha.
       */
      const marcador = L.marker([lugar.latitude, lugar.longitude], {
        icon: L.divIcon({
          className: `custom-div-icon ${emFoco ? 'drop-shadow-lg' : 'drop-shadow-md'}`,
          html: `
            <div style="display:flex;align-items:center;justify-content:center;
              width:${tamanho}px;height:${tamanho}px;background:#fff;
              border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              border:${emFoco ? 4 : 3}px solid #7C3AED;position:relative;
              ${emFoco ? 'box-shadow:0 0 0 6px rgba(124,58,237,.18);' : ''}">
              <div style="transform:rotate(45deg);display:flex;align-items:center;
                justify-content:center;color:#7C3AED;width:20px;height:20px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
                  stroke-linejoin="round" width="${emFoco ? 17 : 15}" height="${emFoco ? 17 : 15}">
                  <path d="m2 7 1.5-4h17L22 7"/><path d="M4 7v13h16V7"/>
                  <path d="M2 7a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2"/>
                  <path d="M9 20v-6h6v6"/>
                </svg>
              </div>
            </div>
            <div style="width:10px;height:10px;background:#7C3AED;border-radius:50%;
              position:absolute;top:${tamanho - 5}px;left:${tamanho / 2 - 5}px;
              box-shadow:0 2px 4px rgba(0,0,0,.2);border:1px solid #fff;"></div>
          `,
          iconSize: [tamanho, tamanho + 10],
          iconAnchor: [tamanho / 2, tamanho + 8]
        }),
        zIndexOffset: emFoco ? 1000 : 0
      });

      // Só o nome no passar do mouse: a ficha inteira é do clique, senão a
      // tela vira um cartaz cada vez que o cursor atravessa o mapa.
      marcador.bindTooltip(
        `<div class="px-2.5 py-1.5 font-sans">
           <p class="font-bold text-slate-900 text-[12px] leading-tight">${lugar.nome}</p>
           ${lugar.categoria ? `<p class="text-[10px] text-violet-600 font-bold">${lugar.categoria}</p>` : ''}
           <p class="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Clique para ver a ficha</p>
         </div>`,
        { direction: 'top', offset: [0, -tamanho] }
      );

      marcador.on('click', () => onEstabelecimentoSelecionado?.(lugar.id));

      grupo.addLayer(marcador);
      lojasPorIdRef.current[lugar.id] = marcador;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estabelecimentos, estabelecimentoEmFoco]);

  // O escolhido na lista chama o mapa até ele, sem mudar o zoom de quem está
  // olhando de perto.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !estabelecimentoEmFoco) return;
    const lugar = (estabelecimentos || []).find(e => e.id === estabelecimentoEmFoco);
    if (!lugar) return;
    map.setView([lugar.latitude, lugar.longitude], Math.max(map.getZoom(), 16), {
      animate: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estabelecimentoEmFoco]);

  // Entrega para cima a leitura do centro e do zoom de agora: é o que a
  // pesquisa por área precisa saber, e só o mapa sabe.
  useEffect(() => {
    if (!aoRegistrarVista) return;
    aoRegistrarVista(() => {
      const map = mapRef.current;
      if (!map) return null;
      const centro = map.getCenter();
      return { lat: centro.lat, lng: centro.lng, zoom: map.getZoom() };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoRegistrarVista]);

  // Camada de escolas do municipio: so desenha quando ligada no dock.
  useEffect(() => {
    const grupo = escolasGroupRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    if (!escolasVisiveis || !escolas || escolas.length === 0) {
      camadaEscolasLigadaRef.current = false;
      return;
    }

    escolas.forEach(escola => {
      if (!Number.isFinite(escola.latitude) || !Number.isFinite(escola.longitude)) return;
      const cor = corDaDependencia(escola.dependencia);
      const parada = escola.situacao ? escola.situacao !== 'EM ATIVIDADE' : false;

      // O tamanho conta a historia do porte da escola sem precisar de rotulo.
      const alunos = escola.matriculas || 0;
      const tamanho = alunos >= 1000 ? 38 : alunos >= 400 ? 32 : 26;

      const icone = L.divIcon({
        className: '',
        html:
          `<span style="display:flex;align-items:center;justify-content:center;` +
          `width:${tamanho}px;height:${tamanho}px;border-radius:50%;background:${cor};` +
          `border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);` +
          `${parada ? 'opacity:.45;' : ''}">` +
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" ` +
          `stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ` +
          `width="${Math.round(tamanho * 0.5)}" height="${Math.round(tamanho * 0.5)}">` +
          '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/>' +
          '<path d="M6 12v5c3 3 9 3 12 0v-5"/>' +
          '</svg></span>',
        iconSize: [tamanho, tamanho],
        iconAnchor: [tamanho / 2, tamanho / 2]
      });

      const marcador = L.marker([escola.latitude, escola.longitude], { icon: icone });
      marcador.bindTooltip(
        `<b>${escola.nome}</b><br>${escola.dependencia || ''}` +
          (escola.matriculas ? ` &middot; ${escola.matriculas} alunos` : ''),
        { direction: 'top', offset: [0, -tamanho / 2] }
      );
      marcador.on('click', evento => {
        // O clique e da escola: nao pode virar marcacao de ponto no mapa.
        L.DomEvent.stopPropagation(evento);
        aoClicarEscolaRef.current?.(escola);
      });
      grupo.addLayer(marcador);
    });

    // Ligar a camada e nao ver nada seria um botao quebrado: o mapa vai onde
    // as escolas estao, mas so no momento em que a camada acende.
    const mapa = mapRef.current;
    if (mapa && !camadaEscolasLigadaRef.current) {
      const pontos = escolas
        .filter(e => Number.isFinite(e.latitude) && Number.isFinite(e.longitude))
        .map(e => [e.latitude, e.longitude] as [number, number]);
      if (pontos.length > 0) {
        mapa.fitBounds(L.latLngBounds(pontos), { padding: [60, 60], maxZoom: 14 });
      }
    }
    camadaEscolasLigadaRef.current = escolasVisiveis;
  }, [escolas, escolasVisiveis]);

  /**
   * Colocar uma área é um gesto só: aperta no centro, arrasta, solta.
   *
   * O modelo antigo pedia um clique para fixar o centro e depois caçar uma
   * bolinha na lateral para abrir o raio — dois movimentos para uma coisa só,
   * e a bolinha some do olho em zoom baixo. Aqui o círculo cresce debaixo do
   * dedo desde o primeiro toque, como qualquer ferramenta de desenho.
   *
   * Um clique seco, sem arrastar, marca só o centro: o raio se abre depois,
   * puxando a borda.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !clickToPickCoords || tempPlacementType !== 'area') return;
    const container = map.getContainer();

    let centro: any = null;
    let previa: any = null;
    let etiqueta: any = null;
    let arrastou = false;

    /** Cliques nos controles do mapa não desenham nada. */
    const noMapaMesmo = (alvo: any) =>
      !(alvo instanceof Element) ||
      !alvo.closest('.leaflet-control, .leaflet-marker-icon, button, input, select, a');

    const limparPrevia = () => {
      if (previa) map.removeLayer(previa);
      if (etiqueta) map.removeLayer(etiqueta);
      previa = null;
      etiqueta = null;
    };

    /**
     * Com a ferramenta armada, o botão esquerdo desenha — então o mapa
     * precisa de outra forma de ser arrastado, ou quem errou o enquadramento
     * fica preso. O botão direito (ou o do meio) passa a arrastar a vista.
     */
    let panDe: { x: number; y: number } | null = null;

    const arrastarMapa = (ev: PointerEvent) => {
      if (!panDe) return;
      map.panBy([panDe.x - ev.clientX, panDe.y - ev.clientY], { animate: false });
      panDe = { x: ev.clientX, y: ev.clientY };
    };

    const semMenu = (ev: Event) => ev.preventDefault();

    const comecar = (ev: PointerEvent) => {
      if (ev.button === 2 || ev.button === 1) {
        panDe = { x: ev.clientX, y: ev.clientY };
        try {
          container.setPointerCapture(ev.pointerId);
        } catch {
          // Sem captura o arrasto ainda funciona pelos avisos da janela.
        }
        return;
      }
      if (ev.button !== 0 || reguaAtivaRef.current || !noMapaMesmo(ev.target)) return;
      centro = map.mouseEventToLatLng(ev as any);
      arrastou = false;
      arrastandoRaioRef.current = true;
      map.dragging.disable();

      previa = L.circle(centro, {
        radius: 0,
        color: tempPlacementColor,
        weight: 2,
        opacity: 0.9,
        dashArray: '5, 5',
        fillColor: tempPlacementColor,
        fillOpacity: 0.15,
        interactive: false
      }).addTo(map);

      etiqueta = L.marker(centro, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: '',
          html:
            '<span style="display:block;width:12px;height:12px;border-radius:50%;' +
            `background:${tempPlacementColor};border:2px solid #fff;` +
            'box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);
      etiqueta.bindTooltip('0 m', {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'medida-raio'
      });

      try {
        container.setPointerCapture(ev.pointerId);
      } catch {
        // Sem captura o gesto ainda funciona pelos avisos da janela.
      }
    };

    const seguir = (ev: PointerEvent) => {
      if (panDe) {
        arrastarMapa(ev);
        return;
      }
      if (!centro || !previa) return;
      const ponto = map.mouseEventToLatLng(ev as any);
      const metros = map.distance(centro, ponto);
      // Tremida de dedo não é arrasto: abaixo de 4 metros ainda é um clique.
      if (metros > 4) arrastou = true;
      previa.setRadius(metros);
      etiqueta?.setTooltipContent(`${Math.round(metros)} m`);
    };

    const soltar = (ev: PointerEvent) => {
      if (panDe) {
        panDe = null;
        return;
      }
      if (!centro) return;
      const ponto = map.mouseEventToLatLng(ev as any);
      const metros = Math.round(map.distance(centro, ponto));
      const destino = centro;

      centro = null;
      limparPrevia();
      map.dragging.enable();
      // O clique que vem logo depois do gesto é resto dele, não escolha nova.
      setTimeout(() => {
        arrastandoRaioRef.current = false;
      }, 0);

      aoEscolherCoordenadaRef.current({ lat: destino.lat, lng: destino.lng });
      if (arrastou && metros > 0) aoMudarRaioRef.current?.(metros);
    };

    const desistir = () => {
      panDe = null;
      if (!centro) return;
      centro = null;
      limparPrevia();
      map.dragging.enable();
      arrastandoRaioRef.current = false;
    };

    container.addEventListener('pointerdown', comecar);
    container.addEventListener('contextmenu', semMenu);
    window.addEventListener('pointermove', seguir);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', desistir);

    return () => {
      container.removeEventListener('pointerdown', comecar);
      container.removeEventListener('contextmenu', semMenu);
      window.removeEventListener('pointermove', seguir);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', desistir);
      desistir();
    };
  }, [clickToPickCoords, tempPlacementType, tempPlacementColor]);

  // Render Temporary Placement Marker (when placing or picking coords)
  useEffect(() => {
    const tempGroup = tempGroupRef.current;
    const map = mapRef.current;
    if (!tempGroup || !map) return;

    tempGroup.clearLayers();
    tempMedidaRef.current = null;
    tempFantasmaRef.current = null;
    limparZoomRef.current?.();
    limparZoomRef.current = null;

    // O ponto que está sendo criado sempre aparece. Antes ele era escondido
    // quando havia bairro ou rua em foco, mas clicar no mapa descobre o
    // endereço do ponto e acende esse foco sozinho: o círculo do raio sumia
    // logo no momento em que precisava ser visto e arrastado.

    tempCircleRef.current = null;
    tempHandleRef.current = null;

    if (tempPlacementCoords) {
      if (tempPlacementType === 'area') {
        const centro = L.latLng(tempPlacementCoords.lat, tempPlacementCoords.lng);

        /**
         * O círculo do raio se comanda sozinho, sem alça pendurada na lateral.
         *
         * Pegar perto da borda muda o tamanho; pegar por dentro leva o ponto
         * inteiro para outro lugar. É a mesma regra de qualquer editor de
         * formas, e dispensa caçar uma bolinha que some em zoom baixo.
         */
        const raioInicial = raioRef.current > 0 ? raioRef.current : 0;

        /**
         * Círculo fantasma do raio zero.
         *
         * Um clique seco marca o centro sem raio, e um círculo de raio zero
         * não tem borda para pegar — a pessoa ficaria com um ponto e nenhum
         * jeito de abrir a área. Então, enquanto o raio é zero, desenhamos um
         * círculo de mentira do tamanho de uns 45 pixels: ele existe só para
         * ser puxado, e o primeiro arrasto grava a medida de verdade.
         */
        const metrosDe = (pixels: number) => {
          const atual = tempCircleRef.current?.getLatLng() || centro;
          const p = map.latLngToContainerPoint(atual);
          return map.distance(atual, map.containerPointToLatLng(L.point(p.x + pixels, p.y)));
        };
        const raioDesenhado = raioInicial > 0 ? raioInicial : metrosDe(45);

        // bubblingMouseEvents: false é o que impede o gesto no círculo de
        // virar um clique no mapa — que, no modo de escolha, jogaria o centro
        // para debaixo do dedo no meio do arrasto.
        const tempCircle = L.circle(centro, {
          radius: raioDesenhado,
          color: tempPlacementColor,
          weight: 2,
          opacity: 0.85,
          dashArray: '5, 5',
          fillColor: tempPlacementColor,
          fillOpacity: 0.15,
          bubblingMouseEvents: false
        });

        /** Miolo do círculo: mostra a medida e marca o centro exato. */
        const tempCenter = L.marker(centro, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: '',
            html:
              '<span style="display:block;width:14px;height:14px;border-radius:50%;' +
              `background:${tempPlacementColor};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        });
        tempCenter.bindTooltip(
          raioInicial > 0
            ? `${Math.round(raioInicial)} m`
            : 'Arraste da borda para abrir o raio',
          { permanent: true, direction: 'top', offset: [0, -12], className: 'medida-raio' }
        );

        /** Escreve a medida do momento embaixo do centro. */
        const mostrarMedida = (metros: number) =>
          tempCenter.setTooltipContent(
            metros > 0 ? `${Math.round(metros)} m` : 'Arraste da borda para abrir o raio'
          );

        /** Aplica o raio que o gesto acabou de desenhar. */
        const aplicarRaio = (ponto: any) => {
          const metros = Math.max(1, Math.round(map.distance(tempCircle.getLatLng(), ponto)));
          tempCircle.setRadius(metros);
          mostrarMedida(metros);
          aoMudarRaioRef.current?.(metros);
        };

        /** Leva o círculo e o miolo juntos, sem mexer no tamanho. */
        const moverTudo = (novoCentro: any) => {
          tempCircle.setLatLng(novoCentro);
          tempCenter.setLatLng(novoCentro);
        };

        /**
         * Um gesto, duas leituras: perto da borda é redimensionar, por dentro
         * é mover. A faixa da borda é medida em pixels da tela, então vale o
         * mesmo em qualquer zoom.
         */
        const pegarNoCirculo = (evento: any) => {
          L.DomEvent.stop(evento);

          const centroAtual = tempCircle.getLatLng();
          const raioAtual = tempCircle.getRadius();
          const pxDoCentro = map.latLngToContainerPoint(centroAtual);
          const pxDoToque = map.latLngToContainerPoint(evento.latlng);
          const raioEmPx = raioAtual > 0
            ? pxDoCentro.distanceTo(
                map.latLngToContainerPoint(
                  L.latLng(
                    centroAtual.lat,
                    centroAtual.lng +
                      raioAtual / (111320 * Math.cos((centroAtual.lat * Math.PI) / 180))
                  )
                )
              )
            : 0;
          // Sem raio gravado, o círculo em tela é só o fantasma: qualquer
          // pegada nele quer dizer "abrir o raio".
          // 22 px de folga: o suficiente para pegar a linha sem mira de sniper.
          const naBorda =
            raioRef.current <= 0 ||
            raioEmPx === 0 ||
            Math.abs(pxDoToque.distanceTo(pxDoCentro) - raioEmPx) <= 22;

          arrastandoRaioRef.current = true;
          map.dragging.disable();

          // Sem raio ainda, o arrasto abre o círculo a partir do toque; com
          // raio, o que muda é a borda ou a posição, conforme onde se pegou.
          const deslocamento = naBorda
            ? null
            : {
                lat: centroAtual.lat - evento.latlng.lat,
                lng: centroAtual.lng - evento.latlng.lng
              };

          const seguir = (mov: any) => {
            if (naBorda) {
              aplicarRaio(mov.latlng);
              return;
            }
            moverTudo(
              L.latLng(
                mov.latlng.lat + (deslocamento?.lat || 0),
                mov.latlng.lng + (deslocamento?.lng || 0)
              )
            );
          };

          const soltar = (mov?: any) => {
            map.off('mousemove', seguir);
            map.off('mouseup', soltar);
            window.removeEventListener('mouseup', soltar as any);
            window.removeEventListener('touchend', soltar as any);
            map.dragging.enable();
            if (mov?.latlng) seguir(mov);
            // O clique que o navegador dispara depois do arrasto ainda está a
            // caminho: a trava só cai no quadro seguinte.
            setTimeout(() => {
              arrastandoRaioRef.current = false;
            }, 0);
            // Ponto movido: só agora o valor sobe, uma vez, no fim do gesto.
            if (!naBorda) {
              const destino = tempCircle.getLatLng();
              aoEscolherCoordenadaRef.current({ lat: destino.lat, lng: destino.lng });
            }
          };

          map.on('mousemove', seguir);
          map.on('mouseup', soltar);
          // Soltar o botão fora do mapa não pode deixar o arrasto preso nem o
          // mapa travado sem poder ser arrastado.
          window.addEventListener('mouseup', soltar as any);
          window.addEventListener('touchend', soltar as any);
        };
        tempCircle.on('mousedown', pegarNoCirculo);

        // O fantasma é medido em pixels, então precisa ser refeito a cada
        // zoom: senão ele engorda ou some conforme a escala.
        const refazerFantasma = () => {
          if (raioRef.current > 0 || arrastandoRaioRef.current) return;
          tempCircle.setRadius(metrosDe(45));
        };
        map.on('zoomend', refazerFantasma);
        limparZoomRef.current = () => map.off('zoomend', refazerFantasma);

        tempGroup.addLayer(tempCircle);
        tempGroup.addLayer(tempCenter);
        tempCircleRef.current = tempCircle;
        tempHandleRef.current = null;
        tempMedidaRef.current = mostrarMedida;
        tempFantasmaRef.current = () => metrosDe(45);
      } else {
        // Draw temp pin marker
        const tempIcon = getCustomPinIcon(tempPlacementColor, 'flag', true);
        const tempMarker = L.marker([tempPlacementCoords.lat, tempPlacementCoords.lng], {
          icon: tempIcon,
          opacity: 0.8
        });
        tempGroup.addLayer(tempMarker);
      }

      /**
       * O mapa só anda quando precisa.
       *
       * Antes ele era centralizado toda vez que esta camada era redesenhada,
       * então trocar a cor, mudar o tipo ou qualquer clique jogava a vista de
       * volta para o ponto e desfazia o enquadramento de quem estava olhando.
       * Agora só há movimento quando o ponto está fora da tela, e só uma vez
       * por ponto.
       */
      const alvo = L.latLng(tempPlacementCoords.lat, tempPlacementCoords.lng);
      const assinatura = `${tempPlacementCoords.lat},${tempPlacementCoords.lng}`;
      if (ultimoPanRef.current !== assinatura) {
        ultimoPanRef.current = assinatura;
        // pad(-0.15) exige uma folga da borda: um ponto colado no canto conta
        // como fora da tela e merece o passeio.
        if (!map.getBounds().pad(-0.15).contains(alvo)) {
          map.panTo(alvo);
        }
      }
    } else {
      ultimoPanRef.current = '';
    }
    // O raio fica de fora das dependencias de proposito: quem o atualiza
    // durante o arrasto e o efeito seguinte, sem refazer as camadas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempPlacementCoords, tempPlacementColor, tempPlacementType]);

  // Raio mudado por fora (campo do formulario): o circulo acompanha.
  useEffect(() => {
    if (arrastandoRaioRef.current) return;
    const circulo = tempCircleRef.current;
    if (!circulo) return;
    const metros = tempPlacementRadius > 0 ? tempPlacementRadius : 0;
    // Raio zerado volta ao círculo fantasma, que continua tendo borda para
    // pegar; a medida escrita no miolo é a de verdade.
    circulo.setRadius(metros > 0 ? metros : tempFantasmaRef.current?.() || 0);
    tempMedidaRef.current?.(metros);
  }, [tempPlacementRadius]);

  return (
    <div className="relative w-full h-full font-sans">
      {/* Loading Overlay with the custom Uiverse animation - Opaque Light Gradient with Progress Bar */}
      {isMapLoading && (
        <div className="fixed inset-0 candidate-map-loader-bg flex flex-col items-center justify-center z-[10000] transition-all duration-300">
          <div className="flex flex-col items-center justify-center">
            {/* Animating Face */}
            <div className="loader-wrapper">
              <svg height="108px" width="108px" viewBox="0 0 128 128" className="loader">
                <defs>
                  <clipPath id="loader-eyes">
                    <circle transform="rotate(-40,64,64) translate(0,-56)" r="8" cy="64" cx="64" className="loader__eye1"></circle>
                    <circle transform="rotate(40,64,64) translate(0,-56)" r="8" cy="64" cx="64" className="loader__eye2"></circle>
                  </clipPath>
                  <linearGradient y2="1" x2="0" y1="0" x1="0" id="loader-grad">
                    <stop stopColor="#000" offset="0%"></stop>
                    <stop stopColor="#fff" offset="100%"></stop>
                  </linearGradient>
                  <mask id="loader-mask">
                    <rect fill="url(#loader-grad)" height="128" width="128" y="0" x="0"></rect>
                  </mask>
                </defs>
                <g strokeDasharray="175.93 351.86" strokeWidth="12" strokeLinecap="round">
                  <g>
                    <rect clipPath="url(#loader-eyes)" height="64" width="128" fill="hsl(193,90%,50%)"></rect>
                    <g stroke="hsl(193,90%,50%)" fill="none">
                      <circle transform="rotate(180,64,64)" r="56" cy="64" cx="64" className="loader__mouth1"></circle>
                      <circle transform="rotate(0,64,64)" r="56" cy="64" cx="64" className="loader__mouth2"></circle>
                    </g>
                  </g>
                  <g mask="url(#loader-mask)">
                    <rect clipPath="url(#loader-eyes)" height="64" width="128" fill="hsl(223,90%,50%)"></rect>
                    <g stroke="hsl(223,90%,50%)" fill="none">
                      <circle transform="rotate(180,64,64)" r="56" cy="64" cx="64" className="loader__mouth1"></circle>
                      <circle transform="rotate(0,64,64)" r="56" cy="64" cx="64" className="loader__mouth2"></circle>
                    </g>
                  </g>
                </g>
              </svg>
            </div>

            {/* Premium Minimalistic Progress Bar matching the user's screenshot */}
            <div className="mt-8 w-48 h-[3px] bg-white rounded-full overflow-hidden relative shadow-2xs border border-[#FFF]/10">
              <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full animate-[loading_2.2s_infinite_ease-in-out]" style={{ width: '40%' }} />
            </div>

            <p className="mt-4 text-[10px] font-extrabold uppercase tracking-widest text-[#0D233A]/70 font-sans">
              Carregando...
            </p>
          </div>
        </div>
      )}

      {/* Map Element */}
      <div id="campaign-primary-map" ref={containerRef} className="w-full h-full bg-slate-100" />

      {/* PAINEL DE NAVEGAÇÃO CASCATA (TOP SQUIRCLE) */}
      {/* Ao lado do botão Voltar, que ocupa o canto esquerdo do topo. */}
      <div
        className={`absolute top-4 left-[10.5rem] z-[1000] w-76 sm:w-80 font-sans ${
          esconderBusca ? 'hidden' : ''
        }`}
      >
        {!isPanelOpen ? (
          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="flex items-center gap-2.5 px-4 py-3 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 transition-all font-sans text-xs font-bold leading-none cursor-pointer group"
          >
            <Compass className="w-4 h-4 text-indigo-600 group-hover:rotate-45 transition-transform duration-300" />
            <span>Pesquisar no mapa</span>
            {(selectedStateShortName || selectedCityIbgeId || selectedBairroName || selectedRuaName) && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse ml-0.5" />
            )}
          </button>
        ) : (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 p-3.5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 select-none">
                <div className="p-1 bg-indigo-50 rounded-lg text-indigo-600">
                  <Compass className="w-4 h-4 shrink-0" />
                </div>
                <h4 className="font-extrabold text-[11px] text-slate-800 uppercase tracking-widest">Pesquisar no mapa</h4>
              </div>
              <div className="flex items-center gap-2">
                {(selectedStateShortName || selectedCityIbgeId || selectedBairroName || selectedRuaName) && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-[10px] text-red-500 hover:text-red-650 font-extrabold uppercase tracking-wider flex items-center gap-0.5 cursor-pointer hover:underline transition-all mr-1"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Fechar painel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ESTADO SELECT */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">1. Estado</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setOpenStateDropdown(!openStateDropdown);
                    setOpenCityDropdown(false);
                    setOpenBairroDropdown(false);
                    setOpenRuaDropdown(false);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl text-left text-xs text-slate-700 font-medium flex items-center justify-between transition-all cursor-pointer shadow-2xs"
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {selectedStateName ? `${selectedStateName} (${selectedStateShortName})` : 'Selecione o Estado...'}
                  </span>
                  {loadingStates ? (
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
                  ) : (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openStateDropdown ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {openStateDropdown && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[1010] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Pesquisar estado..."
                        value={stateSearch}
                        onChange={(e) => setStateSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5"
                      />
                    </div>
                    
                    <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
                      {filteredStates.map((s) => (
                        <button
                          key={s.shortName}
                          type="button"
                          onClick={() => handleStateSelect(s.shortName, s.name)}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer"
                        >
                          <span className={selectedStateShortName === s.shortName ? "font-bold text-indigo-600" : "font-medium"}>
                            {s.name} ({s.shortName})
                          </span>
                          {selectedStateShortName === s.shortName && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </button>
                      ))}
                      {filteredStates.length === 0 && (
                        <p className="p-3 text-center text-xs text-slate-400 italic">Nenhum estado encontrado</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MUNICIPIO SELECT */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">2. Município</label>
              <div className="relative">
                <button
                  type="button"
                  disabled={!selectedStateShortName}
                  onClick={() => {
                    setOpenCityDropdown(!openCityDropdown);
                    setOpenStateDropdown(false);
                    setOpenBairroDropdown(false);
                    setOpenRuaDropdown(false);
                  }}
                  className={`w-full px-3 py-2 border rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all ${
                    selectedStateShortName
                      ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/50 text-slate-700 cursor-pointer shadow-2xs'
                      : 'bg-slate-100/40 border-slate-150 text-slate-400 cursor-not-allowed opacity-70'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {selectedCityName ? selectedCityName : selectedStateShortName ? 'Selecione o Município...' : 'Selecione o estado primeiro...'}
                  </span>
                  {loadingCities ? (
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
                  ) : (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openCityDropdown ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {openCityDropdown && selectedStateShortName && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[1010] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Pesquisar município..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5"
                      />
                    </div>
                    
                    <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
                      {filteredCities.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCitySelect(c.ibgeId, c.name)}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer"
                        >
                          <span className={selectedCityIbgeId === c.ibgeId ? "font-bold text-indigo-600" : "font-medium"}>
                            {c.name}
                          </span>
                          {selectedCityIbgeId === c.ibgeId && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </button>
                      ))}
                      {filteredCities.length === 0 && (
                        <p className="p-3 text-center text-xs text-slate-400 italic">Nenhum município encontrado</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BAIRRO SELECT */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">3. Bairro</label>
              <div className="relative">
                <button
                  type="button"
                  disabled={!selectedCityIbgeId}
                  onClick={() => {
                    setOpenBairroDropdown(!openBairroDropdown);
                    setOpenStateDropdown(false);
                    setOpenCityDropdown(false);
                    setOpenRuaDropdown(false);
                  }}
                  className={`w-full px-3 py-2 border rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all ${
                    selectedCityIbgeId
                      ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/50 text-slate-700 cursor-pointer shadow-2xs'
                      : 'bg-slate-100/40 border-slate-150 text-slate-400 cursor-not-allowed opacity-70'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {selectedBairroName ? selectedBairroName : selectedCityIbgeId ? 'Selecione o Bairro...' : 'Selecione o município primeiro...'}
                  </span>
                  {loadingDistricts ? (
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
                  ) : (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openBairroDropdown ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {openBairroDropdown && selectedCityIbgeId && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[1010] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Pesquisar bairro..."
                        value={bairroSearch}
                        onChange={(e) => setBairroSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5"
                      />
                    </div>
                    
                    <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
                      {filteredDistricts.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBairroSelect(b.name, b.id)}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer"
                        >
                          <span className={selectedBairroName === b.name ? "font-bold text-indigo-600" : "font-medium"}>{b.name}</span>
                          {selectedBairroName === b.name && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </button>
                      ))}
                      {filteredDistricts.length === 0 && (
                        <p className="p-3 text-center text-xs text-slate-400 italic">Bairro não cadastrado</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RUA SELECT */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">4. Rua</label>
              <div className="relative">
                <button
                  type="button"
                  disabled={!selectedBairroName}
                  onClick={() => {
                    setOpenRuaDropdown(!openRuaDropdown);
                    setOpenStateDropdown(false);
                    setOpenCityDropdown(false);
                    setOpenBairroDropdown(false);
                  }}
                  className={`w-full px-3 py-2 border rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all ${
                    selectedBairroName
                      ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/50 text-slate-700 cursor-pointer shadow-2xs'
                      : 'bg-slate-100/40 border-slate-150 text-slate-400 cursor-not-allowed opacity-70'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {selectedRuaName ? selectedRuaName : selectedBairroName ? 'Selecione a Rua...' : 'Selecione o bairro primeiro...'}
                  </span>
                  {loadingStreets ? (
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
                  ) : (
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openRuaDropdown ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {openRuaDropdown && selectedBairroName && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[1010] max-h-64 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Pesquisar rua..."
                        value={ruaSearch}
                        onChange={(e) => setRuaSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5"
                      />
                    </div>

                    <div className="overflow-y-auto max-h-52 divide-y divide-slate-50">
                      {filteredStreets.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleRuaSelect(r.name, r.id)}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer"
                        >
                          <span className={selectedRuaName === r.name ? "font-bold text-indigo-600 truncate" : "font-medium truncate"}>
                            {r.name}
                          </span>
                          {selectedRuaName === r.name && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </button>
                      ))}

                      {loadingOsmStreets && (
                        <p className="px-3.5 py-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium italic">
                          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                          Buscando mais ruas no mapa...
                        </p>
                      )}

                      {filteredStreets.length === 0 && !loadingOsmStreets && (
                        <p className="p-4 text-center text-xs text-slate-400 font-medium italic">
                          Rua não encontrada ou não carregada.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MATCH CONFIRMATION CARD AT BOTTOM LEFT */}
      {searchMarkerCoords && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/60 p-2.5 flex items-center gap-3 animate-in slide-in-from-bottom duration-350">
          <div className="text-left font-sans min-w-0 max-w-[180px] sm:max-w-[220px]">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Resultado Encontrado</p>
            <p className="text-xs font-semibold text-slate-800 mt-1 truncate">{searchMarkerCoords.name}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onCoordsPicked({ lat: searchMarkerCoords.lat, lng: searchMarkerCoords.lng });
            }}
            className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <MapPin className="w-3 h-3" />
            Marcar Aqui
          </button>
        </div>
      )}

      {/* Crosshair / Overlay Indicator for Coord Picking */}
      {clickToPickCoords && (
        <div className="absolute inset-x-0 top-4 mx-auto w-fit z-[1000] pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/95 backdrop-blur-sm text-white rounded-lg shadow-lg border border-slate-700 text-xs animate-pulse">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            <span>Selecione onde quer marcar clicando em qualquer rua ou bairro</span>
          </div>
        </div>
      )}

      {/* CHECK-IN DETALHES MODAL (CENTRALIZADO) */}
      {selectedCheckInForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header com tom esmeralda */}
            <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between text-white shadow-md">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-emerald-100 leading-none">Detalhes do Check-in</h3>
                  <p className="text-xs font-semibold text-emerald-50 mt-0.5">
                    {selectedCheckInForModal.mode === 'livre' ? 'Registro Livre (sem missão)' : 'Voluntário Registrado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onToggleCheckInFavorite && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCheckInFavorite(selectedCheckInForModal);
                      // O modal guarda uma cópia: sem isto a estrela só mudaria
                      // no mapa atrás dele.
                      setSelectedCheckInForModal({
                        ...selectedCheckInForModal,
                        favorite: !selectedCheckInForModal.favorite
                      });
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    title={
                      selectedCheckInForModal.favorite
                        ? 'Tirar dos favoritos'
                        : 'Favoritar este check-in'
                    }
                    aria-label="Favoritar check-in"
                  >
                    <Star
                      className="w-5 h-5"
                      fill={selectedCheckInForModal.favorite ? '#FCD34D' : 'none'}
                      color={selectedCheckInForModal.favorite ? '#FCD34D' : 'currentColor'}
                    />
                  </button>
                )}
                {onDeleteCheckIn && (
                  <button
                    type="button"
                    onClick={() => {
                      const alvo = selectedCheckInForModal;
                      setSelectedCheckInForModal(null);
                      onDeleteCheckIn(alvo);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    title="Mover para a lixeira"
                    aria-label="Mover o check-in para a lixeira"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCheckInForModal(null)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo rolável */}
            <div className="p-6 overflow-y-auto space-y-5 text-left font-sans">

              {/* Modalidade e grau de prioridade/impacto */}
              {(() => {
                const isFree = selectedCheckInForModal.mode === 'livre';
                const nivel = (priorityLevels || []).find(
                  n => n.id === selectedCheckInForModal.priority
                );
                const priority = nivel
                  ? { label: nivel.label, color: nivel.color }
                  : getCheckInPriority(selectedCheckInForModal.priority);
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${
                        isFree
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}
                    >
                      {isFree ? 'Check-in Livre' : 'Check-in por Missão'}
                    </span>
                    {priority && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border"
                        style={{
                          color: priority.color,
                          borderColor: `${priority.color}40`,
                          backgroundColor: `${priority.color}14`
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priority.color }} />
                        Prioridade {priority.label}
                      </span>
                    )}
                    {!isFree && selectedCheckInForModal.missionTitle && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-150">
                        {selectedCheckInForModal.missionTitle}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Seção principal de identificação */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                  {(selectedCheckInForModal as any).memberPhoto ? (
                    <img
                      src={(selectedCheckInForModal as any).memberPhoto}
                      alt={selectedCheckInForModal.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={e => {
                        // Foto fora do ar volta para o boneco, sem quebrar a ficha.
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Nome do Voluntário</p>
                  <h4 className="text-lg font-bold text-slate-800 mt-1 truncate leading-snug">{selectedCheckInForModal.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs font-medium">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {new Date(selectedCheckInForModal.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <span className="text-slate-300">•</span>
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {new Date(selectedCheckInForModal.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Operações escolhidas */}
              {(() => {
                const operacoes = detalhesCheckIn.operacoes.length > 0
                  ? detalhesCheckIn.operacoes.map((o: any) => o.operation_type_label || o.operation_type_id)
                  : (selectedCheckInForModal as any).operationTypeLabel
                    ? [(selectedCheckInForModal as any).operationTypeLabel]
                    : [];
                if (operacoes.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                      Operações{operacoes.length > 1 ? ` (${operacoes.length})` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {operacoes.map((label: string, i: number) => (
                        <span
                          key={`${label}-${i}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"
                        >
                          <Flag className="w-3 h-3" />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Observações digitadas e áudios gravados em campo */}
              {detalhesCheckIn.notas.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                    Observações ({detalhesCheckIn.notas.length})
                  </p>
                  <div className="space-y-2.5">
                    {detalhesCheckIn.notas.map((nota: any) => (
                      <div
                        key={nota.id}
                        className="border border-slate-150 rounded-xl p-3 bg-slate-50/60"
                      >
                        {nota.kind === 'audio' ? (
                          <div className="flex items-center gap-2.5">
                            <Mic className="w-4 h-4 text-emerald-600 shrink-0" />
                            <audio
                              src={nota.url}
                              controls
                              preload="metadata"
                              className="w-full h-9"
                            />
                            {nota.duration_seconds ? (
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                {Math.floor(nota.duration_seconds / 60)}:
                                {String(Math.floor(nota.duration_seconds % 60)).padStart(2, '0')}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5">
                            <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap break-words">
                              {nota.content}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fotos e vídeos anexados */}
              {(() => {
                // A lista vem da tabela própria; o jsonb e a foto única cobrem os
                // registros antigos, gravados antes das tabelas existirem.
                const daTabela = detalhesCheckIn.midias.map((m: any) => ({
                  url: m.url,
                  type: (m.kind === 'video' ? 'video' : 'image') as 'image' | 'video'
                }));
                const media = daTabela.length > 0
                  ? daTabela
                  : selectedCheckInForModal.media && selectedCheckInForModal.media.length > 0
                    ? selectedCheckInForModal.media
                    : selectedCheckInForModal.photo
                      ? [{ url: selectedCheckInForModal.photo, type: 'image' as const }]
                      : [];

                return (
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                      Fotos e vídeos{media.length > 1 ? ` (${media.length})` : ''}
                    </p>
                    {media.length > 0 ? (
                      <div className={media.length > 1 ? 'grid grid-cols-2 gap-2.5' : ''}>
                        {media.map((item, index) => (
                          <div
                            key={`${item.url}-${index}`}
                            className="shadow-inner border border-slate-150 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center relative"
                          >
                            {item.type === 'video' ? (
                              <video
                                src={item.url}
                                controls
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover max-h-64 sm:max-h-80 bg-black"
                              />
                            ) : (
                              <img
                                referrerPolicy="no-referrer"
                                src={item.url}
                                alt="Arquivo anexado ao check-in"
                                className="w-full h-full object-cover max-h-64 sm:max-h-80 animate-in fade-in zoom-in-95 duration-500"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center flex flex-col items-center justify-center gap-1.5 select-none">
                        <User className="w-8 h-8 text-slate-300" />
                        <p className="text-xs text-slate-400 font-semibold" id="no-photo-attached-text">Nenhuma foto foi anexada neste check-in.</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Endereço e Localização */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Localização do Evento</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-xl flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Rua / Logradouro</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{selectedCheckInForModal.rua || 'Não especificada'}</p>
                    </div>
                  </div>

                  <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-xl flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bairro</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{selectedCheckInForModal.bairro || 'Não especificado'}</p>
                    </div>
                  </div>

                  <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-xl flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Município</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{selectedCheckInForModal.municipio || 'Maceió'}</p>
                    </div>
                  </div>

                  <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-xl flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Estado</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{selectedCheckInForModal.estado || 'Alagoas'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Localização Física Real do Dispositivo (Exata) */}
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">📍 Localização Física Real (Dispositivo via GPS)</p>
                {selectedCheckInForModal.userLatitude && selectedCheckInForModal.userLongitude ? (
                  <div className="bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-xl space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wide">
                          Capturado com Sucesso
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-white/90 p-3.5 rounded-xl border border-slate-100 space-y-3 shadow-3xs text-xs font-sans text-slate-700">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block select-none">Endereço Completo</span>
                        {isReverseGeocoding ? (
                          <div className="flex items-center gap-1.5 text-indigo-600 font-semibold mt-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0"/>
                            <span>Buscando endereço exato por coordenadas no banco cartográfico...</span>
                          </div>
                        ) : reverseGeocodedAddress ? (
                          <p className="font-semibold text-slate-800 leading-relaxed mt-0.5">{reverseGeocodedAddress}</p>
                        ) : (
                          <p className="font-semibold text-slate-700 mt-0.5 leading-relaxed italic">
                            {selectedCheckInForModal.rua ? `Rua ${selectedCheckInForModal.rua}` : 'Rua não selecionada'}, {selectedCheckInForModal.bairro}, {selectedCheckInForModal.municipio || 'Maceió'} — {selectedCheckInForModal.estado || 'AL'}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-150/60 text-[11px]">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase block select-none mb-0.5">Estado</span>
                          <span className="font-extrabold text-slate-800 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md inline-block">
                            {selectedCheckInForModal.estado || 'Alagoas (AL)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase block select-none mb-0.5">Município</span>
                          <span className="font-extrabold text-slate-800 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md inline-block">
                            {selectedCheckInForModal.municipio || 'Maceió'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase block select-none mb-0.5">Bairro</span>
                          <span className="font-extrabold text-slate-800 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md inline-block">
                            {selectedCheckInForModal.bairro || 'Não especificado'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase block select-none mb-0.5">Rua</span>
                          <span className="font-extrabold text-slate-800 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md inline-block truncate max-w-full">
                            {selectedCheckInForModal.rua || 'Não especificada'}
                          </span>
                        </div>
                      </div>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedCheckInForModal.userLatitude},${selectedCheckInForModal.userLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 w-full py-3 bg-[#F58220] hover:bg-[#E06E10] active:bg-[#C05D10] text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 no-underline"
                      >
                        <Navigation className="w-4 h-4 stroke-[2.5]" />
                        Abrir no Google Maps
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center">
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      ⚠️ Nenhuma coordenada de GPS física exata foi registrada (GPS desativado ou check-in legado).
                    </p>
                  </div>
                )}
              </div>


            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCheckInForModal(null)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
