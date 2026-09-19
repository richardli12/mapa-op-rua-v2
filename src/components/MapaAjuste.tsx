import { useEffect, useRef } from 'react';
import { Crosshair } from 'lucide-react';

interface Gps {
  lat: number;
  lng: number;
  accuracy: number | null;
}

interface MapaAjusteProps {
  /** Posição real do aparelho: ponto azul + círculo de precisão. */
  gps: Gps | null;
  /** Centro usado quando o mapa nasce. */
  centroInicial: { lat: number; lng: number };
  /** Enquanto verdadeiro, uma leitura melhor do GPS recentraliza o mapa. */
  seguirGps: boolean;
  /** Tiles prontos: só aí o passo libera a confirmação. */
  onReady?: () => void;
  /** Movimento começou (arrasto ou recentralização): endereço vai mudar. */
  onMoverInicio: () => void;
  /** A pessoa arrastou com o dedo: o ponto passa a ser escolha dela. */
  onArrastarInicio: () => void;
  /** Movimento terminou: centro do mapa é a nova coordenada. */
  onAjustado: (lat: number, lng: number, distanciaDoGps: number) => void;
  /** Pediu para voltar ao ponto do GPS pelo botão de mira. */
  onVoltarAoGps: () => void;
  /** Altura da caixa do mapa. Em tela cheia vale '100%'. */
  height?: number | string;
}

/**
 * Mapa arrastável com pino fixo no centro da tela, no modelo do Uber.
 *
 * O pino não se move: quem se move é o mapa por baixo dele, então o centro do
 * mapa é sempre a coordenada escolhida. O ponto azul e o círculo continuam
 * marcando onde o aparelho realmente está, para a pessoa enxergar o quanto
 * afastou o ponto do sinal do GPS.
 *
 * O mapa nasce uma única vez: coordenadas novas entram pelos efeitos abaixo,
 * nunca recriando o Leaflet — recriar no meio do arrasto mataria o gesto.
 */
