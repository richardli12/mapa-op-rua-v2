import { useEffect, useRef, useState } from 'react';

interface MiniMapaProps {
  lat: number;
  lng: number;
  /** Avisa quando os tiles terminaram de entrar: só aí o passo pode seguir. */
  onReady?: () => void;
  /** Altura fixa, em pixels. Mapa sem altura definida não pede tile nenhum. */
  height?: number;
  className?: string;
}

/**
 * Mapa real do ponto capturado, com o pino nas coordenadas exatas.
 *
 * O Leaflet mede o container no momento em que o mapa nasce. Dentro de uma
 * conversa o cartão entra junto com o scroll, então a medida sai errada e o
 * mapa fica em branco: por isso a altura é fixa e o invalidateSize roda quando
 * o cartão aparece de fato (IntersectionObserver) e a cada mudança de tamanho.
 */
export default function MiniMapa({
  lat,
  lng,
  onReady,
  height = 150,
  className = ''
}: MiniMapaProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !boxRef.current || mapRef.current) return;

      const mapa = L.map(boxRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        keyboard: false
      }).setView([lat, lng], 17);
      mapRef.current = mapa;

      const tiles = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, crossOrigin: true }
      );
      tiles.on('load', () => {
        if (vivo) onReady?.();
      });
      tiles.on('tileerror', () => {
        if (vivo) {
          setErro(true);
          onReady?.();
        }
      });
      tiles.addTo(mapa);

      // Pino azul da marca, desenhado no próprio HTML: não depende do ícone
      // padrão do Leaflet, que é um arquivo externo e some quando falha.
      const pino = L.divIcon({
        className: '',
        html:
          '<span style="display:block;width:22px;height:22px;border-radius:50%;' +
          'background:#0C3556;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      L.marker([lat, lng], { icon: pino }).addTo(mapa);

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
      setTimeout(() => vivo && onReady?.(), 6000);
    })();

    return () => {
      vivo = false;
      ro?.disconnect();
      io?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div ref={boxRef} className="absolute inset-0 bg-slate-200" />
      {erro && (
        <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-bold text-slate-500">
          mapa indisponível agora
        </span>
      )}
    </div>
  );
}
