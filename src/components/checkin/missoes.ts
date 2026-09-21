import { PriorityLevel } from '../../types';
import { MissaoDoCampo } from './tipos';

/**
 * As contas em volta de uma missão do comitê.
 *
 * Tudo aqui responde a uma pergunta que alguém na rua faz em voz alta: qual é
 * a mais grave, esta já foi feita, quão longe fica, quanto tempo leva a pé e
 * como eu chego lá.
 */

/**
 * O nível mais grave da régua do cliente.
 *
 * A régua é a do administrador e a ordem dela é que manda: quanto maior a
 * posição, mais grave. O topo é o que o sistema inteiro já trata como o pior
 * caso — a Sala de situação conta os dois de cima como "graves", e aqui o
 * primeiro deles é o que tranca a rua.
 *
 * Sem nível nenhum cadastrado sobra o padrão que o sistema traz de fábrica, e
 * nele o topo se chama `urgente`. Sem isso, uma campanha que nunca abriu a
 * tela de configuração jamais teria ordem urgente.
 */
export const nivelDoTopo = (niveis: PriorityLevel[]): string | null => {
  if (niveis.length === 0) return 'urgente';
  return [...niveis].sort((a, b) => b.position - a.position)[0]?.id ?? null;
};

/** Esta missão está no topo da régua? */
export const eUrgente = (missao: MissaoDoCampo, topo: string | null) =>
  !!topo && !!missao.priority && missao.priority === topo;

const diaISO = (data: Date) => data.toLocaleDateString('sv-SE');

/**
 * A missão já foi cumprida hoje por esta pessoa?
 *
 * É a pergunta que impede a ordem urgente de virar uma armadilha. Sem ela, a
 * pessoa cumpre a ordem, grava o check-in e continua trancada — sem poder
 * fazer mais nada no resto do dia, porque a missão continua atribuída a ela.
 *
 * O recorte é o dia, e não "alguma vez": missão de campanha se repete, e a
 * ordem de hoje não foi cumprida pelo check-in de ontem. Rascunho não conta —
 * o que vale é o registro confirmado.
 */
export const cumpridaHoje = (missao: MissaoDoCampo, meusCheckIns: any[]) => {
  const hoje = diaISO(new Date());
  return meusCheckIns.some(c => {
    if ((c.missionId || c.mission_id) !== missao.id) return false;
    if (c.status === 'rascunho') return false;
    const d = new Date(c.createdAt);
    return !Number.isNaN(d.getTime()) && diaISO(d) === hoje;
  });
};

/** Distância em metros entre dois pontos, para dizer o quão longe é a missão. */
export const distanciaEmMetros = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) => {
  const R = 6371000;
  const rad = (grau: number) => (grau * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Metro vira quilômetro quando a conta fica comprida demais para a rua. */
export const distanciaCurta = (metros: number) =>
  metros < 1000
    ? `${Math.round(metros)} m`
    : `${(metros / 1000).toFixed(1).replace('.', ',')} km`;

/**
 * Quanto tempo a pé, em minutos.
 *
 * A conta é de caminhada de trabalho — 4,9 km/h, colete e sacola na mão —, e
 * não a do aplicativo de corrida. "1,2 km" é um número; "15 min daqui" é a
 * informação que decide se dá para ir andando ou se é hora de chamar o carro.
 */
export const minutosAPe = (metros: number) => Math.max(1, Math.round(metros / 81));

export const tempoAPeCurto = (metros: number) => {
  const min = minutosAPe(metros);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h} h` : `${h}h${String(resto).padStart(2, '0')}`;
};

/**
 * A pessoa já está no lugar da missão?
 *
 * Dentro da área desenhada, ou a menos de sessenta metros do ponto — que é a
 * margem de erro de um GPS de celular entre prédios. Missão sem local está
 * sempre "no lugar": o lugar dela é onde a pessoa estiver.
 */
export const jaChegou = (
  missao: MissaoDoCampo,
  coords: { lat: number; lng: number } | null
) => {
  if (missao.semLocal) return true;
  if (!coords) return false;
  const longe = distanciaEmMetros(coords, missao);
  return missao.raio ? longe <= missao.raio : longe <= 60;
};

/**
 * O endereço que abre a rota no Google Maps.
 *
 * `dir/?api=1` é o endereço universal do Google: no celular com o aplicativo
 * instalado ele abre o aplicativo, e no resto abre o site. A pé, porque é
 * assim que a rua é feita — e quem for de carro troca com um toque lá dentro.
 */
export const linkDeRota = (missao: MissaoDoCampo) =>
  `https://www.google.com/maps/dir/?api=1&destination=${missao.lat},${missao.lng}&travelmode=walking`;

/**
 * A pessoa pode iniciar esta missão daqui?
 *
 * Missão é trabalho no lugar certo: iniciar do sofá, do carro a dois
 * quilômetros ou da casa de outro bairro é registro de presença que não
 * houve. Então a tela só libera o começo quando o aparelho concorda que ela
 * chegou.
 *
 * A margem não é fixa, e não pode ser. Entre prédios o GPS erra dezenas de
 * metros, e quem está de pé na porta certa não pode ouvir que está a oitenta
 * metros de si mesmo. Por isso o erro que o próprio aparelho declara entra na
 * conta — com teto, para uma leitura ruim de quinhentos metros não liberar a
 * cidade inteira.
 *
 * Missão sem local no mapa não tem trava: o lugar dela é onde a pessoa
 * estiver.
 */
export interface Chegada {
  /** Dá para iniciar agora. */
  pode: boolean;
  /** Sem lugar no mapa: a missão acontece onde a pessoa estiver. */
  semLocal: boolean;
  /** Distância até o ponto, ou nulo enquanto o GPS não respondeu. */
  distancia: number | null;
  /** Quanto ainda falta andar para a trava abrir. */
  faltam: number;
  /** A margem que está valendo, já somado o erro do aparelho. */
  limite: number;
}

export const FOLGA_MAXIMA_DO_GPS = 150;

export const situacaoDeChegada = (
  missao: MissaoDoCampo,
  coords: { lat: number; lng: number } | null,
  precisao: number | null
): Chegada => {
  if (missao.semLocal) {
    return { pode: true, semLocal: true, distancia: null, faltam: 0, limite: 0 };
  }
  const base = missao.raio || 60;
  const folga = Math.min(FOLGA_MAXIMA_DO_GPS, Math.max(0, precisao ?? 0));
  const limite = base + folga;
  if (!coords) {
    return { pode: false, semLocal: false, distancia: null, faltam: 0, limite };
  }
  const distancia = distanciaEmMetros(coords, missao);
  return {
    pode: distancia <= limite,
    semLocal: false,
    distancia,
    faltam: Math.max(0, Math.round(distancia - limite)),
    limite
  };
};
