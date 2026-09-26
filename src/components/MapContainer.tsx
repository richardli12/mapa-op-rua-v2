import React, { FormEvent, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { candidateLocationText } from '../services/candidateLocation';
import { buscarLugares, LugarEncontrado } from '../services/buscaNoMapa';
import FichaEstabelecimento from './FichaEstabelecimento';
import { Estabelecimento } from '../services/estabelecimentos';
import { DatabaseService } from '../databaseClient';
import { Search, X, MapPin, Loader2, Compass, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeft, Check, Building2, Layers, Calendar, Clock, User, Navigation, MessageSquare, Mic, Flag, Ruler, Undo2, Trash2, Star, Crown, Tags, Users, FileText, Pencil, CircleDot, Play, Maximize2, Target, Inbox, FilePlus, HeartPulse, Phone, Mail, Link2 as LinkIcon } from 'lucide-react';
import { CategoriaDeFavorito, PanfletagemArea, CampaignPin, CheckIn, Candidate, OperationType, PriorityLevel, Escola, MaterialDeApoio, LinkDeAcao, corDaDependencia, getCheckInPriority } from '../types';
import { EditorDeMaterial, ItemMaterial } from './MaterialDaMissao';
import {
  SeletorDeCategorias,
  SelosDeCategorias,
  anelDeCategorias,
  categoriasDoCheckIn
} from './CategoriasDeFavorito';
import { UnidadeDeSaude } from '../dados/ubs';
import {
  VisorDoMaterial,
  formatoDoMaterial,
  rotuloDoMaterial
} from './MaterialDaMissao';
import { EtiquetaDePrioridade, EtiquetaDeTurno } from './TurnoEPrioridade';
import TempoDaMissao from './TempoDaMissao';
import CarregandoOperacional from './CarregandoOperacional';
import RelatorioNeo from './RelatorioNeo';
import MissaoParaODelta from './missao/MissaoParaODelta';
import { CHAVE_PROMPT_NEO, PROMPT_NEO_PADRAO, RelatorioDoNeo } from '../neo';
import { gerarRelatorioDaMissao, PecaDoDossie } from '../services/neo';
import { JanelaDeTurno, NOME_DO_TURNO, TURNOS_PADRAO, TurnoId } from '../turnos';
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

/**
 * A prioridade daqui dita no vocabulário do Nexu-GC.
 *
 * São duas escalas diferentes: a daqui é configurável pelo administrador
 * ("Grave — risco à vida", "Rotina"), a de lá é fixa em quatro valores. O
 * palpite é pela palavra, e é só um palpite — por isso ele chega ao bloco do
 * Delta como valor inicial de uma caixa que continua aberta para trocar, e
 * nunca como decisão tomada.
 */
function prioridadeNoNexus(
  rotulo?: string
): 'baixa' | 'normal' | 'alta' | 'critica' {
  const texto = (rotulo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!texto) return 'normal';
  if (/critic|grave|urgent|emergenc|maxima|vida/.test(texto)) return 'critica';
  if (/alta|prioritari|important/.test(texto)) return 'alta';
  if (/baixa|rotina|leve|normalizad/.test(texto)) return 'baixa';
  return 'normal';
}

interface MapContainerProps {
  areas: PanfletagemArea[];
  pins: CampaignPin[];
  checkIns?: CheckIn[];
  /** Escolas do municipio do cliente, camada publica do mapa. */
  escolas?: Escola[];
  /** A camada de escolas so desenha quando esta ligada no dock. */
  escolasVisiveis?: boolean;
  /** As Unidades Básicas de Saúde, lidas do banco por quem tem a conexão. */
  ubs?: UnidadeDeSaude[];
  /** A camada das Unidades Básicas de Saúde, ligada pelo trilho. */
  ubsVisiveis?: boolean;
  /** Clique numa escola: quem mostra a ficha e a tela de cima. */
  onEscolaSelecionada?: (escola: Escola) => void;
  /**
   * A escola com a ficha aberta, pelo código INEP.
   *
   * O mapa precisa saber qual é para responder ao clique onde o clique
   * aconteceu: a ficha abre a quatrocentos pixels dali, e sem destaque no
   * pino quem clicou perde de vista qual dos oitenta e dois era.
   */
  escolaEmFoco?: string | null;
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
    imagem: string | null;
  }[];
  /** Qual deles está em foco: o mapa voa até ele e destaca o marcador. */
  estabelecimentoEmFoco?: string | null;
  /** Item sob o cursor na lista: o pino cresce, mas o mapa não se mexe. */
  estabelecimentoDestacado?: string | null;
  /** Círculo que a inteligência territorial mediu, desenhado no mapa. */
  circuloAnalisado?: { lat: number; lng: number; raio: number } | null;
  /**
   * O círculo da pesquisa de estabelecimentos.
   *
   * Ele é o recorte da busca, e não uma medida: fica desenhado enquanto a
   * pesquisa está em pé, para a lista ao lado e o mapa falarem do mesmo
   * lugar. Quem lê "12 resultados" precisa ver os doze dentro de alguma
   * coisa.
   */
  circuloDeBusca?: { lat: number; lng: number; raio: number } | null;
  /** O ✕ da etiqueta do círculo analisado: tira a medida do mapa. */
  onFecharCirculoAnalisado?: () => void;
  /** O ✕ da etiqueta do círculo da busca: tira o recorte do mapa. */
  onFecharCirculoDeBusca?: () => void;
  /** Ferramenta armada: o próximo gesto no mapa desenha o raio da busca. */
  desenhandoRaioDeBusca?: boolean;
  onRaioDeBuscaDesenhado?: (circulo: { lat: number; lng: number; raio: number }) => void;
  /** Bairros e setores desenhados por cima do mapa, pintados por intensidade. */
  recortesTerritoriais?: {
    id: string;
    nome: string;
    geometria: any;
    /** O número que pinta a área. `null` é ausência de dado, não zero. */
    valor: number | null;
    /** Texto pronto para o balão, montado por quem tem os dados completos. */
    resumo: string;
    tipo: 'bairro' | 'setor';
    /** Números crus do recorte, lidos pela ficha do canto do mapa. */
    dados?: {
      populacao: number | null;
      domicilios: number | null;
      areaKm2: number | null;
      densidade: number | null;
      mediaMoradores: number | null;
      imputados: number | null;
    };
  }[];
  /** Faixas da escala de cor, do mais claro ao mais escuro. */
  escalaTerritorial?: { corte: number; cor: string }[];
  recorteEmFoco?: string | null;
  /**
   * O recorte que o clique fixou na ficha do canto. Ele fica marcado no mapa
   * até ser solto — é o "este aqui" de quem está lendo o Censo de um lugar.
   */
  recorteFixado?: string | null;
  /** 0 a 1: quanto da mancha aparece. Quem decide é a gaveta de camadas. */
  opacidadeDosRecortes?: number;
  onRecorteClicado?: (id: string) => void;
  onRecorteSobOCursor?: (id: string | null) => void;
  /** Enquadra o mapa nos recortes assim que eles chegam. */
  enquadrarRecortes?: boolean;
  /** Clique num marcador de estabelecimento. */
  onEstabelecimentoSelecionado?: (id: string) => void;
  /** Entrega ao painel o centro e o zoom de agora, para a busca por área. */
  aoRegistrarVista?: (ler: () => { lat: number; lng: number; zoom: number } | null) => void;
  onCoordsPicked: (coords: { lat: number; lng: number }) => void;
  /**
   * Ponto ou área que está aberta no editor.
   *
   * Ela sai do mapa enquanto está sendo editada: quem representa o lugar
   * escolhido é o fantasma tracejado, que se arrasta. Sem isso o marcador
   * antigo e o novo ficariam empilhados, e mover o ponto não teria efeito
   * visível nenhum até salvar.
   */
  itemEmEdicaoId?: string | null;
  /**
   * O que a tela de cima quer pendurar na barra, ao lado da busca.
   *
   * O recorte de tempo é do painel, não do mapa — mas o lugar dele é esta
   * fila. Assim os dois controles ficam colados e a busca, ao abrir, empurra
   * o resto sem ninguém calcular posição na mão.
   */
  acoesDaBarra?: React.ReactNode;
  /**
   * Integrantes da equipe, para a missão dizer o nome de quem vai cumpri-la.
   *
   * A missão guarda só os ids; sem esta lista a ficha mostraria "sup-1" a
   * quem quer ler "Carlos Alberto Silva".
   */
  equipe?: any[];
  tempPlacementCoords: { lat: number; lng: number } | null;
  tempPlacementColor: string;
  tempPlacementRadius?: number;
  tempPlacementType?: 'area' | 'pin';
  /** Avisa o raio novo enquanto o circulo e arrastado no mapa. */
  onTempRadiusChange?: (metros: number) => void;
  defaultLocation?: {
    uf: string;
    stateName: string;
    cityIbgeId: number | null;
    cityName: string | null;
  } | null;
  selectedCandidateId?: string;
  candidates?: Candidate[];
  /**
   * Que camadas o mapa desenha.
   *
   * 'nada' é o caso de quem desligou as duas na barra de período: o mapa
   * fica com o território e nada por cima. Existe porque desligar a última
   * camada tem de fazer o que diz, e não virar um clique que não responde.
   */
  mapFilter?: 'all' | 'checkins' | 'markers' | 'favoritos' | 'superfavoritos' | 'nada';
  onMapFilterChange?: (filter: 'all' | 'checkins' | 'markers' | 'favoritos' | 'superfavoritos' | 'nada') => void;
  /** Liga ou desliga a estrela de um check-in, direto do mapa. */
  onToggleCheckInFavorite?: (checkIn: CheckIn) => void;
  /** A coroa na ficha do check-in: liga e desliga o Super Favorito. */
  onToggleCheckInSuperFavorite?: (checkIn: CheckIn) => void;
  /** Todas as categorias de favoritos (cada uma sabe de que cliente é). */
  categoriasDeFavorito?: CategoriaDeFavorito[];
  /** Filtro da barra: só os check-ins em alguma destas categorias. */
  filtroDeCategorias?: string[];
  onLimparFiltroDeCategorias?: () => void;
  /** Põe ou tira o check-in da categoria; devolve as categorias dele depois. */
  onAlternarCategoriaDoCheckIn?: (checkIn: CheckIn, categoriaId: string) => string[];
  onCriarCategoria?: (
    dados: { nome: string; cor: string; emoji: string | null },
    candidateId: string | null
  ) => Promise<CategoriaDeFavorito | null>;
  onEditarCategoria?: (categoria: CategoriaDeFavorito) => void;
  onExcluirCategoria?: (categoria: CategoriaDeFavorito) => void;
  /**
   * Pedido de fora para achar um check-in: o mapa voa até ele e abre a ficha.
   * O `n` muda a cada pedido, para pedir o mesmo check-in duas vezes.
   */
  checkInParaAbrir?: { id: string; n: number } | null;
  /** Exclusão do check-in pelo administrador, direto do mapa. */
  onDeleteCheckIn?: (checkIn: CheckIn) => void;
  /**
   * Liga (ou desliga) este check-in de uma missão.
   *
   * Quem grava é o painel, que é dono da lista e do banco; aqui só se escolhe.
   */
  onVincularCheckInAMissao?: (
    checkIn: any,
    missao: { id: string; titulo: string } | null
  ) => void;
  /**
   * Guarda o controle de narrativas de uma missão já criada.
   *
   * Quem grava é o painel, dono da lista e do banco; a ficha só escolhe os
   * arquivos — como no vínculo do check-in.
   */
  onNarrativasDaMissao?: (
    missao: { id: string; tipo: 'pin' | 'area' },
    narrativas: MaterialDeApoio[],
    /** Em qual tópico das ações táticas a lista entra. */
    topico: 'missao' | 'organico'
  ) => void;
  /** Guarda os links das postagens que saíram da missão. */
  onLinksDaMissao?: (
    missao: { id: string; tipo: 'pin' | 'area' },
    links: LinkDeAcao[]
  ) => void;
  /** Avisos na tela, para o editor de arquivos poder reclamar de um envio. */
  notificar?: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
  /** Tipos de Operação cadastrados, usados para achar o ícone de cada ponto. */
  operationTypes?: OperationType[];
  /** Níveis de prioridade criados pelo administrador. */
  priorityLevels?: PriorityLevel[];
  /** O relógio da campanha, para a ficha dizer se o turno é agora. */
  janelasDeTurno?: JanelaDeTurno[];

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

/** Escapa o que veio do usuário antes de virar HTML dentro do balão. */
const escaparHtml = (texto: string) =>
  String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** "250 m", "1,5 km": a medida que a etiqueta do raio mostra. */
const medidaDoRaio = (metros: number) =>
  metros >= 1000
    ? `${(metros / 1000).toFixed(1).replace('.0', '').replace('.', ',')} km`
    : `${Math.round(metros)} m`;

/**
 * Um círculo de pergunta (análise de território, busca de estabelecimentos)
 * que se fecha de verdade.
 *
 * Antes a etiqueta era um balão parado: dizia o raio, mas não havia onde
 * tocar para tirá-lo do mapa — o círculo ficava lá até alguém descobrir que
 * fechar o painel certo, pelo caminho certo, apagava o desenho. Agora a
 * etiqueta é um controle: tocar no nome enquadra o círculo, tocar no ✕ fecha.
 *
 * O fechar tem um instante de animação (o círculo recolhe para o centro)
 * antes de avisar quem manda no estado — assim o gesto se vê acontecendo, e
 * não parece que o círculo simplesmente piscou.
 */
const desenharCirculoFechavel = (
  grupo: L.LayerGroup,
  map: L.Map,
  circulo: { lat: number; lng: number; raio: number },
  estilo: {
    cor: string;
    preenchimento: number;
    tracejado?: string;
    rotulo: string;
    /** Classe de cor do chip (ex.: 'raio-chip--verde'). */
    tom: string;
    /**
     * Em que borda a etiqueta mora. A análise e a busca podem ser o mesmo
     * círculo (as duas perguntas do mesmo rascunho): uma em cima e outra
     * embaixo, as duas etiquetas se leem e os dois ✕ se acertam.
     */
    lado: 'cima' | 'baixo';
  },
  aoFechar?: () => void
) => {
  const centro = L.latLng(circulo.lat, circulo.lng);

  const anel = L.circle(centro, {
    radius: circulo.raio,
    color: estilo.cor,
    weight: 2,
    opacity: 0.9,
    dashArray: estilo.tracejado,
    fillColor: estilo.cor,
    fillOpacity: estilo.preenchimento,
    interactive: false,
    className: 'raio-nasce'
  }).addTo(grupo);

  const ponto = L.marker(centro, {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: '',
      html:
        `<span class="raio-centro" style="background:${estilo.cor}"></span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    })
  }).addTo(grupo);

  const fechavel = !!aoFechar;
  // A borda do círculo, no mesmo meridiano do centro.
  let borda = centro;
  try {
    const limites = anel.getBounds();
    borda = L.latLng(estilo.lado === 'cima' ? limites.getNorth() : limites.getSouth(), centro.lng);
  } catch {
    // Sem mapa para projetar, a etiqueta fica no centro.
  }
  const chip = L.marker(borda, {
    keyboard: false,
    zIndexOffset: 900,
    bubblingMouseEvents: false,
    icon: L.divIcon({
      className: 'raio-chip-ancora',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html:
        `<div class="raio-chip ${estilo.tom} raio-chip--${estilo.lado}">` +
        `<span class="raio-chip__rotulo" title="Enquadrar o raio">${escaparHtml(estilo.rotulo)}</span>` +
        (fechavel
          ? '<button type="button" class="raio-chip__fechar" data-fechar-raio ' +
            'title="Fechar o raio" aria-label="Fechar o raio">' +
            '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" ' +
            'stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            '</button>'
          : '') +
        '</div>'
    })
  }).addTo(grupo);

  let fechando = false;
  chip.on('click', (ev: L.LeafletMouseEvent) => {
    const alvo = ev.originalEvent?.target as Element | null;
    if (fechavel && alvo?.closest?.('[data-fechar-raio]')) {
      if (fechando) return;
      fechando = true;
      anel.getElement()?.classList.add('raio-fechando');
      ponto.getElement()?.querySelector('.raio-centro')?.classList.add('raio-fechando-centro');
      chip.getElement()?.querySelector('.raio-chip')?.classList.add('raio-chip--saindo');
      window.setTimeout(() => aoFechar?.(), 340);
      return;
    }
    try {
      map.flyToBounds(anel.getBounds(), { padding: [60, 60], maxZoom: 17, duration: 0.6 });
    } catch {
      // Sem enquadrar, o círculo continua lá: nada a desfazer.
    }
  });
};

/**
 * A ONDA DE CHEGADA.
 *
 * Pino que aparece todo de uma vez é um mapa que "pisca". Aqui a chegada tem
 * direção: do meio do conjunto para as bordas, como um sinal que se espalha
 * pela cidade. Quem está no centro chega primeiro; quem está na periferia,
 * por último — e um grão de acaso impede a frente da onda de virar régua.
 *
 * O centro é o do próprio conjunto (e não o da tela) porque a camada costuma
 * enquadrar o mapa logo depois de desenhar: medir pela tela de antes daria
 * uma onda saindo do lugar errado.
 */
const ondaDeChegada = (pontos: { lat: number; lng: number }[], duracao = 900) => {
  if (pontos.length === 0) return () => 0;
  const cLat = pontos.reduce((s, p) => s + p.lat, 0) / pontos.length;
  const cLng = pontos.reduce((s, p) => s + p.lng, 0) / pontos.length;
  const cos = Math.cos((cLat * Math.PI) / 180);
  const dist = (p: { lat: number; lng: number }) => Math.hypot(p.lat - cLat, (p.lng - cLng) * cos);
  const maisLonge = Math.max(...pontos.map(dist), 1e-9);
  return (p: { lat: number; lng: number }) =>
    Math.round((dist(p) / maisLonge) * duracao + Math.random() * 90);
};

/**
 * O relógio de chegada de cada pino.
 *
 * O mapa redesenha os marcadores por qualquer motivo — a equipe carregou, um
 * tipo chegou, a ficha abriu — e redesenhar é recriar o HTML. Um pino no
 * meio da queda voltava do zero ou parava seco. Aqui cada pino guarda QUANDO
 * a queda dele começou; num redesenho, ele volta com o atraso que falta (ou
 * negativo, se já começou), e a animação continua do ponto exato onde
 * estava. Passada a queda, o pino sai do relógio e fica quieto.
 *
 * Devolve o atraso em ms enquanto o pino está chegando, ou `null` quando ele
 * já chegou (ou nunca foi novo).
 */
const tempoDeChegada = (
  relogio: Map<string, number>,
  id: string,
  novo: boolean,
  atraso: () => number,
  duracao = 1700
): number | null => {
  const agora = performance.now();
  let inicio = relogio.get(id);
  if (inicio === undefined) {
    if (!novo) return null;
    inicio = agora + atraso();
    relogio.set(id, inicio);
  }
  if (agora > inicio + duracao) {
    relogio.delete(id);
    return null;
  }
  return Math.round(inicio - agora);
};

/**
 * O estouro do toque: um anel sai do pino no instante do clique.
 *
 * A ficha leva um instante para abrir; o anel chega antes, no lugar onde o
 * dedo tocou — é o "sim, foi este" que faz o clique parecer imediato.
 */
const estourarNoToque = (marcador: L.Marker) => {
  const raiz = marcador.getElement()?.firstElementChild as HTMLElement | null;
  if (!raiz) return;
  raiz.classList.remove('pino-toque');
  void raiz.offsetWidth; // reinicia a animação num segundo toque seguido
  raiz.classList.add('pino-toque');
  window.setTimeout(() => raiz.classList.remove('pino-toque'), 700);
};

/**
 * O pino da missão.
 *
 * A missão é a única coisa no mapa que alguém tem de cumprir — e vinha
 * desenhada igual a qualquer outro marcador, parada no meio dos rótulos de
 * rua. Agora ela pulsa: uma onda sai do pé do pino e a gota flutua, então o
 * olho acha a ordem antes de procurar. O desenho mora no CSS (`.pino-missao`)
 * porque animação em atributo de estilo não tem como ter keyframes.
 *
 * Os selos do canto dizem, sem clique nenhum, o que muda a prioridade de
 * quem olha: quantas pessoas receberam e se há prazo marcado.
 */
const construirPinoDeMissao = (opcoes: {
  cor: string;
  iconeChave: string;
  destacado: boolean;
  pessoas: number;
  temMaterial: boolean;
  prazoVencendo: boolean;
  /** Acabou de aparecer no mapa: cai em onda, com este atraso em ms. */
  surge?: number | null;
  /** Acabou de ser aberto: acende com um estouro. */
  acende?: boolean;
}) => {
  const { cor, iconeChave, destacado, pessoas, temMaterial, prazoVencendo } = opcoes;
  const surge = typeof opcoes.surge === 'number';
  const tamanho = destacado ? 52 : 44;
  const borda = destacado ? 4 : 3;

  const selos: string[] = [];
  if (pessoas > 0) {
    selos.push(
      `<span class="pino-missao__selo" title="${pessoas} pessoa${pessoas > 1 ? 's' : ''} designada${pessoas > 1 ? 's' : ''}">` +
        `<svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` +
        `${pessoas}</span>`
    );
  } else if (temMaterial) {
    selos.push(
      `<span class="pino-missao__selo" title="Tem material de apoio">` +
        `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></span>`
    );
  }
  if (prazoVencendo) {
    selos.push(
      `<span class="pino-missao__selo pino-missao__selo--prazo" title="Prazo chegando">` +
        `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
        `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>`
    );
  }

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="pino-missao${destacado ? ' pino-missao--ativa' : ''}${surge ? ' pino-missao--surge' : ''}${
        opcoes.acende ? ' pino-missao--acende' : ''
      }"
           style="--cor:${cor};--tamanho:${tamanho}px;--borda:${borda}px;--atraso:${surge ? opcoes.surge : 0}ms">
        ${surge ? '<span class="pino-missao__impacto"></span>' : ''}
        ${opcoes.acende ? '<span class="pino-missao__estouro"></span><span class="pino-missao__estouro pino-missao__estouro--2"></span>' : ''}
        <span class="pino-missao__onda"></span>
        <span class="pino-missao__onda pino-missao__onda--2"></span>
        <span class="pino-missao__sombra"></span>
        <div class="pino-missao__gota">
          <div class="pino-missao__icone">${buildOperationIconSvg(iconeChave, 20)}</div>
        </div>
        ${selos.join('')}
      </div>
    `,
    // A âncora é o bico da gota, e não o pé da caixa: é ele que aponta a
    // coordenada. Daí o 1.207 — ver o comentário em `.pino-missao__onda`.
    iconSize: [tamanho, Math.round(tamanho * 1.207) + 6],
    iconAnchor: [tamanho / 2, Math.round(tamanho * 1.207)],
    popupAnchor: [0, -tamanho]
  });
};

/**
 * O cartão que aparece ao passar o cursor, igual em missão e check-in.
 *
 * Quem passa o mouse quer decidir se vale clicar: então entra o que decide
 * isso — o que é, onde, para quem, o que veio junto — e nada além.
 */
const montarBalaoDaMissao = (dados: {
  cor: string;
  etiqueta: string;
  titulo: string;
  descricao?: string;
  linhas: string[];
  pessoas: string[];
  anexos: number;
  capa?: string;
}) => {
  const { cor, etiqueta, titulo, descricao, linhas, pessoas, anexos, capa } = dados;

  const linhasHtml = linhas
    .filter(Boolean)
    .map(
      (linha) =>
        `<p class="text-[10.5px] text-slate-500 font-semibold leading-snug">${linha}</p>`
    )
    .join('');

  const pessoasHtml =
    pessoas.length > 0
      ? `<div class="mt-2 flex flex-wrap items-center gap-1">
           <span class="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Para</span>
           ${pessoas
             .slice(0, 2)
             .map(
               (nome) =>
                 `<span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md" style="background:${cor}18;color:${cor}">${escaparHtml(nome)}</span>`
             )
             .join('')}
           ${pessoas.length > 2 ? `<span class="text-[9.5px] font-bold text-slate-400">+${pessoas.length - 2}</span>` : ''}
         </div>`
      : `<p class="mt-2 text-[9.5px] font-bold text-slate-400">Visível para todo o time</p>`;

  const anexosHtml =
    anexos > 0
      ? `<p class="text-[9.5px] text-slate-500 font-bold mt-1.5">📎 ${anexos} arquivo${anexos > 1 ? 's' : ''} de apoio</p>`
      : '';

  const capaHtml = capa
    ? `<div class="mt-2 rounded-lg overflow-hidden border border-slate-100 max-h-[100px]">
         <img src="${escaparHtml(capa)}" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
       </div>`
    : '';

  return `
    <div class="font-sans min-w-[190px] max-w-[250px]">
      <div class="balao-missao__faixa" style="height:4px;background:${cor}"></div>
      <div class="px-3 py-2.5">
        <p class="font-black uppercase tracking-wider text-[9px] leading-none" style="color:${cor}">
          ${escaparHtml(etiqueta)}
        </p>
        <p class="font-bold text-slate-900 text-[13px] leading-tight mt-1">${escaparHtml(titulo)}</p>
        ${descricao ? `<p class="text-[10.5px] text-slate-500 leading-snug mt-1 line-clamp-2">${escaparHtml(descricao)}</p>` : ''}
        <div class="mt-1.5 space-y-0.5">${linhasHtml}</div>
        ${pessoasHtml}
        ${anexosHtml}
        ${capaHtml}
        <p class="text-[8.5px] text-slate-400 font-black uppercase tracking-wider mt-2">💡 Clique para abrir a ficha</p>
      </div>
    </div>
  `;
};

export default function MapContainer({
  areas,
  pins,
  checkIns,
  escolas,
  escolasVisiveis = false,
  ubs,
  ubsVisiveis = false,
  escolaEmFoco,
  onEscolaSelecionada,
  selectedId,
  onSelectItem,
  clickToPickCoords,
  esconderBusca = false,
  estabelecimentos,
  estabelecimentoEmFoco,
  estabelecimentoDestacado,
  circuloAnalisado,
  circuloDeBusca,
  onFecharCirculoAnalisado,
  onFecharCirculoDeBusca,
  desenhandoRaioDeBusca,
  onRaioDeBuscaDesenhado,
  recortesTerritoriais,
  escalaTerritorial,
  recorteEmFoco,
  recorteFixado = null,
  opacidadeDosRecortes = 1,
  onRecorteClicado,
  onRecorteSobOCursor,
  enquadrarRecortes,
  onEstabelecimentoSelecionado,
  aoRegistrarVista,
  onCoordsPicked,
  itemEmEdicaoId = null,
  acoesDaBarra,
  equipe = [],
  tempPlacementCoords,
  tempPlacementColor,
  tempPlacementRadius = 0,
  tempPlacementType = 'area',
  onTempRadiusChange,
  defaultLocation,
  selectedCandidateId,
  candidates,
  mapFilter: propMapFilter,
  onMapFilterChange,
  onToggleCheckInFavorite,
  onToggleCheckInSuperFavorite,
  categoriasDeFavorito = [],
  filtroDeCategorias = [],
  onLimparFiltroDeCategorias,
  onAlternarCategoriaDoCheckIn,
  onCriarCategoria,
  onEditarCategoria,
  onExcluirCategoria,
  checkInParaAbrir,
  onDeleteCheckIn,
  onVincularCheckInAMissao,
  onNarrativasDaMissao,
  onLinksDaMissao,
  notificar,
  operationTypes = [],
  priorityLevels = [],
  janelasDeTurno = TURNOS_PADRAO,
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
  /** Arrasto do ponto provisório em curso: o clique do fim do gesto não conta. */
  const arrastandoPontoRef = useRef(false);
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
  const ubsGroupRef = useRef<L.LayerGroup | null>(null);
  /** A unidade com a ficha aberta no meio da tela. */
  const [ubsAberta, setUbsAberta] = useState<UnidadeDeSaude | null>(null);
  /** A camada já enquadrou o mapa uma vez? */
  const camadaUbsLigadaRef = useRef(false);
  /** As unidades já desenhadas: só as novas caem com a animação. */
  const idsDeUbsNoMapaRef = useRef<Set<string>>(new Set());
  const lojasGroupRef = useRef<L.LayerGroup | null>(null);
  const analiseGroupRef = useRef<L.LayerGroup | null>(null);
  const buscaGroupRef = useRef<L.LayerGroup | null>(null);
  /** O aviso de raio desenhado, sempre o atual, lido de dentro do gesto. */
  const aoDesenharRaioDeBuscaRef = useRef(onRaioDeBuscaDesenhado);
  aoDesenharRaioDeBuscaRef.current = onRaioDeBuscaDesenhado;
  /** Os ✕ das etiquetas dos círculos: lidos no clique, sempre os atuais. */
  const aoFecharCirculoAnalisadoRef = useRef(onFecharCirculoAnalisado);
  aoFecharCirculoAnalisadoRef.current = onFecharCirculoAnalisado;
  const aoFecharCirculoDeBuscaRef = useRef(onFecharCirculoDeBusca);
  aoFecharCirculoDeBuscaRef.current = onFecharCirculoDeBusca;
  const recortesGroupRef = useRef<L.LayerGroup | null>(null);
  /** O seletor de missão está aberto dentro da ficha do check-in? */
  const [escolhendoMissaoNaFicha, setEscolhendoMissaoNaFicha] = useState(false);
  /**
   * As narrativas da missão aberta, do jeito que o editor precisa vê-las.
   *
   * O editor trabalha com o estado do envio (subindo, pronto, falhou), que não
   * é dado da missão e não vai para o banco. Por isso a lista vive aqui, e só
   * o que terminou é entregue a quem grava.
   */
  const [narrativasNaTela, setNarrativasNaTela] = useState<ItemMaterial[]>([]);
  /** O mesmo, para o tópico orgânico. */
  const [organicasNaTela, setOrganicasNaTela] = useState<ItemMaterial[]>([]);
  /** O link sendo digitado, e o apelido opcional dele. */
  const [linkNovo, setLinkNovo] = useState('');
  const [tituloDoLinkNovo, setTituloDoLinkNovo] = useState('');
  /** Camadas por id, para acender a do item que a lista apontar. */
  const recortesPorIdRef = useRef<{ [id: string]: any }>({});
  /** Assinatura do último enquadramento, para não reenquadrar à toa. */
  const ultimoRecorteRef = useRef<string>('');
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
  const [localMapFilter, setLocalMapFilter] = useState<'all' | 'checkins' | 'markers' | 'favoritos' | 'superfavoritos' | 'nada'>('all');
  const mapFilter = propMapFilter !== undefined ? propMapFilter : localMapFilter;
  const setMapFilter = onMapFilterChange !== undefined ? onMapFilterChange : setLocalMapFilter;
  const [selectedCheckInForModal, setSelectedCheckInForModal] = useState<CheckIn | null>(null);
  /** O botão de categorias da ficha, onde o seletor se ancora quando abre. */
  const [ancoraDasCategorias, setAncoraDasCategorias] = useState<HTMLElement | null>(null);
  /** Conta as coroas postas na ficha: cada uma replay a animação de pouso. */
  const [coroaRecemPosta, setCoroaRecemPosta] = useState(0);
  // Outra ficha, outra história: a coroa dela não chega pousando, e o
  // seletor de categorias da anterior não fica aberto sobre ela.
  useEffect(() => {
    setCoroaRecemPosta(0);
    setAncoraDasCategorias(null);
  }, [selectedCheckInForModal?.id]);
  /** Check-ins desenhados da última vez: só quem não estava surge animado. */
  const idsDeCheckInNoMapaRef = useRef<Set<string>>(new Set());
  /**
   * Um tique a cada cinco minutos: o "ao vivo" de um check-in vence com o
   * tempo, e o mapa precisa apagar o radar de quem já passou da hora sem
   * esperar outra mudança qualquer para se redesenhar.
   */
  const [relogioDoMapa, setRelogioDoMapa] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setRelogioDoMapa(n => n + 1), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  /** Missões (pinos e áreas) já na tela: só as novas chegam em onda. */
  const idsDeMissaoNoMapaRef = useRef<Set<string>>(new Set());
  const idsDeAreaNoMapaRef = useRef<Set<string>>(new Set());
  /** A missão que estava aberta no desenho anterior: a nova acende. */
  const missaoAcesaRef = useRef<string | null>(null);
  /** Escolas já na tela: só as novas chegam em onda. */
  const idsDeEscolaNoMapaRef = useRef<Set<string>>(new Set());
  /** Os relógios de chegada (ver `tempoDeChegada`), um por camada. */
  const chegadaDasMissoesRef = useRef(new Map<string, number>());
  const chegadaDasAreasRef = useRef(new Map<string, number>());
  const chegadaDosCheckInsRef = useRef(new Map<string, number>());
  const chegadaDasEscolasRef = useRef(new Map<string, number>());

  // Ficha nova, seletor fechado: abrir o próximo check-in já com a lista de
  // missões aberta seria oferecer uma escolha que ninguém pediu.
  useEffect(() => {
    setEscolhendoMissaoNaFicha(false);
  }, [(selectedCheckInForModal as any)?.id]);

  /**
   * Missão aberta na ficha, guardada só pelo id.
   *
   * Guardar o objeto inteiro deixaria a ficha mostrando a versão de antes
   * depois de uma edição, e viva depois de uma exclusão. Com o id, ela lê
   * sempre a lista de agora e se fecha sozinha quando a missão sai do mapa.
   */
  const [missaoAbertaRef, setMissaoAbertaRef] = useState<{
    id: string;
    tipo: 'pin' | 'area';
  } | null>(null);

  /*
   * O RELATÓRIO DO NEO.
   *
   * Mora aqui, e não dentro da ficha da missão, porque sobrevive a ela: quem
   * mandou gerar pode fechar o card enquanto o modelo lê as imagens, e voltar
   * ao relatório depois. O título da missão é copiado no momento do pedido --
   * a ficha some, o documento continua sabendo de quem ele fala.
   */
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [relatorioCarregando, setRelatorioCarregando] = useState(false);
  const [relatorioErro, setRelatorioErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioDoNeo | null>(null);
  const [relatorioGuardado, setRelatorioGuardado] = useState(false);
  const [salvandoRelatorio, setSalvandoRelatorio] = useState(false);

  /**
   * A missão aberta já tem relatório guardado?
   *
   * É o que decide se o botão do rodapé diz "Gerar Relatório" ou "Ver
   * Relatório". Um botão que diz "gerar" para algo que já existe promete
   * espera e custo que não vão acontecer, e quem clica hesita -- ou pior,
   * deixa de clicar achando que vai pagar por outra leitura.
   */
  const [missaoTemRelatorio, setMissaoTemRelatorio] = useState(false);
  const [pecasDoRelatorio, setPecasDoRelatorio] = useState<PecaDoDossie[]>([]);
  const [missaoDoRelatorio, setMissaoDoRelatorio] = useState<{
    dados: any;
    titulo: string;
  } | null>(null);
  /** Índice do material aberto em tela cheia, por cima da ficha. */
  const [materialAberto, setMaterialAberto] = useState<number | null>(null);
  /**
   * As fotos e vídeos do check-in aberto, já no formato do visor.
   *
   * Numa ref porque quem as monta é a própria ficha, ao desenhar: elas saem
   * de três lugares diferentes (tabela nova, jsonb e a foto única antiga) e
   * repetir essa escolha aqui seria manter duas contas que precisam bater.
   */
  const midiasDoCheckInRef = useRef<MaterialDeApoio[]>([]);
  const [midiaDoCheckInAberta, setMidiaDoCheckInAberta] = useState<number | null>(null);
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
    setMidiaDoCheckInAberta(null);
    if (!selectedCheckInForModal?.id) {
      setDetalhesCheckIn({ notas: [], operacoes: [], midias: [] });
      midiasDoCheckInRef.current = [];
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

  /*
   * O CAMINHO DE VOLTA PARA A MISSÃO.
   *
   * "Ver feedback completo" troca a ficha da missão pela do check-in — dois
   * modais empilhados escondem qual deles o X fecha. Só que trocar sem deixar
   * caminho de volta obrigava a fechar tudo, achar o pino de novo no mapa,
   * reabrir a missão e rolar de novo até o retorno seguinte. Quem está lendo
   * os retornos de uma missão quer ler OS retornos: um atrás do outro, e
   * voltar para onde estava.
   *
   * Por isso a ficha do check-in lembra de onde veio: qual missão, com que
   * cor, e em que altura a ficha dela estava rolada. Voltar reabre a missão
   * nesse mesmo ponto e acende o cartão do retorno que acabou de ser lido.
   * Enquanto isso, as setas passam de um retorno para o próximo sem sair.
   */
  const [voltaParaMissao, setVoltaParaMissao] = useState<{
    id: string;
    tipo: 'pin' | 'area';
    titulo: string;
    cor: string;
    rolagem: number;
  } | null>(null);
  /** De que lado o retorno seguinte entra: a ficha desliza no sentido da seta. */
  const [sentidoDoRetorno, setSentidoDoRetorno] = useState<1 | -1 | 0>(0);
  /** Cartão de retorno que acende quando se volta para a missão. */
  const [retornoEmDestaque, setRetornoEmDestaque] = useState<string | null>(null);
  const corpoDaMissaoRef = useRef<HTMLDivElement | null>(null);
  const corpoDoCheckInRef = useRef<HTMLDivElement | null>(null);
  /** Rolagem a restaurar assim que a ficha da missão remontar. */
  const rolagemPendenteRef = useRef<{ topo: number; alvo: string | null } | null>(null);

  /**
   * Os retornos da missão de onde se veio, lidos da lista de agora.
   *
   * Da lista viva, e não de uma cópia tirada no clique: se um retorno for
   * desvinculado aqui mesmo na ficha, ele sai da contagem na hora, em vez de
   * continuar sendo "2 de 3" de uma missão que já não é a dele.
   */
  const retornosDaVolta = React.useMemo(
    () =>
      voltaParaMissao
        ? (checkIns || []).filter((c: any) => c.missionId === voltaParaMissao.id)
        : [],
    [voltaParaMissao, checkIns]
  );
  const posicaoNaVolta = selectedCheckInForModal
    ? retornosDaVolta.findIndex((c: any) => c.id === (selectedCheckInForModal as any).id)
    : -1;

  /** Da ficha da missão para a ficha de um retorno, lembrando o caminho. */
  const abrirRetornoDaMissao = (checkIn: CheckIn) => {
    if (!missaoAberta) return;
    setVoltaParaMissao({
      id: missaoAberta.id,
      tipo: missaoAberta.tipo,
      titulo: missaoAberta.titulo,
      cor: missaoAberta.cor,
      rolagem: corpoDaMissaoRef.current?.scrollTop || 0
    });
    setSentidoDoRetorno(0);
    setMissaoAbertaRef(null);
    setSelectedCheckInForModal(checkIn);
  };

  /** Fecha a ficha do check-in de vez: o caminho de volta vai junto. */
  const fecharFichaDoCheckIn = () => {
    setSelectedCheckInForModal(null);
    setVoltaParaMissao(null);
  };

  /** Reabre a missão onde ela estava, com o retorno lido aceso. */
  const voltarParaAMissao = () => {
    const volta = voltaParaMissao;
    if (!volta) return;
    const lido = (selectedCheckInForModal as any)?.id || null;
    rolagemPendenteRef.current = { topo: volta.rolagem, alvo: lido };
    setSelectedCheckInForModal(null);
    setVoltaParaMissao(null);
    setMissaoAbertaRef({ id: volta.id, tipo: volta.tipo });
  };

  /** Anda entre os retornos da mesma missão sem sair da ficha. */
  const irParaRetorno = (passo: 1 | -1) => {
    const total = retornosDaVolta.length;
    if (total < 2 || posicaoNaVolta < 0) return;
    const proximo = retornosDaVolta[(posicaoNaVolta + passo + total) % total];
    if (!proximo) return;
    setSentidoDoRetorno(passo);
    setSelectedCheckInForModal(proximo);
  };

  // Retorno novo, leitura do começo: abrir o seguinte já rolado até o fim
  // do anterior faria parecer que a ficha nova não tem cabeçalho.
  useEffect(() => {
    if (corpoDoCheckInRef.current) corpoDoCheckInRef.current.scrollTop = 0;
  }, [(selectedCheckInForModal as any)?.id]);

  /*
   * A ficha da missão remontou depois de um "voltar": devolve a rolagem e
   * acende o cartão de onde se saiu. Antes da pintura, para a ficha não
   * nascer no topo e pular para baixo diante de quem olha.
   */
  React.useLayoutEffect(() => {
    const pendente = rolagemPendenteRef.current;
    const corpo = corpoDaMissaoRef.current;
    if (!pendente || !missaoAbertaRef || !corpo) return;
    rolagemPendenteRef.current = null;
    corpo.scrollTop = pendente.topo;
    if (!pendente.alvo) return;
    const cartao = corpo.querySelector<HTMLElement>(
      `[data-retorno-id="${CSS.escape(pendente.alvo)}"]`
    );
    cartao?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setRetornoEmDestaque(pendente.alvo);
  }, [missaoAbertaRef]);

  useEffect(() => {
    if (!retornoEmDestaque) return;
    const apaga = setTimeout(() => setRetornoEmDestaque(null), 2400);
    return () => clearTimeout(apaga);
  }, [retornoEmDestaque]);

  /*
   * Teclado da ficha do check-in: Esc volta (ou fecha, se não veio de
   * missão) e as setas andam entre os retornos.
   *
   * Com a foto aberta em tela cheia, o teclado é do visor — lá as setas já
   * trocam de foto e o Esc já fecha, e responder aqui também seria dar dois
   * passos com uma tecla. Dentro de um campo de texto, a seta é do cursor.
   */
  useEffect(() => {
    if (!selectedCheckInForModal) return;
    const tecla = (e: KeyboardEvent) => {
      if (midiaDoCheckInAberta !== null) return;
      const alvo = e.target as HTMLElement | null;
      if (
        alvo &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.tagName === 'SELECT' ||
          alvo.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (voltaParaMissao) voltarParaAMissao();
        else fecharFichaDoCheckIn();
      } else if (voltaParaMissao && e.key === 'ArrowLeft') {
        e.preventDefault();
        irParaRetorno(-1);
      } else if (voltaParaMissao && e.key === 'ArrowRight') {
        e.preventDefault();
        irParaRetorno(1);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });
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

  // Controle de visibilidade do painel de pesquisa
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [isMapLoading, setIsMapLoading] = useState(() => {
    return !!(selectedCandidateId && selectedCandidateId !== 'all');
  });

  /*
   * PESQUISA DE LUGARES
   *
   * Antes daqui saía uma cascata de Estado > Município > Bairro > Rua, que
   * só achava o que estava nas listas de CEP e obrigava a descer quatro
   * combos para chegar num endereço. Agora é uma linha de texto e o Google
   * Maps responde — inclusive o comércio e o ponto de referência que nenhuma
   * base de CEP tem. Escolher bairro e rua continua existindo, no formulário
   * de criação, que é de onde a missão nasce.
   */
  const [termoBusca, setTermoBusca] = useState('');
  const [lugares, setLugares] = useState<LugarEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null);
  const [lugarEscolhido, setLugarEscolhido] = useState<string | null>(null);
  /** A busca em curso, para a próxima cancelar a anterior. */
  const buscaRef = useRef<AbortController | null>(null);

  // Search Results Marker State
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const [searchMarkerCoords, setSearchMarkerCoords] = useState<{ lat: number; lng: number; name: string } | null>(null);
  /**
   * O lugar inteiro por trás do pino da pesquisa.
   *
   * O pino guardava só nome e coordenada — o suficiente para desenhar, e
   * nada além disso. Mas a pesquisa já devolve telefone, site, categoria,
   * avaliação e se está aberto agora; tudo isso morria no caminho, e quem
   * achava o lugar no mapa tinha que procurar o telefone dele noutro
   * aplicativo. Agora o resultado viaja inteiro até o pino.
   */
  const [lugarDoPino, setLugarDoPino] = useState<LugarEncontrado | null>(null);
  /** Lido de dentro do clique do marcador, que nasce uma vez só. */
  const lugarDoPinoRef = useRef<LugarEncontrado | null>(null);
  lugarDoPinoRef.current = lugarDoPino;
  /** A ficha aberta pelo pino da pesquisa. */
  const [fichaDaBusca, setFichaDaBusca] = useState<LugarEncontrado | null>(null);

  /**
   * O pino do resultado da pesquisa, em cima do lugar encontrado.
   *
   * Voar até a coordenada não é marcar: o mapa parava sobre a rua e quem
   * procurou tinha que adivinhar qual ponto da tela era o resultado. O pino
   * fica no lugar exato, com o nome preso nele, até a pessoa procurar outra
   * coisa ou limpar — é ele que o botão "Marcar Aqui" transforma em pin da
   * operação.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    if (!searchMarkerCoords) return;

    const marcador = L.marker([searchMarkerCoords.lat, searchMarkerCoords.lng], {
      // Acima dos demais marcadores: o resultado recém-procurado é o que a
      // pessoa está olhando, e não pode ficar atrás de um pin antigo.
      zIndexOffset: 1200,
      keyboard: false,
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="pino-busca">
            <span class="pino-busca__pulso"></span>
            <span class="pino-busca__corpo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="#ffffff" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
          </div>
        `,
        iconSize: [34, 44],
        // A ponta do pino é que marca o lugar, não o meio do desenho.
        iconAnchor: [17, 44],
        popupAnchor: [0, -40],
      }),
    })
      .addTo(map)
      .bindTooltip(searchMarkerCoords.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -42],
        className: 'rotulo-busca',
      });

    /*
     * Tocar no pino abre o que a pesquisa sabe do lugar.
     *
     * O pino dizia o nome e parava aí. Quem procurou "Escola Cecilia
     * Meireles" achava o lugar e continuava sem o telefone que a própria
     * consulta já tinha trazido. O clique é a porta natural para isso -- e
     * tem de parar de subir, senão vira marcação de ponto no mapa.
     */
    marcador.on('click', evento => {
      L.DomEvent.stopPropagation(evento);
      const lugar = lugarDoPinoRef.current;
      if (lugar) setFichaDaBusca(lugar);
    });

    searchMarkerRef.current = marcador;

    return () => {
      marcador.remove();
      if (searchMarkerRef.current === marcador) searchMarkerRef.current = null;
    };
  }, [searchMarkerCoords]);

  /**
   * Procura o que foi escrito, perto do que a pessoa está vendo.
   *
   * O centro do mapa vai junto de propósito: sem ele, "avenida ana karina"
   * pode voltar uma avenida de mesmo nome em outro estado. Com ele, o Google
   * procura onde a pessoa está olhando, que é o que ela quis dizer.
   */
  const pesquisarNoMapa = async (evento?: FormEvent) => {
    evento?.preventDefault();
    const termo = termoBusca.trim();
    if (!termo || buscando) return;

    buscaRef.current?.abort();
    const controlador = new AbortController();
    buscaRef.current = controlador;

    setBuscando(true);
    setErroBusca(null);
    setAvisoBusca(null);
    setLugarEscolhido(null);

    const mapa = mapRef.current;
    const centro = mapa
      ? { lat: mapa.getCenter().lat, lng: mapa.getCenter().lng, zoom: mapa.getZoom() }
      : null;

    try {
      const achado = await buscarLugares({ termo, centro, sinal: controlador.signal });
      setLugares(achado.lugares);
      setAvisoBusca(
        achado.lugares.length === 0
          ? achado.aviso ||
              'Nada encontrado com esse nome por aqui. Tente escrever de outro jeito ou afaste o mapa.'
          : null,
      );
    } catch (err: any) {
      // Busca cancelada é a pessoa pedindo outra, não uma falha para mostrar.
      if (err?.name === 'AbortError') return;
      setLugares([]);
      setErroBusca(err?.mensagem || 'Algo falhou na pesquisa. Tente de novo.');
    } finally {
      if (buscaRef.current === controlador) {
        buscaRef.current = null;
        setBuscando(false);
      }
    }
  };

  /** Leva o mapa até o resultado e deixa o cartão de "Marcar Aqui" à mão. */
  const irParaLugar = (lugar: LugarEncontrado) => {
    setLugarEscolhido(lugar.id);
    mapRef.current?.flyTo([lugar.latitude, lugar.longitude], 17, {
      animate: true,
      duration: 1.2,
    });
    // No mapa vale o nome curto: o endereço inteiro vira um rótulo que tapa
    // a rua que ele está tentando apontar, e já está logo ali, na lista.
    setSearchMarkerCoords({
      lat: lugar.latitude,
      lng: lugar.longitude,
      name: lugar.titulo,
    });
    setLugarDoPino(lugar);
  };

  const limparBusca = () => {
    buscaRef.current?.abort();
    buscaRef.current = null;
    setTermoBusca('');
    setLugares([]);
    setErroBusca(null);
    setAvisoBusca(null);
    setLugarEscolhido(null);
    setBuscando(false);
    setSearchMarkerCoords(null);
    setLugarDoPino(null);
    setFichaDaBusca(null);
    delimitationGroupRef.current?.clearLayers();
  };

  // Busca em curso quando a tela sai do ar é busca que ninguém vai ler.
  useEffect(() => () => buscaRef.current?.abort(), []);

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
    const ubsGroup = L.layerGroup().addTo(map);
    const lojasGroup = L.layerGroup().addTo(map);
    const analiseGroup = L.layerGroup().addTo(map);
    const recortesGroup = L.layerGroup().addTo(map);
    const delimitationGroup = L.layerGroup().addTo(map);

    circlesGroupRef.current = circlesGroup;
    pinsGroupRef.current = pinsGroup;
    tempGroupRef.current = tempGroup;
    checkInsGroupRef.current = checkInsGroup;
    escolasGroupRef.current = escolasGroup;
    ubsGroupRef.current = ubsGroup;
    lojasGroupRef.current = lojasGroup;
    analiseGroupRef.current = analiseGroup;
    const buscaGroup = L.layerGroup().addTo(map);
    buscaGroupRef.current = buscaGroup;
    recortesGroupRef.current = recortesGroup;
    delimitationGroupRef.current = delimitationGroup;
    mapRef.current = map;

    // Listeners for map coordinate picking
    map.on('click', (e: L.LeafletMouseEvent) => {
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
      // Idem para o arrasto do ponto provisório.
      if (arrastandoPontoRef.current) return;
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

    // Ferramenta armada é ferramenta que se vê: a mira diz que o próximo
    // gesto desenha, seja ele o de uma área ou o do raio da pesquisa.
    if (clickToPickCoords || desenhandoRaioDeBusca) {
      L.DomUtil.addClass(map.getContainer(), 'pointer-cursor');
      map.getContainer().style.cursor = 'crosshair';
    } else {
      L.DomUtil.removeClass(map.getContainer(), 'pointer-cursor');
      map.getContainer().style.cursor = '';
    }
  }, [clickToPickCoords, desenhandoRaioDeBusca]);

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
      if (a.candidateId === selectedCandidateId) {
        candPoints.push(L.latLng(a.center.lat, a.center.lng));
      }
    });

    pins.forEach(p => {
      if (p.candidateId === selectedCandidateId) {
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
    if (selectedArea) {
      map.setView([selectedArea.center.lat, selectedArea.center.lng], 14, { animate: true });
      return;
    }

    // Search in pins
    const selectedPin = pins.find(p => p.id === selectedId);
    if (selectedPin) {
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

  /* --------------------------------------------------------- missões ---
   * A missão é a mesma coisa vista de três lugares: o pino no mapa, o balão
   * do cursor e a ficha do clique. Estes ajudantes existem para os três
   * lerem os mesmos dados — se o nome de quem recebe muda num, muda nos
   * três.
   */
  const nomeDoIntegrante = (m: any) =>
    m?.full_name || m?.nome_completo || m?.nome || m?.name || 'Integrante';
  const fotoDoIntegrante = (m: any) => m?.image || m?.foto_url || m?.photo || '';

  /** Quem recebeu a missão, já com a ficha de cada um. */
  const equipeDaMissao = (ids?: string[]) => {
    if (!ids || ids.length === 0) return [];
    return (equipe || []).filter((m: any) => ids.includes(m.id));
  };

  /** Data no formato de quem lê, não no do banco. */
  const dataCurta = (iso?: string) => {
    if (!iso) return '';
    const [ano, mes, dia] = iso.split('T')[0].split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
  };

  /** Faltam poucos dias para o prazo? É o que muda a ordem do dia. */
  const prazoApertado = (data?: string) => {
    if (!data) return false;
    const alvo = new Date(`${data}T23:59:59`).getTime();
    if (Number.isNaN(alvo)) return false;
    const dias = (alvo - Date.now()) / 86400000;
    return dias >= -1 && dias <= 3;
  };

  /**
   * A missão aberta na ficha, lida sempre da lista de agora.
   *
   * Se ela for editada com a ficha aberta, a ficha acompanha; se for
   * excluída, some sozinha em vez de mostrar um fantasma.
   */
  const missaoAberta = React.useMemo(() => {
    if (!missaoAbertaRef) return null;
    if (missaoAbertaRef.tipo === 'pin') {
      const pin = pins.find(p => p.id === missaoAbertaRef.id);
      if (!pin) return null;
      const tipo = operationTypes.find(t => t.id === pin.iconType);
      const ids = pin.assignedDeltas || pin.position?.assignedDeltas || [];
      return {
        tipo: 'pin' as const,
        id: pin.id,
        cor: pin.color,
        etiqueta: tipo?.label || 'Ponto estratégico',
        iconeChave: tipo?.icon || pin.iconType,
        titulo: pin.title,
        descricao: pin.description,
        prazo: pin.date,
        criadaEm: pin.createdAt,
        coords: { lat: pin.position.lat, lng: pin.position.lng },
        semLocal: !!pin.position?.semLocal,
        turno: pin.position?.turno as TurnoId | undefined,
        prioridade: pin.position?.priority,
        material: (pin.position?.material || []) as MaterialDeApoio[],
        narrativas: (pin.position?.narrativas || []) as MaterialDeApoio[],
        organicas: (pin.position?.narrativasOrganicas || []) as MaterialDeApoio[],
        links: (pin.position?.acoesLinks || []) as LinkDeAcao[],
        pessoas: equipeDaMissao(ids),
        totalDesignados: ids.length,
        raio: null as number | null,
        bairro: '',
        responsavel: '',
        voluntarios: 0
      };
    }
    const area = areas.find(a => a.id === missaoAbertaRef.id);
    if (!area) return null;
    const ids = area.assignedDeltas || area.center?.assignedDeltas || [];
    return {
      tipo: 'area' as const,
      id: area.id,
      cor: area.color,
      etiqueta: 'Área de trabalho',
      iconeChave: '',
      titulo: area.title,
      descricao: area.description,
      prazo: undefined as string | undefined,
      criadaEm: area.createdAt,
      coords: { lat: area.center.lat, lng: area.center.lng },
      semLocal: false,
      turno: area.center?.turno as TurnoId | undefined,
      prioridade: area.center?.priority,
      material: (area.center?.material || []) as MaterialDeApoio[],
      narrativas: (area.center?.narrativas || []) as MaterialDeApoio[],
      organicas: (area.center?.narrativasOrganicas || []) as MaterialDeApoio[],
      links: (area.center?.acoesLinks || []) as LinkDeAcao[],
      pessoas: equipeDaMissao(ids),
      totalDesignados: ids.length,
      raio: area.radius,
      bairro: area.bairro || '',
      responsavel: area.contactName || '',
      voluntarios: area.teamSize || 0
    };
  }, [missaoAbertaRef, pins, areas, operationTypes, equipe]);

  /**
   * Manda o NEO ler a missão e escrever o relatório.
   *
   * O prompt vem do banco, do que o administrador editou em Configurações; o
   * texto de fábrica entra só quando ainda não há nada gravado. Ler na hora do
   * pedido, e não ao montar a tela, é de propósito: prompt ajustado agora vale
   * no próximo relatório, sem ninguém precisar recarregar a página.
   *
   * O dossiê é montado a partir do que já está em tela -- a missão e os
   * check-ins vinculados a ela --, então o documento fala exatamente da missão
   * que a pessoa está olhando.
   */
  const pedirRelatorioDoNeo = async (missao: any, forcarNovo = false) => {
    const titulo = missao?.titulo || 'Missão sem título';
    setMissaoDoRelatorio({ dados: missao, titulo });
    setRelatorio(null);
    setRelatorioGuardado(false);
    setPecasDoRelatorio([]);
    setRelatorioErro(null);
    setRelatorioAberto(true);
    setRelatorioCarregando(true);

    /*
     * O relatório guardado abre na hora, sem gerar de novo.
     *
     * Gerar custa uma chamada com imagens e até um minuto de espera, e duas
     * leituras da mesma missão saem diferentes -- quem mostrasse o documento
     * numa reunião veria um texto que não é o que leu antes. Quem quiser uma
     * leitura nova pede por "Gerar de novo", que é uma decisão, não um efeito
     * colateral de reabrir a missão.
     */
    if (!forcarNovo) {
      const guardado = await DatabaseService.lerRelatorioNeo(missao.id);
      if (guardado.relatorio) {
        setRelatorio(guardado.relatorio);
        setPecasDoRelatorio(guardado.pecas as PecaDoDossie[]);
        setRelatorioGuardado(true);
        setRelatorioCarregando(false);
        return;
      }
    }

    const guardado = await DatabaseService.lerConfiguracao(CHAVE_PROMPT_NEO);
    const prompt = (guardado?.value || '').trim() || PROMPT_NEO_PADRAO;

    const vinculados = (checkIns || []).filter(
      (c: any) => c.missionId && c.missionId === missao.id
    );

    /*
     * As observações e os áudios não vêm na lista.
     *
     * `check_ins` guarda o registro; o que a pessoa escreveu e gravou mora em
     * `check_in_notes`, e as mídias em `check_in_media` -- a lista do mapa lê
     * só a primeira tabela, porque desenhar pinos não precisa do resto. Sem
     * buscar aqui, o NEO analisaria as fotos e não saberia que existe um áudio
     * do morador dizendo o que aconteceu: é a metade mais importante do
     * feedback.
     *
     * Em paralelo, e sem derrubar o relatório se uma falhar: check-in cujo
     * detalhe não veio entra com o que a lista já tinha.
     */
    const retornos = await Promise.all(
      vinculados.map(async (c: any) => {
        try {
          const detalhe = await DatabaseService.lerDetalhesCheckIn(c.id);
          const midias =
            detalhe.midias.length > 0
              ? detalhe.midias.map((m: any) => ({
                  url: m.url,
                  type: m.kind === 'video' ? 'video' : 'image'
                }))
              : c.media;
          return {
            ...c,
            media: midias,
            notes: detalhe.notas.length > 0 ? detalhe.notas : c.notes,
            operations: detalhe.operacoes.length > 0 ? detalhe.operacoes : c.operations
          };
        } catch {
          return c;
        }
      })
    );

    /*
     * O contexto que o card conhece e o registro cru não diz.
     *
     * Prioridade e turno são guardados por id -- "p2", "tarde" -- e o endereço
     * só existe depois da busca pela coordenada. Sem resolver isso aqui, o NEO
     * receberia códigos no lugar de "Grave — risco à vida" e "Avenida Um,
     * Apoena", e a análise da urgência sairia sem a informação que a define.
     */
    const nivel = (priorityLevels || []).find((n) => n.id === missao?.prioridade);
    const janela = (janelasDeTurno || []).find((j) => j.id === missao?.turno);
    const tipo = (operationTypes || []).find(
      (t) => t.id === missao?.iconeChave || t.label === missao?.etiqueta
    );

    const resposta = await gerarRelatorioDaMissao(missao, retornos, prompt, {
      endereco: enderecoDaMissao,
      prioridade: nivel ? { label: nivel.label, description: nivel.description } : null,
      turno: janela
        ? { rotulo: NOME_DO_TURNO[janela.id], inicio: janela.inicio, fim: janela.fim }
        : null,
      tipoDeOperacao: tipo ? { label: tipo.label, description: tipo.description } : null,
      cliente: candidates?.find((c) => c.id === selectedCandidateId)?.name || null
    });
    setRelatorioCarregando(false);

    if (!resposta.ok || !resposta.relatorio) {
      setRelatorioErro(resposta.erro || 'O NEO não conseguiu montar este relatório.');
      return;
    }
    setRelatorio(resposta.relatorio);
    setPecasDoRelatorio(resposta.pecas || []);
  };

  /*
   * Abriu outra missão: a lista de narrativas é a dela.
   *
   * Sem isto, fechar uma missão e abrir a vizinha mostraria os arquivos da
   * primeira — e o próximo envio os gravaria na segunda.
   */
  useEffect(() => {
    const missao =
      missaoAbertaRef?.tipo === 'pin'
        ? pins.find((p) => p.id === missaoAbertaRef.id)?.position
        : areas.find((a) => a.id === missaoAbertaRef?.id)?.center;
    const paraTela = (lista: MaterialDeApoio[]) =>
      lista.map((item) => ({
        ...item,
        estado: 'pronto' as const,
        progresso: 100,
        jaSalvo: true
      }));
    setLinkNovo('');
    setTituloDoLinkNovo('');
    setNarrativasNaTela(paraTela(((missao as any)?.narrativas || []) as MaterialDeApoio[]));
    setOrganicasNaTela(
      paraTela(((missao as any)?.narrativasOrganicas || []) as MaterialDeApoio[])
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missaoAbertaRef?.id, missaoAbertaRef?.tipo]);

  /*
   * Ao abrir uma missão, pergunta ao banco se ela já tem relatório.
   *
   * Pelo id da missão, e não pelo objeto: a ficha é remontada a cada edição,
   * e perguntar de novo a cada remontagem seria uma ida ao banco por tecla
   * digitada no formulário ao lado.
   */
  useEffect(() => {
    const id = missaoAbertaRef?.id;
    if (!id) {
      setMissaoTemRelatorio(false);
      return;
    }
    let vivo = true;
    (async () => {
      const guardado = await DatabaseService.lerRelatorioNeo(id);
      if (vivo) setMissaoTemRelatorio(!!guardado.relatorio);
    })();
    return () => {
      vivo = false;
    };
  }, [missaoAbertaRef?.id]);

  /** Guarda o relatório que está na tela, para a missão dele. */
  const guardarRelatorioDoNeo = async () => {
    if (!relatorio || !missaoDoRelatorio?.dados?.id || salvandoRelatorio) return;
    setSalvandoRelatorio(true);
    const res = await DatabaseService.salvarRelatorioNeo({
      missaoId: missaoDoRelatorio.dados.id,
      titulo: relatorio.titulo,
      relatorio,
      pecas: pecasDoRelatorio
    });
    setSalvandoRelatorio(false);
    if (res.success) {
      setRelatorioGuardado(true);
      // O rodapé da missão aberta passa a dizer "Ver Relatório" na hora, sem
      // esperar que alguém feche e abra a ficha de novo.
      if (missaoAbertaRef?.id === missaoDoRelatorio.dados.id) {
        setMissaoTemRelatorio(true);
      }
      notificar?.('Relatório guardado.', 'success');
      return;
    }
    notificar?.(
      'Não foi possível guardar. Rode db/migrations/2026-09-21-relatorios-neo.sql no banco.',
      'error'
    );
  };

  /** Endereço da missão aberta, descoberto pela coordenada. */
  const [enderecoDaMissao, setEnderecoDaMissao] = useState<string | null>(null);
  const [buscandoEnderecoDaMissao, setBuscandoEnderecoDaMissao] = useState(false);

  useEffect(() => {
    if (!missaoAberta) {
      setEnderecoDaMissao(null);
      setBuscandoEnderecoDaMissao(false);
      setMaterialAberto(null);
      return;
    }
    const { lat, lng } = missaoAberta.coords;
    let vivo = true;
    setEnderecoDaMissao(null);
    setBuscandoEnderecoDaMissao(true);
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR`
    )
      .then(res => res.json())
      .then(dados => {
        if (!vivo) return;
        setEnderecoDaMissao(dados?.display_name || null);
      })
      .catch(() => {
        // Sem rede o endereço simplesmente não aparece; a coordenada e o
        // botão do Google Maps continuam servindo.
        if (vivo) setEnderecoDaMissao(null);
      })
      .finally(() => {
        if (vivo) setBuscandoEnderecoDaMissao(false);
      });
    return () => {
      vivo = false;
    };
  }, [missaoAbertaRef?.id, missaoAberta?.coords.lat, missaoAberta?.coords.lng]);

  // Render Areas (Circles)
  useEffect(() => {
    const circlesGroup = circlesGroupRef.current;
    const map = mapRef.current;
    if (!circlesGroup || !map) return;

    circlesGroup.clearLayers();

    if (
      mapFilter === 'checkins' ||
      mapFilter === 'favoritos' ||
      mapFilter === 'superfavoritos' ||
      mapFilter === 'nada' ||
      // Filtrar por categoria é pedir só os check-ins daquelas gavetas.
      filtroDeCategorias.length > 0
    ) {
      // Camada desligada: quando voltar, as áreas se abrem de novo.
      idsDeAreaNoMapaRef.current = new Set();
      chegadaDasAreasRef.current.clear();
      return;
    }

    const areasAntes = idsDeAreaNoMapaRef.current;
    const areasAgora = new Set<string>();
    const atrasoDaArea = ondaDeChegada(areas.map(a => a.center), 700);

    areas.forEach(area => {
      // Em edição: quem aparece no lugar dela é o fantasma arrastável.
      if (itemEmEdicaoId && area.id === itemEmEdicaoId) return;

      const isSelected = area.id === selectedId || missaoAbertaRef?.id === area.id;
      areasAgora.add(area.id);
      const chegada = tempoDeChegada(
        chegadaDasAreasRef.current,
        area.id,
        !areasAntes.has(area.id),
        () => atrasoDaArea(area.center)
      );
      const nasce = chegada !== null;
      const atraso = chegada ?? 0;

      /*
       * A área se abre do centro quando chega, e a aberta na ficha ganha a
       * borda andando — o tracejado corre em volta, como uma cerca viva que
       * diz "é esta" sem cobrir o que está dentro.
       */
      const circle = L.circle([area.center.lat, area.center.lng], {
        radius: area.radius,
        color: area.color,
        weight: isSelected ? 4 : 2,
        opacity: 0.85,
        fillColor: area.color,
        fillOpacity: isSelected ? 0.35 : 0.20,
        dashArray: isSelected ? '12 9' : undefined,
        className: `area-missao${nasce ? ' area-missao--nasce' : ''}${isSelected ? ' area-missao--ativa' : ''}`
      });

      const abrirFicha = (e: any) => {
        L.DomEvent.stopPropagation(e);
        setMissaoAbertaRef({ id: area.id, tipo: 'area' });
      };
      circle.on('click', abrirFicha);

      // O núcleo: marca o centro, pega o clique e pulsa na cor da área.
      const nucleo = isSelected ? 18 : 12;
      const centerMarker = L.marker([area.center.lat, area.center.lng], {
        keyboard: false,
        icon: L.divIcon({
          className: '',
          html:
            `<span class="area-nucleo${isSelected ? ' area-nucleo--ativo' : ''}${nasce ? ' area-nucleo--nasce' : ''}" ` +
            `style="--cor:${area.color};--tamanho:${nucleo}px;--atraso:${atraso}ms">` +
            '<span class="area-nucleo__pulso"></span><span class="area-nucleo__ponto"></span></span>',
          iconSize: [nucleo, nucleo],
          iconAnchor: [nucleo / 2, nucleo / 2]
        })
      });

      centerMarker.on('click', abrirFicha);

      // O mesmo cartão do pino: área também é missão, e quem passa o cursor
      // por cima faz a mesma pergunta — o que é isto e para quem.
      const designadosDaArea = area.assignedDeltas || area.center?.assignedDeltas || [];
      const materialDaArea = area.center?.material || [];
      const balaoDaArea = montarBalaoDaMissao({
        cor: area.color,
        etiqueta: 'Área de trabalho',
        titulo: area.title,
        descricao: area.description,
        linhas: [
          area.bairro ? `🏘️ ${area.bairro}` : '',
          `⭕ Raio de ${area.radius >= 1000 ? `${(area.radius / 1000).toFixed(area.radius % 1000 === 0 ? 0 : 1)} km` : `${area.radius} m`}`,
          area.teamSize ? `👥 ${area.teamSize} voluntário${area.teamSize > 1 ? 's' : ''} previstos` : '',
          area.contactName ? `🎖️ ${area.contactName}` : ''
        ],
        pessoas: equipeDaMissao(designadosDaArea).map(nomeDoIntegrante),
        anexos: materialDaArea.length,
        capa: materialDaArea.find(m => m.tipo === 'imagem')?.url
      });

      circle.bindTooltip(balaoDaArea, {
        permanent: false,
        direction: 'top',
        className: 'balao-missao',
        opacity: 1
      });
      centerMarker.bindTooltip(balaoDaArea, {
        permanent: false,
        direction: 'top',
        className: 'balao-missao',
        opacity: 1
      });

      // Add to group
      circlesGroup.addLayer(circle);
      circlesGroup.addLayer(centerMarker);
      if (nasce) (circle.getElement() as SVGElement | undefined)?.style.setProperty('--atraso', `${atraso}ms`);
    });
    idsDeAreaNoMapaRef.current = areasAgora;
  }, [areas, selectedId, mapFilter, itemEmEdicaoId, equipe, missaoAbertaRef, filtroDeCategorias.length > 0]);

  // Render Pins
  useEffect(() => {
    const pinsGroup = pinsGroupRef.current;
    const map = mapRef.current;
    if (!pinsGroup || !map) return;

    pinsGroup.clearLayers();

    if (
      mapFilter === 'checkins' ||
      mapFilter === 'favoritos' ||
      mapFilter === 'superfavoritos' ||
      mapFilter === 'nada' ||
      // Filtrar por categoria é pedir só os check-ins daquelas gavetas.
      filtroDeCategorias.length > 0
    ) {
      // Camada desligada: quando voltar, as missões caem de novo.
      idsDeMissaoNoMapaRef.current = new Set();
      chegadaDasMissoesRef.current.clear();
      missaoAcesaRef.current = null;
      return;
    }

    /*
     * Só quem chegou agora cai; o resto do mapa fica quieto. E a missão que
     * acabou de ser aberta acende — o pino é redesenhado ao abrir a ficha, e
     * o estouro dele é a resposta ao toque.
     */
    const antes = idsDeMissaoNoMapaRef.current;
    const agora = new Set<string>();
    const atrasoDaMissao = ondaDeChegada(pins.map(p => p.position), 900);
    const aberta = missaoAbertaRef?.id || selectedId || null;
    const acesaAntes = missaoAcesaRef.current;
    missaoAcesaRef.current = aberta;

    pins.forEach(pin => {
      // Em edição: quem aparece no lugar dele é o fantasma arrastável.
      if (itemEmEdicaoId && pin.id === itemEmEdicaoId) return;

      const isSelected = pin.id === selectedId || missaoAbertaRef?.id === pin.id;
      // pin.iconType guarda o id do Tipo de Operação; o desenho vem do tipo.
      // Se o tipo foi apagado, o próprio id ainda serve de chave de ícone
      // (é o caso dos pontos antigos, cujo id já era 'flag', 'star'...).
      const operationType = operationTypes.find(t => t.id === pin.iconType);
      const designados = pin.assignedDeltas || pin.position?.assignedDeltas || [];
      const material = pin.position?.material || [];

      agora.add(pin.id);
      const customIcon = construirPinoDeMissao({
        cor: pin.color,
        iconeChave: operationType?.icon || pin.iconType,
        destacado: isSelected,
        pessoas: designados.length,
        temMaterial: material.length > 0,
        prazoVencendo: prazoApertado(pin.date),
        surge: tempoDeChegada(
          chegadaDasMissoesRef.current,
          pin.id,
          !antes.has(pin.id),
          () => atrasoDaMissao(pin.position)
        ),
        acende: isSelected && acesaAntes !== pin.id && antes.has(pin.id)
      });

      const marker = L.marker([pin.position.lat, pin.position.lng], {
        icon: customIcon,
        riseOnHover: true,
        zIndexOffset: isSelected ? 1000 : 400
      });

      // O clique abre a ficha, como no check-in. Editar é um botão dentro
      // dela: quem clica no mapa quase sempre quer ler, não mexer.
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setMissaoAbertaRef({ id: pin.id, tipo: 'pin' });
      });

      const pessoas = equipeDaMissao(designados).map(nomeDoIntegrante);
      const capa = material.find(m => m.tipo === 'imagem')?.url;

      marker.bindTooltip(
        montarBalaoDaMissao({
          cor: pin.color,
          etiqueta: operationType?.label || 'Ponto estratégico',
          titulo: pin.title,
          descricao: pin.description,
          // Coordenada não diz nada a quem olha o mapa: o lugar já está
          // debaixo do pino. O que falta saber é quando e para quem.
          linhas: [pin.date ? `🗓️ Prazo ${dataCurta(pin.date)}` : ''],
          pessoas,
          anexos: material.length,
          capa
        }),
        {
          permanent: false,
          direction: 'top',
          // A âncora do pino é a ponta, lá embaixo; sem descontar a altura
          // da gota o balão abria em cima do próprio pino.
          offset: [0, isSelected ? -70 : -60],
          className: 'balao-missao',
          opacity: 1
        }
      );

      pinsGroup.addLayer(marker);
    });
    idsDeMissaoNoMapaRef.current = agora;
  }, [pins, selectedId, mapFilter, operationTypes, itemEmEdicaoId, equipe, missaoAbertaRef, filtroDeCategorias.length > 0]);

  // Render Check-ins
  useEffect(() => {
    const checkInsGroup = checkInsGroupRef.current;
    const map = mapRef.current;
    if (!checkInsGroup || !map) return;

    checkInsGroup.clearLayers();

    if (mapFilter === 'markers' || mapFilter === 'nada') {
      // Camada desligada: quando voltar, todos surgem de novo.
      idsDeCheckInNoMapaRef.current = new Set();
      chegadaDosCheckInsRef.current.clear();
      return;
    }

    if (!checkIns) return;

    const doModo =
      mapFilter === 'superfavoritos'
        ? checkIns.filter(c => c.superFavorite)
        : mapFilter === 'favoritos'
          ? checkIns.filter(c => c.favorite)
          : checkIns;
    // O filtro de categorias corta por cima do modo: qualquer uma das escolhidas.
    const visiveis =
      filtroDeCategorias.length > 0
        ? doModo.filter(c => (c.favoriteCategories || []).some(id => filtroDeCategorias.includes(id)))
        : doModo;
    const corDaCategoria = new Map(categoriasDeFavorito.map(c => [c.id, c]));

    /*
     * QUEM ACABOU DE APARECER, SURGE.
     *
     * Só o marcador que não estava no mapa no desenho anterior entra com a
     * animação — em cascata, um atrás do outro. Trocar o filtro ou o período
     * faz os novos brotarem; um check-in que chega da rua surge sozinho; e o
     * resto do mapa não pisca a cada atualização.
     */
    const anteriores = idsDeCheckInNoMapaRef.current;
    const agora = new Set<string>();
    // A onda se mede só entre os que chegam: um check-in que vem sozinho da
    // rua brota na hora, sem esperar a vez numa onda que não existe.
    const atrasoDoCheckIn = ondaDeChegada(
      visiveis.filter(c => !anteriores.has(c.id)).map(c => c.coordinates),
      800
    );

    visiveis.forEach(checkIn => {
      agora.add(checkIn.id);
      const chegada = tempoDeChegada(
        chegadaDosCheckInsRef.current,
        checkIn.id,
        !anteriores.has(checkIn.id),
        () => atrasoDoCheckIn(checkIn.coordinates),
        1400
      );
      const surge = chegada !== null;
      const atraso = chegada ?? 0;
      /*
       * AO VIVO: o que a equipe registrou na última hora.
       *
       * Um radar sai do marcador e uma pastilha "agora" fica embaixo dele —
       * o mapa passa a dizer onde a equipe ESTÁ, e não só onde já esteve.
       * Rascunho não entra: ao vivo é trabalho confirmado.
       */
      const idade = Date.now() - new Date(checkIn.createdAt).getTime();
      const aoVivo = checkIn.status !== 'rascunho' && idade >= 0 && idade < 60 * 60 * 1000;
      const brilha = mapFilter === 'favoritos' && checkIn.favorite && !checkIn.superFavorite;
      /*
       * A coroa se acha sozinha.
       *
       * O super favorito não espera filtro para aparecer: em qualquer vista
       * ele leva a coroa, o aro dourado e fica por cima dos vizinhos — é
       * isso que faz dele o check-in que se encontra de relance. Com o
       * filtro da coroa ligado, a aura gira mais forte.
       */
      const coroado = !!checkIn.superFavorite;
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
          border: 3px solid ${coroado ? '#FDE68A' : 'white'};
          box-shadow: ${coroado ? `0 0 0 2px #D97706, 0 6px 16px rgba(217,119,6,.55)` : `0 4px 10px ${markerColor}66`};
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
      const estrelaHtml = coroado
        ? `<span class="ck-coroa" style="position:absolute;top:-9px;left:50%;width:24px;height:18px;margin-left:-12px;
             border-radius:9px;background:linear-gradient(135deg,#FDE68A,#F59E0B 55%,#B45309);border:2px solid #fff;
             box-shadow:0 2px 6px rgba(180,83,9,.55);display:flex;align-items:center;justify-content:center;">
             <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 8.5l4.5 3.5L12 4l5 8 4.5-3.5-2 10.5h-15z"/></svg>
           </span>`
        : checkIn.favorite
        ? `<span style="position:absolute;top:-2px;right:-2px;width:18px;height:18px;border-radius:50%;
             background:#F59E0B;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);
             display:flex;align-items:center;justify-content:center;">
             <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
           </span>`
        : '';

      /*
       * O ANEL DAS CATEGORIAS: uma fatia de cor por gaveta em que o check-in
       * está. Com o filtro de categoria ligado, o anel gira e brilha.
       */
      const categoriasDele = (checkIn.favoriteCategories || [])
        .map(id => corDaCategoria.get(id))
        .filter(Boolean) as CategoriaDeFavorito[];
      const anelHtml = categoriasDele.length
        ? `<span class="ck-categorias${filtroDeCategorias.length ? ' ck-categorias--forte' : ''}" ` +
          `style="--anel:${anelDeCategorias(categoriasDele.map(c => c.cor))}"></span>`
        : '';

      const checkInIcon = L.divIcon({
        className: `custom-div-icon drop-shadow-md ck-marcador${surge ? ' ck-marcador-entra' : ''}${brilha ? ' ck-fav-brilho' : ''}${
          aoVivo ? ' ck-ao-vivo' : ''
        }${
          coroado ? ` ck-super${mapFilter === 'superfavoritos' ? ' ck-super-forte' : ''}` : ''
        }`,
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; --atraso: ${atraso}ms; --cor-ck: ${markerColor};">
            ${avatarHtml}
            ${estrelaHtml}
            ${anelHtml}
            ${aoVivo ? '<span class="ck-radar"></span><span class="ck-radar ck-radar--2"></span><span class="ck-agora">agora</span>' : ''}
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([checkIn.coordinates.lat, checkIn.coordinates.lng], {
        icon: checkInIcon,
        // O coroado nunca fica embaixo de um vizinho.
        zIndexOffset: coroado ? 800 : checkIn.favorite ? 300 : 0
      });

      const dateText = new Date(checkIn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date(checkIn.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' });

      const media = checkIn.media && checkIn.media.length > 0
        ? checkIn.media
        : checkIn.photo
          ? [{ url: checkIn.photo, type: 'image' as const }]
          : [];
      const coverImage = media.find(m => m.type === 'image');
      const videoCount = media.filter(m => m.type === 'video').length;

      const countHtml = media.length > 1
        ? `<p class="text-[9.5px] text-slate-500 font-bold mt-1.5">📎 ${media.length} arquivos${videoCount > 0 ? ` • ${videoCount} vídeo${videoCount > 1 ? 's' : ''}` : ''}</p>`
        : videoCount > 0
          ? `<p class="text-[9.5px] text-slate-500 font-bold mt-1.5">🎬 Vídeo anexado</p>`
          : '';

      const photoHtml = coverImage ? `
        <div class="mt-2 rounded-lg overflow-hidden border border-slate-100 max-h-[100px]">
          <img src="${escaparHtml(coverImage.url)}" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
        </div>
      ` : '';

      // O mesmo cartão da missão: no mapa as duas coisas se clicam igual, e
      // o que o cursor mostra também tem de ser igual.
      const etiqueta = `${aoVivo ? '🔴 Ao vivo • ' : ''}${coroado ? '👑 Super Favorito • ' : ''}${
        isFree
          ? `⚠️ Check-in livre${priority ? ` • Prioridade ${priority.label}` : ''}`
          : '✅ Check-in de voluntário'
      }`;

      marker.bindTooltip(`
        <div class="font-sans min-w-[190px] max-w-[250px]">
          <div class="balao-missao__faixa" style="height:4px;background:${markerColor}"></div>
          <div class="px-3 py-2.5">
            <p class="font-black uppercase tracking-wider text-[9px] leading-none" style="color:${markerColor}">${etiqueta}</p>
            <p class="font-bold text-slate-900 text-[13px] leading-tight mt-1">${escaparHtml(checkIn.name)}</p>
            <div class="mt-1.5 space-y-0.5">
              <p class="text-[10.5px] text-slate-500 font-semibold leading-snug">📍 ${escaparHtml([checkIn.rua, checkIn.bairro].filter(Boolean).join(', ') || 'Sem endereço')}</p>
              <p class="text-[10.5px] text-slate-500 font-semibold leading-snug">🕒 ${dateText}</p>
              ${categoriasDele.length ? `<p class="text-[10.5px] font-bold leading-snug mt-1 flex flex-wrap gap-1">${categoriasDele
                .map(c => `<span style="color:${c.cor}">${escaparHtml(`${c.emoji || '●'} ${c.nome}`)}</span>`)
                .join('<span class="text-slate-300">·</span>')}</p>` : ''}
            </div>
            ${countHtml}
            <p class="text-[8.5px] text-slate-400 font-black uppercase tracking-wider mt-2">💡 Clique para abrir a ficha</p>
            ${photoHtml}
          </div>
        </div>
      `, {
        permanent: false,
        direction: 'top',
        offset: [0, -26],
        className: 'balao-missao',
        opacity: 1
      });

      // Evento de clique para mostrar todas as informações no meio da tela
      marker.on('click', () => {
        estourarNoToque(marker);
        setSelectedCheckInForModal(checkIn);
      });

      checkInsGroup.addLayer(marker);
    });
    idsDeCheckInNoMapaRef.current = agora;
  }, [checkIns, mapFilter, relogioDoMapa, categoriasDeFavorito, filtroDeCategorias]);

  /**
   * Achar um check-in pedido de fora (a lista dos Super Favoritos).
   *
   * O mapa voa até ele, um anel dourado marca o chão por um instante — o
   * olho precisa de um alvo depois do voo — e a ficha abre quando o voo
   * pousa, e não antes, para a ficha não cobrir o caminho.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !checkInParaAbrir) return;
    const alvo = (checkIns || []).find(c => c.id === checkInParaAbrir.id);
    if (!alvo?.coordinates) return;
    const ponto = L.latLng(alvo.coordinates.lat, alvo.coordinates.lng);

    let aberto = false;
    const abrir = () => {
      if (aberto) return;
      aberto = true;
      const anel = L.marker(ponto, {
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: 'ck-achado',
          html: '<span></span><span></span>',
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        })
      }).addTo(map);
      window.setTimeout(() => map.removeLayer(anel), 2400);
      setMissaoAbertaRef(null);
      setVoltaParaMissao(null);
      setSelectedCheckInForModal(alvo);
    };

    map.once('moveend', abrir);
    // Já estava lá: não há voo, então não haverá moveend.
    const reserva = window.setTimeout(abrir, 1400);
    map.flyTo(ponto, Math.max(map.getZoom(), 17), { duration: 0.9 });
    return () => {
      map.off('moveend', abrir);
      window.clearTimeout(reserva);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInParaAbrir?.n]);

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
      const sobOCursor = estabelecimentoDestacado === lugar.id;
      const tamanho = emFoco ? 48 : sobOCursor ? 42 : 36;
      const inicial = (lugar.nome || '?').trim().charAt(0).toUpperCase();

      /**
       * Pino com a cara do lugar.
       *
       * Vinte pinos iguais obrigam a clicar em cada um para saber o que são.
       * Com a foto dentro da gota, a padaria parece padaria e o posto parece
       * posto — quem olha o mapa escolhe antes de clicar. Sem foto, fica a
       * inicial do nome, que ao menos distingue um do outro; um ícone
       * genérico repetido vinte vezes não distingue nada.
       *
       * A nota vai num selo no canto, porque entre três farmácias na mesma
       * rua é ela que decide qual visitar primeiro.
       */
      const miolo = lugar.imagem
        ? `<img src="${lugar.imagem}" alt="" referrerpolicy="no-referrer"
             style="width:100%;height:100%;object-fit:cover;display:block" />`
        : `<span style="display:flex;align-items:center;justify-content:center;
             width:100%;height:100%;color:#5B21B6;font-weight:900;
             font-size:${Math.round(tamanho * 0.42)}px;font-family:sans-serif">${inicial}</span>`;

      const selo =
        lugar.avaliacao !== null && lugar.avaliacao !== undefined
          ? `<span style="position:absolute;top:${tamanho - 14}px;left:${tamanho - 12}px;
               display:flex;align-items:center;gap:1px;padding:1px 4px;border-radius:9px;
               background:#fff;border:1px solid #E9D5FF;box-shadow:0 1px 3px rgba(0,0,0,.25);
               font-family:sans-serif;font-size:9px;font-weight:900;color:#B45309;z-index:2">
               <svg viewBox="0 0 24 24" width="7" height="7" fill="#F59E0B"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
               ${Number(lugar.avaliacao).toFixed(1)}</span>`
          : '';

      const marcador = L.marker([lugar.latitude, lugar.longitude], {
        icon: L.divIcon({
          className: `custom-div-icon ${emFoco ? 'drop-shadow-lg' : 'drop-shadow-md'}`,
          html: `
            <div style="position:relative;width:${tamanho}px;height:${tamanho + 10}px">
              <div style="display:flex;align-items:center;justify-content:center;
                width:${tamanho}px;height:${tamanho}px;background:#fff;
                border-radius:50% 50% 50% 0;transform:rotate(-45deg);
                border:${emFoco ? 4 : 3}px solid #7C3AED;overflow:hidden;
                ${emFoco ? 'box-shadow:0 0 0 6px rgba(124,58,237,.18);' : ''}">
                <div style="transform:rotate(45deg);width:${tamanho - 8}px;height:${tamanho - 8}px;
                  border-radius:50%;overflow:hidden;background:#F5F3FF;flex:none">
                  ${miolo}
                </div>
              </div>
              <div style="width:10px;height:10px;background:#7C3AED;border-radius:50%;
                position:absolute;top:${tamanho - 5}px;left:${tamanho / 2 - 5}px;
                box-shadow:0 2px 4px rgba(0,0,0,.2);border:1px solid #fff"></div>
              ${selo}
            </div>
          `,
          iconSize: [tamanho, tamanho + 10],
          iconAnchor: [tamanho / 2, tamanho + 8]
        }),
        zIndexOffset: emFoco ? 1000 : sobOCursor ? 500 : 0
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

      /**
       * Foto que não carrega não pode deixar um buraco no pino.
       *
       * As miniaturas vêm de um provedor externo e falham por bloqueio, por
       * link vencido ou por rede ruim. Quando isso acontece, o pino cai para
       * a inicial — o ouvinte é registrado aqui, e não num `onerror` dentro
       * do HTML, porque atributo de evento embutido é a primeira coisa que
       * uma política de segurança de conteúdo bloqueia.
       */
      const imagem = marcador.getElement()?.querySelector('img');
      if (imagem) {
        imagem.addEventListener('error', () => {
          const caixa = imagem.parentElement;
          if (!caixa) return;
          caixa.innerHTML =
            `<span style="display:flex;align-items:center;justify-content:center;` +
            `width:100%;height:100%;color:#5B21B6;font-weight:900;` +
            `font-size:${Math.round(tamanho * 0.42)}px;font-family:sans-serif">${inicial}</span>`;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estabelecimentos, estabelecimentoEmFoco, estabelecimentoDestacado]);

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

  /**
   * Bairros e setores desenhados por cima do mapa.
   *
   * O painel dá os números; esta camada dá o território — e é vendo a mancha
   * que se descobre o que uma lista ordenada esconde: que os três bairros mais
   * populosos são vizinhos, ou que a equipe nunca pisou na metade norte.
   *
   * Três cuidados guiam o desenho:
   *
   * 1. **Sem dado não é zero.** Recorte com população `null` sai hachurado em
   *    cinza, nunca no tom mais claro da escala — pintá-lo como "pouca gente"
   *    seria inventar uma medida que o instituto não publicou.
   * 2. **O preenchimento é transparente.** A mancha informa, mas o mapa e os
   *    pinos de operação continuam legíveis por baixo: esta camada é contexto,
   *    não substituição.
   * 3. **Um clique é uma escolha.** Clicar num setor o fixa na ficha do canto
   *    e o marca no mapa; clicar de novo no mesmo o solta. Passar o mouse
   *    por cima dos outros não tira a ficha dele: quem fixou está lendo.
   */
  useEffect(() => {
    const grupo = recortesGroupRef.current;
    const map = mapRef.current;
    if (!grupo || !map) return;

    grupo.clearLayers();
    recortesPorIdRef.current = {};

    const recortes = recortesTerritoriais || [];
    if (recortes.length === 0) {
      ultimoRecorteRef.current = '';
      return;
    }

    const escala = escalaTerritorial || [];
    /*
     * A régua da transparência.
     *
     * O mapa embaixo é o trabalho: ruas, pontos, missões. A mancha do Censo é
     * contexto, e contexto que tapa o trabalho vira estorvo — daí ela nascer
     * translúcida e o controle da força ficar na mão de quem olha.
     */
    const forca = Math.max(0, Math.min(1, opacidadeDosRecortes));
    const opacidadeDe = (base: number) => base * forca;
    /** Cor da faixa em que o valor cai. Sem dado tem cor própria. */
    const corDe = (valor: number | null) => {
      if (valor === null || valor === undefined) return '#CBD5E1';
      const faixa = escala.find((f) => valor <= f.corte);
      return faixa?.cor || escala[escala.length - 1]?.cor || '#1E3A8A';
    };

    const limites: any[] = [];

    /*
     * O SETOR FIXADO.
     *
     * Com um recorte fixado na ficha, ele sai do mapa em âmbar — a única cor
     * que não existe na escala azul da mancha, então não se confunde com
     * "mais gente" — e os outros baixam um pouco o tom. Não somem: o vizinho
     * continua sendo a régua de comparação, só deixa de competir.
     */
    const AMBAR = '#F59E0B';
    const temFixado =
      !!recorteFixado && recortes.some((r) => r.id === recorteFixado && r.geometria);

    const estiloDe = (recorte: (typeof recortes)[number]) => {
      const semDado = recorte.valor === null || recorte.valor === undefined;
      if (recorte.id === recorteFixado) {
        return {
          color: AMBAR,
          weight: 3.5,
          opacity: 1,
          fillColor: corDe(recorte.valor),
          fillOpacity: opacidadeDe(semDado ? 0.45 : 0.85),
          dashArray: undefined as string | undefined
        };
      }
      const base = semDado ? 0.25 : 0.55;
      return {
        color: '#1E293B',
        weight: recorte.tipo === 'setor' ? 0.6 : 1,
        opacity: temFixado ? 0.3 : 0.45,
        fillColor: corDe(recorte.valor),
        // Transparente de propósito: a mancha é contexto, e o que está
        // embaixo dela continua sendo o trabalho.
        fillOpacity: opacidadeDe(temFixado ? base * 0.7 : base),
        dashArray: semDado ? '4, 4' : undefined
      };
    };

    recortes.forEach((recorte) => {
      if (!recorte.geometria) return;
      const semDado = recorte.valor === null || recorte.valor === undefined;
      const fixado = recorte.id === recorteFixado;

      const camada = L.geoJSON(
        { type: 'Feature', properties: {}, geometry: recorte.geometria } as any,
        { style: estiloDe(recorte) }
      );

      /*
       * SEM BALÃO NO PONTEIRO.
       *
       * O que o cursor encontra abre na ficha fixa do canto superior esquerdo,
       * que cabe o Censo inteiro do setor. Manter os dois seria dizer a mesma
       * coisa duas vezes, com a cópia menor tapando o mapa.
       *
       * O realce do cursor é todo feito aqui, no próprio Leaflet, e não
       * redesenhando a malha: antes cada setor atravessado pelo mouse
       * refazia os cem polígonos — e reiniciava o halo do setor fixado.
       */
      camada.on('mouseover', () => {
        camada.setStyle(
          fixado
            ? { weight: 4.5 }
            : {
                weight: 2.5,
                opacity: 0.95,
                fillOpacity: opacidadeDe(semDado ? 0.4 : 0.72)
              }
        );
        if (!fixado) {
          camada.bringToFront();
          // O fixado fica sempre por cima: passar o mouse no vizinho não
          // pode esconder a borda âmbar de quem está sendo lido.
          if (recorteFixado) recortesPorIdRef.current[recorteFixado]?.bringToFront();
        }
        onRecorteSobOCursor?.(recorte.id);
      });
      camada.on('mouseout', () => {
        camada.setStyle(estiloDe(recorte));
        onRecorteSobOCursor?.(null);
      });
      camada.on('click', () => onRecorteClicado?.(recorte.id));

      grupo.addLayer(camada);
      recortesPorIdRef.current[recorte.id] = camada;
      limites.push(camada.getBounds());
    });

    // O halo por baixo da borda do fixado, e ele por cima de todos.
    if (temFixado && recorteFixado) {
      const fixado = recortes.find((r) => r.id === recorteFixado);
      if (fixado?.geometria) {
        const halo = L.geoJSON(
          { type: 'Feature', properties: {}, geometry: fixado.geometria } as any,
          {
            interactive: false,
            style: {
              color: AMBAR,
              weight: 10,
              opacity: 0.3,
              fill: false,
              lineJoin: 'round',
              className: 'setor-fixado-halo'
            }
          }
        );
        grupo.addLayer(halo);
        halo.bringToFront();
      }
      recortesPorIdRef.current[recorteFixado]?.bringToFront();
    }

    // O nome do bairro fica no mapa, como num mapa temático de verdade. O do
    // setor não: são códigos de quinze dígitos, e cem deles viram poluição.
    recortes
      .filter((r) => r.tipo === 'bairro' && r.geometria)
      .forEach((recorte) => {
        const camada = recortesPorIdRef.current[recorte.id];
        if (!camada) return;
        const centro = camada.getBounds().getCenter();
        L.marker(centro, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: 'rotulo-territorio',
            html: `<span>${recorte.nome}</span>`,
            iconSize: [0, 0]
          })
        }).addTo(grupo);
      });

    /*
     * Enquadrar uma vez por conjunto: refazer isso a cada quadro tiraria o
     * mapa da mão de quem está navegando.
     *
     * A assinatura NÃO conta quantos são. A malha de setores da cidade chega
     * em páginas, e o desenho cresce a cada uma; contando a quantidade, cada
     * página viria com assinatura nova e o mapa daria um salto — vinte e cinco
     * saltos numa carga, justamente enquanto a pessoa está olhando. O que
     * identifica o conjunto é o que ele é e por onde começa.
     */
    const assinatura = `${recortes[0]?.tipo || ''}:${recortes[0]?.id || ''}`;
    if (enquadrarRecortes && limites.length > 0 && ultimoRecorteRef.current !== assinatura) {
      ultimoRecorteRef.current = assinatura;
      try {
        const total = limites.reduce((acc, b) => acc.extend(b), limites[0].clone());
        map.fitBounds(total, { padding: [40, 40], maxZoom: 15 });
      } catch {
        // Geometria estranha não pode derrubar a tela.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recortesTerritoriais, escalaTerritorial, recorteFixado, opacidadeDosRecortes]);

  /**
   * Círculo da análise territorial.
   *
   * Ver o número sem ver a área medida é confiar às cegas: o mesmo "4.217
   * moradores" muda completamente se o círculo pegou o mar ou o centro. O
   * traço fica pontilhado e sem preenchimento forte para não esconder os
   * pinos que estão embaixo.
   */
  useEffect(() => {
    const grupo = analiseGroupRef.current;
    const map = mapRef.current;
    if (!grupo || !map) return;

    grupo.clearLayers();
    if (!circuloAnalisado) return;

    desenharCirculoFechavel(
      grupo,
      map,
      circuloAnalisado,
      {
        cor: '#059669',
        preenchimento: 0.08,
        tracejado: '6, 6',
        rotulo: `Área analisada · ${medidaDoRaio(circuloAnalisado.raio)}`,
        tom: 'raio-chip--verde',
        lado: 'baixo'
      },
      aoFecharCirculoAnalisadoRef.current ? () => aoFecharCirculoAnalisadoRef.current?.() : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuloAnalisado]);

  /**
   * O círculo da pesquisa de estabelecimentos.
   *
   * Azul e cheio, diferente do verde tracejado da análise de território: são
   * duas perguntas diferentes e podem estar na tela ao mesmo tempo. A etiqueta
   * mostra o raio porque é ele que explica por que um lugar não apareceu na
   * lista.
   */
  useEffect(() => {
    const grupo = buscaGroupRef.current;
    if (!grupo) return;

    grupo.clearLayers();
    const map = mapRef.current;
    if (!circuloDeBusca || !map) return;

    desenharCirculoFechavel(
      grupo,
      map,
      circuloDeBusca,
      {
        cor: '#015FC9',
        preenchimento: 0.07,
        rotulo: `Busca · ${medidaDoRaio(circuloDeBusca.raio)}`,
        tom: 'raio-chip--azul',
        lado: 'cima'
      },
      aoFecharCirculoDeBuscaRef.current ? () => aoFecharCirculoDeBuscaRef.current?.() : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuloDeBusca]);

  /**
   * O pino escolhido nao pode ficar atras da ficha.
   *
   * A ficha da escola abre numa faixa de 420px colada na direita. Clicar numa
   * escola que estava naquela faixa destacava um pino que a propria ficha
   * acabara de cobrir -- o destaque existia e ninguem via. Aqui o mapa anda o
   * minimo para tirar o pino de baixo dela, e so quando precisa: `panInside`
   * nao mexe em nada se o ponto ja estiver na area livre.
   *
   * Em tela estreita a ficha ocupa tudo, entao nao ha para onde andar: mover
   * o mapa por baixo de uma ficha que cobre a tela inteira e gasto de
   * movimento que ninguem ve.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !escolaEmFoco || !escolasVisiveis) return;
    const escola = (escolas || []).find(e => e.codigoInep === escolaEmFoco);
    if (!escola || escola.latitude === null || escola.longitude === null) return;
    if (window.innerWidth < 640) return;

    map.panInside(L.latLng(escola.latitude, escola.longitude), {
      paddingTopLeft: [80, 80],
      paddingBottomRight: [460, 60],
      animate: true,
      duration: 0.4
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolaEmFoco]);

  /**
   * As Unidades Básicas de Saúde no mapa.
   *
   * Camada de contexto, como a das escolas: responde "quem atende aqui" antes
   * de a equipe decidir para onde ir. O pino abre a ficha com telefone, e-mail
   * e responsáveis — que é o que faz alguém conseguir ligar na hora, em vez de
   * anotar o nome e procurar o contato depois.
   */
  useEffect(() => {
    const grupo = ubsGroupRef.current;
    const map = mapRef.current;
    if (!grupo || !map) return;

    grupo.clearLayers();
    if (!ubsVisiveis) {
      camadaUbsLigadaRef.current = false;
      // Desligou: quando voltar, todas caem de novo, em onda.
      idsDeUbsNoMapaRef.current = new Set();
      setUbsAberta(null);
      return;
    }

    // Unidade sem coordenada existe na lista e não vira pino: melhor faltar um
    // alfinete do que pôr um no meio do oceano.
    const comLugar = (ubs || []).filter(
      u => u.lat !== null && u.lng !== null
    ) as (UnidadeDeSaude & { lat: number; lng: number })[];
    if (comLugar.length === 0) return;

    /*
     * O PINO DA SAÚDE, E COMO ELE CHEGA.
     *
     * Era um "+" branco num disco: dizia "algo aqui", não "saúde aqui". Agora
     * é a gota verde-água da saúde com um coração dentro e o traço do
     * batimento atravessando — o mesmo símbolo da ficha e do botão da camada.
     *
     * Ligar a camada faz as unidades caírem em ONDA: do meio do conjunto para
     * as bordas, como um sinal que se espalha pela cidade. Cada uma pousa,
     * solta um anel no chão, desenha o batimento e passa a bater — cada uma
     * no seu tempo, para o mapa não pulsar como um pisca-pisca sincronizado.
     * Só quem ainda não estava no mapa cai: uma atualização da lista não faz
     * as outras caírem de novo.
     */
    const anteriores = idsDeUbsNoMapaRef.current;
    const agora = new Set<string>();
    const centroLat = comLugar.reduce((soma, u) => soma + u.lat, 0) / comLugar.length;
    const centroLng = comLugar.reduce((soma, u) => soma + u.lng, 0) / comLugar.length;
    const distancia = (u: { lat: number; lng: number }) =>
      Math.hypot(u.lat - centroLat, (u.lng - centroLng) * Math.cos((centroLat * Math.PI) / 180));
    const maisLonge = Math.max(...comLugar.map(distancia), 1e-9);

    const coracao =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="19" height="19" ' +
      'fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path class="pino-saude__coracao-forma" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" ' +
      'fill="#CCFBF1" stroke="#0E9F9F" stroke-width="2.2"/>' +
      '<path class="pino-saude__ecg" pathLength="1" d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" ' +
      'stroke="#E11D48" stroke-width="2.4"/>' +
      '</svg>';

    comLugar.forEach(unidade => {
      agora.add(unidade.id);
      const surge = !anteriores.has(unidade.id);
      // Onda do centro para fora (até ~1s), com um grão de acaso para a
      // frente da onda não parecer uma régua.
      const atraso = surge
        ? Math.round((distancia(unidade) / maisLonge) * 950 + Math.random() * 120)
        : 0;
      // O batimento de cada uma começa num ponto diferente do ciclo.
      const fase = -Math.round(Math.random() * 2800);

      const icone = L.divIcon({
        className: 'pino-ubs',
        html:
          `<span class="pino-saude${surge ? ' pino-saude--surge' : ''}" ` +
          `style="--atraso:${atraso}ms;--fase:${fase}ms">` +
          '<span class="pino-saude__anel"></span>' +
          '<span class="pino-saude__sombra"></span>' +
          '<span class="pino-saude__queda">' +
          '<span class="pino-saude__gota"></span>' +
          `<span class="pino-saude__disco"><span class="pino-saude__coracao">${coracao}</span></span>` +
          '</span>' +
          '</span>',
        iconSize: [40, 54],
        // A ponta da gota é o lugar de verdade no mapa.
        iconAnchor: [20, 47]
      });

      const marcador = L.marker([unidade.lat, unidade.lng], { icon: icone });
      marcador.bindTooltip(
        `<b>${escaparHtml(unidade.nome)}</b>` +
          (unidade.endereco ? `<br>${escaparHtml(unidade.endereco)}` : ''),
        { direction: 'top', offset: [0, -48] }
      );
      marcador.on('click', evento => {
        // O clique é da unidade: não pode virar marcação de ponto no mapa.
        L.DomEvent.stopPropagation(evento);
        estourarNoToque(marcador);
        setUbsAberta(unidade);
      });
      grupo.addLayer(marcador);
    });

    idsDeUbsNoMapaRef.current = agora;

    // Ligar a camada e não ver nada seria um botão quebrado: o mapa vai onde
    // as unidades estão, mas só no momento em que a camada acende.
    if (!camadaUbsLigadaRef.current) {
      const pontos = comLugar.map(u => [u.lat, u.lng] as [number, number]);
      if (pontos.length > 0) {
        map.fitBounds(L.latLngBounds(pontos), { padding: [60, 60], maxZoom: 13 });
      }
    }
    camadaUbsLigadaRef.current = true;
  }, [ubsVisiveis, ubs]);

  // Camada de escolas do municipio: so desenha quando ligada no dock.
  useEffect(() => {
    const grupo = escolasGroupRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    if (!escolasVisiveis || !escolas || escolas.length === 0) {
      camadaEscolasLigadaRef.current = false;
      // Desligou: quando voltar, as escolas chegam em onda de novo.
      idsDeEscolaNoMapaRef.current = new Set();
      chegadaDasEscolasRef.current.clear();
      return;
    }

    const escolasAntes = idsDeEscolaNoMapaRef.current;
    const escolasAgora = new Set<string>();
    const atrasoDaEscola = ondaDeChegada(
      escolas
        .filter(e => e.latitude !== null && e.longitude !== null && !escolasAntes.has(e.codigoInep))
        .map(e => ({ lat: e.latitude as number, lng: e.longitude as number })),
      1000
    );

    escolas.forEach(escola => {
      /*
       * Escola sem coordenada nao e desenhada -- e nao vira um pino no zero.
       *
       * A base municipal traz escolas sem latitude/longitude: elas existem,
       * tem alunos e contam nas listas, so nao tem lugar no mapa ainda.
       */
      const lat = escola.latitude;
      const lng = escola.longitude;
      if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const cor = corDaDependencia(escola.dependencia);
      escolasAgora.add(escola.codigoInep);
      const chegada = tempoDeChegada(
        chegadaDasEscolasRef.current,
        escola.codigoInep,
        !escolasAntes.has(escola.codigoInep),
        () => atrasoDaEscola({ lat, lng })
      );
      const surge = chegada !== null;
      const atraso = chegada ?? 0;
      const parada = escola.situacao ? escola.situacao !== 'EM ATIVIDADE' : false;
      const emFoco = escolaEmFoco === escola.codigoInep;

      /*
       * O tamanho conta o porte da escola sem precisar de rotulo -- e conta
       * em GENTE, nao em vinculo: aluno que faz Fundamental e AEE e uma
       * pessoa so na porta da escola.
       *
       * A escolhida cresce oito pixels. Nao e enfeite: entre dezenas de
       * discos parecidos, diferenca de tamanho e o que o olho acha primeiro,
       * antes de ler cor ou anel.
       */
      const alunos = escola.alunosUnicos ?? escola.matriculas ?? 0;
      const base = alunos >= 1000 ? 38 : alunos >= 400 ? 32 : 26;
      const tamanho = emFoco ? base + 8 : base;

      const capelo =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" ` +
        `stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ` +
        `width="${Math.round(tamanho * 0.5)}" height="${Math.round(tamanho * 0.5)}">` +
        '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/>' +
        '<path d="M6 12v5c3 3 9 3 12 0v-5"/>' +
        '</svg>';

      /*
       * As ondas so existem no pino escolhido, e so no HTML dele.
       *
       * Deixa-las sempre no desenho, apagadas por CSS, poria oitenta e duas
       * animacoes paradas na tela -- cada uma custando composicao ao navegador
       * de quem esta no celular, em campo, para nao mostrar nada.
       */
      const icone = L.divIcon({
        className: `pino-escola${emFoco ? ' pino-escola--foco' : ''}${surge ? ' pino-escola--surge' : ''}`,
        html:
          `<span style="--tamanho:${tamanho}px;--cor:${cor};--atraso:${atraso}ms;display:block;` +
          `width:${tamanho}px;height:${tamanho}px;${parada ? 'opacity:.45;' : ''}">` +
          (emFoco
            ? '<span class="pino-escola__onda"></span>' +
              '<span class="pino-escola__onda pino-escola__onda--2"></span>'
            : '') +
          `<span class="pino-escola__corpo"><span class="pino-escola__icone">${capelo}</span></span>` +
          '</span>',
        iconSize: [tamanho, tamanho],
        iconAnchor: [tamanho / 2, tamanho / 2]
      });

      // Por cima de todas: pino destacado atras de outro nao destaca nada.
      const marcador = L.marker([lat, lng], {
        icon: icone,
        zIndexOffset: emFoco ? 1200 : 0
      });
      marcador.bindTooltip(
        `<b>${escola.nome}</b><br>` +
          [escola.dependencia || '', escola.zona || ''].filter(Boolean).join(' &middot; ') +
          (alunos ? ` &middot; ${alunos.toLocaleString('pt-BR')} alunos` : ''),
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
        .filter(e => e.latitude !== null && e.longitude !== null)
        .map(e => [e.latitude, e.longitude] as [number, number]);
      if (pontos.length > 0) {
        mapa.fitBounds(L.latLngBounds(pontos), { padding: [60, 60], maxZoom: 14 });
      }
    }
    camadaEscolasLigadaRef.current = escolasVisiveis;
    idsDeEscolaNoMapaRef.current = escolasAgora;
  }, [escolas, escolasVisiveis, escolaEmFoco]);

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
    /*
     * O mesmo gesto serve a dois donos: a área de panfletagem, que vira
     * cadastro, e o raio da pesquisa de estabelecimentos, que vira recorte de
     * busca. Desenhar é idêntico — aperta, arrasta, solta —, então o que muda
     * é só a cor do traço e para quem o resultado é entregue no fim.
     */
    const modoBusca = !!desenhandoRaioDeBusca;
    const modoArea = clickToPickCoords && tempPlacementType === 'area';
    if (!map || (!modoArea && !modoBusca)) return;
    const corDoTraco = modoBusca ? '#015FC9' : tempPlacementColor;
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
        color: corDoTraco,
        weight: 2,
        opacity: 0.9,
        dashArray: '5, 5',
        fillColor: corDoTraco,
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
            `background:${corDoTraco};border:2px solid #fff;` +
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

      if (modoBusca) {
        /*
         * Clique seco no modo busca não fica sem raio: um círculo de raio
         * zero não procura nada, e a pessoa ficaria olhando uma lista vazia
         * sem entender. Sem arrasto, vale o raio de bolso — cem metros, a
         * distância de uma quadra — e a lista oferece os outros tamanhos.
         */
        const raio = arrastou && metros > 0 ? metros : 100;
        aoDesenharRaioDeBuscaRef.current?.({ lat: destino.lat, lng: destino.lng, raio });
        return;
      }

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
  }, [clickToPickCoords, tempPlacementType, tempPlacementColor, desenhandoRaioDeBusca]);

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
        // O fantasma é o mesmo pino da missão, só que ainda não salvo: mesma
        // forma, mesma ponta, para o lugar que se vê arrastando ser o lugar
        // que fica depois de salvar.
        const tempIcon = construirPinoDeMissao({
          cor: tempPlacementColor,
          iconeChave: 'flag',
          destacado: true,
          pessoas: 0,
          temMaterial: false,
          prazoVencendo: false
        });
        /**
         * O ponto provisório se arrasta.
         *
         * Clicar no mapa coloca o ponto perto; acertar a esquina certa é
         * questão de centímetros na tela. Arrastar resolve isso sem obrigar
         * a pessoa a clicar de novo, e é o mesmo gesto que ela já usa para
         * mover um ponto que existe.
         */
        const tempMarker = L.marker([tempPlacementCoords.lat, tempPlacementCoords.lng], {
          icon: tempIcon,
          opacity: 0.9,
          draggable: true,
          autoPan: true,
          keyboard: false
        });
        tempMarker.bindTooltip('Arraste para mover', {
          direction: 'top',
          offset: [0, -46],
          opacity: 0.95
        });
        tempMarker.on('dragstart', () => {
          arrastandoPontoRef.current = true;
          tempMarker.closeTooltip();
        });
        tempMarker.on('dragend', () => {
          const destino = tempMarker.getLatLng();
          // O clique sintético que o navegador dispara no fim do arrasto
          // ainda está a caminho: a trava só cai no quadro seguinte.
          setTimeout(() => {
            arrastandoPontoRef.current = false;
          }, 0);
          aoEscolherCoordenadaRef.current({ lat: destino.lat, lng: destino.lng });
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
      {/*
        A ESPERA DO MAPA: o radar da central de comando, enquanto o mapa
        enquadra a operação do cliente. Ele cuida da própria saída — trava no
        alvo e se desfaz — por isso fica montado e só recebe o `ativo`.
      */}
      <CarregandoOperacional ativo={isMapLoading} />

      {/* Map Element */}
      <div id="campaign-primary-map" ref={containerRef} className="w-full h-full bg-slate-100" />

      {/*
        SÓ FAVORITOS, E NENHUM FAVORITO.

        Mapa vazio sem explicação faz alguém achar que quebrou — ou, pior,
        que a equipe não trabalhou. Aqui o vazio diz por que está vazio e
        oferece a saída.
      */}
      {filtroDeCategorias.length > 0 &&
        (checkIns || []).filter(c => (c.favoriteCategories || []).some(id => filtroDeCategorias.includes(id))).length === 0 && (
        <div className="absolute inset-x-0 bottom-24 z-[1000] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto anim-sobe flex items-center gap-3 pl-3 pr-2 py-2 rounded-2xl bg-white/95 backdrop-blur border border-pink-200 shadow-2xl max-w-md">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-violet-500 flex items-center justify-center shrink-0 shadow-md">
              <Tags className="w-4.5 h-4.5 text-white" />
            </span>
            <p className="text-[12px] font-semibold text-slate-600 leading-snug">
              <strong className="text-slate-800">Nenhum check-in nestas categorias aqui.</strong> Guarde
              check-ins nelas pela etiqueta da ficha.
            </p>
            <button
              type="button"
              onClick={() => onLimparFiltroDeCategorias?.()}
              className="shrink-0 h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black cursor-pointer"
            >
              Limpar filtro
            </button>
          </div>
        </div>
      )}

      {mapFilter === 'superfavoritos' && (checkIns || []).filter(c => c.superFavorite).length === 0 && (
        <div className="absolute inset-x-0 bottom-24 z-[1000] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto anim-sobe flex items-center gap-3 pl-3 pr-2 py-2 rounded-2xl bg-white/95 backdrop-blur border border-amber-300 shadow-2xl max-w-md">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30">
              <Crown className="w-4.5 h-4.5 text-white" />
            </span>
            <p className="text-[12px] font-semibold text-slate-600 leading-snug">
              <strong className="text-slate-800">Nenhum Super Favorito aqui.</strong> Toque na
              coroa da ficha do check-in para ele subir de degrau.
            </p>
            <button
              type="button"
              onClick={() => setMapFilter('all')}
              className="shrink-0 h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black cursor-pointer"
            >
              Ver tudo
            </button>
          </div>
        </div>
      )}

      {mapFilter === 'favoritos' && (checkIns || []).filter(c => c.favorite).length === 0 && (
        <div className="absolute inset-x-0 bottom-24 z-[1000] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto anim-sobe flex items-center gap-3 pl-3 pr-2 py-2 rounded-2xl bg-white/95 backdrop-blur border border-amber-200 shadow-2xl max-w-md">
            <span className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Star className="w-4.5 h-4.5 text-amber-500" />
            </span>
            <p className="text-[12px] font-semibold text-slate-600 leading-snug">
              <strong className="text-slate-800">Nenhum check-in favorito aqui.</strong> Marque a
              estrela na ficha do check-in para ele aparecer neste filtro.
            </p>
            <button
              type="button"
              onClick={() => setMapFilter('all')}
              className="shrink-0 h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black cursor-pointer"
            >
              Ver tudo
            </button>
          </div>
        </div>
      )}

      {/* PESQUISA DE LUGARES (Google Maps, via SerpApi) */}
      {/* Ao lado do botão Voltar, que ocupa o canto esquerdo do topo. */}
      {/*
        A BARRA DE CIMA

        Busca e período em fila, com o mesmo respiro do botão de voltar.
        Absolutos soltos, cada um no seu `left`, deixavam buracos entre os
        controles — e brigavam por espaço quando a busca abria. Numa fila,
        abrir a busca empurra o resto para a direita sozinho.
      */}
      <div
        className={`absolute top-4 left-[9.5rem] z-[1000] flex items-start gap-2.5 font-sans ${
          esconderBusca ? 'hidden' : ''
        }`}
      >
      <div className="w-auto">
        {!isPanelOpen ? (
          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="flex items-center gap-2.5 px-4 py-3 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 rounded-2xl shadow-xl border border-slate-200/80 transition-all font-sans text-xs font-bold leading-none cursor-pointer group"
          >
            <Compass className="w-4 h-4 text-indigo-600 group-hover:rotate-45 transition-transform duration-300" />
            <span>Pesquisar no mapa</span>
            {searchMarkerCoords && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse ml-0.5" />
            )}
          </button>
        ) : (
          <div className="w-76 sm:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 select-none">
                <div className="p-1 bg-indigo-50 rounded-lg text-indigo-600">
                  <Compass className="w-4 h-4 shrink-0" />
                </div>
                <h4 className="font-extrabold text-[11px] text-slate-800 uppercase tracking-widest">Pesquisar no mapa</h4>
              </div>
              <div className="flex items-center gap-2">
                {(termoBusca || lugares.length > 0 || searchMarkerCoords) && (
                  <button
                    type="button"
                    onClick={limparBusca}
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

            {/*
             * A busca sai no Enter, não a cada tecla.
             *
             * Cada pesquisa é uma chamada cobrada lá fora: buscar enquanto a
             * pessoa digita gastaria uma consulta por letra para chegar no
             * mesmo resultado. Quem digita endereço já sabe quando terminou.
             */}
            <form onSubmit={pesquisarNoMapa} className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Endereço, bairro ou lugar
              </label>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200/70 rounded-xl focus-within:border-indigo-400 focus-within:bg-white transition-colors">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  maxLength={200}
                  placeholder="Ex.: Avenida Ana Karina, Parauapebas"
                  className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-0 py-0.5"
                />
                {buscando && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" />}
              </div>
              <button
                type="submit"
                disabled={!termoBusca.trim() || buscando}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99]"
              >
                {buscando ? 'Procurando…' : 'Procurar'}
              </button>
              <p className="text-[9.5px] text-slate-400 font-semibold leading-snug pt-0.5">
                A procura começa pelo pedaço do mapa que você está vendo.
              </p>
            </form>

            {erroBusca && (
              <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 leading-snug">
                {erroBusca}
              </p>
            )}

            {!erroBusca && avisoBusca && (
              <p className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 leading-snug">
                {avisoBusca}
              </p>
            )}

            {lugares.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {lugares.length === 1 ? '1 lugar encontrado' : `${lugares.length} lugares encontrados`}
                </p>
                <div className="max-h-64 overflow-y-auto -mx-1 px-1 divide-y divide-slate-100">
                  {lugares.map((lugar) => (
                    <button
                      key={lugar.id}
                      type="button"
                      onClick={() => irParaLugar(lugar)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                        lugarEscolhido === lugar.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className={`text-xs leading-tight truncate ${
                        lugarEscolhido === lugar.id ? 'font-bold text-indigo-700' : 'font-semibold text-slate-800'
                      }`}>
                        {lugar.titulo}
                      </p>
                      {lugar.endereco && (
                        <p className="text-[10.5px] text-slate-500 leading-snug mt-0.5 truncate">
                          {lugar.endereco}
                        </p>
                      )}
                      {(lugar.categoria || lugar.avaliacao !== null) && (
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5 truncate">
                          {lugar.categoria && <span className="truncate">{lugar.categoria}</span>}
                          {lugar.avaliacao !== null && (
                            <span className="flex items-center gap-0.5 shrink-0 text-amber-500">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              {lugar.avaliacao.toFixed(1).replace('.', ',')}
                              {lugar.totalAvaliacoes !== null && (
                                <span className="text-slate-400 font-semibold">({lugar.totalAvaliacoes})</span>
                              )}
                            </span>
                          )}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] text-slate-400 font-semibold leading-snug pt-0.5">
                  Toque no resultado para o mapa ir até ele.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
        {acoesDaBarra}
      </div>

      {/*
        A FICHA DO RESULTADO DA PESQUISA.

        É a mesma ficha do estabelecimento, de propósito: as duas respondem a
        mesma pergunta — "o que é este lugar?" — e aprender duas telas para
        isso seria trabalho da pessoa, não do sistema. O que a pesquisa do
        mapa não traz (foto, horário de cada dia, faixa de preço) simplesmente
        não aparece; a ficha já sabe esconder o que está vazio.

        Sem "virar ponto" aqui: a barra de baixo já tem o "Marcar Aqui", e a
        mesma ação em dois lugares na mesma tela é convite para clicar duas
        vezes e criar dois pontos.
      */}
      <FichaEstabelecimento
        lugar={
          fichaDaBusca
            ? ({
                id: fichaDaBusca.id,
                nome: fichaDaBusca.titulo,
                latitude: fichaDaBusca.latitude,
                longitude: fichaDaBusca.longitude,
                endereco: fichaDaBusca.endereco,
                telefone: fichaDaBusca.telefone,
                site: fichaDaBusca.site,
                categoria: fichaDaBusca.categoria,
                categorias: fichaDaBusca.categoria ? [fichaDaBusca.categoria] : [],
                avaliacao: fichaDaBusca.avaliacao,
                totalAvaliacoes: fichaDaBusca.totalAvaliacoes,
                faixaDePreco: null,
                situacao: fichaDaBusca.situacao,
                horarios: null,
                imagem: null,
                placeId: fichaDaBusca.placeId,
                dataId: null
              } as Estabelecimento)
            : null
        }
        onFechar={() => setFichaDaBusca(null)}
      />

      {/* MATCH CONFIRMATION CARD AT BOTTOM LEFT */}
      {searchMarkerCoords && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/60 p-2.5 flex items-center gap-3 animate-in slide-in-from-bottom duration-350">
          {/* O cartão é a segunda porta para a ficha: quem não adivinha que o
              pino é clicável encontra aqui, escrito. */}
          <button
            type="button"
            onClick={() => lugarDoPino && setFichaDaBusca(lugarDoPino)}
            disabled={!lugarDoPino}
            className="text-left font-sans min-w-0 max-w-[180px] sm:max-w-[220px] cursor-pointer disabled:cursor-default group"
          >
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Resultado Encontrado</p>
            <p className="text-xs font-semibold text-slate-800 mt-1 truncate group-hover:text-indigo-700 transition-colors">
              {searchMarkerCoords.name}
            </p>
            {lugarDoPino && (
              <p className="text-[9.5px] font-bold text-indigo-600 mt-0.5 leading-none">
                ver informações
              </p>
            )}
          </button>
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

      {/*
        FICHA DA MISSÃO

        O mesmo formato da ficha do check-in, de propósito: no mapa as duas
        coisas se clicam igual, então têm de abrir igual. Muda a cor, que é a
        da própria missão, e o conteúdo — aqui é a ordem que foi dada, lá é o
        que voltou do campo. Ler é o que o clique faz; mexer é um botão.
      */}
      {missaoAberta && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setMissaoAbertaRef(null)}
        >
          <div
            className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho na cor da missão */}
            <div
              className="px-6 py-4 flex items-center justify-between text-white shadow-md"
              style={{ backgroundColor: missaoAberta.cor }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"
                  dangerouslySetInnerHTML={{
                    __html:
                      missaoAberta.tipo === 'pin'
                        ? buildOperationIconSvg(missaoAberta.iconeChave, 22)
                        : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>'
                  }}
                />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-[10.5px] uppercase tracking-widest text-white/80 leading-none">
                    {missaoAberta.etiqueta}
                  </h3>
                  <p className="text-[15px] font-extrabold leading-tight mt-1 truncate">
                    {missaoAberta.titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMissaoAbertaRef(null)}
                className="p-1.5 hover:bg-white/15 rounded-full transition-colors cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              ref={corpoDaMissaoRef}
              className="p-6 overflow-y-auto space-y-5 text-left font-sans"
            >
              {/* Etiquetas do topo: o que decide a ordem do dia */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border"
                  style={{
                    color: missaoAberta.cor,
                    borderColor: `${missaoAberta.cor}40`,
                    backgroundColor: `${missaoAberta.cor}14`
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: missaoAberta.cor }} />
                  {missaoAberta.tipo === 'pin' ? 'Missão em ponto' : 'Missão em área'}
                </span>

                {missaoAberta.turno && (
                  <EtiquetaDeTurno
                    turno={missaoAberta.turno}
                    janelas={janelasDeTurno}
                    aoVivo
                  />
                )}

                {(() => {
                  const nivel = (priorityLevels || []).find(
                    n => n.id === missaoAberta.prioridade
                  );
                  return nivel ? <EtiquetaDePrioridade nivel={nivel} /> : null;
                })()}

                {missaoAberta.prazo && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${
                      prazoApertado(missaoAberta.prazo)
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    Prazo {dataCurta(missaoAberta.prazo)}
                  </span>
                )}

                {missaoAberta.raio !== null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200">
                    <CircleDot className="w-3 h-3" />
                    Raio {missaoAberta.raio >= 1000
                      ? `${(missaoAberta.raio / 1000).toFixed(missaoAberta.raio % 1000 === 0 ? 0 : 1)} km`
                      : `${missaoAberta.raio} m`}
                  </span>
                )}

                {missaoAberta.voluntarios > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200">
                    <Users className="w-3 h-3" />
                    {missaoAberta.voluntarios} previstos
                  </span>
                )}
              </div>

              {/*
                DUAS COLUNAS, PORQUE SÃO DUAS PERGUNTAS.

                À esquerda o enunciado — o que fazer, quem recebeu, o que
                veio junto. À direita a realidade — onde é e o que já
                voltou. Empilhado num tubo estreito, conferir o retorno
                contra a ordem era rolar para cima, guardar de cabeça e
                rolar para baixo. Lado a lado, a conferência é olhar.

                Numa tela estreita as colunas viram uma só, na ordem em que
                se lê: primeiro a ordem, depois o que ela produziu.
              */}
              <div className="grid gap-5 lg:grid-cols-12 items-start">
                <div className="lg:col-span-7 space-y-5">
              {/* O que precisa ser feito */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: `${missaoAberta.cor}0D`,
                  borderColor: `${missaoAberta.cor}33`
                }}
              >
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  O que precisa ser feito
                </p>
                <p className="text-[13px] text-slate-700 font-medium leading-relaxed mt-2 whitespace-pre-wrap break-words">
                  {missaoAberta.descricao?.trim() || 'Nenhuma instrução foi escrita nesta missão.'}
                </p>
                {missaoAberta.responsavel && (
                  <p className="text-[11px] text-slate-500 font-semibold mt-3 flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: missaoAberta.cor }} />
                    Coordenação: <strong className="text-slate-700">{missaoAberta.responsavel}</strong>
                  </p>
                )}
              </div>

              {/* Quem recebeu */}
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                  Quem recebeu a missão
                  {missaoAberta.totalDesignados > 0 ? ` (${missaoAberta.totalDesignados})` : ''}
                </p>
                {missaoAberta.totalDesignados === 0 ? (
                  <div className="border border-dashed border-slate-200 bg-slate-50 rounded-xl p-3.5 flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-slate-300 shrink-0" />
                    <p className="text-[11px] text-slate-500 font-semibold">
                      Ninguém foi marcado: ela aparece para todo o time no check-in.
                    </p>
                  </div>
                ) : missaoAberta.pessoas.length === 0 ? (
                  <div className="border border-dashed border-amber-200 bg-amber-50/60 rounded-xl p-3.5">
                    <p className="text-[11px] text-amber-700 font-semibold">
                      {missaoAberta.totalDesignados} pessoa
                      {missaoAberta.totalDesignados > 1 ? 's' : ''} designada
                      {missaoAberta.totalDesignados > 1 ? 's' : ''}, mas a equipe não está
                      carregada nesta tela.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {missaoAberta.pessoas.map((pessoa: any) => (
                      <div
                        key={pessoa.id}
                        className="flex items-center gap-2.5 border border-slate-200 bg-slate-50/60 rounded-xl p-2.5"
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 border border-slate-200 flex items-center justify-center shrink-0">
                          {fotoDoIntegrante(pessoa) ? (
                            <img
                              src={fotoDoIntegrante(pessoa)}
                              alt={nomeDoIntegrante(pessoa)}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-bold text-slate-700 truncate leading-tight">
                            {nomeDoIntegrante(pessoa)}
                          </p>
                          {pessoa.whatsapp && (
                            <p className="text-[9.5px] text-slate-400 font-mono leading-none mt-0.5">
                              {pessoa.whatsapp}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/*
                Material que foi junto com a ordem.

                Cada arquivo abre no meio da tela, por cima de tudo, no mesmo
                visor que a equipe usa no check-in. Tocar o vídeo espremido
                dentro da ficha não serve para conferir a arte do panfleto nem
                para ler a planilha das ruas.
              */}
              {missaoAberta.material.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                    Material de apoio ({missaoAberta.material.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {missaoAberta.material.map((item, indice) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMaterialAberto(indice)}
                        title={`Abrir ${rotuloDoMaterial(item, indice + 1)}`}
                        className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer transition-all hover:border-slate-300 hover:shadow-md active:scale-95"
                      >
                        {item.tipo === 'imagem' ? (
                          <img
                            src={item.url}
                            alt={rotuloDoMaterial(item, indice + 1)}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : item.tipo === 'video' ? (
                          <video
                            src={item.url}
                            preload="metadata"
                            muted
                            className="w-full h-full object-cover bg-black"
                          />
                        ) : (
                          <span className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-2">
                            {item.tipo === 'audio' ? (
                              <Mic className="w-6 h-6" style={{ color: missaoAberta.cor }} />
                            ) : (
                              <FileText className="w-6 h-6" style={{ color: missaoAberta.cor }} />
                            )}
                            <span className="text-[9.5px] font-bold text-slate-500 leading-tight text-center line-clamp-2">
                              {rotuloDoMaterial(item, indice + 1)}
                              {formatoDoMaterial(item) ? ` · ${formatoDoMaterial(item)}` : ''}
                            </span>
                          </span>
                        )}

                        {/* Véu de "abre aqui": no vídeo ele é o play, no
                            resto só aparece quando o cursor chega. */}
                        <span
                          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                            item.tipo === 'video'
                              ? 'bg-black/35'
                              : 'bg-slate-900/35 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <span className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-md">
                            {item.tipo === 'video' ? (
                              <Play className="w-3.5 h-3.5 text-slate-800 fill-slate-800" />
                            ) : (
                              <Maximize2 className="w-3.5 h-3.5 text-slate-800" />
                            )}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
                </div>

                <div className="lg:col-span-5 space-y-5">
              {/* Onde é */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Onde a missão acontece
                </p>
                <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: missaoAberta.cor }} />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        Endereço
                      </p>
                      {buscandoEnderecoDaMissao ? (
                        <p className="text-[11.5px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          Procurando o endereço deste ponto...
                        </p>
                      ) : (
                        <p className="text-[11.5px] font-semibold text-slate-700 mt-0.5 leading-relaxed">
                          {enderecoDaMissao ||
                            missaoAberta.bairro ||
                            'Endereço não identificado para esta coordenada.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/70">
                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">
                      Criada em
                    </span>
                    {/* Data E hora: "criada em 20/09" não responde se a ordem
                        saiu antes ou depois do check-in que se está olhando. */}
                    <span className="text-[11px] font-extrabold text-slate-700">
                      {missaoAberta.criadaEm
                        ? `${new Date(missaoAberta.criadaEm).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })} às ${new Date(missaoAberta.criadaEm).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`
                        : '—'}
                    </span>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${missaoAberta.coords.lat},${missaoAberta.coords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 no-underline active:scale-98"
                  >
                    <Navigation className="w-4 h-4 stroke-[2.5]" style={{ color: missaoAberta.cor }} />
                    Abrir no Google Maps
                  </a>
                </div>
              </div>

              {/*
                O FEEDBACK DA MISSÃO.

                A missão dizia o que precisava ser feito e quem recebeu, mas
                não o que voltou — e era preciso sair daqui, achar o check-in
                na lista e cruzar os dois na cabeça. O retorno é metade da
                missão: ele fica aqui dentro, e cada registro abre a ficha
                inteira, com áudio, foto e observação, a um clique.
              */}
              {(() => {
                const retorno = (checkIns || []).filter(
                  (c: any) => c.missionId && c.missionId === missaoAberta.id
                );
                /*
                 * Concluído é o check-in que saiu do rascunho.
                 *
                 * Aqui se lia `c.concluido`, um campo que CheckIn não tem: a
                 * conta existe em App.tsx, sobre `status`, e nunca chegou até
                 * este card. O selo dizia "Em andamento" em toda missão, até
                 * nas encerradas, e a regra passa a ser a mesma dos dois lados.
                 */
                const concluido = (c: any) => c.status !== 'rascunho';
                return (
                  <>
                  <TempoDaMissao
                    criadaEm={missaoAberta.criadaEm}
                    retornos={retorno.map((c: any) => ({
                      createdAt: c.createdAt,
                      concluido: concluido(c)
                    }))}
                  />

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Feedback da missão
                      {retorno.length > 0 ? ` (${retorno.length})` : ''}
                    </p>

                    {retorno.length === 0 ? (
                      <div className="border border-dashed border-slate-200 bg-slate-50 rounded-xl p-3.5 flex items-center gap-2.5">
                        <MessageSquare className="w-4 h-4 text-slate-300 shrink-0" />
                        <p className="text-[11px] text-slate-500 font-semibold leading-snug">
                          Nenhum check-in vinculado a esta missão ainda. Se o
                          trabalho foi feito como registro livre, o vínculo se
                          conserta na ficha do check-in.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {retorno.map((c: any) => {
                          const midias =
                            c.media && c.media.length > 0
                              ? c.media
                              : c.photo
                                ? [{ url: c.photo, type: 'image' }]
                                : [];
                          return (
                            <div
                              key={c.id}
                              data-retorno-id={c.id}
                              className={`border border-slate-200 rounded-xl p-3 bg-white scroll-my-4 ${
                                retornoEmDestaque === c.id ? 'retorno-lido' : ''
                              }`}
                              style={{ '--cor-da-missao': missaoAberta.cor } as React.CSSProperties}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 overflow-hidden">
                                  {c.memberPhoto ? (
                                    <img
                                      src={c.memberPhoto}
                                      alt={c.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-4 h-4" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12.5px] font-bold text-slate-800 truncate leading-tight">
                                    {c.name}
                                  </p>
                                  <p className="text-[10.5px] font-semibold text-slate-400 leading-tight mt-0.5">
                                    {new Date(c.createdAt).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    })}
                                    {' às '}
                                    {new Date(c.createdAt).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider shrink-0 ${
                                    concluido(c)
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                                  }`}
                                >
                                  {concluido(c) ? 'Concluído' : 'Em andamento'}
                                </span>
                              </div>

                              {(c.rua || c.bairro) && (
                                <p className="text-[10.5px] font-semibold text-slate-500 mt-2 flex items-start gap-1.5">
                                  <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-300" />
                                  <span className="min-w-0">
                                    {[c.rua, c.bairro].filter(Boolean).join(', ')}
                                  </span>
                                </p>
                              )}

                              {midias.length > 0 && (
                                <div className="grid grid-cols-4 gap-1.5 mt-2">
                                  {midias.slice(0, 4).map((m: any, i: number) => (
                                    <span
                                      key={m.url || i}
                                      className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 block"
                                    >
                                      {m.type === 'video' || m.kind === 'video' ? (
                                        <video
                                          src={m.url}
                                          className="w-full h-full object-cover"
                                          muted
                                        />
                                      ) : (
                                        <img
                                          src={m.url}
                                          alt=""
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                        />
                                      )}
                                      {/* A quarta miniatura conta o resto: sem
                                          isso, oito evidências pareciam quatro. */}
                                      {i === 3 && midias.length > 4 && (
                                        <span className="absolute inset-0 bg-slate-900/60 text-white text-[11px] font-black flex items-center justify-center">
                                          +{midias.length - 4}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  // A ficha do check-in toma a tela: dois modais
                                  // empilhados escondem qual deles o X fecha.
                                  // Ela lembra de onde veio, e o "voltar" dela
                                  // devolve a missão neste mesmo ponto.
                                  abrirRetornoDaMissao(c);
                                }}
                                className="mt-2.5 w-full h-9 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
                              >
                                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                Ver feedback completo
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  </>
                );
              })()}
                </div>
              </div>

              {/*
                AÇÕES TÁTICAS (TIME DELTA).

                Material de apoio é o que o comitê manda antes; narrativa é o
                que volta — a foto do buraco, o vídeo da fila, o áudio do
                morador. São coisas diferentes e por isso não se misturam: uma
                é a ordem, a outra é a prova, e quem monta a peça depois
                precisa achar a segunda sem garimpar a primeira.
              */}
              {onNarrativasDaMissao && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${missaoAberta.cor}1A`,
                        color: missaoAberta.cor
                      }}
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase font-black tracking-wider text-slate-500 leading-none">
                        Ações Táticas (Time Delta)
                      </p>
                      <p className="text-[10.5px] font-semibold text-slate-400 leading-snug mt-1">
                        O que esta missão produziu: arquivos que provam a ação e
                        os links do que foi publicado.
                      </p>
                    </div>
                    {missaoAberta.narrativas.length +
                      missaoAberta.organicas.length +
                      missaoAberta.links.length >
                      0 && (
                      <span className="ml-auto shrink-0 text-[10px] font-black text-slate-400 tabular-nums">
                        {missaoAberta.narrativas.length +
                          missaoAberta.organicas.length +
                          missaoAberta.links.length}
                      </span>
                    )}
                  </div>

                  {/*
                    O LINK DA POSTAGEM.

                    O arquivo prova que a ação aconteceu; o link prova que ela
                    foi publicada. É o link que se manda no grupo, que se abre
                    para ver o alcance — e que some do histórico de quem não o
                    guardou em lugar nenhum.
                  */}
                  {onLinksDaMissao && (
                    <div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const bruto = linkNovo.trim();
                          if (!bruto) return;
                          // Coloca o esquema quando falta: "instagram.com/p/x"
                          // sem ele vira link relativo e abre dentro do painel.
                          const url = /^https?:\/\//i.test(bruto)
                            ? bruto
                            : `https://${bruto}`;
                          const lista = [
                            ...missaoAberta.links,
                            {
                              id:
                                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                                  ? crypto.randomUUID()
                                  : `lnk-${Date.now()}`,
                              url,
                              titulo: tituloDoLinkNovo.trim() || undefined,
                              criadoEm: new Date().toISOString()
                            }
                          ];
                          onLinksDaMissao(
                            { id: missaoAberta.id, tipo: missaoAberta.tipo },
                            lista
                          );
                          setLinkNovo('');
                          setTituloDoLinkNovo('');
                        }}
                        className="flex flex-col sm:flex-row gap-2"
                      >
                        <input
                          value={linkNovo}
                          onChange={(e) => setLinkNovo(e.target.value)}
                          placeholder="Cole o link da postagem"
                          inputMode="url"
                          className="flex-1 min-w-0 h-10 px-3 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-hidden focus:border-slate-300"
                        />
                        <input
                          value={tituloDoLinkNovo}
                          onChange={(e) => setTituloDoLinkNovo(e.target.value)}
                          placeholder="Do que se trata (opcional)"
                          className="sm:w-[190px] h-10 px-3 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-hidden focus:border-slate-300"
                        />
                        <button
                          type="submit"
                          disabled={!linkNovo.trim()}
                          className="h-10 px-4 text-white rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          style={{ backgroundColor: missaoAberta.cor }}
                        >
                          Adicionar
                        </button>
                      </form>

                      {missaoAberta.links.length > 0 && (
                        <div className="grid sm:grid-cols-2 gap-2 mt-2.5">
                          {missaoAberta.links.map((link: LinkDeAcao) => {
                            let dominio = link.url;
                            try {
                              dominio = new URL(link.url).hostname.replace(/^www\./, '');
                            } catch {
                              // Link torto ainda é o que a pessoa guardou: mostra
                              // como veio, em vez de sumir com ele.
                            }
                            return (
                              <div
                                key={link.id}
                                className="group flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2"
                              >
                                <span className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                                </span>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-w-0 flex-1 no-underline"
                                >
                                  <span className="block text-[12px] font-bold text-slate-700 truncate leading-tight">
                                    {link.titulo || dominio}
                                  </span>
                                  <span className="block text-[10px] font-semibold text-slate-400 truncate">
                                    {link.titulo ? dominio : link.url}
                                  </span>
                                </a>
                                <button
                                  type="button"
                                  title="Tirar este link"
                                  onClick={() =>
                                    onLinksDaMissao(
                                      { id: missaoAberta.id, tipo: missaoAberta.tipo },
                                      missaoAberta.links.filter(
                                        (l: LinkDeAcao) => l.id !== link.id
                                      )
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/*
                    A MESMA ORDEM, PARA QUEM NÃO ABRE ESTE MAPA.

                    A equipe Delta trabalha noutro sistema, o Nexu-GC. Mandar
                    uma ordem para ela era copiar título, descrição e prazo na
                    mão de uma tela para a outra — e o que se perdia no caminho
                    não era tempo, era rastro: ninguém sabia depois se a ordem
                    tinha sido mandada, para quem, nem se alguém concluiu.

                    Fica ANTES dos dois blocos de feedback porque é dessa
                    ordem: primeiro se despacha, depois volta o retorno.
                  */}
                  <MissaoParaODelta
                    missao={{
                      tipo: missaoAberta.tipo,
                      id: missaoAberta.id,
                      prazo: missaoAberta.prazo
                    }}
                    clienteSugerido={
                      candidates?.find((c) => c.id === selectedCandidateId)?.name || null
                    }
                    prioridadeSugerida={prioridadeNoNexus(
                      (priorityLevels || []).find((n) => n.id === missaoAberta.prioridade)?.label
                    )}
                  />

                  {/*
                    DOIS TÓPICOS, PORQUE SÃO DUAS ORIGENS.

                    O que saiu da ordem dada e o que apareceu sozinho servem à
                    mesma campanha, mas não valem a mesma coisa: na hora de
                    montar a peça a pergunta é sempre "isto veio da missão ou
                    veio orgânico?". Num monte só, respondê-la exigiria lembrar
                    de cada arquivo.
                  */}
                  {[
                    {
                      topico: 'missao' as const,
                      titulo: 'Feedback Missão',
                      /*
                       * Verde fixo, não a cor da missão.
                       *
                       * Herdar a cor deixava o bloco refém do tipo de
                       * operação: numa missão laranja a faixa brigava com o
                       * roxo do orgânico logo abaixo. Retorno cumprido é verde
                       * em todo o sistema — é a mesma cor do check-in
                       * concluído, e aqui ela quer dizer a mesma coisa.
                       */
                      cor: '#059669',
                      Icone: Target,
                      itens: narrativasNaTela,
                      aoMudar: setNarrativasNaTela,
                      vazio:
                        'Foto, vídeo ou áudio do que foi feito na missão. É o que prova a ação quando alguém perguntar.'
                    },
                    {
                      topico: 'organico' as const,
                      titulo: 'Feedback Orgânico',
                      // Cor própria, e não a da missão: a origem diferente
                      // precisa ser vista antes de ser lida.
                      cor: '#7C3AED',
                      /*
                       * Caixa de entrada, e não a estrelinha.
                       *
                       * "Orgânico" aqui é o que CHEGOU por fora — print de
                       * grupo, vídeo de morador, áudio que alguém mandou. A
                       * estrela de quatro pontas virou, no resto do mercado,
                       * o símbolo de "isto foi gerado por IA", e é exatamente
                       * o que este material não é: é gente mandando coisa. No
                       * sistema ela fica reservada ao NEO, que é IA de
                       * verdade.
                       */
                      Icone: Inbox,
                      itens: organicasNaTela,
                      aoMudar: setOrganicasNaTela,
                      vazio:
                        'O que chegou por fora: print de grupo, vídeo de morador, áudio que alguém mandou.'
                    }
                  ].map((bloco) => {
                    const prontos = bloco.itens.filter(
                      (i) => i.estado === 'pronto'
                    ).length;
                    return (
                    <div
                      key={bloco.topico}
                      className="rounded-xl bg-white border border-slate-200 overflow-hidden"
                    >
                      {/*
                        O TÍTULO COMO FAIXA, NÃO COMO LINHA DE TEXTO.

                        São duas listas de arquivo parecidíssimas uma com a
                        outra: mesma galeria, mesmos três botões. O que separa
                        as duas é só o nome — então o nome precisa ser a coisa
                        mais visível do bloco, com cor, ícone e a contagem do
                        que tem dentro. Um rótulo cinza de onze pixels entre
                        duas grades de fotos não separa nada.
                      */}
                      <div
                        className="flex items-center gap-2.5 px-3 py-2.5 border-l-[3px]"
                        style={{
                          borderLeftColor: bloco.cor,
                          backgroundColor: `${bloco.cor}0F`
                        }}
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                          style={{ backgroundColor: bloco.cor }}
                        >
                          <bloco.Icone className="w-4 h-4 text-white stroke-[2.5]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[13px] font-black leading-tight tracking-tight"
                            style={{ color: bloco.cor }}
                          >
                            {bloco.titulo}
                          </p>
                        </div>
                        <span
                          className="shrink-0 px-2.5 h-[22px] rounded-full bg-white text-[10px] font-black uppercase tracking-wider flex items-center border"
                          style={{ color: bloco.cor, borderColor: `${bloco.cor}33` }}
                        >
                          {prontos === 0
                            ? 'vazio'
                            : `${prontos} ${prontos === 1 ? 'arquivo' : 'arquivos'}`}
                        </span>
                      </div>

                      <div className="p-3">
                      <EditorDeMaterial
                        itens={bloco.itens}
                        onMudar={(itens) => {
                          bloco.aoMudar(itens);
                          // Só o que terminou de subir vira dado da missão: item
                          // a meio caminho gravado agora viraria link quebrado.
                          onNarrativasDaMissao(
                            { id: missaoAberta.id, tipo: missaoAberta.tipo },
                            itens
                              .filter((i) => i.estado === 'pronto')
                              .map(
                                ({ estado, progresso, erro, previa, jaSalvo, ...limpo }) =>
                                  limpo
                              ),
                            bloco.topico
                          );
                        }}
                        notificar={notificar || (() => {})}
                        ligado
                        galeria
                        rotulo="Arquivos"
                        vazio={bloco.vazio}
                      />
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const alvo = missaoAberta;
                  setMissaoAbertaRef(null);
                  onSelectItem(alvo.id, alvo.tipo);
                }}
                className="px-4 py-2.5 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                style={{ backgroundColor: missaoAberta.cor }}
              >
                <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                Editar missão
              </button>
              <div className="flex items-center gap-2">
                {/*
                  O lugar do relatório é aqui: depois de ler a missão inteira é
                  que se quer o documento dela. Quem escreve é o NEO, com o
                  dossiê que este card já tem em mãos.

                  O botão diz o que vai acontecer. Com relatório guardado, ele
                  abre um documento que já existe, na hora e sem custo -- e
                  chamar isso de "gerar" faria quem clica esperar por um minuto
                  de análise que não vem, ou hesitar em clicar achando que vai
                  pagar por outra leitura.
                */}
                <button
                  type="button"
                  disabled={relatorioCarregando}
                  onClick={() => pedirRelatorioDoNeo(missaoAberta)}
                  title={
                    missaoTemRelatorio
                      ? 'Abrir o relatório guardado desta missão'
                      : 'O NEO lê a missão inteira e escreve o relatório'
                  }
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-2 active:scale-95"
                >
                  {relatorioCarregando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      NEO lendo...
                    </>
                  ) : missaoTemRelatorio ? (
                    <>
                      <FileText className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400" />
                      Ver Relatório
                    </>
                  ) : (
                    <>
                      <FilePlus className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400" />
                      Gerar Relatório
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMissaoAbertaRef(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* O material aberto em tela cheia, por cima da ficha. */}
      {missaoAberta && materialAberto !== null && missaoAberta.material[materialAberto] && (
        <VisorDoMaterial
          item={missaoAberta.material[materialAberto]}
          rotulo={rotuloDoMaterial(
            missaoAberta.material[materialAberto],
            materialAberto + 1
          )}
          aoFechar={() => setMaterialAberto(null)}
          posicao={{ atual: materialAberto + 1, total: missaoAberta.material.length }}
          aoAnterior={() =>
            setMaterialAberto(
              atual =>
                ((atual ?? 0) - 1 + missaoAberta.material.length) % missaoAberta.material.length
            )
          }
          aoProximo={() =>
            setMaterialAberto(atual => ((atual ?? 0) + 1) % missaoAberta.material.length)
          }
        />
      )}

      {/* A foto do check-in em tela cheia, no mesmo visor da missão. */}
      {selectedCheckInForModal &&
        midiaDoCheckInAberta !== null &&
        midiasDoCheckInRef.current[midiaDoCheckInAberta] && (
          <VisorDoMaterial
            item={midiasDoCheckInRef.current[midiaDoCheckInAberta]}
            aoFechar={() => setMidiaDoCheckInAberta(null)}
            posicao={{
              atual: midiaDoCheckInAberta + 1,
              total: midiasDoCheckInRef.current.length
            }}
            aoAnterior={() =>
              setMidiaDoCheckInAberta(atual => {
                const total = midiasDoCheckInRef.current.length;
                return ((atual ?? 0) - 1 + total) % total;
              })
            }
            aoProximo={() =>
              setMidiaDoCheckInAberta(atual => {
                const total = midiasDoCheckInRef.current.length;
                return ((atual ?? 0) + 1) % total;
              })
            }
          />
        )}

      {/*
        A FICHA DA UNIDADE DE SAÚDE.

        Telefone e e-mail são links de verdade: o número que só se pode ler é
        um número que a pessoa copia errado no meio da rua.
      */}
      {ubsAberta && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setUbsAberta(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-start justify-between gap-3 text-white bg-[#0E9F9F]">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80 leading-none">
                    Unidade Básica de Saúde
                  </p>
                  <h3 className="text-[15px] font-extrabold leading-tight mt-1">
                    {ubsAberta.nome}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUbsAberta(null)}
                className="p-1.5 hover:bg-white/15 rounded-full cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 font-sans">
              {ubsAberta.endereco && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0E9F9F] shrink-0 mt-0.5" />
                  <p className="text-[12.5px] font-semibold text-slate-700 leading-snug">
                    {ubsAberta.endereco}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                {ubsAberta.celular && (
                  <a
                    href={`tel:${ubsAberta.celular.replace(/\D/g, '')}`}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 no-underline transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[#0E9F9F] shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Telefone da unidade
                      </span>
                      <span className="block text-[12.5px] font-bold text-slate-800">
                        {ubsAberta.celular}
                      </span>
                    </span>
                  </a>
                )}
                {ubsAberta.email && (
                  <a
                    href={`mailto:${ubsAberta.email}`}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 no-underline transition-colors"
                  >
                    <Mail className="w-4 h-4 text-[#0E9F9F] shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                        E-mail institucional
                      </span>
                      <span className="block text-[12px] font-bold text-slate-800 truncate">
                        {ubsAberta.email}
                      </span>
                    </span>
                  </a>
                )}
              </div>

              {ubsAberta.responsaveis.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                    Quem responde pela unidade
                  </p>
                  <div className="space-y-2">
                    {ubsAberta.responsaveis.map((r, i) => (
                      <div
                        key={`${r.nome}-${i}`}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <span className="w-8 h-8 rounded-full bg-[#0E9F9F]/10 text-[#0E9F9F] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-bold text-slate-800 truncate">
                            {r.nome}
                          </span>
                          {r.celular && (
                            <a
                              href={`tel:${r.celular.replace(/\D/g, '')}`}
                              className="text-[11px] font-semibold text-[#0E9F9F] no-underline hover:underline"
                            >
                              {r.celular}
                            </a>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${ubsAberta.lat},${ubsAberta.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2 no-underline"
              >
                <Navigation className="w-4 h-4 text-[#0E9F9F]" />
                Abrir no Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN DETALHES MODAL (CENTRALIZADO) */}
      {selectedCheckInForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/*
              A TRILHA DE VOLTA.

              Só existe quando a ficha foi aberta de dentro de uma missão, e
              vem na cor dela: é o fio que diz "você está lendo um retorno
              DESTA missão". O botão grande à esquerda devolve a missão no
              ponto em que ela estava; à direita, a contagem e as setas
              passam para o retorno seguinte sem precisar sair e voltar.
            */}
            {voltaParaMissao && (
              <div
                className="trilha-da-missao relative shrink-0 px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 text-white overflow-hidden"
                style={{ backgroundColor: voltaParaMissao.cor }}
              >
                <button
                  type="button"
                  onClick={voltarParaAMissao}
                  className="group relative min-w-0 flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-white/15 active:scale-[0.98] transition-all cursor-pointer text-left"
                  title="Voltar para a missão (Esc)"
                  aria-label={`Voltar para a missão ${voltaParaMissao.titulo}`}
                >
                  <span className="w-8 h-8 rounded-lg bg-white/20 group-hover:bg-white group-hover:text-slate-900 flex items-center justify-center shrink-0 transition-colors">
                    <ArrowLeft className="w-4 h-4 stroke-[2.75] transition-transform group-hover:-translate-x-0.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[9.5px] font-black uppercase tracking-[0.14em] text-white/75 leading-none">
                      Voltar para a missão
                    </span>
                    <span className="block text-[13px] font-extrabold leading-tight mt-1 truncate max-w-[42vw] sm:max-w-[360px]">
                      {voltaParaMissao.titulo}
                    </span>
                  </span>
                </button>

                {posicaoNaVolta >= 0 && retornosDaVolta.length > 0 && (
                  <div className="relative ml-auto flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[9.5px] font-black uppercase tracking-[0.14em] text-white/75 leading-none">
                        Retorno
                      </span>
                      <span className="text-[13px] font-extrabold leading-tight mt-1 tabular-nums">
                        {posicaoNaVolta + 1}
                        <span className="text-white/60"> de {retornosDaVolta.length}</span>
                      </span>
                    </div>
                    <span className="sm:hidden text-[12px] font-extrabold tabular-nums">
                      {posicaoNaVolta + 1}/{retornosDaVolta.length}
                    </span>
                    {retornosDaVolta.length > 1 && (
                      <>
                        {/* Um ponto por retorno: dá para pular direto, e se
                            vê de relance quanto falta ler. Acima de oito o
                            colar vira ruído, e fica só o número. */}
                        {retornosDaVolta.length <= 8 && (
                          <div className="hidden md:flex items-center gap-1 px-1">
                            {retornosDaVolta.map((r: any, i: number) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  if (i === posicaoNaVolta) return;
                                  setSentidoDoRetorno(i > posicaoNaVolta ? 1 : -1);
                                  setSelectedCheckInForModal(r);
                                }}
                                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                  i === posicaoNaVolta
                                    ? 'w-5 bg-white'
                                    : 'w-1.5 bg-white/40 hover:bg-white/80'
                                }`}
                                title={r.name}
                                aria-label={`Ver o retorno de ${r.name}`}
                                aria-current={i === posicaoNaVolta}
                              />
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => irParaRetorno(-1)}
                          className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                          title="Retorno anterior (←)"
                          aria-label="Retorno anterior"
                        >
                          <ChevronLeft className="w-4 h-4 stroke-[2.75]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => irParaRetorno(1)}
                          className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                          title="Próximo retorno (→)"
                          aria-label="Próximo retorno"
                        >
                          <ChevronRight className="w-4 h-4 stroke-[2.75]" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Header com tom esmeralda */}
            <div
              className={`px-6 py-4 flex items-center justify-between text-white shadow-md transition-colors duration-500 ${
                selectedCheckInForModal.superFavorite ? 'super-cabecalho' : 'bg-emerald-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-emerald-100 leading-none">Detalhes do Check-in</h3>
                  <p className="text-xs font-semibold text-emerald-50 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {selectedCheckInForModal.mode === 'livre' ? 'Registro Livre (sem missão)' : 'Voluntário Registrado'}
                    {selectedCheckInForModal.superFavorite && (
                      <span className="anim-sobe inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full bg-white text-amber-700 text-[9.5px] font-black uppercase tracking-wider shadow-sm">
                        <Crown className="w-3 h-3" fill="currentColor" />
                        Super Favorito
                      </span>
                    )}
                  </p>
                  {(selectedCheckInForModal.favoriteCategories || []).length > 0 && (
                    <div className="mt-1.5">
                      <SelosDeCategorias
                        claro
                        categorias={categoriasDoCheckIn(
                          categoriasDeFavorito,
                          selectedCheckInForModal.favoriteCategories
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onAlternarCategoriaDoCheckIn && (
                  <button
                    type="button"
                    onClick={(e) => {
                      const botao = e.currentTarget;
                      setAncoraDasCategorias((atual) => (atual ? null : botao));
                    }}
                    className={`relative p-1.5 rounded-full transition-all cursor-pointer ${
                      ancoraDasCategorias ? 'bg-white/25' : 'hover:bg-white/10'
                    }`}
                    title="Categorias: guardar este check-in numa gaveta"
                    aria-label="Categorias do check-in"
                    aria-expanded={!!ancoraDasCategorias}
                  >
                    <Tags className="w-5 h-5" />
                    {(selectedCheckInForModal.favoriteCategories || []).length > 0 && (
                      <span
                        key={(selectedCheckInForModal.favoriteCategories || []).length}
                        className="cat-contador absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-white text-[9px] font-black text-slate-800 flex items-center justify-center shadow"
                      >
                        {(selectedCheckInForModal.favoriteCategories || []).length}
                      </span>
                    )}
                  </button>
                )}
                {ancoraDasCategorias && onAlternarCategoriaDoCheckIn && (
                  <SeletorDeCategorias
                    ancora={ancoraDasCategorias}
                    onFechar={() => setAncoraDasCategorias(null)}
                    categorias={categoriasDeFavorito.filter(
                      c => !c.candidateId || !selectedCheckInForModal.candidateId || c.candidateId === selectedCheckInForModal.candidateId
                    )}
                    selecionadas={selectedCheckInForModal.favoriteCategories || []}
                    onAlternar={(id) => {
                      const novas = onAlternarCategoriaDoCheckIn(selectedCheckInForModal, id);
                      setSelectedCheckInForModal({
                        ...selectedCheckInForModal,
                        favoriteCategories: novas,
                        favorite: novas.length > 0 ? true : selectedCheckInForModal.favorite
                      });
                    }}
                    onCriar={async (dados) => {
                      if (!onCriarCategoria) return null;
                      const nova = await onCriarCategoria(dados, selectedCheckInForModal.candidateId || null);
                      if (nova) {
                        // Criou a partir da ficha: já guarda o check-in nela.
                        const novas = onAlternarCategoriaDoCheckIn(selectedCheckInForModal, nova.id);
                        setSelectedCheckInForModal({
                          ...selectedCheckInForModal,
                          favoriteCategories: novas,
                          favorite: true
                        });
                      }
                      return nova;
                    }}
                    onEditar={(c) => onEditarCategoria?.(c)}
                    onExcluir={(c) => {
                      onExcluirCategoria?.(c);
                      setSelectedCheckInForModal({
                        ...selectedCheckInForModal,
                        favoriteCategories: (selectedCheckInForModal.favoriteCategories || []).filter(id => id !== c.id)
                      });
                    }}
                  />
                )}
                {onToggleCheckInSuperFavorite && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCheckInSuperFavorite(selectedCheckInForModal);
                      const coroa = !selectedCheckInForModal.superFavorite;
                      if (coroa) setCoroaRecemPosta((n) => n + 1);
                      setSelectedCheckInForModal({
                        ...selectedCheckInForModal,
                        superFavorite: coroa,
                        // Coroar também estrela; descoroar deixa a estrela.
                        favorite: coroa ? true : selectedCheckInForModal.favorite
                      });
                    }}
                    className={`relative p-1.5 rounded-full transition-all cursor-pointer ${
                      selectedCheckInForModal.superFavorite
                        ? 'bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-amber-600/40 ring-2 ring-white/70'
                        : 'hover:bg-white/10'
                    }`}
                    title={
                      selectedCheckInForModal.superFavorite
                        ? 'Tirar do Super Favorito (a estrela continua)'
                        : 'Tornar Super Favorito'
                    }
                    aria-label="Super Favorito"
                    aria-pressed={!!selectedCheckInForModal.superFavorite}
                  >
                    <Crown
                      key={coroaRecemPosta}
                      className={`w-5 h-5 ${
                        selectedCheckInForModal.superFavorite && coroaRecemPosta > 0 ? 'super-coroa-pousa' : ''
                      }`}
                      fill={selectedCheckInForModal.superFavorite ? '#fff' : 'none'}
                      color="#fff"
                    />
                    {selectedCheckInForModal.superFavorite && coroaRecemPosta > 0 && (
                      <span key={`o-${coroaRecemPosta}`} className="super-onda" aria-hidden="true" />
                    )}
                  </button>
                )}
                {onToggleCheckInFavorite && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCheckInFavorite(selectedCheckInForModal);
                      // O modal guarda uma cópia: sem isto a estrela só mudaria
                      // no mapa atrás dele.
                      setSelectedCheckInForModal({
                        ...selectedCheckInForModal,
                        favorite: !selectedCheckInForModal.favorite,
                        // Sem estrela, sem coroa e sem categoria.
                        superFavorite: selectedCheckInForModal.favorite
                          ? false
                          : selectedCheckInForModal.superFavorite,
                        favoriteCategories: selectedCheckInForModal.favorite
                          ? []
                          : selectedCheckInForModal.favoriteCategories
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
                      // Veio de uma missão: a lixeira devolve para ela, que é
                      // onde a leitura dos retornos estava acontecendo.
                      if (voltaParaMissao) voltarParaAMissao();
                      else fecharFichaDoCheckIn();
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
                  onClick={fecharFichaDoCheckIn}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo rolável */}
            <div
              key={(selectedCheckInForModal as any).id}
              ref={corpoDoCheckInRef}
              className={`p-6 overflow-y-auto space-y-5 text-left font-sans ${
                sentidoDoRetorno === 1
                  ? 'ficha-vem-da-direita'
                  : sentidoDoRetorno === -1
                    ? 'ficha-vem-da-esquerda'
                    : ''
              }`}
            >

              {/*
                DUAS COLUNAS: QUEM REGISTROU, E O QUE ELE TROUXE.

                A ficha era um tubo: para ver a foto do que a pessoa
                encontrou era preciso rolar por baixo do nome, das
                etiquetas, das operações e do áudio — e a foto é o motivo
                de abrir um check-in. Agora a coluna estreita guarda a
                identificação e o lugar, que se lê de relance, e a larga
                guarda a prova: mídia e observações, que é onde o olho
                precisa ficar.

                Em tela estreita vira uma coluna só, na mesma ordem.
              */}
              <div className="grid gap-5 lg:grid-cols-12 items-start">
                <div className="lg:col-span-5 space-y-5">
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

              {/*
                O VÍNCULO COM A MISSÃO, NA FICHA QUE ABRE PELO MAPA.

                É aqui que se descobre que a pessoa registrou o trabalho sem
                iniciar a missão: o pino foi clicado, a ficha está aberta, e o
                "Registro Livre" está escrito no cabeçalho. Mandar procurar
                outra tela para ligar as duas coisas é cobrar um caminho por um
                dado que já está todo na frente de quem olha.
              */}
              {onVincularCheckInAMissao &&
                (() => {
                  const registro: any = selectedCheckInForModal;
                  const doCliente = (id?: string | null) =>
                    !registro.candidateId || id === registro.candidateId;
                  const missoes = [
                    ...areas
                      .filter((a: any) => doCliente(a.candidateId))
                      .map((a: any) => ({ id: a.id, titulo: a.title, tipo: 'Área' })),
                    ...pins
                      .filter((p: any) => doCliente(p.candidateId))
                      .map((p: any) => ({ id: p.id, titulo: p.title, tipo: 'Ponto' }))
                  ];
                  const atual = registro.missionId || '';

                  /** Grava e deixa a ficha aberta já contando a verdade nova. */
                  const escolher = (
                    missao: { id: string; titulo: string } | null
                  ) => {
                    onVincularCheckInAMissao(registro, missao);
                    setSelectedCheckInForModal({
                      ...registro,
                      mode: missao ? 'missao' : 'livre',
                      missionId: missao?.id,
                      missionTitle: missao?.titulo
                    } as any);
                    setEscolhendoMissaoNaFicha(false);
                  };

                  if (atual) {
                    return (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[9.5px] font-black uppercase tracking-widest text-emerald-700">
                            Missão vinculada
                          </p>
                          <p className="text-[12.5px] font-bold text-slate-800 truncate leading-tight mt-0.5">
                            {registro.missionTitle ||
                              missoes.find((m) => m.id === atual)?.titulo ||
                              'Missão'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => escolher(null)}
                          className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-rose-600 cursor-pointer transition-colors shrink-0"
                        >
                          Desvincular
                        </button>
                      </div>
                    );
                  }

                  if (!escolhendoMissaoNaFicha) {
                    return (
                      <button
                        type="button"
                        onClick={() => setEscolhendoMissaoNaFicha(true)}
                        className="h-10 w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
                      >
                        <Target className="w-3.5 h-3.5 text-emerald-600" />
                        Vincular a missão
                      </button>
                    );
                  }

                  return (
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black text-slate-500">
                          Vincular a missão
                        </p>
                        <button
                          type="button"
                          onClick={() => setEscolhendoMissaoNaFicha(false)}
                          className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                      <select
                        autoFocus
                        value=""
                        onChange={(e) => {
                          const alvo = missoes.find((m) => m.id === e.target.value);
                          escolher(alvo ? { id: alvo.id, titulo: alvo.titulo } : null);
                        }}
                        className="mt-2 w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 cursor-pointer focus:outline-hidden"
                      >
                        <option value="">Registro livre (sem missão)</option>
                        {missoes.map((missao) => (
                          <option key={missao.id} value={missao.id}>
                            {missao.tipo} · {missao.titulo}
                          </option>
                        ))}
                      </select>
                      {missoes.length === 0 && (
                        <p className="mt-1.5 text-[10.5px] font-semibold text-slate-400 leading-snug">
                          Esta campanha ainda não tem missão cadastrada para
                          vincular.
                        </p>
                      )}
                    </div>
                  );
                })()}

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

                <div className="lg:col-span-7 space-y-5">
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

                // O mesmo visor da missão: clicar abre no meio da tela, por
                // cima de tudo, em vez de espremer a foto do buraco na rua
                // num quadradinho da ficha.
                midiasDoCheckInRef.current = media.map((item, index) => ({
                  id: `checkin-midia-${index}`,
                  tipo: item.type === 'video' ? ('video' as const) : ('imagem' as const),
                  url: item.url,
                  nome: `${item.type === 'video' ? 'Vídeo' : 'Foto'} ${index + 1} do check-in`
                }));

                return (
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                      Fotos e vídeos{media.length > 0 ? ` (${media.length})` : ''}
                    </p>
                    {media.length > 0 ? (
                      /*
                        Grade sempre, e altura igual para todas.
                        Com `max-h` cada foto terminava numa altura diferente e
                        a coluna virava um mosaico irregular — o olho gasta na
                        borda o que devia gastar no conteúdo. Uma sozinha ocupa
                        a linha inteira, que é o maior que ela pode ser aqui.
                      */
                      <div className="grid grid-cols-2 gap-3">
                        {media.map((item, index) => (
                          <button
                            key={`${item.url}-${index}`}
                            type="button"
                            onClick={() => setMidiaDoCheckInAberta(index)}
                            title="Abrir em tela cheia"
                            className={`group border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 relative cursor-pointer transition-all hover:border-slate-300 hover:shadow-lg active:scale-[0.99] aspect-4/3 ${
                              media.length === 1 ? 'col-span-2' : ''
                            }`}
                          >
                            {item.type === 'video' ? (
                              <video
                                src={item.url}
                                playsInline
                                muted
                                preload="metadata"
                                className="w-full h-full object-cover bg-black"
                              />
                            ) : (
                              <img
                                referrerPolicy="no-referrer"
                                src={item.url}
                                alt="Arquivo anexado ao check-in"
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03] animate-in fade-in duration-500"
                              />
                            )}
                            <span
                              className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                                item.type === 'video'
                                  ? 'bg-black/30'
                                  : 'bg-slate-900/30 opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <span className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-md">
                                {item.type === 'video' ? (
                                  <Play className="w-4 h-4 text-slate-800 fill-slate-800" />
                                ) : (
                                  <Maximize2 className="w-4 h-4 text-slate-800" />
                                )}
                              </span>
                            </span>
                          </button>
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
                </div>
              </div>


            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              {voltaParaMissao && (
                <>
                  <span className="hidden md:inline text-[10.5px] font-semibold text-slate-400 mr-auto">
                    <kbd className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-[10px] font-black text-slate-500">Esc</kbd>{' '}
                    volta para a missão
                    {retornosDaVolta.length > 1 && (
                      <>
                        {' · '}
                        <kbd className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-[10px] font-black text-slate-500">←</kbd>{' '}
                        <kbd className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-[10px] font-black text-slate-500">→</kbd>{' '}
                        passam de retorno
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={voltarParaAMissao}
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-extrabold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.75]" style={{ color: voltaParaMissao.cor }} />
                    Voltar para a missão
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={fecharFichaDoCheckIn}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
        O RELATÓRIO DO NEO.

        Fica no fim, e fora de qualquer modal, porque ele mesmo se desenha num
        portal para o body: precisa poder cobrir a ficha da missão e, na hora
        de imprimir, ser o único filho visível do documento.
      */}
      <RelatorioNeo
        aberto={relatorioAberto}
        carregando={relatorioCarregando}
        erro={relatorioErro}
        relatorio={relatorio}
        pecas={pecasDoRelatorio}
        missaoTitulo={missaoDoRelatorio?.titulo || ''}
        guardado={relatorioGuardado}
        salvando={salvandoRelatorio}
        onSalvar={guardarRelatorioDoNeo}
        onFechar={() => setRelatorioAberto(false)}
        onTentarDeNovo={() => {
          if (missaoDoRelatorio?.dados) pedirRelatorioDoNeo(missaoDoRelatorio.dados, true);
        }}
      />
    </div>
  );
}
