import React, { useState, useEffect } from "react";
import {
  fetchCepStreets,
  fetchOsmStreets,
  mergeStreetLists,
  StreetOption,
} from "./services/streetSources";
import {
  CandidateLocation,
  resolveCandidateLocation,
} from "./services/candidateLocation";
import {
  MapPin,
  Users,
  Layers,
  Flag,
  Megaphone,
  Star,
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
  Building2,
  ChevronDown,
  Loader2,
  Phone,
  Lock,
  ArrowRight,
  LogOut,
  Camera,
  Image,
  Instagram,
  Mail,
  PlusCircle,
  ChevronLeft,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import MapContainer, { NEIGHBORHOOD_DATA } from "./components/MapContainer";
import {
  PanfletagemArea,
  CampaignPin,
  CheckIn,
  BairroData,
  MACEIO_BAIRROS,
  PRESET_COLORS,
  PIN_ICONS,
  Candidate,
  Party,
} from "./types";
import {
  SupabaseService,
  isSupabaseConfigured,
  SUPABASE_SQL_SETUP,
  supabase,
} from "./supabaseClient";

const INITIAL_PARTIES: Party[] = [
  {
    id: "party-1",
    name: "Solidariedade",
    initials: "SD",
    logo_url:
      "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/SD_LOGO.png",
  },
  {
    id: "party-2",
    name: "Partido Progressistas",
    initials: "PP",
    logo_url:
      "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PP_LOGO.png",
  },
  {
    id: "party-3",
    name: "Partido Liberal",
    initials: "PL",
    logo_url:
      "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PL_LOGO.png",
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

/** Compara nomes de município ignorando acento e caixa. */
const normalizeCityName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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

export default function App() {
  // Primary state loaded from LocalStorage
  const [areas, setAreas] = useState<PanfletagemArea[]>(() => {
    const saved = localStorage.getItem("campaign_map_areas");
    return saved ? JSON.parse(saved) : INITIAL_AREAS;
  });

  const [pins, setPins] = useState<CampaignPin[]>(() => {
    const saved = localStorage.getItem("campaign_map_pins");
    return saved ? JSON.parse(saved) : INITIAL_PINS;
  });

  const [checkIns, setCheckIns] = useState<CheckIn[]>(() => {
    const saved = localStorage.getItem("campaign_map_checkins");
    return saved ? JSON.parse(saved) : INITIAL_CHECK_INS;
  });

  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const saved = localStorage.getItem("campaign_candidates");
    return saved ? JSON.parse(saved) : INITIAL_CANDIDATES;
  });

  const [adminTab, setAdminTab] = useState<"candidates" | "map">("candidates");
  const [selectedCandidateFilter, setSelectedCandidateFilter] =
    useState<string>("all");

  /**
   * Estado e município do candidato em foco, usados como ponto de partida do
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
  const getPartidoBadge = (cand: Candidate) => {
    if (!cand)
      return {
        name: "",
        logo: "",
        fullName: "",
        color: "bg-slate-100 text-slate-700 border-slate-200",
      };
    const officeUpper = (cand.office || "").toUpperCase();
    const nameUpper = (cand.name || "").toUpperCase();

    // Procura primeiro correspondência em nossa lista de partidos ativa do Supabase/LocalStorage
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
      SD: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/SD_LOGO.png",
      PP: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PP_LOGO.png",
      PL: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PL_LOGO.png",
      PT: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PT_LOGO.png",
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
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [partyEditing, setPartyEditing] = useState<Party | null>(null);
  const [partyName, setPartyName] = useState("");
  const [partyInitials, setPartyInitials] = useState("");
  const [partyLogoUrl, setPartyLogoUrl] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [inspectedParty, setInspectedParty] = useState<Party | null>(null);
  const [inspectedCandidate, setInspectedCandidate] =
    useState<Candidate | null>(null);
  const [supporters, setSupporters] = useState<any[]>(() => {
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
  const [isAddingSupporter, setIsAddingSupporter] = useState(false);
  const [newSupName, setNewSupName] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");

  // UI state variables
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "areas" | "pins" | "statistics" | "checkins"
  >("areas");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<"all" | "checkins" | "markers">(
    "all",
  );

  // Modo de visualização (admin / checkin)
  const [currentUrlView, setCurrentUrlView] = useState<"admin" | "checkin">(
    "admin",
  );

  // Supabase Supporter Auth for Check-In
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

  // Dialog de confirmação customizado no centro da tela
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
    },
  ) => {
    setCustomConfirm({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setCustomConfirm(null);
      },
      onCancel: () => {
        if (options?.onCancel) options.onCancel();
        setCustomConfirm(null);
      },
      confirmText: options?.confirmText || "Confirmar",
      cancelText: options?.cancelText || "Cancelar",
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
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);
  const [checkInFile, setCheckInFile] = useState<File | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
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

    const rawCity = activeCand.estado || activeCand.city || "";
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

  // Supabase Sync States
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [showSupabaseSqlModal, setShowSupabaseSqlModal] = useState(false);

  // Monitorar query parameter e caminhos para entrar no modo check-in (com suporte a checkin/slug)
  useEffect(() => {
    const handleUrlCheck = () => {
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      const pathParts = pathname.split("/").filter(Boolean);

      let isCheckIn = params.get("view") === "checkin";
      let candidateSlugOrId =
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
          // Encontra o candidato por ID ou por slug de nome
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

  // Sync / Load data from Supabase on mount
  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.log(
        "Supabase não está configurado nas Secrets (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). Utilizando armazenamento local.",
      );
      return;
    }

    const loadAllFromSupabase = async () => {
      setIsSyncingSupabase(true);
      setSupabaseError(null);
      const res = await SupabaseService.fetchAll();
      if (res.success && res.data) {
        const {
          areas: fetchedAreas,
          pins: fetchedPins,
          checkins: fetchedCheckins,
        } = res.data;

        // If Supabase tables are completely empty, let's pre-populate them with our current local storage or initial data
        if (
          fetchedAreas.length === 0 &&
          fetchedPins.length === 0 &&
          fetchedCheckins.length === 0
        ) {
          console.log(
            "Supabase está configurado mas as tabelas estão vazias. Inicializando Supabase com dados locais...",
          );
          // Upsert current areas
          for (const a of areas) {
            await SupabaseService.upsertArea(a);
          }
          // Upsert current pins
          for (const p of pins) {
            await SupabaseService.upsertPin(p);
          }
          // Upsert current checkins
          for (const c of checkIns) {
            await SupabaseService.upsertCheckIn(c);
          }
          triggerNotification(
            "Tabelas do Supabase inicializadas com os dados locais!",
            "success",
          );
        } else {
          // Update React states with Supabase data
          if (fetchedAreas.length > 0) setAreas(fetchedAreas);
          if (fetchedPins.length > 0) setPins(fetchedPins);
          if (fetchedCheckins.length > 0) setCheckIns(fetchedCheckins);
        }

        // Also fetch candidates
        try {
          const candRes = await SupabaseService.fetchCandidates();
          if (candRes.success && candRes.data) {
            if (candRes.data.length > 0) {
              setCandidates(candRes.data);
            } else {
              // Send default ones to Supabase
              for (const cand of candidates) {
                await SupabaseService.upsertCandidate(cand);
              }
            }
          }
        } catch (error) {
          console.warn(
            "Erro ao carregar candidatos do Supabase no mount:",
            error,
          );
        }

        // Also fetch parties
        try {
          const partyRes = await SupabaseService.fetchParties();
          if (partyRes.success && partyRes.data) {
            if (partyRes.data.length > 0) {
              setParties(partyRes.data);
            } else {
              // Send default initial ones to Supabase
              for (const p of INITIAL_PARTIES) {
                await SupabaseService.upsertParty(p);
              }
              const partyResReloaded = await SupabaseService.fetchParties();
              if (partyResReloaded.success && partyResReloaded.data) {
                setParties(partyResReloaded.data);
              }
            }
          }
        } catch (error) {
          console.warn(
            "Erro ao carregar partidos do Supabase no mount:",
            error,
          );
        }

        // Also fetch supporters
        try {
          const supRes = await SupabaseService.fetchSupporters();
          if (supRes.success && supRes.data) {
            setSupporters(supRes.data);
          }
        } catch (error) {
          console.warn(
            "Erro ao carregar apoiadores do Supabase no mount:",
            error,
          );
        }
      } else if (res.error) {
        setSupabaseError(res.error);
        triggerNotification(res.error, "error");
      }
      setIsSyncingSupabase(false);
    };

    loadAllFromSupabase();
  }, []); // Only on mount

  // Escuta em Realtime das alterações do Supabase para manter tudo sincronizado de forma instantânea
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel("realtime_campaign_data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "check_ins" },
        (payload: any) => {
          console.log("Sincronização em Tempo Real (Check-In):", payload);
          if (payload.eventType === "INSERT") {
            const newCheckIn = payload.new as CheckIn;
            setCheckIns((prev) => {
              if (prev.some((c) => c.id === newCheckIn.id)) return prev;
              return [newCheckIn, ...prev];
            });
            triggerNotification(
              `Novo Check-in registrado por ${newCheckIn.name}!`,
              "success",
            );
          } else if (payload.eventType === "UPDATE") {
            const updatedCheckIn = payload.new as CheckIn;
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
            const newArea = payload.new as PanfletagemArea;
            setAreas((prev) => {
              if (prev.some((a) => a.id === newArea.id)) return prev;
              return [...prev, newArea];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedArea = payload.new as PanfletagemArea;
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
            const newPin = payload.new as CampaignPin;
            setPins((prev) => {
              if (prev.some((p) => p.id === newPin.id)) return prev;
              return [...prev, newPin];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedPin = payload.new as CampaignPin;
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
      supabase.removeChannel(channel);
    };
  }, []);

  // Coordinating map selecting interaction
  const [clickToPickCoords, setClickToPickCoords] = useState(false);
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
  const [areaBairro, setAreaBairro] = useState("Ponta Verde");
  const [areaRadius, setAreaRadius] = useState(500); // 500 meters default
  const [areaColor, setAreaColor] = useState("#2563eb");
  const [areaTeamSize, setAreaTeamSize] = useState<number>(10);
  const [areaContact, setAreaContact] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [areaCandidateId, setAreaCandidateId] = useState<string>("");
  const [selectedDeltas, setSelectedDeltas] = useState<string[]>([]);

  // Forms state variables (Pin)
  const [pinTitle, setPinTitle] = useState("");
  const [pinDescription, setPinDescription] = useState("");
  const [pinColor, setPinColor] = useState("#ea580c");
  const [pinIconType, setPinIconType] = useState<
    "flag" | "megaphone" | "star" | "group" | "home" | "sound"
  >("flag");
  const [pinDate, setPinDate] = useState("");
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [pinCandidateId, setPinCandidateId] = useState<string>("");

  /**
   * Candidato que dita o padrão de estado e município.
   *
   * Dentro do formulário vale o candidato escolhido nele; fora, vale o
   * candidato filtrado no mapa. Sem candidato em foco, não há padrão.
   */
  const locationCandidateId =
    (creationModalType === "area" ? areaCandidateId : "") ||
    (creationModalType === "pin" ? pinCandidateId : "") ||
    (selectedCandidateFilter !== "all" ? selectedCandidateFilter : "");

  // Descobre estado e município do candidato em foco.
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
        candidate.estado || candidate.city,
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

  // Casa o município que ainda está só pelo nome — o do candidato, por exemplo
  // — com o registro oficial, que é quem traz o código IBGE usado para listar
  // os bairros. Fica em efeito próprio porque precisa rodar tanto quando a
  // lista de municípios chega quanto quando o candidato muda sem trocar de
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
   * Código IBGE do município do candidato, quando ele já aparece na lista de
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
   * Devolve os seletores ao padrão do candidato em foco. Sem candidato, cai no
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

  // Aplica esse padrão aos seletores. Roda quando o candidato em foco muda, e
  // não a cada render, então a escolha manual do usuário é preservada até ele
  // trocar de candidato.
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

  // 0.9 Sincronizar apoiador com o Supabase quando carregar a tela de checkin
  useEffect(() => {
    if (
      currentUrlView !== "checkin" ||
      !isSupabaseConfigured ||
      !authenticatedSupporter?.whatsapp
    )
      return;

    const syncSupporterData = async () => {
      try {
        const cleanWhatsapp = authenticatedSupporter.whatsapp.replace(
          /\D/g,
          "",
        );
        const res = await SupabaseService.checkSupporter(cleanWhatsapp);
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
          "Erro ao sincronizar dados do apoiador com o Supabase:",
          err,
        );
      }
    };

    syncSupporterData();
  }, [currentUrlView, isSupabaseConfigured]);

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

    const rawCity = activeCand.estado || activeCand.city || "";
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

  // Save to localstorage on change
  useEffect(() => {
    localStorage.setItem("campaign_map_areas", JSON.stringify(areas));
  }, [areas]);

  useEffect(() => {
    localStorage.setItem("campaign_map_pins", JSON.stringify(pins));
  }, [pins]);

  useEffect(() => {
    localStorage.setItem("campaign_map_checkins", JSON.stringify(checkIns));
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
    if (pickedCoords) {
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
    }
  }, [pickedCoords]);

  // Handle when Bairro selection dropdown is changed in Area Form
  const handleBairroChange = (bairroName: string) => {
    setAreaBairro(bairroName);
    const selected = MACEIO_BAIRROS.find((b) => b.name === bairroName);
    if (selected) {
      setPickedCoords({ lat: selected.lat, lng: selected.lng });
      if (selected.description && !areaDescription) {
        setAreaDescription(
          `Ações focadas no bairro ${selected.name}. ${selected.description}`,
        );
      }
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

      // Preenchimento automático dinâmico e profissional do título e descrição
      const finalCity = creationCityName || "Maceió";
      const finalState = creationStateShortName || "AL";
      if (coordsPickingMode === "area") {
        setAreaTitle(`Equipe - ${ruaName}`);
        setAreaDescription(
          `Ações de panfletagem da equipe focadas na ${ruaName}, bairro ${creationBairroName}, ${finalCity} - ${finalState}.`,
        );
        setAreaBairro(creationBairroName);
      } else {
        setPinTitle(`Ponto - ${ruaName}`);
        setPinDescription(
          `Ponto estratégico de campanha política situado na ${ruaName}, ${creationBairroName}, ${finalCity} - ${finalState}.`,
        );
      }
    }
  };

  // Handle Pick Marker Mode trigger
  const startCoordinatesPicking = (type: "area" | "pin") => {
    setCoordsPickingMode(type);
    setClickToPickCoords(true);
    triggerNotification(
      "Selecione uma localização clicando diretamente em qualquer lugar no mapa.",
      "info",
    );
  };

  // Submit and form actions for Area
  const saveArea = (e: React.FormEvent) => {
    e.preventDefault();

    if (!areaTitle) {
      triggerNotification("Falta preencher o título da equipe!", "error");
      return;
    }

    const targetCoords = pickedCoords || { lat: -9.6548, lng: -35.715 }; // Default Maceió Centro

    if (editingAreaId) {
      // Edit existing
      const existingArea = areas.find((a) => a.id === editingAreaId);
      const updatedArea: PanfletagemArea = {
        id: editingAreaId,
        title: areaTitle,
        description: areaDescription,
        bairro: areaBairro,
        center: { ...targetCoords, assignedDeltas: selectedDeltas },
        radius: areaRadius,
        color: areaColor,
        active: existingArea ? existingArea.active : true,
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
      if (isSupabaseConfigured) {
        SupabaseService.upsertArea(updatedArea).then((res) => {
          if (!res.success)
            triggerNotification(`Supabase: ${res.error}`, "error");
        });
      }
      triggerNotification(
        "Área de panfletagem editada com sucesso!",
        "success",
      );
      setEditingAreaId(null);
    } else {
      // Create new
      const newArea: PanfletagemArea = {
        id: "area_" + Math.random().toString(36).substr(2, 9),
        title: areaTitle,
        description: areaDescription || "Sem detalhes fornecidos.",
        bairro: areaBairro,
        center: { ...targetCoords, assignedDeltas: selectedDeltas },
        radius: areaRadius,
        color: areaColor,
        active: true,
        teamSize: Number(areaTeamSize) || 5,
        contactName: areaContact || "Coordenador Local",
        createdAt: new Date().toISOString(),
        candidateId: areaCandidateId || undefined,
        assignedDeltas: selectedDeltas,
      };
      setAreas((prev) => [newArea, ...prev]);
      if (isSupabaseConfigured) {
        SupabaseService.upsertArea(newArea).then((res) => {
          if (!res.success)
            triggerNotification(`Supabase: ${res.error}`, "error");
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
    setAreaTitle("");
    setAreaDescription("");
    setAreaRadius(500);
    setAreaColor("#2563eb");
    setAreaTeamSize(10);
    setAreaContact("");
    setPickedCoords(null);
    setEditingAreaId(null);
    setAreaCandidateId("");
    setSelectedDeltas([]);
    setCreationBairroName(null);
    setCreationRuaName(null);
    setCreationModalType(null);
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

  // Submit and Form actions for Strategic Pin
  const savePin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pinTitle) {
      triggerNotification("Preencha o título do Ponto Estratégico!", "error");
      return;
    }

    const targetCoords = pickedCoords || { lat: -9.66, lng: -35.72 };

    if (editingPinId) {
      // Edit existing
      const existingPin = pins.find((p) => p.id === editingPinId);
      const updatedPin: CampaignPin = {
        id: editingPinId,
        title: pinTitle,
        description: pinDescription,
        position: { ...targetCoords, assignedDeltas: selectedDeltas },
        color: pinColor,
        iconType: pinIconType,
        active: existingPin ? existingPin.active : true,
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
      if (isSupabaseConfigured) {
        SupabaseService.upsertPin(updatedPin).then((res) => {
          if (!res.success)
            triggerNotification(`Supabase: ${res.error}`, "error");
        });
      }
      triggerNotification("Ponto estratégico editado!", "success");
      setEditingPinId(null);
    } else {
      // Create new
      const newPin: CampaignPin = {
        id: "pin_" + Math.random().toString(36).substr(2, 9),
        title: pinTitle,
        description: pinDescription || "",
        position: { ...targetCoords, assignedDeltas: selectedDeltas },
        color: pinColor,
        iconType: pinIconType,
        active: true,
        createdAt: new Date().toISOString(),
        date: pinDate || undefined,
        candidateId: pinCandidateId || undefined,
        assignedDeltas: selectedDeltas,
      };
      setPins((prev) => [newPin, ...prev]);
      if (isSupabaseConfigured) {
        SupabaseService.upsertPin(newPin).then((res) => {
          if (!res.success)
            triggerNotification(`Supabase: ${res.error}`, "error");
        });
      }
      triggerNotification(
        "Novo ponto estratégico (Pin) adicionado ao mapa!",
        "success",
      );
    }

    resetPinForm();
  };

  const resetPinForm = () => {
    setPinTitle("");
    setPinDescription("");
    setPinColor("#ea580c");
    setPinIconType("flag");
    setPinDate("");
    setPickedCoords(null);
    setEditingPinId(null);
    setPinCandidateId("");
    setSelectedDeltas([]);
    setCreationBairroName(null);
    setCreationRuaName(null);
    setCreationModalType(null);
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

  // Handler for list actions
  const toggleAreaActive = (id: string) => {
    setAreas((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const updated = { ...a, active: !a.active };
          if (isSupabaseConfigured) {
            SupabaseService.upsertArea(updated).then((res) => {
              if (!res.success)
                triggerNotification(`Supabase: ${res.error}`, "error");
            });
          }
          return updated;
        }
        return a;
      }),
    );
    triggerNotification("Visibilidade da área alterada", "info");
  };

  const togglePinActive = (id: string) => {
    setPins((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, active: !p.active };
          if (isSupabaseConfigured) {
            SupabaseService.upsertPin(updated).then((res) => {
              if (!res.success)
                triggerNotification(`Supabase: ${res.error}`, "error");
            });
          }
          return updated;
        }
        return p;
      }),
    );
    triggerNotification("Visibilidade do pin alterada", "info");
  };

  const deleteArea = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta área de panfletagem?")) {
      setAreas((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) setSelectedId(null);
      if (isSupabaseConfigured) {
        SupabaseService.deleteArea(id).then((res) => {
          if (!res.success)
            triggerNotification(`Supabase: ${res.error}`, "error");
        });
      }
      triggerNotification("Área de panfletagem removida", "success");
    }
  };

  const deletePin = (id: string) => {
    if (confirm("Deseja realmente remover este ponto estratégico?")) {
      setPins((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) setSelectedId(null);
      if (isSupabaseConfigured) {
        SupabaseService.deletePin(id).then((res) => {
          if (!res.success)
            triggerNotification(`Supabase: ${res.error}`, "error");
        });
      }
      triggerNotification("Ponto estratégico removido", "success");
    }
  };

  const startEditArea = (area: PanfletagemArea) => {
    setActiveTab("areas");
    setSelectedId(area.id);
    setEditingAreaId(area.id);
    setAreaTitle(area.title);
    setAreaDescription(area.description);
    setAreaBairro(area.bairro);
    setAreaRadius(area.radius);
    setAreaColor(area.color);
    setAreaTeamSize(area.teamSize || 10);
    setAreaContact(area.contactName || "");
    setPickedCoords(area.center);
    setAreaCandidateId(area.candidateId || "");
    setSelectedDeltas(area.assignedDeltas || area.center?.assignedDeltas || []);
    triggerNotification("Carregado dados para edição da área!", "info");
  };

  const startEditPin = (pin: CampaignPin) => {
    setActiveTab("pins");
    setSelectedId(pin.id);
    setEditingPinId(pin.id);
    setPinTitle(pin.title);
    setPinDescription(pin.description || "");
    setPinColor(pin.color);
    setPinIconType(pin.iconType);
    setPinDate(pin.date || "");
    setPickedCoords(pin.position);
    setPinCandidateId(pin.candidateId || "");
    setSelectedDeltas(pin.assignedDeltas || pin.position?.assignedDeltas || []);
    triggerNotification(
      "Carregado dados para edição do ponto estratégico!",
      "info",
    );
  };

  const triggerCreateArea = () => {
    resetAreaForm();
    if (selectedCandidateFilter !== "all") {
      setAreaCandidateId(selectedCandidateFilter);
    }
    setSelectedId(null);
    setCreationBairroName(null);
    setCreationRuaName(null);
    setPickedCoords(null);
    setActiveTab("areas");
    setIsSidebarOpen(false); // Do not open right sidebar
    setClickToPickCoords(false); // Do not start map clicking
    setCoordsPickingMode("area");
    setCreationModalType("area"); // Open modal in the center of the screen
  };

  const triggerCreatePin = () => {
    resetPinForm();
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
    setCreationModalType("pin"); // Open modal in the center of the screen
  };

  // Search filtered actions
  const filteredAreas = areas.filter((a) => {
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
    // Retringir missões atribuídas a membros específicos do Time Delta
    if (currentUrlView === "checkin" && authenticatedSupporter) {
      const assigned = a.assignedDeltas || a.center?.assignedDeltas || [];
      if (
        assigned.length > 0 &&
        !assigned.includes(authenticatedSupporter.id)
      ) {
        return false;
      }
    }
    return (
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.bairro.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredPins = pins.filter((p) => {
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
    // Retringir pinos táticos atribuídos a membros específicos do Time Delta
    if (currentUrlView === "checkin" && authenticatedSupporter) {
      const assigned = p.assignedDeltas || p.position?.assignedDeltas || [];
      if (
        assigned.length > 0 &&
        !assigned.includes(authenticatedSupporter.id)
      ) {
        return false;
      }
    }
    return (
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredCheckIns = checkIns.filter((c) => {
    const activeCandidate =
      currentUrlView === "checkin"
        ? checkInCandidateId
        : selectedCandidateFilter;
    if (
      activeCandidate &&
      activeCandidate !== "all" &&
      c.candidateId !== activeCandidate
    ) {
      return false;
    }
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.bairro || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.rua || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Statistics Computations
  const totalVolunteers = filteredAreas.reduce(
    (sum, a) => sum + (a.active ? a.teamSize || 0 : 0),
    0,
  );
  const totalStrategicPlaces = filteredPins.filter((p) => p.active).length;
  // Area in square meters: pi * r^2
  const totalAreaCoveredM2 = filteredAreas.reduce(
    (sum, a) => sum + (a.active ? Math.PI * Math.pow(a.radius, 2) : 0),
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

  // Funções para manipulação de check-in
  const handleCheckInBairroChange = (bName: string) => {
    setCheckInBairro(bName);
    setCheckInRua("");
  };

  const handleCheckInFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        triggerNotification("A imagem deve ter menos de 5MB.", "error");
        return;
      }
      setCheckInFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCheckInPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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

    const handleCheckInSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkInName.trim()) {
        triggerNotification("Por favor, digite seu nome.", "error");
        return;
      }
      if (!checkInCandidateId) {
        triggerNotification(
          "Por favor, selecione quem é o seu candidato.",
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

      setIsSubmittingCheckIn(true);

      // Obter localização física exata do dispositivo via API Geolocation do navegador
      let userLat: number | undefined = prefetchedLatitude;
      let userLng: number | undefined = prefetchedLongitude;

      if (!userLat || !userLng) {
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
              });
            });
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            setPrefetchedLatitude(userLat);
            setPrefetchedLongitude(userLng);
          } catch (geoErr: any) {
            console.warn("Could not capture user exact position on submit:", geoErr);
            let errorMsg = "Não foi possível obter sua localização exata por GPS.";
            if (geoErr.code === 1) {
              errorMsg = "Permissão de localização negada pelo navegador. Ative o acesso ao GPS para capturar a geolocalização física real.";
            } else if (geoErr.code === 2) {
              errorMsg = "Sinal de GPS fraco ou indisponível no dispositivo.";
            } else if (geoErr.code === 3) {
              errorMsg = "Tempo esgotado para obter a localização via GPS.";
            }
            triggerNotification(errorMsg, "info");
          }
        } else {
          triggerNotification("A geolocalização por navegador não é suportada nesta máquina.", "info");
        }
      }

      // Geocodificação aproximada baseada na rua, bairro e município selecionados
      let checkInCoords = { lat: -9.6548, lng: -35.715 }; // Default Maceió Centro
      const stateCode = checkInEstadoUf || "AL";
      const cityName = checkInMunicipio;

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

      let uploadedPhotoUrl = checkInPhoto;

      if (isSupabaseConfigured && checkInFile) {
        try {
          const uploadRes = await SupabaseService.uploadImage(checkInFile);
          if (uploadRes.success && uploadRes.url) {
            uploadedPhotoUrl = uploadRes.url;
          } else {
            console.warn(
              "Upload falhou, usando imagem local:",
              uploadRes.error,
            );
          }
        } catch (uploadErr) {
          console.error("Erro ao fazer upload da foto:", uploadErr);
        }
      }

      const newCheckIn: CheckIn = {
        id: "checkin_" + Math.random().toString(36).substr(2, 9),
        name: checkInName,
        bairro: checkInBairro,
        rua: checkInRua,
        municipio: checkInMunicipio,
        estado: checkInEstado,
        photo: uploadedPhotoUrl || undefined,
        coordinates: checkInCoords, // Dropdown selection coordinates for the map
        userLatitude: userLat,      // Real user physical device latitude
        userLongitude: userLng,     // Real user physical device longitude
        createdAt: new Date().toISOString(),
        candidateId: checkInCandidateId || undefined,
      };

      if (isSupabaseConfigured) {
        const res = await SupabaseService.upsertCheckIn(newCheckIn);
        if (!res.success) {
          console.error("Erro ao salvar check-in no Supabase:", res.error);
          triggerNotification(`Erro ao Salvar no Banco: ${res.error || "Erro desconhecido"}. Verifique se a tabela check_ins foi criada corretamente em seu Supabase.`, "error");
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
          const supRes = await SupabaseService.upsertSupporter(supporterPayload);
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
      setCheckInPhoto(null);
      setCheckInFile(null);
      setCheckInSuccess(false);
      setCheckInCandidateId("");
      setCheckInMunicipio("Maceió");
      setCheckInMunicipioIbgeId(2704302);
      setCheckInDistrictId(null);
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

        if (!isSupabaseConfigured) {
          triggerNotification(
            "Supabase não configurado. Entrando em modo demonstração.",
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

        setIsVerifyingLogin(true);
        const res = await SupabaseService.checkSupporter(contactInput);
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

          // Validação: de qual base de candidato o apoiador faz parte?
          if (
            checkInCandidateId &&
            String(sCandId) !== String(checkInCandidateId)
          ) {
            const currentCandidate = candidates.find(
              (c) => c.id === checkInCandidateId,
            );
            const candidateName = currentCandidate
              ? currentCandidate.name
              : "este candidato";
            triggerNotification(
              `Este número não foi encontrado na base de apoiadores do candidato ${candidateName}.`,
              "error",
            );
            return;
          }

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
        <div className="min-h-screen w-full bg-[#DBE2E9] text-slate-800 flex flex-col justify-center items-center p-4 selection:bg-indigo-650 selection:text-white font-sans">
          {/* Toast Notification HUD no modo Login */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] max-w-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-indigo-500/20 bg-indigo-600 text-white"
              >
                <Check className="w-5 h-5 flex-shrink-0 text-emerald-300" />
                <span className="text-xs font-semibold">
                  {notification.text}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logo & Header info conforme solicitado pelo usuário */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center mb-6 text-center select-none"
          >
            {partyInfo ? (
              <>
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center p-1.5 shadow-lg border border-slate-100 mb-3">
                  {partyInfo.logo ? (
                    <img
                      src={partyInfo.logo}
                      alt={`Logo ${partyInfo.name}`}
                      className="w-full h-full object-contain rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#0D233A] flex items-center justify-center text-white font-extrabold text-xl">
                      {partyInfo.name}
                    </div>
                  )}
                </div>
                <h1 className="font-extrabold text-[#0D233A] text-[32px] tracking-tight leading-none font-sans">
                  {partyInfo.fullName || partyInfo.name}
                </h1>
                <p className="text-[11px] font-black tracking-[0.22em] text-[#5A6E85] uppercase mt-2.5 font-sans">
                  Eleições 2026
                </p>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center p-1.5 shadow-lg border border-[#FDEBDD] mb-3">
                  <img
                    src="https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/ChatGPT%20Image%2017%20de%20jun.%20de%202026,%2016_27_00.png"
                    alt="Logo Solidariedade"
                    className="w-full h-full object-contain rounded-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h1 className="font-extrabold text-[#F58220] text-[32px] tracking-tight leading-none font-sans">
                  Solidariedade
                </h1>
                <p className="text-[11px] font-black tracking-[0.22em] text-[#F58220]/85 uppercase mt-2.5 font-sans">
                  Eleições 2026
                </p>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[460px] w-full bg-white rounded-[3rem] shadow-2xl p-8 md:p-10 border border-slate-100 flex flex-col gap-6 relative overflow-hidden"
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
              {/* Floating circular bubble with WhatsApp icon */}
              <div className="absolute right-14 top-14 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100 transform -rotate-12">
                <div className="w-9 h-9 rounded-full border border-[#F58220]/20 flex items-center justify-center text-[#F58220] bg-white">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.004 0C5.378 0 .004 5.374.004 12c0 2.112.551 4.164 1.597 5.975L0 24l6.195-1.624c1.743.951 3.7 1.455 5.805 1.455 6.626 0 12-5.374 12-12s-5.374-12-12-12zm6.182 16.924c-.254.715-1.254 1.302-1.802 1.385-.497.075-.989.135-3.178-.711-2.793-1.082-4.593-3.924-4.733-4.11-.14-.186-1.121-1.488-1.121-2.84 0-1.353.702-2.013.952-2.28.25-.268.543-.332.723-.332.18 0 .36.002.518.01.164.007.382-.061.6.467.222.54.764 1.86.83 1.992.067.133.111.288.022.465-.088.177-.133.288-.266.442-.132.155-.278.347-.397.466-.134.133-.274.279-.118.547.155.267.69 1.135 1.482 1.84.1.088.2.176.3.262 1.02.88 1.84 1.155 2.156 1.314.316.159.5.133.687-.08.188-.213.803-.93.102-1.25-.111-.055-.66-.464-.66-.464s-.104-.087-.194-.038c-.09.049-.575.281-.652.32-.077.039-.155.058-.232.019-.078-.039-.328-.124-.627-.393-.243-.213-.615-.558-.87-1.02-.078-.143-.01-.22.068-.298.077-.078.188-.221.288-.332.1-.11.133-.188.199-.31.066-.122.033-.232-.016-.331-.05-.1-.443-1.062-.607-1.459-.16-.39-.325-.337-.442-.343-.114-.006-.244-.007-.375-.007s-.343.049-.523.243c-.18.194-.687.671-.687 1.636s.702 1.895.8 2.027c.098.132 1.38 2.109 3.344 2.96.468.203.832.324 1.116.417.47.148.898.127 1.237.076.378-.057 1.157-.473 1.319-.93z" />
                  </svg>
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

            {/* Header Content */}
            <div className="space-y-2 mt-2 select-none text-left max-w-[280px]">
              <h2 className="font-extrabold text-[#0D233A] text-3xl md:text-4xl tracking-tight leading-tight">
                Bem-vindo(a)!
              </h2>
              <p className="text-[14px] text-[#5A6E85] font-semibold leading-relaxed">
                Para continuar, valide seu acesso com o WhatsApp cadastrado.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
              {/* Styled gray input panel box */}
              <div className="bg-[#F6F8FA] rounded-[1.8rem] p-6 border border-slate-100/50 space-y-3.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-[#8292A1] ml-1">
                  Telefone (WhatsApp)
                </label>

                <div className="relative shadow-xs rounded-2xl bg-white border border-[#E1E8ED] flex items-center px-4 overflow-hidden focus-within:ring-2 focus-within:ring-[#F58220]/30 focus-within:border-[#F58220] transition-all">
                  <span className="text-[#A5B4C2] mr-3">
                    <Phone className="w-5 h-5 text-[#F58220]/75" />
                  </span>
                  <input
                    type="text"
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
                    className="w-full py-4 bg-transparent border-none text-[15px] font-bold text-[#0D233A] placeholder-[#C2D0DC] focus:outline-hidden"
                  />
                </div>

                <div className="text-[11px] text-[#8292A1] flex items-center gap-2 font-medium leading-normal ml-1 select-none">
                  <Users className="w-4 h-4 text-[#A5B4C2] flex-shrink-0" />
                  <span>
                    Usaremos seu número apenas para validar seu acesso.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isVerifyingLogin ||
                  loginWhatsapp.replace(/\D/g, "").length < 10
                }
                className="w-full py-4.5 bg-[#F58220] hover:bg-[#E06E10] focus:ring-4 focus:ring-[#F58220]/20 disabled:bg-[#C2D0DC] disabled:cursor-not-allowed text-white font-extrabold text-[#FFF] text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-4"
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

            {!isSupabaseConfigured && (
              <div className="mt-1 pt-4 border-t border-slate-100/80 space-y-2">
                <p className="text-[10.5px] text-zinc-500 leading-normal bg-[#FAFAD2]/60 p-3 rounded-2xl border border-[#FAFAD2] text-left font-sans">
                  ⚠️ <strong>Integração Offline:</strong> VITE_SUPABASE_URL não
                  foi preenchido. Caso queira testar o fluxo de login de forma
                  simulada, use o botão de demonstração:
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
          </motion.div>
        </div>
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
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-450 block leading-none">
                Apoiador Conectado
              </span>
              <strong className="text-slate-800 text-xs font-bold leading-tight block mt-1">
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
                  <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Sua presença e foto foram marcadas com sucesso no mapa
                    consolidado do comitê. Obrigado!
                  </p>
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
                  {checkInPhoto && (
                    <div className="pt-3 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-3xs flex-shrink-0">
                        <img
                          src={checkInPhoto}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-semibold font-sans">
                        Foto anexada e enviada!
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
                      Valide sua presença no local designado.
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
                {isSupabaseConfigured ? (
                  supabaseError ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-left">
                      <div className="flex gap-2.5 items-start">
                        <span className="text-xl">⚠️</span>
                        <div className="font-sans select-none">
                          <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest">Erro de Banco de Dados</h4>
                          <p className="text-[10px] text-rose-600 font-bold mt-1 leading-relaxed">
                            O Supabase está configurado, mas houve um erro ao sincronizar os dados: <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-[9px] font-extrabold">{supabaseError}</code>. 
                            Verifique se a tabela <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-[9px] font-extrabold">check_ins</code> e as demais tabelas foram criadas corretamente com o script SQL de instalação disponível no Painel Administrativo.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-left shadow-3xs">
                      <div className="flex gap-2 items-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider font-sans select-none">
                          Sincronização em Tempo Real Ativa (Supabase Conectado)
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
                          As variáveis de ambiente do <strong className="text-amber-900 font-black">Supabase</strong> não foram configuradas nas Secrets da hospedagem deste site (estão faltando <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono text-[9px] font-extrabold">VITE_SUPABASE_URL</code> e <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono text-[9px] font-extrabold">VITE_SUPABASE_ANON_KEY</code>).
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

                {/* Escolher Candidato Apoiado */}
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
                            alt="Candidato"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="font-sans">
                          <span className="text-[9px] font-black uppercase text-[#F58220] tracking-wider block">
                            Candidato Vinculado
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
                              ?.office || "Candidato"}
                          </span>
                        </div>
                      </div>
                      {/* Button 'Alterar' removed by user request */}
                    </div>
                  ) : (
                    <>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                        Candidato Apoiado neste Check-in *
                      </label>
                      <select
                        value={checkInCandidateId}
                        onChange={(e) => setCheckInCandidateId(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/15 rounded-xl text-sm font-sans font-semibold text-slate-800 transition-all cursor-pointer hover:border-slate-350 focus:outline-hidden"
                      >
                        <option value="">Selecione o Candidato...</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.office || "Candidato"})
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {/* Lista Coesiva de Missões Ativas de Campo do Voluntário */}
                {(() => {
                  if (!checkInCandidateId) {
                    return (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5 text-center font-sans animate-in fade-in duration-200">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <Target className="w-4 h-4" />
                        </div>
                        <p className="text-xs text-slate-500 font-bold">
                          Selecione o candidato acima para carregar suas missões
                          de campo.
                        </p>
                      </div>
                    );
                  }

                  // Get both active areas and pins
                  const candidateAreas = areas.filter(
                    (a) => a.active && a.candidateId === checkInCandidateId,
                  );
                  const candidatePins = pins.filter(
                    (p) => p.active && p.candidateId === checkInCandidateId,
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

                  if (totalUserMissions === 0) {
                    return (
                      <div className="bg-amber-50/45 border border-amber-100 rounded-2xl p-4 text-center font-sans">
                        <p className="text-xs text-amber-600 font-bold">
                          Nenhuma missão de campo pendente para o seu perfil no
                          momento.
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Converse com seu coordenador para cadastrar novas
                          missões e áreas no mapa do candidato!
                        </p>
                      </div>
                    );
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
                                    {pin.iconType.toUpperCase()}
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
                {(() => {
                  if (!activeMissionId) return null;
                  const activeMission = [...areas, ...pins].find(
                    (m) => m.id === activeMissionId,
                  );
                  if (!activeMission) return null;
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

                {/* Upload de Foto */}
                <div className="space-y-2 text-left">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">
                    Evidência Fotográfica (Opcional)
                  </label>

                  {checkInPhoto ? (
                    <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 shadow-3xs font-sans">
                          <img
                            src={checkInPhoto}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">
                            Foto anexada
                          </span>
                          <span className="text-[10px] text-emerald-500 font-bold block mt-0.5">
                            Pronta para envio
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckInPhoto(null);
                          setCheckInFile(null);
                        }}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] uppercase font-bold rounded-lg transition-colors cursor-pointer font-sans"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="pb-1 font-sans">
                      {/* Hidden input used standardly via label */}
                      <input
                        id="checkin-camera-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCheckInFileChange}
                        className="sr-only"
                      />

                      {/* Camera Button */}
                      <label
                        htmlFor="checkin-camera-input"
                        className="flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-300 hover:border-[#F58220] hover:bg-orange-50/5 transition-all rounded-2xl cursor-pointer text-center group min-h-[140px] shadow-3xs"
                      >
                        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-[#F58220] group-hover:scale-105 transition-all mb-3 border border-orange-100 shadow-3xs">
                          <Camera className="w-6 h-6 stroke-[2]" />
                        </div>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-[#F58220] transition-colors leading-tight">
                          Tirar Foto
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-wider">
                          Apenas fotos tiradas na hora pela câmera (Máximo 5MB)
                        </span>
                      </label>
                    </div>
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

        {/* Custom Confirm Dialog Modal */}
        <AnimatePresence>
          {customConfirm && customConfirm.isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 text-left">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={customConfirm.onCancel}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full relative z-10 border border-slate-100 text-center overflow-hidden flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shadow-3xs">
                  <AlertCircle className="w-8 h-8 animate-pulse" />
                </div>

                <div>
                  <h4 className="text-base font-black text-slate-800 tracking-tight leading-tight">
                    {customConfirm.title}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 px-1">
                    {customConfirm.message}
                  </p>
                </div>

                <div className="flex gap-2.5 w-full mt-2">
                  <button
                    type="button"
                    onClick={customConfirm.onCancel}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-95"
                  >
                    {customConfirm.cancelText || "Cancelar"}
                  </button>
                  <button
                    type="button"
                    onClick={customConfirm.onConfirm}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-500/10"
                  >
                    {customConfirm.confirmText || "Confirmar"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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

      if (!isSupabaseConfigured) {
        triggerNotification(
          "Supabase não configurado. Entrando em modo demonstração.",
          "info",
        );
        const demoUser = { email: adminEmail.trim().toLowerCase() };
        setAdminUser(demoUser);
        localStorage.setItem("auth_admin_user", JSON.stringify(demoUser));
        return;
      }

      setIsVerifyingAdminLogin(true);
      const res = await SupabaseService.loginAdmin(adminEmail, adminPassword);
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
              src="https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/imagens/LOGO%20TRIAD3%20.png"
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

          {!isSupabaseConfigured && (
            <div className="mt-1 pt-4 border-t border-slate-100/80 space-y-2">
              <p className="text-[10.5px] text-zinc-500 leading-normal bg-[#FAFAD2]/60 p-3 rounded-2xl border border-[#FAFAD2] text-left font-sans">
                ⚠️ <strong>Integração Offline:</strong> VITE_SUPABASE_URL não
                foi preenchido. Caso queira testar o fluxo de login de forma
                simulada, use o botão de demonstração:
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
      const cityMatch = (c.estado || c.city || "")?.toLowerCase().includes(q) || false;
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
        .map((c) => (c.estado || c.city || "").toLowerCase().trim())
        .filter(Boolean),
    ).size;

    // Calcula o partido com mais candidatos em tempo de execução
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

    const activePartiesWithLogo = parties.filter(
      (p) => p.logo_url && p.logo_url.trim().length > 0,
    ).length;

    // Parties dynamic filtering matching query
    const pq = partySearch.toLowerCase();
    const filteredParties = parties.filter((p) => {
      const nameMatch = (p.name || "").toLowerCase().includes(pq);
      const initialsMatch = (p.initials || "").toLowerCase().includes(pq);
      return nameMatch || initialsMatch;
    });

    const handleOpenCreatePartyModal = () => {
      setPartyEditing(null);
      setPartyName("");
      setPartyInitials("");
      setPartyLogoUrl("");
      setIsPartyModalOpen(true);
    };

    const handleOpenEditPartyModal = (party: Party) => {
      setPartyEditing(party);
      setPartyName(party.name);
      setPartyInitials(party.initials);
      setPartyLogoUrl(party.logo_url || "");
      setIsPartyModalOpen(true);
    };

    const handleSavePartySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!partyName.trim() || !partyInitials.trim()) {
        triggerNotification(
          "O nome do partido e a sigla são obrigatórios.",
          "error",
        );
        return;
      }

      const payload = {
        name: partyName.trim(),
        initials: partyInitials.trim().toUpperCase(),
        logo_url:
          partyLogoUrl.trim() ||
          "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/SD_LOGO.png",
      };

      if (isSupabaseConfigured) {
        triggerNotification("Salvando partido no Supabase...", "info");
        const res = await SupabaseService.upsertParty({
          id: partyEditing?.id,
          ...payload,
        });
        if (res.success) {
          triggerNotification("Partido salvo com sucesso no banco!", "success");
          const reload = await SupabaseService.fetchParties();
          if (reload.success && reload.data) {
            setParties(reload.data);
          } else {
            const updatedId =
              res.data?.id || partyEditing?.id || "party-" + Date.now();
            setParties((prev) => {
              const existing = prev.find((p) => p.id === partyEditing?.id);
              if (existing) {
                return prev.map((p) =>
                  p.id === partyEditing?.id
                    ? { ...p, ...payload, id: updatedId }
                    : p,
                );
              } else {
                return [...prev, { ...payload, id: updatedId }];
              }
            });
          }
        } else {
          triggerNotification(`Erro Supabase: ${res.error}`, "error");
        }
      } else {
        const updatedId = partyEditing?.id || "party-" + Date.now();
        setParties((prev) => {
          const existing = prev.find((p) => p.id === partyEditing?.id);
          if (existing) {
            return prev.map((p) =>
              p.id === partyEditing?.id
                ? { ...p, ...payload, id: updatedId }
                : p,
            );
          } else {
            return [...prev, { ...payload, id: updatedId }];
          }
        });
        triggerNotification("Partido salvo localmente!", "success");
      }
      setIsPartyModalOpen(false);
    };

    const handleDeleteParty = async (id: string, initials: string) => {
      if (confirm(`Deseja realmente remover o partido ${initials}?`)) {
        if (isSupabaseConfigured) {
          triggerNotification("Excluindo partido do Supabase...", "info");
          const res = await SupabaseService.deleteParty(id);
          if (res.success) {
            setParties((prev) => prev.filter((p) => p.id !== id));
            triggerNotification("Partido excluído com sucesso!", "success");
          } else {
            triggerNotification(`Erro Supabase: ${res.error}`, "error");
          }
        } else {
          setParties((prev) => prev.filter((p) => p.id !== id));
          triggerNotification("Partido removido localmente!", "info");
        }
      }
    };

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
        triggerNotification("O nome do candidato é obrigatório.", "error");
        return;
      }

      const targetParty = inspectedParty;
      let finalOffice = candOffice.trim();
      if (targetParty) {
        const initials = targetParty.initials.trim().toUpperCase();
        if (!finalOffice.toUpperCase().includes(initials)) {
          finalOffice = `${finalOffice} (${initials})`;
        }
      }

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
      };

      if (isSupabaseConfigured) {
        triggerNotification("Salvando candidato no Supabase...", "info");
        const res = await SupabaseService.upsertCandidate({
          id: candidateEditing?.id,
          ...payload,
        });
        if (res.success) {
          triggerNotification("Candidato registrado no Supabase!", "success");
          const reload = await SupabaseService.fetchCandidates();
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
            `Erro Supabase: ${res.error || "Falha ao salvar"}`,
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
        triggerNotification("Candidato salvo localmente!", "success");
        setIsCandidateModalOpen(false);
      }
    };

    const handleDeleteCandidate = async (id: string, name: string) => {
      if (confirm(`Deseja realmente remover o candidato ${name}?`)) {
        if (isSupabaseConfigured) {
          triggerNotification("Excluindo candidato do Supabase...", "info");
          const res = await SupabaseService.deleteCandidate(id);
          if (res.success) {
            setCandidates((prev) => prev.filter((c) => c.id !== id));
            triggerNotification("Candidato deletado com sucesso!", "success");
          } else {
            triggerNotification(`Erro Supabase: ${res.error}`, "error");
          }
        } else {
          setCandidates((prev) => prev.filter((c) => c.id !== id));
          triggerNotification("Candidato removido localmente!", "info");
        }
      }
    };

    const handleToggleStatus = async (cand: Candidate) => {
      const newStatus = cand.status_active === false ? true : false;
      const updated = { ...cand, status_active: newStatus };

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === cand.id ? { ...c, status_active: newStatus } : c,
        ),
      );

      if (isSupabaseConfigured) {
        await SupabaseService.upsertCandidate({
          id: cand.id,
          name: cand.name,
          phone: cand.phone,
          instagram_handle: cand.instagram_handle,
          city: cand.city,
          office: cand.office,
          image: cand.image,
        });
      }
      triggerNotification(`Status de ${cand.name} atualizado.`, "success");
    };

    return (
      <div className="min-h-screen w-screen bg-[#EBF1F6] text-slate-800 flex flex-col p-6 sm:p-10 font-sans selection:bg-blue-600 selection:text-white overflow-y-auto">
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
            <h1 className="text-3xl font-extrabold text-[#0D233A] tracking-tight flex items-center gap-2">
              {inspectedParty ? (
                <div className="flex items-center gap-2">
                  <span
                    className="text-slate-400 font-medium hover:text-slate-600 cursor-pointer text-2xl"
                    onClick={() => setInspectedParty(null)}
                  >
                    Partidos
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                  <span className="text-emerald-600 text-2xl font-black">
                    {inspectedParty.initials}
                  </span>
                </div>
              ) : (
                "Partidos Políticos"
              )}
            </h1>
            <p className="text-[#8492A6] text-xs font-semibold mt-1">
              {inspectedParty
                ? `Inspecionando os candidatos associados ao partido ${inspectedParty.name} (${inspectedParty.initials})`
                : "Cadastre as siglas partidárias parceiras de sua campanha eleitoral"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* SEARCH BOX */}
            <div className="relative bg-white border border-slate-200 rounded-2xl flex items-center px-4 w-60 h-11 shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20">
              <Search className="w-4 h-4 text-slate-400 mr-2.5" />
              <input
                type="text"
                placeholder={
                  inspectedParty ? "Buscar candidato..." : "Buscar partido..."
                }
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="bg-transparent border-none w-full text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
              />
              {partySearch && (
                <X
                  className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer ml-1"
                  onClick={() => setPartySearch("")}
                />
              )}
            </div>

            {/* BTN REGISTER CANDIDATE OR PARTY */}
            {inspectedParty ? (
              <>
                <button
                  onClick={() => setInspectedParty(null)}
                  className="px-5 h-11 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 animate-fade-in"
                >
                  <ChevronLeft className="w-4 h-4 text-rose-500" />
                  <span>Voltar</span>
                </button>
                <button
                  onClick={handleOpenCreateModal}
                  className="px-5 h-11 bg-[#015FC9] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-lg border border-blue-700/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Novo Candidato</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenCreatePartyModal}
                className="px-5 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-lg border border-emerald-700/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Novo Partido</span>
              </button>
            )}

            {/* LOG OUT BADGE */}
            {!inspectedParty && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Deseja realmente pulsar para encerrar a sessão administrativa?",
                    )
                  ) {
                    setAdminUser(null);
                    localStorage.removeItem("auth_admin_user");
                    triggerNotification(
                      "Sessão encerrada com sucesso.",
                      "info",
                    );
                  }
                }}
                className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-2xl shadow-sm transition-all cursor-pointer"
                title="Sair do painel"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* STATISTICS DASHBOARD CARDS */}
        {adminSubTab === "candidates" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {/* Card 1: Total */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center gap-4.5">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                  Candidatos
                </p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">
                  {totalCount}
                </p>
              </div>
            </div>

            {/* Card 2: Ativos */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center gap-4.5">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                  Ativos
                </p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">
                  {activeCount}
                </p>
              </div>
            </div>

            {/* Card 3: Estados */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center gap-4.5">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                <MapPin className="w-5 h-5 fill-purple-100" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                  Estados
                </p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">
                  {uniqueCities}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {/* Card 1: Total Partidos */}
            <div className="bg-white border border-[#E1E8ED] rounded-3xl p-5 shadow-xs flex items-center gap-4.5">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                  Total Partidos
                </p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">
                  {parties.length}
                </p>
              </div>
            </div>

            {/* Card 2: Siglas Ativas */}
            <div className="bg-white border border-[#E1E8ED] rounded-3xl p-5 shadow-xs flex items-center gap-4.5">
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                <Flag className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8492A6]">
                  Siglas Ativas
                </p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">
                  {parties.filter((p) => p.initials).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DETAILS TABLE RENDER CONTAINER */}
        {adminSubTab === "candidates" ? (
          /* CANDIDATES MASTER DATA TABLE */
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#FAFBFD] border-b border-slate-100">
                    <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
                      Candidato
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
                        Nenhum candidato encontrado
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
                                  const shareUrl = `${window.location.origin}/checkin/${slugify(cand.name)}`;
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
                                title="Copiar Link de Check-in deste Candidato"
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
                                title="Ver Mapa Isolado deste Candidato"
                              >
                                <Map className="w-4 h-4" />
                              </button>

                              {/* INSPECCIONAR MULTIPLICADORES / TIME DELTA */}
                              <button
                                onClick={() => {
                                  const candParty = parties.find((p) => {
                                    const b = getPartidoBadge(cand);
                                    return (
                                      b.name.toUpperCase() ===
                                      p.initials.toUpperCase()
                                    );
                                  });
                                  if (candParty) {
                                    setInspectedParty(candParty);
                                  }
                                  setInspectedCandidate(cand);
                                  triggerNotification(
                                    `Inspecionando time Delta de: ${cand.name}`,
                                    "info",
                                  );
                                }}
                                className="p-1.5 h-8 w-8 hover:bg-[#E0F2FE] text-slate-400 hover:text-sky-600 border border-transparent hover:border-[#BAE6FD] rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                title="Inspecionar Time Delta (Olho)"
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
                Mostrando {filteredCandidates.length} de {totalCount} candidatos
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
        ) : inspectedParty ? (
          /* DETAILED PARTY INSPECTION VIEW - CANDIDATES REPORT */
          <div className="flex flex-col flex-1 gap-6">
            {/* PARTY INFOCARD BANNER */}
            <div className="bg-gradient-to-r from-[#0C1525] via-[#162541] to-[#0C1525] text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

              <div className="flex items-center gap-5 relative z-10">
                <div className="w-20 h-20 bg-white border border-slate-200 rounded-2xl flex items-center justify-center p-2 shrink-0 shadow-lg">
                  {inspectedParty.logo_url ? (
                    <img
                      src={inspectedParty.logo_url}
                      alt={inspectedParty.initials}
                      className="w-full h-full rounded-xl object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center">
                      <span className="text-xl font-black text-white">
                        {inspectedParty.initials.substring(0, 3)}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg">
                      {inspectedParty.initials}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">
                      Partido Parceiro Registrado
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1.5 tracking-tight">
                    {inspectedParty.name}
                  </h2>
                </div>
              </div>

              {/* QUICK STATS INSIDE INSPECTOR BANNER */}
              <div className="flex gap-4.5 sm:gap-6 relative z-10">
                <div className="px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-center backdrop-blur-md min-w-[110px]">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Total Candidatos
                  </p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    {
                      candidates.filter((c) => {
                        const badge = getPartidoBadge(c);
                        return (
                          badge.name.toUpperCase() ===
                          inspectedParty.initials.toUpperCase()
                        );
                      }).length
                    }
                  </p>
                </div>
                <div className="px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-center backdrop-blur-md min-w-[110px]">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Estados
                  </p>
                  <p className="text-2xl font-black text-sky-400 mt-1">
                    {
                      new Set(
                        candidates
                          .filter((c) => {
                            const badge = getPartidoBadge(c);
                            return (
                              badge.name.toUpperCase() ===
                              inspectedParty.initials.toUpperCase()
                            );
                          })
                          .map((c) => (c.estado || c.city || "").toLowerCase().trim())
                          .filter(Boolean),
                      ).size
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* CANDIDATES TABLE SPECIFIC TO THIS PARTY */}
            {inspectedCandidate ? (
              /* DETAILED CANDIDATE INSPECTION VIEW (TIME DELTA) */
              <div className="flex flex-col flex-1 gap-6 font-sans">
                {/* CANDIDATE HEADER PROFILE CARD */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-5 w-full">
                    {/* RED WRAPPED BACK BUTTON */}
                    <button
                      onClick={() => setInspectedCandidate(null)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4 text-rose-500" />
                      <span>Voltar</span>
                    </button>

                    <div className="relative">
                      <img
                        src={
                          inspectedCandidate.image ||
                          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                        }
                        alt={inspectedCandidate.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">
                          {inspectedCandidate.office || "Sem Cargo"}
                        </span>
                        <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-300" />
                          {inspectedCandidate.city}
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-[#0D233A] mt-1 truncate">
                        {inspectedCandidate.name}
                      </h2>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        WhatsApp:{" "}
                        <span className="text-slate-600 font-mono">
                          {inspectedCandidate.phone || "Privado"}
                        </span>{" "}
                        | Instagram:{" "}
                        <span className="text-slate-600">
                          @
                          {inspectedCandidate.instagram_handle ||
                            "Não informado"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* MINI MAP ACCESSIBILITY */}
                  <button
                    onClick={() => {
                      setSelectedCandidateFilter(inspectedCandidate.id);
                      setAdminTab("map");
                      triggerNotification(
                        `Exibindo o mapa exclusivo de: ${inspectedCandidate.name}`,
                        "success",
                      );
                    }}
                    className="px-4.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 shrink-0"
                  >
                    <Map className="w-4 h-4 text-indigo-500" />
                    <span>Ver no Mapa</span>
                  </button>
                </div>

                {/* METRICS ROW */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-slate-400 font-bold text-[9.5px] uppercase tracking-wider">
                      Integrantes Time Delta
                    </span>
                    <h3 className="text-2xl font-black text-[#0D233A] mt-1">
                      {
                        supporters.filter(
                          (s) => s.candidate_id === inspectedCandidate.id,
                        ).length
                      }
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Multiplicadores do candidato
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-slate-400 font-bold text-[9.5px] uppercase tracking-wider">
                      Áreas de Panfletagem
                    </span>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">
                      {
                        areas.filter(
                          (a) =>
                            a.candidateId === inspectedCandidate.id ||
                            a.candidate_id === inspectedCandidate.id,
                        ).length
                      }
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Zonas de panfletagem
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-slate-400 font-bold text-[9.5px] uppercase tracking-wider">
                      Pontos de Campanha
                    </span>
                    <h3 className="text-2xl font-black text-sky-600 mt-1">
                      {
                        pins.filter(
                          (p) =>
                            p.candidateId === inspectedCandidate.id ||
                            p.candidate_id === inspectedCandidate.id,
                        ).length
                      }
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Marcadores e Pins ativos
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-slate-400 font-bold text-[9.5px] uppercase tracking-wider">
                      Check-ins de Campo
                    </span>
                    <h3 className="text-2xl font-black text-indigo-600 mt-1">
                      {
                        checkIns.filter(
                          (c) =>
                            c.candidateId === inspectedCandidate.id ||
                            c.candidate_id === inspectedCandidate.id,
                        ).length
                      }
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Evidências e visitas
                    </p>
                  </div>
                </div>

                {/* PRIMARY TWO COLUMN WORKSPACE */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* LEFT COLUMN: INTERACTIVE TIME DELTA (2/3 Grid length) */}
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[350px]">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                          <span>🚀 Equipe Multiplicadora (Time Delta)</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Gerenciamento e comunicação com mobilizadores ativos
                        </p>
                      </div>

                      <button
                        onClick={() => setIsAddingSupporter(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl flex items-center gap-1 shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Novo Delta</span>
                      </button>
                    </div>

                    {/* ADD NEW SUPPORTER FORM POPUP/CARD INLINE */}
                    {isAddingSupporter && (
                      <div className="p-5 bg-emerald-50/50 border-b border-slate-100">
                        <h5 className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-3">
                          Novo Delta do Time Delta
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1">
                              Nome Completo
                            </label>
                            <input
                              type="text"
                              value={newSupName}
                              onChange={(e) => setNewSupName(e.target.value)}
                              placeholder="Ex: Carlos Santos"
                              className="w-full h-10 px-3 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1">
                              WhatsApp (DDD + Celular)
                            </label>
                            <input
                              type="text"
                              value={newSupPhone}
                              onChange={(e) => setNewSupPhone(e.target.value)}
                              placeholder="Ex: 82999991234"
                              className="w-full h-10 px-3 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:outline-hidden"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2.5 mt-4">
                          <button
                            onClick={() => {
                              setIsAddingSupporter(false);
                              setNewSupName("");
                              setNewSupPhone("");
                            }}
                            className="px-3.5 py-2 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-xl"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={async () => {
                              if (!newSupName.trim() || !newSupPhone.trim()) {
                                triggerNotification(
                                  "Preencha o nome e o whatsapp.",
                                  "error",
                                );
                                return;
                              }
                              const cleanPhone = newSupPhone.replace(/\D/g, "");
                              const currentId = "sup-local-" + Date.now();
                              const item = {
                                id: currentId,
                                full_name: newSupName,
                                whatsapp: cleanPhone,
                                candidate_id: inspectedCandidate.id,
                              };

                              setSupporters((prev) => [...prev, item]);

                              if (isSupabaseConfigured) {
                                const addRes =
                                  await SupabaseService.upsertSupporter(item);
                                if (addRes.success) {
                                  triggerNotification(
                                    `${newSupName} cadastrado no Supabase!`,
                                    "success",
                                  );
                                  // Recarrega lista
                                  const supRes =
                                    await SupabaseService.fetchSupporters();
                                  if (supRes.success && supRes.data) {
                                    setSupporters(supRes.data);
                                  }
                                } else {
                                  triggerNotification(
                                    `${newSupName} salvo localmente somente.`,
                                    "info",
                                  );
                                }
                              } else {
                                triggerNotification(
                                  `${newSupName} salvo localmente!`,
                                  "success",
                                );
                              }
                              setNewSupName("");
                              setNewSupPhone("");
                              setIsAddingSupporter(false);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                          >
                            Adicionar ao Time
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SUPPORTERS LIST */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px] border-collapse text-left">
                        <thead>
                          <tr className="bg-[#FAFBFD] border-b border-slate-100">
                            <th className="py-3 px-6 text-[9.5px] uppercase font-black text-[#8492A6]">
                              Delta
                            </th>
                            <th className="py-3 px-6 text-[9.5px] uppercase font-black text-[#8492A6]">
                              WhatsApp
                            </th>
                            <th className="py-3 px-6 text-[9.5px] uppercase font-black text-[#8492A6] text-right">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {supporters.filter(
                            (s) =>
                              s.candidate_id === inspectedCandidate.id ||
                              s.candidateId === inspectedCandidate.id,
                          ).length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-50/20"
                              >
                                Nenhum delta registrado no Time Delta
                              </td>
                            </tr>
                          ) : (
                            supporters
                              .filter(
                                (s) =>
                                  s.candidate_id === inspectedCandidate.id ||
                                  s.candidateId === inspectedCandidate.id,
                              )
                              .map((sup) => {
                                return (
                                  <tr
                                    key={sup.id}
                                    className="hover:bg-slate-50/50 transition-all"
                                  >
                                    <td className="py-3 px-6 flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-[#015FC9] font-black flex items-center justify-center text-xs shadow-xs uppercase">
                                        {sup.full_name
                                          ? sup.full_name.substring(0, 2)
                                          : "DT"}
                                      </div>
                                      <span className="font-bold text-slate-800 text-[13.5px]">
                                        {sup.full_name}
                                      </span>
                                    </td>
                                    <td className="py-3 px-6 font-mono text-xs font-semibold text-slate-500">
                                      {sup.whatsapp}
                                    </td>
                                    <td className="py-3 px-6 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {/* WHATSAPP LINK BUTTON */}
                                        <a
                                          href={`https://wa.me/55${sup.whatsapp.replace(/\D/g, "")}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 h-7 w-7 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-md border border-transparent hover:border-emerald-100 flex items-center justify-center transition-all cursor-pointer"
                                          title="Chamar no WhatsApp"
                                        >
                                          <Phone className="w-3.5 h-3.5" />
                                        </a>

                                        {/* DELETE REMOVE MULTIPLIER BUTTON */}
                                        <button
                                          onClick={async () => {
                                            if (
                                              confirm(
                                                `Remover multiplicador ${sup.full_name} do Time Delta?`,
                                              )
                                            ) {
                                              setSupporters((prev) =>
                                                prev.filter(
                                                  (s) => s.id !== sup.id,
                                                ),
                                              );
                                              if (isSupabaseConfigured) {
                                                const delRes =
                                                  await SupabaseService.deleteSupporter(
                                                    sup.id,
                                                  );
                                                if (delRes.success) {
                                                  triggerNotification(
                                                    "Multiplicador removido!",
                                                    "success",
                                                  );
                                                }
                                              } else {
                                                triggerNotification(
                                                  "Multiplicador removido localmente!",
                                                  "info",
                                                );
                                              }
                                            }
                                          }}
                                          className="p-1 h-7 w-7 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md border border-transparent hover:border-rose-100 flex items-center justify-center transition-all cursor-pointer"
                                          title="Remover do Time Delta"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
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
                  </div>

                  {/* RIGHT COLUMN: ACTION HISTORY & ACTIVITIES */}
                  <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 flex flex-col space-y-4">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span>📍 Atividades Recentes</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        Atividades registradas no território do candidato
                      </p>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto space-y-3 pr-1">
                      {checkIns.filter(
                        (c) =>
                          c.candidateId === inspectedCandidate.id ||
                          c.candidate_id === inspectedCandidate.id,
                      ).length === 0 ? (
                        <div className="py-12 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest bg-slate-50/20 rounded-2xl border border-dashed border-slate-100">
                          Nenhuma atividade registrada ainda
                        </div>
                      ) : (
                        checkIns
                          .filter(
                            (c) =>
                              c.candidateId === inspectedCandidate.id ||
                              c.candidate_id === inspectedCandidate.id,
                          )
                          .map((ci) => {
                            return (
                              <div
                                key={ci.id}
                                className="pt-3 first:pt-0 flex flex-col gap-1.5 font-sans"
                              >
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-slate-800 text-[12px]">
                                    {ci.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {ci.createdAt
                                      ? new Date(
                                          ci.createdAt,
                                        ).toLocaleDateString("pt-BR")
                                      : "Sem data"}
                                  </span>
                                </div>
                                <p className="text-slate-500 font-semibold text-[11px] flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {ci.bairro} {ci.rua ? ` - ${ci.rua}` : ""}
                                  </span>
                                </p>
                                {/* LATITUDE LONGITUDE ACTION ICON */}
                                {ci.coordinates && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${ci.coordinates.lat},${ci.coordinates.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="self-start text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all mt-0.5"
                                  >
                                    <Map className="w-2.5 h-2.5" />
                                    <span>Abrir Localização</span>
                                  </a>
                                )}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* CANDIDATES TABLE SPECIFIC TO THIS PARTY */
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-[350px]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Candidatos Filiados
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      Disposição territorial dos agentes políticos do partido
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-50 border border-emerald-150 text-emerald-700 font-bold px-2.5 py-1 rounded-xl">
                    {
                      candidates.filter((c) => {
                        const badge = getPartidoBadge(c);
                        return (
                          badge.name.toUpperCase() ===
                          inspectedParty.initials.toUpperCase()
                        );
                      }).length
                    }{" "}
                    Candidato(s)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-left">
                    <thead>
                      <tr className="bg-[#FAFBFD] border-b border-slate-100">
                        <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
                          Candidato
                        </th>
                        <th className="py-4 px-6 text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
                          Cargo
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
                      {candidates.filter((c) => {
                        const badge = getPartidoBadge(c);
                        const isMatch =
                          badge.name.toUpperCase() ===
                          inspectedParty.initials.toUpperCase();
                        if (!isMatch) return false;
                        if (!partySearch.trim()) return true;
                        return (
                          c.name
                            .toLowerCase()
                            .includes(partySearch.toLowerCase()) ||
                          (c.estado || c.city || "")
                            .toLowerCase()
                            .includes(partySearch.toLowerCase()) ||
                          (c.office || "")
                            .toLowerCase()
                            .includes(partySearch.toLowerCase())
                        );
                      }).length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-widest"
                          >
                            Nenhum candidato encontrado para este partido
                          </td>
                        </tr>
                      ) : (
                        candidates
                          .filter((c) => {
                            const badge = getPartidoBadge(c);
                            const isMatch =
                              badge.name.toUpperCase() ===
                              inspectedParty.initials.toUpperCase();
                            if (!isMatch) return false;
                            if (!partySearch.trim()) return true;
                            return (
                              c.name
                                .toLowerCase()
                                .includes(partySearch.toLowerCase()) ||
                              (c.estado || c.city || "")
                                .toLowerCase()
                                .includes(partySearch.toLowerCase()) ||
                              (c.office || "")
                                .toLowerCase()
                                .includes(partySearch.toLowerCase())
                            );
                          })
                          .map((cand) => {
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
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                      {cand.email ||
                                        `${cand.name.toLowerCase().replace(/\s/g, "")}@campanha.com`}
                                    </span>
                                  </div>
                                </td>

                                {/* CARGO */}
                                <td className="py-4 px-6">
                                  <span className="inline-flex bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-lg border border-slate-200">
                                    {cand.office || "Sem Cargo"}
                                  </span>
                                </td>

                                {/* CITY MAP PIN */}
                                <td className="py-4 px-6">
                                  <div className="flex flex-col text-slate-600 font-bold text-[13px]">
                                    <div className="flex items-center gap-1.5 text-slate-700">
                                      <MapPin className="w-3.5 h-3.5 text-[#8492A6]" />
                                      <span>{cand.estado || cand.city}</span>
                                    </div>
                                    {cand.neighborhood && (
                                      <span className="text-[10.5px] text-[#8492A6] font-semibold mt-0.5 ml-5">
                                        {cand.neighborhood}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* CONTACT DIRECT ICONS */}
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-2">
                                    {/* Instagram */}
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
                                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 text-slate-300 flex items-center justify-center opacity-40">
                                        <Instagram className="w-4 h-4" />
                                      </div>
                                    )}

                                    {/* WhatsApp */}
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
                                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 text-slate-300 flex items-center justify-center opacity-40">
                                        <Phone className="w-4 h-4" />
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
                                          ? "bg-[#10B981]"
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

                                {/* CRUD ACTIONS */}
                                <td className="py-4 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        const shareUrl = `${window.location.origin}/checkin/${slugify(cand.name)}`;
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
                                      className="p-1.5 h-8 w-8 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 border border-transparent hover:border-emerald-100 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                      title="Copiar Link de Check-in"
                                    >
                                      <Link className="w-4 h-4" />
                                    </button>

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
                                      title="Ver Mapa Isolado deste Candidato"
                                    >
                                      <Map className="w-4 h-4" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        setInspectedCandidate(cand);
                                        triggerNotification(
                                          `Inspecionando time Delta de: ${cand.name}`,
                                          "info",
                                        );
                                      }}
                                      className="p-1.5 h-8 w-8 hover:bg-[#E0F2FE] text-slate-400 hover:text-sky-600 border border-transparent hover:border-[#BAE6FD] rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                      title="Inspecionar Time Delta (Olho)"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>

                                    <button
                                      onClick={() => handleOpenEditModal(cand)}
                                      className="p-1.5 h-8 w-8 hover:bg-sky-50 text-slate-400 hover:text-[#015FC9] border border-transparent hover:border-sky-100 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                      title="Editar Candidato"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>

                                    <button
                                      onClick={() =>
                                        handleDeleteCandidate(
                                          cand.id,
                                          cand.name,
                                        )
                                      }
                                      className="p-1.5 h-8 w-8 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-100 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                      title="Apagar Candidato"
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
              </div>
            )}
          </div>
        ) : (
          /* PARTIES MASTER CARDS GRID - ALIGNED TO ATTACHED SCREENSHOT STRUCTURE */
          <div className="flex flex-col flex-1 gap-6">
            {filteredParties.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                <Building2 className="w-12 h-12 text-slate-300 mb-4" />
                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                  Nenhum partido político cadastrado
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredParties.map((party) => {
                  const countFiliados = candidates.filter((c) => {
                    const badge = getPartidoBadge(c);
                    return (
                      badge.name.toUpperCase() === party.initials.toUpperCase()
                    );
                  }).length;

                  // Calcula a quantidade de estados associados a este partido em tempo de execução
                  const partyCandidates = candidates.filter((c) => {
                    const badge = getPartidoBadge(c);
                    return (
                      badge.name.toUpperCase() === party.initials.toUpperCase()
                    );
                  });
                  const partyCitiesCount = new Set(
                    partyCandidates
                      .map((c) => (c.estado || c.city || "").toLowerCase().trim())
                      .filter(Boolean),
                  ).size;

                  return (
                    <div
                      key={party.id}
                      className="bg-white border border-slate-200 hover:border-emerald-200 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-5 relative group"
                    >
                      {/* HEADER DO CARD */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Logo ou Escudo Padrão */}
                          <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center p-1 flex-shrink-0 shadow-2xs">
                            {party.logo_url ? (
                              <img
                                src={party.logo_url}
                                alt={party.initials}
                                className="w-full h-full rounded-xl object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full rounded-xl bg-slate-100 flex items-center justify-center">
                                <span className="text-xs font-black text-slate-500 uppercase">
                                  {party.initials.substring(0, 3)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Título e Subtítulos */}
                          <div className="min-w-0 flex flex-col">
                            {/* Nome Completo do Partido */}
                            <h4
                              className="font-extrabold text-[#0D233A] text-sm tracking-tight leading-snug line-clamp-2"
                              title={party.name}
                            >
                              {party.name}
                            </h4>

                            {/* Sigla Badge */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-flex bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                                {party.initials}
                              </span>
                              <span className="inline-flex bg-slate-100 text-slate-500 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md">
                                {countFiliados > 0
                                  ? "Parceiro Ativo"
                                  : "Sem Candidatos"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Top Actions: Delete Party */}
                        <div className="flex items-center ml-auto">
                          <button
                            onClick={() =>
                              handleDeleteParty(party.id, party.initials)
                            }
                            className="p-1.5 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Remover Partido"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* MIDDLE QUADRO DE MÉTRICAS (Duplo bloco de status do Printout) */}
                      <div className="grid grid-cols-2 gap-3.5">
                        {/* Quadro de Candidatos */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-3xs">
                          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-[#8492A6]">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            <span>Candidatos</span>
                          </div>
                          <span className="text-2xl font-black text-slate-800 mt-1">
                            {countFiliados}
                          </span>
                        </div>

                        {/* Quadro de Estados Ativos */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-3xs">
                          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-[#8492A6]">
                            <MapPin className="w-3.5 h-3.5 text-purple-500" />
                            <span>Estados</span>
                          </div>
                          <span className="text-2xl font-black text-slate-800 mt-1">
                            {partyCitiesCount}
                          </span>
                        </div>
                      </div>

                      {/* FOOTER DO CARD */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                          <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Filiados Ativos</span>
                        </div>

                        <button
                          onClick={() => handleOpenEditPartyModal(party)}
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-[#015FC9] cursor-pointer transition-all"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => setInspectedParty(party)}
                          className="text-[11px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-all hover:translate-x-0.5 group/btn"
                        >
                          <span>Gerenciar</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BARRA DE TOTALIZAÇÃO DO FOOTER */}
            <div className="py-4.5 px-6 border border-slate-200 rounded-3xl bg-[#FAFBFD] flex justify-between items-center shadow-3xs mt-2">
              <span className="text-[#8492A6] text-xs font-bold font-sans">
                Mostrando {filteredParties.length} de {parties.length} partidos
                políticos cadastrados
              </span>
            </div>
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
                      ? "Editar Candidato"
                      : "Cadastrar Novo Candidato"}
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-[#8492A6] font-bold mt-0.5">
                    {candidateEditing
                      ? "Atualize as informações do perfil"
                      : "Insira um candidato na lista territorial"}
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
                    Salvar Candidato
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL: CREATE AND EDIT PARTY */}
        {isPartyModalOpen && (
          <div className="fixed inset-0 bg-[#0c1322]/40 backdrop-blur-xs flex items-center justify-center z-[11000] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-3xl overflow-hidden border border-slate-100 font-sans flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    {partyEditing
                      ? "Editar Partido Político"
                      : "Cadastrar Novo Partido"}
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-[#8492A6] font-bold mt-0.5">
                    {partyEditing
                      ? "Atualize as informações do partido"
                      : "Insira uma nova sigla partidária parceira"}
                  </p>
                </div>
                <button
                  onClick={() => setIsPartyModalOpen(false)}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSavePartySubmit}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {/* Nome do Partido */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Nome Oficial do Partido
                  </label>
                  <input
                    type="text"
                    required
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    placeholder="Ex: Partido Social Democrático"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-[#015FC9] focus:bg-white focus:border-[#015FC9]"
                  />
                </div>

                {/* Sigla */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Sigla (Siglas em Letras Maiúsculas)
                  </label>
                  <input
                    type="text"
                    required
                    value={partyInitials}
                    onChange={(e) => setPartyInitials(e.target.value)}
                    placeholder="Ex: PSD"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-[#015FC9] focus:bg-white focus:border-[#015FC9] uppercase"
                  />
                </div>

                {/* Logo URL */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    URL da Logo do Partido (Opcional)
                  </label>
                  <input
                    type="url"
                    value={partyLogoUrl}
                    onChange={(e) => setPartyLogoUrl(e.target.value)}
                    placeholder="Ex: https://link-da-imagem.png"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-[#015FC9] focus:bg-white focus:border-[#015FC9]"
                  />
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Deixe em branco para usar uma sigla de texto ou um escudo
                    padrão neutro.
                  </p>
                </div>

                {/* Sugestões de Logo pré-fabricadas */}
                <div className="space-y-2 pt-2">
                  <label className="block text-[9px] uppercase font-extrabold tracking-wider text-slate-400">
                    Logos Oficiais Prontas de Demonstração:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        name: "MDB",
                        url: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/MDB_LOGO.png",
                      },
                      {
                        name: "SD",
                        url: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/SD_LOGO.png",
                      },
                      {
                        name: "PP",
                        url: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PP_LOGO.png",
                      },
                      {
                        name: "PL",
                        url: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PL_LOGO.png",
                      },
                      {
                        name: "PT",
                        url: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PT_LOGO.png",
                      },
                      {
                        name: "PSD",
                        url: "https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens/PSD_LOGO.png",
                      },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPartyInitials(preset.name);
                          setPartyLogoUrl(preset.url);
                          if (!partyName) {
                            setPartyName(`Partido ${preset.name}`);
                          }
                        }}
                        className="px-2.5 py-1 text-[9px] font-extrabold uppercase bg-slate-100 hover:bg-emerald-600 hover:text-white rounded-md transition-all cursor-pointer border border-[#E1E8ED] flex items-center gap-1"
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-3.5 h-3.5 rounded-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => setIsPartyModalOpen(false)}
                    className="px-5 py-3 border border-slate-200 text-[#5A6E85] text-xs uppercase font-extrabold tracking-wider rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs uppercase font-extrabold tracking-wider rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer"
                  >
                    Salvar Partido
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

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

                {/* Ir para o mapa do candidato */}
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
                  Ir para o Mapa do Candidato
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

      {/* Botão de Voltar para Candidatos (Top Right) */}
      {adminUser && adminTab === "map" && (
        <div className="absolute top-4 right-4 z-[1000] font-sans">
          <button
            onClick={() => {
              setAdminTab("candidates");
              triggerNotification(
                "Retornando para o Painel de Candidatos!",
                "info",
              );
            }}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider rounded-2xl shadow-xl border border-slate-200/80 transition-all cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95"
            title="Voltar para a Gestão de Candidatos"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 stroke-[3]" />
            <span>Voltar para Candidatos</span>
          </button>
        </div>
      )}

      {/* Sleek Floating Dock (Inspirado no print do usuário) */}
      <div className="absolute top-1/2 left-4 -translate-y-1/2 z-[1000] bg-[#0c1322]/95 border border-slate-800/80 rounded-[28px] p-2.5 shadow-2xl flex flex-col items-center gap-3 w-[56px] pointer-events-auto transition-all">
        {/* Button 1: MapPin (Pin) - Blue */}
        <button
          onClick={triggerCreatePin}
          className="group w-10 h-10 bg-blue-600 hover:bg-blue-500 border border-blue-700 rounded-2xl flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all relative"
          title="Adicionar Pin"
        >
          <MapPin className="w-5 h-5 fill-white" />
          <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-white text-[10px] uppercase font-black tracking-widest rounded-lg whitespace-nowrap shadow-xl transition-all pointer-events-none z-[1100]">
            Inserir Pin
          </span>
        </button>

        <div className="w-8 h-[1px] bg-slate-800/50" />

        {/* Button 2: Circle (Raio) - Red-ish/Orange background or Transparent to resemble screenshot */}
        <button
          onClick={triggerCreateArea}
          className="group w-10 h-10 bg-indigo-600 hover:bg-indigo-500 border border-indigo-700 rounded-2xl flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all relative"
          title="Marcar Raio/Área (Mapeamento)"
        >
          <Circle className="w-5 h-5 stroke-[2.5]" />
          <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-white text-[10px] uppercase font-black tracking-widest rounded-lg whitespace-nowrap shadow-xl transition-all pointer-events-none z-[1100]">
            Marcar Raio
          </span>
        </button>

        <div className="w-8 h-[1px] bg-slate-800/50" />

        {/* Button 3: Compartilhar Check-in - Green */}
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="group w-10 h-10 bg-emerald-600 hover:bg-emerald-500 border border-emerald-700 rounded-2xl flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all relative"
          title="Compartilhar Link de Check-in"
        >
          <Share2 className="w-5 h-5" />
          <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-white text-[10px] uppercase font-black tracking-widest rounded-lg whitespace-nowrap shadow-xl transition-all pointer-events-none z-[1100]">
            Compartilhar Link
          </span>
        </button>

        <div className="w-8 h-[1px] bg-slate-800/50" />

        {/* Button 4: Exibir Camadas / Filtros - Layers Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFilterDropdownOpen(!isFilterDropdownOpen);
          }}
          className={`group w-10 h-10 ${
            mapFilter !== "all"
              ? "bg-[#F58220] border border-orange-600 text-white shadow-lg shadow-orange-500/20"
              : "bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-700 text-indigo-200"
          } rounded-2xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all relative`}
          title="Filtrar Elementos do Mapa"
        >
          <Layers className="w-5 h-5" />
          <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-white text-[10px] uppercase font-black tracking-widest rounded-lg whitespace-nowrap shadow-xl transition-all pointer-events-none z-[1100]">
            Visualização
          </span>
        </button>

        {/* Map Layers Filter Dropdown Flyout */}
        <AnimatePresence>
          {isFilterDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, x: -15, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -15, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute left-[68px] top-0 bg-[#0c1322]/98 backdrop-blur-md border border-slate-800/90 rounded-3xl p-3 shadow-2xl flex flex-col gap-1 w-60 min-w-[220px] pointer-events-auto text-left z-[2000]"
            >
              <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-sans">
                  Exibir no Mapa
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterDropdownOpen(false);
                  }}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded-lg transition-colors cursor-pointer"
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
                      : "text-slate-300 hover:bg-slate-800/65 hover:text-white"
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
                      : "text-slate-300 hover:bg-slate-800/65 hover:text-white"
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

                {/* Option 3: Marcações */}
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
                      : "text-slate-300 hover:bg-slate-800/65 hover:text-white"
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
      </div>

      {/* Top Banner Guide for Coordinate Picking */}
      {clickToPickCoords && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2001] bg-[#0c1322]/95 backdrop-blur-md border border-indigo-500/50 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-bounce pointer-events-auto">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            {coordsPickingMode === "area" ? (
              <>
                <Circle className="w-4 h-4 text-indigo-400" />
                <span>
                  Clique no mapa para criar o Raio (Mínimo: 500 metros)
                </span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Selecione a localização do seu Pin no mapa</span>
              </>
            )}
          </span>
          <button
            onClick={() => {
              setClickToPickCoords(false);
              triggerNotification("Seleção de coordenadas suspensa.", "info");
            }}
            className="px-3 py-1 bg-red-650 hover:bg-red-700 bg-red-600 text-[10px] text-white rounded-full font-bold transition-all border border-red-500 cursor-pointer"
          >
            Cancelar
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
                src="https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/imagens/LOGO%20TRIAD3%20.png"
                alt="Triad3 Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight flex items-center gap-1.5 leading-none">
                Mapa Interativo{" "}
                <Flag className="w-4 h-4 text-red-500 fill-red-500" />
              </h1>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono tracking-widest">
                Maceió • Planejamento Geográfico
              </p>
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
        <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50 text-center select-none text-slate-700">
          <div className="p-3 border-r border-slate-100">
            <div className="text-xs text-slate-400 flex justify-center items-center gap-1 uppercase tracking-wider font-semibold">
              <Users className="w-3.5 h-3.5 text-blue-500" /> Equipes
            </div>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5">
              {areas.filter((a) => a.active).length}
            </p>
          </div>
          <div className="p-3 border-r border-slate-100">
            <div className="text-xs text-slate-400 flex justify-center items-center gap-1 uppercase tracking-wider font-semibold">
              <Users className="w-3.5 h-3.5 text-emerald-500" /> Voluntários
            </div>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5">
              {totalVolunteers}
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
              activeTab === "areas"
                ? "border-indigo-600 text-indigo-600 font-extrabold bg-white shadow-3xs"
                : "border-transparent text-slate-500"
            }`}
            onClick={() => setActiveTab("areas")}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Panfletagem</span>
          </button>

          <button
            className={`flex-1 py-3 flex flex-col md:flex-row justify-center items-center gap-1 border-b-2 hover:bg-white hover:text-indigo-600 transition-all ${
              activeTab === "pins"
                ? "border-indigo-600 text-indigo-600 font-extrabold bg-white shadow-3xs"
                : "border-transparent text-slate-500"
            }`}
            onClick={() => {
              setActiveTab("pins");
              if (editingAreaId) resetAreaForm();
            }}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pontos</span>
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
                          <div className="w-12 h-12 rounded-lg bg-emerald-100/30 border border-emerald-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {checkIn.photo ? (
                              <img
                                src={checkIn.photo}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Users className="w-5 h-5 text-emerald-600 animate-pulse" />
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
                                if (
                                  confirm(
                                    `Remover check-in de ${checkIn.name}?`,
                                  )
                                ) {
                                  setCheckIns((prev) =>
                                    prev.filter((c) => c.id !== checkIn.id),
                                  );
                                  if (isSupabaseConfigured) {
                                    SupabaseService.deleteCheckIn(
                                      checkIn.id,
                                    ).then((res) => {
                                      if (!res.success)
                                        triggerNotification(
                                          `Supabase: ${res.error}`,
                                          "error",
                                        );
                                    });
                                  }
                                  triggerNotification(
                                    "Check-in de voluntário removido!",
                                    "info",
                                  );
                                }
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
              {editingAreaId ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </div>
                      Editar Área de Raio
                    </h3>
                    <button
                      type="button"
                      onClick={resetAreaForm}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <form onSubmit={saveArea} className="space-y-3.5">
                    {/* Title */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Título da Equipe / Ação *
                      </label>
                      <input
                        type="text"
                        required
                        value={areaTitle}
                        onChange={(e) => setAreaTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                      />
                    </div>

                    {/* Associar Candidato */}
                    {selectedCandidateFilter === "all" && (
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          Associar Candidato (Para mapas isolados)
                        </label>
                        <select
                          value={areaCandidateId}
                          onChange={(e) => setAreaCandidateId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs font-semibold"
                        >
                          <option value="">Geral / Sem Candidato</option>
                          {candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.office || "Candidato"})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Bairro Correspondente */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Bairro Correspondente *
                      </label>
                      <select
                        value={areaBairro}
                        onChange={(e) => setAreaBairro(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs font-semibold"
                      >
                        {/* Garante que o bairro já selecionado/salvo apareça como a opção selecionada primária se não estiver nas listas padrão */}
                        {areaBairro && !MACEIO_BAIRROS.some((b) => b.name === areaBairro) && (
                          <option value={areaBairro}>{areaBairro}</option>
                        )}
                        {brasilDistricts && brasilDistricts.length > 0 ? (
                          brasilDistricts
                            .filter((b) => b.name !== areaBairro)
                            .map((b) => (
                              <option key={b.id || b.name} value={b.name}>
                                {b.name}
                              </option>
                            ))
                        ) : (
                          MACEIO_BAIRROS.filter((b) => b.name !== areaBairro).map((b) => (
                            <option key={b.name} value={b.name}>
                              {b.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Team Size & Radius */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          Equipe (Voluntários)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={areaTeamSize}
                          onChange={(e) =>
                            setAreaTeamSize(Number(e.target.value))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          Raio (metros)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100000"
                          step="1"
                          value={areaRadius}
                          onChange={(e) =>
                            setAreaRadius(Number(e.target.value))
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Color selection */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Cor correlativa
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={areaColor}
                          onChange={(e) => setAreaColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none shrink-0"
                        />
                        <span className="text-xs text-slate-500 py-1 font-mono uppercase">
                          {areaColor}
                        </span>
                      </div>
                    </div>

                    {/* Contact leader */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Coordenador Local
                      </label>
                      <input
                        type="text"
                        value={areaContact}
                        onChange={(e) => setAreaContact(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Missão / Descrição
                      </label>
                      <textarea
                        value={areaDescription}
                        onChange={(e) => setAreaDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-1 shadow-3xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar Alterações
                    </button>
                  </form>
                </div>
              ) : (
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
              )}

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
                            </div>

                            {/* View toggle and deletion triggers */}
                            <div className="flex items-center gap-1 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAreaActive(area.id);
                                }}
                                className={`p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors ${!area.active ? "text-red-500" : "hover:text-slate-600"}`}
                                title={
                                  area.active
                                    ? "Ocultar do mapa"
                                    : "Exibir no mapa"
                                }
                              >
                                {area.active ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                              </button>

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
                            "{area.description}"
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

                          {/* Membros do Time Delta Atribuídos */}
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

                          {!area.active && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase select-none">
                              <EyeOff className="w-3 h-3" /> Inativo
                            </div>
                          )}
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
              {editingPinId ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </div>
                      Editar Ponto Estratégico
                    </h3>
                    <button
                      type="button"
                      onClick={resetPinForm}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <form onSubmit={savePin} className="space-y-3.5">
                    {/* Title */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Título do Pin *
                      </label>
                      <input
                        type="text"
                        required
                        value={pinTitle}
                        onChange={(e) => setPinTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500 text-slate-800 shadow-2xs"
                      />
                    </div>

                    {/* Associar Candidato */}
                    {selectedCandidateFilter === "all" && (
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          Associar Candidato (Para mapas isolados)
                        </label>
                        <select
                          value={pinCandidateId}
                          onChange={(e) => setPinCandidateId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500 text-slate-800 shadow-2xs font-semibold"
                        >
                          <option value="">Geral / Sem Candidato</option>
                          {candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.office || "Candidato"})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Icon type */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Tipo de Marcador
                      </label>
                      <select
                        value={pinIconType}
                        onChange={(e) => setPinIconType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-orange-500 text-slate-800 shadow-2xs"
                      >
                        <option value="flag">🚩 Bandeira / Comitê</option>
                        <option value="megaphone">
                          📣 Carro de Som / Alto Falante
                        </option>
                        <option value="star">⭐ Evento / Comício</option>
                        <option value="group">👥 Reunião de Liderança</option>
                        <option value="home">🏠 Residência Apoiadora</option>
                      </select>
                    </div>

                    {/* Color selection */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Cor do Pin
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={pinColor}
                          onChange={(e) => setPinColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none shrink-0"
                        />
                        <span className="text-xs text-slate-500 py-1 font-mono uppercase">
                          {pinColor}
                        </span>
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Prazo / Data do Evento
                      </label>
                      <input
                        type="date"
                        value={pinDate}
                        onChange={(e) => setPinDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500 text-slate-800 shadow-2xs"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Anotações / Descrição
                      </label>
                      <textarea
                        value={pinDescription}
                        onChange={(e) => setPinDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500 text-slate-800 shadow-2xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-1 shadow-3xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar Alterações
                    </button>
                  </form>
                </div>
              ) : (
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
              )}

              {/* LIST OF PINS */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 select-none">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" /> Pins
                  Estratégicos ({pins.length})
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
                                {pin.iconType === "flag" && (
                                  <Flag className="w-3.5 h-3.5" />
                                )}
                                {pin.iconType === "megaphone" && (
                                  <Megaphone className="w-3.5 h-3.5" />
                                )}
                                {pin.iconType === "star" && (
                                  <Star className="w-3.5 h-3.5" />
                                )}
                                {pin.iconType === "group" && (
                                  <Users className="w-3.5 h-3.5" />
                                )}
                                {pin.iconType === "home" && (
                                  <Home className="w-3.5 h-3.5" />
                                )}
                                {pin.iconType === "sound" && (
                                  <Volume2 className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                                  {pin.title}
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide font-mono">
                                  Lat: {pin.position.lat.toFixed(4)} | Lng:{" "}
                                  {pin.position.lng.toFixed(4)}
                                </p>
                              </div>
                            </div>

                            {/* Actions Group */}
                            <div className="flex items-center gap-1 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePinActive(pin.id);
                                }}
                                className={`p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors ${!pin.active ? "text-red-500" : "hover:text-slate-600"}`}
                                title={pin.active ? "Ocultar" : "Exibir"}
                              >
                                {pin.active ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                              </button>

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

                          <p className="text-xs text-slate-500 mt-2 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                            "{pin.description || "Sem descrição cadastrada."}"
                          </p>

                          {/* Membros do Time Delta Atribuídos para PINS */}
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

                          {!pin.active && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase select-none">
                              <EyeOff className="w-3.5 h-3.5" /> Ocultado
                            </div>
                          )}
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
          pins={filteredPins}
          checkIns={filteredCheckIns}
          selectedId={selectedId}
          defaultLocation={mapDefaultLocation}
          selectedCandidateId={selectedCandidateFilter}
          candidates={candidates}
          mapFilter={mapFilter}
          onMapFilterChange={setMapFilter}
          onSelectItem={(id, type) => {
            setSelectedId(id);
            if (type === "area") {
              const found = areas.find((a) => a.id === id);
              if (found) {
                startEditArea(found);
                setIsSidebarOpen(true);
              }
            } else {
              const found = pins.find((p) => p.id === id);
              if (found) {
                startEditPin(found);
                setIsSidebarOpen(true);
              }
            }
          }}
          clickToPickCoords={clickToPickCoords}
          onCoordsPicked={(coords) => {
            setPickedCoords(coords);
          }}
          tempPlacementCoords={pickedCoords}
          tempPlacementColor={
            coordsPickingMode === "area" ? areaColor : pinColor
          }
          tempPlacementRadius={areaRadius}
          tempPlacementType={coordsPickingMode}
          externalBairroName={creationBairroName}
          externalRuaName={creationRuaName}
          onExternalBairroChange={handleCreationBairroSelect}
          onExternalRuaChange={handleCreationRuaSelect}
          externalStateShortName={creationStateShortName}
          externalStateName={creationStateName}
          externalCityIbgeId={creationCityIbgeId}
          externalCityName={creationCityName}
          externalDistrictId={creationDistrictId}
          onExternalStateChange={(short, name) => {
            setCreationStateShortName(short);
            setCreationStateName(name);
            setCreationCityIbgeId(null);
            setCreationCityName(null);
            setCreationBairroName(null);
            setCreationDistrictId(null);
            setCreationRuaName(null);
          }}
          onExternalCityChange={(ibgeCode, name) => {
            setCreationCityIbgeId(ibgeCode);
            setCreationCityName(name);
            setCreationBairroName(null);
            setCreationDistrictId(null);
            setCreationRuaName(null);
          }}
          onExternalDistrictIdChange={(id) => {
            setCreationDistrictId(id);
          }}
        />
      </div>

      {/* CENTER RE-DESIGNED CREATION MODAL */}
      <AnimatePresence>
        {creationModalType && (
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
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5 relative text-slate-800"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-indigo-950 text-base leading-tight">
                    {creationModalType === "area"
                      ? "Criar Área de Trabalho (Raio)"
                      : "Criar Ponto Estratégico (PIN)"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Planeje a localização ideal selecionando o bairro e rua.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (creationModalType === "area") resetAreaForm();
                    else resetPinForm();
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form container */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (creationModalType === "area") saveArea(e);
                  else savePin(e);
                }}
                className="space-y-4"
              >
                {/* 1. SELEÇÃO DE BAIRRO E RUA (SEMPRE APARECE NO MEIO DA TELA PRIMEIRO) */}
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

                {/* 2. DADOS ADICIONAIS SÓ APÓS SELECIONAR BAIRRO E RUA */}
                {creationBairroName && creationRuaName ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-1.5 duration-200">
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-extrabold text-[10px] text-emerald-600">
                          2
                        </div>
                        <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest leading-none">
                          Dados de Identificação
                        </h4>
                      </div>
                    </div>

                    {creationModalType === "area" ? (
                      <>
                        {/* Area specific inputs */}
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Título da Equipe / Ação *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Equipe Laranja - Panfletagem"
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
                              value={areaTeamSize}
                              onChange={(e) =>
                                setAreaTeamSize(Number(e.target.value))
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
                              {areaRadius} metros
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="1"
                              max="15000"
                              step="5"
                              value={areaRadius}
                              onChange={(e) =>
                                setAreaRadius(Number(e.target.value))
                              }
                              className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <input
                              type="number"
                              min="1"
                              max="100000"
                              value={areaRadius}
                              onChange={(e) =>
                                setAreaRadius(Number(e.target.value))
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

                        {/* Associar Candidato & Seleção de Membros do Time Delta */}
                        <div className="space-y-3 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          {selectedCandidateFilter === "all" && (
                            <div>
                              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                                Candidato Associado à Missão
                              </label>
                              <select
                                value={areaCandidateId}
                                onChange={(e) => {
                                  setAreaCandidateId(e.target.value);
                                  setSelectedDeltas([]);
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs cursor-pointer"
                              >
                                <option value="">Geral / Sem Candidato</option>
                                {candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.office || "Candidato"})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className="block text-[10.5px] uppercase tracking-wider font-bold text-indigo-950 mb-1">
                              Direcionar Missão ao Time Delta do Candidato
                            </label>
                            <p className="text-[10px] text-slate-500 font-medium mb-1 leading-tight">
                              Selecione os membros que devem receber esta
                              missão. Se nenhum for marcado, ela ficará visível
                              para todo o time do candidato.
                            </p>
                            {(() => {
                              const activeCandId = areaCandidateId;
                              const candidatesDeltas = supporters.filter(
                                (s) =>
                                  s.candidate_id === activeCandId ||
                                  s.candidateId === activeCandId,
                              );

                              if (!activeCandId) {
                                return (
                                  <div className="text-[10px] text-slate-400 italic bg-white p-2 rounded-xl border border-slate-150 text-center">
                                    Selecione um candidato acima para carregar o
                                    seu Time Delta.
                                  </div>
                                );
                              }

                              if (candidatesDeltas.length === 0) {
                                return (
                                  <div className="text-[10px] text-amber-600 bg-amber-50/50 border border-amber-100 p-2 rounded-xl font-semibold text-center">
                                    Nenhum integrante cadastrado no Time Delta
                                    deste candidato.
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-1 gap-1.5 border border-slate-200 rounded-xl p-2 max-h-[140px] overflow-y-auto bg-white shadow-xs">
                                  {candidatesDeltas.map((delta) => {
                                    const isSelected = selectedDeltas.includes(
                                      delta.id,
                                    );
                                    return (
                                      <button
                                        type="button"
                                        key={delta.id}
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedDeltas((prev) =>
                                              prev.filter(
                                                (id) => id !== delta.id,
                                              ),
                                            );
                                          } else {
                                            setSelectedDeltas((prev) => [
                                              ...prev,
                                              delta.id,
                                            ]);
                                          }
                                        }}
                                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold font-semibold"
                                            : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 text-slate-600"
                                        }`}
                                      >
                                        <div
                                          className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                                            isSelected
                                              ? "bg-indigo-600 border-indigo-600"
                                              : "bg-white border-slate-300"
                                          }`}
                                        >
                                          {isSelected && (
                                            <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                                          )}
                                        </div>
                                        <div className="truncate text-ellipsis">
                                          <p className="text-[11px] leading-tight font-bold truncate">
                                            {delta.full_name ||
                                              delta.nome_completo ||
                                              delta.nome}
                                          </p>
                                          <p className="text-[9px] text-slate-400 font-mono leading-none">
                                            {delta.whatsapp}
                                          </p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Pin specific inputs */}
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Título do Ponto Estratégico *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Comitê Setorial Jatiúca"
                            value={pinTitle}
                            onChange={(e) => setPinTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                              Marcador / Tipo
                            </label>
                            <select
                              value={pinIconType}
                              onChange={(e) =>
                                setPinIconType(e.target.value as any)
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                            >
                              <option value="flag">🚩 Bandeira / Comitê</option>
                              <option value="megaphone">
                                📣 Carro de Som / Alto Falante
                              </option>
                              <option value="star">⭐ Evento / Comício</option>
                              <option value="group">
                                👥 Reunião de Liderança
                              </option>
                              <option value="home">
                                🏠 Residência Apoiadora
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                              Cor do Ponto
                            </label>
                            <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 items-center">
                              <input
                                type="color"
                                value={pinColor}
                                onChange={(e) => setPinColor(e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent shrink-0"
                              />
                              <span className="text-[10px] font-mono font-medium text-slate-500 translate-x-1 uppercase">
                                {pinColor}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                              Prazo / Data do Evento (Opcional)
                            </label>
                            <input
                              type="date"
                              value={pinDate}
                              onChange={(e) => setPinDate(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                            Anotações / Descrição do Marcador
                          </label>
                          <textarea
                            placeholder="Ex: Reunião às 19h com a liderança no comitê..."
                            value={pinDescription}
                            onChange={(e) => setPinDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs"
                          />
                        </div>

                        {/* Associar Candidato & Seleção de Membros do Time Delta para PIN */}
                        <div className="space-y-3 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          {selectedCandidateFilter === "all" && (
                            <div>
                              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                                Candidato Associado à Missão
                              </label>
                              <select
                                value={pinCandidateId}
                                onChange={(e) => {
                                  setPinCandidateId(e.target.value);
                                  setSelectedDeltas([]);
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs cursor-pointer"
                              >
                                <option value="">Geral / Sem Candidato</option>
                                {candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.office || "Candidato"})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className="block text-[10.5px] uppercase tracking-wider font-bold text-indigo-950 mb-1">
                              Direcionar Missão ao Time Delta do Candidato
                            </label>
                            <p className="text-[10px] text-slate-500 font-medium mb-1 leading-tight">
                              Selecione os membros que devem receber esta
                              missão. Se nenhum for marcado, ela ficará visível
                              para todo o time do candidato.
                            </p>
                            {(() => {
                              const activeCandId = pinCandidateId;
                              const candidatesDeltas = supporters.filter(
                                (s) =>
                                  s.candidate_id === activeCandId ||
                                  s.candidateId === activeCandId,
                              );

                              if (!activeCandId) {
                                return (
                                  <div className="text-[10px] text-slate-400 italic bg-white p-2 rounded-xl border border-slate-150 text-center">
                                    Selecione um candidato acima para carregar o
                                    seu Time Delta.
                                  </div>
                                );
                              }

                              if (candidatesDeltas.length === 0) {
                                return (
                                  <div className="text-[10px] text-amber-600 bg-amber-50/50 border border-amber-100 p-2 rounded-xl font-semibold text-center">
                                    Nenhum integrante cadastrado no Time Delta
                                    deste candidato.
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-1 gap-1.5 border border-slate-200 rounded-xl p-2 max-h-[140px] overflow-y-auto bg-white shadow-xs">
                                  {candidatesDeltas.map((delta) => {
                                    const isSelected = selectedDeltas.includes(
                                      delta.id,
                                    );
                                    return (
                                      <button
                                        type="button"
                                        key={delta.id}
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedDeltas((prev) =>
                                              prev.filter(
                                                (id) => id !== delta.id,
                                              ),
                                            );
                                          } else {
                                            setSelectedDeltas((prev) => [
                                              ...prev,
                                              delta.id,
                                            ]);
                                          }
                                        }}
                                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold font-semibold"
                                            : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 text-slate-600"
                                        }`}
                                      >
                                        <div
                                          className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                                            isSelected
                                              ? "bg-indigo-600 border-indigo-600"
                                              : "bg-white border-slate-300"
                                          }`}
                                        >
                                          {isSelected && (
                                            <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                                          )}
                                        </div>
                                        <div className="truncate text-ellipsis">
                                          <p className="text-[11px] leading-tight font-bold truncate">
                                            {delta.full_name ||
                                              delta.nome_completo ||
                                              delta.nome}
                                          </p>
                                          <p className="text-[9px] text-slate-400 font-mono leading-none">
                                            {delta.whatsapp}
                                          </p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Action Buttons inside Modal */}
                    <div className="flex gap-3 pt-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
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
                            <span>Confirmar e Criar no Mapa</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center select-none">
                    <p className="text-xs text-slate-400 animate-pulse">
                      Escolha o Bairro e a Rua acima para prosseguir com os
                      dados da criação
                    </p>
                  </div>
                )}
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
                    {window.location.origin}/checkin
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/checkin`;
                      navigator.clipboard
                        .writeText(shareUrl)
                        .then(() => {
                          triggerNotification(
                            "Link de check-in copiado!",
                            "success",
                          );
                        })
                        .catch(() => {
                          triggerNotification("Erro ao copiar link.", "error");
                        });
                    }}
                    className="px-4 bg-indigo-600 hover:bg-indigo-700 hover:text-white border border-indigo-750 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors whitespace-nowrap active:scale-95 shadow-md hover:shadow-lg"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Botão de Simulação Instantânea */}
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">
                    Demonstração
                  </span>
                  <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                    Teste o formulário do voluntário simulando o fluxo no
                    próprio navegador.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setCurrentUrlView("checkin");
                    // Atualizar url temporariamente sem dar reload
                    const url = new URL(window.location.href);
                    url.searchParams.set("view", "checkin");
                    window.history.pushState({}, "", url.toString());
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-colors whitespace-nowrap active:scale-95"
                >
                  Simular Fluxo
                </button>
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
        {showSupabaseSqlModal && (
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
                      Integração Supabase Live
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Sincronização de Pins, Check-ins e Áreas em tempo real.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSupabaseSqlModal(false)}
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
                  {isSupabaseConfigured ? (
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
                        Insira as credenciais <strong>VITE_SUPABASE_URL</strong>{" "}
                        e <strong>VITE_SUPABASE_ANON_KEY</strong> em Secrets no
                        menu de configurações.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block pb-1">
                    Tabelas e Comunicação
                  </span>
                  {supabaseError ? (
                    <div className="space-y-1 mt-0.5">
                      <div className="flex items-start gap-1 text-rose-700">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-bold uppercase block leading-tight">
                          Pendência de Estratégia
                        </span>
                      </div>
                      <p className="text-[10px] text-rose-500/90 leading-snug">
                        {supabaseError}
                      </p>
                    </div>
                  ) : !isSupabaseConfigured ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
                      <strong className="text-slate-500 text-xs font-bold uppercase">
                        Aguardando Chaves...
                      </strong>
                    </div>
                  ) : isSyncingSupabase ? (
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
              {isSupabaseConfigured && !supabaseError && (
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl text-left space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-xs text-indigo-950 font-bold block">
                        Sincronização Forçada das Tabelas
                      </strong>
                      <p className="text-[10px] text-slate-550 leading-relaxed mt-0.5">
                        Pressione para fazer o upload e mesclar todos os seus
                        pins, áreas e check-ins locais ativos atuais diretamente
                        para seu banco live do Supabase.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsSyncingSupabase(true);
                        try {
                          for (const a of areas) {
                            await SupabaseService.upsertArea(a);
                          }
                          for (const p of pins) {
                            await SupabaseService.upsertPin(p);
                          }
                          for (const c of checkIns) {
                            await SupabaseService.upsertCheckIn(c);
                          }
                          triggerNotification(
                            "Todos os registros locais foram consolidados no Supabase!",
                            "success",
                          );
                        } catch (err: any) {
                          triggerNotification(
                            `Erro de Sincronia: ${err.message}`,
                            "error",
                          );
                        } finally {
                          setIsSyncingSupabase(false);
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1 min-w-[130px]"
                    >
                      {isSyncingSupabase ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-white" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <span>Enviar ao Supabase</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Big Explanation & SQL script instructions */}
              <div className="space-y-1.5 flex-1 flex flex-col min-h-0 text-left">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-black">
                  Instalação SQL do Supabase
                </label>
                <p className="text-[10.5px] text-slate-500 leading-relaxed">
                  Para conectar com sucesso, copie e execute o script SQL abaixo
                  dentro do <strong>SQL Editor</strong> do painel do seu projeto
                  no Supabase para criar as três tabelas necessárias em um
                  clique:
                </p>

                <div className="relative flex-1 min-h-[140px] border border-slate-200 rounded-2xl overflow-hidden bg-slate-905 flex flex-col font-mono text-[11px]">
                  <textarea
                    readOnly
                    value={SUPABASE_SQL_SETUP}
                    className="w-full flex-1 p-3.5 bg-slate-900 border-none resize-none focus:outline-hidden font-mono text-[10px] text-slate-300 leading-relaxed block overflow-y-auto"
                  />
                  <div className="absolute right-3.5 top-3.5 z-[10]">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(SUPABASE_SQL_SETUP)
                          .then(() => {
                            triggerNotification(
                              "Script SQL copiado com sucesso!",
                              "success",
                            );
                          });
                      }}
                      className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-zinc-300 hover:text-white rounded-lg cursor-pointer border border-slate-750 font-bold transition-all flex items-center gap-1.5 active:scale-95 text-[9px] uppercase tracking-wider"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Copiar Código</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-1 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSupabaseSqlModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-3xs"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Dialog Modal */}
      <AnimatePresence>
        {customConfirm && customConfirm.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={customConfirm.onCancel}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full relative z-10 border border-slate-100 text-center overflow-hidden flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shadow-3xs">
                <AlertCircle className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <h4 className="text-base font-black text-slate-800 tracking-tight leading-tight">
                  {customConfirm.title}
                </h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 px-1">
                  {customConfirm.message}
                </p>
              </div>

              <div className="flex gap-2.5 w-full mt-2">
                <button
                  type="button"
                  onClick={customConfirm.onCancel}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-95"
                >
                  {customConfirm.cancelText || "Cancelar"}
                </button>
                <button
                  type="button"
                  onClick={customConfirm.onConfirm}
                  className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-500/10"
                >
                  {customConfirm.confirmText || "Confirmar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
