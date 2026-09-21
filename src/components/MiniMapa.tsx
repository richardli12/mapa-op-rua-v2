import { useEffect, useRef, useState } from 'react';

/** Um check-in desenhado no mapa: posição, cor do marcador e o que ele é. */
export interface PontoDoMiniMapa {
  lat: number;
  lng: number;
  /** Cor do marcador — a mesma que o ponto tem no mapa grande. */
  cor?: string;
  /** Texto que aparece ao passar o mouse. */
  titulo?: string;
  /** 'alerta' para check-in livre, 'pessoa' para check-in de missão. */
  forma?: 'alerta' | 'pessoa';
}

interface MiniMapaProps {
  lat: number;
  lng: number;
  /**
   * Pontos a desenhar. Com a lista preenchida o mapa mostra todos eles e se
   * ajusta para caber todos; vazia, mostra só o pino de lat/lng.
   */
  pontos?: PontoDoMiniMapa[];
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
  pontos,
  onReady,
  height = 150,
  className = ''
}: MiniMapaProps) {
  // Lista nova a cada render não pode refazer o mapa: o que conta é o conteúdo.
  const chaveDosPontos = (pontos || [])
    .map(p => `${p.lat},${p.lng},${p.cor || ''},${p.forma || ''}`)
    .join('|');
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  /** Camada só dos marcadores: limpar ela não derruba os tiles. */
  const camadaRef = useRef<any>(null);
  /** O desenhador de pinos, criado junto com o mapa. */
  const pinoRef = useRef<((cor: string, forma?: 'alerta' | 'pessoa') => any) | null>(null);
  /** O que já está desenhado, para não redesenhar o mesmo. */
  const desenhadoRef = useRef<string | null>(null);
  /** Valores atuais lidos de dentro do efeito de criação, que roda uma vez só. */
  const dadosRef = useRef({ lat, lng, pontos, chaveDosPontos, onReady });
  dadosRef.current = { lat, lng, pontos, chaveDosPontos, onReady };
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !boxRef.current || mapRef.current) return;
      LRef.current = L;
      const { lat, lng } = dadosRef.current;

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
        if (vivo) dadosRef.current.onReady?.();
      });
      tiles.on('tileerror', () => {
        if (vivo) {
          setErro(true);
          dadosRef.current.onReady?.();
        }
      });
      tiles.addTo(mapa);

      // Marcador desenhado no próprio HTML, com a mesma cara do mapa grande:
      // não depende do ícone padrão do Leaflet, que é um arquivo externo e
      // some quando falha.
      const pino = (cor: string, forma?: 'alerta' | 'pessoa'): any => {
        const desenho =
          forma === 'pessoa'
            ? '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
            : forma === 'alerta'
              ? '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
              : '';
        const svg = desenho
          ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
            'stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" ' +
            'width="14" height="14">' + desenho + '</svg>'
          : '';
        return L.divIcon({
          className: '',
          html:
            '<span style="display:flex;align-items:center;justify-content:center;' +
            'width:26px;height:26px;border-radius:50%;background:' + cor + ';' +
            'border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">' + svg + '</span>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
      };

      pinoRef.current = pino;
      camadaRef.current = L.layerGroup().addTo(mapa);
      desenharRef.current(true);

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
      setTimeout(() => vivo && dadosRef.current.onReady?.(), 6000);
    })();

    return () => {
      vivo = false;
      ro?.disconnect();
      io?.disconnect();
      camadaRef.current = null;
      pinoRef.current = null;
      desenhadoRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Coordenada nova NÃO refaz o mapa — troca o que está desenhado nele.
   *
   * Antes este componente nascia de novo a cada mudança de `lat`/`lng`: o
   * efeito inteiro tinha essas props na lista de dependências, então o mapa
   * era destruído e recriado. Parado isso não aparece; andando até uma
   * missão, com o GPS entregando uma leitura por segundo, o cartão piscava
   * cinza e se reposicionava sem parar, porque a cada segundo havia um mapa
   * novo baixando tiles e refazendo o enquadramento.
   *
   * Agora o mapa nasce uma vez. Os marcadores vivem numa camada própria, que
   * é limpa e redesenhada, e o enquadramento só se mexe quando o desenho
   * muda de verdade — a lista de pontos que Chegada arredonda para onze
   * metros. Leitura de GPS que não muda o desenho não move mais nada.
   */
  const desenhar = (primeiraVez = false) => {
    const L = LRef.current;
    const mapa = mapRef.current;
    const camada = camadaRef.current;
    const pino = pinoRef.current;
    if (!L || !mapa || !camada || !pino) return;

    const { lat, lng, pontos, chaveDosPontos } = dadosRef.current;
    const lista = pontos && pontos.length > 0 ? pontos : null;
    const chave = lista ? chaveDosPontos : `${lat},${lng}`;
    if (!primeiraVez && desenhadoRef.current === chave) return;
    desenhadoRef.current = chave;

    camada.clearLayers();

    if (lista) {
      lista.forEach(ponto => {
        const marcador = L.marker([ponto.lat, ponto.lng], {
          icon: pino(ponto.cor || '#0C3556', ponto.forma)
        }).addTo(camada);
        if (ponto.titulo) {
          marcador.bindTooltip(ponto.titulo, { direction: 'top', offset: [0, -14] });
        }
      });
      // Todos os check-ins precisam caber no cartão; o limite de zoom evita
      // que um ponto sozinho encoste no chão da rua e perca a referência.
      mapa.fitBounds(L.latLngBounds(lista.map(p => [p.lat, p.lng] as [number, number])), {
        padding: [30, 30],
        maxZoom: 16,
        animate: false
      });
    } else {
      L.marker([lat, lng], { icon: pino('#0C3556') }).addTo(camada);
      if (!primeiraVez) mapa.setView([lat, lng], mapa.getZoom(), { animate: false });
    }
  };
  const desenharRef = useRef(desenhar);
  desenharRef.current = desenhar;

  useEffect(() => {
    desenharRef.current();
  }, [lat, lng, chaveDosPontos]);

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
