import React, { useState, useEffect } from "react";
import {
  fetchCepStreets,
  fetchOsmStreets,
  mergeStreetLists,
  reverseGeocode,
  StreetOption,
} from "./services/streetSources";
import {
  candidateLocationText,
  CandidateLocation,
  parseCandidateLocation,
  resolveCandidateLocation,
} from "./services/candidateLocation";
import { fetchExternalData, fetchExternalTeam } from "./services/externalApi";
import {
  PARTY_LOGOS,
  BRAND_LOGO,
  CHECKIN_COVER,
  CLIENT_CARD_COVER,
} from "./mediaUrls";
import OperationTypeSelect from "./components/OperationTypeSelect";
import FiltroDePeriodo, {
  EstadoDoPeriodo,
  diaDaMissao,
  passaNoPrazo,
  rotuloDoPeriodo,
} from "./components/FiltroDePeriodo";
import LaserPointer from "./components/LaserPointer";
import PesquisaEstabelecimentos from "./components/PesquisaEstabelecimentos";
import FichaEstabelecimento from "./components/FichaEstabelecimento";
import InteligenciaTerritorial from "./components/InteligenciaTerritorial";
import { Estabelecimento } from "./services/estabelecimentos";
import TeamSignupPage from "./components/TeamSignupPage";
import CheckInChat, { MissaoDoCampo } from "./components/CheckInChat";
import {
  EditorDeMaterial,
  ItemMaterial,
} from "./components/MaterialDaMissao";
import {
  EtiquetaDePrioridade,
  EtiquetaDeTurno,
  TurnoEPrioridadeDaMissao,
} from "./components/TurnoEPrioridade";
import DestinoDaMissao from "./components/missao/DestinoDaMissao";
import PreviaDaMissao from "./components/missao/PreviaDaMissao";
import TrilhaDaMissao, {
  PassoDoFormulario,
} from "./components/missao/TrilhaDaMissao";
import {
  CHAVE_TURNOS,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TURNOS_PADRAO,
  TurnoId,
  lerTurnos,
} from "./turnos";
import { lerDispositivo } from "./services/dispositivo";
import DispositivosMembroModal from "./components/DispositivosMembroModal";
import ConfiguracoesAdmin, {
  CHAVE_REDIRECIONAMENTO,
} from "./components/ConfiguracoesAdmin";
import BrandMark from "./components/BrandMark";
import {
  VincularMembroModal,
  QrConviteModal,
  CadastroManualModal,
  CamposColetaModal,
} from "./components/TeamManagerModals";
import {
  MapPin,
  Users,
  Settings,
  Ruler,
  Undo2,
  Save,
  Smartphone,
  Layers,
  Flag,
  Megaphone,
  Star,
  Crosshair,
  Store,
  Layers3,
  Maximize2,
  Navigation,
  TrendingUp,
  Activity,
  AlertTriangle,
  Trophy,
  Home,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  Eye,
  EyeOff,
  Link,
  Sparkles,
  Download,
  Upload,
  Volume2,
  Compass,
  Map,
  X,
  Menu,
  Check,
  AlertCircle,
  Zap,
  Share2,
  ClipboardList,
  Circle,
  PenTool,
  Calendar,
  Search,
  Link2,
  QrCode,
  Building2,
  ChevronDown,
  Loader2,
  Phone,
  Lock,
  ArrowRight,
  LogOut,
  Camera,
  Video,
  Image,
  Instagram,
  Mail,
  PlusCircle,
  ChevronLeft,
  Target,
  Brain,
  Clock,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import MapContainer, { NEIGHBORHOOD_DATA } from "./components/MapContainer";
import OperationIcon from "./components/OperationIcon";
import ConfirmDialog, { ConfirmRequest } from "./components/ConfirmDialog";
import MindMapPanel from "./components/MindMapPanel";
import PainelDeCheckIns from "./components/PainelDeCheckIns";
import MiniMapa from "./components/MiniMapa";
import BarrasDaEscola from "./components/BarrasDaEscola";
import {
  FerramentasDoMapa,
  GrupoDeFerramentas,
} from "./components/FerramentasDoMapa";
import { OPERATION_ICONS } from "./operationIcons";

/**
 * Os blocos do trilho de ferramentas do mapa.
 *
 * A ordem é a da rotina de quem usa: primeiro se marca o território, depois
 * se liga o que ajuda a ler o território, então se filtra o que já existe e
 * por último se mostra para os outros. Menu longo sem divisão vira lista de
 * compras -- com divisão, quem procura sabe em qual terço olhar.
 */
const GRUPOS_DE_FERRAMENTAS: GrupoDeFerramentas[] = [
  { id: "marcar", titulo: "Marcar" },
  { id: "camadas", titulo: "Camadas" },
  { id: "filtrar", titulo: "Filtrar" },
  { id: "apresentar", titulo: "Apresentar" },
];
import {
  PanfletagemArea,
  CampaignPin,
  CheckIn,
  BairroData,
  MACEIO_BAIRROS,
  PRESET_COLORS,
  OperationType,
  Candidate,
  Party,
  CheckInMode,
  CheckInPriority,
  CHECKIN_PRIORITIES,
  getCheckInPriority,
  PriorityLevel,
  Escola,
  corDaDependencia,
  CheckInMedia,
  CheckInMediaType,
  CHECKIN_MAX_MEDIA,
  CHECKIN_MAX_IMAGE_BYTES,
  CHECKIN_MAX_VIDEO_BYTES,
  MaterialDeApoio,
} from "./types";
import {
  DatabaseService,
  isDatabaseConfigured,
  db,
  normalizeRecord,
} from "./databaseClient";

const INITIAL_PARTIES: Party[] = [
  {
    id: "party-1",
    name: "Solidariedade",
    initials: "SD",
    logo_url:
      PARTY_LOGOS.SD,
  },
  {
    id: "party-2",
    name: "Partido Progressistas",
    initials: "PP",
    logo_url:
      PARTY_LOGOS.PP,
  },
  {
    id: "party-3",
    name: "Partido Liberal",
    initials: "PL",
    logo_url:
      PARTY_LOGOS.PL,
  },
];

// Default mock initial data for the campaign in Maceió, Alagoas
const INITIAL_AREAS: PanfletagemArea[] = [
  {
    id: "area-1",
    title: "Equipe Azul - Orla da Ponta Verde",
    description:
      "Abordagem no calçadão, panfletagem nos quiosques e bandeiraços estruturados nos cruzamentos principais de fluxo litorâneo.",
    bairro: "Ponta Verde",
    center: { lat: -9.6631, lng: -35.7011 },
    radius: 500,
    color: "#2563eb",
    active: true,
    teamSize: 15,
    contactName: "Carlos Mendonça",
    createdAt: new Date().toISOString(),
  },
  {
    id: "area-2",
    title: "Equipe Vermelha - Calçadão do Centro",
    description:
      "Panfletagem densa de corpo a corpo no centro comercial. Entrada nas lojas, distribuição de cartilhas eleitorais e santinhos.",
    bairro: "Centro",
    center: { lat: -9.6658, lng: -35.735 },
    radius: 400,
    color: "#dc2626",
    active: true,
    teamSize: 25,
    contactName: "Fabiana Souza",
    createdAt: new Date().toISOString(),
  },
  {
    id: "area-3",
    title: "Mobilização Geral - Benedito Bentes",
    description:
      "Balanço de bandeiras na avenida central e panfletagem domiciliar em ruas residenciais de grande concentração habitacional.",
    bairro: "Benedito Bentes",
    center: { lat: -9.554, lng: -35.7042 },
    radius: 800,
    color: "#ea580c",
    active: true,
    teamSize: 30,
    contactName: "Marcos Silva",
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_PINS: CampaignPin[] = [
  {
    id: "pin-1",
    title: "Comitê Central de Maceió",
    description:
      "Ponto de infraestrutura principal de coleta de materiais, bandeiras, santinhos e reuniões de lideranças operacionais diárias.",
    position: { lat: -9.6544, lng: -35.7297 }, // Farol
    color: "#0d9488",
    iconType: "home",
    active: true,
    createdAt: new Date().toISOString(),
    date: "2026-06-18",
  },
  {
    id: "pin-2",
    title: "Grandioso Adesivaço de Sábado",
    description:
      "Encontro massivo de apoiadores e automóveis para colagem de adesivos micro-perfurados nos vidros traseiros e vidros laterais.",
    position: { lat: -9.6548, lng: -35.7058 }, // Jatiúca
    color: "#db2777",
    iconType: "flag",
    active: true,
    createdAt: new Date().toISOString(),
    date: "2026-06-20",
  },
  {
    id: "pin-3",
    title: "Ponto de Apoio e Reforço - Jacintinho",
    description:
      "Garagem de liderança do bairro cedida para depósito emergencial de materiais e água mineral para os panfleteiros.",
    position: { lat: -9.6416, lng: -35.7161 }, // Jacintinho
    color: "#9333ea",
    iconType: "group",
    active: true,
    createdAt: new Date().toISOString(),
    date: "2026-06-25",
  },
];

/** Lê um arquivo como data URL, usado quando o Storage não está disponível. */
function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Fotos e vídeos de um check-in, já unificando os registros antigos que só têm photo. */
function getCheckInMedia(checkIn: CheckIn): CheckInMedia[] {
  if (checkIn.media && checkIn.media.length > 0) return checkIn.media;
  if (checkIn.photo) return [{ url: checkIn.photo, type: 'image' }];
  return [];
}

// Mock inicial de check-ins para Maceió
const INITIAL_CHECK_INS: CheckIn[] = [
  {
    id: "checkin-1",
    name: "Amanda Vasconcelos",
    bairro: "Ponta Verde",
    rua: "Av. Silvio Carlos Viana",
    coordinates: { lat: -9.6644, lng: -35.7029 },
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
  },
  {
    id: "checkin-2",
    name: "José Roberto da Silva",
    bairro: "Centro",
    rua: "Rua do Comércio",
    coordinates: { lat: -9.6642, lng: -35.7352 },
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 horas atrás
  },
];

const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: "f32daeeb-4384-486d-9781-db4073ec473b",
    name: "João Neto",
    office: "DEPUTADO FEDERAL",
    city: "Maceió",
    phone: "82999999999",
    instagram_handle: "dr.joaoneto80.1",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    status_active: true,
  },
  {
    id: "d9bba4ce-939e-4e4f-b88a-dfad35bf9db9",
    name: "Lucas Ribeiro",
    office: "GOVERNADOR",
    city: "Paraíba",
    phone: "83988888888",
    instagram_handle: "lucasribeiro",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150",
    status_active: true,
  },
];

/**
 * Compara dois telefones ignorando máscara e código do país.
 *
 * O cadastro pode ter "82988887777" e a pessoa digitar com o 55 na frente, ou
 * o contrário. Comparar pelo final resolve os dois casos sem confundir números
 * diferentes, já que exige pelo menos 8 dígitos em comum.
 */
const samePhoneNumber = (a?: string | null, b?: string | null) => {
  const digitsA = (a || "").replace(/\D/g, "");
  const digitsB = (b || "").replace(/\D/g, "");
  if (digitsA.length < 8 || digitsB.length < 8) return false;
  return digitsA.endsWith(digitsB) || digitsB.endsWith(digitsA);
};

/** Compara nomes de município ignorando acento e caixa. */
const normalizeCityName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Endereço do painel da equipe.
 *
 * Domínio separado do painel administrativo, e o identificador do cliente vai
 * depois do `#`: assim o link não carrega o endereço da área administrativa
 * nem o nome do cliente, e o que vem depois do `#` nunca chega ao servidor —
 * fica fora de log de acesso, do cabeçalho Referer e das pré-visualizações de
 * link. Aberta a página, o endereço na barra é limpo e sobra só o domínio.
 */
const BASE_CADASTRO = (
  (import.meta as any).env?.VITE_SIGNUP_BASE_URL ||
  "https://cadastro.657169.74696d656f7065726163696f6e616c63636f.online"
).replace(/\/$/, "");

const BASE_EQUIPE = (
  (import.meta as any).env?.VITE_TEAM_BASE_URL ||
  "https://time.61636573.74696d656f7065726163696f6e616c63636f.online"
).replace(/\/$/, "");

/** Domínio de um endereço, sem o resto. */
const dominioDe = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

/**
 * Endereço de saída para quem chega sem link.
 *
 * Os domínios de acesso existem para receber quem veio de um QR Code ou do
 * link da equipe. Quem digita o domínio na barra não tem o que fazer aqui, e
 * mostrar o sistema a essa pessoa é entregar de graça a porta de entrada: ela
 * é mandada para outro lugar, escolhido pelo administrador em Compartilhar.
 */
/** Domínios que só servem para quem chega por link. */
const DOMINIOS_DE_ACESSO = [dominioDe(BASE_EQUIPE), dominioDe(BASE_CADASTRO)].filter(
  Boolean,
);

const REDIRECIONAMENTO_PADRAO =
  (import.meta as any).env?.VITE_FALLBACK_REDIRECT_URL ||
  "https://www.youtube.com";

/**
 * Rota de entrada, lida uma única vez quando a página carrega.
 *
 * Fica fora do componente de propósito: o endereço é limpo assim que lido, e
 * uma segunda leitura — o React remonta o componente em desenvolvimento —
 * encontraria a barra já vazia e jogaria a pessoa para a tela errada.
 */
const ROTA_INICIAL = (() => {
  if (typeof window === "undefined")
    return { convite: "", equipe: "", semLink: false };

  /**
   * Onde a pessoa está, guardado para o recarregar não a expulsar.
   *
   * O endereço é limpo assim que o link é lido, então uma atualização da
   * página não encontraria mais nada na barra: quem está no painel da equipe,
   * ou no cadastro, cairia em outra tela — e, no domínio de acesso, seria
   * mandado para fora do sistema.
   *
   * A memória fica nos dois lugares de propósito. A da aba basta para o
   * recarregar comum; a do navegador cobre o que a da aba não cobre — o
   * celular que descarta a aba parada e a recria do zero, o link aberto de
   * novo a partir da tela inicial, o navegador que restaura a sessão. Perder
   * essa memória é justamente o que jogava a pessoa para outro lugar.
   */
  // A memória é por domínio: o painel administrativo não pode herdar a rota
  // que a equipe deixou neste mesmo navegador.
  const dominio = window.location.hostname.toLowerCase();
  const chaveDo = (nome: string) => `${nome}:${dominio}`;

  const guardar = (nome: string, valor: string) => {
    const chave = chaveDo(nome);
    for (const cofre of [sessionStorage, localStorage]) {
      try {
        if (valor) cofre.setItem(chave, valor);
        else cofre.removeItem(chave);
      } catch {
        /* navegador sem armazenamento: segue sem lembrar */
      }
    }
  };
  const guardado = (nome: string) => {
    const chave = chaveDo(nome);
    for (const cofre of [sessionStorage, localStorage]) {
      try {
        const valor = cofre.getItem(chave);
        if (valor) return valor;
      } catch {
        /* navegador sem armazenamento: tenta o próximo */
      }
    }
    return "";
  };

  const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const busca = new URLSearchParams(window.location.search);

  // Formato novo (depois do `#`), os formatos antigos, e por fim o que ficou
  // guardado da última vez que um link foi aberto neste navegador.
  const doEndereco = {
    convite: fragmento.get("c") || busca.get("convite") || "",
    equipe: fragmento.get("e") || "",
  };

  if (doEndereco.convite || doEndereco.equipe) {
    // Link novo manda: o contexto anterior é trocado, não somado.
    guardar("rota_convite", doEndereco.convite);
    guardar("rota_equipe", doEndereco.equipe);
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* navegador sem history: o endereço fica como está */
    }
  }

  const convite = doEndereco.convite || guardado("rota_convite");
  let equipe = doEndereco.equipe || guardado("rota_equipe");

  // Última rede: quem já entrou no painel deixou o integrante guardado, e ali
  // está de qual cliente ele é. Com isso a pessoa volta para o painel dela
  // mesmo que toda a memória de rota tenha se perdido.
  if (!equipe && !convite && DOMINIOS_DE_ACESSO.includes(dominio)) {
    try {
      const integrante = JSON.parse(localStorage.getItem("checkin_supporter") || "null");
      equipe = integrante?.candidate_id || integrante?.candidateId || "";
    } catch {
      /* dado estragado no navegador: segue sem ele */
    }
  }

  // Chegou num domínio de acesso sem link nenhum? Não é gente do sistema.
  const caminho = window.location.pathname.replace(/\/+$/, "");
  const semLink =
    !convite &&
    !equipe &&
    caminho === "" &&
    busca.toString() === "" &&
    DOMINIOS_DE_ACESSO.includes(window.location.hostname.toLowerCase());

  return { convite, equipe, semLink };
})();

/** Link do painel da equipe para um cliente. Leva o id, nunca o nome. */
const linkDaEquipe = (candidateId: string) => `${BASE_EQUIPE}/#e=${candidateId}`;

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s-]/g, "") // remove caracteres especiais
    .replace(/\s+/g, "-") // substitui espaços por -
    .replace(/-+/g, "-"); // remove hifens repetidos
};

/** Iniciais do nome, usadas quando o integrante não tem foto cadastrada. */
const getInitials = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function App() {
  // Primary state loaded from LocalStorage
  // Com banco configurado, a tela nasce vazia e espera a resposta dele. O
  // exemplo embutido e a cópia do navegador só existem para a demonstração
  // offline — se aparecessem aqui, viveriam disputando com o banco quem manda.
  const [areas, setAreas] = useState<PanfletagemArea[]>(() => {
    if (isDatabaseConfigured) return [];
    const saved = localStorage.getItem("campaign_map_areas");
    return saved ? JSON.parse(saved) : INITIAL_AREAS;
  });

  const [pins, setPins] = useState<CampaignPin[]>(() => {
    if (isDatabaseConfigured) return [];
    const saved = localStorage.getItem("campaign_map_pins");
    return saved ? JSON.parse(saved) : INITIAL_PINS;
  });

  const [checkIns, setCheckIns] = useState<CheckIn[]>(() => {
    if (isDatabaseConfigured) return [];
    const saved = localStorage.getItem("campaign_map_checkins");
    return saved ? JSON.parse(saved) : INITIAL_CHECK_INS;
  });

  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const saved = localStorage.getItem("campaign_candidates");
    return saved ? JSON.parse(saved) : INITIAL_CANDIDATES;
  });

  /**
   * Tipos de Operação.
   *
   * A lista é do usuário: ele cria, edita e apaga os tipos que fazem sentido
   * para a operação dele. Os padrões só aparecem numa instalação nova.
   */
  const [operationTypes, setOperationTypes] = useState<OperationType[]>(() => {
    const saved = localStorage.getItem("operation_types");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Gerenciador de Tipos de Operação (modal de cadastro)
  const [isOperationTypesModalOpen, setIsOperationTypesModalOpen] =
    useState(false);
  const [editingOperationTypeId, setEditingOperationTypeId] = useState<
    string | null
  >(null);
  const [opTypeLabel, setOpTypeLabel] = useState("");
  const [opTypeIcon, setOpTypeIcon] = useState("flag");
  const [opTypeColor, setOpTypeColor] = useState("#2563eb");
  const [opTypeDescription, setOpTypeDescription] = useState("");
  const [opTypeActive, setOpTypeActive] = useState(true);
  /** Formulário compacto de tipo de operação, na ficha do cliente. */
  const [modalTipoAberto, setModalTipoAberto] = useState(false);
  /** Estado da aba de tipos: busca, filtro, página e período do gráfico. */
  const [buscaTipos, setBuscaTipos] = useState("");
  const [filtroTipos, setFiltroTipos] = useState<"todos" | "ativo" | "inativo">(
    "todos",
  );
  const [paginaTipos, setPaginaTipos] = useState(1);
  const [periodoTipos, setPeriodoTipos] = useState<"mes" | "semana" | "tudo">(
    "mes",
  );
  /** Tipo sendo arrastado para trocar de ordem. */
  const [tipoArrastado, setTipoArrastado] = useState<string | null>(null);

  /** Escolas do município do cliente em foco, camada pública do mapa. */
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [escolasLigadas, setEscolasLigadas] = useState(false);
  const [escolaAberta, setEscolaAberta] = useState<Escola | null>(null);

  /** Estado da aba Check-ins: filtros, página e o registro aberto ao lado. */
  const [buscaCheckIns, setBuscaCheckIns] = useState("");
  const [periodoCheckIns, setPeriodoCheckIns] = useState<
    "7" | "30" | "90" | "tudo"
  >("30");
  const [operacaoCheckIns, setOperacaoCheckIns] = useState("todas");
  const [statusCheckIns, setStatusCheckIns] = useState<
    "todos" | "concluido" | "andamento"
  >("todos");
  const [paginaCheckIns, setPaginaCheckIns] = useState(1);
  const [checkInAberto, setCheckInAberto] = useState<string | null>(null);
  /** Recortes do mapa da visão geral: período e nível de prioridade. */
  const [periodoMapaGeral, setPeriodoMapaGeral] = useState<
    "hoje" | "7" | "30" | "tudo"
  >("hoje");
  const [prioridadeMapaGeral, setPrioridadeMapaGeral] = useState("todas");
  /** Lixeira dos check-ins aberta na aba do cliente. */
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [fichaDoCheckIn, setFichaDoCheckIn] = useState<any>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  /** Operações e contagem de arquivos de cada linha da lista. */
  const [resumoCheckIns, setResumoCheckIns] = useState<{
    operacoes: Record<string, string[]>;
    midias: Record<string, { imagens: number; videos: number }>;
  }>({ operacoes: {}, midias: {} });
  /** Check-in aberto em tela cheia, com tudo que o integrante enviou. */
  const [checkInCompleto, setCheckInCompleto] = useState<any>(null);

  /**
   * Pedido de confirmação em aberto.
   *
   * Tudo o que antes chamava o `confirm()` do navegador passa por aqui, para
   * a pergunta aparecer no meio da tela com a cara do sistema.
   */
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );

  // Mapa Mental embutido (metade da tela ou tela cheia).
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [isMindMapFullscreen, setIsMindMapFullscreen] = useState(false);

  /**
   * A sala de situação dos check-ins, na mesma metade de tela do mapa mental.
   *
   * Um painel lateral estreito cabia um filtro; não cabe o que um gestor
   * pergunta antes da reunião das oito. Meia tela cabe — e o mapa continua
   * na outra metade, que é onde as respostas aparecem quando se clica aqui.
   */
  const [salaDeSituacaoAberta, setSalaDeSituacaoAberta] = useState(false);
  const [salaEmTelaCheia, setSalaEmTelaCheia] = useState(false);

  const [adminTab, setAdminTab] = useState<"candidates" | "map">("candidates");
  const [selectedCandidateFilter, setSelectedCandidateFilter] =
    useState<string>("all");

  /**
   * Estado e município do cliente em foco, usados como ponto de partida do
   * painel de endereço e dos formulários de pin e raio. É só um padrão: o
   * usuário continua livre para trocar nos seletores.
   */
  const [candidateLocation, setCandidateLocation] =
    useState<CandidateLocation | null>(null);

  // Candidate management visual states
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateEditing, setCandidateEditing] = useState<any | null>(null);
  const [candName, setCandName] = useState("");
  const [candPhone, setCandPhone] = useState("");
  const [candInstagram, setCandInstagram] = useState("");
  const [candCity, setCandCity] = useState("");
  const [candOffice, setCandOffice] = useState("");
  const [candImage, setCandImage] = useState("");
  const [candSearch, setCandSearch] = useState("");
  const [candPage, setCandPage] = useState(1);
  const [candViewDetail, setCandViewDetail] = useState<any | null>(null);

  // Parties state variables
  const [parties, setParties] = useState<Party[]>(() => {
    const saved = localStorage.getItem("campaign_parties");
    return saved ? JSON.parse(saved) : INITIAL_PARTIES;
  });

  // Helper to get Partido Badge, now accessible across the entire App component
  /** Cor da tarja conforme a sigla, com um azul padrão para as demais. */
  const partyBadgeColor = (initials: string) =>
    initials === "SD"
      ? "bg-orange-50 text-orange-600 border-orange-200 shadow-2xs font-extrabold"
      : initials === "PP"
        ? "bg-sky-50 text-sky-600 border-sky-200 shadow-2xs font-extrabold"
        : initials === "PL"
          ? "bg-blue-50 text-blue-600 border-blue-200 shadow-2xs font-extrabold"
          : initials === "PT"
            ? "bg-rose-50 text-rose-600 border-rose-200 shadow-2xs font-extrabold"
            : "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs font-extrabold";

  const getPartidoBadge = (cand: Candidate) => {
    if (!cand)
      return {
        name: "",
        logo: "",
        fullName: "",
        color: "bg-slate-100 text-slate-700 border-slate-200",
      };

    // O cliente guarda o próprio partido, então quando esse dado existe não há
    // nada a deduzir. Todo o resto abaixo é adivinhação pelo texto do cargo,
    // mantida só para cadastros antigos que não têm o vínculo.
    if (cand.partyInitials) {
      return {
        name: cand.partyInitials,
        logo: cand.partyLogoUrl || "",
        fullName: cand.partyName || cand.partyInitials,
        color: partyBadgeColor(cand.partyInitials),
      };
    }

    if (cand.partyId) {
      const linked = parties.find((p) => p.id === cand.partyId);
      if (linked) {
        return {
          name: linked.initials,
          logo: linked.logo_url,
          fullName: linked.name,
          color: partyBadgeColor(linked.initials),
        };
      }
    }

    const officeUpper = (cand.office || "").toUpperCase();
    const nameUpper = (cand.name || "").toUpperCase();

    // Procura primeiro correspondência em nossa lista de partidos ativa do banco de dados/LocalStorage
    const foundParty = parties.find((p) => {
      const pInitials = (p.initials || "").trim().toUpperCase();
      const pName = (p.name || "").trim().toUpperCase();
      if (!pInitials) return false;

      // Verifica se o cargo ou o nome inclui a sigla ou se o cargo inclui o nome completo do partido
      return (
        officeUpper.includes(`(${pInitials})`) ||
        officeUpper.includes(`-${pInitials}`) ||
        officeUpper.includes(` ${pInitials}`) ||
        officeUpper === pInitials ||
        officeUpper.split(" ").includes(pInitials) ||
        (pName && officeUpper.includes(pName)) ||
        nameUpper.includes(` ${pInitials}`) ||
        nameUpper.includes(`(${pInitials})`)
      );
    });

    if (foundParty) {
      return {
        name: foundParty.initials,
        logo: foundParty.logo_url,
        fullName: foundParty.name,
        color:
          foundParty.initials === "SD"
            ? "bg-orange-50 text-orange-600 border-orange-200 shadow-2xs font-extrabold"
            : foundParty.initials === "PP"
              ? "bg-sky-50 text-sky-600 border-sky-200 shadow-2xs font-extrabold"
              : foundParty.initials === "PL"
                ? "bg-blue-50 text-blue-600 border-blue-200 shadow-2xs font-extrabold"
                : foundParty.initials === "PT"
                  ? "bg-rose-50 text-rose-600 border-rose-200 shadow-2xs font-extrabold"
                  : "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs font-extrabold",
      };
    }

    // Casos clássicos e retrocompatibilidade - determina a sigla correspondente primeiro
    let initials = "";
    if (nameUpper.includes("JOÃO NETO") || officeUpper.includes("SD")) {
      initials = "SD";
    } else if (nameUpper.includes("LUCAS") || officeUpper.includes("PP")) {
      initials = "PP";
    } else {
      const defaultPartidos = ["PL", "MDB", "PSD", "UNIÃO"];
      const charCodeSum = cand.name
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      initials = defaultPartidos[charCodeSum % defaultPartidos.length];
    }

    // Procura a sigla na tabela de partidos cadastrada
    const matchedPartyBySigla = parties.find(
      (p) => (p.initials || "").trim().toUpperCase() === initials.toUpperCase(),
    );
    if (matchedPartyBySigla) {
      return {
        name: matchedPartyBySigla.initials,
        logo: matchedPartyBySigla.logo_url,
        fullName: matchedPartyBySigla.name,
        color:
          initials === "SD"
            ? "bg-orange-50 text-orange-600 border-orange-200"
            : initials === "PP"
              ? "bg-sky-50 text-sky-600 border-sky-200"
              : initials === "PL"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : initials === "PT"
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-slate-100 text-slate-700 border-slate-200",
      };
    }

    // Fallbacks absolutos com o domínio atual correto (dwglbabfqopddrqwddmb)
    const staticLogos: Record<string, string> = {
      SD: PARTY_LOGOS.SD,
      PP: PARTY_LOGOS.PP,
      PL: PARTY_LOGOS.PL,
      PT: PARTY_LOGOS.PT,
    };

    return {
      name: initials,
      logo: staticLogos[initials] || "",
      fullName:
        initials === "SD"
          ? "Solidariedade"
          : initials === "PP"
            ? "Partido Progressistas"
            : initials === "PL"
              ? "Partido Liberal"
              : initials === "PT"
                ? "Partido dos Trabalhadores"
                : initials,
      color:
        initials === "SD"
          ? "bg-orange-50 text-orange-600 border-orange-200"
          : initials === "PP"
            ? "bg-sky-50 text-sky-600 border-sky-200"
            : initials === "PL"
              ? "bg-blue-50 text-blue-600 border-blue-200"
              : initials === "PT"
                ? "bg-rose-50 text-rose-600 border-rose-200"
                : "bg-slate-100 text-slate-700 border-slate-200",
    };
  };

  const [adminSubTab, setAdminSubTab] = useState<"candidates" | "parties">(
    "parties",
  );
  const [partySearch, setPartySearch] = useState("");
  const [inspectedCandidate, setInspectedCandidate] =
    useState<Candidate | null>(null);
  /** Integrante cuja ficha de aparelhos o administrador está olhando. */
  const [membroDosAparelhos, setMembroDosAparelhos] = useState<any>(null);
  const [supporters, setSupporters] = useState<any[]>(() => {
    if (isDatabaseConfigured) return [];
    const saved = localStorage.getItem("campaign_supporters");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: "sup-1",
            full_name: "Carlos Alberto Silva",
            whatsapp: "82999991111",
            candidate_id: "f32daeeb-4384-486d-9781-db4073ec473b",
          },
          {
            id: "sup-2",
            full_name: "Maria Clara Souza",
            whatsapp: "82999992222",
            candidate_id: "f32daeeb-4384-486d-9781-db4073ec473b",
          },
          {
            id: "sup-3",
            full_name: "Renata Vasconcelos",
            whatsapp: "82999993333",
            candidate_id: "d9bba4ce-939e-4e4f-b88a-dfad35bf9db9",
          },
        ];
  });

  /** Qual caminho de cadastro de integrante está aberto. */
  const [teamModal, setTeamModal] = useState<
    "vincular" | "qrcode" | "manual" | "campos" | null
  >(null);
  /** Campos de coleta do cliente em foco, configurados pelo ADM. */
  const [teamFields, setTeamFields] = useState<any[]>([]);

  // UI state variables
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "areas" | "pins" | "statistics" | "checkins"
  >("pins");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  /* ------------------------------------------------------- filtro do mapa ---
   * Quatro cortes sobre os check-ins desenhados: quem, quando, com que
   * urgência e fazendo o quê. Ficam aqui em cima porque é daqui que sai a
   * lista que o mapa recebe.
   */
  /**
   * Ponteiro laser: vale para o painel inteiro, inclusive o mapa.
   *
   * Fica aqui em cima, e não dentro de uma tela, porque o estado precisa
   * sobreviver à navegação — quem ligou o laser na lista de clientes espera
   * encontrá-lo ligado ao abrir o mapa.
   */
  const [laserLigado, setLaserLigado] = useState(false);

  /* ----------------------------------------- estabelecimentos (CCO) ---
   * A pesquisa vem de fora e não vira cadastro: os resultados existem
   * enquanto a pesquisa está em tela, como referência do terreno.
   */
  const [pesquisaLojasAberta, setPesquisaLojasAberta] = useState(false);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [lojaEmFoco, setLojaEmFoco] = useState<string | null>(null);
  /** Ficha aberta no meio da tela: tudo que a pesquisa sabe do lugar. */
  const [lojaAberta, setLojaAberta] = useState<Estabelecimento | null>(null);
  /** Item sob o cursor na lista: acende o pino sem mexer no mapa. */
  const [lojaDestacada, setLojaDestacada] = useState<string | null>(null);

  /* --------------------------------------- inteligência territorial ---
   * População, bairros e Censo do território em que a equipe trabalha.
   * O círculo medido fica desenhado no mapa: numero sem a area a vista e
   * numero para acreditar de olhos fechados.
   */
  const [territorioAberto, setTerritorioAberto] = useState(false);
  const [circuloAnalisado, setCirculoAnalisado] = useState<{
    lat: number;
    lng: number;
    raio: number;
  } | null>(null);
  /** Bairros ou setores desenhados no mapa, e a escala que os pinta. */
  const [recortesTerritoriais, setRecortesTerritoriais] = useState<any[]>([]);
  const [escalaTerritorial, setEscalaTerritorial] = useState<
    { corte: number; cor: string }[]
  >([]);
  const [recorteEmFoco, setRecorteEmFoco] = useState<string | null>(null);
  const receberRecortes = React.useCallback(
    (lista: any[], escala: { corte: number; cor: string }[]) => {
      setRecortesTerritoriais(lista);
      setEscalaTerritorial(escala);
    },
    [],
  );
  /** Leitura do centro e do zoom do mapa, entregue pelo próprio mapa. */
  const lerVistaDoMapaRef = React.useRef<
    (() => { lat: number; lng: number; zoom: number } | null) | null
  >(null);
  /** O mapa entrega aqui como ler a vista dele; guardar é tudo o que fazemos. */
  const registrarVistaDoMapa = React.useCallback(
    (ler: () => { lat: number; lng: number; zoom: number } | null) => {
      lerVistaDoMapaRef.current = ler;
    },
    [],
  );

  const [filtroPessoas, setFiltroPessoas] = useState<string[]>([]);
  /**
   * O recorte de tempo do mapa inteiro.
   *
   * Mora aqui, e não dentro do painel de check-ins, porque vale para as duas
   * camadas: o que a equipe registrou e o que o comitê mandou fazer. `de` e
   * `ate` continuam com os mesmos nomes de antes — eram só dos check-ins e
   * agora cortam também as missões.
   */
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [filtroPrazos, setFiltroPrazos] = useState<
    EstadoDoPeriodo["prazos"]
  >([]);
  const [filtroNiveis, setFiltroNiveis] = useState<string[]>([]);
  const [filtroTiposAcao, setFiltroTiposAcao] = useState<string[]>([]);

  /**
   * Que camadas o mapa desenha.
   *
   * É um estado só, e não um por camada, porque o menu "Visualização" e as
   * chaves da barra de período mexem na mesma coisa: o que aparece no mapa.
   * Dois estados para isso dariam duas respostas diferentes para a mesma
   * pergunta.
   */
  const [mapFilter, setMapFilter] = useState<
    "all" | "checkins" | "markers" | "favoritos" | "nada"
  >("all");

  // Modo de visualização (admin / checkin)
  /**
   * Token do QR Code, quando alguém abre o link de cadastro.
   *
   * O formato novo leva o token depois do `#`, que nunca vai para o servidor.
   * O formato antigo (`?convite=`) continua funcionando para os QR Codes já
   * impressos. Lido o token, o endereço na barra é limpo na hora: quem olha a
   * tela, ou copia o que está ali, vê só o domínio.
   */
  const [inviteToken] = useState<string>(ROTA_INICIAL.convite);
  /** Endereço para onde vai quem abriu o domínio de acesso sem link. */
  const [saidaSemLink, setSaidaSemLink] = useState('');
  /**
   * Níveis de prioridade criados pelo administrador.
   *
   * A lista fixa do código continua como reserva: banco sem a tabela, ou sem
   * nível nenhum cadastrado, não pode deixar a tela sem opção.
   */
  const [priorityLevels, setPriorityLevels] = useState<PriorityLevel[]>([]);

  /* ----------------------------------------------------------- régua ---
   * Medição de distância no mapa. Fica aqui, junto dos demais controles,
   * porque é uma ferramenta do sistema: tem cor, nome, e o que foi medido
   * é guardado por cliente para a equipe inteira ver — não some ao fechar.
   */
  const [reguaLigada, setReguaLigada] = useState(false);
  const [pontosRegua, setPontosRegua] = useState<{ lat: number; lng: number }[]>([]);
  const [corRegua, setCorRegua] = useState("#F58220");

  /** Aba aberta dentro da ficha do cliente. */
  const [abaCliente, setAbaCliente] = useState<
    "geral" | "equipe" | "tipos" | "checkins"
  >("geral");

  /** Estado da aba Equipe: busca, filtro de status, página e ranking. */
  const [buscaEquipe, setBuscaEquipe] = useState("");
  const [filtroEquipe, setFiltroEquipe] = useState<"todos" | "campo" | "ativo">(
    "todos",
  );
  const [paginaEquipe, setPaginaEquipe] = useState(1);
  const [periodoRanking, setPeriodoRanking] = useState<
    "mes" | "semana" | "tudo"
  >("mes");
  const [rankingCompleto, setRankingCompleto] = useState(false);
  /** Integrante aberto no perfil, com os dados e as ações dele. */
  const [membroDoPerfil, setMembroDoPerfil] = useState<any>(null);

  /** Tela aberta na área do administrador. */
  const [telaAdm, setTelaAdm] = useState<'clientes' | 'configuracoes'>('clientes');

  const [currentUrlView, setCurrentUrlView] = useState<"admin" | "checkin">(
    "admin",
  );

  // banco de dados Supporter Auth for Check-In
  const [authenticatedSupporter, setAuthenticatedSupporter] = useState<
    any | null
  >(() => {
    const saved = localStorage.getItem("checkin_supporter");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.whatsapp || parsed.id || parsed.name)) {
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loginWhatsapp, setLoginWhatsapp] = useState("");
  const [isVerifyingLogin, setIsVerifyingLogin] = useState(false);

  /** Atalho no formato antigo, hoje em cima do mesmo balão de confirmação. */
  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      tone?: "danger" | "default";
    },
  ) => {
    askConfirmation({
      title,
      message,
      onConfirm,
      confirmLabel: options?.confirmText,
      cancelLabel: options?.cancelText,
      tone: options?.tone,
    });
  };

  // Admin System Authentication for Map view
  const [adminUser, setAdminUser] = useState<{ email: string } | null>(() => {
    const saved = localStorage.getItem("auth_admin_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isVerifyingAdminLogin, setIsVerifyingAdminLogin] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Formulário de Check-in (Voluntário)
  const [checkInName, setCheckInName] = useState(() => {
    const saved = localStorage.getItem("checkin_supporter");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.name || parsed.nome || parsed.nome_completo || "";
      } catch (e) {
        return "";
      }
    }
    return "";
  });
  const [checkInBairro, setCheckInBairro] = useState("");
  const [checkInRua, setCheckInRua] = useState("");
  // Fotos e vídeos anexados ao check-in. previewUrl é só para exibir na tela;
  // o que vai para o banco é a URL devolvida pelo Storage no envio.
  type CheckInMediaDraft = {
    id: string;
    type: CheckInMediaType;
    previewUrl: string;
    file: File;
  };
  const [checkInMediaDrafts, setCheckInMediaDrafts] = useState<
    CheckInMediaDraft[]
  >([]);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  // Modalidade do check-in: por missão enviada pelo comitê ou livre (sem missão).
  const [checkInMode, setCheckInMode] = useState<CheckInMode>("missao");
  const [checkInPriority, setCheckInPriority] = useState<CheckInPriority | "">(
    "",
  );
  const initialCheckInState = (() => {
    let slug = "";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      const pathParts = pathname.split("/").filter(Boolean);
      let candidateSlugOrId =
        params.get("candidate") ||
        params.get("cand") ||
        params.get("candidateId");

      if (
        pathParts.length > 0 &&
        (pathParts[0] === "checkin" || pathParts[0] === "check-in")
      ) {
        if (pathParts.length > 1) {
          candidateSlugOrId = decodeURIComponent(pathParts[1]);
        }
      }
      slug = candidateSlugOrId || "";
    }

    let matchedId = "";
    const savedCandidatesRaw = typeof localStorage !== "undefined" ? localStorage.getItem("campaign_candidates") : null;
    const tempCandidates = savedCandidatesRaw ? JSON.parse(savedCandidatesRaw) : INITIAL_CANDIDATES;

    if (slug) {
      const cand = tempCandidates.find(
        (c: any) =>
          c.id === slug ||
          slugify(c.name) === slugify(slug),
      );
      if (cand) matchedId = cand.id;
      else matchedId = slug;
    }

    if (!matchedId) {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("checkin_supporter") : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          matchedId = parsed.candidate_id || parsed.candidateId || "";
        } catch (e) {}
      }
    }

    const defaultState = { uf: "AL", name: "Alagoas", candidateId: matchedId };
    if (!matchedId) return defaultState;

    const activeCand = tempCandidates.find((c: any) => c.id === matchedId);
    if (!activeCand) return defaultState;

    const rawCity = candidateLocationText(activeCand);
    if (!rawCity) return defaultState;

    const UF_TO_STATE_NAME: { [key: string]: string } = {
      AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
      DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
      MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
      PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
      RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
      SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
    };

    const cleanStringForMatch = (s: string) => {
      if (!s) return "";
      return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };

    const cleanRawCity = cleanStringForMatch(rawCity);
    const words = rawCity.split(/[\s,/\-]+/).map((w: string) => w.trim().toUpperCase());
    const foundUf = words.find((w: string) => w in UF_TO_STATE_NAME);

    if (foundUf) {
      return { uf: foundUf, name: UF_TO_STATE_NAME[foundUf], candidateId: matchedId };
    }

    const foundStateKey = Object.keys(UF_TO_STATE_NAME)
      .sort((a, b) => UF_TO_STATE_NAME[b].length - UF_TO_STATE_NAME[a].length)
      .find((key) => {
        const stateNameCleaned = cleanStringForMatch(UF_TO_STATE_NAME[key]);
        return (
          cleanRawCity === stateNameCleaned ||
          cleanRawCity.includes(stateNameCleaned)
        );
      });

    if (foundStateKey) {
      return { uf: foundStateKey, name: UF_TO_STATE_NAME[foundStateKey], candidateId: matchedId };
    }

    if (
      cleanRawCity.includes("joao pessoa") ||
      cleanRawCity.includes("campina grande") ||
      cleanRawCity.includes("cabedelo") ||
      cleanRawCity.includes("patos") ||
      cleanRawCity.includes("paraiba")
    ) {
      return { uf: "PB", name: "Paraíba", candidateId: matchedId };
    }

    if (
      cleanRawCity.includes("maceio") ||
      cleanRawCity.includes("arapiraca") ||
      cleanRawCity.includes("palmeira") ||
      cleanRawCity.includes("alagoas")
    ) {
      return { uf: "AL", name: "Alagoas", candidateId: matchedId };
    }

    return defaultState;
  })();

  const [checkInCandidateId, setCheckInCandidateId] = useState<string>(initialCheckInState.candidateId);

  // For the new check-in flow with State and Municipio & synchronized initial states
  const [checkInEstado, setCheckInEstado] = useState(initialCheckInState.name);
  const [checkInEstadoUf, setCheckInEstadoUf] = useState(initialCheckInState.uf);
  const [checkInMunicipio, setCheckInMunicipio] = useState(() => {
    return initialCheckInState.uf === "PB" ? "João Pessoa" : "Maceió";
  });
  const [checkInMunicipioIbgeId, setCheckInMunicipioIbgeId] = useState<number>(() => {
    return initialCheckInState.uf === "PB" ? 2507507 : 2704302; // João Pessoa: 2507507, Maceió: 2704302
  });
  const [checkInDistrictId, setCheckInDistrictId] = useState<number | null>(
    null,
  );

  const [checkInCities, setCheckInCities] = useState<
    { id: number; ibgeId: number; name: string }[]
  >([]);
  const [checkInDistricts, setCheckInDistricts] = useState<
    { id: number; name: string }[]
  >([]);
  const [checkInStreets, setCheckInStreets] = useState<StreetOption[]>([]);

  const [prefetchedLatitude, setPrefetchedLatitude] = useState<number | undefined>(undefined);
  const [prefetchedLongitude, setPrefetchedLongitude] = useState<number | undefined>(undefined);

  const [isCheckInPageInitializing, setIsCheckInPageInitializing] =
    useState(true);

  /**
   * Atalhos do laser: L liga e desliga, Esc desliga.
   *
   * Só no painel do administrador — o app de campo e as telas públicas não
   * têm apresentação para fazer. Digitar num campo nunca aciona o atalho,
   * senão escrever "Laranja" no nome de uma área acenderia o laser.
   */
  useEffect(() => {
    if (!adminUser || currentUrlView === "checkin") return;

    const noTeclado = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.tagName === "SELECT" ||
          alvo.isContentEditable);
      if (digitando) return;

      if (e.key === "Escape") {
        setLaserLigado((ligado) => (ligado ? false : ligado));
        return;
      }
      // Com Ctrl, Alt ou Meta a tecla é de outro atalho, do sistema ou do
      // navegador: o laser não se mete.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setLaserLigado((ligado) => !ligado);
      }
    };

    window.addEventListener("keydown", noTeclado);
    return () => window.removeEventListener("keydown", noTeclado);
  }, [adminUser, currentUrlView]);

  // Sessão encerrada ou saída do painel: o laser não fica ligado sozinho.
  useEffect(() => {
    if (!adminUser || currentUrlView === "checkin") setLaserLigado(false);
  }, [adminUser, currentUrlView]);

  // Pre-emptively request exact physical GPS coordinates from browser as soon as accessing the check-in screen
  useEffect(() => {
    if (currentUrlView === "checkin") {
      setIsCheckInPageInitializing(true);
      const timer = setTimeout(() => {
        setIsCheckInPageInitializing(false);
      }, 1500);

      if (typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setPrefetchedLatitude(pos.coords.latitude);
            setPrefetchedLongitude(pos.coords.longitude);
            console.log("Pre-emptively captured GPS automatically:", pos.coords.latitude, pos.coords.longitude);
          },
          (geoErr) => {
            console.warn("Pre-emptively failed to get GPS automatically:", geoErr);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
          }
        );
      }

      return () => clearTimeout(timer);
    }
  }, [currentUrlView]);

  const [loadingCheckInCities, setLoadingCheckInCities] = useState(false);
  const [loadingCheckInDistricts, setLoadingCheckInDistricts] = useState(false);
  const [loadingCheckInStreets, setLoadingCheckInStreets] = useState(false);
  const [loadingCheckInOsmStreets, setLoadingCheckInOsmStreets] =
    useState(false);

  // States to make check-in dropdowns searchable/custom
  const [checkInBairroSearch, setCheckInBairroSearch] = useState("");
  const [checkInBairroDropdownOpen, setCheckInBairroDropdownOpen] =
    useState(false);
  const [checkInRuaSearch, setCheckInRuaSearch] = useState("");
  const [checkInRuaDropdownOpen, setCheckInRuaDropdownOpen] = useState(false);
  const [checkInBairroManual, setCheckInBairroManual] = useState(false);
  const [checkInRuaManual, setCheckInRuaManual] = useState(false);
  const [checkInMunicipioManual, setCheckInMunicipioManual] = useState(false);
  const [checkInMunicipioSearch, setCheckInMunicipioSearch] = useState("");
  const [checkInMunicipioDropdownOpen, setCheckInMunicipioDropdownOpen] =
    useState(false);

  // banco de dados Sync States
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [isSyncingDatabase, setIsSyncingDatabase] = useState(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);

  /* ----------------------------------------------------------- régua ---- */

  /** Distância entre dois pontos, em metros (fórmula de Haversine). */
  const distanciaEmMetros = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ) => {
    const R = 6371000;
    const rad = (g: number) => (g * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const somaDoCaminho = (pontos: { lat: number; lng: number }[]) =>
    pontos.reduce(
      (total, ponto, i) => (i === 0 ? 0 : total + distanciaEmMetros(pontos[i - 1], ponto)),
      0,
    );

  /** Como a distância se lê em campo: metros até um quilômetro, depois km. */
  const formatarMedida = (metros: number) =>
    metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(2)} km`;

  const totalRegua = somaDoCaminho(pontosRegua);

  /** Zera a medição em andamento. A régua é uma ferramenta de agora. */
  const limparReguaEmAndamento = () => setPontosRegua([]);

  /** Frase de apoio da régua, conforme o que já foi marcado. */
  const contarPontosRegua = () =>
    pontosRegua.length === 0
      ? "Toque no mapa para marcar o primeiro ponto."
      : pontosRegua.length === 1
        ? "Marque o próximo ponto para ver a distância."
        : `${pontosRegua.length} pontos marcados.`;

  /**
   * Equipe de todos os clientes.
   *
   * O cartão de cada cliente mostra quantos integrantes ele tem, e até aqui a
   * lista só era buscada ao abrir um cliente — na tela inicial ela estava
   * vazia, e todo mundo aparecia com zero.
   */
  useEffect(() => {
    if (ROTA_INICIAL.semLink) return;
    (async () => {
      const res = await DatabaseService.fetchSupporters();
      if (res.success && res.data) setSupporters(res.data);
    })();
  }, []);

  // Níveis de prioridade: a lista é do administrador, não do código.
  useEffect(() => {
    if (ROTA_INICIAL.semLink) return;
    (async () => {
      const res = await DatabaseService.fetchPriorityLevels();
      if (res.data.length > 0) setPriorityLevels(res.data);
    })();
  }, []);

  /**
   * O relógio da campanha.
   *
   * Vem do banco porque é do sistema, não do navegador de quem abriu. Até
   * ele chegar valem os horários de fábrica — o formulário nunca fica sem
   * turno para oferecer.
   */
  const [turnosDaCampanha, setTurnosDaCampanha] =
    useState<JanelaDeTurno[]>(TURNOS_PADRAO);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await DatabaseService.lerConfiguracao(CHAVE_TURNOS);
      if (vivo && res.value) setTurnosDaCampanha(lerTurnos(res.value));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Quem digitou só o domínio de acesso, sem link, vai para fora do sistema.
  useEffect(() => {
    if (!ROTA_INICIAL.semLink) return;
    let vivo = true;
    (async () => {
      const res = await DatabaseService.lerConfiguracao(CHAVE_REDIRECIONAMENTO);
      if (!vivo) return;
      const destino = res.value || REDIRECIONAMENTO_PADRAO;
      setSaidaSemLink(destino);
      // replace, e não href: o botão de voltar não traz a pessoa de volta.
      window.location.replace(destino);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Monitorar query parameter e caminhos para entrar no modo check-in (com suporte a checkin/slug)
  useEffect(() => {
    const handleUrlCheck = () => {
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      const pathParts = pathname.split("/").filter(Boolean);

      const doFragmento = ROTA_INICIAL.equipe;

      let isCheckIn = doFragmento !== "" || params.get("view") === "checkin";
      let candidateSlugOrId =
        doFragmento ||
        params.get("candidate") ||
        params.get("cand") ||
        params.get("candidateId");

      if (
        pathParts.length > 0 &&
        (pathParts[0] === "checkin" || pathParts[0] === "check-in")
      ) {
        isCheckIn = true;
        if (pathParts.length > 1) {
          candidateSlugOrId = decodeURIComponent(pathParts[1]);
        }
      }

      if (isCheckIn) {
        setCurrentUrlView("checkin");


        if (candidateSlugOrId) {
          // Encontra o cliente por ID ou por slug de nome
          const cand = candidates.find(
            (c) =>
              c.id === candidateSlugOrId ||
              slugify(c.name) === slugify(candidateSlugOrId),
          );
          const solvedCandidateId = cand ? cand.id : candidateSlugOrId;
          setCheckInCandidateId(solvedCandidateId);

          // Mantém o localStorage sincronizado
          const saved = localStorage.getItem("checkin_supporter");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              parsed.candidate_id = solvedCandidateId;
              parsed.candidateId = solvedCandidateId;
              localStorage.setItem("checkin_supporter", JSON.stringify(parsed));
            } catch (e) {
              localStorage.setItem(
                "checkin_supporter",
                JSON.stringify({ candidate_id: solvedCandidateId }),
              );
            }
          } else {
            localStorage.setItem(
              "checkin_supporter",
              JSON.stringify({ candidate_id: solvedCandidateId }),
            );
          }
        }
      } else {
        setCurrentUrlView("admin");
      }
    };
    handleUrlCheck();
    window.addEventListener("popstate", handleUrlCheck);
    return () => window.removeEventListener("popstate", handleUrlCheck);
  }, [candidates]);

  // Sync / Load data from banco de dados on mount
  useEffect(() => {
    if (!isDatabaseConfigured) {
      console.log(
        "Banco de dados não configurado. Usando armazenamento local.",
      );
      return;
    }

    const loadAllFromDatabase = async () => {
      setIsSyncingDatabase(true);
      setDatabaseError(null);
      const res = await DatabaseService.fetchAll();
      if (res.success && res.data) {
        const {
          areas: fetchedAreas,
          pins: fetchedPins,
          checkins: fetchedCheckins,
        } = res.data;

        // O banco manda, inclusive quando a resposta vem vazia.
        //
        // Antes o app fazia duas coisas que se somavam num estrago: quando as
        // três tabelas voltavam vazias, ele reenviava a cópia local para o
        // banco, e quando uma delas voltava vazia, ele mantinha a cópia local
        // na tela. Resultado: apagar o último registro não adiantava nada --
        // na carga seguinte ele era gravado de novo, do navegador para o
        // banco. Apagado é apagado.
        setAreas(fetchedAreas);
        setPins(fetchedPins);
        setCheckIns(fetchedCheckins);

        // Clientes e partidos não vêm mais do banco de dados: a fonte é a base externa,
        // carregado no efeito logo abaixo.

        // A Equipe também vem da base externa, no efeito mais abaixo.
      } else if (res.error) {
        setDatabaseError(res.error);
        triggerNotification(res.error, "error");
      }
      setIsSyncingDatabase(false);
    };

    loadAllFromDatabase();
  }, []); // Only on mount

  // Tipos de Operação vindos do banco de dados.
  // Banco vazio (primeiro acesso) recebe a lista padrão para que a instalação
  // já comece utilizável; a partir daí quem manda é o que está gravado lá.
  useEffect(() => {
    if (!isDatabaseConfigured) return;

    let active = true;

    (async () => {
      const res = await DatabaseService.fetchOperationTypes();
      if (!active) return;

      if (!res.success) return;

      setOperationTypes(
        [...res.data].sort((a, b) =>
          (a.label || "").localeCompare(b.label || "", "pt-BR"),
        ),
      );
    })();

    return () => {
      active = false;
    };
  }, []);

  // Escuta em Realtime das alterações do banco de dados para manter tudo sincronizado de forma instantânea
  useEffect(() => {
    if (!isDatabaseConfigured || !db) return;

    const channel = db
      .channel("realtime_campaign_data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "check_ins" },
        (payload: any) => {
          console.log("Sincronização em Tempo Real (Check-In):", payload);
          if (payload.eventType === "INSERT") {
            // O payload vem com os nomes crus das colunas; sem normalizar, o
            // candidateId some e o pino não passa no filtro do mapa.
            const newCheckIn = normalizeRecord<CheckIn>(payload.new);
            setCheckIns((prev) => {
              if (prev.some((c) => c.id === newCheckIn.id)) return prev;
              return [newCheckIn, ...prev];
            });
            triggerNotification(
              `Novo Check-in registrado por ${newCheckIn.name}!`,
              "success",
            );
          } else if (payload.eventType === "UPDATE") {
            const updatedCheckIn = normalizeRecord<CheckIn>(payload.new);
            setCheckIns((prev) =>
              prev.map((c) =>
                c.id === updatedCheckIn.id ? updatedCheckIn : c,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setCheckIns((prev) => prev.filter((c) => c.id !== deletedId));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "panfletagem_areas" },
        (payload: any) => {
          console.log("Sincronização em Tempo Real (Área):", payload);
          if (payload.eventType === "INSERT") {
            const newArea = normalizeRecord<PanfletagemArea>(payload.new);
            setAreas((prev) => {
              if (prev.some((a) => a.id === newArea.id)) return prev;
              return [...prev, newArea];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedArea = normalizeRecord<PanfletagemArea>(payload.new);
            setAreas((prev) =>
              prev.map((a) => (a.id === updatedArea.id ? updatedArea : a)),
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setAreas((prev) => prev.filter((a) => a.id !== deletedId));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_pins" },
        (payload: any) => {
          console.log("Sincronização em Tempo Real (Marcação):", payload);
          if (payload.eventType === "INSERT") {
            const newPin = normalizeRecord<CampaignPin>(payload.new);
            setPins((prev) => {
              if (prev.some((p) => p.id === newPin.id)) return prev;
              return [...prev, newPin];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedPin = normalizeRecord<CampaignPin>(payload.new);
            setPins((prev) =>
              prev.map((p) => (p.id === updatedPin.id ? updatedPin : p)),
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setPins((prev) => prev.filter((p) => p.id !== deletedId));
          }
        },
      )
      .subscribe((status) => {
        console.log("Subscrição em tempo real status:", status);
      });

    return () => {
      db.removeChannel(channel);
    };
  }, []);

  // Coordinating map selecting interaction
  /**
   * Como o usuário vai informar o local do pin ou do raio.
   *
   * "ask" é a pergunta inicial; "search" abre o formulário de endereço;
   * "map" tira o formulário da frente para ele clicar direto no mapa.
   */
  const [creationLocationMode, setCreationLocationMode] = useState<
    "ask" | "search" | "map" | "sem" | null
  >(null);
  /**
   * Material de apoio da missão em edição, área ou ponto.
   *
   * Um estado só para os dois formulários porque só um deles fica aberto por
   * vez, e porque o arquivo já subiu para o Storage antes de a missão existir:
   * quem desiste no meio precisa de alguém para apagar o que ficou.
   */
  const [materialMissao, setMaterialMissao] = useState<ItemMaterial[]>([]);
  const [isResolvingPickedAddress, setIsResolvingPickedAddress] =
    useState(false);
  const [pickedAddressLabel, setPickedAddressLabel] = useState<string | null>(
    null,
  );

  const [clickToPickCoords, setClickToPickCoords] = useState(false);
  /** Centro marcado, agora é a vez de arrastar o raio direto no mapa. */
  const [definindoRaio, setDefinindoRaio] = useState(false);
  /**
   * Passo depois do desenho da área.
   *
   * 'pergunta' é a escolha de dar ou não um nome; 'campos' só aparece para
   * quem disse que quer. Quem não quer sai daqui com a área salva num toque.
   */
  const [nomeandoRaio, setNomeandoRaio] = useState<null | "pergunta" | "campos">(
    null,
  );
  const [coordsPickingMode, setCoordsPickingMode] = useState<"area" | "pin">(
    "area",
  );
  const [pickedCoords, setPickedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Creation cascading flow state variables
  const [creationBairroName, setCreationBairroName] = useState<string | null>(
    null,
  );
  const [creationRuaName, setCreationRuaName] = useState<string | null>(null);
  const [creationModalType, setCreationModalType] = useState<
    "area" | "pin" | null
  >(null);

  // Brasil Aberto lists & selections
  const [brasilStates, setBrasilStates] = useState<
    { name: string; shortName: string }[]
  >([]);
  const [brasilCities, setBrasilCities] = useState<
    { id: number; ibgeId: number; name: string }[]
  >([]);
  const [brasilDistricts, setBrasilDistricts] = useState<
    { id: number; name: string }[]
  >([]);
  const [brasilStreets, setBrasilStreets] = useState<StreetOption[]>([]);

  const [creationStateShortName, setCreationStateShortName] = useState<
    string | null
  >("AL"); // Default to Alagoas
  const [creationStateName, setCreationStateName] = useState<string | null>(
    "Alagoas",
  );
  const [creationCityIbgeId, setCreationCityIbgeId] = useState<number | null>(
    2704302,
  ); // Default to Maceió
  const [creationCityName, setCreationCityName] = useState<string | null>(
    "Maceió",
  );
  const [creationDistrictId, setCreationDistrictId] = useState<number | null>(
    null,
  );

  // States for search filters and dropdown toggles in the creation modal
  const [modalStateSearch, setModalStateSearch] = useState("");
  const [modalCitySearch, setModalCitySearch] = useState("");
  const [modalBairroSearch, setModalBairroSearch] = useState("");
  const [modalRuaSearch, setModalRuaSearch] = useState("");

  const [modalStateDropdownOpen, setModalStateDropdownOpen] = useState(false);
  const [modalCityDropdownOpen, setModalCityDropdownOpen] = useState(false);
  const [modalBairroDropdownOpen, setModalBairroDropdownOpen] = useState(false);
  const [modalRuaDropdownOpen, setModalRuaDropdownOpen] = useState(false);

  // Loading states
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingStreets, setLoadingStreets] = useState(false);
  const [loadingOsmStreets, setLoadingOsmStreets] = useState(false);

  // Forms state variables (Area)
  const [areaTitle, setAreaTitle] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [areaBairro, setAreaBairro] = useState("");
  // Raio e equipe nascem em branco: quem define o raio e o arrasto no mapa.
  const [areaRadius, setAreaRadius] = useState<number | "">("");
  const [areaColor, setAreaColor] = useState("#2563eb");
  const [areaTeamSize, setAreaTeamSize] = useState<number | "">("");
  const [areaContact, setAreaContact] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [areaCandidateId, setAreaCandidateId] = useState<string>("");
  const [selectedDeltas, setSelectedDeltas] = useState<string[]>([]);

  // Forms state variables (Pin)
  const [pinTitle, setPinTitle] = useState("");
  const [pinDescription, setPinDescription] = useState("");
  const [pinColor, setPinColor] = useState("#ea580c");
  // Id do Tipo de Operação escolhido para o ponto.
  const [pinIconType, setPinIconType] = useState<string>("");
  const [pinDate, setPinDate] = useState("");
  /**
   * Turno e prioridade da missão em edição.
   *
   * Um par só para ponto e área: as duas são a mesma missão vista de dois
   * jeitos, e o formulário nunca mostra as duas ao mesmo tempo. Dois pares
   * separados só dariam chance de salvar o de um lado com o valor do outro.
   */
  const [missaoTurno, setMissaoTurno] = useState<TurnoId | "">("");
  const [missaoPrioridade, setMissaoPrioridade] = useState("");
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [pinCandidateId, setPinCandidateId] = useState<string>("");

  /**
   * Como a missão estava quando o editor abriu.
   *
   * Serve a três coisas que a edição precisa e a criação não: voltar atrás
   * quando quem foi mover o ponto no mapa desiste, saber se o lugar mudou de
   * verdade (senão o endereço do banco seria reescrito à toa a cada abertura)
   * e descobrir qual material de apoio foi tirado, para o arquivo sair também
   * do Storage em vez de ficar lá sem dono.
   */
  const [edicaoOriginal, setEdicaoOriginal] = useState<{
    coords: { lat: number; lng: number } | null;
    radius: number | "";
    material: MaterialDeApoio[];
  } | null>(null);

  /**
   * Cliente que dita o padrão de estado e município.
   *
   * Dentro do formulário vale o cliente escolhido nele; fora, vale o
   * cliente filtrado no mapa. Sem cliente em foco, não há padrão.
   */
  const locationCandidateId =
    (creationModalType === "area" ? areaCandidateId : "") ||
    (creationModalType === "pin" ? pinCandidateId : "") ||
    (selectedCandidateFilter !== "all" ? selectedCandidateFilter : "");

  // Descobre estado e município do cliente em foco.
  useEffect(() => {
    const candidate = candidates.find((c) => c.id === locationCandidateId);
    if (!candidate) {
      setCandidateLocation(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    (async () => {
      const location = await resolveCandidateLocation(
        candidateLocationText(candidate),
        controller.signal,
      );
      if (!active) return;
      // Mantém o objeto anterior quando nada mudou, para não reiniciar a
      // seleção que o usuário já fez nos seletores.
      setCandidateLocation((previous) =>
        previous &&
        location &&
        previous.uf === location.uf &&
        previous.cityName === location.cityName
          ? previous
          : location,
      );
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [locationCandidateId, candidates]);

  // Casa o município que ainda está só pelo nome — o do cliente, por exemplo
  // — com o registro oficial, que é quem traz o código IBGE usado para listar
  // os bairros. Fica em efeito próprio porque precisa rodar tanto quando a
  // lista de municípios chega quanto quando o cliente muda sem trocar de
  // estado.
  useEffect(() => {
    if (creationCityIbgeId || !creationCityName || brasilCities.length === 0) {
      return;
    }
    const wanted = normalizeCityName(creationCityName);
    const match = brasilCities.find(
      (c) => normalizeCityName(c.name) === wanted,
    );
    if (match) {
      setCreationCityIbgeId(match.ibgeId);
      setCreationCityName(match.name);
    }
  }, [brasilCities, creationCityIbgeId, creationCityName]);

  /**
   * Código IBGE do município do cliente, quando ele já aparece na lista de
   * municípios carregada para o estado.
   */
  const candidateCityIbgeId = React.useMemo(() => {
    if (!candidateLocation?.cityName) return null;
    const wanted = normalizeCityName(candidateLocation.cityName);
    const match = brasilCities.find(
      (c) => normalizeCityName(c.name) === wanted,
    );
    return match?.ibgeId ?? null;
  }, [candidateLocation, brasilCities]);

  /**
   * O editor aberto está mexendo numa missão que já existe?
   *
   * O mesmo formulário cria e edita — mudam os textos, o botão de salvar, o
   * de excluir e o direito de desistir do que já estava gravado.
   */
  const editandoNoModal =
    creationModalType === "pin"
      ? !!editingPinId
      : creationModalType === "area"
        ? !!editingAreaId
        : false;

  /** Id da missão aberta no editor, para o mapa tirá-la do desenho. */
  const itemEmEdicaoId = editandoNoModal
    ? creationModalType === "pin"
      ? editingPinId
      : editingAreaId
    : null;

  /** O lugar escolhido agora é o mesmo de quando o editor abriu? */
  const localIntocadoNaEdicao =
    !!edicaoOriginal &&
    !!edicaoOriginal.coords &&
    !!pickedCoords &&
    Math.abs(edicaoOriginal.coords.lat - pickedCoords.lat) < 1e-9 &&
    Math.abs(edicaoOriginal.coords.lng - pickedCoords.lng) < 1e-9;

  /**
   * O local do pin ou do raio já está definido? Depende do caminho escolhido:
   * pela busca, quando bairro e rua estão preenchidos; pelo mapa, quando o
   * ponto foi clicado.
   */
  const creationLocationReady =
    creationLocationMode === "map"
      ? !!pickedCoords
      : creationLocationMode === "search"
        ? !!(creationBairroName && creationRuaName)
        : // Missão sem local não tem o que esperar: o passo do endereço não existe.
          creationLocationMode === "sem";

  /**
   * Cliente do link de check-in compartilhado pelo mapa.
   *
   * O link precisa apontar para um cliente: é ele que identifica de quem é o
   * check-in. Sem cliente em foco não há link a oferecer.
   */
  const shareCandidate =
    selectedCandidateFilter !== "all"
      ? candidates.find((c) => c.id === selectedCandidateFilter)
      : undefined;

  const shareCheckInUrl = shareCandidate ? linkDaEquipe(shareCandidate.id) : "";

  /** Ponto de partida do painel de endereço no mapa. */
  const mapDefaultLocation = candidateLocation
    ? {
        uf: candidateLocation.uf,
        stateName: candidateLocation.stateName,
        cityIbgeId: candidateCityIbgeId,
        cityName: candidateLocation.cityName,
      }
    : {
        uf: "AL",
        stateName: "Alagoas",
        cityIbgeId: 2704302,
        cityName: "Maceió",
      };

  /**
   * Devolve os seletores ao padrão do cliente em foco. Sem cliente, cai no
   * padrão histórico do sistema.
   */
  const applyDefaultCreationLocation = () => {
    if (candidateLocation) {
      setCreationStateShortName(candidateLocation.uf);
      setCreationStateName(candidateLocation.stateName);
      setCreationCityIbgeId(null);
      setCreationCityName(candidateLocation.cityName);
      return;
    }
    setCreationStateShortName("AL");
    setCreationStateName("Alagoas");
    setCreationCityIbgeId(2704302);
    setCreationCityName("Maceió");
  };

  // Aplica esse padrão aos seletores. Roda quando o cliente em foco muda, e
  // não a cada render, então a escolha manual do usuário é preservada até ele
  // trocar de cliente.
  useEffect(() => {
    if (!candidateLocation) return;
    setCreationStateShortName(candidateLocation.uf);
    setCreationStateName(candidateLocation.stateName);
    setCreationCityIbgeId(null);
    setCreationCityName(candidateLocation.cityName);
    setCreationDistrictId(null);
    setCreationBairroName(null);
    setCreationRuaName(null);
  }, [candidateLocation]);


  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

  // Geocode address using OpenStreetMap Nominatim with extensive fallback strategy
  const geocodeAddress = async (
    street: string,
    bair: string,
    city: string,
    state: string,
  ) => {
    setIsGeocoding(true);

    // Create query priority list to maximize match chances
    const queries: string[] = [];
    if (street && street.trim()) {
      queries.push(`${street}, ${bair}, ${city}, ${state}, Brasil`);
      queries.push(`${street}, ${city}, ${state}, Brasil`);

      // Clean up common prefixes to help matching if needed
      const cleanStreet = street.replace(
        /^(Rua|Avenida|Av\.|Travessa|Al\.|Alameda|Rodovia|Rod\.)\s+/i,
        "",
      );
      if (cleanStreet !== street) {
        queries.push(`${cleanStreet}, ${bair}, ${city}, ${state}, Brasil`);
        queries.push(`${cleanStreet}, ${city}, ${state}, Brasil`);
      }
    }

    if (bair && bair.trim()) {
      queries.push(`${bair}, ${city}, ${state}, Brasil`);
    }
    queries.push(`${city}, ${state}, Brasil`);

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const item = data[0];
            const coords = {
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
            setPickedCoords(coords);

            // Show custom message depending on fallback layer
            if (q.includes(street)) {
              triggerNotification(
                "Endereço localizado no mapa com sucesso!",
                "success",
              );
            } else if (q.includes(bair)) {
              triggerNotification(
                "Rua física exata não localizada. Posicionado no centro do bairro!",
                "info",
              );
            } else {
              triggerNotification(
                "Bairro não localizado. Posicionado no centro do município!",
                "info",
              );
            }
            setIsGeocoding(false);
            return coords;
          }
        }
      } catch (err) {
        console.warn(`Erro na tentativa de geocode ${i + 1} ("${q}"):`, err);
        // Se falhar de primeira com erro de rede ou CORS bloqueado, as próximas também falharão
        // Interrompe o loop imediatamente para não segurar o formulário travado
        const errMsg = String(err).toLowerCase();
        if (
          errMsg.includes("failed to fetch") ||
          errMsg.includes("networkerror") ||
          errMsg.includes("cors")
        ) {
          break;
        }
      }
    }

    // Default fallback if everything fails
    setIsGeocoding(false);
    triggerNotification(
      "Não foi possível geolocalizar o endereço online. Digite os dados e marque clicando no mapa.",
      "error",
    );
    return null;
  };

  // Load States initially
  useEffect(() => {
    const loadStates = async () => {
      setLoadingStates(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const response = await fetch("https://api.brasilaberto.com/v1/states", {
          headers,
        });
        if (response.ok) {
          const res = await response.json();
          if (res && res.result) {
            setBrasilStates(res.result);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar estados:", err);
      } finally {
        setLoadingStates(false);
      }
    };
    if (creationModalType || currentUrlView === "checkin") {
      loadStates();
    }
  }, [creationModalType, currentUrlView]);

  // Fetch Cities when State changes
  useEffect(() => {
    if (!creationStateShortName) {
      setBrasilCities([]);
      return;
    }
    const loadCities = async () => {
      setLoadingCities(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const response = await fetch(
          `https://api.brasilaberto.com/v1/cities/${creationStateShortName}`,
          { headers },
        );
        if (response.ok) {
          const res = await response.json();
          if (res && res.result) {
            setBrasilCities(res.result);
          }
        }
      } catch (err) {
        console.error(
          `Erro ao carregar cidades de ${creationStateShortName}:`,
          err,
        );
      } finally {
        setLoadingCities(false);
      }
    };
    loadCities();
  }, [creationStateShortName]);

  // Fetch Districts when City IBGE ID changes
  useEffect(() => {
    if (!creationCityIbgeId) {
      setBrasilDistricts([]);
      return;
    }
    const loadDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const response = await fetch(
          `https://api.brasilaberto.com/v1/districts-by-ibge-code/${creationCityIbgeId}`,
          { headers },
        );
        if (response.ok) {
          const res = await response.json();
          if (res && res.result) {
            setBrasilDistricts(res.result);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar bairros:", err);
      } finally {
        setLoadingDistricts(false);
      }
    };
    loadDistricts();
  }, [creationCityIbgeId]);

  // Fetch Streets when District ID changes
  useEffect(() => {
    if (!creationDistrictId) {
      setBrasilStreets([]);
      setLoadingOsmStreets(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const bairro = creationBairroName || "";
    const city = creationCityName || "";
    const state = creationStateShortName || "";

    setLoadingStreets(true);
    setLoadingOsmStreets(true);

    (async () => {
      const cepRequest = fetchCepStreets(creationDistrictId, controller.signal);
      const osmRequest = fetchOsmStreets(
        bairro,
        city,
        state,
        controller.signal,
      );

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
  }, [
    creationDistrictId,
    creationBairroName,
    creationCityName,
    creationStateShortName,
  ]);

  // 0.9 Sincronizar apoiador com o banco de dados quando carregar a tela de checkin
  useEffect(() => {
    if (
      currentUrlView !== "checkin" ||
      !isDatabaseConfigured ||
      !authenticatedSupporter?.whatsapp
    )
      return;

    const syncSupporterData = async () => {
      try {
        const cleanWhatsapp = authenticatedSupporter.whatsapp.replace(
          /\D/g,
          "",
        );
        const res = await DatabaseService.checkSupporter(cleanWhatsapp);
        if (res.success && res.supporter) {
          const sup = res.supporter;
          const sName =
            sup.full_name ||
            sup.name ||
            sup.nome ||
            sup.nome_completo ||
            "Apoiador Cadastrado";
          const sImage = sup.image || sup.foto_url || "";
          const sCandId = sup.candidate_id || sup.candidateId || "";

          const updatedAuth = {
            id: sup.id || authenticatedSupporter.id,
            name: sName,
            full_name: sup.full_name || sName,
            whatsapp: sup.whatsapp,
            image: sImage,
            candidate_id: sCandId,
          };

          setAuthenticatedSupporter(updatedAuth);
          localStorage.setItem(
            "checkin_supporter",
            JSON.stringify(updatedAuth),
          );
          setCheckInName(sName);
          if (sCandId) {
            setCheckInCandidateId(sCandId);
          }
        }
      } catch (err) {
        console.error(
          "Erro ao sincronizar dados do integrante:",
          err,
        );
      }
    };

    syncSupporterData();
  }, [currentUrlView, isDatabaseConfigured]);

  // 1. Load Cities based on selected state UF or Candidate's state
  useEffect(() => {
    if (currentUrlView !== "checkin" || !checkInEstadoUf) return;
    
    // Clear previously loaded cities immediately so we don't display Alagoas cities
    // while the current state's cities are loading, or if the API fetch fails/retries.
    setCheckInCities([]);

    let active = true;

    const loadCheckInCities = async () => {
      setLoadingCheckInCities(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const response = await fetch(
          `https://api.brasilaberto.com/v1/cities/${checkInEstadoUf}`,
          { headers },
        );
        if (response.ok) {
          const res = await response.json();
          if (active && res && res.result) {
            setCheckInCities(res.result);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar cidades do check-in:", err);
      } finally {
        if (active) {
          setLoadingCheckInCities(false);
        }
      }
    };
    loadCheckInCities();

    return () => {
      active = false;
    };
  }, [currentUrlView, checkInEstadoUf]);

  // 1.1 Automatically set and update checkInEstado and checkInEstadoUf based on selected candidate
  useEffect(() => {
    if (
      currentUrlView !== "checkin" ||
      !checkInCandidateId ||
      candidates.length === 0
    )
      return;

    const activeCand = candidates.find((c) => c.id === checkInCandidateId);
    if (!activeCand) return;

    const rawCity = candidateLocationText(activeCand);
    let uf = "AL";

    const UF_TO_STATE_NAME: { [key: string]: string } = {
      AC: "Acre",
      AL: "Alagoas",
      AP: "Amapá",
      AM: "Amazonas",
      BA: "Bahia",
      CE: "Ceará",
      DF: "Distrito Federal",
      ES: "Espírito Santo",
      GO: "Goiás",
      MA: "Maranhão",
      MT: "Mato Grosso",
      MS: "Mato Grosso do Sul",
      MG: "Minas Gerais",
      PA: "Pará",
      PB: "Paraíba",
      PR: "Paraná",
      PE: "Pernambuco",
      PI: "Piauí",
      RJ: "Rio de Janeiro",
      RN: "Rio Grande do Norte",
      RS: "Rio Grande do Sul",
      RO: "Rondônia",
      RR: "Roraima",
      SC: "Santa Catarina",
      SP: "São Paulo",
      SE: "Sergipe",
      TO: "Tocantins",
    };

    const cleanStringForMatch = (s: string) => {
      if (!s) return "";
      return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };

    const cleanRawCity = cleanStringForMatch(rawCity);
    const words = rawCity.split(/[\s,/\-]+/).map((w) => w.trim().toUpperCase());
    const foundUf = words.find((w) => w in UF_TO_STATE_NAME);

    if (foundUf) {
      uf = foundUf;
    } else {
      const foundStateKey = Object.keys(UF_TO_STATE_NAME)
        .sort((a, b) => UF_TO_STATE_NAME[b].length - UF_TO_STATE_NAME[a].length)
        .find((key) => {
          const stateNameCleaned = cleanStringForMatch(UF_TO_STATE_NAME[key]);
          return (
            cleanRawCity === stateNameCleaned ||
            cleanRawCity.includes(stateNameCleaned)
          );
        });
      if (foundStateKey) {
        uf = foundStateKey;
      } else {
        // Fallback robusto por cidades principais/famigeradas se o nome do estado não estiver explícito
        if (
          cleanRawCity.includes("joao pessoa") ||
          cleanRawCity.includes("campina grande") ||
          cleanRawCity.includes("cabedelo") ||
          cleanRawCity.includes("patos") ||
          cleanRawCity.includes("paraiba")
        ) {
          uf = "PB";
        } else if (
          cleanRawCity.includes("maceio") ||
          cleanRawCity.includes("arapiraca") ||
          cleanRawCity.includes("palmeira dos indios") ||
          cleanRawCity.includes("alagoas")
        ) {
          uf = "AL";
        } else if (
          cleanRawCity.includes("sao paulo") ||
          cleanRawCity.includes("campinas") ||
          cleanRawCity.includes("santos") ||
          cleanRawCity.includes("sp")
        ) {
          uf = "SP";
        } else if (
          cleanRawCity.includes("rio de janeiro") ||
          cleanRawCity.includes("niteroi") ||
          cleanRawCity.includes("rj")
        ) {
          uf = "RJ";
        } else if (
          cleanRawCity.includes("brasilia") ||
          cleanRawCity.includes("df")
        ) {
          uf = "DF";
        } else {
          uf = "AL"; // default fallback
        }
      }
    }

    setCheckInEstadoUf(uf);
    setCheckInEstado(UF_TO_STATE_NAME[uf] || "Alagoas");
  }, [currentUrlView, checkInCandidateId, candidates]);

  // 1.2 Automatically match and select municipality/IBGE code from checkInCities based on candidate city name
  useEffect(() => {
    if (
      currentUrlView !== "checkin" ||
      checkInCities.length === 0 ||
      !checkInCandidateId
    )
      return;

    const activeCand = candidates.find((c) => c.id === checkInCandidateId);
    if (!activeCand) return;

    const rawCity = activeCand.city || "";
    const stateUf = checkInEstadoUf || "AL";

    const UF_TO_STATE_NAME: { [key: string]: string } = {
      AC: "Acre",
      AL: "Alagoas",
      AP: "Amapá",
      AM: "Amazonas",
      BA: "Bahia",
      CE: "Ceará",
      DF: "Distrito Federal",
      ES: "Espírito Santo",
      GO: "Goiás",
      MA: "Maranhão",
      MT: "Mato Grosso",
      MS: "Mato Grosso do Sul",
      MG: "Minas Gerais",
      PA: "Pará",
      PB: "Paraíba",
      PR: "Paraná",
      PE: "Pernambuco",
      PI: "Piauí",
      RJ: "Rio de Janeiro",
      RN: "Rio Grande do Norte",
      RS: "Rio Grande do Sul",
      RO: "Rondônia",
      RR: "Roraima",
      SC: "Santa Catarina",
      SP: "São Paulo",
      SE: "Sergipe",
      TO: "Tocantins",
    };

    let cityNameClean = rawCity;
    const activeUfName = UF_TO_STATE_NAME[stateUf] || "Alagoas";

    // Remove a sigla e o estado
    cityNameClean = cityNameClean.replace(
      new RegExp(`\\b${stateUf}\\b`, "i"),
      "",
    );
    cityNameClean = cityNameClean.replace(new RegExp(activeUfName, "i"), "");

    const activeUfNameNoAccent = activeUfName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    cityNameClean = cityNameClean.replace(
      new RegExp(activeUfNameNoAccent, "i"),
      "",
    );

    cityNameClean = cityNameClean
      .replace(/[\s,\-/]+$/, "")
      .replace(/^[\s,\-/]+/, "")
      .trim();

    if (!cityNameClean) {
      if (stateUf === "PB") cityNameClean = "João Pessoa";
      else if (stateUf === "AL") cityNameClean = "Maceió";
      else if (stateUf === "SP") cityNameClean = "São Paulo";
      else if (stateUf === "RJ") cityNameClean = "Rio de Janeiro";
      else if (stateUf === "DF") cityNameClean = "Brasília";
      else cityNameClean = "Maceió";
    }

    const cleanStr = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const targetClean = cleanStr(cityNameClean);

    const matchedCity =
      checkInCities.find((c) => cleanStr(c.name) === targetClean) ||
      checkInCities[0];
    if (matchedCity) {
      setCheckInMunicipio(matchedCity.name);
      setCheckInMunicipioIbgeId(matchedCity.ibgeId);
    }
  }, [
    currentUrlView,
    checkInCities,
    checkInCandidateId,
    candidates,
    checkInEstadoUf,
  ]);

  // 2. Fetch Check-in Districts when checkInMunicipioIbgeId changes
  useEffect(() => {
    if (currentUrlView !== "checkin" || !checkInMunicipioIbgeId) {
      setCheckInDistricts([]);
      return;
    }

    let active = true;

    const loadCheckInDistricts = async () => {
      setLoadingCheckInDistricts(true);
      try {
        const token = (import.meta as any).env?.VITE_BRASIL_ABERTO_TOKEN;
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const response = await fetch(
          `https://api.brasilaberto.com/v1/districts-by-ibge-code/${checkInMunicipioIbgeId}`,
          { headers },
        );
        if (response.ok) {
          const res = await response.json();
          if (active && res && res.result) {
            setCheckInDistricts(res.result);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar bairros do check-in:", err);
      } finally {
        if (active) {
          setLoadingCheckInDistricts(false);
        }
      }
    };
    loadCheckInDistricts();

    return () => {
      active = false;
    };
  }, [currentUrlView, checkInMunicipioIbgeId]);

  // 3. Fetch Check-in Streets when checkInDistrictId changes
  useEffect(() => {
    if (currentUrlView !== "checkin" || !checkInDistrictId) {
      setCheckInStreets([]);
      setLoadingCheckInOsmStreets(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const bairro = checkInBairro || "";
    const city = checkInMunicipio || "";
    const state = checkInEstadoUf || "";

    setLoadingCheckInStreets(true);
    setLoadingCheckInOsmStreets(true);

    (async () => {
      const cepRequest = fetchCepStreets(checkInDistrictId, controller.signal);
      const osmRequest = fetchOsmStreets(
        bairro,
        city,
        state,
        controller.signal,
      );

      const cepStreets = await cepRequest;
      if (!active) return;
      setCheckInStreets(mergeStreetLists([cepStreets]));
      setLoadingCheckInStreets(false);

      const osmStreets = await osmRequest;
      if (!active) return;
      setCheckInStreets(mergeStreetLists([cepStreets, osmStreets]));
      setLoadingCheckInOsmStreets(false);
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    currentUrlView,
    checkInDistrictId,
    checkInBairro,
    checkInMunicipio,
    checkInEstadoUf,
  ]);

  // Calculated filtered lists for modal searchable dropdowns
  const ALL_STATES_FALLBACK = [
    { name: "Acre", shortName: "AC" },
    { name: "Alagoas", shortName: "AL" },
    { name: "Amapá", shortName: "AP" },
    { name: "Amazonas", shortName: "AM" },
    { name: "Bahia", shortName: "BA" },
    { name: "Ceará", shortName: "CE" },
    { name: "Distrito Federal", shortName: "DF" },
    { name: "Espírito Santo", shortName: "ES" },
    { name: "Goiás", shortName: "GO" },
    { name: "Maranhão", shortName: "MA" },
    { name: "Mato Grosso", shortName: "MT" },
    { name: "Mato Grosso do Sul", shortName: "MS" },
    { name: "Minas Gerais", shortName: "MG" },
    { name: "Pará", shortName: "PA" },
    { name: "Paraíba", shortName: "PB" },
    { name: "Paraná", shortName: "PR" },
    { name: "Pernambuco", shortName: "PE" },
    { name: "Piauí", shortName: "PI" },
    { name: "Rio de Janeiro", shortName: "RJ" },
    { name: "Rio Grande do Norte", shortName: "RN" },
    { name: "Rio Grande do Sul", shortName: "RS" },
    { name: "Rondônia", shortName: "RO" },
    { name: "Roraima", shortName: "RR" },
    { name: "Santa Catarina", shortName: "SC" },
    { name: "São Paulo", shortName: "SP" },
    { name: "Sergipe", shortName: "SE" },
    { name: "Tocantins", shortName: "TO" },
  ];
  const statesListToUse =
    brasilStates.length > 0 ? brasilStates : ALL_STATES_FALLBACK;
  const filteredModalStates = statesListToUse.filter(
    (s) =>
      s.name.toLowerCase().includes(modalStateSearch.toLowerCase()) ||
      s.shortName.toLowerCase().includes(modalStateSearch.toLowerCase()),
  );

  const citiesListToUse =
    brasilCities.length > 0
      ? brasilCities
      : [{ id: 1, ibgeId: 2704302, name: "Maceió" }];
  const filteredModalCities = citiesListToUse.filter((c) =>
    c.name.toLowerCase().includes(modalCitySearch.toLowerCase()),
  );

  const districtsListToUse =
    brasilDistricts.length > 0
      ? brasilDistricts
      : MACEIO_BAIRROS.map((b, index) => ({ id: index + 1000, name: b.name }));
  const filteredModalBairros = districtsListToUse.filter((b) =>
    b.name.toLowerCase().includes(modalBairroSearch.toLowerCase()),
  );

  const localBObj = NEIGHBORHOOD_DATA.find(
    (b) => b.name === creationBairroName,
  );
  const localRuasToUse = localBObj
    ? localBObj.ruas.map((r, index) => ({ id: index + 5000, name: r.name }))
    : [];
  const streetsListToUse =
    brasilStreets.length > 0 ? brasilStreets : localRuasToUse;
  const filteredModalRuas = streetsListToUse.filter((r) =>
    r.name.toLowerCase().includes(modalRuaSearch.toLowerCase()),
  );

  // Notifications
  const [notification, setNotification] = useState<{
    text: string;
    type: "success" | "info" | "error";
  } | null>(null);

  // Carrega partidos e clientes da base externa, a fonte oficial desses dados.
  // A lista local só permanece se a consulta falhar, para o sistema não ficar
  // vazio por causa de uma queda momentânea.
  const [isLoadingExternal, setIsLoadingExternal] = useState(true);
  const [externalError, setExternalError] = useState<string | null>(null);

  /** Fichas disponíveis para vínculo. Só o modal de vincular usa esta lista. */
  const [externalCandidates, setExternalCandidates] = useState<Candidate[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  /** Pergunta que abre antes: vincular um cliente que já existe ou criar um. */
  const [escolhaNovoCliente, setEscolhaNovoCliente] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  /** Escolha do administrador no momento do vínculo: trazer a equipe ou não. */
  const [linkWithTeam, setLinkWithTeam] = useState(false);
  const [togglingTeamId, setTogglingTeamId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  /** Campos de coleta e equipe do cliente aberto na ficha. */
  const reloadTeamOfClient = async (candidateId: string) => {
    if (!isDatabaseConfigured || !candidateId) return;
    const [campos, equipe] = await Promise.all([
      DatabaseService.fetchTeamFields(candidateId),
      DatabaseService.fetchSupporters(candidateId),
    ]);
    if (campos.success) setTeamFields(campos.data);
    if (equipe.success && equipe.data) {
      // Troca só a equipe deste cliente: a dos outros continua como está.
      setSupporters((prev: any[]) => [
        ...prev.filter((m) => m.candidate_id !== candidateId),
        ...equipe.data,
      ]);
    }
  };

  /** Carrega os clientes do nosso banco: é esta lista que a tela mostra. */
  const reloadClients = async () => {
    if (!isDatabaseConfigured) return;
    setIsLoadingClients(true);
    const res = await DatabaseService.fetchClients();
    if (res.success && res.data) {
      setCandidates(res.data);
    }
    setIsLoadingClients(false);
  };

  useEffect(() => {
    reloadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao abrir a ficha de um cliente, carrega a equipe e os campos dele.
  useEffect(() => {
    if (inspectedCandidate?.id) {
      reloadTeamOfClient(inspectedCandidate.id);
    } else {
      setTeamFields([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectedCandidate?.id]);

  /**
   * Liga ou desliga a busca da equipe de um cliente.
   *
   * Ao desligar, a lista volta a ser só o que está no nosso banco: os
   * integrantes que vieram de fora sairiam da tela no próximo carregamento de
   * qualquer jeito, e recarregar agora deixa a tela honesta na hora.
   */
  const handleToggleTeamSync = async (client: Candidate) => {
    const novoValor = client.syncTeam !== true;

    setCandidates((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, syncTeam: novoValor } : c)),
    );
    setInspectedCandidate((atual) =>
      atual && atual.id === client.id
        ? { ...atual, syncTeam: novoValor }
        : atual,
    );

    if (isDatabaseConfigured) {
      setTogglingTeamId(client.id);
      const res = await DatabaseService.upsertClient({
        ...client,
        syncTeam: novoValor,
      });
      setTogglingTeamId(null);

      if (!res.success) {
        // Desfaz o que a tela ja mostrou, para nao mentir sobre o que foi salvo.
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === client.id ? { ...c, syncTeam: !novoValor } : c,
          ),
        );
        setInspectedCandidate((atual) =>
          atual && atual.id === client.id
            ? { ...atual, syncTeam: !novoValor }
            : atual,
        );
        triggerNotification(
          `Não foi possível salvar a escolha: ${res.error || "erro desconhecido"}`,
          "error",
        );
        return;
      }

      if (!novoValor) {
        const sup = await DatabaseService.fetchSupporters();
        if (sup.success && sup.data) setSupporters(sup.data);
      }
    }

    triggerNotification(
      novoValor
        ? `A equipe de ${client.name} passa a ser trazida.`
        : `A equipe de ${client.name} não será mais trazida.`,
      novoValor ? "success" : "info",
    );
  };

  /**
   * Copia uma ficha externa para o nosso banco, inteira.
   *
   * O id de origem vira o id do cliente aqui, entao vincular a mesma pessoa de
   * novo atualiza o cadastro em vez de criar um segundo.
   */
  const handleLinkClient = async (ficha: Candidate) => {
    if (!isDatabaseConfigured) {
      triggerNotification(
        "Configure o banco de dados para vincular clientes.",
        "error",
      );
      return;
    }

    setLinkingId(ficha.id);
    const res = await DatabaseService.upsertClient({
      ...ficha,
      source: "vinculado",
      externalId: ficha.externalId || ficha.id,
      status_active: ficha.status_active !== false,
      syncTeam: linkWithTeam,
    });
    setLinkingId(null);

    if (!res.success) {
      triggerNotification(
        `Não foi possível vincular: ${res.error || "erro desconhecido"}`,
        "error",
      );
      return;
    }

    await reloadClients();
    triggerNotification(`${ficha.name} vinculado como cliente!`, "success");
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    (async () => {
      try {
        const { candidates: externos, parties: partidosExternos } =
          await fetchExternalData(controller.signal);
        if (!active) return;

        // A base externa nao alimenta mais a tela: ela so abastece a lista de
        // onde o administrador escolhe quem vincular. Os clientes exibidos sao
        // os que estao no nosso banco.
        setExternalCandidates(externos);
        setParties(partidosExternos);
        setExternalError(null);

        // Sem banco configurado nao ha onde guardar cliente, entao a lista
        // externa vira a lista da tela para o painel nao ficar vazio.
        if (!isDatabaseConfigured) {
          setCandidates(externos);
        }
      } catch (err: any) {
        if (!active || err?.name === "AbortError") return;
        console.error("Erro ao carregar a lista de vínculo:", err);
        setExternalError(
          err?.message || "Não foi possível carregar a lista para vínculo.",
        );
      } finally {
        if (active) setIsLoadingExternal(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Equipes dos clientes, vindas da base de origem.
  //
  // Só entra aqui quem o administrador marcou para trazer a equipe: o padrão é
  // não trazer nada. A consulta é por cliente, então na tela de check-in só a
  // do cliente daquele link é buscada — a página é pública e não faz sentido
  // baixar a equipe de todo mundo ali.
  useEffect(() => {
    const escolhidos = candidates.filter((c) => c.syncTeam === true);
    const targets =
      currentUrlView === "checkin"
        ? escolhidos.filter((c) => c.id === checkInCandidateId)
        : escolhidos;

    if (targets.length === 0) return;

    let active = true;
    const controller = new AbortController();

    (async () => {
      const collected: any[] = [];
      const loadedIds = new Set<string>();

      // Em lotes pequenos para não disparar dezenas de requisições de uma vez.
      const BATCH = 4;
      for (let i = 0; i < targets.length; i += BATCH) {
        if (!active) return;
        const batch = targets.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (candidate) => {
            try {
              const team = await fetchExternalTeam(
                candidate.id,
                controller.signal,
              );
              return { id: candidate.id, team };
            } catch (err) {
              console.warn(
                `Não foi possível carregar a Equipe de ${candidate.name}:`,
                err,
              );
              return null;
            }
          }),
        );

        for (const result of results) {
          if (!result) continue;
          loadedIds.add(result.id);
          collected.push(...result.team);
        }
      }

      if (!active || loadedIds.size === 0) return;

      // Só os clientes consultados com sucesso são substituídos; os demais
      // mantêm o que já estava carregado.
      setSupporters((previous) => [
        ...previous.filter((s: any) => !loadedIds.has(s.candidate_id)),
        ...collected,
      ]);
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [candidates, currentUrlView, checkInCandidateId]);

  // Save to localstorage on change
  useEffect(() => {
    localStorage.setItem("campaign_map_areas", JSON.stringify(areas));
  }, [areas]);

  useEffect(() => {
    localStorage.setItem("campaign_map_pins", JSON.stringify(pins));
  }, [pins]);

  useEffect(() => {
    try {
      localStorage.setItem("campaign_map_checkins", JSON.stringify(checkIns));
    } catch (err) {
      // Vários check-ins com fotos embutidas (modo local, sem Storage) estouram
      // a cota do navegador. O cache local se perde, mas o app segue rodando.
      console.warn("Não foi possível guardar os check-ins no navegador:", err);
    }
  }, [checkIns]);

  useEffect(() => {
    localStorage.setItem("campaign_candidates", JSON.stringify(candidates));
  }, [candidates]);

  useEffect(() => {
    localStorage.setItem("campaign_parties", JSON.stringify(parties));
  }, [parties]);

  useEffect(() => {
    localStorage.setItem("campaign_supporters", JSON.stringify(supporters));
  }, [supporters]);

  useEffect(() => {
    localStorage.setItem("operation_types", JSON.stringify(operationTypes));
  }, [operationTypes]);

  /**
   * Pergunta antes de uma ação sem volta, num balão do próprio sistema.
   * O corpo da ação vai em `onConfirm` e só roda se a pessoa confirmar.
   */
  const askConfirmation = (request: ConfirmRequest) =>
    setConfirmRequest(request);

  const closeConfirmation = () => setConfirmRequest(null);

  const closeMindMap = () => {
    setIsMindMapOpen(false);
    setIsMindMapFullscreen(false);
  };

  const fecharSalaDeSituacao = () => {
    setSalaDeSituacaoAberta(false);
    setSalaEmTelaCheia(false);
  };

  // Show dynamic system notification
  const triggerNotification = (
    text: string,
    type: "success" | "info" | "error" = "success",
  ) => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Preset configuration when Picked Coordinates change
  useEffect(() => {
    // Só interessa a coordenada que veio de um gesto no mapa. Abrir uma
    // missão para editar também preenche `pickedCoords`, e sem esta guarda
    // isso disparava o aviso de "local selecionado" e jogava a edição de uma
    // área direto no passo de desenhar o raio, sem ninguém ter pedido.
    if (!pickedCoords || !clickToPickCoords) return;

    if (coordsPickingMode === "area") {
      triggerNotification(
        "Ponto central da área de panfletagem selecionado no mapa!",
        "success",
      );
    } else {
      triggerNotification(
        "Localização do PIN selecionada com sucesso no mapa!",
        "success",
      );
    }
    setClickToPickCoords(false);
    // Área: o centro está marcado, e o raio é desenhado arrastando a alça.
    // O formulário só volta quando a pessoa disser que terminou.
    if (coordsPickingMode === "area") setDefinindoRaio(true);
  }, [pickedCoords]);

  // Quem escolhe pelo mapa não passa pelos seletores de bairro e rua, então o
  // endereço do ponto clicado é descoberto aqui. Sem isso o registro salvo
  // ficaria sem bairro, e o bairro é usado na listagem e nos relatórios.
  useEffect(() => {
    if (creationLocationMode !== "map" || !pickedCoords) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    setIsResolvingPickedAddress(true);
    setPickedAddressLabel(null);

    (async () => {
      const address = await reverseGeocode(
        pickedCoords.lat,
        pickedCoords.lng,
        controller.signal,
      );
      if (!active) return;

      setIsResolvingPickedAddress(false);
      if (!address) return;

      const bairro = address.suburb || "";
      const rua = address.road || "";
      const cidade = address.city || creationCityName || "";
      const uf = address.uf || creationStateShortName || "";

      // Missão aberta para edição e ainda no mesmo lugar: o endereço serve só
      // para ser mostrado. Reescrever o bairro gravado a cada abertura trocaria
      // o que alguém digitou pelo palpite do geocodificador, sem ninguém pedir.
      if (!localIntocadoNaEdicao) {
        if (bairro) {
          setCreationBairroName(bairro);
          if (coordsPickingMode === "area") setAreaBairro(bairro);
        }
        if (rua) setCreationRuaName(rua);
      }

      setPickedAddressLabel(
        [rua, bairro, cidade && uf ? `${cidade} - ${uf}` : cidade]
          .filter(Boolean)
          .join(", ") || address.displayName,
      );

      // Nenhum campo de texto é preenchido sozinho: título e legenda são
      // escritos por quem está criando, aqui e no ponto estratégico.
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [creationLocationMode, pickedCoords]);

  // Handle when Bairro selection dropdown is changed in Area Form
  const handleBairroChange = (bairroName: string) => {
    setAreaBairro(bairroName);
    const selected = MACEIO_BAIRROS.find((b) => b.name === bairroName);
    if (selected) {
      setPickedCoords({ lat: selected.lat, lng: selected.lng });
    }
  };

  const handleCreationBairroSelect = (
    bairroName: string | null,
    districtId?: number,
  ) => {
    setCreationBairroName(bairroName);
    setCreationRuaName(null);
    setPickedCoords(null);
    setCreationDistrictId(districtId || null);
    if (bairroName) {
      setAreaBairro(bairroName);
    }
  };

  const handleCreationRuaSelect = async (
    ruaName: string | null,
    lat?: number,
    lng?: number,
  ) => {
    setCreationRuaName(ruaName);
    if (ruaName && creationBairroName) {
      if (lat && lng) {
        setPickedCoords({ lat, lng });
      } else {
        const stateCode = creationStateShortName || "AL";
        const cityName = creationCityName || "Maceió";

        // 1. Procurar as coordenadas localmente no nosso banco de dados detalhado primeiro
        const cleanString = (s: string) =>
          s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
        const targetBName = cleanString(creationBairroName);
        const targetRName = cleanString(ruaName);

        const bObj = NEIGHBORHOOD_DATA.find(
          (b) => cleanString(b.name) === targetBName,
        );
        const rObj = bObj?.ruas.find((r) => {
          const nameCleaned = cleanString(r.name);
          return (
            nameCleaned === targetRName ||
            nameCleaned.includes(targetRName) ||
            targetRName.includes(nameCleaned)
          );
        });

        if (rObj) {
          // Disponibiliza as coordenadas instantaneamente sem fazer requisição externa demorada
          setPickedCoords({ lat: rObj.lat, lng: rObj.lng });
          triggerNotification(
            "Endereço localizado no mapa (Dados Locais)!",
            "success",
          );
        } else {
          // 2. Se for uma rua customizada ou não listada localmente, tenta geocodificar com a API externa do Nominatim
          const coords = await geocodeAddress(
            ruaName,
            creationBairroName,
            cityName,
            stateCode,
          );

          if (!coords) {
            // 3. Fallback inteligente e resiliente para nunca deixar sem coordenadas
            if (bObj) {
              setPickedCoords({ lat: bObj.center.lat, lng: bObj.center.lng });
              triggerNotification(
                "Rua exata não geolocalizada. Posicionado no centro do bairro!",
                "info",
              );
            } else {
              setPickedCoords({ lat: -9.66, lng: -35.72 }); // Default Maceió Centro
              triggerNotification(
                "Rua e bairro não geolocalizados online. Posicionado no centro da cidade!",
                "info",
              );
            }
          }
        }
      }

      // O bairro vem do endereço porque é usado nas listagens e nos relatórios.
      // Título e legenda ficam em branco: quem escreve é quem está criando.
      if (coordsPickingMode === "area") {
        setAreaBairro(creationBairroName);
      }
    }
  };

  // Operações e arquivos de todos os check-ins do cliente aberto: a lista
  // precisa disso em todas as linhas, e uma ida ao banco por linha seria cara.
  useEffect(() => {
    if (abaCliente !== "checkins" || !inspectedCandidate?.id) return;
    const ids = checkIns
      .filter(
        (c: any) =>
          c.candidateId === inspectedCandidate.id ||
          c.candidate_id === inspectedCandidate.id,
      )
      .map((c: any) => c.id);
    if (ids.length === 0) {
      setResumoCheckIns({ operacoes: {}, midias: {} });
      return;
    }
    let vivo = true;
    (async () => {
      const res = await DatabaseService.lerResumoCheckIns(ids);
      if (!vivo) return;
      setResumoCheckIns({ operacoes: res.operacoes, midias: res.midias });
    })();
    return () => {
      vivo = false;
    };
  }, [abaCliente, inspectedCandidate?.id, checkIns.length]);

  // Sem escolha da pessoa, a aba abre já com o registro mais recente aberto.
  useEffect(() => {
    if (abaCliente !== "checkins" || !inspectedCandidate?.id) return;
    const doCliente = checkIns
      .filter(
        (c: any) =>
          c.candidateId === inspectedCandidate.id ||
          c.candidate_id === inspectedCandidate.id,
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    if (doCliente.length === 0) return;
    // Registro aberto que não é mais deste cliente não pode ficar preso aqui.
    if (checkInAberto && doCliente.some((c: any) => c.id === checkInAberto)) return;
    setCheckInAberto(doCliente[0].id);
  }, [abaCliente, inspectedCandidate?.id, checkIns.length, checkInAberto]);

  // Ficha do check-in escolhido na lista, mostrada no painel da direita.
  useEffect(() => {
    if (!checkInAberto) {
      setFichaDoCheckIn(null);
      return;
    }
    let vivo = true;
    setCarregandoFicha(true);
    (async () => {
      const res = await DatabaseService.lerDetalhesCheckIn(checkInAberto);
      if (!vivo) return;
      setFichaDoCheckIn({
        notas: res.notas,
        operacoes: res.operacoes,
        midias: res.midias,
      });
      setCarregandoFicha(false);
    })();
    return () => {
      vivo = false;
    };
  }, [checkInAberto]);

  /** Cliente em foco no mapa, para saber de que município buscar as escolas. */
  const clienteDoMapa =
    selectedCandidateFilter !== "all"
      ? candidates.find((c) => c.id === selectedCandidateFilter)
      : null;
  const municipioDoMapa = (clienteDoMapa?.city || "").trim();

  // Escolas do município do cliente. Município sem escolas cadastradas deixa a
  // camada de fora, e o botão nem aparece no mapa.
  useEffect(() => {
    if (!isDatabaseConfigured || !municipioDoMapa) {
      setEscolas([]);
      setEscolasLigadas(false);
      setEscolaAberta(null);
      return;
    }
    let vivo = true;
    (async () => {
      const res = await DatabaseService.fetchEscolas(municipioDoMapa);
      if (!vivo) return;
      setEscolas(res.data);
      if (res.data.length === 0) {
        setEscolasLigadas(false);
        setEscolaAberta(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [municipioDoMapa, isDatabaseConfigured]);

  // Handle Pick Marker Mode trigger
  const startCoordinatesPicking = (type: "area" | "pin") => {
    setCoordsPickingMode(type);
    setClickToPickCoords(true);
    triggerNotification(
      editandoNoModal
        ? "Arraste o pino ou clique no lugar novo. Só vale depois de salvar."
        : "Selecione uma localização clicando diretamente em qualquer lugar no mapa.",
      "info",
    );
  };

  /**
   * Nome que a área recebe quando ninguém quis dar um.
   *
   * Título não é obrigatório, mas uma área sem nome nenhum some na lista.
   * Vale o endereço que o mapa descobriu, depois o bairro, e só então um
   * nome neutro — e dá para renomear na edição a qualquer momento.
   */
  const nomePadraoDaArea = () =>
    (pickedAddressLabel || "").split(",").slice(0, 2).join(",").trim() ||
    areaBairro.trim() ||
    "Área sem título";

  // Submit and form actions for Area
  const saveArea = (e: React.FormEvent) => {
    e.preventDefault();


    if (!Number(areaRadius)) {
      triggerNotification(
        "Defina o raio arrastando o círculo no mapa.",
        "error",
      );
      return;
    }

    const targetCoords = pickedCoords ||
      edicaoOriginal?.coords || { lat: -9.6548, lng: -35.715 }; // Default Maceió Centro

    const titulo = areaTitle.trim() || nomePadraoDaArea();
    const materialDaArea = materialParaSalvar();

    if (editingAreaId) {
      // Edit existing
      const existingArea = areas.find((a) => a.id === editingAreaId);
      const updatedArea: PanfletagemArea = {
        id: editingAreaId,
        title: titulo,
        description: areaDescription,
        bairro: areaBairro,
        center: {
          // Só lat e lng: ver o comentário em savePin.
          lat: targetCoords.lat,
          lng: targetCoords.lng,
          assignedDeltas: selectedDeltas,
          ...(materialDaArea.length > 0 ? { material: materialDaArea } : {}),
          ...(missaoTurno ? { turno: missaoTurno } : {}),
          ...(missaoPrioridade ? { priority: missaoPrioridade } : {}),
        },
        radius: Number(areaRadius),
        color: areaColor,
        active: true,
        teamSize: Number(areaTeamSize) || 0,
        contactName: areaContact,
        createdAt: existingArea
          ? existingArea.createdAt
          : new Date().toISOString(),
        candidateId: areaCandidateId || undefined,
        assignedDeltas: selectedDeltas,
      };
      setAreas((prev) =>
        prev.map((a) => (a.id === editingAreaId ? updatedArea : a)),
      );
      if (isDatabaseConfigured) {
        DatabaseService.upsertArea(updatedArea).then((res) => {
          if (!res.success)
            triggerNotification(`Banco de dados: ${res.error}`, "error");
        });
      }
      limparMaterialRemovido(materialDaArea);
      triggerNotification(
        "Área de panfletagem atualizada com sucesso!",
        "success",
      );
      setEditingAreaId(null);
    } else {
      // Create new
      const newArea: PanfletagemArea = {
        id: "area_" + Math.random().toString(36).substr(2, 9),
        title: titulo,
        description: areaDescription.trim(),
        bairro: areaBairro,
        center: {
          // Só lat e lng: ver o comentário em savePin.
          lat: targetCoords.lat,
          lng: targetCoords.lng,
          assignedDeltas: selectedDeltas,
          ...(materialDaArea.length > 0 ? { material: materialDaArea } : {}),
          ...(missaoTurno ? { turno: missaoTurno } : {}),
          ...(missaoPrioridade ? { priority: missaoPrioridade } : {}),
        },
        radius: Number(areaRadius),
        color: areaColor,
        active: true,
        teamSize: Number(areaTeamSize) || 0,
        contactName: areaContact || "Coordenador Local",
        createdAt: new Date().toISOString(),
        candidateId: areaCandidateId || undefined,
        assignedDeltas: selectedDeltas,
      };
      setAreas((prev) => [newArea, ...prev]);
      if (isDatabaseConfigured) {
        DatabaseService.upsertArea(newArea).then((res) => {
          if (!res.success)
            triggerNotification(`Banco de dados: ${res.error}`, "error");
        });
      }
      triggerNotification(
        "Nova área de panfletagem cadastrada no raio!",
        "success",
      );
    }

    // Reset fields
    resetAreaForm();
  };

  const resetAreaForm = () => {
    setMaterialMissao([]);
    setMissaoTurno("");
    setMissaoPrioridade("");
    setEdicaoOriginal(null);
    setDefinindoRaio(false);
    setNomeandoRaio(null);
    setAreaTitle("");
    setAreaDescription("");
    setAreaRadius("");
    setAreaColor("#2563eb");
    setAreaTeamSize("");
    setAreaContact("");
    setAreaBairro("");
    setPickedCoords(null);
    setEditingAreaId(null);
    setAreaCandidateId("");
    setSelectedDeltas([]);
    setCreationBairroName(null);
    setCreationRuaName(null);
    setCreationModalType(null);
    setCreationLocationMode(null);
    setPickedAddressLabel(null);
    setIsResolvingPickedAddress(false);
    applyDefaultCreationLocation();
    setCreationDistrictId(null);
    setModalStateSearch("");
    setModalCitySearch("");
    setModalBairroSearch("");
    setModalRuaSearch("");
    setModalStateDropdownOpen(false);
    setModalCityDropdownOpen(false);
    setModalBairroDropdownOpen(false);
    setModalRuaDropdownOpen(false);
  };

  /* ------------------------------------------------------------------ *
   * Tipos de Operação — cadastro do usuário
   * ------------------------------------------------------------------ */

  /**
   * Opções de prioridade para as telas.
   *
   * Vem do que o administrador cadastrou; sem nada cadastrado, valem os quatro
   * níveis que o sistema já trazia, para a tela nunca ficar sem escolha.
   */
  const opcoesDePrioridade = (
    priorityLevels.length > 0
      ? priorityLevels.map((n) => ({
          value: n.id,
          label: n.label,
          description: n.description || "",
          color: n.color,
        }))
      : CHECKIN_PRIORITIES.map((p) => ({
          value: p.value as string,
          label: p.label,
          description: p.description,
          color: p.color,
        }))
  ) as { value: string; label: string; description: string; color: string }[];

  /**
   * Os níveis na ordem do cadastro, com os quatro antigos no lugar quando
   * ninguém cadastrou nada. `position` cresce com a gravidade, como na carga
   * inicial do banco — é por ela que a sala de situação sabe o que é grave.
   */
  const niveisDePrioridade: PriorityLevel[] = React.useMemo(
    () =>
      priorityLevels.length > 0
        ? [...priorityLevels].sort((a, b) => a.position - b.position)
        : CHECKIN_PRIORITIES.map((nivel, i) => ({
            id: nivel.value as string,
            label: nivel.label,
            description: nivel.description,
            color: nivel.color,
            position: i,
          })),
    [priorityLevels],
  );

  /** Nível gravado num check-in, resolvido pela lista do administrador. */
  const resolverPrioridade = (valor?: string) =>
    opcoesDePrioridade.find((o) => o.value === valor) || getCheckInPriority(valor);

  /** Tipo de um ponto, ou undefined se o tipo foi apagado depois. */
  const getOperationType = (id?: string) =>
    operationTypes.find((t) => t.id === id);

  /**
   * Cliente dono dos tipos em foco.
   *
   * Dentro do formulário do ponto vale o cliente escolhido nele; fora, vale o
   * cliente filtrado no mapa. Sem cliente em foco não há tipo para mostrar,
   * porque tipo de operação pertence sempre a um cliente.
   */
  const operationTypesOwnerId =
    // A ficha do cliente aberta manda: os tipos que ela mostra são os dele.
    inspectedCandidate?.id ||
    pinCandidateId ||
    (selectedCandidateFilter !== "all" ? selectedCandidateFilter : "");

  /** Tipos do cliente em foco. Os de outros clientes não aparecem aqui. */
  const clientOperationTypes = operationTypes.filter(
    (t) => operationTypesOwnerId && t.candidateId === operationTypesOwnerId,
  );

  /** Rótulo do tipo para exibição, com uma saída digna para tipos apagados. */
  const operationTypeLabel = (id?: string) =>
    getOperationType(id)?.label || "Sem tipo definido";

  /** Chave do ícone do tipo; o id antigo serve de reserva. */
  const operationTypeIcon = (id?: string) =>
    getOperationType(id)?.icon || id || "pin";

  const resetOperationTypeForm = () => {
    setEditingOperationTypeId(null);
    setOpTypeLabel("");
    setOpTypeIcon("flag");
    setOpTypeColor("#2563eb");
    setOpTypeDescription("");
    setOpTypeActive(true);
  };

  const openOperationTypesManager = () => {
    resetOperationTypeForm();
    setIsOperationTypesModalOpen(true);
  };

  const startEditOperationType = (type: OperationType) => {
    setEditingOperationTypeId(type.id);
    setOpTypeLabel(type.label);
    setOpTypeIcon(type.icon);
    setOpTypeColor(type.color);
    setOpTypeDescription(type.description || "");
    setOpTypeActive(type.active !== false);
  };

  const saveOperationType = (e: React.FormEvent) => {
    e.preventDefault();

    const label = opTypeLabel.trim();
    if (!label) {
      triggerNotification("Dê um nome ao tipo de operação!", "error");
      return;
    }

    if (!operationTypesOwnerId) {
      triggerNotification(
        "Escolha um cliente antes: cada tipo de operação pertence a um cliente.",
        "error",
      );
      return;
    }

    // Nomes iguais só atrapalham dentro do mesmo cliente; dois clientes podem
    // ter cada um o seu "Carreata" sem conflito.
    const duplicated = clientOperationTypes.some(
      (t) =>
        t.id !== editingOperationTypeId &&
        t.label.trim().toLowerCase() === label.toLowerCase(),
    );
    if (duplicated) {
      triggerNotification("Já existe um tipo de operação com esse nome.", "error");
      return;
    }

    const saved: OperationType = editingOperationTypeId
      ? {
          ...(operationTypes.find((t) => t.id === editingOperationTypeId) as OperationType),
          label,
          icon: opTypeIcon,
          color: opTypeColor,
          description: opTypeDescription.trim(),
          active: opTypeActive,
        }
      : {
          id: "op_" + Math.random().toString(36).substr(2, 9),
          label,
          icon: opTypeIcon,
          color: opTypeColor,
          description: opTypeDescription.trim(),
          active: opTypeActive,
          position: clientOperationTypes.length,
          candidateId: operationTypesOwnerId,
          createdAt: new Date().toISOString(),
        };

    setOperationTypes((prev) =>
      editingOperationTypeId
        ? prev.map((t) => (t.id === editingOperationTypeId ? saved : t))
        : [...prev, saved],
    );

    if (isDatabaseConfigured) {
      DatabaseService.upsertOperationType(saved).then((res) => {
        if (!res.success) triggerNotification(`Banco de dados: ${res.error}`, "error");
      });
    }

    triggerNotification(
      editingOperationTypeId
        ? "Tipo de operação atualizado!"
        : "Novo tipo de operação criado!",
      "success",
    );

    // Trocar o nome de um tipo já usado não deve deixar o formulário aberto
    // apontando para um rótulo velho.
    if (editingOperationTypeId === pinIconType) setPinColor(saved.color);

    resetOperationTypeForm();
  };

  /**
   * Estrela do check-in: destaca o registro na lista e no mapa.
   *
   * O painel muda na hora e o banco recebe a mesma marca em seguida; se o
   * banco recusar, a estrela volta para onde estava.
   */
  const alternarFavoritoCheckIn = (registro: any) => {
    const favorito = !registro.favorite;
    setCheckIns((prev: any) =>
      prev.map((c: any) => (c.id === registro.id ? { ...c, favorite: favorito } : c)),
    );
    if (isDatabaseConfigured) {
      DatabaseService.definirFavoritoCheckIn(registro.id, favorito).then((res) => {
        if (!res.success) {
          setCheckIns((prev: any) =>
            prev.map((c: any) =>
              c.id === registro.id ? { ...c, favorite: !favorito } : c,
            ),
          );
          triggerNotification(`Banco de dados: ${res.error}`, "error");
        }
      });
    }
  };

  /** Move o check-in para a lixeira, de onde ele ainda pode voltar. */
  const excluirCheckIn = (registro: any) => {
    const quem = registro.name || "este check-in";
    askConfirmation({
      title: "Mover para a lixeira",
      message: `O check-in de ${quem} sai da lista e do mapa.`,
      details:
        "Nada é apagado: o registro fica na lixeira e você pode restaurar quando quiser.",
      confirmLabel: "Mover para a lixeira",
      onConfirm: () => {
        setCheckIns((prev: any) =>
          prev.map((c: any) =>
            c.id === registro.id ? { ...c, trashed: true } : c,
          ),
        );
        if (checkInAberto === registro.id) setCheckInAberto(null);
        if (isDatabaseConfigured) {
          DatabaseService.definirLixeiraCheckIn(registro.id, true).then((res) => {
            if (!res.success)
              triggerNotification(`Banco de dados: ${res.error}`, "error");
          });
        }
        triggerNotification("Check-in na lixeira.", "success");
      },
    });
  };

  /** Tira o check-in da lixeira e devolve ele para a lista e o mapa. */
  const restaurarCheckIn = (registro: any) => {
    setCheckIns((prev: any) =>
      prev.map((c: any) => (c.id === registro.id ? { ...c, trashed: false } : c)),
    );
    if (isDatabaseConfigured) {
      DatabaseService.definirLixeiraCheckIn(registro.id, false).then((res) => {
        if (!res.success)
          triggerNotification(`Banco de dados: ${res.error}`, "error");
      });
    }
    triggerNotification("Check-in restaurado.", "success");
  };

  /** Apaga de vez o que está na lixeira: daqui não volta. */
  const excluirCheckInDeVez = (registro: any) => {
    const quem = registro.name || "este check-in";
    askConfirmation({
      title: "Excluir definitivamente",
      message: `O check-in de ${quem} sai do sistema.`,
      details:
        "As fotos, vídeos e observações do registro vão junto. Não dá para desfazer.",
      confirmLabel: "Excluir para sempre",
      onConfirm: () => {
        setCheckIns((prev: any) => prev.filter((c: any) => c.id !== registro.id));
        if (isDatabaseConfigured) {
          DatabaseService.excluirCheckIn(registro.id).then((res) => {
            if (!res.success)
              triggerNotification(`Banco de dados: ${res.error}`, "error");
          });
        }
        triggerNotification("Check-in excluído definitivamente.", "success");
      },
    });
  };

  /** Liga ou desliga um tipo: desligado some dos check-ins, histórico fica. */
  const alternarTipoAtivo = (tipo: OperationType) => {
    const atualizado = { ...tipo, active: tipo.active === false };
    setOperationTypes((prev) =>
      prev.map((t) => (t.id === tipo.id ? atualizado : t)),
    );
    if (isDatabaseConfigured) {
      DatabaseService.upsertOperationType(atualizado).then((res) => {
        if (!res.success)
          triggerNotification(`Banco de dados: ${res.error}`, "error");
      });
    }
    triggerNotification(
      atualizado.active
        ? `"${tipo.label}" voltou para os check-ins.`
        : `"${tipo.label}" saiu dos check-ins.`,
      "info",
    );
  };

  const deleteOperationType = (id: string) => {
    const type = operationTypes.find((t) => t.id === id);
    if (!type) return;

    const usedBy = pins.filter((p) => p.iconType === id).length;

    askConfirmation({
      title: "Excluir tipo de operação",
      message: `O tipo "${type.label}" sai da lista e deixa de aparecer nos formulários.`,
      details: usedBy
        ? `${usedBy} ponto(s) usam este tipo e vão ficar sem tipo definido.`
        : undefined,
      confirmLabel: "Excluir tipo",
      onConfirm: () => {
        setOperationTypes((prev) => prev.filter((t) => t.id !== id));

        if (isDatabaseConfigured) {
          DatabaseService.deleteOperationType(id).then((res) => {
            if (!res.success)
              triggerNotification(`Banco de dados: ${res.error}`, "error");
          });
        }

        // O formulário aberto não pode continuar apontando para um tipo que sumiu.
        if (pinIconType === id) {
          const fallback = clientOperationTypes.find((t) => t.id !== id);
          setPinIconType(fallback ? fallback.id : "");
        }
        if (editingOperationTypeId === id) resetOperationTypeForm();

        triggerNotification("Tipo de operação excluído.", "info");
      },
    });
  };

  /** Troca do tipo no formulário do ponto: a cor do tipo vira a cor sugerida. */
  const handlePinTypeChange = (id: string) => {
    setPinIconType(id);
    const type = getOperationType(id);
    if (type?.color) setPinColor(type.color);
  };

  // Submit and Form actions for Strategic Pin
  const savePin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pinTitle) {
      triggerNotification("Preencha o título do Ponto Estratégico!", "error");
      return;
    }

    // Sem local: a coluna do banco continua exigindo uma coordenada. Vale a
    // que a missão já tinha, e só na falta dela o centro de Maceió.
    const targetCoords = pickedCoords ||
      edicaoOriginal?.coords || { lat: -9.66, lng: -35.72 };
    /**
     * Missão sem lugar no mapa.
     *
     * A marca vai dentro de `position`, que já é jsonb livre — assim a função
     * nasce funcionando em todo banco que já está no ar, sem esperar migração.
     * A coordenada continua preenchida só para a coluna `not null` do banco;
     * quem lê é `position.semLocal`, nunca a lat/lng deste caso.
     */
    const semLocal = creationLocationMode === "sem";
    const material = materialParaSalvar();
    // Só lat e lng do que veio: na edição `pickedCoords` é o `position` antigo
    // inteiro, e espalhá-lo faria o material removido voltar sozinho.
    const posicao = {
      lat: targetCoords.lat,
      lng: targetCoords.lng,
      assignedDeltas: selectedDeltas,
      ...(semLocal ? { semLocal: true } : {}),
      ...(material.length > 0 ? { material } : {}),
      ...(missaoTurno ? { turno: missaoTurno } : {}),
      ...(missaoPrioridade ? { priority: missaoPrioridade } : {}),
    };

    if (editingPinId) {
      // Edit existing
      const existingPin = pins.find((p) => p.id === editingPinId);
      const updatedPin: CampaignPin = {
        id: editingPinId,
        title: pinTitle,
        description: pinDescription,
        position: posicao,
        color: pinColor,
        iconType: pinIconType,
        active: true,
        createdAt: existingPin
          ? existingPin.createdAt
          : new Date().toISOString(),
        date: pinDate || undefined,
        candidateId: pinCandidateId || undefined,
        assignedDeltas: selectedDeltas,
      };
      setPins((prev) =>
        prev.map((p) => (p.id === editingPinId ? updatedPin : p)),
      );
      if (isDatabaseConfigured) {
        DatabaseService.upsertPin(updatedPin).then((res) => {
          if (!res.success)
            triggerNotification(`Banco de dados: ${res.error}`, "error");
        });
      }
      limparMaterialRemovido(material);
      triggerNotification(
        semLocal
          ? "Missão atualizada. Quem você marcou vê a versão nova no check-in."
          : "Ponto estratégico atualizado!",
        "success",
      );
      setEditingPinId(null);
    } else {
      // Create new
      const newPin: CampaignPin = {
        id: "pin_" + Math.random().toString(36).substr(2, 9),
        title: pinTitle,
        description: pinDescription || "",
        position: posicao,
        color: pinColor,
        iconType: pinIconType,
        active: true,
        createdAt: new Date().toISOString(),
        date: pinDate || undefined,
        candidateId: pinCandidateId || undefined,
        assignedDeltas: selectedDeltas,
      };
      setPins((prev) => [newPin, ...prev]);
      if (isDatabaseConfigured) {
        DatabaseService.upsertPin(newPin).then((res) => {
          if (!res.success)
            triggerNotification(`Banco de dados: ${res.error}`, "error");
        });
      }
      triggerNotification(
        semLocal
          ? "Missão enviada. Ela aparece no check-in de quem você marcou."
          : "Novo ponto estratégico (Pin) adicionado ao mapa!",
        "success",
      );
    }

    resetPinForm();
  };

  /**
   * Larga o material que subiu e não virou missão.
   *
   * Cancelar o formulário sem isto deixa o arquivo no Storage para sempre,
   * sem nada que o referencie. Salvar não passa por aqui: lá o material fica.
   */
  const descartarMaterialPendente = () => {
    const caminhos = materialMissao
      .filter((m) => !m.jaSalvo)
      .map((m) => m.storagePath)
      .filter(Boolean) as string[];
    if (caminhos.length > 0) DatabaseService.removerArquivosStorage(caminhos);
    materialMissao.forEach((m) => m.previa && URL.revokeObjectURL(m.previa));
    setMaterialMissao([]);
  };

  /** O material pronto, no formato que a missão guarda. */
  const materialParaSalvar = () =>
    materialMissao
      .filter((m) => m.estado === "pronto" && m.url)
      .map(({ id, tipo, url, storagePath, nome, tamanho, duracao }) => ({
        id,
        tipo,
        url,
        storagePath,
        nome,
        tamanho,
        duracao,
      }));

  const resetPinForm = () => {
    setMaterialMissao([]);
    setMissaoTurno("");
    setMissaoPrioridade("");
    setEdicaoOriginal(null);
    setPinTitle("");
    setPinDescription("");
    setPinColor("#ea580c");
    setPinIconType("");
    setPinDate("");
    setPickedCoords(null);
    setEditingPinId(null);
    setPinCandidateId("");
    setSelectedDeltas([]);
    setCreationBairroName(null);
    setCreationRuaName(null);
    setCreationModalType(null);
    setCreationLocationMode(null);
    setPickedAddressLabel(null);
    setIsResolvingPickedAddress(false);
    applyDefaultCreationLocation();
    setCreationDistrictId(null);
    setModalStateSearch("");
    setModalCitySearch("");
    setModalBairroSearch("");
    setModalRuaSearch("");
    setModalStateDropdownOpen(false);
    setModalCityDropdownOpen(false);
    setModalBairroDropdownOpen(false);
    setModalRuaDropdownOpen(false);
  };

  /*
   * Missão não se esconde.
   *
   * O olho de "ocultar" tirava a missão do mapa sem tirá-la do sistema: ela
   * continuava valendo para quem a recebeu, mas sumia de quem manda, e o
   * único aviso era um selo cinza dentro do próprio cartão que já não
   * aparecia. Quem não quer mais a missão a exclui; quem quer, vê.
   */

  const deleteArea = (id: string) => {
    const area = areas.find((a) => a.id === id);
    askConfirmation({
      title: "Excluir área de trabalho",
      message: area
        ? `A área "${area.title}" sai do mapa junto com a missão enviada à equipe.`
        : "Esta área sai do mapa junto com a missão enviada à equipe.",
      confirmLabel: "Excluir área",
      onConfirm: () => {
        setAreas((prev) => prev.filter((a) => a.id !== id));
        if (selectedId === id) setSelectedId(null);
        // O editor não pode ficar aberto em cima de algo que não existe mais.
        if (editingAreaId === id) resetAreaForm();
        if (isDatabaseConfigured) {
          DatabaseService.deleteArea(id).then((res) => {
            if (!res.success)
              triggerNotification(`Banco de dados: ${res.error}`, "error");
          });
        }
        triggerNotification("Área de panfletagem removida", "success");
      },
    });
  };

  const deletePin = (id: string) => {
    const pin = pins.find((p) => p.id === id);
    askConfirmation({
      title: "Remover ponto estratégico",
      message: pin
        ? `O ponto "${pin.title}" sai do mapa e da lista da equipe.`
        : "Este ponto sai do mapa e da lista da equipe.",
      confirmLabel: "Remover ponto",
      onConfirm: () => {
        setPins((prev) => prev.filter((p) => p.id !== id));
        if (selectedId === id) setSelectedId(null);
        // O editor não pode ficar aberto em cima de algo que não existe mais.
        if (editingPinId === id) resetPinForm();
        if (isDatabaseConfigured) {
          DatabaseService.deletePin(id).then((res) => {
            if (!res.success)
              triggerNotification(`Banco de dados: ${res.error}`, "error");
          });
        }
        triggerNotification("Ponto estratégico removido", "success");
      },
    });
  };

  /**
   * Abre a missão no mesmo editor que a criou.
   *
   * Editar num formulário reduzido, como era antes, deixava metade da missão
   * fora do alcance: o material de apoio, quem recebe a missão e o próprio
   * lugar no mapa só existiam na criação. Reaproveitar o editor inteiro é o
   * que garante que dá para mudar tudo — e que um campo novo amanhã já nasce
   * editável, sem ninguém precisar lembrar de copiá-lo para o segundo lugar.
   */
  const startEditArea = (area: PanfletagemArea) => {
    const centro = { lat: area.center.lat, lng: area.center.lng };
    const material = area.center?.material || [];

    setActiveTab("areas");
    setSelectedId(area.id);
    setEditingPinId(null);
    setEditingAreaId(area.id);
    setAreaTitle(area.title);
    setAreaDescription(area.description || "");
    setAreaBairro(area.bairro);
    setAreaRadius(area.radius);
    setAreaColor(area.color);
    setAreaTeamSize(area.teamSize || "");
    setAreaContact(area.contactName || "");
    setPickedCoords(centro);
    setAreaCandidateId(area.candidateId || "");
    setSelectedDeltas(area.assignedDeltas || area.center?.assignedDeltas || []);
    setMissaoTurno(area.center?.turno || "");
    setMissaoPrioridade(area.center?.priority || "");
    setMaterialMissao(
      material.map((m) => ({
        ...m,
        estado: "pronto" as const,
        progresso: 100,
        jaSalvo: true,
      })),
    );
    setEdicaoOriginal({ coords: centro, radius: area.radius, material });

    // O editor completo, no centro da tela, com o passo do local já resolvido.
    setCoordsPickingMode("area");
    setCreationLocationMode("map");
    setCreationModalType("area");
    setClickToPickCoords(false);
    setDefinindoRaio(false);
    setNomeandoRaio(null);
  };

  const startEditPin = (pin: CampaignPin) => {
    const semLocal = !!pin.position?.semLocal;
    const local = semLocal
      ? null
      : { lat: pin.position.lat, lng: pin.position.lng };
    const material = pin.position?.material || [];

    setActiveTab("pins");
    setSelectedId(pin.id);
    setEditingAreaId(null);
    setEditingPinId(pin.id);
    setPinTitle(pin.title);
    setPinDescription(pin.description || "");
    setPinColor(pin.color);
    setPinIconType(pin.iconType);
    setPinDate(pin.date || "");
    setMissaoTurno(pin.position?.turno || "");
    setMissaoPrioridade(pin.position?.priority || "");
    // Só a coordenada: `position` carrega material e equipe junto, e guardá-lo
    // inteiro aqui fazia o que foi removido no formulário voltar ao salvar.
    setPickedCoords(local);
    setMaterialMissao(
      material.map((m) => ({
        ...m,
        estado: "pronto" as const,
        progresso: 100,
        jaSalvo: true,
      })),
    );
    setPinCandidateId(pin.candidateId || "");
    setSelectedDeltas(pin.assignedDeltas || pin.position?.assignedDeltas || []);
    setEdicaoOriginal({
      coords: { lat: pin.position.lat, lng: pin.position.lng },
      radius: "",
      material,
    });

    setCoordsPickingMode("pin");
    setCreationLocationMode(semLocal ? "sem" : "map");
    setCreationModalType("pin");
    setClickToPickCoords(false);
    setDefinindoRaio(false);
    setNomeandoRaio(null);
  };

  /**
   * Desiste de mover a missão e devolve o editor com o lugar de antes.
   *
   * Sem isto, cancelar no meio do "escolher outro ponto" largava a edição
   * inteira — ou pior, deixava a missão com o lugar pela metade.
   */
  const cancelarMovimentacaoDaMissao = () => {
    setClickToPickCoords(false);
    setDefinindoRaio(false);
    setNomeandoRaio(null);
    if (edicaoOriginal?.coords) setPickedCoords(edicaoOriginal.coords);
    if (edicaoOriginal && edicaoOriginal.radius !== "") {
      setAreaRadius(edicaoOriginal.radius);
    }
    setCreationLocationMode("map");
    triggerNotification("O lugar da missão continua onde estava.", "info");
  };

  /**
   * Material que saiu da missão na edição, apagado também do Storage.
   *
   * Tirar o arquivo da tela e salvar não bastava: o arquivo continuava no
   * balde para sempre, sem nada que o referenciasse.
   */
  const limparMaterialRemovido = (mantidos: MaterialDeApoio[]) => {
    const antes = edicaoOriginal?.material || [];
    if (antes.length === 0) return;
    const vivos = new Set(mantidos.map((m) => m.id));
    const caminhos = antes
      .filter((m) => !vivos.has(m.id) && m.storagePath)
      .map((m) => m.storagePath as string);
    if (caminhos.length > 0) DatabaseService.removerArquivosStorage(caminhos);
  };

  /**
   * Raio: a ferramenta cai direto no mapa.
   *
   * Perguntar "como definir o local?" antes do desenho era um passo a mais
   * para responder sempre a mesma coisa: quem pegou a ferramenta do raio já
   * está com o lugar na tela. O formulário (nome, equipe, cor) só aparece
   * depois que o círculo está desenhado.
   */
  const triggerCreateArea = () => {
    resetAreaForm();
    // Um ponto aberto no editor não pode ficar pendurado atrás da área nova.
    if (editingPinId) resetPinForm();
    if (selectedCandidateFilter !== "all") {
      setAreaCandidateId(selectedCandidateFilter);
    }
    setSelectedId(null);
    setCreationBairroName(null);
    setCreationRuaName(null);
    setPickedCoords(null);
    setActiveTab("areas");
    setIsSidebarOpen(false);
    setCoordsPickingMode("area");
    setCreationLocationMode("map");
    setCreationModalType("area");
    // Mapa armado: o próximo gesto na tela é o centro e o raio.
    setClickToPickCoords(true);
  };

  /** Salva a área direto do passo do nome, sem passar pelo formulário longo. */
  const concluirRaio = () => {
    setNomeandoRaio(null);
    saveArea({ preventDefault: () => {} } as React.FormEvent);
  };

  /** Larga a criação do raio inteira: nada fica desenhado nem pela metade. */
  const cancelarRaio = () => {
    setClickToPickCoords(false);
    descartarMaterialPendente();
    resetAreaForm();
    triggerNotification("Criação da área cancelada.", "info");
  };

  /**
   * Um estabelecimento da pesquisa vira um ponto estratégico do cliente.
   *
   * O lugar já tem nome, endereço e coordenada — redigitar isso à mão é o
   * tipo de trabalho que o sistema existe para poupar. O formulário abre
   * preenchido, e quem salva é a pessoa, depois de conferir.
   */
  const virarPontoEstrategico = (lugar: Estabelecimento) => {
    resetPinForm();
    if (editingAreaId) resetAreaForm();
    if (selectedCandidateFilter !== "all") setPinCandidateId(selectedCandidateFilter);
    setPinTitle(lugar.nome);
    setPinDescription(
      [lugar.categoria, lugar.endereco, lugar.telefone]
        .filter(Boolean)
        .join(" • "),
    );
    setPickedCoords({ lat: lugar.latitude, lng: lugar.longitude });
    setCoordsPickingMode("pin");
    setCreationLocationMode("map");
    setCreationModalType("pin");
    setClickToPickCoords(false);
    setSelectedId(null);
    setActiveTab("pins");
    setIsSidebarOpen(false);
    setLojaAberta(null);
    triggerNotification(
      `"${lugar.nome}" veio para o formulário do ponto. Confira e salve.`,
      "info",
    );
  };

  const triggerCreatePin = () => {
    resetPinForm();
    // Uma área aberta no editor não pode ficar pendurada atrás do ponto novo.
    if (editingAreaId) resetAreaForm();
    if (selectedCandidateFilter !== "all") {
      setPinCandidateId(selectedCandidateFilter);
    }
    setSelectedId(null);
    setCreationBairroName(null);
    setCreationRuaName(null);
    setPickedCoords(null);
    setActiveTab("pins");
    setIsSidebarOpen(false); // Do not open right sidebar
    setClickToPickCoords(false); // Do not start map clicking
    setCoordsPickingMode("pin");
    setCreationLocationMode("ask");
    setCreationModalType("pin"); // Open modal in the center of the screen
  };

  // Search filtered actions
  /**
   * As três listas abaixo são memorizadas de propósito.
   *
   * Elas descem para o mapa como props, e um array novo a cada render fazia o
   * Leaflet apagar e redesenhar as camadas — e reenquadrar a vista — a cada
   * tecla digitada ou aviso na tela.
   */
  /**
   * O corte de tempo da missão.
   *
   * Só vale no painel: o aplicativo de campo mostra à equipe tudo que foi
   * mandado para ela, e sumir com a missão de alguém porque o comitê
   * escolheu olhar "os últimos 7 dias" seria um jeito silencioso de cancelar
   * trabalho.
   */
  const missaoNoRecorte = React.useCallback(
    (prazo: string | undefined, criadaEm: string | undefined) => {
      if (currentUrlView === "checkin") return true;
      if (!passaNoPrazo(prazo, filtroPrazos)) return false;
      if (!filtroDe && !filtroAte) return true;
      const dia = diaDaMissao(prazo, criadaEm);
      // Missão sem data nenhuma não se esconde: some do mapa quem a gente
      // sabe que está fora, não quem a gente não sabe datar.
      if (!dia) return true;
      if (filtroDe && dia < filtroDe) return false;
      if (filtroAte && dia > filtroAte) return false;
      return true;
    },
    [currentUrlView, filtroPrazos, filtroDe, filtroAte],
  );

  const filteredAreas = React.useMemo(() => areas.filter((a) => {
    const activeCandidate =
      currentUrlView === "checkin"
        ? checkInCandidateId
        : selectedCandidateFilter;
    if (
      activeCandidate &&
      activeCandidate !== "all" &&
      a.candidateId !== activeCandidate
    ) {
      return false;
    }
    // Retringir missões atribuídas a membros específicos da Equipe
    if (currentUrlView === "checkin" && authenticatedSupporter) {
      const assigned = a.assignedDeltas || a.center?.assignedDeltas || [];
      if (
        assigned.length > 0 &&
        !assigned.includes(authenticatedSupporter.id)
      ) {
        return false;
      }
    }
    // A área não tem prazo próprio: ela entra pelo dia em que foi criada.
    if (!missaoNoRecorte(undefined, a.createdAt)) return false;
    return (
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.bairro.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }), [
    areas,
    currentUrlView,
    checkInCandidateId,
    selectedCandidateFilter,
    authenticatedSupporter,
    searchQuery,
    missaoNoRecorte,
  ]);

  const filteredPins = React.useMemo(() => pins.filter((p) => {
    const activeCandidate =
      currentUrlView === "checkin"
        ? checkInCandidateId
        : selectedCandidateFilter;
    if (
      activeCandidate &&
      activeCandidate !== "all" &&
      p.candidateId !== activeCandidate
    ) {
      return false;
    }
    // Retringir pinos táticos atribuídos a membros específicos da Equipe
    if (currentUrlView === "checkin" && authenticatedSupporter) {
      const assigned = p.assignedDeltas || p.position?.assignedDeltas || [];
      if (
        assigned.length > 0 &&
        !assigned.includes(authenticatedSupporter.id)
      ) {
        return false;
      }
    }
    if (!missaoNoRecorte(p.date, p.createdAt)) return false;
    return (
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }), [
    pins,
    currentUrlView,
    checkInCandidateId,
    selectedCandidateFilter,
    authenticatedSupporter,
    searchQuery,
    missaoNoRecorte,
  ]);

  /**
   * O que de fato vai para o mapa.
   *
   * Missão sem local tem coordenada só para a coluna do banco: desenhá-la
   * poria um ponto falso na rua errada. Ela vive na lista e na conversa do
   * check-in. Memorizada porque desce como prop do Leaflet.
   */
  const pinsNoMapa = React.useMemo(
    () => filteredPins.filter((p) => !p.position?.semLocal),
    [filteredPins],
  );

  /** Id do cliente cujo mapa está aberto agora. */
  const clienteEmFoco =
    currentUrlView === "checkin" ? checkInCandidateId : selectedCandidateFilter;

  /** Equipe do cliente em foco, que povoa a lista de pessoas do filtro. */
  const equipeDoMapa = React.useMemo(
    () =>
      !clienteEmFoco || clienteEmFoco === "all"
        ? supporters
        : supporters.filter(
            (s: any) =>
              s.candidate_id === clienteEmFoco || s.candidateId === clienteEmFoco,
          ),
    [supporters, clienteEmFoco],
  );

  /**
   * Quem registrou um check-in.
   *
   * O registro guarda o id do integrante, mas os antigos guardam só o nome —
   * então a busca aceita os dois, e a chave é sempre o id de quem está na
   * equipe. Sem isso a mesma pessoa apareceria duas vezes na lista.
   */
  const pessoaDoCheckIn = React.useCallback(
    (c: any) => {
      const membro = equipeDoMapa.find(
        (m: any) => m.id === c.memberId || m.full_name === c.name,
      );
      return {
        chave: membro?.id || c.memberId || c.name || "sem-nome",
        nome: membro?.full_name || c.name || "Sem nome",
        foto: membro?.image || c.memberPhoto,
        daEquipe: Boolean(membro),
      };
    },
    [equipeDoMapa],
  );

  /** Check-ins do cliente em foco, antes dos cortes do painel de filtro. */
  const checkInsDoMapa = React.useMemo(
    () =>
      checkIns.filter((c) => {
        // Registro na lixeira não aparece no mapa nem nas contas.
        if (c.trashed) return false;
        if (
          clienteEmFoco &&
          clienteEmFoco !== "all" &&
          c.candidateId !== clienteEmFoco
        ) {
          return false;
        }
        return (
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.bairro || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.rua || "").toLowerCase().includes(searchQuery.toLowerCase())
        );
      }),
    [checkIns, clienteEmFoco, searchQuery],
  );

  /**
   * Os cortes de período, prioridade e tipo, separados do corte por pessoa.
   *
   * A contagem ao lado de cada foto sai daqui: ela precisa respeitar os
   * outros filtros e ignorar o de pessoas, senão marcar alguém zeraria todo
   * mundo e a lista viraria um espelho da própria escolha.
   */
  const passaNosCortes = React.useCallback(
    (c: any) => {
      if (filtroDe || filtroAte) {
        const dia = new Date(c.createdAt);
        if (Number.isNaN(dia.getTime())) return false;
        const iso = dia.toLocaleDateString("sv-SE");
        if (filtroDe && iso < filtroDe) return false;
        if (filtroAte && iso > filtroAte) return false;
      }
      if (filtroNiveis.length > 0 && !filtroNiveis.includes(c.priority || ""))
        return false;
      if (filtroTiposAcao.length > 0) {
        const rotulos = operationTypes
          .filter((t) => filtroTiposAcao.includes(t.id))
          .map((t) => t.label);
        // Registro antigo guarda só o rótulo do tipo; o id nem sempre existe.
        const bate =
          filtroTiposAcao.includes(c.operationTypeId || "") ||
          rotulos.includes(c.operationTypeLabel || "");
        if (!bate) return false;
      }
      return true;
    },
    [filtroDe, filtroAte, filtroNiveis, filtroTiposAcao, operationTypes],
  );

  const filteredCheckIns = React.useMemo(
    () =>
      checkInsDoMapa.filter((c: any) => {
        if (!passaNosCortes(c)) return false;
        if (
          filtroPessoas.length > 0 &&
          !filtroPessoas.includes(pessoaDoCheckIn(c).chave)
        ) {
          return false;
        }
        return true;
      }),
    [checkInsDoMapa, passaNosCortes, filtroPessoas, pessoaDoCheckIn],
  );

  /**
   * Missões do cliente em foco antes do recorte de tempo.
   *
   * A barra precisa dizer "4 de 9": sem o total de antes, ela só saberia
   * contar o que sobrou, e quem olha não descobre quanto ficou de fora.
   */
  const missoesNoFoco = React.useMemo(() => {
    const doCliente = (dono?: string) =>
      !clienteEmFoco || clienteEmFoco === "all" || dono === clienteEmFoco;
    return (
      pins.filter((p) => doCliente(p.candidateId)).length +
      areas.filter((a) => doCliente(a.candidateId)).length
    );
  }, [pins, areas, clienteEmFoco]);

  const contagemDoPeriodo = {
    // Favoritos é um corte do menu de visualização, não do período: a conta
    // tem de bater com o que o mapa realmente desenha.
    checkInsVisiveis:
      mapFilter === "favoritos"
        ? filteredCheckIns.filter((c: any) => c.favorite).length
        : filteredCheckIns.length,
    checkInsTotal: checkInsDoMapa.length,
    missoesVisiveis: filteredPins.length + filteredAreas.length,
    missoesTotal: missoesNoFoco,
  };

  /**
   * As chaves de camada da barra são a mesma coisa que o menu
   * "Visualização": ler e escrever direto no `mapFilter` é o que mantém os
   * dois contando a mesma história.
   */
  const verCheckIns = mapFilter !== "markers" && mapFilter !== "nada";
  const verMissoes =
    mapFilter !== "checkins" &&
    mapFilter !== "favoritos" &&
    mapFilter !== "nada";

  const estadoDoPeriodo: EstadoDoPeriodo = {
    de: filtroDe,
    ate: filtroAte,
    verCheckIns,
    verMissoes,
    prazos: filtroPrazos,
  };

  const mudarPeriodo = (novo: EstadoDoPeriodo) => {
    setFiltroDe(novo.de);
    setFiltroAte(novo.ate);
    setFiltroPrazos(novo.prazos);
    if (novo.verCheckIns && novo.verMissoes) setMapFilter("all");
    else if (novo.verCheckIns)
      // Quem estava vendo só os favoritos continua nos favoritos: desligar
      // as missões não é pedir para rever o resto dos check-ins.
      setMapFilter(mapFilter === "favoritos" ? "favoritos" : "checkins");
    else if (novo.verMissoes) setMapFilter("markers");
    else setMapFilter("nada");
  };

  /** O nível de prioridade que a missão guarda, quando ele ainda existe. */
  const nivelDaMissao = (id?: string) =>
    id ? niveisDePrioridade.find((n) => n.id === id) : undefined;

  /* ------------------------------------------- o formulário de missão ---
   * O que a trilha e a prévia precisam saber, num lugar só: área e ponto são
   * a mesma missão vista de dois jeitos, e espalhar esse "qual dos dois?"
   * pelo JSX é como a duplicação começa.
   */
  const missaoEhArea = creationModalType === "area";
  const tituloDaMissao = missaoEhArea ? areaTitle : pinTitle;
  const descricaoDaMissao = missaoEhArea ? areaDescription : pinDescription;
  const corDaMissao = missaoEhArea ? areaColor : pinColor;
  const tipoDaMissaoEmEdicao: "area" | "pin" | "sem" = missaoEhArea
    ? "area"
    : creationLocationMode === "sem"
      ? "sem"
      : "pin";

  const clienteDaMissao =
    (missaoEhArea ? areaCandidateId : pinCandidateId) ||
    (selectedCandidateFilter !== "all" ? selectedCandidateFilter : "");
  const equipeDoClienteDaMissao = supporters.filter(
    (s: any) =>
      s.candidate_id === clienteDaMissao || s.candidateId === clienteDaMissao,
  );
  const nomesDesignados = equipeDoClienteDaMissao
    .filter((s: any) => selectedDeltas.includes(s.id))
    .map(
      (s: any) =>
        s.full_name || s.nome_completo || s.nome || s.name || "Integrante",
    );

  const [passoAtivo, setPassoAtivo] = useState("local");

  /** Onde o formulário está, para a trilha acender sozinha ao rolar. */
  useEffect(() => {
    if (!creationModalType) return;
    const caixa = document.getElementById("corpo-do-formulario-de-missao");
    if (!caixa) return;
    const ids = ["local", "missao", "quando", "destino"];
    const calcular = () => {
      const topo = caixa.getBoundingClientRect().top;
      let ativo = ids[0];
      ids.forEach((id) => {
        const el = document.getElementById(`passo-${id}`);
        if (el && el.getBoundingClientRect().top - topo <= 48) ativo = id;
      });
      // A última seção nunca encosta no topo: no fim da rolagem, é ela.
      if (caixa.scrollTop + caixa.clientHeight >= caixa.scrollHeight - 4) {
        ativo = ids[ids.length - 1];
      }
      setPassoAtivo(ativo);
    };
    calcular();
    caixa.addEventListener("scroll", calcular);
    return () => caixa.removeEventListener("scroll", calcular);
  }, [creationModalType, creationLocationReady, creationLocationMode]);

  const resumoDoLocal = !creationLocationReady
    ? ""
    : creationLocationMode === "sem"
      ? "sem lugar no mapa"
      : pickedAddressLabel ||
        creationRuaName ||
        creationBairroName ||
        (missaoEhArea ? areaBairro : "") ||
        "local definido";

  const passosDaMissao = [
    {
      id: "local",
      rotulo: "Onde",
      resumo: resumoDoLocal,
      estado: (creationLocationReady ? "feito" : "falta") as
        | "feito"
        | "falta"
        | "opcional",
    },
    {
      id: "missao",
      rotulo: "A missão",
      resumo: tituloDaMissao.trim() || "",
      estado: (tituloDaMissao.trim()
        ? "feito"
        : missaoEhArea
          ? "opcional"
          : "falta") as "feito" | "falta" | "opcional",
    },
    {
      id: "quando",
      rotulo: "Quando",
      resumo: [
        missaoTurno ? NOME_DO_TURNO[missaoTurno] : "",
        nivelDaMissao(missaoPrioridade)?.label || "",
      ]
        .filter(Boolean)
        .join(" · "),
      estado: (missaoTurno || missaoPrioridade ? "feito" : "opcional") as
        | "feito"
        | "falta"
        | "opcional",
    },
    {
      id: "destino",
      rotulo: "Para quem",
      resumo:
        selectedDeltas.length > 0
          ? `${selectedDeltas.length} ${
              selectedDeltas.length === 1 ? "pessoa" : "pessoas"
            }${materialMissao.length ? ` · ${materialMissao.length} arq.` : ""}`
          : equipeDoClienteDaMissao.length > 0
            ? "todo o time"
            : "",
      estado: (selectedDeltas.length > 0 ? "feito" : "opcional") as
        | "feito"
        | "falta"
        | "opcional",
    },
  ];

  /** Quantos filtros do painel estão ligados, para o aviso no botão do mapa. */
  const filtrosDeCheckInLigados =
    filtroPessoas.length + filtroNiveis.length + filtroTiposAcao.length;

  const limparFiltrosDeCheckIn = () => {
    setFiltroPessoas([]);
    setFiltroNiveis([]);
    setFiltroTiposAcao([]);
  };

  // Statistics Computations
  const totalVolunteers = filteredAreas.reduce(
    (sum, a) => sum + (a.teamSize || 0),
    0,
  );
  const totalStrategicPlaces = filteredPins.length;
  // Area in square meters: pi * r^2
  const totalAreaCoveredM2 = filteredAreas.reduce(
    (sum, a) => sum + Math.PI * Math.pow(a.radius, 2),
    0,
  );
  const totalAreaCoveredKm2 = (totalAreaCoveredM2 / 1000000).toFixed(2);

  // Export Campaign State to local JSON file
  const exportCampaignJson = () => {
    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      areas,
      pins,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campanha_maceio_export.json`;
    link.click();
    URL.revokeObjectURL(url);
    triggerNotification("Dados de campanha exportados com sucesso!", "success");
  };

  // Import Campaign Data
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.areas && parsed.pins) {
          setAreas(parsed.areas);
          setPins(parsed.pins);
          triggerNotification(
            "Dados de campanha importados com sucesso!",
            "success",
          );
        } else {
          triggerNotification(
            'Formato de arquivo inválido. Deve conter "areas" e "pins".',
            "error",
          );
        }
      } catch (err) {
        triggerNotification(
          "Erro ao processar o arquivo de importação.",
          "error",
        );
      }
    };
    reader.readAsText(file);
  };

  // Quantas missões o integrante logado tem atribuídas no cliente escolhido.
  const userMissionCount = (() => {
    if (!checkInCandidateId || !authenticatedSupporter?.id) return 0;
    const isMine = (assigned: any) =>
      Array.isArray(assigned) && assigned.includes(authenticatedSupporter.id);
    const mineAreas = areas.filter(
      (a) =>
        a.candidateId === checkInCandidateId &&
        isMine(a.assignedDeltas || a.center?.assignedDeltas),
    ).length;
    const minePins = pins.filter(
      (p) =>
        p.candidateId === checkInCandidateId &&
        isMine(p.assignedDeltas || p.position?.assignedDeltas),
    ).length;
    return mineAreas + minePins;
  })();
  const hasAssignedMissions = userMissionCount > 0;

  /**
   * As missões que o comitê mandou para quem está logado no check-in.
   *
   * É o que a pessoa vê no alto da conversa. Áreas e pinos entram na mesma
   * lista porque, na rua, os dois são a mesma coisa: um lugar para ir com uma
   * instrução junto. A atribuição tem de ser explícita — ponto sem ninguém
   * atribuído é do comitê, não dela, e não aparece aqui.
   *
   * Memorizada porque desce como prop: array novo a cada render faria o aviso
   * de missão nova disparar sozinho a cada tecla digitada na conversa.
   */
  const missoesDoIntegrante = React.useMemo<MissaoDoCampo[]>(() => {
    const meuId = authenticatedSupporter?.id;
    if (!checkInCandidateId || !meuId) return [];
    const minha = (atribuidos: any) =>
      Array.isArray(atribuidos) && atribuidos.includes(meuId);
    const rotuloDoTipo = (id?: string) =>
      operationTypes.find((t) => t.id === id)?.label;

    const deAreas: MissaoDoCampo[] = areas
      .filter(
        (a) =>
          a.candidateId === checkInCandidateId &&
          minha(a.assignedDeltas || a.center?.assignedDeltas),
      )
      .map((a) => ({
        id: a.id,
        tipo: "area" as const,
        title: a.title,
        description: a.description || "",
        bairro: a.bairro || "",
        color: a.color || "#0C3556",
        lat: a.center?.lat ?? 0,
        lng: a.center?.lng ?? 0,
        raio: a.radius,
        material: a.center?.material || [],
        turno: a.center?.turno,
        priority: a.center?.priority,
        createdAt: a.createdAt,
      }));

    const dePinos: MissaoDoCampo[] = pins
      .filter(
        (p) =>
          p.candidateId === checkInCandidateId &&
          minha(p.assignedDeltas || p.position?.assignedDeltas),
      )
      .map((p) => ({
        id: p.id,
        tipo: "pin" as const,
        title: p.title,
        description: p.description || "",
        color: p.color || "#0C3556",
        lat: p.position?.lat ?? 0,
        lng: p.position?.lng ?? 0,
        tipoLabel: rotuloDoTipo(p.iconType),
        semLocal: p.position?.semLocal === true,
        material: p.position?.material || [],
        turno: p.position?.turno,
        priority: p.position?.priority,
        createdAt: p.createdAt,
      }));

    // Mais nova em cima: a missão que acabou de chegar é a que interessa.
    return [...deAreas, ...dePinos].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  }, [areas, pins, operationTypes, checkInCandidateId, authenticatedSupporter]);

  // Sem missão atribuída não há escolha a fazer: o check-in livre é o único
  // caminho, então o app já entra nele em vez de oferecer um botão.
  useEffect(() => {
    if (currentUrlView !== "checkin") return;
    if (!hasAssignedMissions && checkInMode !== "livre") {
      setCheckInMode("livre");
      setActiveMissionId(null);
    }
  }, [currentUrlView, hasAssignedMissions, checkInMode]);

  // Funções para manipulação de check-in
  const handleCheckInBairroChange = (bName: string) => {
    setCheckInBairro(bName);
    setCheckInRua("");
  };

  const handleCheckInFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked: File[] = e.target.files ? Array.from(e.target.files) : [];
    // O input é limpo aqui para permitir escolher o mesmo arquivo de novo.
    e.target.value = "";
    if (picked.length === 0) return;

    setCheckInMediaDrafts((prev) => {
      const accepted: CheckInMediaDraft[] = [];
      let full = false;
      let tooBig = false;

      for (const file of picked) {
        if (prev.length + accepted.length >= CHECKIN_MAX_MEDIA) {
          full = true;
          break;
        }
        const isVideo = file.type.startsWith("video/");
        const limit = isVideo
          ? CHECKIN_MAX_VIDEO_BYTES
          : CHECKIN_MAX_IMAGE_BYTES;
        if (file.size > limit) {
          tooBig = true;
          continue;
        }
        accepted.push({
          id: "media_" + Math.random().toString(36).substr(2, 9),
          type: isVideo ? "video" : "image",
          previewUrl: URL.createObjectURL(file),
          file,
        });
      }

      if (tooBig) {
        triggerNotification(
          "Cada foto deve ter até 5MB e cada vídeo até 50MB.",
          "error",
        );
      }
      if (full) {
        triggerNotification(
          `Você pode anexar no máximo ${CHECKIN_MAX_MEDIA} arquivos por check-in.`,
          "info",
        );
      }
      return accepted.length > 0 ? [...prev, ...accepted] : prev;
    });
  };

  const handleRemoveCheckInMedia = (id: string) => {
    setCheckInMediaDrafts((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  };

  // O cadastro pelo QR Code vem antes de qualquer outra tela: quem chegou com
  // um convite na mão está ali para se cadastrar, não para entrar no painel.
  if (inviteToken) {
    return <TeamSignupPage token={inviteToken} />;
  }

  if (currentUrlView === "checkin") {
    if (isCheckInPageInitializing) {
      return (
        <div className="min-h-screen w-full bg-[#E9F0F7] text-slate-800 flex flex-col justify-center items-center p-4 select-none font-sans">
          <div className="flex flex-col items-center justify-center">
            {/* Round Spinning Accent Arc exactly like the image */}
            <div className="relative flex items-center justify-center w-28 h-28">
              <svg
                className="animate-spin w-24 h-24 text-[#00A5FF]"
                viewBox="0 0 100 100"
                style={{ animationDuration: "1s" }}
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="95 200"
                  d="M 50,10 A 40,40 0 0,1 90,50"
                />
              </svg>
            </div>

            {/* Simulated interactive linear progress bar */}
            <div className="w-56 h-1 bg-white rounded-full overflow-hidden mt-12 relative shadow-2xs">
              <motion.div
                className="h-full bg-blue-600 rounded-full"
                initial={{ width: "12%" }}
                animate={{ width: ["12%", "35%", "65%", "85%", "100%", "12%"] }}
                transition={{
                  duration: 4,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "loop",
                }}
              />
            </div>

            {/* Bold text in Portuguese identical to image style */}
            <span className="text-[11px] font-black tracking-[0.25em] text-[#5A6E85] mt-6.5 uppercase select-none font-sans">
              Carregando...
            </span>
          </div>
        </div>
      );
    }

    const CITIES_BY_STATE_FALLBACK: {
      [key: string]: { id: number; ibgeId: number; name: string }[];
    } = {
      AL: [
        { id: 2704302, ibgeId: 2704302, name: "Maceió" },
        { id: 2700300, ibgeId: 2700300, name: "Arapiraca" },
        { id: 2706307, ibgeId: 2706307, name: "Palmeira dos Índios" },
        { id: 2707701, ibgeId: 2707701, name: "Rio Largo" },
        { id: 2709301, ibgeId: 2709301, name: "União dos Palmares" },
      ],
      PB: [
        { id: 2507507, ibgeId: 2507507, name: "João Pessoa" },
        { id: 2504009, ibgeId: 2504009, name: "Campina Grande" },
        { id: 2503209, ibgeId: 2503209, name: "Cabedelo" },
        { id: 2510808, ibgeId: 2510808, name: "Patos" },
        { id: 2513703, ibgeId: 2513703, name: "Santa Rita" },
        { id: 2501807, ibgeId: 2501807, name: "Bayeux" },
      ],
      SP: [
        { id: 3550308, ibgeId: 3550308, name: "São Paulo" },
        { id: 3509502, ibgeId: 3509502, name: "Campinas" },
        { id: 3548500, ibgeId: 3548500, name: "Santos" },
        { id: 3547809, ibgeId: 3547809, name: "Santo André" },
      ],
      RJ: [
        { id: 3304557, ibgeId: 3304557, name: "Rio de Janeiro" },
        { id: 3303302, ibgeId: 3303302, name: "Niterói" },
      ],
      DF: [{ id: 5300108, ibgeId: 5300108, name: "Brasília" }],
    };

    const stateFallbackList = CITIES_BY_STATE_FALLBACK[checkInEstadoUf] || [
      { id: 2704302, ibgeId: 2704302, name: "Maceió" },
    ];

    // List of cities for check-in dropdown
    const checkInCitiesList =
      checkInCities.length > 0 ? checkInCities : stateFallbackList;

    // List of districts based on selected city (Maceió uses local preset if API is empty/loading)
    const checkInDistrictsList =
      checkInDistricts.length > 0
        ? checkInDistricts.map((d) => ({ id: d.id.toString(), name: d.name }))
        : checkInMunicipio === "Maceió"
          ? MACEIO_BAIRROS.map((b) => ({ id: b.name, name: b.name }))
          : [];

    // List of streets based on selected neighborhood
    const selectedBairroObj = NEIGHBORHOOD_DATA.find(
      (b) => b.name === checkInBairro,
    );
    const checkInStreetsList =
      checkInStreets.length > 0
        ? checkInStreets.map((s) => ({ id: s.id.toString(), name: s.name }))
        : selectedBairroObj
          ? selectedBairroObj.ruas.map((r) => ({ id: r.name, name: r.name }))
          : [];

    const filteredCheckInCities = checkInCitiesList.filter((c) =>
      c.name.toLowerCase().includes(checkInMunicipioSearch.toLowerCase()),
    );

    const filteredCheckInDistricts = checkInDistrictsList.filter((b) =>
      b.name.toLowerCase().includes(checkInBairroSearch.toLowerCase()),
    );

    const filteredCheckInStreets = checkInStreetsList.filter((r) =>
      r.name.toLowerCase().includes(checkInRuaSearch.toLowerCase()),
    );

    // Modalidade 2: check-in livre, sem missão enviada pelo comitê.
    const isFreeCheckIn = checkInMode === "livre";
    const activeMission = activeMissionId
      ? [...areas, ...pins].find((m) => m.id === activeMissionId)
      : undefined;
    const selectedPriority = getCheckInPriority(checkInPriority);

    const handleSelectCheckInMode = (mode: CheckInMode) => {
      setCheckInMode(mode);
      if (mode === "livre") {
        // Um registro livre não pertence a nenhuma missão.
        setActiveMissionId(null);
      } else {
        setCheckInPriority("");
      }
    };

    const handleCheckInSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkInName.trim()) {
        triggerNotification("Por favor, digite seu nome.", "error");
        return;
      }
      if (!checkInCandidateId) {
        triggerNotification(
          "Por favor, selecione o cliente.",
          "error",
        );
        return;
      }
      if (!checkInBairro) {
        triggerNotification("Selecione o bairro onde você está.", "error");
        return;
      }
      if (!checkInRua) {
        triggerNotification("Selecione a rua onde você está.", "error");
        return;
      }
      if (isFreeCheckIn && !checkInPriority) {
        triggerNotification(
          "Informe o grau de prioridade/impacto da ocorrência.",
          "error",
        );
        return;
      }
      if (isFreeCheckIn && checkInMediaDrafts.length === 0) {
        triggerNotification(
          "Tire a foto do local para registrar o check-in livre.",
          "error",
        );
        return;
      }

      setIsSubmittingCheckIn(true);

      // Obter localização física exata do dispositivo via API Geolocation do navegador
      let userLat: number | undefined = prefetchedLatitude;
      let userLng: number | undefined = prefetchedLongitude;

      const requestPosition = (options: PositionOptions) =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });

      const describeGeoError = (geoErr: any) => {
        if (geoErr?.code === 1)
          return "Permissão de localização negada pelo navegador. Ative o acesso ao GPS para capturar a geolocalização física real.";
        if (geoErr?.code === 2)
          return "Sinal de GPS fraco ou indisponível no dispositivo.";
        if (geoErr?.code === 3)
          return "Tempo esgotado para obter a localização via GPS.";
        return "Não foi possível obter sua localização exata por GPS.";
      };

      // No check-in livre a posição precisa ser a de agora — a pessoa pode ter
      // andado depois que a tela abriu, e o pino vai exatamente onde ela está.
      if (navigator.geolocation && (isFreeCheckIn || !userLat || !userLng)) {
        try {
          const pos = await requestPosition({
            enableHighAccuracy: true,
            timeout: isFreeCheckIn ? 15000 : 5000,
            maximumAge: isFreeCheckIn ? 0 : 60000,
          });
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          setPrefetchedLatitude(userLat);
          setPrefetchedLongitude(userLng);
        } catch (geoErr: any) {
          console.warn("Could not capture user exact position on submit:", geoErr);
          if (!isFreeCheckIn || (!userLat && !userLng)) {
            triggerNotification(describeGeoError(geoErr), "info");
          }
        }
      } else if (!navigator.geolocation) {
        triggerNotification("A geolocalização por navegador não é suportada nesta máquina.", "info");
      }

      // O check-in livre é, por definição, o ponto exato onde a pessoa está.
      // Sem GPS não há como marcar o local certo no mapa, então ele é bloqueado.
      if (isFreeCheckIn && (userLat === undefined || userLng === undefined)) {
        setIsSubmittingCheckIn(false);
        triggerNotification(
          "Ative o GPS do aparelho para registrar o check-in livre: precisamos do ponto exato da ocorrência.",
          "error",
        );
        return;
      }

      // Geocodificação aproximada baseada na rua, bairro e município selecionados
      let checkInCoords = { lat: -9.6548, lng: -35.715 }; // Default Maceió Centro
      const stateCode = checkInEstadoUf || "AL";
      const cityName = checkInMunicipio;

      if (isFreeCheckIn) {
        // No check-in livre o pino é o ponto exato do aparelho: nada de
        // aproximar pelo nome da rua, senão a ocorrência sai do lugar.
        checkInCoords = { lat: userLat as number, lng: userLng as number };
      } else {
        try {
          const queries = [
            `${checkInRua}, ${checkInBairro}, ${cityName}, ${stateCode}, Brasil`,
            `${checkInRua}, ${cityName}, ${stateCode}, Brasil`,
            `${checkInBairro}, ${cityName}, ${stateCode}, Brasil`,
            `${cityName}, ${stateCode}, Brasil`,
          ];

          let found = false;
          for (let i = 0; i < queries.length; i++) {
            const q = queries[i];
            try {
              const resp = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`,
              );
              if (resp.ok) {
                const data = await resp.json();
                if (data && data.length > 0) {
                  const item = data[0];
                  checkInCoords = {
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                  };
                  found = true;
                  break;
                }
              }
            } catch (err) {
              console.warn("Erro no geocoding do check-in:", err);
            }
          }

          if (!found && selectedBairroObj) {
            const rObj = selectedBairroObj.ruas.find(
              (r) => r.name === checkInRua,
            );
            if (rObj) {
              checkInCoords = { lat: rObj.lat, lng: rObj.lng };
            } else {
              checkInCoords = {
                lat: selectedBairroObj.center.lat,
                lng: selectedBairroObj.center.lng,
              };
            }
          }
        } catch (err) {
          console.error("Erro geral no geocoding do check-in:", err);
        }
      }

      // Sobe cada foto/vídeo anexado e guarda a URL pública devolvida.
      const uploadedMedia: CheckInMedia[] = [];
      let failedUploads = 0;

      for (const draft of checkInMediaDrafts) {
        let resolvedUrl: string | null = null;

        if (isDatabaseConfigured) {
          try {
            const uploadRes = await DatabaseService.uploadMedia(draft.file);
            if (uploadRes.success && uploadRes.url) {
              resolvedUrl = uploadRes.url;
            } else {
              console.warn("Upload falhou:", uploadRes.error);
            }
          } catch (uploadErr) {
            console.error("Erro ao fazer upload do arquivo:", uploadErr);
          }
        }

        if (!resolvedUrl) {
          if (draft.type === "image") {
            // Sem Storage o que sobra é embutir a imagem no próprio registro.
            resolvedUrl = await readFileAsDataUrl(draft.file);
          } else {
            // Vídeo em base64 estoura o localStorage, então ele não é embutido.
            failedUploads += 1;
            continue;
          }
        }

        if (resolvedUrl) {
          uploadedMedia.push({ url: resolvedUrl, type: draft.type });
        } else {
          failedUploads += 1;
        }
      }

      if (failedUploads > 0) {
        triggerNotification(
          `${failedUploads} arquivo(s) não puderam ser enviados. Vídeos precisam do banco de dados configurado.`,
          "info",
        );
      }

      // A coluna photo continua com a primeira foto, para os registros antigos
      // e para as telas que mostram uma miniatura só.
      const uploadedPhotoUrl =
        uploadedMedia.find((m) => m.type === "image")?.url ||
        uploadedMedia[0]?.url ||
        null;

      const newCheckIn: CheckIn = {
        id: "checkin_" + Math.random().toString(36).substr(2, 9),
        name: checkInName,
        bairro: checkInBairro,
        rua: checkInRua,
        municipio: checkInMunicipio,
        estado: checkInEstado,
        photo: uploadedPhotoUrl || undefined,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        coordinates: checkInCoords, // Dropdown selection coordinates for the map
        userLatitude: userLat,      // Real user physical device latitude
        userLongitude: userLng,     // Real user physical device longitude
        createdAt: new Date().toISOString(),
        candidateId: checkInCandidateId || undefined,
        mode: checkInMode,
        priority: isFreeCheckIn
          ? (checkInPriority as CheckInPriority)
          : undefined,
        missionId: !isFreeCheckIn ? activeMissionId || undefined : undefined,
        missionTitle: !isFreeCheckIn
          ? activeMission?.title || undefined
          : undefined,
      };

      if (isDatabaseConfigured) {
        const res = await DatabaseService.upsertCheckIn(newCheckIn);
        if (!res.success) {
          console.error("Erro ao salvar check-in:", res.error);
          triggerNotification(`Erro ao salvar no banco: ${res.error || "Erro desconhecido"}. Confira se a tabela check_ins foi criada corretamente.`, "error");
          setIsSubmittingCheckIn(false);
          return; // Block success screen so user knows it failed to persist in backend database
        }

        if (authenticatedSupporter) {
          const supporterPayload = {
            id: authenticatedSupporter.id,
            full_name: checkInName,
            whatsapp: authenticatedSupporter.whatsapp,
            candidate_id: checkInCandidateId || undefined,
            image:
              uploadedPhotoUrl || authenticatedSupporter.image || undefined,
          };
          const supRes = await DatabaseService.upsertSupporter(supporterPayload);
          if (supRes.success) {
            const updatedAuth = {
              ...authenticatedSupporter,
              full_name: checkInName,
              name: checkInName,
              image: uploadedPhotoUrl || authenticatedSupporter.image || "",
            };
            setAuthenticatedSupporter(updatedAuth);
            localStorage.setItem(
              "checkin_supporter",
              JSON.stringify(updatedAuth),
            );
          } else {
            console.error(
              "Erro ao atualizar dados na tabela time_delta:",
              supRes.error,
            );
          }
        }
      }

      setCheckIns((prev) => [newCheckIn, ...prev]);
      setCheckInSuccess(true);
      setIsSubmittingCheckIn(false);
      triggerNotification("Check-in registrado com sucesso!", "success");
    };

    const handleResetCheckInForm = () => {
      const sName = authenticatedSupporter
        ? authenticatedSupporter.name ||
          authenticatedSupporter.nome ||
          authenticatedSupporter.nome_completo ||
          ""
        : "";
      setCheckInName(sName);
      setCheckInBairro("");
      setCheckInRua("");
      checkInMediaDrafts.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      setCheckInMediaDrafts([]);
      setCheckInSuccess(false);
      setCheckInCandidateId("");
      setCheckInMunicipio("Maceió");
      setCheckInMunicipioIbgeId(2704302);
      setCheckInDistrictId(null);
      setCheckInPriority("");
      setActiveMissionId(null);
    };

    if (!authenticatedSupporter) {
      const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const contactInput = loginWhatsapp.replace(/\D/g, "");
        if (!contactInput) {
          triggerNotification(
            "Por favor, informe seu número de WhatsApp.",
            "error",
          );
          return;
        }

        // A Equipe vem da base externa, então é nela que o número é procurado
        // primeiro. Só se não houver correspondência o fluxo antigo entra.
        const teamMatch = supporters.find(
          (member: any) =>
            samePhoneNumber(member?.whatsapp, contactInput) &&
            (!checkInCandidateId ||
              String(member?.candidate_id) === String(checkInCandidateId)),
        );

        if (teamMatch) {
          const authObj = {
            id: teamMatch.id,
            name: teamMatch.full_name,
            full_name: teamMatch.full_name,
            whatsapp: teamMatch.whatsapp,
            image: teamMatch.image || "",
            candidate_id: teamMatch.candidate_id,
          };
          setAuthenticatedSupporter(authObj);
          localStorage.setItem("checkin_supporter", JSON.stringify(authObj));
          setCheckInName(teamMatch.full_name);
          if (teamMatch.candidate_id) {
            setCheckInCandidateId(teamMatch.candidate_id);
          }
          triggerNotification(`Bem-vindo, ${teamMatch.full_name}!`, "success");
          return;
        }

        // Número existe, mas na Equipe de outro cliente: dizer isso é mais
        // útil do que um "não localizado" genérico.
        const otherTeamMatch = supporters.find((member: any) =>
          samePhoneNumber(member?.whatsapp, contactInput),
        );
        if (otherTeamMatch && checkInCandidateId) {
          const currentCandidate = candidates.find(
            (c) => c.id === checkInCandidateId,
          );
          triggerNotification(
            `Este número não faz parte da Equipe de ${currentCandidate?.name || "este cliente"}.`,
            "error",
          );
          return;
        }

        if (!isDatabaseConfigured) {
          triggerNotification(
            "Banco de dados não configurado. Entrando em modo demonstração.",
            "info",
          );
          const demoSupporter = {
            id: "demo",
            name: "João da Silva",
            full_name: "João da Silva",
            whatsapp: contactInput,
            image:
              "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
          };
          setAuthenticatedSupporter(demoSupporter);
          localStorage.setItem(
            "checkin_supporter",
            JSON.stringify(demoSupporter),
          );
          setCheckInName("João da Silva");
          return;
        }

      /**
       * Trava de aparelho.
       *
       * Quem se cadastrou pelo QR Code ficou ligado ao aparelho daquele
       * momento; é dele, e só dele, que o painel abre. O reconhecimento tenta
       * primeiro o identificador guardado no cookie e, se ele não estiver mais
       * lá (cookie limpo, navegação privada), a impressão do aparelho — tela,
       * sistema, fuso, idioma. Mesmo aparelho, mesmo acesso.
       *
       * Duas situações abrem exceção, senão a trava prenderia quem não deve:
       * integrante sem nenhum aparelho guardado (cadastro antigo, anterior a
       * esta trava) vincula o aparelho no primeiro acesso; e falha de leitura
       * no banco não bloqueia ninguém — não dá para trancar a equipe inteira do
       * lado de fora porque uma consulta não respondeu.
       */
      const validarAparelhoDoMembro = async (
        memberId: string,
        whatsapp: string,
        candidateId: string,
      ) => {
        if (!memberId) return true;
        try {
          const ficha = await lerDispositivo();
          const lista = await DatabaseService.listarDispositivosMembro(memberId);
          if (!lista.success) return true;

          const aparelhos = lista.data || [];
          if (aparelhos.length === 0) {
            await DatabaseService.registrarDispositivoMembro({
              memberId,
              candidateId,
              whatsapp,
              origem: "login",
              ficha,
            });
            return true;
          }

          const porCookie = aparelhos.find(
            (d: any) => d.device_id_hash && d.device_id_hash === ficha.deviceIdHash,
          );
          const porImpressao = aparelhos.find(
            (d: any) => d.fingerprint && d.fingerprint === ficha.fingerprint,
          );
          const conhecido = porCookie || porImpressao;

          if (!conhecido) {
            triggerNotification("Acesso negado", "error");
            return false;
          }

          await DatabaseService.marcarDispositivoVisto(conhecido.id, ficha);
          return true;
        } catch (err) {
          console.warn("Não foi possível conferir o aparelho:", err);
          return true;
        }
      };

        setIsVerifyingLogin(true);
        const res = await DatabaseService.checkSupporter(contactInput);
        setIsVerifyingLogin(false);

        if (res.success && res.supporter) {
          const sup = res.supporter;
          const sName =
            sup.full_name ||
            sup.name ||
            sup.nome ||
            sup.nome_completo ||
            "Apoiador Cadastrado";
          const sImage = sup.image || sup.foto_url || "";
          const sCandId = sup.candidate_id || sup.candidateId || "";

          // Validação: de qual base de cliente o apoiador faz parte?
          if (
            checkInCandidateId &&
            String(sCandId) !== String(checkInCandidateId)
          ) {
            const currentCandidate = candidates.find(
              (c) => c.id === checkInCandidateId,
            );
            const candidateName = currentCandidate
              ? currentCandidate.name
              : "este cliente";
            triggerNotification(
              `Este número não foi encontrado na base de integrantes de ${candidateName}.`,
              "error",
            );
            return;
          }

          // O painel abre só no aparelho em que a pessoa se cadastrou: número
          // certo digitado em outro celular não entra no lugar de ninguém.
          const liberado = await validarAparelhoDoMembro(sup.id, sup.whatsapp, sCandId);
          if (!liberado) return;

          const authObj = {
            id: sup.id || "sup_" + Math.random(),
            name: sName,
            full_name: sup.full_name || sName,
            whatsapp: sup.whatsapp,
            image: sImage,
            candidate_id: sCandId,
          };
          setAuthenticatedSupporter(authObj);
          localStorage.setItem("checkin_supporter", JSON.stringify(authObj));
          setCheckInName(sName);
          if (sCandId) {
            setCheckInCandidateId(sCandId);
          }
          triggerNotification(`Bem-vindo, ${sName}!`, "success");
        } else {
          triggerNotification(
            res.error ||
              "Número de WhatsApp não localizado na lista de apoiadores.",
            "error",
          );
        }
      };

      const handleDemoBypass = () => {
        const demoSupporter = {
          id: "demo",
          name: "João da Silva",
          full_name: "João da Silva",
          whatsapp: loginWhatsapp || "82999999999",
          image:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        };
        setAuthenticatedSupporter(demoSupporter);
        localStorage.setItem(
          "checkin_supporter",
          JSON.stringify(demoSupporter),
        );
        setCheckInName("João da Silva");
        triggerNotification("Entrou em modo de demonstração!", "info");
      };

      const activeCandidate = checkInCandidateId
        ? candidates.find((c) => c.id === checkInCandidateId)
        : null;
      const partyInfo = activeCandidate
        ? getPartidoBadge(activeCandidate)
        : null;

      return (
        <div className="min-h-[100dvh] w-full flex flex-col text-slate-800 font-sans relative overflow-hidden bg-linear-to-b from-[#E8EEF4] to-[#D6DFE8] selection:bg-[#0C3556] selection:text-white">
          {/* Toast Notification HUD no modo Login */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-3000 max-w-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-indigo-500/20 bg-indigo-600 text-white"
              >
                <Check className="w-5 h-5 shrink-0 text-emerald-300" />
                <span className="text-xs font-semibold">
                  {notification.text}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Malha de pontos ligados, de fundo.
              Fica atrás de tudo, bem discreta, e some antes do rodapé. */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{
              // Forte no topo e um sussurro embaixo: a malha envolve a
              // composição inteira, sem deixar metade da tela pelada.
              maskImage:
                'linear-gradient(to bottom, #000 0%, #000 42%, rgba(0,0,0,.28) 68%, rgba(0,0,0,.16) 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, #000 0%, #000 42%, rgba(0,0,0,.28) 68%, rgba(0,0,0,.16) 100%)'
            }}
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 390 700"
              preserveAspectRatio="xMidYMid slice"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="brilhoMalha" cx="74%" cy="16%" r="60%">
                  <stop offset="0%" stopColor="#0C3556" stopOpacity="0.09" />
                  <stop offset="100%" stopColor="#0C3556" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="390" height="700" fill="url(#brilhoMalha)" />
              <path
                d="M232 82 L300 38 M300 38 L362 66 M362 66 L330 134 M330 134 L300 38 M330 134 L378 176
                   M232 82 L168 150 M168 150 L86 118 M86 118 L24 170 M168 150 L212 240 M212 240 L330 134
                   M212 240 L120 296 M120 296 L24 170 M120 296 L268 352 M268 352 L378 176
                   M268 352 L196 470 M196 470 L64 424 M196 470 L318 556 M318 556 L378 176
                   M196 470 L120 620 M120 620 L64 424 M120 620 L286 668 M286 668 L318 556"
                stroke="#0C3556"
                strokeOpacity="0.12"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              {[
                [300, 38, 6],
                [362, 66, 4.5],
                [330, 134, 5],
                [378, 176, 4],
                [232, 82, 4.5],
                [168, 150, 5],
                [86, 118, 4],
                [24, 170, 4.5],
                [212, 240, 5.5],
                [120, 296, 4.5],
                [268, 352, 4],
                [196, 470, 5],
                [64, 424, 4],
                [318, 556, 4.5],
                [120, 620, 4],
                [286, 668, 3.5]
              ].map(([cx, cy, r], i) => (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={r * 2.6} fill="#0C3556" fillOpacity="0.045" />
                  <circle cx={cx} cy={cy} r={r} fill="#0C3556" fillOpacity="0.18" />
                </g>
              ))}
            </svg>
          </div>

          {/* Uma composição só, centrada na tela.
              O formulário é curto e o celular é alto: em vez de esticar cartão
              ou empilhar tudo no topo, marca, título e cartão viajam juntos no
              meio, e a sobra vira margem igual em cima e embaixo. */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex-1 min-h-0 flex items-center justify-center px-6 py-8"
          >
            <div className="w-full max-w-[400px]">
              <div className="flex items-center gap-3 select-none">
                <span className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0">
                  <BrandMark size={44} rounded={14} variant="clara" />
                </span>
                <span className="text-[17px] font-extrabold text-[#0C3556] tracking-tight">
                  Mapa Operacional
                </span>
              </div>

              <h1
                className="mt-6 leading-[1.12] font-extrabold text-[#0C3556] tracking-tight select-none"
                style={{ fontSize: 'clamp(27px, 8.4vw, 34px)' }}
              >
                Pronto para
                <br />
                entrar em campo?
              </h1>

              <div className="mt-7 bg-white rounded-[1.75rem] shadow-[0_18px_40px_-18px_rgba(12,53,86,.35)] border border-white/70 px-6 py-7">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#9AA9B8]">
                  Identificação
                </p>
                <span className="block w-9 h-[3px] rounded-full bg-[#E3E9EF] mt-2.5" />

                <form onSubmit={handleLoginSubmit} className="mt-5 text-left">
                  <label className="block text-[12px] font-extrabold uppercase tracking-wider text-[#5A6E85]">
                    Telefone (WhatsApp)
                  </label>

                  <div className="mt-2.5 rounded-2xl bg-[#F4F7FA] border border-[#E4EBF1] flex items-center px-4 overflow-hidden transition-all focus-within:border-[#F58220] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#F58220]/12">
                    <Phone className="w-5 h-5 text-[#F58220] shrink-0 mr-3" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      placeholder="(00) 00000-0000"
                      value={loginWhatsapp}
                      onChange={(e) => {
                        const val = e.target.value;
                        const digits = val.replace(/\D/g, "");
                        if (digits.length <= 11) {
                          let masked = "";
                          if (digits.length > 0) {
                            if (digits.length <= 2) {
                              masked = `(${digits}`;
                            } else if (digits.length <= 6) {
                              masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                            } else if (digits.length <= 10) {
                              masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
                            } else {
                              masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                            }
                          }
                          setLoginWhatsapp(masked);
                        }
                      }}
                      className="w-full py-4 bg-transparent border-none text-[15px] font-bold text-[#0C3556] placeholder-[#B9C6D2] focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isVerifyingLogin ||
                      loginWhatsapp.replace(/\D/g, "").length < 10
                    }
                    className="mt-4 w-full py-4 bg-[#0C3556] hover:bg-[#10406A] focus:ring-4 focus:ring-[#0C3556]/20 disabled:bg-[#C2D0DC] disabled:cursor-not-allowed text-white font-extrabold text-[12.5px] uppercase tracking-wider rounded-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isVerifyingLogin ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Validando...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar no Painel</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {!isDatabaseConfigured && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10.5px] text-zinc-500 leading-normal bg-[#FAFAD2]/60 p-3 rounded-2xl border border-[#FAFAD2] text-left font-sans">
                      ⚠️ <strong>Integração Offline:</strong> as credenciais do
                      banco de dados não foram preenchidas. Caso queira testar o
                      fluxo de login de forma simulada, use o botão de
                      demonstração:
                    </p>
                    <button
                      type="button"
                      onClick={handleDemoBypass}
                      className="w-full py-3 bg-[#EBF1F6] hover:bg-[#DDE5EE] text-[#5A6E85] font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Demonstração Bypass (Apoiador Demo)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    // Check-in em forma de conversa: uma etapa por vez, com os dados reais do
    // integrante, do cliente e do aparelho.
    if (!checkInSuccess) {
      const clienteDoLink = candidates.find((c) => c.id === checkInCandidateId);
      return (
        <CheckInChat
          member={authenticatedSupporter}
          clientId={checkInCandidateId}
          clientName={clienteDoLink?.name || ""}
          operationTypes={operationTypes
            // Tipo desligado não aparece no check-in; o histórico dele fica.
            .filter(
              (t) => t.candidateId === checkInCandidateId && t.active !== false,
            )
            .sort(
              (a, b) =>
                (a.position ?? 0) - (b.position ?? 0) ||
                a.label.localeCompare(b.label),
            )}
          // Inclui os desligados: um nome já usado não pode voltar como novo.
          nomesReservados={operationTypes
            .filter((t) => t.candidateId === checkInCandidateId)
            .map((t) => t.label)}
          missoes={missoesDoIntegrante}
          onTipoCriado={(tipo) =>
            setOperationTypes((prev) =>
              prev.some((t) => t.id === tipo.id) ? prev : [...prev, tipo],
            )
          }
          notify={triggerNotification}
          onBack={() => {
            setAuthenticatedSupporter(null);
            localStorage.removeItem("checkin_supporter");
          }}
          onSaved={(registro) => {
            setCheckIns((prev) => [registro, ...prev]);
            setCheckInSuccess(true);
          }}
        />
      );
    }

    return (
      <div className="min-h-screen w-full bg-[#DBE2E9] text-slate-800 flex flex-col justify-between p-4 selection:bg-blue-500 selection:text-white font-sans">
        {/* Toast Notification HUD no modo CheckIn */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] max-w-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-blue-500/20 bg-blue-600 text-white"
            >
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-semibold">{notification.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header de Apoio / Logout do CheckIn */}
        <header className="max-w-[550px] w-full mx-auto bg-white/70 backdrop-blur-md px-6 py-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-xs mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-left">
              <strong className="text-slate-800 text-xs font-bold leading-tight block">
                {authenticatedSupporter?.name || checkInName || "Apoiador"}
              </strong>
            </div>
          </div>
          <button
            onClick={() => {
              showConfirm(
                "Encerrar Sessão",
                "Deseja realmente sair da sua conta de apoiador?",
                () => {
                  setAuthenticatedSupporter(null);
                  setCheckInName("");
                  localStorage.removeItem("checkin_supporter");
                  triggerNotification("Sessão encerrada com sucesso.", "info");
                },
                { confirmText: "Sair", cancelText: "Voltar" },
              );
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
            title="Sair da Conta"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </header>

        {/* Espaçador superior para equilibrar o centralizador vertical no desktop */}
        <div className="hidden md:block flex-1" />

        {/* Formulário / Tela de Sucesso */}
        <main className="max-w-[650px] w-full mx-auto p-1.5 flex-none my-6">
          <AnimatePresence mode="wait">
            {checkInSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white p-8 md:p-10 rounded-[2rem] shadow-xl space-y-6 text-center text-slate-800 border border-slate-100"
              >
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                  <div className="w-16 h-16 rounded-full bg-emerald-500 border border-emerald-400 flex items-center justify-center text-white">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="font-extrabold text-slate-900 text-2xl">
                    Check-in Realizado!
                  </h2>
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 text-left space-y-3.5 divide-y divide-slate-200/50">
                  <div className="pb-1">
                    <span className="text-[10px] text-black uppercase tracking-wider font-extrabold block">
                      Voluntário
                    </span>
                    <strong className="text-slate-800 text-sm block mt-0.5">
                      {checkInName}
                    </strong>
                  </div>
                  <div className="pt-3">
                    <span className="text-[10px] text-black uppercase tracking-wider font-extrabold block">
                      Localização
                    </span>
                    <strong className="text-[#3B82F6] text-sm block mt-0.5">
                      {checkInRua}, {checkInBairro}
                      {checkInMunicipio !== "Maceió"
                        ? `, ${checkInMunicipio}`
                        : ""}
                    </strong>
                  </div>
                  <div className="pt-3">
                    <span className="text-[10px] text-black uppercase tracking-wider font-extrabold block">
                      Modalidade
                    </span>
                    <strong className="text-slate-800 text-sm block mt-0.5">
                      {isFreeCheckIn
                        ? "Check-in livre (sem missão)"
                        : activeMission
                          ? `Missão: ${activeMission.title}`
                          : "Check-in por missão"}
                    </strong>
                  </div>
                  {isFreeCheckIn && selectedPriority && (
                    <div className="pt-3">
                      <span className="text-[10px] text-black uppercase tracking-wider font-extrabold block">
                        Prioridade / Impacto
                      </span>
                      <strong
                        className="text-sm mt-0.5 inline-flex items-center gap-1.5"
                        style={{ color: selectedPriority.color }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: selectedPriority.color }}
                        />
                        {selectedPriority.label}
                      </strong>
                    </div>
                  )}
                  {checkInMediaDrafts.length > 0 && (
                    <div className="pt-3 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        {checkInMediaDrafts.map((item) => (
                          <div
                            key={item.id}
                            className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-3xs flex-shrink-0 bg-slate-100"
                          >
                            {item.type === "video" ? (
                              <>
                                <video
                                  src={item.previewUrl}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/35 text-white">
                                  <Video className="w-4 h-4" />
                                </span>
                              </>
                            ) : (
                              <img
                                src={item.previewUrl}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-slate-500 font-semibold font-sans block">
                        {checkInMediaDrafts.length} arquivo(s) anexado(s) e
                        enviado(s)!
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-4">
                  <button
                    onClick={handleResetCheckInForm}
                    className="w-full py-3.5 bg-[#3B82F6] hover:bg-blue-600 text-white font-extrabold text-sm rounded-full transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-98"
                  >
                    Realizar Novo Check-in
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                onSubmit={handleCheckInSubmit}
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -15 }}
                className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-xl space-y-6 text-slate-800 border border-slate-100/50"
              >
                {/* Cabeçalho do Check-in com perfil do Usuário */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="text-left">
                    <h2 className="font-extrabold text-slate-900 text-3xl tracking-tight">
                      Check-in
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                      {isFreeCheckIn
                        ? "Registre o que você encontrou, no ponto exato."
                        : "Valide sua presença no local designado."}
                    </p>
                  </div>

                  {/* Usuário Pilha/Card no topo direito */}
                  {authenticatedSupporter && (
                    <div
                      onClick={() => {
                        showConfirm(
                          "Encerrar Sessão",
                          "Deseja realmente sair da sua conta de apoiador?",
                          () => {
                            setAuthenticatedSupporter(null);
                            setCheckInName("");
                            localStorage.removeItem("checkin_supporter");
                            triggerNotification(
                              "Sessão encerrada com sucesso.",
                              "info",
                            );
                          },
                          { confirmText: "Sair", cancelText: "Voltar" },
                        );
                      }}
                      className="bg-[#F4F7F9] hover:bg-[#EBF1F6] border border-slate-100/80 rounded-full px-5 py-2.5 flex items-center gap-3 transition-all cursor-pointer self-start sm:self-center group relative shadow-3xs"
                      title="Clique para Sair da Conta"
                    >
                      {/* Avatar com selo verificado */}
                      <div className="relative w-11 h-11 shrink-0 rounded-full">
                        <img
                          src={
                            authenticatedSupporter.image ||
                            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                          }
                          alt="Foto do usuário"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-full border border-white shadow-2xs"
                        />
                        {/* Selo verde verificado */}
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#00875A] border-2 border-white rounded-full flex items-center justify-center text-white"
                          title="Verificado"
                        >
                          <svg
                            className="w-2.5 h-2.5 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Nome e subtítulo de verificado */}
                      <div className="flex flex-col text-left font-sans select-none pr-1">
                        <span className="font-bold text-xs sm:text-[13px] text-slate-900 leading-tight group-hover:text-[#F58220] transition-colors">
                          {authenticatedSupporter.full_name ||
                            authenticatedSupporter.name ||
                            checkInName}
                        </span>
                        <span className="text-[8px] font-black tracking-widest text-[#00875A] mt-0.5 leading-none">
                          VOLUNTÁRIO
                        </span>
                        <span className="text-[8px] font-black tracking-widest text-[#00875A] mt-0.5 leading-none">
                          VERIFICADO
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status da Conexão com o Banco de Dados */}
                {isDatabaseConfigured ? (
                  databaseError ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-left">
                      <div className="flex gap-2.5 items-start">
                        <span className="text-xl">⚠️</span>
                        <div className="font-sans select-none">
                          <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest">Erro de Banco de Dados</h4>
                          <p className="text-[10px] text-rose-600 font-bold mt-1 leading-relaxed">
                            O banco de dados está configurado, mas houve um erro ao sincronizar: <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-[9px] font-extrabold">{databaseError}</code>. 
                            Confira se a tabela <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-[9px] font-extrabold">check_ins</code> e as demais foram criadas com o script de instalação.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-left shadow-3xs">
                      <div className="flex gap-2 items-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider font-sans select-none">
                          Sincronização em Tempo Real Ativa
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
                    <div className="flex gap-2.5 items-start">
                      <span className="text-xl">⚠️</span>
                      <div className="font-sans select-none">
                        <h4 className="text-xs font-black text-amber-850 uppercase tracking-widest">Aviso: Modo de Teste / Local Ativo</h4>
                        <p className="text-[10px] text-amber-700 font-bold mt-1 leading-relaxed">
                          As credenciais do <strong className="text-amber-900 font-black">banco de dados</strong> não foram configuradas na hospedagem deste site.
                        </p>
                        <p className="text-[10px] text-amber-700 font-bold mt-1 leading-relaxed">
                          O check-in ficará registrado <strong className="text-amber-900 font-black">apenas localmente</strong> na memória deste navegador e não será enviado para o painel consolidado do comitê de campanha.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* GPS Status Indicator */}
                <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1">
                      <span className="flex h-3 w-3 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${prefetchedLatitude ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${prefetchedLatitude ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 leading-none">
                        {prefetchedLatitude ? "✓ GPS Integrado e Capturado" : "Buscando Sinal de GPS..."}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-1 leading-normal">
                        {prefetchedLatitude 
                          ? `Localização exata correspondente: ${prefetchedLatitude.toFixed(6)}, ${prefetchedLongitude.toFixed(6)}`
                          : "Por favor, ative a localização do seu dispositivo no navegador para capturar a geolocalização física verdadeira."}
                      </p>
                    </div>
                  </div>
                  {prefetchedLatitude ? (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 self-start sm:self-center">
                      GPS Ativo
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setPrefetchedLatitude(pos.coords.latitude);
                              setPrefetchedLongitude(pos.coords.longitude);
                              triggerNotification("Localização física capturada com sucesso!", "success");
                            },
                            (err) => {
                              console.error(err);
                              triggerNotification("Permissão de GPS negada ou erro de requisição.", "info");
                            },
                            { enableHighAccuracy: true, timeout: 8000 }
                          );
                        }
                      }}
                      className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 bg-[#F58220] hover:bg-[#E06E10] text-[#FFF] rounded-lg transition-colors cursor-pointer self-start sm:self-center shrink-0 active:scale-95 duration-150"
                    >
                      Autorizar GPS
                    </button>
                  )}
                </div>

                {/* Escolher Cliente Apoiado */}
                <div className="space-y-1.5 text-left">
                  {candidates.find((c) => c.id === checkInCandidateId) ? (
                    <div className="bg-slate-50 border border-slate-250/60 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 border border-white shadow-2xs shrink-0">
                          <img
                            src={
                              candidates.find(
                                (c) => c.id === checkInCandidateId,
                              )?.image ||
                              "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=256&h=256&q=80"
                            }
                            alt="Cliente"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="font-sans">
                          <span className="text-[9px] font-black uppercase text-[#F58220] tracking-wider block">
                            Cliente Vinculado
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-slate-800 block leading-tight">
                            {
                              candidates.find(
                                (c) => c.id === checkInCandidateId,
                              )?.name
                            }
                          </span>
                          <span className="text-[10px] text-slate-500 block leading-tight">
                            {candidates.find((c) => c.id === checkInCandidateId)
                              ?.office || "Cliente"}
                          </span>
                        </div>
                      </div>
                      {/* Button 'Alterar' removed by user request */}
                    </div>
                  ) : (
                    <>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                        Cliente deste Check-in *
                      </label>
                      <select
                        value={checkInCandidateId}
                        onChange={(e) => setCheckInCandidateId(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-sm font-sans font-semibold text-slate-800 transition-all cursor-pointer hover:border-slate-350 focus:outline-hidden"
                      >
                        <option value="">Selecione o Cliente...</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.office || "Cliente"})
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {/* Seleção da Modalidade: só faz sentido com missão atribuída */}
                {hasAssignedMissions && (
                <div className="space-y-2 text-left">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                    Modalidade do Check-in *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-sans">
                    <button
                      type="button"
                      onClick={() => handleSelectCheckInMode("missao")}
                      className={`p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-98 ${
                        !isFreeCheckIn
                          ? "border-[#F58220] bg-orange-50/40 ring-2 ring-[#F58220]/15 shadow-2xs"
                          : "border-slate-200 bg-white hover:border-slate-350"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            !isFreeCheckIn
                              ? "bg-[#F58220] text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          <Target className="w-4 h-4" />
                        </span>
                        <h5 className="font-extrabold text-[12px] text-slate-800 leading-tight">
                          Tenho uma missão
                        </h5>
                        {!isFreeCheckIn && (
                          <Check className="w-3.5 h-3.5 text-[#F58220] stroke-[3] ml-auto shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug mt-1.5">
                        Marque presença numa área ou ponto enviado pelo comitê.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectCheckInMode("livre")}
                      className={`p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-98 ${
                        isFreeCheckIn
                          ? "border-[#F58220] bg-orange-50/40 ring-2 ring-[#F58220]/15 shadow-2xs"
                          : "border-slate-200 bg-white hover:border-slate-350"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isFreeCheckIn
                              ? "bg-[#F58220] text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          <AlertCircle className="w-4 h-4" />
                        </span>
                        <h5 className="font-extrabold text-[12px] text-slate-800 leading-tight">
                          Check-in livre
                        </h5>
                        {isFreeCheckIn && (
                          <Check className="w-3.5 h-3.5 text-[#F58220] stroke-[3] ml-auto shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug mt-1.5">
                        Viu algo na rua e quer registrar agora, sem missão.
                      </p>
                    </button>
                  </div>

                </div>
                )}


                {/* Lista Coesiva de Missões Ativas de Campo do Voluntário */}
                {!isFreeCheckIn &&
                  (() => {
                  if (!checkInCandidateId) {
                    return (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5 text-center font-sans animate-in fade-in duration-200">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <Target className="w-4 h-4" />
                        </div>
                        <p className="text-xs text-slate-500 font-bold">
                          Selecione o cliente acima para carregar as missões
                          de campo.
                        </p>
                      </div>
                    );
                  }

                  // Get both areas and pins
                  const candidateAreas = areas.filter(
                    (a) => a.candidateId === checkInCandidateId,
                  );
                  const candidatePins = pins.filter(
                    (p) => p.candidateId === checkInCandidateId,
                  );

                  // Filter by user authentication - show ONLY explicitly assigned missions
                  const userAreas = candidateAreas.filter((a) => {
                    if (!authenticatedSupporter?.id) return false;
                    const assigned =
                      a.assignedDeltas || a.center?.assignedDeltas || [];
                    return assigned.includes(authenticatedSupporter.id);
                  });

                  const userPins = candidatePins.filter((p) => {
                    if (!authenticatedSupporter?.id) return false;
                    const assigned =
                      p.assignedDeltas || p.position?.assignedDeltas || [];
                    return assigned.includes(authenticatedSupporter.id);
                  });

                  const totalUserMissions = userAreas.length + userPins.length;

                  // Sem missão a tela já está em modo livre; nada a mostrar aqui.
                  if (totalUserMissions === 0) {
                    return null;
                  }

                  return (
                    <div className="space-y-3 font-sans animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5 font-sans">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          Suas Missões e Áreas de Trabalho ({totalUserMissions})
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {/* Render Areas */}
                        {userAreas.map((area) => {
                          const isSelected = activeMissionId === area.id;
                          const assignedIds =
                            area.assignedDeltas ||
                            area.center?.assignedDeltas ||
                            [];
                          const isExclusive = assignedIds.includes(
                            authenticatedSupporter?.id,
                          );

                          return (
                            <div
                              key={area.id}
                              onClick={() => {
                                setActiveMissionId(area.id);
                                if (area.bairro) {
                                  setCheckInBairro(area.bairro);
                                  // Pre-fill search state to make it match dropdown logic
                                  setCheckInBairroDropdownOpen(false);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all duration-150 cursor-pointer relative group ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-50/15 ring-2 ring-emerald-500/20"
                                  : "border-slate-200 bg-white hover:border-slate-350 shadow-3xs"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: area.color || "#4338ca",
                                    }}
                                  />
                                  <h5 className="font-extrabold text-[12px] text-slate-800 line-clamp-1">
                                    {area.title}
                                  </h5>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {isExclusive && (
                                    <span className="text-[8px] bg-indigo-50 text-indigo-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      Direcionada
                                    </span>
                                  )}
                                  <span className="text-[8px] bg-slate-50 text-slate-500 border border-slate-100 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Raio {area.radius}m
                                  </span>
                                </div>
                              </div>

                              <p className="text-[10.5px] text-slate-500 leading-snug">
                                {area.description ||
                                  "Ação de panfletagem de rua agendada pelo comitê."}
                              </p>

                              <div className="flex items-center justify-between text-[9.5px] text-slate-400 font-medium pt-1.5 border-t border-slate-100/75">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  Bairro:{" "}
                                  <strong className="text-slate-700 font-extrabold">
                                    {area.bairro || "Geral"}
                                  </strong>
                                </span>
                                <span
                                  className={`font-bold transition-colors ${isSelected ? "text-emerald-600 font-black" : "text-indigo-600 group-hover:text-indigo-700"}`}
                                >
                                  {isSelected ? "✓ Selecionada" : "Selecionar"}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Render Pins */}
                        {userPins.map((pin) => {
                          const isSelected = activeMissionId === pin.id;
                          const assignedIds =
                            pin.assignedDeltas ||
                            pin.position?.assignedDeltas ||
                            [];
                          const isExclusive = assignedIds.includes(
                            authenticatedSupporter?.id,
                          );

                          return (
                            <div
                              key={pin.id}
                              onClick={() => {
                                setActiveMissionId(pin.id);
                              }}
                              className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all duration-150 cursor-pointer relative group ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-50/15 ring-2 ring-emerald-500/20"
                                  : "border-slate-200 bg-white hover:border-slate-350 shadow-3xs"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: pin.color || "#f97316",
                                    }}
                                  />
                                  <h5 className="font-extrabold text-[12px] text-slate-800 line-clamp-1">
                                    Ponto: {pin.title}
                                  </h5>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {isExclusive && (
                                    <span className="text-[8px] bg-indigo-50 text-indigo-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      Direcionada
                                    </span>
                                  )}
                                  <span className="text-[8px] bg-orange-50 text-orange-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Tático
                                  </span>
                                </div>
                              </div>

                              <p className="text-[10.5px] text-slate-500 leading-snug">
                                {pin.description ||
                                  "Ponto de apoio ou liderança mapeada."}
                              </p>

                              <div className="flex items-center justify-between text-[9.5px] text-slate-400 font-medium pt-1.5 border-t border-slate-100/75">
                                <span className="flex items-center gap-1">
                                  <Target className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  Foco:{" "}
                                  <strong className="text-slate-700 font-extrabold">
                                    {operationTypeLabel(pin.iconType)}
                                  </strong>
                                </span>
                                <span
                                  className={`font-bold transition-colors ${isSelected ? "text-emerald-600 font-black" : "text-indigo-600 group-hover:text-indigo-700"}`}
                                >
                                  {isSelected ? "✓ Selecionada" : "Selecionar"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Check-in Mission Linkage Feedback */}
                {!isFreeCheckIn &&
                  (() => {
                  if (!activeMissionId || !activeMission) return null;
                  return (
                    <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3 text-left font-sans flex items-center justify-between animate-in slide-in-from-top-1 duration-150">
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase font-black tracking-wider text-emerald-700 block">
                          Check-in Vinculado à Missão
                        </span>
                        <h5 className="font-bold text-xs text-slate-800">
                          {activeMission.title}
                        </h5>
                        {activeMission.bairro && (
                          <p className="text-[10px] text-slate-500">
                            Bairro pré-preenchido automáticamente:{" "}
                            <strong className="text-emerald-700">
                              {activeMission.bairro}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Município Selector */}
                <div className="space-y-1.5 text-left relative">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                    Município *
                  </label>

                  {checkInMunicipioManual || checkInCitiesList.length === 0 ? (
                    <div className="relative font-sans">
                      <input
                        type="text"
                        required
                        placeholder="Digite o nome do município..."
                        value={checkInMunicipio}
                        onChange={(e) => {
                          setCheckInMunicipio(e.target.value);
                          setCheckInMunicipioIbgeId(0);
                          // Reset dependents
                          setCheckInBairro("");
                          setCheckInDistrictId(null);
                          setCheckInRua("");
                        }}
                        className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-sm font-sans font-semibold text-slate-800 transition-all focus:outline-hidden"
                      />
                      {checkInCitiesList.length === 0 && (
                        <span className="absolute right-3.5 top-3 text-[9px] px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-400 font-bold rounded-md select-none">
                          Sem lista (Manual)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="relative font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          setCheckInMunicipioDropdownOpen(
                            !checkInMunicipioDropdownOpen,
                          );
                          setCheckInBairroDropdownOpen(false);
                          setCheckInRuaDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-left text-sm font-sans font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer hover:border-slate-350 focus:outline-hidden"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-[#F58220] shrink-0" />
                          {checkInMunicipio || "Selecione o Município..."}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${checkInMunicipioDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {checkInMunicipioDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[100] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                          {/* Search Term Input */}
                          <div className="p-2 border-b border-slate-150 bg-slate-50 flex items-center gap-2">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              placeholder={
                                loadingCheckInCities
                                  ? "Carregando municípios..."
                                  : "Pesquisar município..."
                              }
                              value={checkInMunicipioSearch}
                              onChange={(e) =>
                                setCheckInMunicipioSearch(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5 font-sans"
                            />
                          </div>

                          {/* Options list */}
                          <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
                            {checkInMunicipioSearch.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckInMunicipio(
                                    checkInMunicipioSearch.trim(),
                                  );
                                  setCheckInMunicipioIbgeId(0);
                                  setCheckInBairro("");
                                  setCheckInDistrictId(null);
                                  setCheckInRua("");
                                  setCheckInMunicipioDropdownOpen(false);
                                  setCheckInMunicipioSearch("");
                                }}
                                className="w-full text-left px-3.5 py-2.5 bg-orange-50/50 hover:bg-orange-50 text-[#F58220] font-bold transition-colors flex items-center justify-between text-xs cursor-pointer font-sans"
                              >
                                <span className="truncate">
                                  Usar Município: "
                                  {checkInMunicipioSearch.trim()}" (Manual)
                                </span>
                                <Plus className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                              </button>
                            )}

                            {filteredCheckInCities.map((city) => (
                              <button
                                key={city.ibgeId}
                                type="button"
                                onClick={() => {
                                  setCheckInMunicipio(city.name);
                                  setCheckInMunicipioIbgeId(city.ibgeId);
                                  setCheckInBairro("");
                                  setCheckInDistrictId(null);
                                  setCheckInRua("");
                                  setCheckInMunicipioDropdownOpen(false);
                                  setCheckInMunicipioSearch("");
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer font-sans"
                              >
                                <span
                                  className={
                                    checkInMunicipioIbgeId === city.ibgeId
                                      ? "font-bold text-[#F58220]"
                                      : "font-medium"
                                  }
                                >
                                  {city.name}
                                </span>
                                {checkInMunicipioIbgeId === city.ibgeId && (
                                  <Check className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                                )}
                              </button>
                            ))}
                            {filteredCheckInCities.length === 0 &&
                              !checkInMunicipioSearch.trim() && (
                                <p className="p-3 text-center text-xs text-slate-400 italic">
                                  Nenhum município encontrado
                                </p>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Grid Responsivo de Bairro e Rua */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bairro Searchable Dropdown */}
                  <div className="space-y-1.5 text-left relative">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                      Bairro *
                    </label>

                    {checkInBairroManual ||
                    checkInDistrictsList.length === 0 ? (
                      <div className="relative font-sans">
                        <input
                          type="text"
                          required
                          placeholder="Digite o nome do bairro..."
                          value={checkInBairro}
                          onChange={(e) => {
                            setCheckInBairro(e.target.value);
                            setCheckInDistrictId(null);
                          }}
                          className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-sm font-sans font-semibold text-slate-800 transition-all focus:outline-hidden"
                        />
                        {checkInDistrictsList.length === 0 && (
                          <span className="absolute right-3.5 top-3 text-[9px] px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-400 font-bold rounded-md select-none">
                            Sem lista (Manual)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="relative font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setCheckInBairroDropdownOpen(
                              !checkInBairroDropdownOpen,
                            );
                            setCheckInRuaDropdownOpen(false);
                            setCheckInMunicipioDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-left text-sm font-sans font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer hover:border-slate-350 focus:outline-hidden"
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-[#F58220] shrink-0" />
                            {checkInBairro || "Selecione o Bairro..."}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${checkInBairroDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {checkInBairroDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[100] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                            {/* Search Term Input */}
                            <div className="p-2 border-b border-slate-150 bg-slate-50 flex items-center gap-2">
                              <Search className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder={
                                  loadingCheckInDistricts
                                    ? "Carregando bairros..."
                                    : "Pesquisar bairro..."
                                }
                                value={checkInBairroSearch}
                                onChange={(e) =>
                                  setCheckInBairroSearch(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5 font-sans"
                              />
                            </div>

                            {/* Options List */}
                            <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
                              {checkInBairroSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCheckInBairro(
                                      checkInBairroSearch.trim(),
                                    );
                                    setCheckInDistrictId(null);
                                    setCheckInRua("");
                                    setCheckInBairroDropdownOpen(false);
                                    setCheckInBairroSearch("");
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 bg-orange-50/50 hover:bg-orange-50 text-[#F58220] font-bold transition-colors flex items-center justify-between text-xs cursor-pointer font-sans"
                                >
                                  <span className="truncate">
                                    Usar Bairro: "{checkInBairroSearch.trim()}"
                                    (Manual)
                                  </span>
                                  <Plus className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                                </button>
                              )}

                              {filteredCheckInDistricts.map((b) => (
                                <button
                                  key={b.name}
                                  type="button"
                                  onClick={() => {
                                    setCheckInBairro(b.name);
                                    setCheckInRua("");
                                    const distObj = checkInDistricts.find(
                                      (d) => d.name === b.name,
                                    );
                                    if (distObj) {
                                      setCheckInDistrictId(distObj.id);
                                    } else {
                                      setCheckInDistrictId(null);
                                    }
                                    setCheckInBairroDropdownOpen(false);
                                    setCheckInBairroSearch("");
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer font-sans"
                                >
                                  <span
                                    className={
                                      checkInBairro === b.name
                                        ? "font-bold text-[#F58220]"
                                        : "font-medium"
                                    }
                                  >
                                    {b.name}
                                  </span>
                                  {checkInBairro === b.name && (
                                    <Check className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                                  )}
                                </button>
                              ))}
                              {filteredCheckInDistricts.length === 0 &&
                                !checkInBairroSearch.trim() && (
                                  <p className="p-3 text-center text-xs text-slate-400 italic">
                                    Nenhum bairro encontrado
                                  </p>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rua Searchable Dropdown */}
                  <div className="space-y-1.5 text-left relative">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                      Logradouro / Rua *
                    </label>

                    {checkInRuaManual ||
                    !checkInBairro ||
                    (checkInBairro &&
                      checkInStreetsList.length === 0 &&
                      !loadingCheckInStreets) ? (
                      <input
                        type="text"
                        required
                        disabled={!checkInBairro}
                        placeholder={
                          checkInBairro
                            ? "Ex: Avenida Principal, 123..."
                            : "Aguardando bairro..."
                        }
                        value={checkInRua}
                        onChange={(e) => setCheckInRua(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-sm focus:outline-hidden text-slate-800 placeholder-slate-350 transition-all font-sans font-medium font-semibold disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    ) : (
                      <div className="relative font-sans">
                        <button
                          type="button"
                          disabled={!checkInBairro}
                          onClick={() => {
                            setCheckInRuaDropdownOpen(!checkInRuaDropdownOpen);
                            setCheckInBairroDropdownOpen(false);
                            setCheckInMunicipioDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-left text-sm font-sans font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 hover:border-slate-350 focus:outline-hidden"
                        >
                          <span className="truncate flex items-center gap-1.5 font-sans justify-start text-left">
                            <MapPin className="w-4 h-4 text-[#F58220] shrink-0" />
                            {checkInRua ||
                              (checkInBairro
                                ? "Selecione a rua..."
                                : "Aguardando bairro...")}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${checkInRuaDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {checkInRuaDropdownOpen && checkInBairro && (
                          <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[100] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                            {/* Search Term Input */}
                            <div className="p-2 border-b border-slate-150 bg-slate-50 flex items-center gap-2">
                              <Search className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder={
                                  loadingCheckInStreets
                                    ? "Carregando ruas..."
                                    : "Pesquisar rua..."
                                }
                                value={checkInRuaSearch}
                                onChange={(e) =>
                                  setCheckInRuaSearch(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5 font-sans"
                              />
                            </div>

                            {/* Options List */}
                            <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
                              {/* Option to enter manually what the user is typing as search */}
                              {checkInRuaSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCheckInRua(checkInRuaSearch.trim());
                                    setCheckInRuaDropdownOpen(false);
                                    setCheckInRuaSearch("");
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 bg-orange-50/50 hover:bg-orange-50 text-[#F58220] font-bold transition-colors flex items-center justify-between text-xs cursor-pointer font-sans"
                                >
                                  <span className="truncate">
                                    Usar Rua: "{checkInRuaSearch.trim()}"
                                    (Manual)
                                  </span>
                                  <Plus className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                                </button>
                              )}

                              {filteredCheckInStreets.map((r) => (
                                <button
                                  key={r.name}
                                  type="button"
                                  onClick={() => {
                                    setCheckInRua(r.name);
                                    setCheckInRuaDropdownOpen(false);
                                    setCheckInRuaSearch("");
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer font-sans"
                                >
                                  <span
                                    className={
                                      checkInRua === r.name
                                        ? "font-bold text-[#F58220]"
                                        : "font-medium"
                                    }
                                  >
                                    {r.name}
                                  </span>
                                  {checkInRua === r.name && (
                                    <Check className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                                  )}
                                </button>
                              ))}
                              {loadingCheckInOsmStreets && (
                                <p className="px-3.5 py-2 text-xs text-slate-400 italic font-sans font-medium">
                                  Buscando mais ruas no mapa...
                                </p>
                              )}
                              {filteredCheckInStreets.length === 0 &&
                                !loadingCheckInOsmStreets &&
                                !checkInRuaSearch.trim() && (
                                  <p className="p-3 text-center text-xs text-slate-400 italic font-sans font-medium">
                                    Nenhuma rua encontrada
                                  </p>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Grau de Prioridade / Impacto (somente no check-in livre) */}
                {isFreeCheckIn && (
                  <div className="space-y-2 text-left animate-in fade-in duration-200">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                      Grau de Prioridade / Impacto *
                    </label>
                    <div className="grid grid-cols-2 gap-2 font-sans">
                      {opcoesDePrioridade.map((option) => {
                        const isSelected = checkInPriority === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCheckInPriority(option.value)}
                            style={
                              isSelected
                                ? {
                                    borderColor: option.color,
                                    boxShadow: `0 0 0 2px ${option.color}22`,
                                  }
                                : undefined
                            }
                            className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer active:scale-98 ${
                              isSelected
                                ? "bg-white shadow-2xs"
                                : "border-slate-200 bg-white hover:border-slate-350"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: option.color }}
                              />
                              <h5 className="font-extrabold text-[12px] text-slate-800 leading-none">
                                {option.label}
                              </h5>
                              {isSelected && (
                                <Check
                                  className="w-3.5 h-3.5 stroke-[3] ml-auto shrink-0"
                                  style={{ color: option.color }}
                                />
                              )}
                            </div>
                            <p className="text-[9.5px] text-slate-500 leading-snug mt-1.5">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fotos e Vídeos */}
                <div className="space-y-2.5 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                      {isFreeCheckIn
                        ? "Fotos e Vídeos da Ocorrência *"
                        : "Evidência Fotográfica (Opcional)"}
                    </label>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-sans shrink-0">
                      {checkInMediaDrafts.length}/{CHECKIN_MAX_MEDIA}
                    </span>
                  </div>

                  {/* Miniaturas do que já foi anexado */}
                  {checkInMediaDrafts.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 font-sans animate-in fade-in duration-200">
                      {checkInMediaDrafts.map((item) => (
                        <div
                          key={item.id}
                          className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-3xs group"
                        >
                          {item.type === "video" ? (
                            <video
                              src={item.previewUrl}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={item.previewUrl}
                              className="w-full h-full object-cover"
                            />
                          )}

                          {item.type === "video" && (
                            <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-900/70 text-white text-[8px] font-extrabold uppercase tracking-wider">
                              <Video className="w-2.5 h-2.5" />
                              Vídeo
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveCheckInMedia(item.id)}
                            title="Remover"
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/65 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                          >
                            <X className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botões de captura */}
                  {checkInMediaDrafts.length < CHECKIN_MAX_MEDIA ? (
                    <div className="font-sans">
                      {/* Um input só: a própria câmera do aparelho decide entre
                          foto e vídeo, e o tipo do arquivo é detectado no envio. */}
                      <input
                        id="checkin-camera-input"
                        type="file"
                        accept="image/*,video/*"
                        capture="environment"
                        multiple
                        onChange={handleCheckInFileChange}
                        className="sr-only"
                      />

                      <label
                        htmlFor="checkin-camera-input"
                        className="flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-300 hover:border-[#F58220] hover:bg-orange-50/5 transition-all rounded-2xl cursor-pointer text-center group min-h-[140px] shadow-3xs"
                      >
                        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-[#F58220] group-hover:scale-105 transition-all mb-3 border border-orange-100 shadow-3xs">
                          <Camera className="w-6 h-6 stroke-[2]" />
                        </div>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-[#F58220] transition-colors leading-tight">
                          {checkInMediaDrafts.length > 0
                            ? "Anexar mais"
                            : "Tirar Foto ou Gravar Vídeo"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-wider">
                          Foto até 5MB • Vídeo até 50MB
                        </span>
                      </label>

                      <p className="text-[9.5px] text-slate-400 font-semibold mt-2 leading-snug text-center">
                        Pode anexar até {CHECKIN_MAX_MEDIA} arquivos entre fotos
                        e vídeos.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 font-bold bg-slate-50 border border-slate-150 rounded-xl p-3 text-center font-sans">
                      Limite de {CHECKIN_MAX_MEDIA} arquivos atingido. Remova um
                      para anexar outro.
                    </p>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingCheckIn}
                    className="w-full py-3.5 bg-[#F58220] hover:bg-[#E06E10] active:bg-[#C05D10] text-white font-extrabold text-xs uppercase tracking-wider rounded-full transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                  >
                    {isSubmittingCheckIn ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
                        Aguardando Geolocalização...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        Confirmar Check-in
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </main>

        {/* Espaçador inferior */}
        <div className="hidden md:block flex-1" />

        {/* Confirmação no meio da tela, com a cara do sistema */}
        <ConfirmDialog request={confirmRequest} onClose={closeConfirmation} />
      </div>
    );
  }

  // O link do QR Code é público e não depende de login nem de check-in.
  // Entrada nua num domínio de acesso: nada do sistema aparece enquanto a
  // pessoa é mandada embora — nem por um instante.
  if (ROTA_INICIAL.semLink) {
    return (
      <div className="min-h-[100dvh] w-full bg-white" aria-hidden="true">
        {saidaSemLink && (
          <noscript>
            <meta httpEquiv="refresh" content={`0; url=${saidaSemLink}`} />
          </noscript>
        )}
      </div>
    );
  }


  if (currentUrlView !== "checkin" && !adminUser) {
    const handleAdminLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adminEmail.trim() || !adminPassword.trim()) {
        triggerNotification("Por favor, informe seu e-mail e senha.", "error");
        return;
      }

      if (!isDatabaseConfigured) {
        triggerNotification(
          "Banco de dados não configurado. Entrando em modo demonstração.",
          "info",
        );
        const demoUser = { email: adminEmail.trim().toLowerCase() };
        setAdminUser(demoUser);
        localStorage.setItem("auth_admin_user", JSON.stringify(demoUser));
        return;
      }

      setIsVerifyingAdminLogin(true);
      const res = await DatabaseService.loginAdmin(adminEmail, adminPassword);
      setIsVerifyingAdminLogin(false);

      if (res.success && res.user) {
        const loggedUser = { email: res.user.email };
        setAdminUser(loggedUser);
        localStorage.setItem("auth_admin_user", JSON.stringify(loggedUser));
        triggerNotification(
          "Painel administrativo acessado com sucesso!",
          "success",
        );
      } else {
        triggerNotification(
          res.error || "Credenciais incorretas ou usuário inexistente.",
          "error",
        );
      }
    };

    const handleDemoAdminBypass = () => {
      const demoUser = { email: "admin@totalmapa.com" };
      setAdminUser(demoUser);
      localStorage.setItem("auth_admin_user", JSON.stringify(demoUser));
      triggerNotification(
        "Sessão administrativa iniciada em modo demonstração!",
        "info",
      );
    };

    return (
      <div className="min-h-screen w-full bg-[#DBE2E9] text-slate-800 flex flex-col justify-center items-center p-4 selection:bg-indigo-600 selection:text-white font-sans">
        {/* Toast Notification HUD */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] max-w-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-indigo-500/20 bg-indigo-650 text-white"
            >
              <Check className="w-5 h-5 flex-shrink-0 text-emerald-300" />
              <span className="text-xs font-semibold">{notification.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logo & Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center mb-6 text-center select-none"
        >
          <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center p-1.5 shadow-lg border border-slate-100 mb-3">
            <img
              src={BRAND_LOGO}
              alt="Logo Inteligência Territorial"
              className="w-full h-full object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="font-extrabold text-black text-[32px] tracking-tight leading-none font-sans text-center">
            Inteligência Territorial
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[460px] w-full bg-white rounded-[3rem] shadow-2xl p-8 md:p-10 border border-slate-100 flex flex-col gap-6 relative overflow-hidden text-left"
        >
          {/* Top Right Decorative Illustration */}
          <div className="absolute right-0 top-4 w-36 h-36 pointer-events-none hidden xs:block">
            {/* Smartphone mockup outline */}
            <div className="absolute right-4 top-4 w-20 h-32 border-[3px] border-[#EBF1F6] rounded-2xl bg-white transform rotate-[15deg] shadow-3xs flex items-center justify-center">
              <div className="w-16 h-28 bg-[#FAFBFD] border border-slate-50 rounded-lg flex flex-col justify-between p-2">
                <div className="w-6 h-1.5 bg-[#EBF1F6] rounded-full mx-auto" />
                <div className="flex-1 flex flex-col justify-center gap-1 opacity-20">
                  <div className="w-full h-2 bg-[#EBF1F6] rounded-xs" />
                  <div className="w-5/6 h-2 bg-[#EBF1F6] rounded-xs" />
                </div>
              </div>
            </div>
            {/* Floating circular bubble with lock icon */}
            <div className="absolute right-14 top-14 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100 transform -rotate-12">
              <div className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center text-black bg-white">
                <Lock className="w-4 h-4 text-black" />
              </div>
            </div>
            {/* Halftone dots decoration */}
            <div className="absolute right-24 top-8 w-10 h-10 opacity-30 flex flex-wrap gap-1 leading-none z-[-1]">
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="inline-block w-1.5 h-1.5 bg-slate-300 rounded-full"
                />
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAdminLoginSubmit}
            className="space-y-4 text-left mt-4"
          >
            <div className="bg-[#F6F8FA] rounded-[1.8rem] p-6 border border-slate-100/50 space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-black ml-1">
                  E-mail
                </label>
                <div className="relative shadow-md md:shadow-lg rounded-2xl bg-white border border-slate-300 flex items-center px-4 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-600 transition-all">
                  <span className="text-[#A5B4C2] mr-3">
                    <Users className="w-5 h-5 text-blue-600/75" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder=""
                    value={adminEmail}
                    onChange={(e) =>
                      setAdminEmail(
                        e.target.value.toLowerCase().replace(/\s/g, ""),
                      )
                    }
                    className="w-full py-4 bg-transparent border-none text-[15px] font-bold text-[#0D233A] placeholder-[#C2D0DC] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-black ml-1">
                  Senha
                </label>
                <div className="relative shadow-md md:shadow-lg rounded-2xl bg-white border border-slate-300 flex items-center px-4 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-600 transition-all">
                  <span className="text-[#A5B4C2] mr-3">
                    <Lock className="w-5 h-5 text-blue-600/75" />
                  </span>
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    required
                    placeholder=""
                    value={adminPassword}
                    onChange={(e) =>
                      setAdminPassword(e.target.value.replace(/\s/g, ""))
                    }
                    className="w-full py-4 bg-transparent border-none text-[15px] font-bold text-[#0D233A] placeholder-[#C2D0DC] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="text-[#98A6B5] hover:text-[#0D233A] transition-colors focus:outline-hidden"
                  >
                    {showAdminPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isVerifyingAdminLogin ||
                !adminEmail.trim() ||
                !adminPassword.trim()
              }
              className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:bg-[#C2D0DC] disabled:cursor-not-allowed text-white font-extrabold text-[#FFF] text-xs uppercase tracking-wider rounded-full transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-4 font-sans"
            >
              {isVerifyingAdminLogin ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {!isDatabaseConfigured && (
            <div className="mt-1 pt-4 border-t border-slate-100/80 space-y-2">
              <p className="text-[10.5px] text-zinc-500 leading-normal bg-[#FAFAD2]/60 p-3 rounded-2xl border border-[#FAFAD2] text-left font-sans">
                ⚠️ <strong>Integração Offline:</strong> as credenciais do
                banco de dados não foram preenchidas. Caso queira testar o
                fluxo de login de forma simulada, use o botão de demonstração:
              </p>
              <button
                type="button"
                onClick={handleDemoAdminBypass}
                className="w-full py-3 bg-[#EBF1F6] hover:bg-[#DDE5EE] text-[#5A6E85] font-bold text-xs rounded-xl transition-all cursor-pointer font-sans"
              >
                Demonstração Bypass (Administrador Demo)
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Render the Candidates Management View (Se logged in as admin e a aba atual for 'candidates')
  if (currentUrlView === "admin" && adminUser && adminTab === "candidates") {
    const q = candSearch.toLowerCase();
    const filteredCandidates = candidates.filter((c) => {
      const nameMatch = c.name?.toLowerCase().includes(q) || false;
      const cityMatch = candidateLocationText(c)?.toLowerCase().includes(q) || false;
      const officeMatch = c.office?.toLowerCase().includes(q) || false;
      return nameMatch || cityMatch || officeMatch;
    });

    const totalCount = candidates.length;
    const activeCount = candidates.filter(
      (c) => c.status_active !== false,
    ).length;
    const pendingCount = 0;
    const uniqueCities = new Set(
      candidates
        .map((c) => candidateLocationText(c).toLowerCase().trim())
        .filter(Boolean),
    ).size;

    // Calcula o partido com mais clientes em tempo de execução
    const partyCounts: Record<string, number> = {};
    candidates.forEach((c) => {
      let pName = "PL";
      const nameUpper = (c.name || "").toUpperCase();
      const officeUpper = (c.office || "").toUpperCase();
      const foundParty = parties.find((p) => {
        const checkInitials = p.initials.toUpperCase();
        return (
          nameUpper.includes(checkInitials) ||
          officeUpper.includes(checkInitials)
        );
      });
      if (foundParty) {
        pName = foundParty.initials;
      } else if (
        nameUpper.includes("JOÃO NETO") ||
        officeUpper.includes("SD")
      ) {
        pName = "SD";
      } else if (nameUpper.includes("LUCAS") || officeUpper.includes("PP")) {
        pName = "PP";
      } else {
        const defaultPartidos = ["PL", "MDB", "PSD", "UNIÃO"];
        const charCodeSum = c.name
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        pName = defaultPartidos[charCodeSum % defaultPartidos.length];
      }

      partyCounts[pName] = (partyCounts[pName] || 0) + 1;
    });

    let topParty = "-";
    let topCount = 0;
    Object.entries(partyCounts).forEach(([name, count]) => {
      if (count > topCount) {
        topCount = count;
        topParty = name;
      }
    });

    // Busca de clientes: nome, cargo, localização ou sigla do partido.
    const pq = partySearch.trim().toLowerCase();
    const filteredClients = candidates.filter((c) => {
      if (!pq) return true;
      return (
        (c.name || "").toLowerCase().includes(pq) ||
        (c.office || "").toLowerCase().includes(pq) ||
        candidateLocationText(c).toLowerCase().includes(pq) ||
        (c.partyInitials || "").toLowerCase().includes(pq) ||
        (c.partyName || "").toLowerCase().includes(pq)
      );
    });


    const handleOpenCreateModal = () => {
      setCandidateEditing(null);
      setCandName("");
      setCandPhone("");
      setCandInstagram("");
      setCandCity("");
      setCandOffice("");
      setCandImage("");
      setIsCandidateModalOpen(true);
    };

    const handleOpenEditModal = (cand: Candidate) => {
      setCandidateEditing(cand);
      setCandName(cand.name);
      setCandPhone(cand.phone);
      setCandInstagram(cand.instagram_handle);
      setCandCity(cand.estado || cand.city || "");
      setCandOffice(cand.office);
      setCandImage(cand.image || "");
      setIsCandidateModalOpen(true);
    };

    const handleSaveCandidateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!candName.trim()) {
        triggerNotification("O nome do cliente é obrigatório.", "error");
        return;
      }

      const finalOffice = candOffice.trim();

      const payload = {
        name: candName.trim(),
        phone: candPhone.trim(),
        instagram_handle: candInstagram.trim().replace(/^@/, ""),
        city: candCity.trim(),
        estado: candCity.trim(),
        office: finalOffice,
        image:
          candImage.trim() ||
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        status_active: candidateEditing ? candidateEditing.status_active : true,
        // Editar um cliente vinculado não o transforma num cadastro manual:
        // a origem e o id externo continuam sendo os que ele já tinha.
        source: candidateEditing?.source || ("manual" as const),
        externalId: candidateEditing?.externalId,
        email: candidateEditing?.email,
        campanha: candidateEditing?.campanha,
        numeroCampanha: candidateEditing?.numeroCampanha,
        linkGrupoWhatsapp: candidateEditing?.linkGrupoWhatsapp,
        favorito: candidateEditing?.favorito,
        partyId: candidateEditing?.partyId,
        partyName: candidateEditing?.partyName,
        partyInitials: candidateEditing?.partyInitials,
        partyLogoUrl: candidateEditing?.partyLogoUrl,
        partyColor: candidateEditing?.partyColor,
        syncTeam: candidateEditing?.syncTeam === true,
        externalCreatedAt: candidateEditing?.externalCreatedAt,
        raw: candidateEditing?.raw,
      };

      if (isDatabaseConfigured) {
        triggerNotification("Salvando cliente...", "info");
        const res = await DatabaseService.upsertCandidate({
          id: candidateEditing?.id,
          ...payload,
        });
        if (res.success) {
          triggerNotification("Cliente salvo com sucesso!", "success");
          const reload = await DatabaseService.fetchCandidates();
          if (reload.success && reload.data) {
            setCandidates(reload.data);
          } else {
            const updatedId =
              res.data?.id || candidateEditing?.id || "id-" + Date.now();
            setCandidates((prev) => {
              const existing = prev.find((c) => c.id === candidateEditing?.id);
              if (existing) {
                return prev.map((c) =>
                  c.id === candidateEditing?.id
                    ? { ...c, ...payload, id: updatedId }
                    : c,
                );
              } else {
                return [...prev, { ...payload, id: updatedId }];
              }
            });
          }
          setIsCandidateModalOpen(false);
        } else {
          triggerNotification(
            `Erro no banco: ${res.error || "Falha ao salvar"}`,
            "error",
          );
        }
      } else {
        const updatedId =
          candidateEditing?.id ||
          "temp-" + Math.random().toString(36).substring(2, 9);
        setCandidates((prev) => {
          const existing = prev.find((c) => c.id === candidateEditing?.id);
          if (existing) {
            return prev.map((c) =>
              c.id === candidateEditing?.id
                ? { ...c, ...payload, id: updatedId }
                : c,
            );
          } else {
            return [...prev, { ...payload, id: updatedId }];
          }
        });
        triggerNotification("Cliente salvo localmente!", "success");
        setIsCandidateModalOpen(false);
      }
    };

    const handleDeleteCandidate = (id: string, name: string) => {
      askConfirmation({
        title: "Remover cliente",
        message: `${name} sai do painel junto com o mapa isolado dele.`,
        confirmLabel: "Remover cliente",
        onConfirm: async () => {
          if (isDatabaseConfigured) {
            triggerNotification("Excluindo cliente...", "info");
            const res = await DatabaseService.deleteCandidate(id);
            if (res.success) {
              setCandidates((prev) => prev.filter((c) => c.id !== id));
              triggerNotification("Cliente removido com sucesso!", "success");
            } else {
              triggerNotification(`Erro no banco: ${res.error}`, "error");
            }
          } else {
            setCandidates((prev) => prev.filter((c) => c.id !== id));
            triggerNotification("Cliente removido localmente!", "info");
          }
        },
      });
    };

    const handleToggleStatus = async (cand: Candidate) => {
      const newStatus = cand.status_active === false ? true : false;
      const updated = { ...cand, status_active: newStatus };

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === cand.id ? { ...c, status_active: newStatus } : c,
        ),
      );

      if (isDatabaseConfigured) {
        // A ficha inteira vai junto: o upsert grava o registro completo, e
        // mandar só alguns campos apagaria o resto do cadastro.
        await DatabaseService.upsertClient({ ...cand, status_active: newStatus });
      }
      triggerNotification(`Status de ${cand.name} atualizado.`, "success");
    };

    return (
      <div className="min-h-screen w-screen bg-[#EBF1F6] text-slate-800 flex flex-col p-6 sm:p-10 font-sans selection:bg-blue-600 selection:text-white overflow-y-auto">
        {/* Ponteiro laser: acompanha o painel inteiro, sem tapar nada */}
        <LaserPointer ativo={laserLigado} />

        {/* Confirmação no meio da tela, com a cara do sistema */}
        <ConfirmDialog
          request={confirmRequest}
          onClose={closeConfirmation}
        />

        {/* Ficha de aparelhos de um integrante: esta tela tem a sua própria
            árvore, então os modais dela moram aqui. */}
        <DispositivosMembroModal
          membro={membroDosAparelhos}
          onClose={() => setMembroDosAparelhos(null)}
          notify={triggerNotification}
          askConfirmation={askConfirmation}
        />

          {/* CHECK-IN COMPLETO — tudo que o integrante enviou, em tela cheia */}
        {checkInCompleto && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[3000]"
            onClick={() => setCheckInCompleto(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-[#0D233A] leading-tight">
                    Check-in #{checkInCompleto.numero}
                  </h3>
                  <p className="text-[12px] font-semibold text-slate-400">
                    {checkInCompleto.registro.name} •{" "}
                    {new Date(
                      checkInCompleto.registro.createdAt,
                    ).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => setCheckInCompleto(null)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    rotulo: "Local",
                    valor:
                      [
                        checkInCompleto.registro.rua,
                        checkInCompleto.registro.bairro,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Sem endereço",
                  },
                  {
                    rotulo: "Município",
                    valor:
                      [
                        checkInCompleto.registro.municipio,
                        checkInCompleto.registro.estado,
                      ]
                        .filter(Boolean)
                        .join(" - ") || "Não informado",
                  },
                  {
                    rotulo: "Arquivos",
                    valor: `${checkInCompleto.midias.length}`,
                  },
                  {
                    rotulo: "Status",
                    valor: checkInCompleto.registro.concluido
                      ? "Concluído"
                      : "Em andamento",
                  },
                ].map((campo) => (
                  <div
                    key={campo.rotulo}
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2.5"
                  >
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                      {campo.rotulo}
                    </p>
                    <p className="text-[12.5px] font-bold text-slate-700 truncate">
                      {campo.valor}
                    </p>
                  </div>
                ))}
              </div>

              {checkInCompleto.registro.coordinates?.lat && (
                <div className="rounded-2xl overflow-hidden border border-slate-100">
                  <MiniMapa
                    lat={checkInCompleto.registro.coordinates.lat}
                    lng={checkInCompleto.registro.coordinates.lng}
                    height={200}
                  />
                </div>
              )}

              {checkInCompleto.operacoes.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-slate-500 mb-1.5">
                    Operações
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {checkInCompleto.operacoes.map((rotulo: string, i: number) => (
                      <span
                        key={`${rotulo}-${i}`}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black"
                      >
                        {rotulo}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {checkInCompleto.midias.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-slate-500 mb-1.5">
                    Evidências ({checkInCompleto.midias.length})
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {checkInCompleto.midias.map((midia: any) => (
                      <a
                        key={midia.id || midia.url}
                        href={midia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 block"
                      >
                        {midia.kind === "video" ? (
                          <>
                            <video
                              src={midia.url}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white">
                              <Video className="w-5 h-5" />
                            </span>
                          </>
                        ) : (
                          <img
                            src={midia.url}
                            alt="Evidência"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {checkInCompleto.notas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-black text-slate-500">
                    Observações
                  </p>
                  {checkInCompleto.notas.map((nota: any) =>
                    nota.kind === "audio" ? (
                      <audio
                        key={nota.id}
                        src={nota.url}
                        controls
                        className="w-full h-9"
                      />
                    ) : (
                      <p
                        key={nota.id}
                        className="text-[12.5px] font-semibold text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5"
                      >
                        {nota.content}
                      </p>
                    ),
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedCandidateFilter(inspectedCandidate!.id);
                  setSelectedId(checkInCompleto.registro.id);
                  setCheckInCompleto(null);
                  setAdminTab("map");
                }}
                className="h-11 w-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Map className="w-4 h-4 text-[#015FC9]" />
                Abrir no mapa
              </button>
            </div>
          </div>
        )}

        {/* FORMULÁRIO DE TIPO DE OPERAÇÃO — usado por "Novo tipo" e "Editar" */}
        {modalTipoAberto && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[3000]"
            onClick={() => {
              setModalTipoAberto(false);
              resetOperationTypeForm();
            }}
          >
            <form
              onSubmit={(e) => {
                saveOperationType(e);
                if (opTypeLabel.trim()) setModalTipoAberto(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: opTypeColor }}
                  >
                    <OperationIcon icon={opTypeIcon} size={22} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-[#0D233A] leading-tight">
                      {editingOperationTypeId ? "Editar tipo" : "Novo tipo"}
                    </h3>
                    <p className="text-[11.5px] font-semibold text-slate-400 truncate">
                      {inspectedCandidate?.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalTipoAberto(false);
                    resetOperationTypeForm();
                  }}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5">
                  Nome do tipo
                </label>
                <input
                  type="text"
                  autoFocus
                  value={opTypeLabel}
                  onChange={(e) => setOpTypeLabel(e.target.value)}
                  placeholder="Ex: Tapa-buraco"
                  className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5">
                  Descrição
                </label>
                <input
                  type="text"
                  value={opTypeDescription}
                  onChange={(e) => setOpTypeDescription(e.target.value)}
                  placeholder="Ex: Reparo de vias e pavimentação"
                  className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5">
                  Ícone
                </label>
                <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {OPERATION_ICONS.map((icone) => (
                    <button
                      key={icone.key}
                      type="button"
                      title={icone.label}
                      onClick={() => setOpTypeIcon(icone.key)}
                      className={`h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all border ${
                        opTypeIcon === icone.key
                          ? "border-[#015FC9] bg-[#EFF4FB] text-[#015FC9]"
                          : "border-slate-200 text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <OperationIcon icon={icone.key} size={18} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5">
                    Cor
                  </label>
                  <div className="flex items-center gap-2 h-11 px-2 bg-slate-50 border border-slate-200 rounded-2xl">
                    <input
                      type="color"
                      value={opTypeColor}
                      onChange={(e) => setOpTypeColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent shrink-0"
                    />
                    <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">
                      {opTypeColor}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpTypeActive((v) => !v)}
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-2xl flex items-center gap-2 text-[12px] font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
                  >
                    <span
                      className={`w-8 h-4.5 rounded-full flex items-center px-0.5 transition-all ${
                        opTypeActive
                          ? "bg-emerald-500 justify-end"
                          : "bg-slate-300 justify-start"
                      }`}
                    >
                      <span className="w-3.5 h-3.5 bg-white rounded-full block" />
                    </span>
                    {opTypeActive ? "Ativo" : "Inativo"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setModalTipoAberto(false);
                    resetOperationTypeForm();
                  }}
                  className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-2xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-[#015FC9] hover:bg-blue-600 text-white text-xs font-bold rounded-2xl cursor-pointer active:scale-95"
                >
                  {editingOperationTypeId ? "Salvar alterações" : "Criar tipo"}
                </button>
              </div>
            </form>
          </div>
        )}

      {/* PERFIL DO INTEGRANTE — o que a lista da equipe mostra em "Ver perfil" */}
        {membroDoPerfil && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[3000]"
            onClick={() => setMembroDoPerfil(null)}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-base font-black text-[#015FC9] uppercase">
                    {membroDoPerfil.image ? (
                      <img
                        src={membroDoPerfil.image}
                        alt={membroDoPerfil.full_name || "Integrante"}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (membroDoPerfil.full_name || "DT").substring(0, 2)
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-[#0D233A] leading-tight truncate">
                      {membroDoPerfil.full_name}
                    </h3>
                    <p className="text-[12px] font-semibold text-slate-400">
                      {membroDoPerfil.emCampo ? "Em campo hoje" : "Ativo"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMembroDoPerfil(null)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    rotulo: "Telefone",
                    valor:
                    membroDoPerfil.telefone ||
                    membroDoPerfil.whatsapp ||
                    "Sem telefone",
                  },
                  {
                    rotulo: "Origem",
                    valor:
                      membroDoPerfil.source === "qrcode"
                        ? "QR Code"
                        : membroDoPerfil.source === "vinculado"
                          ? "Vinculado"
                          : "Cadastro manual",
                  },
                  {
                    rotulo: "Check-ins",
                    valor: `${membroDoPerfil.total ?? 0}`,
                  },
                  {
                    rotulo: "Membro desde",
                    valor: (membroDoPerfil.created_at || membroDoPerfil.createdAt)
                      ? new Date(
                          membroDoPerfil.created_at || membroDoPerfil.createdAt,
                        ).toLocaleDateString("pt-BR")
                      : "Não registrado",
                  },
                ].map((campo) => (
                  <div
                    key={campo.rotulo}
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2.5"
                  >
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                      {campo.rotulo}
                    </p>
                    <p className="text-[13px] font-bold text-slate-700 truncate">
                      {campo.valor}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={`https://wa.me/55${(membroDoPerfil.whatsapp || "").replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  Chamar no WhatsApp
                </a>
                <button
                  onClick={() => {
                    setMembroDosAparelhos(membroDoPerfil);
                    setMembroDoPerfil(null);
                  }}
                  className="h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-[#015FC9]" />
                  Aparelhos de acesso
                </button>
                <button
                  onClick={() => {
                    const alvo = membroDoPerfil;
                    setMembroDoPerfil(null);
                    askConfirmation({
                      title: "Remover da Equipe",
                      message: `${alvo.full_name} deixa de receber as missões deste cliente.`,
                      confirmLabel: "Remover",
                      onConfirm: async () => {
                        setSupporters((prev) =>
                          prev.filter((s) => s.id !== alvo.id),
                        );
                        if (isDatabaseConfigured) {
                          const res = await DatabaseService.deleteSupporter(
                            alvo.id,
                          );
                          if (res.success)
                            triggerNotification("Integrante removido!", "success");
                        } else {
                          triggerNotification(
                            "Integrante removido localmente!",
                            "info",
                          );
                        }
                      },
                    });
                  }}
                  className="h-11 px-4 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover da equipe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification HUD */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border"
              style={{
                backgroundColor:
                  notification.type === "success"
                    ? "#10b981"
                    : notification.type === "error"
                      ? "#ef4444"
                      : "#1e293b",
                color: "#ffffff",
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              {notification.type === "success" && (
                <Check className="w-5 h-5 flex-shrink-0" />
              )}
              {notification.type === "error" && (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              {notification.type === "info" && (
                <Sparkles className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium leading-tight">
                {notification.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOP SYSTEM NAV / FLOAT BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            {/* Caminho: onde a pessoa está dentro do sistema */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8492A6] mb-1.5 select-none">
              <Home className="w-3.5 h-3.5" />
              <button
                type="button"
                onClick={() => {
                  setTelaAdm("clientes");
                  setInspectedCandidate(null);
                }}
                className="hover:text-slate-600 cursor-pointer"
              >
                Início
              </button>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-slate-500">
                {telaAdm === "configuracoes"
                  ? "Configurações"
                  : inspectedCandidate
                    ? inspectedCandidate.name
                    : "Clientes"}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-[#0D233A] tracking-tight flex items-center gap-2">
              {telaAdm === "configuracoes" ? (
                <div className="flex items-center gap-2">
                  <span
                    className="text-slate-400 font-medium hover:text-slate-600 cursor-pointer text-2xl"
                    onClick={() => setTelaAdm("clientes")}
                  >
                    Clientes
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                  <span className="text-2xl font-black">Configurações</span>
                </div>
              ) : inspectedCandidate ? (
                <div className="flex items-center gap-2">
                  <span
                    className="text-slate-400 font-medium hover:text-slate-600 cursor-pointer text-2xl"
                    onClick={() => setInspectedCandidate(null)}
                  >
                    Clientes
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                  <span className="text-emerald-600 text-2xl font-black truncate max-w-[420px]">
                    {inspectedCandidate.name}
                  </span>
                </div>
              ) : (
                "Clientes"
              )}
            </h1>
            <p className="text-[#8492A6] text-xs font-semibold mt-1">
              {telaAdm === "configuracoes"
                ? "Ajustes que valem para todo o sistema"
                : inspectedCandidate
                  ? `Equipe, áreas e registros de campo de ${inspectedCandidate.name}`
                  : "Clientes cadastrados no sistema"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* SEARCH BOX — não tem o que buscar nas configurações */}
            <div
              className={`relative bg-white border border-slate-200 rounded-2xl items-center px-4 w-60 h-11 shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 ${
                telaAdm === "configuracoes" ? "hidden" : "flex"
              }`}
            >
              <Search className="w-4 h-4 text-slate-400 mr-2.5" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="bg-transparent border-none w-full text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
              />
              {partySearch ? (
                <X
                  className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer ml-1"
                  onClick={() => setPartySearch("")}
                />
              ) : (
                <span className="text-[9px] font-black text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-1 leading-none shrink-0 select-none">
                  Ctrl + K
                </span>
              )}
            </div>

            {/* AÇÕES DO ADMINISTRADOR */}
            {telaAdm === "configuracoes" ? (
              <button
                onClick={() => setTelaAdm("clientes")}
                className="px-5 h-11 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
              >
                <ChevronLeft className="w-4 h-4 text-rose-500" />
                <span>Voltar</span>
              </button>
            ) : inspectedCandidate ? (
              <button
                onClick={() => setInspectedCandidate(null)}
                className="px-5 h-11 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 animate-fade-in"
              >
                <ChevronLeft className="w-4 h-4 text-rose-500" />
                <span>Voltar</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setEscolhaNovoCliente(true)}
                  className="px-5 h-11 bg-[#015FC9] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-lg border border-blue-700/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Novo Cliente</span>
                </button>
              </>
            )}

            {/* PONTEIRO LASER — para apresentar o painel numa tela grande */}
            <button
              onClick={() => setLaserLigado((ligado) => !ligado)}
              aria-pressed={laserLigado}
              title={
                laserLigado
                  ? "Laser Pointer ligado (L ou Esc para desligar)"
                  : "Laser Pointer (atalho: L)"
              }
              className={`group relative p-3 rounded-2xl shadow-sm border transition-all cursor-pointer ${
                laserLigado
                  ? "bg-rose-600 border-rose-700 text-white ring-2 ring-rose-400/40"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-400 hover:text-rose-500"
              }`}
            >
              <Crosshair className="w-4 h-4" />
              {laserLigado && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-400 border-2 border-white animate-pulse" />
              )}
              <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full right-0 mt-2 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest rounded-lg whitespace-nowrap shadow-xl transition-all pointer-events-none z-[1100]">
                Laser Pointer
              </span>
            </button>

            {/* CONFIGURAÇÕES DO SISTEMA */}
            {!inspectedCandidate && telaAdm !== "configuracoes" && (
              <button
                onClick={() => setTelaAdm("configuracoes")}
                className="p-3 bg-white hover:bg-slate-50 text-slate-400 hover:text-[#015FC9] border border-slate-200 rounded-2xl shadow-sm transition-all cursor-pointer"
                title="Configurações do sistema"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* LOG OUT BADGE */}
            {!inspectedCandidate && telaAdm !== "configuracoes" && (
              <button
                onClick={() => {
                  askConfirmation({
                    title: "Encerrar sessão",
                    message:
                      "Você sai do painel administrativo e volta para a tela de login.",
                    confirmLabel: "Encerrar sessão",
                    tone: "default",
                    onConfirm: () => {
                      setAdminUser(null);
                      localStorage.removeItem("auth_admin_user");
                      triggerNotification(
                        "Sessão encerrada com sucesso.",
                        "info",
                      );
                    },
                  });
                }}
                className="h-11 pl-1.5 pr-5 bg-white hover:bg-rose-50 border border-slate-200 rounded-full shadow-sm flex items-center gap-2.5 transition-all cursor-pointer active:scale-95 group"
                title="Sair do painel"
              >
                <span className="w-8 h-8 rounded-full bg-white border border-slate-200 group-hover:border-rose-200 flex items-center justify-center text-rose-500 shrink-0">
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </span>
                <span className="text-rose-500 font-black text-xs uppercase tracking-wider">
                  Sair
                </span>
              </button>
            )}
          </div>
        </div>

        {/* CONFIGURAÇÕES DO SISTEMA */}
        {telaAdm === "configuracoes" && (
          <ConfiguracoesAdmin
            padraoRedirecionamento={REDIRECIONAMENTO_PADRAO}
            dominiosDeAcesso={DOMINIOS_DE_ACESSO}
            notify={triggerNotification}
            onTurnosMudarem={setTurnosDaCampanha}
          />
        )}

        {/* QUADROS DE NÚMEROS DO SISTEMA — só na lista, a ficha tem os seus */}
        {telaAdm !== "clientes" || inspectedCandidate ? null : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              {
                rotulo: "Total de Clientes",
                valor: candidates.length,
                cor: "#10B981",
                fundo: "bg-emerald-50",
                texto: "text-emerald-600",
                icone: <Users className="w-5 h-5" />,
              },
              {
                rotulo: "Clientes Ativos",
                valor: candidates.filter((c) => c.status_active !== false).length,
                cor: "#3B82F6",
                fundo: "bg-blue-50",
                texto: "text-blue-600",
                icone: <Check className="w-5 h-5 stroke-[3]" />,
              },
              {
                rotulo: "Estados",
                // Cliente sem UF preenchida não pode zerar o quadro: quando
                // falta o estado, a cidade entra como o lugar atendido.
                valor: new Set(
                  candidates
                    .map((c) =>
                      ((c.estado || "").trim() || (c.city || "").trim()).toUpperCase(),
                    )
                    .filter(Boolean),
                ).size,
                cor: "#A855F7",
                fundo: "bg-purple-50",
                texto: "text-purple-600",
                icone: <MapPin className="w-5 h-5" />,
              },
            ].map((cartao) => (
              <div
                key={cartao.rotulo}
                className="relative bg-white border border-[#E1E8ED] rounded-3xl p-5 shadow-xs overflow-hidden"
              >
                {/* Faixa da cor do cartão, como no desenho */}
                <span
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: cartao.cor }}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 ${cartao.fundo} ${cartao.texto} rounded-2xl flex items-center justify-center shrink-0`}
                    >
                      {cartao.icone}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                        {cartao.rotulo}
                      </p>
                      <p className="text-2xl font-black text-slate-800 mt-0.5 leading-none">
                        {cartao.valor}
                      </p>
                    </div>
                  </div>

                  {/* Linha de tendência: enfeite, e por isso escondida do
                      leitor de tela — ela não diz nada que o número já não diga. */}
                  <svg
                    viewBox="0 0 90 32"
                    className="w-[90px] h-8 shrink-0 hidden sm:block"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 26 L18 18 L32 22 L48 10 L62 14 L76 5 L88 8"
                      stroke={cartao.cor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between gap-2 mt-3">
                  <span
                    className="text-[10px] font-bold flex items-center gap-1"
                    style={{ color: cartao.cor }}
                  >
                    <ArrowRight className="w-3 h-3 -rotate-45" />
                    Atualizado agora
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DETAILS TABLE RENDER CONTAINER */}
        {telaAdm !== "clientes" ? null : adminSubTab === "candidates" ? (
          /* CANDIDATES MASTER DATA TABLE */
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#FAFBFD] border-b border-slate-100">
                    <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
                      Cliente
                    </th>
                    <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
                      Partido
                    </th>
                    <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
                      Estado
                    </th>
                    <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
                      Contatos
                    </th>
                    <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6] text-center">
                      Status
                    </th>
                    <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6] text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-widest"
                      >
                        Nenhum cliente encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const party = getPartidoBadge(cand);
                      return (
                        <tr
                          key={cand.id}
                          className="hover:bg-slate-50/50 transition-all"
                        >
                          {/* NAME & AVATAR */}
                          <td className="py-4 px-6 flex items-center gap-3.5 min-w-[240px]">
                            <img
                              src={
                                cand.image ||
                                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                              }
                              alt={cand.name}
                              className="w-11 h-11 rounded-full object-cover border border-slate-200 bg-slate-50"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-[#0D233A] truncate text-[14px]">
                                {cand.name}
                              </span>
                              <span className="text-[9.5px] font-black uppercase text-[#8492A6] tracking-widest mt-0.5 truncate">
                                {cand.office || "Sem Cargo"}
                              </span>
                            </div>
                          </td>

                          {/* PARTIDO BADGE */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              {party.logo ? (
                                <img
                                  src={party.logo}
                                  alt={party.name}
                                  className="w-5.5 h-5.5 rounded-full object-contain bg-slate-50 border border-slate-200"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="w-5.5 h-5.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black flex items-center justify-center text-slate-500">
                                  {party.name.substring(0, 2)}
                                </span>
                              )}
                              <span
                                className={`inline-flex px-2.5 py-0.5 text-[11px] font-black tracking-wider uppercase rounded-full border ${party.color}`}
                              >
                                {party.name}
                              </span>
                            </div>
                          </td>

                          {/* CITY MAP PIN */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 text-slate-600 font-bold text-[13px]">
                              <MapPin className="w-3.5 h-3.5 text-[#8492A6]" />
                              <span>{cand.city}</span>
                            </div>
                          </td>

                          {/* CONTACT DIRECT ICONS */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              {/* Instagram icon */}
                              {cand.instagram_handle ? (
                                <a
                                  href={`https://instagram.com/${cand.instagram_handle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all shadow-xs"
                                  title={`Instagram: @${cand.instagram_handle}`}
                                >
                                  <Instagram className="w-4 h-4" />
                                </a>
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 text-slate-300 flex items-center justify-center"
                                  title="Sem Instagram"
                                >
                                  <Instagram className="w-4 h-4 opacity-50" />
                                </div>
                              )}

                              {/* Email / Mail mock */}
                              <a
                                href={`mailto:${cand.name.toLowerCase().replace(/\s/g, "")}@campanha.com`}
                                className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all shadow-xs"
                                title="Enviar E-mail"
                              >
                                <Mail className="w-4 h-4" />
                              </a>

                              {/* Phone Call link */}
                              {cand.phone ? (
                                <a
                                  href={`https://wa.me/55${cand.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-all shadow-xs"
                                  title={`WhatsApp: ${cand.phone}`}
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 text-slate-300 flex items-center justify-center"
                                  title="Sem WhatsApp"
                                >
                                  <Phone className="w-4 h-4 opacity-50" />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* TOGGLE STATUS SWITCH */}
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => handleToggleStatus(cand)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-all outline-hidden cursor-pointer ${
                                  cand.status_active !== false
                                    ? "bg-emerald-500"
                                    : "bg-slate-200"
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-all ${
                                    cand.status_active !== false
                                      ? "translate-x-5"
                                      : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </td>

                          {/* CRUD CONTEXT ACTIONS */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* COPIAR LINK DE CHECK-IN EXCLUSIVO */}
                              <button
                                onClick={() => {
                                  const shareUrl = linkDaEquipe(cand.id);
                                  navigator.clipboard
                                    .writeText(shareUrl)
                                    .then(() => {
                                      triggerNotification(
                                        `Link de check-in de ${cand.name} copiado!`,
                                        "success",
                                      );
                                    })
                                    .catch(() => {
                                      triggerNotification(
                                        "Erro ao copiar o link.",
                                        "error",
                                      );
                                    });
                                }}
                                className="p-1.5 h-8 w-8 hover:bg-emerald-50 text-slate-450 hover:text-emerald-600 border border-transparent hover:border-emerald-100 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                title="Copiar Link de Check-in deste Cliente"
                              >
                                <Link className="w-4 h-4" />
                              </button>

                              {/* VER NO MAPA */}
                              <button
                                onClick={() => {
                                  setSelectedCandidateFilter(cand.id);
                                  setAdminTab("map");
                                  triggerNotification(
                                    `Exibindo o mapa exclusivo de: ${cand.name}`,
                                    "success",
                                  );
                                }}
                                className="p-1.5 h-8 w-8 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 border border-transparent hover:border-indigo-100 rounded-lg transition-all cursor-pointer flex items-center justify-center font-bold"
                                title="Ver Mapa Isolado deste Cliente"
                              >
                                <Map className="w-4 h-4" />
                              </button>

                              {/* INSPECCIONAR MULTIPLICADORES / TIME DELTA */}
                              <button
                                onClick={() => {
                                  setInspectedCandidate(cand);
                                  triggerNotification(
                                    `Inspecionando a Equipe de: ${cand.name}`,
                                    "info",
                                  );
                                }}
                                className="p-1.5 h-8 w-8 hover:bg-[#E0F2FE] text-slate-400 hover:text-sky-600 border border-transparent hover:border-[#BAE6FD] rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                title="Inspecionar Equipe"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* EDIT */}
                              <button
                                onClick={() => handleOpenEditModal(cand)}
                                className="p-1.5 h-8 w-8 hover:bg-slate-100 text-slate-400 hover:text-[#015FC9] border border-transparent hover:border-slate-200 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* DELETE */}
                              <button
                                onClick={() =>
                                  handleDeleteCandidate(cand.id, cand.name)
                                }
                                className="p-1.5 h-8 w-8 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-slate-200 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* TABLE FOOTER & MOCK PAGINATION BAR */}
            <div className="py-5 px-6 border-t border-slate-100 bg-[#FAFBFD] flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-[#8492A6] text-xs font-bold">
                Mostrando {filteredCandidates.length} de {totalCount} clientes
              </span>

              {/* Pagination Controls */}
              <div className="flex items-center gap-1.5 font-sans">
                <button
                  onClick={() => setCandPage((p) => Math.max(1, p - 1))}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 flex items-center justify-center cursor-pointer disabled:opacity-50 text-sm font-bold shadow-xs"
                  disabled
                >
                  &lt;
                </button>
                <button className="w-8 h-8 rounded-lg bg-[#015FC9] text-white flex items-center justify-center text-xs font-black shadow-md border border-[#015FC9]/10">
                  1
                </button>
                <button className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-xs font-bold cursor-pointer transition-all shadow-xs">
                  2
                </button>
                <button className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-xs font-bold cursor-pointer transition-all shadow-xs">
                  3
                </button>
                <button
                  onClick={() => setCandPage((p) => p + 1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 flex items-center justify-center cursor-pointer text-sm font-bold shadow-xs"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        ) : inspectedCandidate ? (
          /* FICHA DO CLIENTE */
          (() => {
            const equipeDoCliente = supporters.filter(
              (s: any) =>
                s.candidate_id === inspectedCandidate.id ||
                s.candidateId === inspectedCandidate.id,
            );
            const checkInsDoCliente = checkIns.filter(
              (c: any) =>
                (c.candidateId === inspectedCandidate.id ||
                  c.candidate_id === inspectedCandidate.id) &&
                // A lixeira tem a lista dela; aqui só entra o que está em uso.
                !c.trashed,
            );
            const checkInsNaLixeira = checkIns.filter(
              (c: any) =>
                (c.candidateId === inspectedCandidate.id ||
                  c.candidate_id === inspectedCandidate.id) &&
                c.trashed,
            );
            const hoje = new Date().toDateString();
            const checkInsDeHoje = checkInsDoCliente.filter(
              (c: any) => new Date(c.createdAt).toDateString() === hoje,
            );
            // "Em campo" são os integrantes que registraram algo hoje: é o
            // sinal mais honesto de atividade que o sistema tem hoje.
            const emCampo = new Set(
              checkInsDeHoje.map((c: any) => c.memberId || c.name).filter(Boolean),
            );
            const centro =
              checkInsDoCliente[0]?.coordinates ||
              (candidateLocation?.lat
                ? { lat: candidateLocation.lat, lng: candidateLocation.lng }
                : null);

            // Os check-ins do cliente viram pinos no cartão do mapa, com a
            // mesma cor e o mesmo desenho que têm no mapa grande: livre sai na
            // cor da prioridade, o de missão sai no verde de sempre.
            const pontosDoMapa = checkInsDoCliente
              .filter((c: any) => c.coordinates?.lat && c.coordinates?.lng)
              .map((c: any) => {
                const livre = c.mode === "livre";
                const nivel = livre ? resolverPrioridade(c.priority) : null;
                const quando = c.createdAt
                  ? new Date(c.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                return {
                  lat: c.coordinates.lat,
                  lng: c.coordinates.lng,
                  cor: livre ? nivel?.color || "#f97316" : "#10b981",
                  forma: (livre ? "alerta" : "pessoa") as "alerta" | "pessoa",
                  titulo: [c.name, c.operationTypeLabel, quando]
                    .filter(Boolean)
                    .join(" • "),
                };
              });

            // Ranking de check-ins: quem mais registrou vem primeiro. Toda a
            // equipe do cliente entra na lista, mesmo quem ainda não registrou
            // nada — zerado também é informação. A conta usa o id do integrante
            // e cai no nome quando o registro é antigo e não guardou o id.
            const porIntegrante: {
              chave: string;
              nome: string;
              foto?: string;
              total: number;
            }[] = equipeDoCliente.map((m: any) => ({
              chave: m.id,
              nome: m.full_name || "Sem nome",
              foto: m.image,
              total: 0,
            }));
            checkInsDoCliente.forEach((c: any) => {
              const chave = c.memberId || c.name;
              if (!chave) return;
              const atual = porIntegrante.find(
                (i) => i.chave === chave || i.nome === c.name,
              );
              if (atual) {
                atual.total += 1;
                return;
              }
              // Registro de quem já saiu da equipe continua contando.
              porIntegrante.push({
                chave,
                nome: c.name || "Sem nome",
                foto: c.memberPhoto,
                total: 1,
              });
            });
            const ranking = [...porIntegrante].sort(
              (a, b) => b.total - a.total || a.nome.localeCompare(b.nome),
            );
            const maiorDoRanking = ranking[0]?.total || 1;

            // Ranking dos problemas: quantas vezes cada tipo de ocorrência foi
            // registrado. A cor vem do tipo cadastrado para este cliente, a
            // mesma que ele tem no resto do sistema.
            const tiposDoCliente = operationTypes.filter(
              (t) => t.candidateId === inspectedCandidate.id,
            );
            // Todo tipo cadastrado entra na lista, mesmo zerado: o que ainda
            // não apareceu em campo também diz alguma coisa.
            const porProblema: {
              chave: string;
              rotulo: string;
              cor: string;
              total: number;
            }[] = tiposDoCliente.map((t) => ({
              chave: t.label,
              rotulo: t.label,
              cor: t.color || "#94A3B8",
              total: 0,
            }));
            checkInsDoCliente.forEach((c: any) => {
              const tipo = tiposDoCliente.find((t) => t.id === c.operationTypeId);
              const rotulo = c.operationTypeLabel || tipo?.label;
              if (!rotulo) return;
              const atual = porProblema.find((i) => i.chave === rotulo);
              if (atual) {
                atual.total += 1;
                return;
              }
              // Tipo apagado do cadastro, mas que já foi usado, não some daqui.
              porProblema.push({
                chave: rotulo,
                rotulo,
                cor: tipo?.color || "#94A3B8",
                total: 1,
              });
            });
            // Ranking das prioridades: quantos check-ins caíram em cada nível
            // da lista do administrador. Nível sem registro fica na lista
            // zerado, porque "ninguém marcou urgente hoje" também é notícia.
            const porPrioridade: {
              chave: string;
              rotulo: string;
              cor: string;
              total: number;
            }[] = opcoesDePrioridade.map((o) => ({
              chave: o.value,
              rotulo: o.label,
              cor: o.color || "#94A3B8",
              total: 0,
            }));
            checkInsDoCliente.forEach((c: any) => {
              if (!c.priority) return;
              const atual = porPrioridade.find((i) => i.chave === c.priority);
              if (atual) {
                atual.total += 1;
                return;
              }
              // Nível apagado da lista, mas já usado em campo, continua contando.
              const nivel = resolverPrioridade(c.priority);
              porPrioridade.push({
                chave: c.priority,
                rotulo: nivel?.label || c.priority,
                cor: nivel?.color || "#94A3B8",
                total: 1,
              });
            });
            const rankingPrioridades = [...porPrioridade].sort(
              (a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo),
            );
            const maiorDasPrioridades = rankingPrioridades[0]?.total || 1;
            const totalPriorizado = rankingPrioridades.reduce(
              (soma, i) => soma + i.total,
              0,
            );

            const rankingProblemas = [...porProblema].sort(
              (a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo),
            );
            const maiorDosProblemas = rankingProblemas[0]?.total || 1;

            // A legenda explica o que está desenhado: só entram as cores que
            // aparecem de fato nos pinos deste cliente.
            const legendaDoMapa: { chave: string; rotulo: string; cor: string }[] = [];
            checkInsDoCliente.forEach((c: any) => {
              const livre = c.mode === "livre";
              const nivel = livre ? resolverPrioridade(c.priority) : null;
              const chave = livre ? nivel?.value || "sem-nivel" : "missao";
              if (legendaDoMapa.some((l) => l.chave === chave)) return;
              legendaDoMapa.push({
                chave,
                rotulo: livre ? nivel?.label || "Sem prioridade" : "Por missão",
                cor: livre ? nivel?.color || "#f97316" : "#10b981",
              });
            });

            /* ------------------------------------------- visão geral ---
             * Os números do topo comparam hoje com ontem, e o mapa da aba
             * tem os próprios recortes — o painel da direita continua vendo
             * o cliente inteiro.
             */
            const ontem = new Date(Date.now() - 86400000).toDateString();
            const checkInsDeOntem = checkInsDoCliente.filter(
              (c: any) => new Date(c.createdAt).toDateString() === ontem,
            );
            const variacaoVsOntem =
              checkInsDeOntem.length === 0
                ? checkInsDeHoje.length > 0
                  ? 100
                  : 0
                : Math.round(
                    ((checkInsDeHoje.length - checkInsDeOntem.length) /
                      checkInsDeOntem.length) *
                      100,
                  );

            /** Bairro que mais aparece hoje: o "onde está pegando fogo". */
            const porBairro: { [nome: string]: number } = {};
            checkInsDeHoje.forEach((c: any) => {
              const bairro = (c.bairro || "").trim();
              if (!bairro) return;
              porBairro[bairro] = (porBairro[bairro] || 0) + 1;
            });
            const maiorConcentracao = Object.keys(porBairro).sort(
              (a, b) => porBairro[b] - porBairro[a],
            )[0];

            const inicioDoRecorte =
              periodoMapaGeral === "tudo"
                ? 0
                : periodoMapaGeral === "hoje"
                  ? new Date().setHours(0, 0, 0, 0)
                  : Date.now() - Number(periodoMapaGeral) * 86400000;

            /** Check-ins que o cartão do mapa desenha, já com os recortes. */
            const doRecorte = checkInsDoCliente.filter((c: any) => {
              const quando = new Date(c.createdAt).getTime();
              if (inicioDoRecorte && (Number.isNaN(quando) || quando < inicioDoRecorte))
                return false;
              if (
                prioridadeMapaGeral !== "todas" &&
                c.priority !== prioridadeMapaGeral
              )
                return false;
              return true;
            });
            const idsDoRecorte = doRecorte.map((c: any) => c.id);
            const pontosDoRecorte = pontosDoMapa.filter((_, indice) => {
              const origem = checkInsDoCliente.filter(
                (c: any) => c.coordinates?.lat && c.coordinates?.lng,
              )[indice];
              return origem && idsDoRecorte.includes(origem.id);
            });

            /** Níveis que aparecem na legenda, na ordem do administrador. */
            const niveisDaLegenda = opcoesDePrioridade.filter((nivel) =>
              checkInsDoCliente.some((c: any) => c.priority === nivel.value),
            );

            const rotuloDoPeriodo =
              periodoMapaGeral === "hoje"
                ? "Hoje"
                : periodoMapaGeral === "tudo"
                  ? "Todo o período"
                  : `${periodoMapaGeral} dias`;

            const abas = [
              { id: "geral" as const, rotulo: "Visão geral" },
              { id: "equipe" as const, rotulo: "Equipe" },
              { id: "tipos" as const, rotulo: "Tipos de operação" },
              { id: "checkins" as const, rotulo: "Check-ins" },
            ];


            return (
          <div className="flex flex-col flex-1 gap-5 font-sans">
            {/* CABEÇALHO DO CLIENTE */}
            <div className="bg-white border border-slate-200 rounded-3xl px-6 py-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <button
                  onClick={() => setInspectedCandidate(null)}
                  title="Voltar para os clientes"
                  className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="relative shrink-0">
                  <img
                    src={
                      inspectedCandidate.image ||
                      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                    }
                    alt={inspectedCandidate.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-100 bg-slate-50"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-[19px] font-extrabold text-[#0D233A] tracking-tight truncate">
                      {inspectedCandidate.name}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Cliente ativo
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {candidateLocationText(inspectedCandidate) || "Sem localização"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => handleOpenEditModal(inspectedCandidate)}
                  className="h-11 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar cliente
                </button>
                <button
                  onClick={() => {
                    setSelectedCandidateFilter(inspectedCandidate.id);
                    setAdminTab("map");
                  }}
                  className="h-11 px-4 bg-[#0D233A] hover:bg-[#123255] text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Map className="w-4 h-4" />
                  Entrar no mapa
                </button>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="h-11 px-4 bg-[#015FC9] hover:bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  Novo check-in
                </button>
              </div>
            </div>

            {/* ABAS DA FICHA */}
            <div className="bg-white border border-slate-200 rounded-2xl px-2 shadow-xs flex items-center gap-1 overflow-x-auto">
              {abas.map((aba) => (
                <button
                  key={aba.id}
                  onClick={() => setAbaCliente(aba.id)}
                  className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                    abaCliente === aba.id
                      ? "border-[#015FC9] text-[#015FC9]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {aba.rotulo}
                </button>
              ))}
              <button
                onClick={() => setTeamModal("campos")}
                className="px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 border-transparent text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Campos de coleta
              </button>
            </div>

            {/* VISÃO GERAL */}
            {abaCliente === "geral" && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.62fr_1fr] gap-4 items-start">
                {/* ================= COLUNA DA ESQUERDA ================= */}
                <div className="flex flex-col gap-4 min-w-0">
                  {/* MAPA OPERACIONAL */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-[#EFF4FB] text-[#015FC9] flex items-center justify-center shrink-0">
                          <Map className="w-4.5 h-4.5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-black text-[#0D233A] leading-tight">
                            Mapa operacional
                          </h3>
                          <p className="text-[11px] text-slate-400 font-semibold truncate">
                            Ocorrências registradas em{" "}
                            {inspectedCandidate.city || "campo"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            value={periodoMapaGeral}
                            onChange={(e) =>
                              setPeriodoMapaGeral(e.target.value as any)
                            }
                            className="appearance-none h-8 pl-7 pr-7 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 cursor-pointer focus:outline-hidden hover:border-slate-300"
                          >
                            <option value="hoje">Hoje</option>
                            <option value="7">7 dias</option>
                            <option value="30">30 dias</option>
                            <option value="tudo">Todo o período</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <div className="relative">
                          <select
                            value={prioridadeMapaGeral}
                            onChange={(e) => setPrioridadeMapaGeral(e.target.value)}
                            className="appearance-none h-8 pl-2.5 pr-7 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 cursor-pointer focus:outline-hidden hover:border-slate-300"
                          >
                            <option value="todas">Todas as prioridades</option>
                            {opcoesDePrioridade.map((nivel) => (
                              <option key={nivel.value} value={nivel.value}>
                                {nivel.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <button
                          onClick={() => {
                            setSelectedCandidateFilter(inspectedCandidate.id);
                            setAdminTab("map");
                          }}
                          className="h-8 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#015FC9] text-slate-600 hover:text-[#015FC9] text-[11px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          Tela cheia
                        </button>
                      </div>
                    </div>

                    {/* O mapa fica embutido, com cantos próprios e a etiqueta
                        do resumo flutuando por cima do canto de cima. */}
                    <div className="px-4">
                      <div className="relative rounded-xl overflow-hidden border border-slate-200">
                        {centro ? (
                          <MiniMapa
                            lat={centro.lat}
                            lng={centro.lng}
                            pontos={pontosDoRecorte}
                            height={252}
                          />
                        ) : (
                          <div className="h-[252px] bg-slate-50 flex items-center justify-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                            Sem registros para mostrar
                          </div>
                        )}

                        <div className="absolute top-3 left-3 z-[500] bg-white rounded-xl shadow-lg border border-slate-200/80 px-3 py-2 flex items-center gap-2.5 pointer-events-none">
                          <span className="w-8 h-8 rounded-lg bg-[#EFF4FB] text-[#015FC9] flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4" />
                          </span>
                          <div>
                            <p className="text-[12.5px] font-black text-[#0D233A] leading-none">
                              {doRecorte.length}{" "}
                              <span className="font-bold text-slate-500">
                                {doRecorte.length === 1 ? "registro" : "registros"}
                              </span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {maiorConcentracao
                                ? `Maior concentração: ${maiorConcentracao}`
                                : rotuloDoPeriodo}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* LEGENDA DAS PRIORIDADES */}
                    <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
                      {/* Do mais grave para o mais leve: é nessa ordem que
                          se lê uma legenda de urgência. */}
                      {(niveisDaLegenda.length > 0
                        ? niveisDaLegenda
                        : opcoesDePrioridade
                      )
                        .slice()
                        .reverse()
                        .map((nivel) => (
                          <span
                            key={nivel.value}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: nivel.color }}
                            />
                            {nivel.label}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* CHECK-INS RECENTES */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-[#EFF4FB] text-[#015FC9] flex items-center justify-center shrink-0">
                          <Clock className="w-4.5 h-4.5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-black text-[#0D233A] leading-tight">
                            Check-ins recentes
                          </h3>
                          <p className="text-[11px] text-slate-400 font-semibold truncate">
                            Últimos registros realizados pela equipe
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAbaCliente("checkins")}
                        className="text-[11.5px] font-black text-[#015FC9] hover:text-blue-700 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        Ver todos
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {checkInsDoCliente.length === 0 ? (
                      <div className="mx-4 mb-4 py-10 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        Nenhum check-in registrado ainda
                      </div>
                    ) : (
                      <div className="px-4 pb-4 flex flex-col gap-2">
                        {checkInsDoCliente.slice(0, 4).map((ci: any) => {
                          const tipo = operationTypes.find(
                            (t) =>
                              t.id === ci.operationTypeId ||
                              t.label === ci.operationTypeLabel,
                          );
                          const cor = tipo?.color || "#94A3B8";
                          const capa =
                            (ci.media || []).find((m: any) => m.type !== "video")
                              ?.url || ci.photo;
                          return (
                            <div
                              key={ci.id}
                              onClick={() => {
                                setAbaCliente("checkins");
                                setCheckInAberto(ci.id);
                              }}
                              className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 cursor-pointer transition-all"
                            >
                              <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-[9.5px] font-black text-[#015FC9] uppercase">
                                {ci.memberPhoto ? (
                                  <img
                                    src={ci.memberPhoto}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  (ci.name || "DT").substring(0, 2)
                                )}
                              </span>

                              <span className="text-[12.5px] font-black text-slate-800 truncate max-w-[155px] shrink-0">
                                {ci.name}
                              </span>

                              <span
                                className="px-2 py-1 rounded-lg text-[10.5px] font-black truncate max-w-[135px] shrink-0"
                                style={{
                                  backgroundColor: `${cor}1A`,
                                  color: cor,
                                }}
                              >
                                {ci.operationTypeLabel || "Sem tipo"}
                              </span>

                              <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 min-w-0 flex-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {[ci.rua, ci.bairro].filter(Boolean).join(", ") ||
                                    "Sem endereço"}
                                </span>
                              </span>

                              <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3" />
                                {new Date(ci.createdAt).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>

                              <span className="w-14 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                {capa ? (
                                  <img
                                    src={capa}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Camera className="w-3.5 h-3.5 text-slate-300" />
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ================== COLUNA DA DIREITA ================== */}
                <div className="flex flex-col gap-4 min-w-0">
                  {/* QUATRO NÚMEROS DO TOPO */}
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      {
                        chave: "equipe",
                        valor: String(equipeDoCliente.length),
                        apoio: "membros",
                        icone: <Users className="w-4 h-4" />,
                        cor: "text-[#015FC9] bg-[#EFF4FB]",
                      },
                      {
                        chave: "checkins",
                        valor: String(checkInsDeHoje.length),
                        apoio: "check-ins hoje",
                        icone: <ClipboardList className="w-4 h-4" />,
                        cor: "text-violet-600 bg-violet-50",
                      },
                      {
                        chave: "campo",
                        valor: String(emCampo.size),
                        apoio: "em campo",
                        icone: <Navigation className="w-4 h-4" />,
                        cor: "text-emerald-600 bg-emerald-50",
                      },
                      {
                        chave: "variacao",
                        valor: `${variacaoVsOntem >= 0 ? "+" : ""}${variacaoVsOntem}%`,
                        apoio: "vs. ontem",
                        icone: <TrendingUp className="w-4 h-4" />,
                        cor:
                          variacaoVsOntem >= 0
                            ? "text-emerald-600 bg-emerald-50"
                            : "text-rose-600 bg-rose-50",
                        destaque:
                          variacaoVsOntem >= 0
                            ? "text-emerald-600"
                            : "text-rose-600",
                      },
                    ].map((item) => (
                      <div
                        key={item.chave}
                        className="bg-white border border-slate-200 rounded-2xl px-2.5 py-3 shadow-xs flex flex-col items-start gap-1.5"
                      >
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.cor}`}
                        >
                          {item.icone}
                        </span>
                        <p
                          className={`text-[19px] font-black leading-none ${
                            item.destaque || "text-[#0D233A]"
                          }`}
                        >
                          {item.valor}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold leading-tight">
                          {item.apoio}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* PULSO DA OPERAÇÃO */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-[#EFF4FB] text-[#015FC9] flex items-center justify-center shrink-0">
                          <Activity className="w-4.5 h-4.5" />
                        </span>
                        <h3 className="text-[14px] font-black text-[#0D233A] leading-tight truncate">
                          Pulso da operação
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Atualizado agora
                      </span>
                    </div>

                    {/* PRIORIDADES */}
                    <h4 className="text-[11.5px] font-black text-[#0D233A] mb-2">
                      Prioridades
                    </h4>
                    <div className="flex flex-col gap-2">
                      {rankingPrioridades.map((item) => (
                        <div key={item.chave} className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.cor }}
                          />
                          <span className="text-[11.5px] font-bold text-slate-600 w-[58px] shrink-0 truncate">
                            {item.rotulo}
                          </span>
                          <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden min-w-0">
                            <span
                              className="block h-full rounded-full transition-all"
                              style={{
                                width: `${(item.total / maiorDasPrioridades) * 100}%`,
                                backgroundColor: item.cor,
                              }}
                            />
                          </span>
                          <span className="text-[12px] font-black text-[#0D233A] w-6 text-right shrink-0">
                            {item.total}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* PROBLEMAS MAIS REPORTADOS */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100">
                      <h4 className="text-[11.5px] font-black text-[#0D233A] mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#F58220]" />
                        Problemas mais reportados
                      </h4>

                      {rankingProblemas.length === 0 ? (
                        <p className="py-4 text-center text-[10.5px] font-bold uppercase tracking-widest text-slate-300">
                          Nada registrado ainda
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {rankingProblemas.slice(0, 4).map((item, posicao) => (
                            <div
                              key={item.chave}
                              className="flex items-center gap-2"
                            >
                              <span
                                className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                                  posicao === 0
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {posicao + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11.5px] font-bold text-slate-700 truncate leading-tight">
                                  {item.rotulo}
                                </p>
                                <span className="mt-1 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <span
                                    className="block h-full rounded-full"
                                    style={{
                                      width: `${(item.total / maiorDosProblemas) * 100}%`,
                                      backgroundColor: item.cor,
                                    }}
                                  />
                                </span>
                              </div>
                              <span className="text-[12px] font-black text-[#0D233A] w-6 text-right shrink-0">
                                {item.total}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RANKING DA EQUIPE */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                    <div className="flex items-center gap-2.5 mb-3.5">
                      <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                        <Trophy className="w-4.5 h-4.5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-black text-[#0D233A] leading-tight">
                          Ranking da equipe
                        </h3>
                        <p className="text-[11px] text-slate-400 font-semibold">
                          Desempenho de hoje
                        </p>
                      </div>
                    </div>

                    {ranking.length === 0 ? (
                      <p className="py-6 text-center text-[10.5px] font-bold uppercase tracking-widest text-slate-300">
                        Nenhum check-in registrado ainda
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {ranking.slice(0, 3).map((item, posicao) => (
                          <div
                            key={item.chave}
                            className="flex items-center gap-2.5"
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${
                                posicao === 0
                                  ? "bg-amber-100 text-amber-700"
                                  : posicao === 1
                                    ? "bg-slate-200 text-slate-600"
                                    : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {posicao + 1}
                            </span>

                            <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-[9.5px] font-black text-[#015FC9] uppercase">
                              {item.foto ? (
                                <img
                                  src={item.foto}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                item.nome.substring(0, 2)
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-black text-slate-800 truncate leading-tight">
                                {item.nome}
                              </p>
                              <span className="mt-1 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <span
                                  className="block h-full rounded-full bg-emerald-500"
                                  style={{
                                    width: `${(item.total / maiorDoRanking) * 100}%`,
                                  }}
                                />
                              </span>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-[13px] font-black text-[#0D233A] leading-none">
                                {item.total}
                              </p>
                              <p className="text-[9.5px] text-slate-400 font-bold">
                                check-ins
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* EQUIPE */}
            {abaCliente === "equipe" && (() => {
              const agora = new Date();
              const inicioDeHoje = new Date(
                agora.getFullYear(),
                agora.getMonth(),
                agora.getDate(),
              ).getTime();
              const inicioDeOntem = inicioDeHoje - 86400000;
              const inicioDoPeriodo =
                periodoRanking === "semana"
                  ? inicioDeHoje - 6 * 86400000
                  : periodoRanking === "mes"
                    ? new Date(
                        agora.getFullYear(),
                        agora.getMonth(),
                        1,
                      ).getTime()
                    : 0;

              /** (94) 99123-4567 a partir do que estiver gravado. */
              const formatarTelefone = (bruto?: string) => {
                const n = (bruto || "").replace(/\D/g, "").replace(/^55/, "");
                if (n.length === 11)
                  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
                if (n.length === 10)
                  return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
                return bruto || "Sem telefone";
              };

              /** Tudo que a tela precisa saber de cada integrante. */
              const membros = equipeDoCliente.map((m: any) => {
                const meus = checkInsDoCliente.filter(
                  (c: any) => c.memberId === m.id || c.name === m.full_name,
                );
                const ultimo = meus
                  .map((c: any) => new Date(c.createdAt).getTime())
                  .filter((t: number) => !Number.isNaN(t))
                  .sort((a: number, b: number) => b - a)[0];
                const noPeriodo = meus.filter((c: any) => {
                  const t = new Date(c.createdAt).getTime();
                  return !Number.isNaN(t) && t >= inicioDoPeriodo;
                }).length;
                return {
                  ...m,
                  telefone: formatarTelefone(m.whatsapp),
                  total: meus.length,
                  noPeriodo,
                  ultimo,
                  emCampo: ultimo !== undefined && ultimo >= inicioDeHoje,
                };
              });

              /** "Hoje, 08:42", "Ontem, 17:26" ou a data cheia. */
              const quandoFoi = (t?: number) => {
                if (t === undefined) return "Nunca registrou";
                const hora = new Date(t).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                if (t >= inicioDeHoje) return `Hoje, ${hora}`;
                if (t >= inicioDeOntem) return `Ontem, ${hora}`;
                return `${new Date(t).toLocaleDateString("pt-BR")}, ${hora}`;
              };

              const origemDoMembro = (fonte?: string) =>
                fonte === "qrcode"
                  ? { rotulo: "QR Code", cor: "bg-purple-50 text-purple-600" }
                  : fonte === "vinculado"
                    ? { rotulo: "Vinculado", cor: "bg-slate-100 text-slate-500" }
                    : { rotulo: "Cadastro manual", cor: "bg-blue-50 text-[#015FC9]" };

              const busca = buscaEquipe.trim().toLowerCase();
              const somenteNumeros = busca.replace(/\D/g, "");
              const filtrados = membros.filter((m: any) => {
                const casaBusca =
                  !busca ||
                  (m.full_name || "").toLowerCase().includes(busca) ||
                  (somenteNumeros.length > 0 &&
                    (m.whatsapp || "").replace(/\D/g, "").includes(somenteNumeros));
                const casaStatus =
                  filtroEquipe === "todos" ||
                  (filtroEquipe === "campo" ? m.emCampo : !m.emCampo);
                return casaBusca && casaStatus;
              });

              const porPagina = 10;
              const totalPaginas = Math.max(
                1,
                Math.ceil(filtrados.length / porPagina),
              );
              const pagina = Math.min(paginaEquipe, totalPaginas);
              const daPagina = filtrados.slice(
                (pagina - 1) * porPagina,
                pagina * porPagina,
              );

              const emCampoAgora = membros.filter((m: any) => m.emCampo).length;

              const rankingEquipe = [...membros].sort(
                (a: any, b: any) =>
                  b.noPeriodo - a.noPeriodo ||
                  (a.full_name || "").localeCompare(b.full_name || ""),
              );
              const mostrados = rankingCompleto
                ? rankingEquipe
                : rankingEquipe.slice(0, 3);
              const maiorDoPeriodo = rankingEquipe[0]?.noPeriodo || 1;
              const medalhas = [
                "bg-amber-100 text-amber-700 border-amber-200",
                "bg-slate-200 text-slate-600 border-slate-300",
                "bg-orange-100 text-orange-700 border-orange-200",
              ];

              const Retrato = ({
                pessoa,
                tamanho,
              }: {
                pessoa: any;
                tamanho: string;
              }) => (
                <span
                  className={`${tamanho} rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-[11px] font-black text-[#015FC9] uppercase`}
                >
                  {pessoa.image ? (
                    <img
                      src={pessoa.image}
                      alt={pessoa.full_name || "Integrante"}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  ) : (
                    (pessoa.full_name || "DT").substring(0, 2)
                  )}
                </span>
              );

              return (
                <div className="flex flex-col gap-5">
                  {/* CABEÇALHO DA EQUIPE */}
                  <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-2xl bg-[#F1F5FB] text-[#015FC9] flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-black text-[#0D233A] leading-tight flex items-center gap-2 flex-wrap">
                          Equipe
                          <span className="px-2.5 py-1 rounded-full bg-[#EFF4FB] text-[#015FC9] text-[11px] font-black">
                            {equipeDoCliente.length}{" "}
                            {equipeDoCliente.length === 1
                              ? "membro"
                              : "membros"}
                          </span>
                        </h3>
                        <p className="text-[12px] text-slate-400 font-semibold">
                          Gerencie os membros vinculados a este cliente
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Chave da importação da equipe da base externa. */}
                      <button
                        disabled={togglingTeamId === inspectedCandidate.id}
                        onClick={() => handleToggleTeamSync(inspectedCandidate)}
                        title={
                          inspectedCandidate.syncTeam
                            ? "A equipe deste cliente está sendo trazida. Clique para parar."
                            : "A equipe deste cliente não é trazida. Clique para trazer."
                        }
                        className={`h-11 px-3.5 font-bold text-xs rounded-2xl flex items-center gap-2 border transition-all cursor-pointer ${
                          inspectedCandidate.syncTeam
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        } ${
                          togglingTeamId === inspectedCandidate.id
                            ? "opacity-60 cursor-wait"
                            : ""
                        }`}
                      >
                        <span
                          className={`w-7 h-4 rounded-full flex items-center px-0.5 transition-all ${
                            inspectedCandidate.syncTeam
                              ? "bg-emerald-500 justify-end"
                              : "bg-slate-300 justify-start"
                          }`}
                        >
                          <span className="w-3 h-3 bg-white rounded-full block" />
                        </span>
                        Trazer equipe
                      </button>

                      <button
                        onClick={() => setTeamModal("campos")}
                        className="h-11 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <PenTool className="w-4 h-4 text-[#015FC9]" />
                        Campos
                      </button>
                      <button
                        onClick={() => setTeamModal("vincular")}
                        className="h-11 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Link2 className="w-4 h-4 text-[#015FC9]" />
                        Vincular
                      </button>
                      <button
                        onClick={() => setTeamModal("qrcode")}
                        className="h-11 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <QrCode className="w-4 h-4 text-[#015FC9]" />
                        QR Code
                      </button>
                      <button
                        onClick={() => setTeamModal("manual")}
                        className="h-11 px-4 bg-[#015FC9] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Cadastrar
                      </button>
                    </div>
                  </div>

                  {/* NÚMEROS DA EQUIPE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5 flex items-center gap-4">
                      <span className="w-12 h-12 rounded-2xl bg-[#EFF4FB] text-[#015FC9] flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6" />
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Total de membros
                        </p>
                        <p className="text-3xl font-black text-[#0D233A] leading-tight">
                          {equipeDoCliente.length}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5 flex items-center gap-4">
                      <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Megaphone className="w-6 h-6" />
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Em campo agora
                        </p>
                        <p className="text-3xl font-black text-[#0D233A] leading-tight flex items-baseline gap-2">
                          {emCampoAgora}
                          <span className="text-[12px] font-bold text-emerald-600">
                            {emCampoAgora === 1 ? "Ativo" : "Ativos"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                    {/* LISTA DE MEMBROS */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                      <div className="px-6 pt-5 pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Users className="w-5 h-5 text-[#015FC9] shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-[15px] font-black text-[#0D233A] leading-tight">
                              Membros da equipe
                            </h4>
                            <p className="text-[11px] text-slate-400 font-semibold truncate">
                              Pessoas vinculadas a {inspectedCandidate.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl h-10 px-3 w-48 focus-within:ring-2 focus-within:ring-blue-500/20">
                            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <input
                              type="text"
                              value={buscaEquipe}
                              onChange={(e) => {
                                setBuscaEquipe(e.target.value);
                                setPaginaEquipe(1);
                              }}
                              placeholder="Buscar por nome ou telefone..."
                              className="bg-transparent border-none w-full text-[11.5px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div className="relative">
                            <select
                              value={filtroEquipe}
                              onChange={(e) => {
                                setFiltroEquipe(e.target.value as any);
                                setPaginaEquipe(1);
                              }}
                              className="appearance-none h-10 pl-3.5 pr-9 bg-white border border-slate-200 rounded-2xl text-[11.5px] font-bold text-slate-600 cursor-pointer focus:outline-hidden"
                            >
                              <option value="todos">Todos os status</option>
                              <option value="campo">Em campo</option>
                              <option value="ativo">Ativo</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] border-collapse text-left">
                          <thead>
                            <tr className="bg-[#FAFBFD] border-y border-slate-100">
                              {[
                                "Membro",
                                "Telefone",
                                "Origem",
                                "Último check-in",
                                "Status",
                              ].map((coluna) => (
                                <th
                                  key={coluna}
                                  className="py-3 px-3 text-[9.5px] uppercase font-black text-[#8492A6] whitespace-nowrap"
                                >
                                  {coluna}
                                </th>
                              ))}
                              <th className="py-3 px-3 text-[9.5px] uppercase font-black text-[#8492A6] text-right">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {daPagina.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="py-14 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest"
                                >
                                  {equipeDoCliente.length === 0
                                    ? "Nenhum integrante vinculado a este cliente"
                                    : "Nenhum integrante encontrado"}
                                </td>
                              </tr>
                            ) : (
                              daPagina.map((membro: any) => {
                                const origem = origemDoMembro(membro.source);
                                const desde =
                                  membro.created_at || membro.createdAt;
                                return (
                                  <tr
                                    key={membro.id}
                                    className="hover:bg-slate-50/60 transition-all"
                                  >
                                    <td className="py-3.5 px-3">
                                      <div className="flex items-center gap-3">
                                        <Retrato
                                          pessoa={membro}
                                          tamanho="w-10 h-10"
                                        />
                                        <div className="min-w-0">
                                          <p className="font-black text-slate-800 text-[13px] leading-tight truncate">
                                            {membro.full_name}
                                          </p>
                                          <p className="text-[10.5px] text-slate-400 font-semibold whitespace-nowrap">
                                            {desde
                                              ? `Membro desde ${new Date(
                                                  desde,
                                                ).toLocaleDateString("pt-BR")}`
                                              : "Data de entrada não registrada"}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-3 text-[12px] font-semibold text-slate-500 whitespace-nowrap">
                                      {formatarTelefone(membro.whatsapp)}
                                    </td>
                                    <td className="py-3.5 px-3">
                                      <span
                                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black whitespace-nowrap ${origem.cor}`}
                                      >
                                        {origem.rotulo}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-3 text-[12px] font-semibold text-slate-500 whitespace-nowrap">
                                      {quandoFoi(membro.ultimo)}
                                    </td>
                                    <td className="py-3.5 px-3">
                                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-slate-600 whitespace-nowrap">
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            membro.emCampo
                                              ? "bg-emerald-500"
                                              : "bg-slate-300"
                                          }`}
                                        />
                                        {membro.emCampo ? "Em campo" : "Ativo"}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-3 text-right">
                                      <button
                                        onClick={() => setMembroDoPerfil(membro)}
                                        className="h-8 px-3.5 border border-slate-200 hover:border-[#015FC9] hover:text-[#015FC9] text-slate-600 text-[11px] font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
                                      >
                                        Ver perfil
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="px-6 py-4 flex items-center justify-between gap-3 border-t border-slate-100">
                        <p className="text-[11px] font-bold text-slate-400">
                          Mostrando {daPagina.length} de {filtrados.length}{" "}
                          {filtrados.length === 1 ? "membro" : "membros"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={pagina <= 1}
                            onClick={() => setPaginaEquipe(pagina - 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(
                            (numero) => (
                              <button
                                key={numero}
                                onClick={() => setPaginaEquipe(numero)}
                                className={`w-8 h-8 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                  numero === pagina
                                    ? "bg-[#015FC9] text-white"
                                    : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                {numero}
                              </button>
                            ),
                          )}
                          <button
                            disabled={pagina >= totalPaginas}
                            onClick={() => setPaginaEquipe(pagina + 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* RANKING DE CHECK-INS */}
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl leading-none">🏆</span>
                          <div className="min-w-0">
                            <h4 className="text-[15px] font-black text-[#0D233A] leading-tight">
                              Ranking de check-ins
                            </h4>
                            <p className="text-[11px] text-slate-400 font-semibold">
                              Desempenho da equipe no período
                            </p>
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          <select
                            value={periodoRanking}
                            onChange={(e) =>
                              setPeriodoRanking(e.target.value as any)
                            }
                            className="appearance-none h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 cursor-pointer focus:outline-hidden"
                          >
                            <option value="mes">Este mês</option>
                            <option value="semana">Últimos 7 dias</option>
                            <option value="tudo">Todo o período</option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {rankingEquipe.length === 0 ? (
                        <div className="py-10 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                          Nenhum integrante na equipe
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
                          {mostrados.map((pessoa: any, posicao: number) => (
                            <div
                              key={pessoa.id}
                              className="flex items-center gap-3"
                            >
                              <span
                                className={`w-8 h-8 rounded-full border text-[11px] font-black flex items-center justify-center shrink-0 ${
                                  medalhas[posicao] ||
                                  "bg-slate-50 text-slate-400 border-slate-200"
                                }`}
                              >
                                {posicao + 1}º
                              </span>
                              <Retrato pessoa={pessoa} tamanho="w-11 h-11" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-black text-slate-800 truncate leading-tight">
                                  {pessoa.full_name}
                                </p>
                                <p className="text-[10.5px] text-slate-400 font-semibold">
                                  {pessoa.noPeriodo}{" "}
                                  {pessoa.noPeriodo === 1
                                    ? "check-in"
                                    : "check-ins"}
                                </p>
                                <span className="mt-1.5 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <span
                                    className="block h-full rounded-full bg-[#015FC9]"
                                    style={{
                                      width: `${(pessoa.noPeriodo / maiorDoPeriodo) * 100}%`,
                                    }}
                                  />
                                </span>
                              </div>
                              <p className="text-2xl font-black text-[#0D233A] leading-none shrink-0">
                                {pessoa.noPeriodo}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {rankingEquipe.length > 0 && (
                        <button
                          onClick={() => setRankingCompleto((v) => !v)}
                          className="h-11 w-full border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          <ClipboardList className="w-4 h-4 text-[#015FC9]" />
                          {rankingCompleto
                            ? "Ver só o pódio"
                            : "Ver ranking completo"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {abaCliente === "tipos" && (() => {
              const agora = new Date();
              const inicioDoPeriodo =
                periodoTipos === "semana"
                  ? new Date(
                      agora.getFullYear(),
                      agora.getMonth(),
                      agora.getDate() - 6,
                    ).getTime()
                  : periodoTipos === "mes"
                    ? new Date(agora.getFullYear(), agora.getMonth(), 1).getTime()
                    : 0;

              const tiposDoCliente = operationTypes
                .filter((t) => t.candidateId === inspectedCandidate.id)
                .sort(
                  (a, b) =>
                    (a.position ?? 0) - (b.position ?? 0) ||
                    a.label.localeCompare(b.label),
                );

              /** Quantos check-ins cada tipo tem, no total e no período. */
              const contar = (tipo: OperationType, desde: number) =>
                checkInsDoCliente.filter((c: any) => {
                  const mesmo =
                    c.operationTypeId === tipo.id ||
                    c.operationTypeLabel === tipo.label;
                  if (!mesmo) return false;
                  if (!desde) return true;
                  const t = new Date(c.createdAt).getTime();
                  return !Number.isNaN(t) && t >= desde;
                }).length;

              const comUso = tiposDoCliente.map((tipo) => ({
                ...tipo,
                total: contar(tipo, 0),
                noPeriodo: contar(tipo, inicioDoPeriodo),
              }));

              const busca = buscaTipos.trim().toLowerCase();
              const filtrados = comUso.filter((tipo) => {
                const casaBusca =
                  !busca ||
                  tipo.label.toLowerCase().includes(busca) ||
                  (tipo.description || "").toLowerCase().includes(busca);
                const ligado = tipo.active !== false;
                const casaStatus =
                  filtroTipos === "todos" ||
                  (filtroTipos === "ativo" ? ligado : !ligado);
                return casaBusca && casaStatus;
              });

              const porPagina = 10;
              const totalPaginas = Math.max(
                1,
                Math.ceil(filtrados.length / porPagina),
              );
              const pagina = Math.min(paginaTipos, totalPaginas);
              const daPagina = filtrados.slice(
                (pagina - 1) * porPagina,
                pagina * porPagina,
              );

              const usoNoPeriodo = [...comUso].sort(
                (a, b) => b.noPeriodo - a.noPeriodo || a.label.localeCompare(b.label),
              );
              const maiorUso = usoNoPeriodo[0]?.noPeriodo || 1;
              const totalNoPeriodo = usoNoPeriodo.reduce(
                (soma, t) => soma + t.noPeriodo,
                0,
              );

              /** Solta o tipo arrastado na posição de outro e regrava a ordem. */
              const reordenar = (destinoId: string) => {
                if (!tipoArrastado || tipoArrastado === destinoId) return;
                const ordem = tiposDoCliente.map((t) => t.id);
                const de = ordem.indexOf(tipoArrastado);
                const para = ordem.indexOf(destinoId);
                if (de < 0 || para < 0) return;
                ordem.splice(para, 0, ordem.splice(de, 1)[0]);

                setOperationTypes((prev) =>
                  prev.map((t) => {
                    const nova = ordem.indexOf(t.id);
                    return nova < 0 ? t : { ...t, position: nova };
                  }),
                );
                if (isDatabaseConfigured) {
                  ordem.forEach((id, indice) => {
                    const tipo = operationTypes.find((t) => t.id === id);
                    if (tipo)
                      DatabaseService.upsertOperationType({
                        ...tipo,
                        position: indice,
                      });
                  });
                }
                setTipoArrastado(null);
              };

              const Emblema = ({
                tipo,
                tamanho,
              }: {
                tipo: OperationType;
                tamanho: string;
              }) => (
                <span
                  className={`${tamanho} rounded-2xl flex items-center justify-center shrink-0 text-white`}
                  style={{ backgroundColor: tipo.color }}
                >
                  <OperationIcon icon={tipo.icon} size={20} />
                </span>
              );

              return (
                <div className="flex flex-col gap-5">
                  {/* CABEÇALHO DOS TIPOS */}
                  <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-2xl bg-[#F1F5FB] text-[#015FC9] flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-black text-[#0D233A] leading-tight flex items-center gap-2 flex-wrap">
                          Tipos de operação
                          <span className="px-2.5 py-1 rounded-full bg-[#EFF4FB] text-[#015FC9] text-[11px] font-black">
                            {tiposDoCliente.length}{" "}
                            {tiposDoCliente.length === 1 ? "tipo" : "tipos"}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-black flex items-center gap-1.5">
                            <Lock className="w-3 h-3" />
                            Exclusivos deste cliente
                          </span>
                        </h3>
                        <p className="text-[12px] text-slate-400 font-semibold">
                          Configure as opções disponíveis nos check-ins deste
                          cliente
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        resetOperationTypeForm();
                        setModalTipoAberto(true);
                      }}
                      className="h-11 px-4 bg-[#015FC9] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Novo tipo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                    {/* LISTA DE TIPOS */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                      <div className="px-6 pt-5 pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-[15px] font-black text-[#0D233A] leading-tight">
                            Tipos cadastrados
                          </h4>
                          <p className="text-[11px] text-slate-400 font-semibold">
                            Arraste para ordenar como aparecem no check-in
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl h-10 px-3 w-56 focus-within:ring-2 focus-within:ring-blue-500/20">
                            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <input
                              type="text"
                              value={buscaTipos}
                              onChange={(e) => {
                                setBuscaTipos(e.target.value);
                                setPaginaTipos(1);
                              }}
                              placeholder="Buscar tipo de operação..."
                              className="bg-transparent border-none w-full text-[11.5px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden"
                            />
                          </div>
                          <div className="relative">
                            <select
                              value={filtroTipos}
                              onChange={(e) => {
                                setFiltroTipos(e.target.value as any);
                                setPaginaTipos(1);
                              }}
                              className="appearance-none h-10 pl-3.5 pr-9 bg-white border border-slate-200 rounded-2xl text-[11.5px] font-bold text-slate-600 cursor-pointer focus:outline-hidden"
                            >
                              <option value="todos">Todos os status</option>
                              <option value="ativo">Ativo</option>
                              <option value="inativo">Inativo</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] border-collapse text-left">
                          <thead>
                            <tr className="bg-[#FAFBFD] border-y border-slate-100">
                              {["Ordem", "Tipo de operação", "Check-ins", "Status"].map(
                                (coluna) => (
                                  <th
                                    key={coluna}
                                    className="py-3 px-3 text-[9.5px] uppercase font-black text-[#8492A6] whitespace-nowrap"
                                  >
                                    {coluna}
                                  </th>
                                ),
                              )}
                              <th className="py-3 px-3 text-[9.5px] uppercase font-black text-[#8492A6]">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {daPagina.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-14 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest"
                                >
                                  {tiposDoCliente.length === 0
                                    ? "Nenhum tipo cadastrado para este cliente"
                                    : "Nenhum tipo encontrado"}
                                </td>
                              </tr>
                            ) : (
                              daPagina.map((tipo) => (
                                <tr
                                  key={tipo.id}
                                  draggable
                                  onDragStart={() => setTipoArrastado(tipo.id)}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => reordenar(tipo.id)}
                                  onDragEnd={() => setTipoArrastado(null)}
                                  className={`hover:bg-slate-50/60 transition-all ${
                                    tipoArrastado === tipo.id ? "opacity-40" : ""
                                  }`}
                                >
                                  <td className="py-3.5 px-3">
                                    <span
                                      className="w-7 h-7 rounded-lg grid grid-cols-2 gap-[3px] content-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
                                      title="Arraste para mudar a ordem"
                                    >
                                      {Array.from({ length: 6 }).map((_, i) => (
                                        <span
                                          key={i}
                                          className="w-[3px] h-[3px] rounded-full bg-current"
                                        />
                                      ))}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="flex items-center gap-3">
                                      <Emblema tipo={tipo} tamanho="w-10 h-10" />
                                      <div className="min-w-0">
                                        <p className="font-black text-slate-800 text-[13px] leading-tight truncate">
                                          {tipo.label}
                                        </p>
                                        <p className="text-[10.5px] text-slate-400 font-semibold truncate">
                                          {tipo.description || "Sem descrição"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 text-[12px] font-semibold text-slate-500 whitespace-nowrap">
                                    {tipo.total}{" "}
                                    {tipo.total === 1 ? "check-in" : "check-ins"}
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <button
                                      role="switch"
                                      aria-checked={tipo.active !== false}
                                      onClick={() => alternarTipoAtivo(tipo)}
                                      title={
                                        tipo.active !== false
                                          ? "Desligar: sai dos check-ins"
                                          : "Ligar: volta aos check-ins"
                                      }
                                      className="inline-flex items-center gap-2 text-[11.5px] font-bold text-slate-600 whitespace-nowrap cursor-pointer hover:text-slate-800"
                                    >
                                      {/* Chavinha: um toque liga ou desliga o tipo */}
                                      <span
                                        className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${
                                          tipo.active !== false
                                            ? "bg-emerald-500"
                                            : "bg-slate-300"
                                        }`}
                                      >
                                        <span
                                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                            tipo.active !== false
                                              ? "translate-x-4"
                                              : "translate-x-0"
                                          }`}
                                        />
                                      </span>
                                      {tipo.active !== false ? "Ativo" : "Inativo"}
                                    </button>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          startEditOperationType(tipo);
                                          setModalTipoAberto(true);
                                        }}
                                        className="h-8 px-3.5 border border-slate-200 hover:border-[#015FC9] hover:text-[#015FC9] text-slate-600 text-[11px] font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        onClick={() => deleteOperationType(tipo.id)}
                                        title="Excluir tipo"
                                        className="w-8 h-8 border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="px-6 py-4 flex items-center justify-between gap-3 border-t border-slate-100">
                        <p className="text-[11px] font-bold text-slate-400">
                          {filtrados.length}{" "}
                          {filtrados.length === 1
                            ? "tipo cadastrado"
                            : "tipos cadastrados"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={pagina <= 1}
                            onClick={() => setPaginaTipos(pagina - 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(
                            (numero) => (
                              <button
                                key={numero}
                                onClick={() => setPaginaTipos(numero)}
                                className={`w-8 h-8 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                  numero === pagina
                                    ? "bg-[#015FC9] text-white"
                                    : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                {numero}
                              </button>
                            ),
                          )}
                          <button
                            disabled={pagina >= totalPaginas}
                            onClick={() => setPaginaTipos(pagina + 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* USO NOS CHECK-INS */}
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BarChart3 className="w-5 h-5 text-[#015FC9] shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-[15px] font-black text-[#0D233A] leading-tight">
                              Uso nos check-ins
                            </h4>
                            <p className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                              Distribuição por tipo de operação
                            </p>
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          <select
                            value={periodoTipos}
                            onChange={(e) => setPeriodoTipos(e.target.value as any)}
                            className="appearance-none h-9 pl-2.5 pr-7 bg-white border border-slate-200 rounded-xl text-[10.5px] font-bold text-slate-600 cursor-pointer focus:outline-hidden"
                          >
                            <option value="mes">Este mês</option>
                            <option value="semana">Últimos 7 dias</option>
                            <option value="tudo">Todo o período</option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {usoNoPeriodo.length === 0 ? (
                        <div className="py-10 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                          Nenhum tipo cadastrado
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                          {usoNoPeriodo.map((tipo) => (
                            <div key={tipo.id} className="flex items-center gap-3">
                              <Emblema tipo={tipo} tamanho="w-10 h-10" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] font-black text-slate-800 truncate leading-tight">
                                  {tipo.label}
                                </p>
                                <span className="mt-1.5 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <span
                                    className="block h-full rounded-full"
                                    style={{
                                      width: `${(tipo.noPeriodo / maiorUso) * 100}%`,
                                      backgroundColor: tipo.color,
                                    }}
                                  />
                                </span>
                              </div>
                              <p className="text-xl font-black text-[#0D233A] leading-none shrink-0">
                                {tipo.noPeriodo}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-slate-100 pt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-[#0D233A] leading-none">
                          {totalNoPeriodo}
                        </span>
                        <span className="text-[12px] font-semibold text-slate-400">
                          check-ins no período
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* CHECK-INS */}
            {abaCliente === "checkins" && (() => {
              const agora = new Date();
              const inicioDeHoje = new Date(
                agora.getFullYear(),
                agora.getMonth(),
                agora.getDate(),
              ).getTime();
              const inicioDeOntem = inicioDeHoje - 86400000;
              const inicioDoPeriodo =
                periodoCheckIns === "tudo"
                  ? 0
                  : inicioDeHoje - (Number(periodoCheckIns) - 1) * 86400000;

              const quandoFoi = (iso?: string) => {
                const t = iso ? new Date(iso).getTime() : NaN;
                if (Number.isNaN(t)) return "Sem data";
                const hora = new Date(t).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                if (t >= inicioDeHoje) return `Hoje, ${hora}`;
                if (t >= inicioDeOntem) return `Ontem, ${hora}`;
                return `${new Date(t).toLocaleDateString("pt-BR")}, ${hora}`;
              };

              const tiposDoCliente = operationTypes.filter(
                (t) => t.candidateId === inspectedCandidate.id,
              );
              const corDaOperacao = (rotulo?: string) =>
                tiposDoCliente.find((t) => t.label === rotulo)?.color || "#94A3B8";

              /** Cada registro com o que a lista precisa mostrar. */
              const registros = checkInsDoCliente
                .map((c: any) => {
                  const operacoes =
                    resumoCheckIns.operacoes[c.id] ||
                    (c.operationTypeLabel ? [c.operationTypeLabel] : []);
                  const arquivos = resumoCheckIns.midias[c.id] || {
                    imagens: (c.media || []).filter(
                      (m: any) => m.type !== "video",
                    ).length || (c.photo ? 1 : 0),
                    videos: (c.media || []).filter((m: any) => m.type === "video")
                      .length,
                  };
                  const integrante = equipeDoCliente.find(
                    (m: any) => m.id === c.memberId || m.full_name === c.name,
                  );
                  return {
                    ...c,
                    operacoes,
                    arquivos,
                    total: arquivos.imagens + arquivos.videos,
                    foto: integrante?.image || c.memberPhoto,
                    concluido: c.status !== "rascunho",
                    quando: new Date(c.createdAt).getTime(),
                  };
                })
                .sort((a: any, b: any) => b.quando - a.quando);

              const busca = buscaCheckIns.trim().toLowerCase();
              const filtrados = registros.filter((r: any) => {
                const local = [r.rua, r.bairro].filter(Boolean).join(", ");
                const casaBusca =
                  !busca ||
                  (r.name || "").toLowerCase().includes(busca) ||
                  local.toLowerCase().includes(busca) ||
                  r.operacoes.some((o: string) =>
                    o.toLowerCase().includes(busca),
                  );
                const casaPeriodo =
                  inicioDoPeriodo === 0 ||
                  (!Number.isNaN(r.quando) && r.quando >= inicioDoPeriodo);
                const casaOperacao =
                  operacaoCheckIns === "todas" ||
                  r.operacoes.includes(operacaoCheckIns);
                const casaStatus =
                  statusCheckIns === "todos" ||
                  (statusCheckIns === "concluido" ? r.concluido : !r.concluido);
                return casaBusca && casaPeriodo && casaOperacao && casaStatus;
              });

              const porPagina = 8;
              const totalPaginas = Math.max(
                1,
                Math.ceil(filtrados.length / porPagina),
              );
              const pagina = Math.min(paginaCheckIns, totalPaginas);
              const daPagina = filtrados.slice(
                (pagina - 1) * porPagina,
                pagina * porPagina,
              );

              // Sem escolha da pessoa, o painel abre no registro mais recente.
              const escolhido =
                filtrados.find((r: any) => r.id === checkInAberto) || daPagina[0];

              /** Número curto do check-in, na ordem em que foram registrados. */
              const numeroDoRegistro = (id: string) => {
                const posicao = registros.length - registros.findIndex((r: any) => r.id === id);
                return String(posicao).padStart(4, "0");
              };

              const midiasDoPainel = fichaDoCheckIn?.midias?.length
                ? fichaDoCheckIn.midias
                : (escolhido?.media || []).map((m: any) => ({
                    id: m.url,
                    url: m.url,
                    kind: m.type === "video" ? "video" : "image",
                  }));
              const operacoesDoPainel = fichaDoCheckIn?.operacoes?.length
                ? fichaDoCheckIn.operacoes.map((o: any) => o.operation_type_label)
                : escolhido?.operacoes || [];
              const notasDoPainel = fichaDoCheckIn?.notas || [];

              /** Baixa a lista filtrada como planilha, para uso fora do sistema. */
              const exportarDados = () => {
                if (filtrados.length === 0) {
                  triggerNotification("Não há check-ins para exportar.", "info");
                  return;
                }
                const campo = (valor: any) =>
                  `"${String(valor ?? "").replace(/"/g, '""')}"`;
                const linhas = [
                  [
                    "Numero",
                    "Membro",
                    "Operacoes",
                    "Local",
                    "Bairro",
                    "Municipio",
                    "Latitude",
                    "Longitude",
                    "Arquivos",
                    "Data e hora",
                    "Status",
                  ].join(";"),
                  ...filtrados.map((r: any) =>
                    [
                      numeroDoRegistro(r.id),
                      r.name,
                      r.operacoes.join(" | "),
                      r.rua,
                      r.bairro,
                      r.municipio,
                      r.coordinates?.lat,
                      r.coordinates?.lng,
                      r.total,
                      new Date(r.createdAt).toLocaleString("pt-BR"),
                      r.concluido ? "Concluido" : "Em andamento",
                    ]
                      .map(campo)
                      .join(";"),
                  ),
                ].join("\n");

                // O BOM na frente faz o Excel abrir os acentos corretamente.
                const arquivo = new Blob(["﻿" + linhas], {
                  type: "text/csv;charset=utf-8;",
                });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(arquivo);
                link.download = `check-ins-${inspectedCandidate.name
                  .normalize("NFD")
                  .replace(/[̀-ͯ]/g, "")
                  .replace(/[^a-zA-Z0-9]+/g, "-")
                  .toLowerCase()}.csv`;
                link.click();
                URL.revokeObjectURL(link.href);
                triggerNotification(
                  `${filtrados.length} check-in(s) exportado(s).`,
                  "success",
                );
              };

              return (
                <div className="flex flex-col gap-5">
                  {/* CABEÇALHO DOS CHECK-INS */}
                  <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-2xl bg-[#F1F5FB] text-[#015FC9] flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-black text-[#0D233A] leading-tight flex items-center gap-2 flex-wrap">
                          Check-ins
                          <span className="px-2.5 py-1 rounded-full bg-[#EFF4FB] text-[#015FC9] text-[11px] font-black">
                            {registros.length}{" "}
                            {registros.length === 1 ? "registro" : "registros"}
                          </span>
                        </h3>
                        <p className="text-[12px] text-slate-400 font-semibold">
                          Acompanhe todos os registros realizados pela equipe
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => setLixeiraAberta((v) => !v)}
                        className={`h-11 px-4 border font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95 transition-all ${
                          lixeiraAberta
                            ? "bg-slate-800 border-slate-800 text-white"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                        Lixeira
                        {checkInsNaLixeira.length > 0 && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              lixeiraAberta
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {checkInsNaLixeira.length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={exportarDados}
                        className="h-11 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Download className="w-4 h-4 text-[#015FC9]" />
                        Exportar dados
                      </button>
                    </div>
                  </div>

                  {/* LIXEIRA: o que saiu das telas, guardado para voltar */}
                  {lixeiraAberta && (
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                      <div className="px-6 pt-5 pb-4">
                        <h4 className="text-[15px] font-black text-[#0D233A] leading-tight flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-slate-400" />
                          Lixeira
                        </h4>
                        <p className="text-[11px] text-slate-400 font-semibold">
                          Check-ins fora das telas e do mapa. Nada foi apagado.
                        </p>
                      </div>

                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {checkInsNaLixeira.length === 0 ? (
                          <p className="py-12 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest">
                            A lixeira está vazia
                          </p>
                        ) : (
                          checkInsNaLixeira
                            .slice()
                            .sort(
                              (a: any, b: any) =>
                                new Date(b.createdAt).getTime() -
                                new Date(a.createdAt).getTime(),
                            )
                            .map((registro: any) => (
                              <div
                                key={registro.id}
                                className="px-6 py-3.5 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <p className="font-black text-slate-700 text-[12.5px] truncate">
                                    {registro.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-semibold truncate">
                                    {[registro.rua, registro.bairro]
                                      .filter(Boolean)
                                      .join(", ") || "Sem endereço"}{" "}
                                    • {quandoFoi(registro.createdAt)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => restaurarCheckIn(registro)}
                                    className="h-8 px-3.5 border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 text-slate-600 text-[11px] font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
                                  >
                                    Restaurar
                                  </button>
                                  <button
                                    onClick={() => excluirCheckInDeVez(registro)}
                                    className="h-8 px-3.5 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 text-[11px] font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
                                  >
                                    Excluir de vez
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                    {/* LISTA DE CHECK-INS */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                      <div className="px-6 pt-5 pb-4">
                        <h4 className="text-[15px] font-black text-[#0D233A] leading-tight">
                          Todos os check-ins
                        </h4>
                        <p className="text-[11px] text-slate-400 font-semibold">
                          Registros enviados pela equipe de campo
                        </p>

                        <div className="mt-3.5 flex items-center gap-2.5 flex-wrap">
                          <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl h-10 px-3 flex-1 min-w-[190px] focus-within:ring-2 focus-within:ring-blue-500/20">
                            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <input
                              type="text"
                              value={buscaCheckIns}
                              onChange={(e) => {
                                setBuscaCheckIns(e.target.value);
                                setPaginaCheckIns(1);
                              }}
                              placeholder="Buscar membro, local ou operação..."
                              className="bg-transparent border-none w-full text-[11.5px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden"
                            />
                          </div>

                          <div className="relative">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                              value={periodoCheckIns}
                              onChange={(e) => {
                                setPeriodoCheckIns(e.target.value as any);
                                setPaginaCheckIns(1);
                              }}
                              className="appearance-none h-10 pl-8 pr-8 bg-white border border-slate-200 rounded-2xl text-[11.5px] font-bold text-slate-600 cursor-pointer focus:outline-hidden"
                            >
                              <option value="7">Últimos 7 dias</option>
                              <option value="30">Últimos 30 dias</option>
                              <option value="90">Últimos 90 dias</option>
                              <option value="tudo">Todo o período</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          <div className="relative">
                            <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                              value={operacaoCheckIns}
                              onChange={(e) => {
                                setOperacaoCheckIns(e.target.value);
                                setPaginaCheckIns(1);
                              }}
                              className="appearance-none h-10 pl-8 pr-8 bg-white border border-slate-200 rounded-2xl text-[11.5px] font-bold text-slate-600 cursor-pointer focus:outline-hidden max-w-[190px]"
                            >
                              <option value="todas">Todas as operações</option>
                              {tiposDoCliente.map((tipo) => (
                                <option key={tipo.id} value={tipo.label}>
                                  {tipo.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          <div className="relative">
                            <Compass className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                              value={statusCheckIns}
                              onChange={(e) => {
                                setStatusCheckIns(e.target.value as any);
                                setPaginaCheckIns(1);
                              }}
                              className="appearance-none h-10 pl-8 pr-8 bg-white border border-slate-200 rounded-2xl text-[11.5px] font-bold text-slate-600 cursor-pointer focus:outline-hidden"
                            >
                              <option value="todos">Todos os status</option>
                              <option value="concluido">Concluído</option>
                              <option value="andamento">Em andamento</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse text-left">
                          <thead>
                            <tr className="bg-[#FAFBFD] border-y border-slate-100">
                              {[
                                "Membro",
                                "Operação",
                                "Local",
                                "Evidências",
                                "Data e hora",
                                "Status",
                              ].map((coluna) => (
                                <th
                                  key={coluna}
                                  className="py-3 px-2.5 text-[9.5px] uppercase font-black text-[#8492A6] whitespace-nowrap"
                                >
                                  {coluna}
                                </th>
                              ))}
                              <th className="py-3 px-2.5 text-[9.5px] uppercase font-black text-[#8492A6] text-right">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {daPagina.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="py-14 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest"
                                >
                                  {registros.length === 0
                                    ? "Nenhum check-in registrado para este cliente"
                                    : "Nenhum check-in encontrado"}
                                </td>
                              </tr>
                            ) : (
                              daPagina.map((registro: any) => (
                                <tr
                                  key={registro.id}
                                  onClick={() => setCheckInAberto(registro.id)}
                                  className={`cursor-pointer transition-all ${
                                    escolhido?.id === registro.id
                                      ? "bg-[#EFF4FB]"
                                      : "hover:bg-slate-50/60"
                                  }`}
                                >
                                  <td className="py-3.5 px-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-[10px] font-black text-[#015FC9] uppercase">
                                        {registro.foto ? (
                                          <img
                                            src={registro.foto}
                                            alt={registro.name}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          (registro.name || "DT").substring(0, 2)
                                        )}
                                      </span>
                                      <span className="font-black text-slate-800 text-[12.5px] truncate max-w-[85px]">
                                        {registro.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-black truncate max-w-[130px]"
                                        style={{
                                          backgroundColor: `${corDaOperacao(registro.operacoes[0])}1A`,
                                          color: corDaOperacao(registro.operacoes[0]),
                                        }}
                                      >
                                        {registro.operacoes[0] || "Sem tipo"}
                                      </span>
                                      {registro.operacoes.length > 1 && (
                                        <span className="px-1.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10.5px] font-black">
                                          +{registro.operacoes.length - 1}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-2.5 text-[12px] font-semibold text-slate-500">
                                    <span className="block max-w-[110px] truncate">
                                      {[registro.rua, registro.bairro]
                                        .filter(Boolean)
                                        .join(", ") || "Sem endereço"}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-2.5">
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                      {registro.arquivos.imagens > 0 && (
                                        <Camera className="w-3.5 h-3.5" />
                                      )}
                                      {registro.arquivos.videos > 0 && (
                                        <Video className="w-3.5 h-3.5" />
                                      )}
                                      <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                                        {registro.total}{" "}
                                        {registro.total === 1
                                          ? "arquivo"
                                          : "arquivos"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-2.5 text-[12px] font-semibold text-slate-500 whitespace-nowrap">
                                    {quandoFoi(registro.createdAt)}
                                  </td>
                                  <td className="py-3.5 px-2.5">
                                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-slate-600 whitespace-nowrap">
                                      <span
                                        className={`w-2 h-2 rounded-full ${
                                          registro.concluido
                                            ? "bg-emerald-500"
                                            : "bg-[#015FC9]"
                                        }`}
                                      />
                                      {registro.concluido
                                        ? "Concluído"
                                        : "Em andamento"}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          alternarFavoritoCheckIn(registro);
                                        }}
                                        title={
                                          registro.favorite
                                            ? "Tirar dos favoritos"
                                            : "Favoritar: ganha estrela no mapa"
                                        }
                                        aria-label="Favoritar check-in"
                                        className={`w-8 h-8 border rounded-xl flex items-center justify-center cursor-pointer transition-all ${
                                          registro.favorite
                                            ? "border-amber-300 bg-amber-50 text-amber-500"
                                            : "border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-300"
                                        }`}
                                      >
                                        <Star
                                          className="w-4 h-4"
                                          fill={registro.favorite ? "currentColor" : "none"}
                                        />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCheckInAberto(registro.id);
                                        }}
                                        className="h-8 px-4 border border-slate-200 hover:border-[#015FC9] hover:text-[#015FC9] text-slate-600 text-[11px] font-bold rounded-xl cursor-pointer transition-all"
                                      >
                                        Ver
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          excluirCheckIn(registro);
                                        }}
                                        title="Mover para a lixeira"
                                        aria-label="Mover o check-in para a lixeira"
                                        className="w-8 h-8 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="px-6 py-4 flex items-center justify-between gap-3 border-t border-slate-100">
                        <p className="text-[11px] font-bold text-slate-400">
                          Mostrando {daPagina.length} de {filtrados.length}{" "}
                          check-ins
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={pagina <= 1}
                            onClick={() => setPaginaCheckIns(pagina - 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                            .slice(
                              Math.max(0, pagina - 3),
                              Math.max(0, pagina - 3) + 5,
                            )
                            .map((numero) => (
                              <button
                                key={numero}
                                onClick={() => setPaginaCheckIns(numero)}
                                className={`w-8 h-8 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                  numero === pagina
                                    ? "bg-[#015FC9] text-white"
                                    : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                {numero}
                              </button>
                            ))}
                          <button
                            disabled={pagina >= totalPaginas}
                            onClick={() => setPaginaCheckIns(pagina + 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* FICHA DO CHECK-IN ESCOLHIDO */}
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 flex flex-col gap-4">
                      {!escolhido ? (
                        <div className="py-16 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                          Escolha um check-in na lista
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[15px] font-black text-[#0D233A] leading-none">
                                Check-in #{numeroDoRegistro(escolhido.id)}
                              </h4>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-black ${
                                  escolhido.concluido
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-[#EFF4FB] text-[#015FC9]"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    escolhido.concluido
                                      ? "bg-emerald-500"
                                      : "bg-[#015FC9]"
                                  }`}
                                />
                                {escolhido.concluido
                                  ? "Concluído"
                                  : "Em andamento"}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {quandoFoi(escolhido.createdAt).replace(", ", " às ")}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 text-[10px] font-black text-[#015FC9] uppercase">
                              {escolhido.foto ? (
                                <img
                                  src={escolhido.foto}
                                  alt={escolhido.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (escolhido.name || "DT").substring(0, 2)
                              )}
                            </span>
                            <span className="text-[13px] font-black text-slate-800 truncate">
                              {escolhido.name}
                            </span>
                          </div>

                          {escolhido.coordinates?.lat && (
                            <div className="rounded-2xl overflow-hidden border border-slate-100">
                              <MiniMapa
                                lat={escolhido.coordinates.lat}
                                lng={escolhido.coordinates.lng}
                                height={140}
                              />
                            </div>
                          )}

                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-[#015FC9] shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-black text-slate-800 leading-tight">
                                {[escolhido.rua, escolhido.bairro]
                                  .filter(Boolean)
                                  .join(", ") || "Sem endereço"}
                              </p>
                              <p className="text-[11px] font-semibold text-slate-400">
                                {[escolhido.municipio, escolhido.estado]
                                  .filter(Boolean)
                                  .join(" - ")}
                                {escolhido.accuracy
                                  ? ` • Precisão ${Math.round(escolhido.accuracy)} m`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          {operacoesDoPainel.length > 0 && (
                            <div>
                              <p className="text-[11px] font-black text-slate-500 mb-1.5">
                                Operações
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {operacoesDoPainel.map((rotulo: string, i: number) => (
                                  <span
                                    key={`${rotulo}-${i}`}
                                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-black"
                                    style={{
                                      backgroundColor: `${corDaOperacao(rotulo)}1A`,
                                      color: corDaOperacao(rotulo),
                                    }}
                                  >
                                    {rotulo}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {midiasDoPainel.length > 0 && (
                            <div>
                              <p className="text-[11px] font-black text-slate-500 mb-1.5">
                                Evidências
                              </p>
                              <div className="grid grid-cols-4 gap-1.5">
                                {midiasDoPainel.slice(0, 4).map((midia: any) => (
                                  <a
                                    key={midia.id || midia.url}
                                    href={midia.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 block"
                                  >
                                    {midia.kind === "video" ? (
                                      <>
                                        <video
                                          src={midia.url}
                                          className="w-full h-full object-cover"
                                          muted
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white">
                                          <Video className="w-4 h-4" />
                                        </span>
                                      </>
                                    ) : (
                                      <img
                                        src={midia.url}
                                        alt="Evidência"
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {notasDoPainel.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <p className="text-[11px] font-black text-slate-500">
                                Observações
                              </p>
                              {notasDoPainel.map((nota: any) =>
                                nota.kind === "audio" ? (
                                  <audio
                                    key={nota.id}
                                    src={nota.url}
                                    controls
                                    className="w-full h-9"
                                  />
                                ) : (
                                  <p
                                    key={nota.id}
                                    className="text-[12px] font-semibold text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2"
                                  >
                                    {nota.content}
                                  </p>
                                ),
                              )}
                            </div>
                          )}

                          {carregandoFicha && (
                            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest text-center">
                              Carregando a ficha...
                            </p>
                          )}

                          <button
                            onClick={() =>
                              setCheckInCompleto({
                                registro: escolhido,
                                numero: numeroDoRegistro(escolhido.id),
                                operacoes: operacoesDoPainel,
                                midias: midiasDoPainel,
                                notas: notasDoPainel,
                              })
                            }
                            className="h-11 w-full bg-[#015FC9] hover:bg-blue-600 text-white text-xs font-bold rounded-2xl cursor-pointer active:scale-95"
                          >
                            Ver check-in completo
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
            );
          })()

        ) : (
          /* GRADE DE CLIENTES */
          <div className="flex flex-col flex-1 gap-6">
            {externalError && !isLinkModalOpen && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5">
                <p className="text-xs font-bold text-amber-800">
                  A lista para vínculo não pôde ser carregada
                </p>
                <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                  {externalError} Os clientes já cadastrados continuam aqui, e o
                  cadastro manual segue funcionando normalmente.
                </p>
              </div>
            )}

            {filteredClients.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm flex flex-col items-center justify-center min-h-[300px] gap-4">
                <Building2 className="w-12 h-12 text-slate-300" />
                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                  {isLoadingClients
                    ? "Carregando clientes..."
                    : candidates.length === 0
                      ? "Nenhum cliente cadastrado ainda"
                      : "Nenhum cliente encontrado para esta busca"}
                </span>
                {!isLoadingClients && candidates.length === 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setEscolhaNovoCliente(true)}
                      className="px-5 h-11 bg-[#015FC9] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Novo Cliente</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredClients.map((client) => {
                  const teamCount = supporters.filter(
                    (s: any) =>
                      s.candidate_id === client.id || s.candidateId === client.id,
                  ).length;
                  const checkInCount = checkIns.filter(
                    (c: any) =>
                      c.candidateId === client.id || c.candidate_id === client.id,
                  ).length;
                  const ativo = client.status_active !== false;

                  return (
                    <div
                      key={client.id}
                      className="bg-white border border-slate-200 rounded-3xl shadow-xs hover:shadow-lg transition-all overflow-hidden flex flex-col group"
                    >
                      {/* CAPA ESCURA COM A FOTO DO CLIENTE */}
                      <div className="relative h-[92px] bg-[#0D233A] overflow-hidden">
                        {/* A paisagem fica de fundo, esmaecida: é enfeite, não
                            informação — o que precisa ser lido é o nome. */}
                        <img
                          src={CLIENT_CARD_COVER}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-linear-to-r from-[#0D233A] via-[#0D233A]/70 to-[#0D233A]/20" />

                        <span
                          className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            ativo
                              ? "bg-[#0D233A]/70 text-emerald-300 border border-emerald-400/30"
                              : "bg-[#0D233A]/70 text-slate-300 border border-slate-400/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ativo ? "bg-emerald-400" : "bg-slate-400"
                            }`}
                          />
                          {ativo ? "Cliente ativo" : "Inativo"}
                        </span>

                        <div className="relative h-full flex items-center gap-3.5 px-5">
                          <img
                            src={
                              client.image ||
                              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                            }
                            alt={client.name}
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-white/80 shadow-lg bg-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4
                              className="font-extrabold text-white text-[17px] tracking-tight leading-tight truncate"
                              title={client.name}
                            >
                              {client.name}
                            </h4>
                            <p className="text-[11px] text-slate-300 font-semibold flex items-center gap-1 truncate mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {candidateLocationText(client) || "Sem localização"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* NÚMEROS DO CLIENTE */}
                      <div className="grid grid-cols-2 gap-3.5 p-4">
                        <div className="bg-[#F6F9FC] border border-slate-100 rounded-2xl p-3.5 flex items-center gap-3">
                          <span className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                              Equipe
                            </p>
                            <p className="text-xl font-black text-[#0D233A] leading-none mt-0.5">
                              {teamCount}
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold truncate">
                              membros vinculados
                            </p>
                          </div>
                        </div>

                        <div className="bg-[#F6F9FC] border border-slate-100 rounded-2xl p-3.5 flex items-center gap-3">
                          <span className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-purple-600 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                              Check-ins
                            </p>
                            <p className="text-xl font-black text-[#0D233A] leading-none mt-0.5">
                              {checkInCount}
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold truncate">
                              registros realizados
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* AÇÕES */}
                      <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(client)}
                            className="px-2.5 h-9 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                            title="Editar cliente"
                          >
                            <Edit2 className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteCandidate(client.id, client.name)
                            }
                            className="px-2.5 h-9 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                            title="Apagar cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </button>
                        </div>

                        <button
                          onClick={() => setInspectedCandidate(client)}
                          className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Gerenciar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BARRA DE TOTALIZAÇÃO DO FOOTER */}
            <div className="py-4 px-6 border border-slate-200 rounded-3xl bg-[#FAFBFD] flex justify-between items-center shadow-3xs mt-2">
              <span className="text-[#8492A6] text-xs font-bold font-sans">
                Mostrando {filteredClients.length} de {candidates.length}{" "}
                cliente(s)
              </span>
              {/* Uma página só: a lista inteira cabe aqui, e a marca serve de
                  referência de onde a pessoa está. */}
              <div className="flex items-center gap-1.5 select-none">
                <span className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-300 flex items-center justify-center">
                  <ChevronLeft className="w-4 h-4" />
                </span>
                <span className="w-8 h-8 rounded-lg bg-[#015FC9] text-white text-xs font-black flex items-center justify-center">
                  1
                </span>
                <span className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-300 flex items-center justify-center">
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* MODAIS DA EQUIPE DO CLIENTE */}
        {teamModal && inspectedCandidate && (
          <>
            {teamModal === "vincular" && (
              <VincularMembroModal
                client={inspectedCandidate}
                allMembers={supporters}
                notify={triggerNotification}
                onClose={() => setTeamModal(null)}
                onChanged={() => reloadTeamOfClient(inspectedCandidate.id)}
              />
            )}
            {teamModal === "qrcode" && (
              <QrConviteModal
                client={inspectedCandidate}
                notify={triggerNotification}
                onClose={() => {
                  setTeamModal(null);
                  reloadTeamOfClient(inspectedCandidate.id);
                }}
                onChanged={() => reloadTeamOfClient(inspectedCandidate.id)}
              />
            )}
            {teamModal === "manual" && (
              <CadastroManualModal
                client={inspectedCandidate}
                fields={teamFields}
                notify={triggerNotification}
                onClose={() => setTeamModal(null)}
                onChanged={() => reloadTeamOfClient(inspectedCandidate.id)}
              />
            )}
            {teamModal === "campos" && (
              <CamposColetaModal
                client={inspectedCandidate}
                fields={teamFields}
                notify={triggerNotification}
                onClose={() => setTeamModal(null)}
                onChanged={() => reloadTeamOfClient(inspectedCandidate.id)}
              />
            )}
          </>
        )}

        {/* ESCOLHA: CLIENTE QUE JÁ EXISTE OU CLIENTE NOVO */}
        {escolhaNovoCliente && (
          <div className="fixed inset-0 bg-[#0c1322]/40 backdrop-blur-xs flex items-center justify-center z-[11000] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-3xl overflow-hidden border border-slate-100 font-sans"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Adicionar cliente
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-[#8492A6] font-bold mt-0.5">
                    De onde vem este cliente?
                  </p>
                </div>
                <button
                  onClick={() => setEscolhaNovoCliente(false)}
                  aria-label="Fechar"
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <button
                  onClick={() => {
                    setEscolhaNovoCliente(false);
                    setLinkSearch("");
                    setIsLinkModalOpen(true);
                  }}
                  className="w-full p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center gap-3 text-left transition-all cursor-pointer active:scale-[0.99]"
                >
                  <span className="w-10 h-10 rounded-2xl bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Link2 className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm font-black text-emerald-800">
                      Vincular um que já existe
                    </strong>
                    <span className="block text-[11px] text-emerald-700/70 font-semibold leading-snug mt-0.5">
                      Traz para a sua base um cliente já cadastrado na base
                      externa, com os dados que ele já tem.
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    setEscolhaNovoCliente(false);
                    handleOpenCreateModal();
                  }}
                  className="w-full p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl flex items-center gap-3 text-left transition-all cursor-pointer active:scale-[0.99]"
                >
                  <span className="w-10 h-10 rounded-2xl bg-white text-[#015FC9] border border-blue-200 flex items-center justify-center shrink-0">
                    <PlusCircle className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm font-black text-blue-900">
                      Criar um cliente novo
                    </strong>
                    <span className="block text-[11px] text-blue-800/70 font-semibold leading-snug mt-0.5">
                      Cadastra do zero, preenchendo os dados à mão.
                    </span>
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: VINCULAR CLIENTE */}
        {isLinkModalOpen && (
          <div className="fixed inset-0 bg-[#0c1322]/40 backdrop-blur-xs flex items-center justify-center z-[11000] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-3xl overflow-hidden border border-slate-100 font-sans flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Vincular Cliente
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-[#8492A6] font-bold mt-0.5">
                    Escolha quem virá para a sua base de clientes
                  </p>
                </div>
                <button
                  onClick={() => setIsLinkModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={linkWithTeam}
                    onChange={(e) => setLinkWithTeam(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                  <span>
                    <span className="block text-xs font-black text-slate-700">
                      Trazer também a equipe deste cliente
                    </span>
                    <span className="block text-[11px] text-slate-400 font-semibold leading-snug">
                      Desmarcado, vem só a ficha do cliente. Você pode ligar a
                      equipe depois, a qualquer momento, dentro do cliente.
                    </span>
                  </span>
                </label>

                <div className="relative bg-slate-50 border border-slate-200 rounded-2xl flex items-center px-4 h-11 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <Search className="w-4 h-4 text-slate-400 mr-2.5" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar por nome, cargo ou cidade..."
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    className="bg-transparent border-none w-full text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
                  />
                  {linkSearch && (
                    <X
                      className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer ml-1"
                      onClick={() => setLinkSearch("")}
                    />
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2.5">
                {isLoadingExternal ? (
                  <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                    Carregando lista...
                  </div>
                ) : externalError ? (
                  <div className="py-10 px-5 text-center bg-amber-50 border border-amber-200 rounded-2xl">
                    <p className="text-xs font-bold text-amber-800">
                      Não foi possível carregar a lista
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                      {externalError}
                    </p>
                  </div>
                ) : (
                  (() => {
                    const lq = linkSearch.trim().toLowerCase();
                    const disponiveis = externalCandidates.filter((ficha) => {
                      if (!lq) return true;
                      return (
                        (ficha.name || "").toLowerCase().includes(lq) ||
                        (ficha.office || "").toLowerCase().includes(lq) ||
                        candidateLocationText(ficha)
                          .toLowerCase()
                          .includes(lq) ||
                        (ficha.partyInitials || "").toLowerCase().includes(lq)
                      );
                    });

                    if (disponiveis.length === 0) {
                      return (
                        <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                          Nada encontrado para esta busca
                        </div>
                      );
                    }

                    return disponiveis.map((ficha) => {
                      const jaCliente = candidates.some(
                        (c) =>
                          c.id === ficha.id ||
                          (c.externalId && c.externalId === ficha.id),
                      );

                      return (
                        <div
                          key={ficha.id}
                          className="border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                        >
                          <img
                            src={
                              ficha.image ||
                              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                            }
                            alt={ficha.name}
                            className="w-11 h-11 rounded-xl object-cover border border-slate-100 bg-slate-50 shrink-0"
                            referrerPolicy="no-referrer"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-slate-800 text-sm truncate">
                                {ficha.name}
                              </h4>
                              {ficha.partyInitials && (
                                <span className="inline-flex bg-slate-100 text-slate-600 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                                  {ficha.partyInitials}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-bold truncate">
                              {ficha.office || "Sem cargo"}
                              {candidateLocationText(ficha)
                                ? ` · ${candidateLocationText(ficha)}`
                                : ""}
                            </p>
                          </div>

                          <button
                            disabled={jaCliente || linkingId === ficha.id}
                            onClick={() => handleLinkClient(ficha)}
                            className={`px-4 h-9 text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
                              jaCliente
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : linkingId === ficha.id
                                  ? "bg-emerald-100 text-emerald-700 cursor-wait"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:scale-[1.02] active:scale-95"
                            }`}
                          >
                            {jaCliente ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Já é cliente</span>
                              </>
                            ) : linkingId === ficha.id ? (
                              <span>Salvando...</span>
                            ) : (
                              <>
                                <Link2 className="w-3.5 h-3.5" />
                                <span>Vincular</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    });
                  })()
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 font-bold">
                  A ficha completa é copiada para o seu banco de dados.
                </span>
                <button
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-5 h-10 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: CREATE AND EDIT CANDIDATE */}
        {isCandidateModalOpen && (
          <div className="fixed inset-0 bg-[#0c1322]/40 backdrop-blur-xs flex items-center justify-center z-[11000] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-3xl overflow-hidden border border-slate-100 font-sans flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    {candidateEditing
                      ? "Editar Cliente"
                      : "Cadastrar Novo Cliente"}
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-[#8492A6] font-bold mt-0.5">
                    {candidateEditing
                      ? "Atualize as informações do cliente"
                      : "Cadastre um cliente manualmente"}
                  </p>
                </div>
                <button
                  onClick={() => setIsCandidateModalOpen(false)}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveCandidateSubmit}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {/* Nome */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={candName}
                    onChange={(e) => setCandName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#015FC9]"
                  />
                </div>

                {/* Cargo */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    required
                    value={candOffice}
                    onChange={(e) => setCandOffice(e.target.value)}
                    placeholder="Ex: Prefeito, Vereador, Deputado Federal"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#015FC9]"
                  />
                </div>

                {/* Estado */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Estado de Atuação
                  </label>
                  <input
                    type="text"
                    required
                    value={candCity}
                    onChange={(e) => setCandCity(e.target.value)}
                    placeholder="Ex: Alagoas"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#015FC9]"
                  />
                </div>

                {/* Telefone / WhatsApp */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Telefone / WhatsApp (Apenas números)
                  </label>
                  <input
                    type="tel"
                    value={candPhone}
                    onChange={(e) =>
                      setCandPhone(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Ex: 82999999999"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#015FC9]"
                  />
                </div>

                {/* Instagram */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Instagram (@handle)
                  </label>
                  <input
                    type="text"
                    value={candInstagram}
                    onChange={(e) =>
                      setCandInstagram(
                        e.target.value
                          .toLowerCase()
                          .replace(/\s/g, "")
                          .replace(/^@/, ""),
                      )
                    }
                    placeholder="Ex: joao.neto80"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#015FC9]"
                  />
                </div>

                {/* URL da Imagem */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    URL da Foto de Perfil (Opcional)
                  </label>
                  <input
                    type="text"
                    value={candImage}
                    onChange={(e) => setCandImage(e.target.value)}
                    placeholder="Deixe vazio para usar avatar padrão"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#015FC9]"
                  />

                  {/* Preset Quick Images block */}
                  <div className="pt-2">
                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1.5">
                      Escolha Rápida:
                    </p>
                    <div className="flex gap-2.5">
                      {[
                        {
                          title: "Homem",
                          url: "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=150",
                        },
                        {
                          title: "Mulher",
                          url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
                        },
                        {
                          title: "Executivo",
                          url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
                        },
                        {
                          title: "Executiva",
                          url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
                        },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCandImage(preset.url)}
                          className="px-2.5 py-1 text-[9px] font-extrabold uppercase bg-slate-100 hover:bg-[#015FC9] hover:text-white rounded-md transition-all cursor-pointer border border-[#E1E8ED]"
                        >
                          {preset.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => setIsCandidateModalOpen(false)}
                    className="px-5 py-3 border border-slate-200 text-[#5A6E85] text-xs uppercase font-extrabold tracking-wider rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#015FC9] hover:bg-blue-600 text-white text-xs uppercase font-extrabold tracking-wider rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer"
                  >
                    Salvar Cliente
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL: CREATE AND EDIT PARTY */}

        {/* MODAL: CANDIDATE DETAIL VIEW */}
        {candViewDetail && (
          <div className="fixed inset-0 bg-[#0c1322]/40 backdrop-blur-xs flex items-center justify-center z-[11100] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-3xl overflow-hidden border border-slate-100 font-sans p-6"
            >
              <div className="flex flex-col items-center text-center">
                <img
                  src={
                    candViewDetail.image ||
                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                  }
                  alt={candViewDetail.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-sm mb-4"
                  referrerPolicy="no-referrer"
                />

                <span className="inline-flex px-3 py-1 text-[10px] font-black tracking-widest uppercase bg-slate-100 border border-slate-200 rounded-full text-slate-500 mb-1">
                  {candViewDetail.office || "Sem cargo"}
                </span>

                <h3 className="text-xl font-extrabold text-[#0D233A]">
                  {candViewDetail.name}
                </h3>
                <p className="text-slate-500 text-xs font-semibold flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{candViewDetail.city}</span>
                </p>

                {/* Sub info */}
                <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 my-5 space-y-2.5 text-left text-xs font-bold text-slate-700">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-[#8492A6]">WhatsApp:</span>
                    <span className="text-[#0D233A]">
                      {candViewDetail.phone || "Privado/Não informado"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-[#8492A6]">Instagram:</span>
                    <span className="text-[#0D233A]">
                      @{candViewDetail.instagram_handle || "Não cadastrado"}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-[#8492A6]">Status Territorial:</span>
                    <span
                      className={
                        candViewDetail.status_active !== false
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      {candViewDetail.status_active !== false
                        ? "🟢 ATIVO"
                        : "⚫ INATIVO"}
                    </span>
                  </div>
                </div>

                {/* Actions inside Detail Card */}
                <div className="grid grid-cols-2 gap-3 w-full font-sans">
                  {candViewDetail.phone && (
                    <a
                      href={`https://wa.me/55${candViewDetail.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl text-center shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Falar Watts
                    </a>
                  )}

                  {candViewDetail.instagram_handle && (
                    <a
                      href={`https://instagram.com/${candViewDetail.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-[#E1306C] hover:bg-[#D6295D] text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl text-center shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      Instagram
                    </a>
                  )}
                </div>

                {/* Ir para o mapa do cliente */}
                <button
                  onClick={() => {
                    setSelectedCandidateFilter(candViewDetail.id);
                    setAdminTab("map");
                    setCandViewDetail(null);
                    triggerNotification(
                      `Visualizando mapa exclusivo de: ${candViewDetail.name}`,
                      "success",
                    );
                  }}
                  className="mt-3 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-505 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl text-center shadow-lg hover:shadow-xl hover:bg-indigo-500 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Map className="w-4 h-4" />
                  Ir para o Mapa do Cliente
                </button>

                <button
                  onClick={() => setCandViewDetail(null)}
                  className="mt-5 text-xs text-[#8492A6] font-extrabold tracking-wider uppercase hover:text-slate-800 transition-all cursor-pointer"
                >
                  Voltar para lista
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* Confirmação no meio da tela, com a cara do sistema */}
      <ConfirmDialog request={confirmRequest} onClose={closeConfirmation} />

      {/* Ficha de aparelhos de um integrante — visível só aqui, na área do
          administrador. Nenhuma tela de integrante mostra estes dados. */}
      <DispositivosMembroModal
        membro={membroDosAparelhos}
        onClose={() => setMembroDosAparelhos(null)}
        notify={triggerNotification}
        askConfirmation={askConfirmation}
      />


      {/* Toast Notification HUD */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] max-w-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border"
            style={{
              backgroundColor:
                notification.type === "success"
                  ? "#10b981"
                  : notification.type === "error"
                    ? "#ef4444"
                    : "#1e293b",
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            {notification.type === "success" && (
              <Check className="w-5 h-5 flex-shrink-0" />
            )}
            {notification.type === "error" && (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            {notification.type === "info" && (
              <Sparkles className="w-5 h-5 flex-shrink-0 animate-bounce" />
            )}
            <span className="text-sm font-medium leading-tight">
              {notification.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão de Voltar (canto superior esquerdo) */}
      {adminUser && adminTab === "map" && (
        <div className="absolute top-4 left-4 z-[1001] font-sans">
          <button
            onClick={() => {
              setAdminTab("candidates");
              triggerNotification("Retornando para os clientes!", "info");
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-2xl shadow-xl border border-rose-700/40 transition-all cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95"
            title="Voltar"
          >
            <ChevronLeft className="w-4 h-4 text-white stroke-[3]" />
            <span>Voltar</span>
          </button>
        </div>
      )}

      {/* RÉGUA: controle pequeno no canto, só o necessário para medir */}
      {reguaLigada && (
        <div className="absolute top-4 right-4 z-[1002] font-sans w-[190px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/70 p-3 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
              Régua
            </span>
            <label
              className="w-7 h-7 rounded-lg border border-slate-200 shadow-2xs cursor-pointer shrink-0 relative overflow-hidden"
              style={{ backgroundColor: corRegua }}
              title="Cor da medição"
            >
              <input
                type="color"
                value={corRegua}
                onChange={(e) => setCorRegua(e.target.value)}
                aria-label="Cor da medição"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          </div>

          <p className="text-xl font-black text-[#0D233A] leading-none mt-1.5">
            {pontosRegua.length < 2 ? "—" : formatarMedida(totalRegua)}
          </p>
          <p className="text-[10px] text-slate-400 font-semibold leading-snug mt-1">
            {contarPontosRegua()}
          </p>

          <div className="flex gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={() => setPontosRegua((p) => p.slice(0, -1))}
              disabled={pontosRegua.length === 0}
              title="Desfazer o último ponto"
              className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
              Voltar
            </button>
            <button
              type="button"
              onClick={limparReguaEmAndamento}
              disabled={pontosRegua.length === 0}
              title="Limpar a medição"
              className="flex-1 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-600 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Limpar
            </button>
          </div>
        </div>
      )}

      {/*
        TRILHO DE FERRAMENTAS
        A lista é declarada aqui e o desenho fica no componente: ordem,
        grupo, cor e estado de cada ferramenta moram junto com o estado do
        mapa, que é quem sabe o que está ligado.
      */}
      <FerramentasDoMapa
        grupos={GRUPOS_DE_FERRAMENTAS}
        ferramentas={[
          {
            id: "pin",
            grupo: "marcar",
            rotulo: "Inserir pin",
            ajuda: "Marcar um ponto no mapa",
            cor: "#2563EB",
            icone: <MapPin className="w-4 h-4 fill-current" />,
            aoClicar: triggerCreatePin,
          },
          {
            id: "raio",
            grupo: "marcar",
            rotulo: "Marcar raio",
            ajuda: "Desenhar uma área de trabalho com raio",
            cor: "#4F46E5",
            icone: <Circle className="w-4 h-4 stroke-[2.5]" />,
            aoClicar: triggerCreateArea,
          },
          {
            /**
             * A porta da lista.
             *
             * Missão sem lugar no mapa não tem marcador para clicar, e sem
             * este botão ela ficava sem nenhum caminho até o editor. Aqui
             * dentro está tudo que já foi marcado: pontos, áreas e check-ins.
             */
            id: "missoes",
            grupo: "marcar",
            rotulo: "Missões marcadas",
            ajuda: "Ver, editar e excluir o que já está marcado",
            cor: "#0D9488",
            ativa: isSidebarOpen,
            contador: filteredPins.length + filteredAreas.length,
            icone: <ClipboardList className="w-4 h-4" />,
            aoClicar: (e) => {
              e.stopPropagation();
              setIsSidebarOpen((aberto) => !aberto);
            },
          },
          {
            id: "regua",
            grupo: "marcar",
            rotulo: "Régua",
            ajuda: reguaLigada
              ? "Desligar a régua"
              : "Medir distância entre pontos",
            cor: "#F58220",
            ativa: reguaLigada,
            icone: <Ruler className="w-4 h-4" />,
            aoClicar: () => {
              const ligando = !reguaLigada;
              setReguaLigada(ligando);
              // Nada de painel lateral: a régua é para marcar no mapa, e o
              // pouco que ela precisa (cor, distância, desfazer) fica num
              // controle pequeno no canto, sem tapar o mapa.
              if (!ligando) limparReguaEmAndamento();
            },
          },
          // Escolas só entram no trilho onde há escolas cadastradas: item
          // que não faz nada é item que ensina a desconfiar do menu.
          ...(escolas.length > 0
            ? [
                {
                  id: "escolas",
                  grupo: "camadas",
                  rotulo: "Escolas",
                  ajuda: escolasLigadas
                    ? "Esconder as escolas do mapa"
                    : `Mostrar as ${escolas.length} escolas de ${municipioDoMapa}`,
                  cor: "#0284C7",
                  ativa: escolasLigadas,
                  icone: <GraduationCap className="w-4 h-4" />,
                  aoClicar: () => {
                    setEscolasLigadas((ligado) => {
                      if (ligado) setEscolaAberta(null);
                      return !ligado;
                    });
                  },
                },
              ]
            : []),
          {
            id: "territorio",
            grupo: "camadas",
            rotulo: "Inteligência territorial",
            ajuda: "População, bairros e dados do Censo",
            cor: "#0D9488",
            ativa: territorioAberto || !!circuloAnalisado,
            icone: <Layers3 className="w-4 h-4" />,
            aoClicar: (e) => {
              e.stopPropagation();
              setTerritorioAberto((v) => !v);
              setPesquisaLojasAberta(false);
              setIsFilterDropdownOpen(false);
            },
          },
          {
            id: "estabelecimentos",
            grupo: "camadas",
            rotulo: "Estabelecimentos",
            ajuda: "Pesquisar o que existe no terreno em volta",
            cor: "#7C3AED",
            ativa: pesquisaLojasAberta || estabelecimentos.length > 0,
            contador: estabelecimentos.length,
            icone: <Store className="w-4 h-4" />,
            aoClicar: (e) => {
              e.stopPropagation();
              setPesquisaLojasAberta((v) => !v);
              setTerritorioAberto(false);
              setIsFilterDropdownOpen(false);
            },
          },
          {
            id: "filtro-checkins",
            grupo: "filtrar",
            rotulo: "Check-ins",
            ajuda: "Abrir a sala de situação: ritmo, bairros, equipe e missões",
            cor: "#015FC9",
            ativa: salaDeSituacaoAberta || filtrosDeCheckInLigados > 0,
            contador: filtrosDeCheckInLigados,
            icone: <Users className="w-4 h-4" />,
            aoClicar: (e) => {
              e.stopPropagation();
              if (salaDeSituacaoAberta) {
                fecharSalaDeSituacao();
                return;
              }
              setSalaDeSituacaoAberta(true);
              // Dois painéis de meia tela não deixam mapa nenhum entre eles.
              closeMindMap();
              setTerritorioAberto(false);
              setPesquisaLojasAberta(false);
              setIsFilterDropdownOpen(false);
            },
          },
          {
            id: "camadas",
            grupo: "filtrar",
            rotulo: "Visualização",
            ajuda: "Escolher o que aparece no mapa",
            cor: "#F58220",
            ativa: isFilterDropdownOpen || mapFilter !== "all",
            icone: <Layers className="w-4 h-4" />,
            aoClicar: (e) => {
              e.stopPropagation();
              setIsFilterDropdownOpen(!isFilterDropdownOpen);
            },
          },
          {
            id: "laser",
            grupo: "apresentar",
            rotulo: "Laser",
            ajuda: laserLigado
              ? "Laser ligado (L ou Esc para desligar)"
              : "Apontar durante a apresentação",
            atalho: "L",
            cor: "#E11D48",
            ativa: laserLigado,
            icone: <Crosshair className="w-4 h-4" />,
            aoClicar: (e) => {
              e.stopPropagation();
              setLaserLigado((ligado) => !ligado);
            },
          },
          {
            id: "mapa-mental",
            grupo: "apresentar",
            rotulo: "Mapa mental",
            ajuda: "Abrir o mapa mental da operação",
            cor: "#C026D3",
            ativa: isMindMapOpen,
            icone: <Brain className="w-4 h-4" />,
            aoClicar: () => {
              if (isMindMapOpen) {
                closeMindMap();
                return;
              }
              setIsMindMapOpen(true);
              fecharSalaDeSituacao();
              setIsFilterDropdownOpen(false);
            },
          },
          {
            id: "compartilhar",
            grupo: "apresentar",
            rotulo: "Compartilhar link",
            ajuda: "Gerar o link de check-in da equipe",
            cor: "#059669",
            icone: <Share2 className="w-4 h-4" />,
            aoClicar: () => setIsShareModalOpen(true),
          },
        ]}
      >
        {/* Filtro de camadas: encosta na borda do trilho, aberto ou fechado */}
        <AnimatePresence>
          {isFilterDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, x: -15, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -15, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="ml-3 bg-[#DBE2E9]/98 backdrop-blur-md border border-slate-300/80 rounded-3xl p-3 shadow-2xl shadow-slate-900/20 flex flex-col gap-1 w-60 min-w-[220px] pointer-events-auto text-left z-[2000]"
            >
              <div className="px-2.5 py-1.5 border-b border-slate-400/40 mb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-sans">
                  Exibir no Mapa
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterDropdownOpen(false);
                  }}
                  className="text-slate-500 hover:text-slate-800 p-0.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {/* Option 1: Ver Tudo */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMapFilter("all");
                    setIsFilterDropdownOpen(false);
                    triggerNotification(
                      "Exibindo todo o conteúdo no mapa.",
                      "info",
                    );
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    mapFilter === "all"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Ver Tudo</span>
                  </div>
                  {mapFilter === "all" && <Check className="w-3.5 h-3.5" />}
                </button>

                {/* Option 2: Check-ins */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMapFilter("checkins");
                    setIsFilterDropdownOpen(false);
                    triggerNotification(
                      "Filtrado para exibir apenas Check-ins.",
                      "info",
                    );
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    mapFilter === "checkins"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Check-ins</span>
                  </div>
                  {mapFilter === "checkins" && (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Option 3: Favoritos */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMapFilter("favoritos");
                    setIsFilterDropdownOpen(false);
                    triggerNotification(
                      "Filtrado para exibir apenas os check-ins favoritos.",
                      "info",
                    );
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    mapFilter === "favoritos"
                      ? "bg-amber-500 text-white shadow-md"
                      : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5" />
                    <span>Favoritos</span>
                  </div>
                  {mapFilter === "favoritos" && <Check className="w-3.5 h-3.5" />}
                </button>

                {/* Option 4: Marcações */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMapFilter("markers");
                    setIsFilterDropdownOpen(false);
                    triggerNotification(
                      "Filtrado para exibir apenas Marcações.",
                      "info",
                    );
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    mapFilter === "markers"
                      ? "bg-[#F58220] text-white shadow-md"
                      : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-sans">
                    <Map className="w-3.5 h-3.5" />
                    <span>Marcações</span>
                  </div>
                  {mapFilter === "markers" && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </FerramentasDoMapa>

      {/* PASSO DO NOME: primeiro a escolha, os campos só para quem quis */}
      {nomeandoRaio && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 text-slate-800">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="font-extrabold text-indigo-950 text-base leading-tight">
                  {nomeandoRaio === "pergunta"
                    ? "Quer dar um nome a essa área?"
                    : "Nome da área"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {nomeandoRaio === "pergunta"
                    ? "Não precisa: dá para salvar assim mesmo e nomear depois."
                    : "Título e descrição são opcionais — pode preencher só o título."}
                </p>
              </div>
              <span className="shrink-0 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-black text-indigo-700 whitespace-nowrap">
                {Number(areaRadius) || 0} m de raio
              </span>
            </div>

            {nomeandoRaio === "pergunta" ? (
              <>
                <div className="flex flex-col gap-2 pt-5">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setNomeandoRaio("campos")}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99]"
                  >
                    Sim, quero nomear
                  </button>
                  <button
                    type="button"
                    onClick={concluirRaio}
                    className="w-full py-3 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 text-slate-600 text-[11px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99]"
                  >
                    Não, salvar assim
                  </button>
                  <button
                    type="button"
                    onClick={cancelarRaio}
                    className="w-full py-3 bg-transparent border border-transparent hover:border-rose-200 hover:bg-rose-50 text-rose-500 text-[11px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all"
                  >
                    Cancelar ação
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3.5 pt-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                      Título{" "}
                      <span className="normal-case tracking-normal font-semibold text-slate-300">
                        (opcional)
                      </span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={areaTitle}
                      onChange={(e) => setAreaTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          concluirRaio();
                        }
                      }}
                      maxLength={80}
                      placeholder="Como essa área é chamada"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                      Descrição{" "}
                      <span className="normal-case tracking-normal font-semibold text-slate-300">
                        (opcional)
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={areaDescription}
                      onChange={(e) => setAreaDescription(e.target.value)}
                      maxLength={400}
                      placeholder="O que precisa ser feito aqui"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs resize-none"
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-3.5">
                    <EditorDeMaterial
                      itens={materialMissao}
                      onMudar={setMaterialMissao}
                      notificar={triggerNotification}
                      ligado={isDatabaseConfigured}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={cancelarRaio}
                    className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 cursor-pointer transition-all"
                  >
                    Cancelar ação
                  </button>
                  <button
                    type="button"
                    onClick={concluirRaio}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99]"
                  >
                    Salvar área
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Ponteiro laser: segue ligado quando o painel abre o mapa */}
      <LaserPointer ativo={laserLigado} />

      {/* LEGENDA DA ESCALA — cor sem régua é enfeite, não informação */}
      {recortesTerritoriais.length > 0 && escalaTerritorial.length > 0 && (
        <div className="absolute bottom-6 right-4 z-[1100] bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/80 px-3.5 py-3 font-sans pointer-events-none">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
            {recortesTerritoriais[0]?.tipo === "setor" ? "Setores" : "Bairros"}
          </p>
          <div className="flex items-center gap-0.5 mt-1.5">
            {escalaTerritorial.map((faixa) => (
              <span
                key={faixa.cor}
                className="w-7 h-3 first:rounded-l-sm last:rounded-r-sm"
                style={{ backgroundColor: faixa.cor }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-1 text-[9.5px] font-bold text-slate-500">
            <span>menos</span>
            <span>
              {escalaTerritorial[escalaTerritorial.length - 1]?.corte.toLocaleString(
                "pt-BR",
              )}
            </span>
          </div>
          {/* Sem dado tem cor própria: cinza hachurado nunca é "pouca gente". */}
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
            <span className="w-3 h-3 rounded-sm bg-slate-300 border border-dashed border-slate-400" />
            <span className="text-[9.5px] font-bold text-slate-500">
              sem dado divulgado
            </span>
          </div>
        </div>
      )}

      {/* INTELIGÊNCIA TERRITORIAL */}
      <InteligenciaTerritorial
        aberto={territorioAberto}
        onFechar={() => setTerritorioAberto(false)}
        /*
         * A UF sai de `candidateLocation`, que é a mesma que o resto do mapa
         * usa. Muito cadastro tem só a cidade ("Maceió", "Parauapebas"), e é
         * esse estado resolvido que já descobriu a UF — ler o campo cru aqui
         * daria vazio justamente nos clientes mais comuns.
         */
        ufDoCliente={
          candidateLocation?.uf ||
          parseCandidateLocation(
            candidateLocationText(
              candidates.find((c) => c.id === selectedCandidateFilter),
            ),
          )?.uf ||
          null
        }
        cidadeDoCliente={
          candidateLocation?.cityName ||
          candidates.find((c) => c.id === selectedCandidateFilter)?.city ||
          null
        }
        centroDoMapa={() => lerVistaDoMapaRef.current?.() || null}
        onCirculoAnalisado={setCirculoAnalisado}
        onRecortes={receberRecortes}
        recorteEmFoco={recorteEmFoco}
        onRecorteEmFoco={setRecorteEmFoco}
      />

      {/* PESQUISA DE ESTABELECIMENTOS */}
      <PesquisaEstabelecimentos
        aberto={pesquisaLojasAberta}
        onFechar={() => setPesquisaLojasAberta(false)}
        centroDoMapa={() => lerVistaDoMapaRef.current?.() || null}
        onResultados={(lugares) => {
          setEstabelecimentos(lugares);
          setLojaEmFoco(null);
        }}
        onEscolher={(lugar) => {
          setLojaEmFoco(lugar.id);
          setLojaAberta(lugar);
        }}
        emFoco={lojaEmFoco}
        onDestacar={setLojaDestacada}
      />

      {/* FICHA DO ESTABELECIMENTO */}
      <FichaEstabelecimento
        lugar={lojaAberta}
        onFechar={() => setLojaAberta(null)}
        onVirarPonto={virarPontoEstrategico}
      />

      {/* Top Banner Guide for Coordinate Picking */}
      {clickToPickCoords && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2001] bg-[#0c1322]/95 backdrop-blur-md border border-indigo-500/50 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-bounce pointer-events-auto">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            {coordsPickingMode === "area" ? (
              <>
                <Circle className="w-4 h-4 text-indigo-400" />
                <span>
                  Segure e arraste no mapa para desenhar o raio
                  <span className="normal-case tracking-normal font-semibold text-white/50 ml-2">
                    (botão direito arrasta o mapa)
                  </span>
                </span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>
                  {editandoNoModal
                    ? "Clique no lugar novo ou arraste o pino para movê-lo"
                    : "Selecione a localização do seu Pin no mapa"}
                </span>
              </>
            )}
          </span>
          <button
            onClick={() => {
              // Editando: desistir de mover não pode jogar fora a missão nem o
              // que já foi mexido no formulário. Volta para o editor, no lugar
              // em que a missão estava.
              if (editandoNoModal) {
                cancelarMovimentacaoDaMissao();
                return;
              }
              // No raio não há pergunta anterior para voltar: cancelar aqui é
              // largar a criação inteira, sem deixar meia área pendurada.
              if (coordsPickingMode === "area" && creationModalType === "area") {
                cancelarRaio();
                return;
              }
              setClickToPickCoords(false);
              setDefinindoRaio(false);
              // Com o formulário aberto, cancelar devolve à pergunta inicial em
              // vez de deixar a pessoa num passo sem saída.
              if (creationModalType) setCreationLocationMode("ask");
              triggerNotification("Seleção de coordenadas suspensa.", "info");
            }}
            className="px-3 py-1 bg-red-650 hover:bg-red-700 bg-red-600 text-[10px] text-white rounded-full font-bold transition-all border border-red-500 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* FICHA DA ESCOLA — tudo que o censo traz sobre ela */}
      {escolaAberta && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 z-[2200] flex flex-col animate-in slide-in-from-right duration-200">
          <div
            className="px-5 py-4 text-white flex items-start justify-between gap-3 shrink-0"
            style={{ backgroundColor: corDaDependencia(escolaAberta.dependencia) }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-90">
                  {escolaAberta.dependencia || "Escola"}
                </span>
                {escolaAberta.situacao &&
                  escolaAberta.situacao !== "EM ATIVIDADE" && (
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9.5px] font-black uppercase tracking-wide">
                      Paralisada
                    </span>
                  )}
              </div>
              <h3 className="text-[16px] font-black leading-tight">
                {escolaAberta.nome}
              </h3>
              <p className="text-[11px] font-semibold opacity-90 mt-0.5">
                INEP {escolaAberta.codigoInep}
              </p>
            </div>
            <button
              onClick={() => setEscolaAberta(null)}
              className="w-9 h-9 rounded-xl hover:bg-white/20 flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {/* IDENTIFICAÇÃO */}
            <div className="flex flex-col gap-2.5">
              {escolaAberta.endereco && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] font-semibold text-slate-600 leading-snug">
                    {escolaAberta.endereco}
                  </p>
                </div>
              )}
              {escolaAberta.telefone && (
                <a
                  href={`tel:${escolaAberta.telefone.replace(/\D/g, "")}`}
                  className="flex items-center gap-2 text-[12px] font-bold text-[#015FC9] hover:underline"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  {escolaAberta.telefone}
                </a>
              )}
              {/* As coordenadas não interessam a quem usa: o que interessa é
                  chegar lá. O número vira o caminho. */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${escolaAberta.latitude},${escolaAberta.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 h-11 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Map className="w-4 h-4 text-[#015FC9]" />
                Abrir no Google Maps
              </a>
              {escolaAberta.restricao && (
                <p className="text-[11px] font-semibold text-slate-400 leading-snug">
                  {escolaAberta.restricao}
                </p>
              )}
            </div>

            {(escolaAberta.etapas || []).length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Etapas oferecidas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(escolaAberta.etapas || []).map((etapa) => (
                    <span
                      key={etapa}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black"
                    >
                      {etapa}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {escolaAberta.matriculas == null ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-[12px] font-bold text-amber-800">
                  Sem matrículas no Censo 2025
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">
                  {escolaAberta.situacao ||
                    "A escola não teve censo neste ano."}
                </p>
              </div>
            ) : (
              <>
                {/* TOTAL E SEXO */}
                <div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-black text-[#0D233A] leading-none">
                      {escolaAberta.matriculas.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[12px] font-semibold text-slate-400">
                      matrículas em 2025
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      {
                        rotulo: "Feminino",
                        valor: escolaAberta.matFeminino,
                        cor: "#ec4899",
                      },
                      {
                        rotulo: "Masculino",
                        valor: escolaAberta.matMasculino,
                        cor: "#0ea5e9",
                      },
                    ].map((campo) => (
                      <div
                        key={campo.rotulo}
                        className="bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2.5"
                      >
                        <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                          {campo.rotulo}
                        </p>
                        <p
                          className="text-[17px] font-black leading-tight"
                          style={{ color: campo.cor }}
                        >
                          {(campo.valor || 0).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <BarrasDaEscola
                  titulo="Por etapa"
                  nota="As etapas se sobrepõem: no médio integrado o mesmo aluno conta em duas."
                  total={escolaAberta.matriculas}
                  itens={[
                    {
                      rotulo: "Educação Infantil",
                      valor: escolaAberta.matInfantil,
                      detalhe: `creche ${escolaAberta.matCreche || 0} · pré ${escolaAberta.matPreEscola || 0}`,
                    },
                    {
                      rotulo: "Ensino Fundamental",
                      valor: escolaAberta.matFundamental,
                      detalhe: `iniciais ${escolaAberta.matFundIniciais || 0} · finais ${escolaAberta.matFundFinais || 0}`,
                    },
                    { rotulo: "Ensino Médio", valor: escolaAberta.matMedio },
                    {
                      rotulo: "Educação Profissional",
                      valor: escolaAberta.matProfissional,
                    },
                    {
                      rotulo: "EJA",
                      valor: escolaAberta.matEja,
                      detalhe: `fund. ${escolaAberta.matEjaFundamental || 0} · médio ${escolaAberta.matEjaMedio || 0}`,
                    },
                    {
                      rotulo: "Educação Especial",
                      valor: escolaAberta.matEspecial,
                      detalhe: "alunos de inclusão, já contados na etapa regular",
                    },
                  ]}
                />

                <BarrasDaEscola
                  titulo="Por faixa etária"
                  total={escolaAberta.matriculas}
                  itens={[
                    { rotulo: "0 a 3 anos", valor: escolaAberta.mat0a3 },
                    { rotulo: "4 a 5 anos", valor: escolaAberta.mat4a5 },
                    { rotulo: "6 a 10 anos", valor: escolaAberta.mat6a10 },
                    { rotulo: "11 a 14 anos", valor: escolaAberta.mat11a14 },
                    { rotulo: "15 a 17 anos", valor: escolaAberta.mat15a17 },
                    { rotulo: "18 anos ou mais", valor: escolaAberta.mat18Mais },
                  ]}
                />

                <BarrasDaEscola
                  titulo="Por cor ou raça"
                  total={escolaAberta.matriculas}
                  itens={[
                    { rotulo: "Parda", valor: escolaAberta.matParda },
                    { rotulo: "Branca", valor: escolaAberta.matBranca },
                    { rotulo: "Preta", valor: escolaAberta.matPreta },
                    { rotulo: "Indígena", valor: escolaAberta.matIndigena },
                    { rotulo: "Amarela", valor: escolaAberta.matAmarela },
                    {
                      rotulo: "Não declarada",
                      valor: escolaAberta.matRacaNaoDeclarada,
                    },
                  ]}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* CENTRO MARCADO: agora o raio cresce arrastando a alça no mapa */}
      {definindoRaio && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2001] bg-[#0c1322]/95 backdrop-blur-md border border-indigo-500/50 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 pointer-events-auto">
          <Circle className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {areaRadius === ""
              ? "Arraste a partir da borda para abrir o raio"
              : "Arraste a borda para ajustar, o centro para mover"}
          </span>
          <span className="text-xs font-black bg-white/10 border border-white/20 px-3 py-1 rounded-full">
            {areaRadius === "" ? "sem raio" : `${areaRadius} m`}
          </span>
          <button
            onClick={() => {
              setDefinindoRaio(false);
              setClickToPickCoords(true);
              setPickedCoords(null);
              setAreaRadius("");
            }}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[10px] text-white rounded-full font-bold border border-white/20 cursor-pointer transition-all"
          >
            Refazer
          </button>
          <button
            onClick={() => {
              if (editandoNoModal) {
                cancelarMovimentacaoDaMissao();
                return;
              }
              cancelarRaio();
            }}
            className="px-3 py-1 bg-transparent hover:bg-rose-500/20 text-[10px] text-rose-300 hover:text-rose-200 rounded-full font-bold border border-rose-400/40 cursor-pointer transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!Number(areaRadius)) {
                triggerNotification(
                  "Arraste a borda para abrir o raio antes de concluir.",
                  "error",
                );
                return;
              }
              setDefinindoRaio(false);
              // Editando: o nome já existe e o resto da missão está aberto
              // atrás. Concluir aqui devolve o editor, não recomeça o cadastro.
              if (editandoNoModal) {
                setCreationLocationMode("map");
                return;
              }
              // Desenho pronto: agora a única pergunta é se essa área tem nome.
              setNomeandoRaio("pergunta");
            }}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-[10px] text-white rounded-full font-bold border border-indigo-500 cursor-pointer transition-all"
          >
            Concluir
          </button>
        </div>
      )}

      {/* RIGHT SIDEBAR PANEL: Controls & Settings */}
      <div
        className={`bg-white border-l border-slate-200 flex flex-col h-full z-[1001] shadow-2xl transition-all duration-300 flex-shrink-0 order-2 ${
          isSidebarOpen
            ? "w-full md:w-[450px]"
            : "w-0 overflow-hidden border-none pointer-events-none"
        }`}
      >
        {/* Header Branding */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/50 p-1.5 flex items-center justify-center shrink-0">
              <img
                src={BRAND_LOGO}
                alt="Triad3 Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight flex items-center gap-1.5 leading-none">
                Mapa Operacional{" "}
                <Flag className="w-4 h-4 text-red-500 fill-red-500" />
              </h1>
            </div>
          </div>
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              setSelectedId(null);
              resetAreaForm();
              resetPinForm();
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Recolher painel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATS STRIP Summary Dashboard */}
        <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50 text-center select-none text-slate-700">
          <div className="p-3 border-r border-slate-100">
            <div className="text-xs text-slate-400 flex justify-center items-center gap-1 uppercase tracking-wider font-semibold">
              <Users className="w-3.5 h-3.5 text-blue-500" /> Equipes
            </div>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5">
              {areas.length}
            </p>
          </div>
          <div className="p-3">
            <div className="text-xs text-slate-400 flex justify-center items-center gap-1 uppercase tracking-wider font-semibold">
              <Compass className="w-3.5 h-3.5 text-indigo-500" /> Cobertura
            </div>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5 whitespace-nowrap">
              {totalAreaCoveredKm2}
              <span className="text-xs text-slate-400 font-normal"> km²</span>
            </p>
          </div>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider bg-slate-50/50">
          <button
            className={`flex-1 py-3 flex flex-col md:flex-row justify-center items-center gap-1 border-b-2 hover:bg-white hover:text-indigo-600 transition-all ${
              activeTab === "pins"
                ? "border-indigo-600 text-indigo-600 font-extrabold bg-white shadow-3xs"
                : "border-transparent text-slate-500"
            }`}
            onClick={() => {
              setActiveTab("pins");
            }}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pontos</span>
          </button>

          {/* As áreas tinham lista, mas nenhuma aba que levasse até ela: só se
              chegava lá clicando num círculo do mapa. */}
          <button
            className={`flex-1 py-3 flex flex-col md:flex-row justify-center items-center gap-1 border-b-2 hover:bg-white hover:text-indigo-600 transition-all ${
              activeTab === "areas"
                ? "border-indigo-600 text-indigo-600 font-extrabold bg-white shadow-3xs"
                : "border-transparent text-slate-500"
            }`}
            onClick={() => {
              setActiveTab("areas");
            }}
          >
            <Circle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Áreas</span>
          </button>

          <button
            className={`flex-1 py-3 flex flex-col md:flex-row justify-center items-center gap-1 border-b-2 hover:bg-white hover:text-emerald-600 transition-all ${
              activeTab === "checkins"
                ? "border-emerald-500 text-emerald-600 font-extrabold bg-white shadow-3xs"
                : "border-transparent text-slate-500"
            }`}
            onClick={() => {
              setActiveTab("checkins");
            }}
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Check-ins</span>
          </button>

        </div>

        {/* Scrollable control workspace */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-white">
          {/* TAB 4: CHECK-INS REALIZADOS */}
          {activeTab === "checkins" && (
            <div className="space-y-4 animate-in fade-in duration-250">
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100/50 p-4 rounded-2xl select-none">
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />{" "}
                    Registros de Equipe
                  </h4>
                  <p className="text-[10px] text-emerald-700 mt-1 font-medium leading-normal">
                    Presenças em campo transmitidas e fotografadas pelos
                    voluntários e coordenadores de rua.
                  </p>
                </div>
                <div className="bg-emerald-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-xs">
                  {filteredCheckIns.length}
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredCheckIns.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Nenhum check-in registrado para esta seleção de filtro.
                  </div>
                ) : (
                  [...filteredCheckIns]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((checkIn) => {
                      const checkInDate = new Date(checkIn.createdAt);
                      const formattedTime = checkInDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const formattedDate = checkInDate.toLocaleDateString([], {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });
                      const isSelected = selectedId === checkIn.id;
                      const isFree = checkIn.mode === "livre";
                      const priority = resolverPrioridade(checkIn.priority);
                      const media = getCheckInMedia(checkIn);
                      const cover = media.find((m) => m.type === "image");
                      const videoCount = media.filter(
                        (m) => m.type === "video",
                      ).length;

                      return (
                        <div
                          key={checkIn.id}
                          className={`p-3 border rounded-xl shadow-3xs hover:shadow-2xs transition-all cursor-pointer relative group flex gap-3 ${
                            isSelected
                              ? "bg-emerald-50/50 border-emerald-500/60 ring-2 ring-emerald-500/10"
                              : "bg-white border-slate-100 hover:border-slate-200"
                          }`}
                          onClick={() => {
                            setSelectedId(checkIn.id);
                          }}
                        >
                          {/* Foto de Check-in em Miniatura */}
                          <div className="w-12 h-12 rounded-lg bg-emerald-100/30 border border-emerald-100 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                            {cover ? (
                              <img
                                src={cover.url}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : videoCount > 0 ? (
                              <Video className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Users className="w-5 h-5 text-emerald-600 animate-pulse" />
                            )}
                            {media.length > 1 && (
                              <span className="absolute bottom-0 right-0 px-1 py-px bg-slate-900/75 text-white text-[8px] font-extrabold rounded-tl-md leading-tight">
                                {media.length}
                              </span>
                            )}
                          </div>

                          {/* Dados textuais */}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-sm text-slate-800 truncate leading-tight flex items-center gap-1.5">
                              {checkIn.name}
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            </h5>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate uppercase tracking-tight">
                              📍 {checkIn.rua} — {checkIn.bairro}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border select-none ${
                                  isFree
                                    ? "bg-orange-50 text-orange-700 border-orange-150"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-100"
                                }`}
                              >
                                {isFree ? "Check-in Livre" : "Missão"}
                              </span>
                              {priority && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border select-none"
                                  style={{
                                    color: priority.color,
                                    borderColor: `${priority.color}40`,
                                    backgroundColor: `${priority.color}14`,
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: priority.color }}
                                  />
                                  Prioridade {priority.label}
                                </span>
                              )}
                              {videoCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 select-none">
                                  <Video className="w-2.5 h-2.5" />
                                  {videoCount} vídeo{videoCount > 1 ? "s" : ""}
                                </span>
                              )}
                              {!isFree && checkIn.missionTitle && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-150 max-w-[140px] truncate">
                                  {checkIn.missionTitle}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-medium mt-1">
                              <span>🕒 {formattedTime}</span>
                              <span>•</span>
                              <span>📅 {formattedDate}</span>
                            </div>
                            {checkIn.userLatitude && checkIn.userLongitude && (
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100 select-none">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                  GPS Capturado
                                </span>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${checkIn.userLatitude},${checkIn.userLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(me) => me.stopPropagation()}
                                  className="text-[9px] font-bold text-amber-600 hover:text-amber-800 underline transition-colors"
                                >
                                  Ver no Google Maps
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Botão de Excluir Check-in */}
                          <div className="flex items-center flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                askConfirmation({
                                  title: "Remover check-in",
                                  message: `O registro de ${checkIn.name} sai do mapa e do histórico.`,
                                  details:
                                    "As fotos e vídeos anexados a ele também deixam de aparecer.",
                                  confirmLabel: "Remover check-in",
                                  onConfirm: () => {
                                    setCheckIns((prev) =>
                                      prev.filter((c) => c.id !== checkIn.id),
                                    );
                                    if (isDatabaseConfigured) {
                                      DatabaseService.deleteCheckIn(
                                        checkIn.id,
                                      ).then((res) => {
                                        if (!res.success)
                                          triggerNotification(
                                            `Banco de dados: ${res.error}`,
                                            "error",
                                          );
                                      });
                                    }
                                    triggerNotification(
                                      "Check-in de voluntário removido!",
                                      "info",
                                    );
                                  },
                                });
                              }}
                              className="p-1 px-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                              title="Remover check-in"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* TAB 1: AREAS MANAGEMENT */}
          {activeTab === "areas" && (
            <div className="space-y-5">
                <button
                  type="button"
                  onClick={triggerCreateArea}
                  className="w-full p-4 bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-100/70 rounded-2xl flex items-center justify-between text-indigo-700 hover:text-indigo-800 transition-all cursor-pointer group shadow-3xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-xs text-indigo-950">
                        Marcar Área de Panfletagem
                      </p>
                      <p className="text-[10px] text-indigo-500">
                        Selecione Bairro e Rua no centro
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-400" />
                </button>

              {/* LIST OF REGISTERED PANFLETAGEM GROUPS */}
              <div className="space-y-3">
                <div className="flex justify-between items-center select-none">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" /> Áreas
                    Cadastradas ({areas.length})
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {filteredAreas.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
                      Nenhuma área correspondente à pesquisa encontrada.
                    </div>
                  ) : (
                    filteredAreas.map((area) => {
                      const isSelected = selectedId === area.id;
                      return (
                        <div
                          key={area.id}
                          onClick={() => startEditArea(area)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/10 shadow-md ring-1 ring-indigo-100"
                              : "border-slate-100 bg-white hover:border-slate-200 shadow-2xs hover:shadow-xs"
                          }`}
                          style={{
                            borderLeftWidth: "5px",
                            borderLeftColor: area.color,
                          }}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h5 className="font-bold text-sm text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                                {area.title}
                              </h5>
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                  {area.bairro}
                                </span>
                                <span>
                                  • Raio:{" "}
                                  <strong className="text-slate-600">
                                    {area.radius}m
                                  </strong>
                                </span>
                                {area.teamSize ? (
                                  <span className="text-blue-600 bg-blue-50 px-1 py-0.2 rounded font-medium text-[10px]">
                                    {area.teamSize} p.
                                  </span>
                                ) : null}
                              </p>
                              {(area.center?.turno ||
                                nivelDaMissao(area.center?.priority)) && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 select-none">
                                  {area.center?.turno && (
                                    <EtiquetaDeTurno
                                      turno={area.center.turno}
                                      janelas={turnosDaCampanha}
                                      tamanho="mini"
                                    />
                                  )}
                                  {nivelDaMissao(area.center?.priority) && (
                                    <EtiquetaDePrioridade
                                      nivel={nivelDaMissao(area.center?.priority)!}
                                      tamanho="mini"
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Edition and deletion triggers */}
                            <div className="flex items-center gap-1 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditArea(area);
                                }}
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteArea(area.id);
                                }}
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-500 mt-2 line-clamp-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100/50 italic">
                            <span className="font-semibold text-[10px] text-slate-400 not-italic block mb-0.5 uppercase tracking-wider">
                              Legenda / Missão:
                            </span>
                            {area.description
                              ? `"${area.description}"`
                              : "Sem descrição cadastrada."}
                          </p>

                          {area.contactName && (
                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
                              <span className="text-slate-400">
                                Responsável:
                              </span>
                              <strong className="text-slate-600">
                                {area.contactName}
                              </strong>
                            </div>
                          )}

                          {/* Membros da Equipe Atribuídos */}
                          {(() => {
                            const assignedIds =
                              area.assignedDeltas ||
                              area.center?.assignedDeltas ||
                              [];
                            if (assignedIds.length === 0) return null;
                            const assignedNames = supporters
                              .filter((s) => assignedIds.includes(s.id))
                              .map(
                                (s) =>
                                  s.full_name ||
                                  s.nome_completo ||
                                  s.nome ||
                                  s.name,
                              );
                            if (assignedNames.length === 0) return null;
                            return (
                              <div className="mt-2 text-[10px] text-indigo-700 bg-indigo-50/50 border border-indigo-100/50 p-2 rounded-lg flex flex-wrap gap-1 items-center leading-normal">
                                <span className="text-indigo-600 font-bold uppercase tracking-wider text-[9px] shrink-0">
                                  Designados ({assignedNames.length}):
                                </span>
                                <div className="flex flex-wrap gap-1 text-[9px]">
                                  {assignedNames.map((name, i) => (
                                    <span
                                      key={i}
                                      className="bg-indigo-100/60 text-indigo-800 px-1.5 py-0.5 rounded-sm font-bold truncate max-w-[120px]"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PINS (PONTOS DE INTERESSE) */}
          {activeTab === "pins" && (
            <div className="space-y-4">
              {/* Form to Edit Custom Pins or Big CTA to create */}
                <button
                  type="button"
                  onClick={triggerCreatePin}
                  className="w-full p-4 bg-orange-50/60 hover:bg-orange-50 border border-orange-100/70 rounded-2xl flex items-center justify-between text-orange-700 hover:text-orange-800 transition-all cursor-pointer group shadow-3xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-600 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-xs text-orange-950">
                        Adicionar Ponto (PIN)
                      </p>
                      <p className="text-[10px] text-orange-500">
                        Selecione Bairro e Rua no centro
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-orange-400" />
                </button>

              {/* LIST OF PINS */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 select-none">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" /> Pins
                  Estratégicos ({filteredPins.length})
                </h4>

                <div className="space-y-2.5">
                  {filteredPins.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
                      Nenhum ponto estratégico correspondente à pesquisa.
                    </div>
                  ) : (
                    filteredPins.map((pin) => {
                      const isSelected = selectedId === pin.id;
                      return (
                        <div
                          key={pin.id}
                          onClick={() => startEditPin(pin)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/10 shadow-md ring-1 ring-indigo-100"
                              : "border-slate-100 bg-white hover:border-slate-200 shadow-2xs hover:shadow-xs"
                          }`}
                          style={{
                            borderLeftWidth: "5px",
                            borderLeftColor: pin.color,
                          }}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-start gap-2">
                              <div
                                className="p-1 px-1.5 rounded-lg text-white font-bold flex-shrink-0 mt-0.5 text-xs shadow-2xs"
                                style={{ backgroundColor: pin.color }}
                              >
                                <OperationIcon
                                  icon={operationTypeIcon(pin.iconType)}
                                  size={14}
                                />
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                                  {pin.title}
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide font-semibold">
                                  {operationTypeLabel(pin.iconType)}
                                </p>
                                {pin.position?.semLocal && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[9px] font-black uppercase tracking-wider text-amber-700">
                                    <ClipboardList className="w-2.5 h-2.5" />
                                    Sem local
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions Group */}
                            <div className="flex items-center gap-1 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditPin(pin);
                                }}
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePin(pin.id);
                                }}
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded transition-colors"
                                title="Remover Pin"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {pin.date && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50/40 px-2 py-1 rounded-md border border-indigo-100/30 w-fit select-none">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>
                                Data: {pin.date.split("-").reverse().join("/")}
                              </span>
                            </div>
                          )}

                          {(pin.position?.turno ||
                            nivelDaMissao(pin.position?.priority)) && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 select-none">
                              {pin.position?.turno && (
                                <EtiquetaDeTurno
                                  turno={pin.position.turno}
                                  janelas={turnosDaCampanha}
                                  tamanho="mini"
                                />
                              )}
                              {nivelDaMissao(pin.position?.priority) && (
                                <EtiquetaDePrioridade
                                  nivel={nivelDaMissao(pin.position?.priority)!}
                                  tamanho="mini"
                                />
                              )}
                            </div>
                          )}

                          <p className="text-xs text-slate-500 mt-2 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                            "{pin.description || "Sem descrição cadastrada."}"
                          </p>

                          {/* Membros da Equipe Atribuídos para PINS */}
                          {(() => {
                            const assignedIds =
                              pin.assignedDeltas ||
                              pin.position?.assignedDeltas ||
                              [];
                            if (assignedIds.length === 0) return null;
                            const assignedNames = supporters
                              .filter((s) => assignedIds.includes(s.id))
                              .map(
                                (s) =>
                                  s.full_name ||
                                  s.nome_completo ||
                                  s.nome ||
                                  s.name,
                              );
                            if (assignedNames.length === 0) return null;
                            return (
                              <div className="mt-2 text-[10px] text-indigo-700 bg-indigo-50/50 border border-indigo-100/50 p-2 rounded-lg flex flex-wrap gap-1 items-center leading-normal">
                                <span className="text-indigo-600 font-bold uppercase tracking-wider text-[9px] shrink-0">
                                  Designados ({assignedNames.length}):
                                </span>
                                <div className="flex flex-wrap gap-1 text-[9px]">
                                  {assignedNames.map((name, i) => (
                                    <span
                                      key={i}
                                      className="bg-indigo-100/60 text-indigo-800 px-1.5 py-0.5 rounded-sm font-bold truncate max-w-[120px]"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRATEGY & ANALYTICS */}
          {activeTab === "statistics" && (
            <div className="space-y-4 select-none">
              {/* Cover Details Panel */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-4">
                <h4 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-yellow-300" /> Cobertura em
                  Maceió
                </h4>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  Estes dados mostram o impacto territorial da sua campanha
                  política com base no raio de cobertura de cada equipe de
                  panfletagem ativa.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs border-b border-indigo-700/40 pb-2">
                    <span className="text-indigo-200">
                      Área Geográfica Coberta:
                    </span>
                    <strong className="text-sm font-bold text-white font-mono">
                      {totalAreaCoveredKm2} km²
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-indigo-700/40 pb-2">
                    <span className="text-indigo-200">
                      Militantes Mobilizados:
                    </span>
                    <strong className="text-sm font-bold text-white font-mono">
                      {totalVolunteers} militantes
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-indigo-200">
                      Pins Operacionais Ativos:
                    </span>
                    <strong className="text-sm font-bold text-white font-mono">
                      {totalStrategicPlaces} locais
                    </strong>
                  </div>
                </div>
              </div>

              {/* Suggestions / Intelligent Strategy Generator based on neighborhood */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                  Dicas e Diretrizes de Campanha
                </h4>
                <ul className="text-xs text-slate-600 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="p-0.5 bg-indigo-100 text-indigo-700 rounded mt-0.5 font-bold">
                      1
                    </span>
                    <span>
                      <strong>Raio de 500m:</strong> Representa uma cobertura
                      média de caminhada de 10 a 15 min do ponto inicial.
                      Excelente para semáforos de avenidas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="p-0.5 bg-indigo-100 text-indigo-700 rounded mt-0.5 font-bold">
                      2
                    </span>
                    <span>
                      <strong>Pontos Estratégicos (Pins):</strong> Adicione
                      bandeiras ou residências de lideranças comunitárias para
                      delimitar o início das caminhadas de panfletagem.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="p-0.5 bg-indigo-100 text-indigo-700 rounded mt-0.5 font-bold">
                      3
                    </span>
                    <span>
                      <strong>Zonas de Alto Tráfego:</strong> Farol
                      (colegiais/clínicas), Centro (comércio) e calçadão das
                      praias exigem materiais focados em temas específicos
                      locais.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Export / Import Settings block */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                  Backup e Exportação de Mapa
                </h4>
                <p className="text-xs text-slate-500">
                  Exporte o mapa atual ou importe um arquivo de dados gerado
                  anteriormente para carregar equipes registradas.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={exportCampaignJson}
                    className="py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Exportar JSON</span>
                  </button>

                  <label className="py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs text-center">
                    <Upload className="w-3.5 h-3.5 text-indigo-600 inline-block" />
                    <span>Importar JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportJson}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search tool at bottom of panel */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 select-none">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar equipe, bairro ou legenda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800 shadow-2xs"
            />
            <div className="absolute left-3 top-2.5 text-slate-400">
              <Compass className="w-3.5 h-3.5" />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LEFT WORKSPACE: Full Interactive Map */}
      <div className="flex-1 h-full relative order-1">
        <MapContainer
          areas={filteredAreas}
          pins={pinsNoMapa}
          checkIns={filteredCheckIns}
          selectedId={selectedId}
          defaultLocation={mapDefaultLocation}
          selectedCandidateId={selectedCandidateFilter}
          candidates={candidates}
          mapFilter={mapFilter}
          onMapFilterChange={setMapFilter}
          estabelecimentos={estabelecimentos}
          estabelecimentoEmFoco={lojaEmFoco}
          estabelecimentoDestacado={lojaDestacada}
          circuloAnalisado={circuloAnalisado}
          recortesTerritoriais={recortesTerritoriais}
          escalaTerritorial={escalaTerritorial}
          recorteEmFoco={recorteEmFoco}
          onRecorteSobOCursor={setRecorteEmFoco}
          enquadrarRecortes={territorioAberto}
          onRecorteClicado={(id) => {
            setRecorteEmFoco(id);
            setTerritorioAberto(true);
          }}
          onEstabelecimentoSelecionado={(id) => {
            setLojaEmFoco(id);
            // O pino abre a ficha inteira; a lista fica aberta atrás, com o
            // mesmo item destacado, para a pessoa não se perder.
            setLojaAberta(estabelecimentos.find((e) => e.id === id) || null);
            setPesquisaLojasAberta(true);
          }}
          aoRegistrarVista={registrarVistaDoMapa}
          onToggleCheckInFavorite={alternarFavoritoCheckIn}
          onDeleteCheckIn={excluirCheckIn}
          onSelectItem={(id, type) => {
            setSelectedId(id);
            // Clicar na missão abre o editor completo no centro da tela. A
            // lateral fica como estava: ela é a lista, não o formulário.
            if (type === "area") {
              const found = areas.find((a) => a.id === id);
              if (found) startEditArea(found);
            } else {
              const found = pins.find((p) => p.id === id);
              if (found) startEditPin(found);
            }
          }}
          clickToPickCoords={clickToPickCoords}
          // Colocando um ponto: a busca por bairro e rua sai da frente do mapa.
          esconderBusca={clickToPickCoords || definindoRaio}
          onCoordsPicked={(coords) => {
            setPickedCoords(coords);
          }}
          operationTypes={operationTypes}
            priorityLevels={priorityLevels}
            janelasDeTurno={turnosDaCampanha}
            rulerActive={reguaLigada}
            rulerPoints={pontosRegua}
            rulerColor={corRegua}
            onRulerPoint={(coords) => setPontosRegua((p) => [...p, coords])}
          tempPlacementCoords={pickedCoords}
          itemEmEdicaoId={itemEmEdicaoId}
          equipe={supporters}
          /*
            O recorte de tempo desce para a barra do mapa, ao lado da busca.
            Ele é do painel — mas o lugar dele é essa fila, colado no resto,
            e não um absoluto solto tentando adivinhar onde a busca termina.
          */
          acoesDaBarra={
            adminUser && adminTab === "map" ? (
              <FiltroDePeriodo
                aberto={periodoAberto}
                onAbrir={setPeriodoAberto}
                valor={estadoDoPeriodo}
                onMudar={mudarPeriodo}
                contagem={contagemDoPeriodo}
              />
            ) : null
          }
          tempPlacementColor={
            coordsPickingMode === "area" ? areaColor : pinColor
          }
          escolas={escolas}
          escolasVisiveis={escolasLigadas}
          onEscolaSelecionada={(escola) => setEscolaAberta(escola)}
          tempPlacementRadius={Number(areaRadius) || 0}
          onTempRadiusChange={(metros) => setAreaRadius(metros)}
          tempPlacementType={coordsPickingMode}
        />
      </div>

      {/* GERENCIADOR DE TIPOS DE OPERAÇÃO */}
      <AnimatePresence>
        {isOperationTypesModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[3500]"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5 relative text-slate-800"
            >
              <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-indigo-950 text-base leading-tight">
                    Tipos de Operação
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    Crie, edite e exclua os tipos que a sua operação usa no
                    mapa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOperationTypesModalOpen(false);
                    resetOperationTypeForm();
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulário de criação / edição */}
              <form
                onSubmit={saveOperationType}
                className="space-y-3.5 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                    style={{ backgroundColor: opTypeColor }}
                  >
                    <OperationIcon icon={opTypeIcon} size={16} />
                  </div>
                  <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none">
                    {editingOperationTypeId
                      ? "Editar tipo"
                      : "Novo tipo de operação"}
                  </h4>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                    Nome do tipo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Vistoria de Iluminação"
                    value={opTypeLabel}
                    onChange={(e) => setOpTypeLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                    Ícone no mapa
                  </label>
                  <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5 bg-white border border-slate-200 rounded-xl p-2 shadow-2xs">
                    {OPERATION_ICONS.map((icon) => {
                      const isActive = icon.key === opTypeIcon;
                      return (
                        <button
                          type="button"
                          key={icon.key}
                          title={icon.label}
                          onClick={() => setOpTypeIcon(icon.key)}
                          className={`aspect-square rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                            isActive
                              ? "border-transparent text-white shadow-xs scale-105"
                              : "border-slate-150 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                          style={
                            isActive
                              ? { backgroundColor: opTypeColor }
                              : undefined
                          }
                        >
                          <OperationIcon icon={icon.key} size={15} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                    Cor padrão
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 items-center shadow-2xs">
                      <input
                        type="color"
                        value={opTypeColor}
                        onChange={(e) => setOpTypeColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent shrink-0"
                      />
                      <span className="text-[10px] font-mono font-medium text-slate-500 px-1 uppercase">
                        {opTypeColor}
                      </span>
                    </div>
                    {PRESET_COLORS.map((preset) => (
                      <button
                        type="button"
                        key={preset.value}
                        title={preset.name}
                        onClick={() => setOpTypeColor(preset.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                          opTypeColor.toLowerCase() ===
                          preset.value.toLowerCase()
                            ? "border-slate-800 scale-110"
                            : "border-white shadow-2xs hover:scale-105"
                        }`}
                        style={{ backgroundColor: preset.value }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  {editingOperationTypeId && (
                    <button
                      type="button"
                      onClick={resetOperationTypeForm}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-colors shadow-3xs"
                    >
                      Cancelar edição
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                  >
                    {editingOperationTypeId ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Salvar alterações</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Adicionar tipo</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Lista dos tipos cadastrados */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none">
                  Cadastrados ({clientOperationTypes.length})
                </h4>

                {clientOperationTypes.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    {operationTypesOwnerId
                      ? "Este cliente ainda não tem nenhum tipo de operação."
                      : "Escolha um cliente para cadastrar os tipos de operação dele."}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {clientOperationTypes.map((type) => {
                      const usedBy = pins.filter(
                        (p) => p.iconType === type.id,
                      ).length;
                      const isEditing = editingOperationTypeId === type.id;
                      return (
                        <div
                          key={type.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                            isEditing
                              ? "border-indigo-300 bg-indigo-50/50"
                              : "border-slate-100 bg-white hover:border-slate-200"
                          }`}
                          style={{
                            borderLeftWidth: "5px",
                            borderLeftColor: type.color,
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: type.color }}
                          >
                            <OperationIcon icon={type.icon} size={15} />
                          </div>
                          <div className="min-w-0 flex-grow">
                            <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                              {type.label}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">
                              {usedBy === 0
                                ? "Nenhum ponto usa este tipo"
                                : `${usedBy} ponto${usedBy > 1 ? "s" : ""} no mapa`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditOperationType(type)}
                              title="Editar"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOperationType(type.id)}
                              title="Excluir"
                              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CENTER RE-DESIGNED CREATION MODAL */}
      <AnimatePresence>
        {creationModalType && !clickToPickCoords && !definindoRaio && !nomeandoRaio && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[3000]"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden relative text-slate-800"
            >
              {/* Header */}
              <div className="flex justify-between items-center gap-4 px-6 py-4 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="font-extrabold text-indigo-950 text-base leading-tight">
                    {creationModalType === "area"
                      ? editandoNoModal
                        ? "Editar Área de Trabalho (Raio)"
                        : "Criar Área de Trabalho (Raio)"
                      : creationLocationMode === "sem"
                        ? editandoNoModal
                          ? "Editar Missão (sem local)"
                          : "Criar Missão (sem local)"
                        : editandoNoModal
                          ? "Editar Ponto Estratégico (PIN)"
                          : "Criar Ponto Estratégico (PIN)"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {editandoNoModal
                      ? "Tudo pode mudar: título, tipo, equipe, material e o lugar no mapa."
                      : creationLocationMode === "map"
                        ? "Local definido pelo ponto clicado no mapa."
                        : creationLocationMode === "search"
                          ? "Planeje a localização ideal selecionando o bairro e rua."
                          : creationLocationMode === "sem"
                            ? "Sem lugar no mapa: a missão vai direto para quem você marcar."
                            : "Primeiro, escolha como quer definir o local."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    descartarMaterialPendente();
                    if (creationModalType === "area") resetAreaForm();
                    else resetPinForm();
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/*
                A estrutura: trilha à esquerda, formulário no meio, prévia à
                direita.

                Antes era uma coluna de 450 pixels com tudo empilhado no mesmo
                peso — o seletor de cor com o mesmo destaque da instrução que a
                equipe vai ler na rua. Agora a trilha diz quantas perguntas
                existem e quais faltam, e a prévia mostra, enquanto se escreve,
                o cartão que vai chegar no celular de quem está na rua.
              */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (creationModalType === "area") saveArea(e);
                  else savePin(e);
                }}
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="grid lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_320px] flex-1 min-h-0">
                  {/* TRILHA */}
                  <aside className="hidden lg:block border-r border-slate-100 p-4 overflow-y-auto bg-slate-50/40">
                    <p className="text-[9.5px] uppercase font-black tracking-widest text-slate-400 mb-2.5 px-1">
                      Passos
                    </p>
                    <TrilhaDaMissao
                      passos={passosDaMissao}
                      ativo={passoAtivo}
                      onIr={(id) => {
                        setPassoAtivo(id);
                        document
                          .getElementById(`passo-${id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    />
                  </aside>

                  {/* FORMULÁRIO */}
                  <div
                    id="corpo-do-formulario-de-missao"
                    className="overflow-y-auto p-6 space-y-5 min-w-0"
                  >
                <div id="passo-local" className="scroll-mt-4">
                {/* 0. COMO INFORMAR O LOCAL */}
                {creationLocationMode === "ask" && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1.5 duration-200">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-extrabold text-[10px] text-indigo-600">
                        1
                      </div>
                      <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none">
                        Como definir o local?
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCreationLocationMode("search")}
                      className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-start gap-3 shadow-2xs"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-indigo-950 leading-tight">
                          Pesquisar o endereço
                        </p>
                        <p className="text-xs text-slate-500 mt-1 leading-snug">
                          Escolha estado, município, bairro e rua nos seletores.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreationLocationMode("map");
                        startCoordinatesPicking(
                          creationModalType === "area" ? "area" : "pin",
                        );
                      }}
                      className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-start gap-3 shadow-2xs"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-indigo-950 leading-tight">
                          Escolher no mapa
                        </p>
                        <p className="text-xs text-slate-500 mt-1 leading-snug">
                          Clique direto no ponto exato onde a ação acontece.
                        </p>
                      </div>
                    </button>

                    {/* Nem toda missão é um lugar: "ligar para o presidente do
                        bairro" não tem onde ser desenhada no mapa. */}
                    {creationModalType === "pin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreationLocationMode("sem");
                          setPickedCoords(null);
                        }}
                        className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50/40 transition-all cursor-pointer flex items-start gap-3 shadow-2xs"
                      >
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-indigo-950 leading-tight">
                            Sem local — só a missão
                          </p>
                          <p className="text-xs text-slate-500 mt-1 leading-snug">
                            Vai direto para a conversa de quem você marcar. Nada
                            é desenhado no mapa.
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {/* 1C. MISSÃO SEM LOCAL */}
                {creationLocationMode === "sem" && (
                  <div className="space-y-2 p-4 bg-amber-50/40 border border-amber-100 rounded-2xl animate-in fade-in slide-in-from-top-1.5 duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center font-extrabold text-[10px] text-amber-700 shrink-0">
                          1
                        </div>
                        <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none truncate">
                          Missão sem local
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreationLocationMode("ask")}
                        className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                      >
                        Trocar
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-snug">
                      Ela não entra no mapa. Aparece na conversa do check-in de
                      quem você marcar em "Equipe", e o check-in é feito onde a
                      pessoa estiver.
                    </p>
                  </div>
                )}

                {/* 1B. LOCAL ESCOLHIDO PELO MAPA */}
                {creationLocationMode === "map" && (
                  <div className="space-y-3 p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl animate-in fade-in slide-in-from-top-1.5 duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center font-extrabold text-[10px] text-emerald-700 shrink-0">
                          1
                        </div>
                        <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none truncate">
                          Local escolhido no mapa
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreationLocationMode("ask")}
                        className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                      >
                        Trocar
                      </button>
                    </div>

                    {pickedCoords ? (
                      <>
                        <div className="bg-white border border-emerald-100 rounded-xl p-3">
                          {isResolvingPickedAddress ? (
                            <p className="text-xs text-slate-400 italic">
                              Identificando o endereço do ponto...
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-slate-700 leading-snug">
                              {pickedAddressLabel ||
                                "Endereço não identificado para este ponto."}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            startCoordinatesPicking(
                              creationModalType === "area" ? "area" : "pin",
                            )
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          {editandoNoModal
                            ? creationModalType === "area"
                              ? "Mover o centro e refazer o raio"
                              : "Mover para outro ponto do mapa"
                            : "Escolher outro ponto"}
                        </button>
                        {editandoNoModal && (
                          <p className="text-[10px] text-slate-500 leading-snug text-center">
                            {creationModalType === "area"
                              ? "No mapa, arraste o miolo para mover e a borda para mudar o raio. Nada muda até você salvar."
                              : "No mapa dá para clicar no lugar novo ou arrastar o pino. Nada muda até você salvar."}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500 leading-snug">
                        Nenhum ponto selecionado ainda.
                      </p>
                    )}
                  </div>
                )}

                {/* 1. SELEÇÃO DE BAIRRO E RUA (SEMPRE APARECE NO MEIO DA TELA PRIMEIRO) */}
                {creationLocationMode === "search" && (
                <div className="space-y-3.5 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-extrabold text-[10px] text-indigo-600">
                      1
                    </div>
                    <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none">
                      Endereço da Ação
                    </h4>
                  </div>

                  {/* ESTADO CUSTOM SEARCHABLE SELECT */}
                  <div className="space-y-1 relative font-sans">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Estado *
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setModalStateDropdownOpen(!modalStateDropdownOpen);
                          setModalCityDropdownOpen(false);
                          setModalBairroDropdownOpen(false);
                          setModalRuaDropdownOpen(false);
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-left text-xs text-slate-700 font-semibold flex items-center justify-between transition-all cursor-pointer shadow-3xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <Map className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {creationStateName
                            ? `${creationStateName} (${creationStateShortName})`
                            : "Selecione o Estado..."}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${modalStateDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {modalStateDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[3100] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                          {/* Search Input */}
                          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 font-sans">
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              placeholder="Pesquisar estado..."
                              value={modalStateSearch}
                              onChange={(e) =>
                                setModalStateSearch(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5"
                            />
                          </div>

                          {/* Options List */}
                          <div className="overflow-y-auto max-h-44 divide-y divide-slate-50 font-sans font-medium">
                            {filteredModalStates.map((s) => (
                              <button
                                key={s.shortName}
                                type="button"
                                onClick={() => {
                                  setCreationStateShortName(s.shortName);
                                  setCreationStateName(s.name);
                                  setCreationCityIbgeId(null);
                                  setCreationCityName(null);
                                  setCreationBairroName(null);
                                  setCreationRuaName(null);
                                  setModalStateDropdownOpen(false);
                                  setModalStateSearch("");
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer"
                              >
                                <span
                                  className={
                                    creationStateShortName === s.shortName
                                      ? "font-bold text-indigo-600 font-sans"
                                      : "font-medium font-sans"
                                  }
                                >
                                  {s.name} ({s.shortName})
                                </span>
                                {creationStateShortName === s.shortName && (
                                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 font-sans" />
                                )}
                              </button>
                            ))}
                            {filteredModalStates.length === 0 && (
                              <p className="p-3 text-center text-xs text-slate-400 italic font-sans font-medium">
                                Nenhum estado encontrado
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MUNICIPIO CUSTOM SEARCHABLE SELECT */}
                  {creationStateShortName && (
                    <div className="space-y-1 relative animate-in fade-in slide-in-from-top-1 duration-150 font-sans font-medium">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                        Município *
                      </label>
                      <div className="relative font-sans font-medium">
                        <button
                          type="button"
                          onClick={() => {
                            setModalCityDropdownOpen(!modalCityDropdownOpen);
                            setModalStateDropdownOpen(false);
                            setModalBairroDropdownOpen(false);
                            setModalRuaDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-left text-xs text-slate-700 font-semibold flex items-center justify-between transition-all cursor-pointer shadow-3xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans"
                        >
                          <span className="truncate flex items-center gap-1.5 font-sans">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {creationCityName || "Selecione o Município..."}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${modalCityDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {modalCityDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[3100] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 font-sans font-medium">
                            {/* Search Input */}
                            <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 font-sans">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 font-sans" />
                              <input
                                type="text"
                                placeholder={
                                  loadingCities
                                    ? "Carregando municípios..."
                                    : "Pesquisar município..."
                                }
                                value={modalCitySearch}
                                onChange={(e) =>
                                  setModalCitySearch(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5 font-sans"
                              />
                            </div>

                            {/* Options list */}
                            <div className="overflow-y-auto max-h-44 divide-y divide-slate-50 font-sans font-medium">
                              {loadingCities ? (
                                <p className="p-4 text-center text-xs text-slate-400 animate-pulse font-sans">
                                  Buscando municípios...
                                </p>
                              ) : (
                                filteredModalCities.map((c) => (
                                  <button
                                    key={`${c.ibgeId}-${c.name}`}
                                    type="button"
                                    onClick={() => {
                                      setCreationCityIbgeId(c.ibgeId);
                                      setCreationCityName(c.name);
                                      setCreationBairroName(null);
                                      setCreationRuaName(null);
                                      setModalCityDropdownOpen(false);
                                      setModalCitySearch("");
                                    }}
                                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer font-sans"
                                  >
                                    <span
                                      className={
                                        creationCityIbgeId === c.ibgeId
                                          ? "font-bold text-indigo-600 font-sans"
                                          : "font-medium font-sans"
                                      }
                                    >
                                      {c.name}
                                    </span>
                                    {creationCityIbgeId === c.ibgeId && (
                                      <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 font-sans" />
                                    )}
                                  </button>
                                ))
                              )}
                              {!loadingCities &&
                                filteredModalCities.length === 0 && (
                                  <p className="p-3 text-center text-xs text-slate-400 italic font-sans font-medium">
                                    Nenhum município encontrado
                                  </p>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* BAIRRO CUSTOM SEARCHABLE SELECT */}
                  {creationCityName && (
                    <div className="space-y-1 relative animate-in fade-in slide-in-from-top-1 duration-150 font-sans font-medium">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                        Selecione o Bairro *
                      </label>
                      <div className="relative font-sans font-medium">
                        <button
                          type="button"
                          onClick={() => {
                            setModalBairroDropdownOpen(
                              !modalBairroDropdownOpen,
                            );
                            setModalStateDropdownOpen(false);
                            setModalCityDropdownOpen(false);
                            setModalRuaDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-left text-xs text-slate-700 font-semibold flex items-center justify-between transition-all cursor-pointer shadow-3xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans font-medium"
                        >
                          <span className="truncate flex items-center gap-1.5 font-sans font-medium">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {creationBairroName || "Selecione o Bairro..."}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${modalBairroDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {modalBairroDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[3100] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 font-sans font-medium">
                            {/* Search Term Input */}
                            <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 font-sans font-medium font-sans">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 font-sans" />
                              <input
                                type="text"
                                placeholder={
                                  loadingDistricts
                                    ? "Carregando bairros..."
                                    : "Pesquisar bairro..."
                                }
                                value={modalBairroSearch}
                                onChange={(e) =>
                                  setModalBairroSearch(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5 font-sans"
                              />
                            </div>

                            {/* Options List */}
                            <div className="overflow-y-auto max-h-44 divide-y divide-slate-50 font-sans font-medium">
                              {loadingDistricts ? (
                                <p className="p-4 text-center text-xs text-slate-400 animate-pulse font-sans">
                                  Buscando bairros...
                                </p>
                              ) : (
                                filteredModalBairros.map((b) => (
                                  <button
                                    key={`${b.id}-${b.name}`}
                                    type="button"
                                    onClick={() => {
                                      handleCreationBairroSelect(b.name, b.id);
                                      setModalBairroDropdownOpen(false);
                                      setModalBairroSearch("");
                                    }}
                                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer font-sans font-medium"
                                  >
                                    <span
                                      className={
                                        creationBairroName === b.name
                                          ? "font-bold text-indigo-600 font-sans"
                                          : "font-medium font-sans"
                                      }
                                    >
                                      {b.name}
                                    </span>
                                    {creationBairroName === b.name && (
                                      <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 font-sans" />
                                    )}
                                  </button>
                                ))
                              )}
                              {!loadingDistricts &&
                                filteredModalBairros.length === 0 && (
                                  <p className="p-3 text-center text-xs text-slate-400 italic font-sans font-medium">
                                    Nenhum bairro encontrado
                                  </p>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RUA CUSTOM SEARCHABLE SELECT */}
                  {creationBairroName && (
                    <div className="space-y-1 relative animate-in fade-in slide-in-from-top-1 duration-150 font-sans">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                        Selecione a Rua *
                      </label>
                      <div className="relative font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setModalRuaDropdownOpen(!modalRuaDropdownOpen);
                            setModalStateDropdownOpen(false);
                            setModalCityDropdownOpen(false);
                            setModalBairroDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-left text-xs text-slate-700 font-semibold flex items-center justify-between transition-all cursor-pointer shadow-3xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        >
                          <span className="truncate flex items-center gap-1.5 font-sans">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {creationRuaName || "Selecione a Rua..."}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${modalRuaDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {modalRuaDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200/60 z-[3100] max-h-56 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                            {/* Search Term Input */}
                            <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 font-sans">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 font-sans" />
                              <input
                                type="text"
                                placeholder={
                                  loadingStreets
                                    ? "Carregando ruas..."
                                    : "Pesquisar rua..."
                                }
                                value={modalRuaSearch}
                                onChange={(e) =>
                                  setModalRuaSearch(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5 font-sans"
                              />
                            </div>

                            {/* Options List */}
                            <div className="overflow-y-auto max-h-44 divide-y divide-slate-50 font-sans">
                              {modalRuaSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCreationRuaSelect(
                                      modalRuaSearch.trim(),
                                    );
                                    setModalRuaDropdownOpen(false);
                                    setModalRuaSearch("");
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors flex items-center justify-between text-xs cursor-pointer font-sans"
                                >
                                  <span className="truncate">
                                    Usar Rua: "{modalRuaSearch.trim()}" (Manual)
                                  </span>
                                  <Plus className="w-3.5 h-3.5 text-indigo-650 shrink-0 font-sans" />
                                </button>
                              )}
                              {loadingStreets ? (
                                <p className="p-4 text-center text-xs text-slate-400 animate-pulse font-sans">
                                  Buscando ruas da API...
                                </p>
                              ) : (
                                filteredModalRuas.map((r) => {
                                  // r has name and optional id. Use name as key fallback
                                  const optionKey = r.id
                                    ? `${r.id}-${r.name}`
                                    : r.name;
                                  return (
                                    <button
                                      key={optionKey}
                                      type="button"
                                      onClick={() => {
                                        handleCreationRuaSelect(r.name);
                                        setModalRuaDropdownOpen(false);
                                        setModalRuaSearch("");
                                      }}
                                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs text-slate-700 cursor-pointer font-sans"
                                    >
                                      <span
                                        className={
                                          creationRuaName === r.name
                                            ? "font-bold text-indigo-600 font-sans"
                                            : "font-medium font-sans"
                                        }
                                      >
                                        {r.name}
                                      </span>
                                      {creationRuaName === r.name && (
                                        <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 font-sans" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                              {!loadingStreets && loadingOsmStreets && (
                                <p className="px-3.5 py-2 text-xs text-slate-400 italic font-sans">
                                  Buscando mais ruas no mapa...
                                </p>
                              )}
                              {!loadingStreets &&
                                !loadingOsmStreets &&
                                filteredModalRuas.length === 0 &&
                                !modalRuaSearch.trim() && (
                                  <p className="p-3 text-center text-xs text-slate-400 italic font-sans">
                                    Nenhuma rua encontrada
                                  </p>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                )}

                </div>
                {/* 2. DADOS ADICIONAIS SÓ APÓS O LOCAL ESTAR DEFINIDO */}
                {creationLocationReady ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-1.5 duration-200">
                    <PassoDoFormulario
                      id="missao"
                      numero={2}
                      titulo="A missão"
                      descricao={
                        creationModalType === "area"
                          ? "equipe, raio, bairro e material"
                          : "tipo, título, descrição e material"
                      }
                    >
                    {creationModalType === "area" ? (
                      <>
                        {/* Area specific inputs */}
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Título da Equipe / Ação
                          </label>
                          <input
                            type="text"
                            placeholder="Opcional — ex: Equipe Laranja"
                            value={areaTitle}
                            onChange={(e) => setAreaTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                              Qtd de Voluntários
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="500"
                              placeholder="—"
                              value={areaTeamSize}
                              onChange={(e) =>
                                setAreaTeamSize(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                              Cor correlativa
                            </label>
                            <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 items-center">
                              <input
                                type="color"
                                value={areaColor}
                                onChange={(e) => setAreaColor(e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent shrink-0"
                              />
                              <span className="text-[10px] font-mono font-medium text-slate-500 translate-x-1 uppercase">
                                {areaColor}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* O bairro é o que aparece na lista e nos relatórios.
                            O mapa descobre sozinho quando o centro é marcado,
                            mas quem conhece a região manda mais que o
                            geocodificador — então dá para escrever por cima. */}
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Bairro Correspondente
                          </label>
                          <input
                            type="text"
                            list="bairros-conhecidos"
                            placeholder={
                              isResolvingPickedAddress
                                ? "Identificando pelo mapa..."
                                : "Ex: Jatiúca"
                            }
                            value={areaBairro}
                            onChange={(e) => setAreaBairro(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                          <datalist id="bairros-conhecidos">
                            {(brasilDistricts && brasilDistricts.length > 0
                              ? brasilDistricts.map((b) => b.name)
                              : MACEIO_BAIRROS.map((b) => b.name)
                            ).map((nome) => (
                              <option key={nome} value={nome} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Responsável / Coordenador da Ação
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Carlos Santana"
                            value={areaContact}
                            onChange={(e) => setAreaContact(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1 select-none">
                            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">
                              Raio da Área de Trabalho
                            </label>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                              {areaRadius === ""
                                ? "arraste no mapa"
                                : `${areaRadius} metros`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="1"
                              max="15000"
                              step="5"
                              value={areaRadius || 0}
                              onChange={(e) =>
                                setAreaRadius(Number(e.target.value))
                              }
                              className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <input
                              type="number"
                              min="1"
                              max="100000"
                              placeholder="—"
                              value={areaRadius}
                              onChange={(e) =>
                                setAreaRadius(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                              className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs text-center"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Legenda / Missão da Equipe
                          </label>
                          <textarea
                            placeholder="Materiais para entregar, ponto de encontro..."
                            value={areaDescription}
                            onChange={(e) => setAreaDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>

                      </>
                    ) : (
                      <>
                        {/* Pin specific inputs */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">
                              Tipo de Operação
                            </label>
                            <button
                              type="button"
                              onClick={openOperationTypesManager}
                              className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <PenTool className="w-3 h-3" />
                              Gerenciar
                            </button>
                          </div>
                          {/*
                            O tipo vem antes do título porque é ele que dá a
                            cor e o desenho do ponto no mapa: escolhido o
                            tipo, não sobra cor nenhuma para o comitê decidir
                            na hora de mandar a missão.
                          */}
                          <OperationTypeSelect
                            types={clientOperationTypes}
                            value={pinIconType}
                            onChange={handlePinTypeChange}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            {creationLocationMode === "sem"
                              ? "Título da missão *"
                              : "Título do Ponto Estratégico *"}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={
                              creationLocationMode === "sem"
                                ? "Ex: Ligar para o presidente do bairro"
                                : "Ex: Comitê Setorial Jatiúca"
                            }
                            value={pinTitle}
                            onChange={(e) => setPinTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Descrição
                          </label>
                          <textarea
                            placeholder={
                              creationLocationMode === "sem"
                                ? "Ex: Confirmar presença dele na reunião de sábado..."
                                : "Ex: Reunião às 19h com a liderança no comitê..."
                            }
                            value={pinDescription}
                            onChange={(e) => setPinDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>

                      </>
                    )}

                    {/*
                      O material vem colado na descrição: são a mesma coisa —
                      a instrução escrita e a instrução anexada.
                    */}
                    <div className="pt-1">
                      <EditorDeMaterial
                        itens={materialMissao}
                        onMudar={setMaterialMissao}
                        notificar={triggerNotification}
                        ligado={isDatabaseConfigured}
                      />
                    </div>
                    </PassoDoFormulario>

                    {/*
                      Quando, dentro do dia, e o quanto importa.

                      O prazo diz o dia; o turno diz a parte do dia. Fora dos
                      dois ramos porque a pergunta é a mesma na área e no
                      ponto — e porque ela decide a ordem em que a equipe vê
                      as missões na rua, o que merece um passo próprio.
                    */}
                    <PassoDoFormulario
                      id="quando"
                      numero={3}
                      titulo="Quando e quanto importa"
                      descricao="turno e prioridade"
                    >
                      {creationModalType === "pin" && (
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Prazo (Opcional)
                          </label>
                          <input
                            type="date"
                            value={pinDate}
                            onChange={(e) => setPinDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>
                      )}

                      <TurnoEPrioridadeDaMissao
                        janelas={turnosDaCampanha}
                        turno={missaoTurno}
                        onTurno={setMissaoTurno}
                        prioridade={missaoPrioridade}
                        onPrioridade={setMissaoPrioridade}
                        niveis={niveisDePrioridade}
                      />
                    </PassoDoFormulario>

                    {/*
                      Para quem a missão vai.

                      Fora dos dois ramos de propósito: cliente, material e
                      equipe são a mesma pergunta na área e no ponto, e viviam
                      duplicados linha por linha nos dois.
                    */}
                    <PassoDoFormulario
                      id="destino"
                      numero={4}
                      titulo="Para quem vai"
                      descricao="cliente e equipe"
                    >
                      <DestinoDaMissao
                        clienteId={
                          creationModalType === "area"
                            ? areaCandidateId
                            : pinCandidateId
                        }
                        onClienteId={(id) => {
                          if (creationModalType === "area") setAreaCandidateId(id);
                          else setPinCandidateId(id);
                          setSelectedDeltas([]);
                        }}
                        clientes={candidates}
                        mostrarSeletor={selectedCandidateFilter === "all"}
                        clienteDoMapa={
                          selectedCandidateFilter !== "all"
                            ? selectedCandidateFilter
                            : ""
                        }
                        equipe={supporters}
                        selecionados={selectedDeltas}
                        onSelecionados={setSelectedDeltas}
                      />
                    </PassoDoFormulario>

                  </div>
                ) : (
                  <div className="py-6 text-center select-none">
                    <p className="text-xs text-slate-400 animate-pulse">
                      {creationLocationMode === "map"
                        ? "Clique no mapa para definir o local e prosseguir com os dados da criação"
                        : creationLocationMode === "search"
                          ? "Escolha o Bairro e a Rua acima para prosseguir com os dados da criação"
                          : "Escolha acima como quer definir o local da ação"}
                    </p>
                  </div>
                )}
                  </div>

                  {/* PRÉVIA */}
                  <aside className="hidden xl:block border-l border-slate-100 bg-slate-50/40 p-4 overflow-y-auto">
                    <PreviaDaMissao
                      tipo={tipoDaMissaoEmEdicao}
                      titulo={tituloDaMissao}
                      descricao={descricaoDaMissao}
                      cor={corDaMissao}
                      tipoLabel={
                        creationModalType === "pin" && pinIconType
                          ? operationTypeLabel(pinIconType)
                          : undefined
                      }
                      bairro={
                        creationModalType === "area"
                          ? areaBairro
                          : creationBairroName || ""
                      }
                      raio={
                        creationModalType === "area"
                          ? Number(areaRadius) || undefined
                          : undefined
                      }
                      prazo={creationModalType === "pin" ? pinDate : undefined}
                      turno={missaoTurno}
                      janelas={turnosDaCampanha}
                      nivel={nivelDaMissao(missaoPrioridade)}
                      totalDeMaterial={materialMissao.length}
                      designados={nomesDesignados}
                      totalDaEquipe={equipeDoClienteDaMissao.length}
                    />
                  </aside>
                </div>

                {/* RODAPÉ: as ações, sempre à vista, fora da rolagem */}
                <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 flex flex-wrap gap-3 justify-end items-center">
                  {!creationLocationReady && (
                    <p className="mr-auto text-[11px] font-bold text-slate-400 leading-snug max-w-[340px]">
                      {creationLocationMode === "map"
                        ? "Clique no mapa para definir o local e seguir."
                        : creationLocationMode === "search"
                          ? "Escolha o bairro e a rua para seguir."
                          : "Escolha como quer definir o local da ação."}
                    </p>
                  )}
              {/* Excluir mora junto do resto: quem abriu a missão para
                  mexer nela também é quem decide tirá-la do mapa. */}
              {editandoNoModal && (
                <button
                  type="button"
                  onClick={() => {
                    if (creationModalType === "area") {
                      if (editingAreaId) deleteArea(editingAreaId);
                    } else if (editingPinId) {
                      deletePin(editingPinId);
                    }
                  }}
                  className="mr-auto px-3 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  descartarMaterialPendente();
                  if (creationModalType === "area") resetAreaForm();
                  else resetPinForm();
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-colors shadow-3xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isGeocoding}
                className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md ${
                  isGeocoding
                    ? "bg-slate-400 cursor-not-allowed opacity-80"
                    : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95 cursor-pointer"
                }`}
              >
                {isGeocoding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                    <span>Buscando Coordenadas...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                    <span>
                      {editandoNoModal
                        ? "Salvar alterações"
                        : creationLocationMode === "sem"
                          ? "Enviar missão à equipe"
                          : "Confirmar e criar no mapa"}
                    </span>
                  </>
                )}
              </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPARTILHAR LINK DE CHECK-IN MODAL */}
      <AnimatePresence>
        {isShareModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[3000]"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-4 relative text-slate-800 select-none"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200/50 flex items-center justify-center text-emerald-600">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-indigo-950 text-sm leading-tight uppercase tracking-wider">
                      Compartilhar Check-in
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Disponibilize o link de check-in rápido.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Informações explicativas */}
              <p className="text-xs text-slate-505 leading-relaxed">
                Os voluntários e coordenadores de panfletagem de rua carregam
                este link no celular para confirmar a sua localização (bairro,
                rua) e enviar a foto da ação em tempo real. Os check-ins
                aparecem instantaneamente no mapa consolidado do comitê.
              </p>

              {/* Display do Link */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-405">
                  Link de Check-in para Celular
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-600 truncate select-all">
                    {shareCheckInUrl || `${BASE_EQUIPE}/`}
                  </div>
                  <button
                    type="button"
                    disabled={!shareCheckInUrl}
                    onClick={() => {
                      if (!shareCheckInUrl) return;
                      navigator.clipboard
                        .writeText(shareCheckInUrl)
                        .then(() => {
                          triggerNotification(
                            `Link de check-in de ${shareCandidate?.name} copiado!`,
                            "success",
                          );
                        })
                        .catch(() => {
                          triggerNotification("Erro ao copiar link.", "error");
                        });
                    }}
                    className={`px-4 border font-bold text-xs rounded-xl transition-colors whitespace-nowrap shadow-md ${
                      shareCheckInUrl
                        ? "bg-indigo-600 hover:bg-indigo-700 border-indigo-750 text-white cursor-pointer active:scale-95 hover:shadow-lg"
                        : "bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    Copiar
                  </button>
                </div>

                {shareCandidate ? (
                  <p className="text-[10px] text-slate-400 leading-snug">
                    Os check-ins feitos por este link entram como{" "}
                    <span className="font-bold text-slate-600">
                      {shareCandidate.name}
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-600 font-semibold leading-snug">
                    Selecione um cliente no filtro do mapa para gerar o link.
                    Sem cliente, o check-in não teria a quem ser atribuído.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-1 justify-end">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-3xs"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUPABASE STATUS AND SQL SETUP MODAL */}
      <AnimatePresence>
        {showDatabaseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[3000]"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full p-6 flex flex-col gap-4 relative text-slate-800 select-none max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-105">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 border border-orange-200/50 flex items-center justify-center text-orange-600">
                    <Zap className="w-4 h-4 fill-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-indigo-950 text-sm leading-tight uppercase tracking-wider">
                      Integração do Banco de Dados
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Sincronização de Pins, Check-ins e Áreas em tempo real.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDatabaseModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block pb-1">
                    Status da Chave
                  </span>
                  {isDatabaseConfigured ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <strong className="text-emerald-700 text-xs font-bold uppercase">
                        Credenciais Conectadas
                      </strong>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <strong className="text-rose-700 text-xs font-bold uppercase">
                          Credenciais Ausentes
                        </strong>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        Preencha as credenciais do banco de dados nas
                        variáveis de ambiente da hospedagem.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block pb-1">
                    Tabelas e Comunicação
                  </span>
                  {databaseError ? (
                    <div className="space-y-1 mt-0.5">
                      <div className="flex items-start gap-1 text-rose-700">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-bold uppercase block leading-tight">
                          Pendência de Estratégia
                        </span>
                      </div>
                      <p className="text-[10px] text-rose-500/90 leading-snug">
                        {databaseError}
                      </p>
                    </div>
                  ) : !isDatabaseConfigured ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
                      <strong className="text-slate-500 text-xs font-bold uppercase">
                        Aguardando Chaves...
                      </strong>
                    </div>
                  ) : isSyncingDatabase ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />
                      <strong className="text-slate-700 text-xs font-bold uppercase">
                        Consultando Tabelas...
                      </strong>
                    </div>
                  ) : (
                    <div className="space-y-0.5 mt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <strong className="text-emerald-750 text-xs font-bold uppercase">
                          Tabelas Comunicando
                        </strong>
                      </div>
                      <p className="text-[10px] text-slate-450 leading-none">
                        Pins, Áreas e Check-ins estão live!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sincronização Manual / Seed */}
              {isDatabaseConfigured && !databaseError && (
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl text-left space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-xs text-indigo-950 font-bold block">
                        Reenviar o que está na tela
                      </strong>
                      <p className="text-[10px] text-slate-550 leading-relaxed mt-0.5">
                        Regrava no banco as áreas, pins e check-ins que estão
                        carregados agora. Serve para recuperar uma gravação que
                        falhou — não traz de volta nada que já foi apagado.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsSyncingDatabase(true);
                        try {
                          for (const a of areas) {
                            await DatabaseService.upsertArea(a);
                          }
                          for (const p of pins) {
                            await DatabaseService.upsertPin(p);
                          }
                          for (const c of checkIns) {
                            await DatabaseService.upsertCheckIn(c);
                          }
                          triggerNotification(
                            "Todos os registros locais foram enviados ao banco!",
                            "success",
                          );
                        } catch (err: any) {
                          triggerNotification(
                            `Erro de Sincronia: ${err.message}`,
                            "error",
                          );
                        } finally {
                          setIsSyncingDatabase(false);
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1 min-w-[130px]"
                    >
                      {isSyncingDatabase ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-white" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <span>Enviar ao banco</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-3 pt-1 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDatabaseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-3xs"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sala de situação dos check-ins: metade da tela, ou tela cheia */}
      <PainelDeCheckIns
        aberto={salaDeSituacaoAberta}
        telaCheia={salaEmTelaCheia}
        onAlternarTelaCheia={() => setSalaEmTelaCheia((v) => !v)}
        onFechar={fecharSalaDeSituacao}
        checkIns={checkInsDoMapa}
        pins={pins.filter(
          (p) =>
            !clienteEmFoco ||
            clienteEmFoco === "all" ||
            p.candidateId === clienteEmFoco,
        )}
        areas={areas.filter(
          (a) =>
            !clienteEmFoco ||
            clienteEmFoco === "all" ||
            a.candidateId === clienteEmFoco,
        )}
        equipe={equipeDoMapa}
        operationTypes={operationTypes.filter(
          (t) =>
            !clienteEmFoco ||
            clienteEmFoco === "all" ||
            t.candidateId === clienteEmFoco,
        )}
        priorityLevels={niveisDePrioridade}
        pessoaDoCheckIn={pessoaDoCheckIn}
        janelasDeTurno={turnosDaCampanha}
        de={filtroDe}
        ate={filtroAte}
        rotuloDoPeriodo={rotuloDoPeriodo(filtroDe, filtroAte)}
        pessoasSelecionadas={filtroPessoas}
        onPessoa={(chave) =>
          setFiltroPessoas((atual) =>
            atual.includes(chave)
              ? atual.filter((c) => c !== chave)
              : [...atual, chave],
          )
        }
        niveisSelecionados={filtroNiveis}
        onNivel={(id) =>
          setFiltroNiveis((atual) =>
            atual.includes(id) ? atual.filter((n) => n !== id) : [...atual, id],
          )
        }
        tiposSelecionados={filtroTiposAcao}
        onTipo={(id) =>
          setFiltroTiposAcao((atual) =>
            atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id],
          )
        }
        onLimparFiltros={limparFiltrosDeCheckIn}
        /*
          O recorte de tempo da ficha de uma pessoa é o mesmo da barra de
          cima: um só relógio para a tela inteira, senão a lista conta um dia
          e o mapa continua contando o mês.
        */
        onPeriodo={(novoDe, novoAte) => {
          setFiltroDe(novoDe);
          setFiltroAte(novoAte);
        }}
        onIrParaCheckIn={(id) => {
          if (!id) return;
          setSelectedId(id);
          // Em tela cheia o mapa está atrás do painel: quem pede para ver o
          // lugar quer o mapa, não a ficha do painel por cima dele.
          setSalaEmTelaCheia(false);
        }}
      />

      {/* Mapa Mental: metade direita da tela, ou tela cheia */}
      <MindMapPanel
        open={isMindMapOpen}
        fullscreen={isMindMapFullscreen}
        onToggleFullscreen={() => setIsMindMapFullscreen((prev) => !prev)}
        onClose={closeMindMap}
      />
    </div>
  );
}