export default function MapaAjuste({
  gps,
  centroInicial,
  seguirGps,
  onReady,
  onMoverInicio,
  onArrastarInicio,
  onAjustado,
  onVoltarAoGps,
  height = 260
}: MapaAjusteProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const pontoGpsRef = useRef<any>(null);
  const circuloRef = useRef<any>(null);

  // Os avisos mudam a cada render; guardados em ref, o mapa não precisa nascer
  // de novo para enxergar a versão atual.
  const gpsRef = useRef(gps);
  const avisos = useRef({ onReady, onMoverInicio, onArrastarInicio, onAjustado });
  gpsRef.current = gps;
  avisos.current = { onReady, onMoverInicio, onArrastarInicio, onAjustado };

  useEffect(() => {
    let vivo = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !boxRef.current || mapRef.current) return;
      LRef.current = L;

      const mapa = L.map(boxRef.current, {
        zoomControl: false,
        attributionControl: false,
        // Interação completa no celular: arrastar com um dedo e pinçar o zoom.
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: false,
        inertia: true
      }).setView([centroInicial.lat, centroInicial.lng], 18);
      mapRef.current = mapa;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: true
      })
        .on('load', () => vivo && avisos.current.onReady?.())
        .on('tileerror', () => vivo && avisos.current.onReady?.())
        .addTo(mapa);

      mapa.on('movestart', () => avisos.current.onMoverInicio());
      mapa.on('dragstart', () => avisos.current.onArrastarInicio());
      mapa.on('moveend', () => {
        const centro = mapa.getCenter();
        const g = gpsRef.current;
        const distancia = g ? mapa.distance(centro, L.latLng(g.lat, g.lng)) : 0;
        avisos.current.onAjustado(centro.lat, centro.lng, distancia);
      });

      desenharGpsRef.current();

      const remedir = () => mapRef.current?.invalidateSize();
      remedir();
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(remedir);
        ro.observe(boxRef.current);
      }
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(
          entradas => entradas.forEach(e => e.isIntersecting && remedir()),
          { threshold: 0.1 }
        );
        io.observe(boxRef.current);
      }
      // Rede lenta não pode travar o fio: passado o limite, segue assim mesmo.
      setTimeout(() => vivo && avisos.current.onReady?.(), 6000);
    })();

    return () => {
      vivo = false;
      ro?.disconnect();
      io?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ponto azul do aparelho e círculo de precisão.
   *
   * Roda também no fim da criação do mapa: o Leaflet entra por import dinâmico,
   * então quando o efeito de `gps` dispara pela primeira vez o mapa ainda não
   * existe — sem esta segunda chamada o ponto azul nunca apareceria.
   */
  const desenharGps = () => {
    const L = LRef.current;
    const mapa = mapRef.current;
    const g = gpsRef.current;
    if (!L || !mapa || !g) return;

    const posicao = L.latLng(g.lat, g.lng);

    if (!pontoGpsRef.current) {
      circuloRef.current = L.circle(posicao, {
        radius: g.accuracy || 0,
        color: '#1A73E8',
        weight: 1,
        opacity: 0.5,
        fillColor: '#1A73E8',
        fillOpacity: 0.15,
        interactive: false
      }).addTo(mapa);

      pontoGpsRef.current = L.marker(posicao, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: '',
          html:
            '<span style="display:block;width:16px;height:16px;border-radius:50%;' +
            'background:#1A73E8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(mapa);
    } else {
      pontoGpsRef.current.setLatLng(posicao);
      circuloRef.current?.setLatLng(posicao);
      circuloRef.current?.setRadius(g.accuracy || 0);
    }
  };
  const desenharGpsRef = useRef(desenharGps);
  desenharGpsRef.current = desenharGps;

  // Os efeitos abaixo observam os números, não o objeto: uma leitura repetida
  // do GPS não pode redesenhar nem recentralizar o mapa à toa.
  useEffect(() => {
    desenharGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps?.lat, gps?.lng, gps?.accuracy]);

  // Leitura melhor do GPS só recentraliza enquanto a pessoa não assumiu o ponto.
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapRef.current;
    if (!L || !mapa || !gps || !seguirGps) return;
    // Meio metro de diferença não move nada e ainda dispararia um `moveend`.
    if (mapa.distance(mapa.getCenter(), L.latLng(gps.lat, gps.lng)) < 0.5) return;
    mapa.setView([gps.lat, gps.lng], mapa.getZoom(), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps?.lat, gps?.lng, seguirGps]);

  const voltarAoGps = () => {
    const mapa = mapRef.current;
    onVoltarAoGps();
    // Sem animação: o voo até o ponto dispara um `moveend` no meio do caminho
    // e o endereço piscaria num lugar que ninguém escolheu.
    if (mapa && gps) {
      mapa.setView([gps.lat, gps.lng], Math.max(mapa.getZoom(), 18), { animate: false });
    }
  };

  return (
    <div className="relative" style={{ height }}>
      <div
        ref={boxRef}
        className="absolute inset-0 bg-slate-200"
        style={{ touchAction: 'none' }}
      />

      {/* Pino fixo: fica sempre no centro da tela, o mapa é que anda embaixo. */}
      <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
        <span
          className="block rounded-full"
          style={{ width: 8, height: 4, background: 'rgba(0,0,0,.25)' }}
        />
        <svg
          width="34"
          height="46"
          viewBox="0 0 34 46"
          className="absolute"
          style={{ transform: 'translateY(-23px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }}
          aria-hidden="true"
        >
          <path
            d="M17 45C17 45 32 27.5 32 16.5C32 8.2 25.3 1.5 17 1.5C8.7 1.5 2 8.2 2 16.5C2 27.5 17 45 17 45Z"
            fill="#0C3556"
            stroke="#fff"
            strokeWidth="2.5"
          />
          <circle cx="17" cy="16.5" r="5.5" fill="#fff" />
        </svg>
      </div>

      {/* Mira: volta para o ponto do GPS sem sair do mapa. */}
      <button
        type="button"
        onClick={voltarAoGps}
        disabled={!gps}
        title="Voltar ao meu GPS"
        aria-label="Voltar ao meu GPS"
        className="absolute z-[600] bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer active:scale-95 transition-transform disabled:opacity-50"
      >
        <Crosshair className="w-4 h-4" />
      </button>
    </div>
  );
}
