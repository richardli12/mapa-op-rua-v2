import React, { FormEvent, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { candidateLocationText } from '../services/candidateLocation';
import { buscarLugares, LugarEncontrado } from '../services/buscaNoMapa';
import FichaEstabelecimento from './FichaEstabelecimento';
import { Estabelecimento } from '../services/estabelecimentos';
import { DatabaseService } from '../databaseClient';
import { Search, X, MapPin, Loader2, Compass, ChevronDown, ChevronUp, Check, Building2, Layers, Calendar, Clock, User, Navigation, MessageSquare, Mic, Flag, Ruler, Undo2, Trash2, Star, Users, FileText, Pencil, CircleDot, Play, Maximize2 } from 'lucide-react';
import { PanfletagemArea, CampaignPin, CheckIn, Candidate, OperationType, PriorityLevel, Escola, MaterialDeApoio, corDaDependencia, getCheckInPriority } from '../types';
import {
  VisorDoMaterial,
  formatoDoMaterial,
  rotuloDoMaterial
} from './MaterialDaMissao';
import { EtiquetaDePrioridade, EtiquetaDeTurno } from './TurnoEPrioridade';
import { JanelaDeTurno, TURNOS_PADRAO, TurnoId } from '../turnos';
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
  }[];
  /** Faixas da escala de cor, do mais claro ao mais escuro. */
  escalaTerritorial?: { corte: number; cor: string }[];
  recorteEmFoco?: string | null;
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
  mapFilter?: 'all' | 'checkins' | 'markers' | 'favoritos' | 'nada';
  onMapFilterChange?: (filter: 'all' | 'checkins' | 'markers' | 'favoritos' | 'nada') => void;
  /** Liga ou desliga a estrela de um check-in, direto do mapa. */
  onToggleCheckInFavorite?: (checkIn: CheckIn) => void;
  /** Exclusão do check-in pelo administrador, direto do mapa. */
  onDeleteCheckIn?: (checkIn: CheckIn) => void;
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
}) => {
  const { cor, iconeChave, destacado, pessoas, temMaterial, prazoVencendo } = opcoes;
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
      <div class="pino-missao${destacado ? ' pino-missao--ativa' : ''}"
           style="--cor:${cor};--tamanho:${tamanho}px;--borda:${borda}px">
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
  desenhandoRaioDeBusca,
  onRaioDeBuscaDesenhado,
  recortesTerritoriais,
  escalaTerritorial,
  recorteEmFoco,
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
  onDeleteCheckIn,
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
  const lojasGroupRef = useRef<L.LayerGroup | null>(null);
  const analiseGroupRef = useRef<L.LayerGroup | null>(null);
  const buscaGroupRef = useRef<L.LayerGroup | null>(null);
  /** O aviso de raio desenhado, sempre o atual, lido de dentro do gesto. */
  const aoDesenharRaioDeBuscaRef = useRef(onRaioDeBuscaDesenhado);
  aoDesenharRaioDeBuscaRef.current = onRaioDeBuscaDesenhado;
  const recortesGroupRef = useRef<L.LayerGroup | null>(null);
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
  const [localMapFilter, setLocalMapFilter] = useState<'all' | 'checkins' | 'markers' | 'favoritos' | 'nada'>('all');
  const mapFilter = propMapFilter !== undefined ? propMapFilter : localMapFilter;
  const setMapFilter = onMapFilterChange !== undefined ? onMapFilterChange : setLocalMapFilter;
  const [selectedCheckInForModal, setSelectedCheckInForModal] = useState<CheckIn | null>(null);
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
    const lojasGroup = L.layerGroup().addTo(map);
    const analiseGroup = L.layerGroup().addTo(map);
    const recortesGroup = L.layerGroup().addTo(map);
    const delimitationGroup = L.layerGroup().addTo(map);

    circlesGroupRef.current = circlesGroup;
    pinsGroupRef.current = pinsGroup;
    tempGroupRef.current = tempGroup;
    checkInsGroupRef.current = checkInsGroup;
    escolasGroupRef.current = escolasGroup;
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
      pessoas: equipeDaMissao(ids),
      totalDesignados: ids.length,
      raio: area.radius,
      bairro: area.bairro || '',
      responsavel: area.contactName || '',
      voluntarios: area.teamSize || 0
    };
  }, [missaoAbertaRef, pins, areas, operationTypes, equipe]);

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

    if (mapFilter === 'checkins' || mapFilter === 'favoritos' || mapFilter === 'nada') {
      return;
    }

    areas.forEach(area => {
      // Em edição: quem aparece no lugar dela é o fantasma arrastável.
      if (itemEmEdicaoId && area.id === itemEmEdicaoId) return;

      const isSelected = area.id === selectedId || missaoAbertaRef?.id === area.id;

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

      const abrirFicha = (e: any) => {
        L.DomEvent.stopPropagation(e);
        setMissaoAbertaRef({ id: area.id, tipo: 'area' });
      };
      circle.on('click', abrirFicha);

      // Add a small center point marker to make it clickable and visible
      const centerMarker = L.circleMarker([area.center.lat, area.center.lng], {
        radius: isSelected ? 8 : 5,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillColor: area.color,
        fillOpacity: 1
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
    });
  }, [areas, selectedId, mapFilter, itemEmEdicaoId, equipe, missaoAbertaRef]);

  // Render Pins
  useEffect(() => {
    const pinsGroup = pinsGroupRef.current;
    const map = mapRef.current;
    if (!pinsGroup || !map) return;

    pinsGroup.clearLayers();

    if (mapFilter === 'checkins' || mapFilter === 'favoritos' || mapFilter === 'nada') {
      return;
    }

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

      const customIcon = construirPinoDeMissao({
        cor: pin.color,
        iconeChave: operationType?.icon || pin.iconType,
        destacado: isSelected,
        pessoas: designados.length,
        temMaterial: material.length > 0,
        prazoVencendo: prazoApertado(pin.date)
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
  }, [pins, selectedId, mapFilter, operationTypes, itemEmEdicaoId, equipe, missaoAbertaRef]);

  // Render Check-ins
  useEffect(() => {
    const checkInsGroup = checkInsGroupRef.current;
    const map = mapRef.current;
    if (!checkInsGroup || !map) return;

    checkInsGroup.clearLayers();

    if (mapFilter === 'markers' || mapFilter === 'nada') {
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
      const etiqueta = isFree
        ? `⚠️ Check-in livre${priority ? ` • Prioridade ${priority.label}` : ''}`
        : '✅ Check-in de voluntário';

      marker.bindTooltip(`
        <div class="font-sans min-w-[190px] max-w-[250px]">
          <div class="balao-missao__faixa" style="height:4px;background:${markerColor}"></div>
          <div class="px-3 py-2.5">
            <p class="font-black uppercase tracking-wider text-[9px] leading-none" style="color:${markerColor}">${etiqueta}</p>
            <p class="font-bold text-slate-900 text-[13px] leading-tight mt-1">${escaparHtml(checkIn.name)}</p>
            <div class="mt-1.5 space-y-0.5">
              <p class="text-[10.5px] text-slate-500 font-semibold leading-snug">📍 ${escaparHtml([checkIn.rua, checkIn.bairro].filter(Boolean).join(', ') || 'Sem endereço')}</p>
              <p class="text-[10.5px] text-slate-500 font-semibold leading-snug">🕒 ${dateText}</p>
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
   * 3. **Um clique é uma pergunta.** Clicar num bairro abre o Censo dele, que
   *    é o passo seguinte natural de quem reparou na cor.
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
    /** Cor da faixa em que o valor cai. Sem dado tem cor própria. */
    const corDe = (valor: number | null) => {
      if (valor === null || valor === undefined) return '#CBD5E1';
      const faixa = escala.find((f) => valor <= f.corte);
      return faixa?.cor || escala[escala.length - 1]?.cor || '#1E3A8A';
    };

    const limites: any[] = [];

    recortes.forEach((recorte) => {
      if (!recorte.geometria) return;
      const semDado = recorte.valor === null || recorte.valor === undefined;
      const emFoco = recorteEmFoco === recorte.id;

      const camada = L.geoJSON(
        { type: 'Feature', properties: {}, geometry: recorte.geometria } as any,
        {
          style: {
            color: emFoco ? '#0F172A' : '#1E293B',
            weight: emFoco ? 2.5 : recorte.tipo === 'setor' ? 0.6 : 1,
            opacity: emFoco ? 0.9 : 0.45,
            fillColor: corDe(recorte.valor),
            // Transparente de propósito: a mancha é contexto, e o que está
            // embaixo dela continua sendo o trabalho.
            fillOpacity: semDado ? 0.25 : emFoco ? 0.72 : 0.55,
            dashArray: semDado ? '4, 4' : undefined
          }
        }
      );

      camada.bindTooltip(
        `<div class="px-2.5 py-1.5 font-sans min-w-[130px]">
           <p class="font-bold text-slate-900 text-[12px] leading-tight">${recorte.nome}</p>
           <p class="text-[10px] text-slate-500 font-semibold mt-0.5 leading-snug">${recorte.resumo}</p>
         </div>`,
        { sticky: true, direction: 'top' }
      );

      camada.on('mouseover', () => onRecorteSobOCursor?.(recorte.id));
      camada.on('mouseout', () => onRecorteSobOCursor?.(null));
      camada.on('click', () => onRecorteClicado?.(recorte.id));

      grupo.addLayer(camada);
      recortesPorIdRef.current[recorte.id] = camada;
      limites.push(camada.getBounds());
    });

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
  }, [recortesTerritoriais, escalaTerritorial, recorteEmFoco]);

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

    const centro = L.latLng(circuloAnalisado.lat, circuloAnalisado.lng);

    L.circle(centro, {
      radius: circuloAnalisado.raio,
      color: '#059669',
      weight: 2,
      opacity: 0.9,
      dashArray: '6, 6',
      fillColor: '#10B981',
      fillOpacity: 0.08,
      interactive: false
    }).addTo(grupo);

    L.marker(centro, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: '',
        html:
          '<span style="display:block;width:12px;height:12px;border-radius:50%;' +
          'background:#059669;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    })
      .addTo(grupo)
      .bindTooltip(
        `Área analisada · raio de ${
          circuloAnalisado.raio >= 1000
            ? `${circuloAnalisado.raio / 1000} km`
            : `${circuloAnalisado.raio} m`
        }`,
        { permanent: true, direction: 'top', offset: [0, -10], className: 'medida-raio' }
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
    if (!circuloDeBusca) return;

    const centro = L.latLng(circuloDeBusca.lat, circuloDeBusca.lng);

    L.circle(centro, {
      radius: circuloDeBusca.raio,
      color: '#015FC9',
      weight: 2,
      opacity: 0.9,
      fillColor: '#015FC9',
      fillOpacity: 0.07,
      interactive: false
    }).addTo(grupo);

    L.marker(centro, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: '',
        html:
          '<span style="display:block;width:12px;height:12px;border-radius:50%;' +
          'background:#015FC9;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    })
      .addTo(grupo)
      .bindTooltip(
        `Busca · ${
          circuloDeBusca.raio >= 1000
            ? `${(circuloDeBusca.raio / 1000).toFixed(1).replace('.0', '')} km`
            : `${Math.round(circuloDeBusca.raio)} m`
        }`,
        { permanent: true, direction: 'top', offset: [0, -10], className: 'medida-raio' }
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
        className: `pino-escola${emFoco ? ' pino-escola--foco' : ''}`,
        html:
          `<span style="--tamanho:${tamanho}px;--cor:${cor};display:block;` +
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
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
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

            <div className="p-6 overflow-y-auto space-y-5 text-left font-sans">
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
                    <span className="text-[11px] font-extrabold text-slate-700">
                      {missaoAberta.criadaEm
                        ? new Date(missaoAberta.criadaEm).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })
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
                      Fotos e vídeos{media.length > 1 ? ` (${media.length})` : ''}
                    </p>
                    {media.length > 0 ? (
                      <div className={media.length > 1 ? 'grid grid-cols-2 gap-2.5' : ''}>
                        {media.map((item, index) => (
                          <button
                            key={`${item.url}-${index}`}
                            type="button"
                            onClick={() => setMidiaDoCheckInAberta(index)}
                            title="Abrir em tela cheia"
                            className="group shadow-inner border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center relative cursor-pointer transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.98]"
                          >
                            {item.type === 'video' ? (
                              <video
                                src={item.url}
                                playsInline
                                muted
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
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
