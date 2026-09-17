/**
 * Endereco base das imagens do sistema (logos, marca, avatares padrao).
 *
 * Fica num lugar so de proposito: o endereco carrega o dominio de quem hospeda
 * os arquivos, e dominio aparece no HTML da pagina, no inspetor do navegador e
 * em qualquer "salvar imagem como". Apontar VITE_MEDIA_BASE_URL para um
 * dominio proprio (um CDN ou um proxy no dominio do sistema) tira esse nome de
 * toda a interface de uma vez, sem caçar URL espalhada pelo codigo.
 */
const FALLBACK_BASE =
  'https://dwglbabfqopddrqwddmb.supabase.co/storage/v1/object/public/imagens';

const MARCA_FALLBACK_BASE =
  'https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/imagens';

const base = (
  (import.meta as any).env?.VITE_MEDIA_BASE_URL || FALLBACK_BASE
).replace(/\/$/, '');

const marcaBase = (
  (import.meta as any).env?.VITE_BRAND_MEDIA_BASE_URL || MARCA_FALLBACK_BASE
).replace(/\/$/, '');

/** Arquivo de imagem do sistema. */
export const mediaUrl = (arquivo: string) => `${base}/${arquivo}`;

/** Arquivo da marca (logo do topo e da tela de login). */
export const brandUrl = (arquivo: string) => `${marcaBase}/${arquivo}`;

export const PARTY_LOGOS: Record<string, string> = {
  SD: mediaUrl('SD_LOGO.png'),
  PP: mediaUrl('PP_LOGO.png'),
  PL: mediaUrl('PL_LOGO.png'),
  PT: mediaUrl('PT_LOGO.png'),
};

/**
 * Logo do sistema, usada no topo do painel, no login e na marca do chat.
 *
 * Endereco proprio, fora do padrao dos demais arquivos, porque a marca vive
 * num bucket separado do restante das imagens.
 */
export const BRAND_LOGO =
  (import.meta as any).env?.VITE_BRAND_LOGO_URL ||
  'https://zpfhqweydlujotqbuwse.supabase.co/storage/v1/object/public/imagem_url/img.png';
export const CHECKIN_COVER = mediaUrl(
  'ChatGPT%20Image%2017%20de%20jun.%20de%202026,%2016_27_00.png',
);
