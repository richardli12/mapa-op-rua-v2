/**
 * Biblioteca de ícones dos Tipos de Operação.
 *
 * O mesmo desenho é usado em dois lugares muito diferentes: dentro do React
 * (painel lateral, formulários) e dentro do HTML cru que o Leaflet injeta no
 * marcador do mapa. Por isso cada ícone mora aqui como uma string de SVG, e
 * não como um componente — assim os dois lados desenham exatamente a mesma
 * figura, sem duas listas para manter em sincronia.
 */

export interface OperationIconDef {
  /** Chave gravada no banco junto do tipo de operação. */
  key: string;
  /** Nome em português exibido no seletor de ícones. */
  label: string;
  /** Miolo do SVG (viewBox 0 0 24 24). */
  body: string;
  /** Quando verdadeiro o desenho é feito por traço, não por preenchimento. */
  stroked?: boolean;
}

export const OPERATION_ICONS: OperationIconDef[] = [
  {
    key: 'flag',
    label: 'Bandeira',
    body: '<path d="M5 21V4.4a1.2 1.2 0 0 1 1-1.2A10.8 10.8 0 0 1 12 5a10.8 10.8 0 0 0 6-1.8 1.2 1.2 0 0 1 2 1v10.2a1.2 1.2 0 0 1-1 1.2 10.8 10.8 0 0 1-6-1.8 10.8 10.8 0 0 0-6 1.8"/><path d="M5 21H3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  },
  {
    key: 'megaphone',
    label: 'Megafone',
    stroked: true,
    body: '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 0 1-5.8-1.6"/>'
  },
  {
    key: 'star',
    label: 'Estrela',
    body: '<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>'
  },
  {
    key: 'group',
    label: 'Equipe',
    stroked: true,
    body: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  },
  {
    key: 'home',
    label: 'Residência',
    body: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>'
  },
  {
    key: 'sound',
    label: 'Som',
    stroked: true,
    body: '<path d="M12 2v20c-1.5 0-3-2.5-3-5.5s1.5-5.5 3-5.5V2z"/><path d="M18 8a6 6 0 0 1 0 8"/>'
  },
  {
    key: 'target',
    label: 'Alvo',
    stroked: true,
    body: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
  },
  {
    key: 'truck',
    label: 'Veículo',
    stroked: true,
    body: '<path d="M14 17V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1"/><path d="M13 17H9"/><path d="M19 18h1a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3-3.5a1 1 0 0 0-.8-.3H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
  },
  {
    key: 'wrench',
    label: 'Manutenção',
    stroked: true,
    body: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
  },
  {
    key: 'alert',
    label: 'Alerta',
    stroked: true,
    body: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  },
  {
    key: 'heart',
    label: 'Saúde / Social',
    body: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/>'
  },
  {
    key: 'building',
    label: 'Prédio / Sede',
    stroked: true,
    body: '<rect width="15" height="19" x="4.5" y="2.5" rx="2"/><path d="M9.5 21.5v-4h5v4"/><path d="M9 7h.5M14.5 7h.5M9 11h.5M14.5 11h.5"/>'
  },
  {
    key: 'camera',
    label: 'Registro / Foto',
    stroked: true,
    body: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'
  },
  {
    key: 'shield',
    label: 'Segurança',
    body: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
  },
  {
    key: 'package',
    label: 'Materiais',
    stroked: true,
    body: '<path d="m7.5 4.3 9 5.1"/><path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'
  },
  {
    key: 'calendar',
    label: 'Agenda',
    stroked: true,
    body: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'
  },
  {
    key: 'briefcase',
    label: 'Atendimento',
    stroked: true,
    body: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'
  },
  {
    key: 'zap',
    label: 'Urgência',
    body: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>'
  },
  {
    key: 'pin',
    label: 'Ponto genérico',
    body: '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>'
  }
];

const ICONS_BY_KEY = new Map(OPERATION_ICONS.map((icon) => [icon.key, icon]));

export const DEFAULT_OPERATION_ICON = 'pin';

export function getOperationIconDef(key?: string): OperationIconDef {
  return (
    (key ? ICONS_BY_KEY.get(key) : undefined) ||
    ICONS_BY_KEY.get(DEFAULT_OPERATION_ICON)!
  );
}

/**
 * Monta o SVG completo do ícone, pronto para ir ao DOM.
 * A cor vem sempre de `currentColor`, então quem desenha decide o tom.
 */
export function buildOperationIconSvg(key?: string, size = 16): string {
  const icon = getOperationIconDef(key);
  const paint = icon.stroked
    ? 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'
    : 'fill="currentColor"';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${paint} width="${size}" height="${size}">${icon.body}</svg>`;
}
