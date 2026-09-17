/**
 * Ficha do aparelho de quem está usando o sistema.
 *
 * Serve a dois propósitos: dar ao administrador de onde partiu cada cadastro e
 * prender o acesso ao painel ao aparelho em que a pessoa se cadastrou.
 *
 * Nada aqui é secreto do ponto de vista do navegador — são as respostas que
 * ele mesmo dá a qualquer página. Os dois valores que poderiam identificar a
 * pessoa são tratados à parte: o identificador do cookie só chega ao banco em
 * forma de hash, e o IP público nunca sai do servidor — de lá vem apenas um
 * HMAC, e mesmo assim só quando DEVICE_IP_HMAC_KEY está configurada.
 */

export interface FichaDispositivo {
  deviceType: 'celular' | 'tablet' | 'computador';
  browser: string;
  os: string;
  platform: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  languages: string[];
  touchPoints: number;
  accessedAt: string;
  /** Hash do identificador aleatório guardado no cookie deste navegador. */
  deviceIdHash: string;
  /** Impressão dos sinais estáveis: é ela que reconhece o aparelho. */
  fingerprint: string;
  /** HMAC do IP público, quando o servidor está configurado para calculá-lo. */
  ipHash: string | null;
}

const COOKIE = 'mo_did';
const UM_ANO = 60 * 60 * 24 * 365;

const sha256 = async (texto: string) => {
  if (!crypto?.subtle) {
    // Navegador sem WebCrypto (ou página fora de HTTPS): soma simples, que não
    // é hash de verdade, mas mantém o valor cru fora do banco.
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
    return `fraco_${(h >>> 0).toString(16)}`;
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const lerCookie = (nome: string) => {
  const achado = document.cookie
    .split(';')
    .map(p => p.trim())
    .find(p => p.startsWith(`${nome}=`));
  return achado ? decodeURIComponent(achado.slice(nome.length + 1)) : '';
};

/**
 * Identificador aleatório deste navegador.
 *
 * Fica no cookie, não no localStorage: o cookie sobrevive a mais situações e
 * pode ser lido pelo servidor no futuro, se precisar. O valor em si nunca vai
 * para o banco — lá entra só o hash.
 */
const identificadorLocal = () => {
  let id = lerCookie(COOKIE);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const seguro = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Max-Age=${UM_ANO}; Path=/; SameSite=Lax${seguro}`;
  }
  return id;
};

const tipoDoAparelho = (ua: string): FichaDispositivo['deviceType'] => {
  const toques = navigator.maxTouchPoints || 0;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet';
  }
  // iPadOS recente se apresenta como Mac: o que o entrega é a tela sensível.
  if (/Macintosh/i.test(ua) && toques > 1) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'celular';
  return 'computador';
};

const navegador = (ua: string) => {
  const marcas = (navigator as any).userAgentData?.brands as
    | { brand: string; version: string }[]
    | undefined;
  const conhecida = marcas?.find(
    m => !/Not.?A.?Brand|Chromium/i.test(m.brand)
  )?.brand;
  if (conhecida) return conhecida;

  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/CriOS/i.test(ua)) return 'Chrome';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Desconhecido';
};

const sistema = (ua: string) => {
  if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac OS X/i.test(ua)) return navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Desconhecido';
};

/** Pergunta ao servidor o HMAC do IP público. Sem rota ou sem chave, devolve nulo. */
const hmacDoIp = async (): Promise<string | null> => {
  try {
    const resposta = await fetch('/api/dispositivo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return dados?.ipHash || null;
  } catch {
    // Ambiente sem a rota (desenvolvimento, hospedagem estática): segue sem.
    return null;
  }
};

/** Monta a ficha completa do aparelho que está com a página aberta. */
export const lerDispositivo = async (): Promise<FichaDispositivo> => {
  const ua = navigator.userAgent || '';
  const tela = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const idiomas = Array.from(navigator.languages || [navigator.language || '']);
  const toques = navigator.maxTouchPoints || 0;
  const plataforma =
    (navigator as any).userAgentData?.platform || navigator.platform || '';
  const tipo = tipoDoAparelho(ua);
  const nomeNavegador = navegador(ua);
  const nomeSistema = sistema(ua);

  // A impressão usa só o que não muda a cada atualização do navegador: versão
  // nova do Chrome não pode transformar o aparelho da pessoa em outro.
  const [deviceIdHash, fingerprint, ipHash] = await Promise.all([
    sha256(identificadorLocal()),
    sha256(
      [tipo, nomeNavegador, nomeSistema, plataforma, tela, fuso, idiomas[0] || '', toques].join(
        '|'
      )
    ),
    hmacDoIp()
  ]);

  return {
    deviceType: tipo,
    browser: nomeNavegador,
    os: nomeSistema,
    platform: plataforma,
    userAgent: ua,
    screenResolution: tela,
    timezone: fuso,
    language: idiomas[0] || '',
    languages: idiomas,
    touchPoints: toques,
    accessedAt: new Date().toISOString(),
    deviceIdHash,
    fingerprint,
    ipHash
  };
};
