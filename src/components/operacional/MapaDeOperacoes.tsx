import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Operacao,
  PontoDoMapa,
  distanciaEmMetros,
  formatarDistancia
} from '../../services/deltaOperacional';

/**
 * O mapa do Delta Operacional.
 *
 * Três modos, e em cada um o clique quer dizer uma coisa só:
 *
 * - NAVEGAR: o mapa mostra os pontos do cliente e as operações já criadas;
 *   clicar numa operação a abre.
 * - DESENHAR: o primeiro clique marca o centro, o raio acompanha o cursor e o
 *   segundo clique fecha. No celular, que não tem cursor, dois toques no
 *   mesmo lugar abrem um raio proporcional ao zoom, para ajustar depois.
 * - SELECIONAR: o raio fica de pé, com uma alça no centro (move) e outra na
 *   borda (aumenta e diminui). Os pontos de fora apagam; os de dentro se
 *   escolhem e se desescolhem com um clique.
 *
 * Os pontos fora do raio não se escolhem de propósito: a operação é daquele
 * pedaço de chão. Para pegar um ponto de fora, estica-se o raio até ele.
 */

export type ModoDoMapa = 'navegar' | 'desenhar' | 'selecionar';

export interface Raio {
  center: { lat: number; lng: number };
  radius: number;
}

export const chaveDoPonto = (p: { tipo: string; id: string }) => `${p.tipo}:${p.id}`;

const LARANJA = '#F58220';

/**
 * O raio de quem toca duas vezes no mesmo lugar (celular, sem cursor para
 * abrir o círculo): uma fração do que está na tela. Um valor fixo nasceria
 * invisível com o mapa afastado e cobrindo tudo com ele de perto.
 */
const raioDoToque = (mapa: L.Map) => {
  const caixa = mapa.getBounds();
  const largura = caixa.getNorthWest().distanceTo(caixa.getNorthEast());
  return Math.max(100, Math.round((largura * 0.18) / 10) * 10);
};

const iconeDoPonto = (ponto: PontoDoMapa, estado: 'normal' | 'fora' | 'dentro' | 'escolhido') => {
  const html =
    ponto.tipo === 'pin'
      ? `<div class="opm-pino opm-${estado}" style="--cor:${ponto.cor}">
           <svg viewBox="0 0 26 34" width="26" height="34"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.3 11.6 31.2 12.1 31.6a1.3 1.3 0 0 0 1.8 0C14.4 31.2 25 21.3 25 12.7 25 6.2 19.6 1 13 1Z" fill="var(--cor)" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.6" r="4.2" fill="#fff"/></svg>
           <span class="opm-visto"><svg viewBox="0 0 24 24" width="10" height="10"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
         </div>`
      : `<div class="opm-ck opm-${estado}">
           <span class="opm-ck-ponto"></span>
           <span class="opm-visto"><svg viewBox="0 0 24 24" width="10" height="10"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
         </div>`;
  return L.divIcon({
    className: 'opm-icone',
    html,
    iconSize: ponto.tipo === 'pin' ? [26, 34] : [18, 18],
    iconAnchor: ponto.tipo === 'pin' ? [13, 32] : [9, 9]
  });
};

const alca = (classe: string) =>
  L.divIcon({ className: 'opm-icone', html: `<div class="${classe}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

/** Ponto na borda leste do círculo, onde mora a alça de tamanho. */
const pontoNaBorda = (centro: L.LatLng, metros: number) => {
  const graus = metros / (111320 * Math.cos((centro.lat * Math.PI) / 180));
  return L.latLng(centro.lat, centro.lng + graus);
};

const escapar = (t: string) =>
  (t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function MapaDeOperacoes({
  pontos,
  operacoes,
  corDaPrioridade,
  modo,
  raio,
  onRaio,
  selecionados,
  onAlternarPonto,
  operacaoEmFoco,
  onAbrirOperacao,
  focar,
  escuro = true,
  interativo = true
}: {
  pontos: PontoDoMapa[];
  operacoes: Operacao[];
  corDaPrioridade: (id?: string | null) => string;
  modo: ModoDoMapa;
  raio: Raio | null;
  onRaio?: (raio: Raio) => void;
  selecionados?: Set<string>;
  onAlternarPonto?: (chave: string) => void;
  operacaoEmFoco?: string | null;
  onAbrirOperacao?: (id: string) => void;
  /** Muda o `pedido` para o mapa voar até o ponto. */
  focar?: { lat: number; lng: number; zoom?: number; raio?: number; pedido: number } | null;
  escuro?: boolean;
  /** Falso deixa o mapa só para olhar (prévia no painel do administrador). */
  interativo?: boolean;
}) {
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const grupoPontos = useRef<L.LayerGroup | null>(null);
  const grupoOperacoes = useRef<L.LayerGroup | null>(null);
  const grupoRaio = useRef<L.LayerGroup | null>(null);
  const enquadrado = useRef(false);

  // As funções mudam a cada render; os ouvintes do Leaflet leem sempre a atual.
  const atual = useRef({ modo, onRaio, onAlternarPonto, onAbrirOperacao });
  atual.current = { modo, onRaio, onAlternarPonto, onAbrirOperacao };

  /* ------------------------------------------------------- o mapa ---- */
  useEffect(() => {
    if (!caixaRef.current || mapaRef.current) return;
    const mapa = L.map(caixaRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: [-9.6498, -35.7089],
      zoom: 13,
      dragging: interativo,
      scrollWheelZoom: interativo,
      doubleClickZoom: false
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapa);
    if (interativo) L.control.zoom({ position: 'bottomright' }).addTo(mapa);
    grupoOperacoes.current = L.layerGroup().addTo(mapa);
    grupoPontos.current = L.layerGroup().addTo(mapa);
    grupoRaio.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;

    // O mapa nasce dentro de caixas que ainda estão se abrindo.
    const ajuste = new ResizeObserver(() => mapa.invalidateSize());
    ajuste.observe(caixaRef.current);
    return () => {
      ajuste.disconnect();
      mapa.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------- enquadrar na primeira vez ---- */
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || enquadrado.current) return;
    const coords: L.LatLngExpression[] = [
      ...pontos.map((p) => [p.lat, p.lng] as [number, number]),
      ...operacoes.map((o) => [o.center.lat, o.center.lng] as [number, number])
    ];
    if (coords.length === 0) return;
    enquadrado.current = true;
    mapa.fitBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 15 });
  }, [pontos, operacoes]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !focar) return;
    if (focar.raio) {
      const c = L.latLng(focar.lat, focar.lng);
      mapa.flyToBounds(c.toBounds(focar.raio * 2.4), { duration: 0.8 });
    } else {
      mapa.flyTo([focar.lat, focar.lng], focar.zoom || Math.max(mapa.getZoom(), 16), { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focar?.pedido]);

  /* -------------------------------------------------- as operações ---- */
  useEffect(() => {
    const grupo = grupoOperacoes.current;
    if (!grupo) return;
    grupo.clearLayers();
    const ocupado = modo !== 'navegar';
    operacoes.forEach((op) => {
      const cor = op.status === 'cancelada' ? '#94A3B8' : corDaPrioridade(op.priority);
      const foco = operacaoEmFoco === op.id;
      const apagada = ocupado || (!!operacaoEmFoco && !foco);
      const circulo = L.circle([op.center.lat, op.center.lng], {
        radius: op.radius,
        color: cor,
        weight: foco ? 3 : 2,
        opacity: apagada ? 0.35 : 0.95,
        fillColor: cor,
        fillOpacity: apagada ? 0.03 : foco ? 0.16 : 0.09,
        dashArray: op.status === 'planejada' ? '7 6' : undefined,
        interactive: !ocupado && interativo,
        className: foco ? 'opm-operacao-foco' : ''
      });
      circulo.bindTooltip(
        `<strong>${escapar(op.title)}</strong><br/><span>${op.targets.length} ${
          op.targets.length === 1 ? 'ponto' : 'pontos'
        } · ${formatarDistancia(op.radius)}</span>`,
        { sticky: true, direction: 'top', className: 'opm-dica' }
      );
      circulo.on('click', () => atual.current.onAbrirOperacao?.(op.id));
      grupo.addLayer(circulo);
    });
  }, [operacoes, operacaoEmFoco, modo, corDaPrioridade, interativo]);

  /* ----------------------------------------------------- os pontos ---- */
  useEffect(() => {
    const grupo = grupoPontos.current;
    if (!grupo) return;
    grupo.clearLayers();
    pontos.forEach((ponto) => {
      const chave = chaveDoPonto(ponto);
      const dentro = raio ? distanciaEmMetros(raio.center, ponto) <= raio.radius : true;
      const estado = selecionados?.has(chave)
        ? 'escolhido'
        : raio && modo !== 'navegar'
          ? dentro
            ? 'dentro'
            : 'fora'
          : 'normal';
      const marcador = L.marker([ponto.lat, ponto.lng], {
        icon: iconeDoPonto(ponto, estado),
        // Desenhando, o clique é do mapa: centrar a operação em cima de um
        // ponto ("em volta desta escola") é o gesto mais natural que existe,
        // e o marcador não pode engolir esse clique.
        interactive: interativo && modo !== 'desenhar',
        keyboard: false,
        zIndexOffset: estado === 'escolhido' ? 800 : estado === 'dentro' ? 400 : 0
      });
      marcador.bindTooltip(
        `<strong>${escapar(ponto.titulo)}</strong>${
          ponto.detalhe ? `<br/><span>${escapar(ponto.detalhe)}</span>` : ''
        }${
          modo === 'selecionar'
            ? `<br/><em>${
                !dentro ? 'Fora do raio — estique o raio para alcançar' : estado === 'escolhido' ? 'Clique para tirar' : 'Clique para incluir'
              }</em>`
            : ''
        }`,
        { direction: 'top', offset: [0, ponto.tipo === 'pin' ? -30 : -8], className: 'opm-dica' }
      );
      marcador.on('click', () => {
        if (atual.current.modo === 'selecionar' && dentro) atual.current.onAlternarPonto?.(chave);
      });
      grupo.addLayer(marcador);
    });
  }, [pontos, raio, selecionados, modo, interativo]);

  /* ------------------------------------------- o raio sendo desenhado ---- */
  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = grupoRaio.current;
    if (!mapa || !grupo) return;
    grupo.clearLayers();
    const caixa = caixaRef.current!;
    caixa.classList.toggle('opm-mirando', modo === 'desenhar');

    if (modo === 'desenhar') {
      let centro: L.LatLng | null = null;
      let circulo: L.Circle | null = null;
      let rotulo: L.Tooltip | null = null;

      const clique = (e: L.LeafletMouseEvent) => {
        if (!centro) {
          centro = e.latlng;
          circulo = L.circle(centro, {
            radius: 1,
            color: LARANJA,
            weight: 2,
            fillColor: LARANJA,
            fillOpacity: 0.1,
            dashArray: '6 6',
            interactive: false
          }).addTo(grupo);
          L.marker(centro, { icon: alca('opm-alca-centro'), interactive: false }).addTo(grupo);
          rotulo = L.tooltip({ permanent: true, direction: 'right', className: 'opm-medida', offset: [14, 0] })
            .setLatLng(centro)
            .setContent('Mova e clique para fechar o raio');
          rotulo.addTo(mapa);
          return;
        }
        let metros = centro.distanceTo(e.latlng);
        if (metros < 20) metros = raioDoToque(mapa);
        rotulo?.remove();
        atual.current.onRaio?.({ center: { lat: centro.lat, lng: centro.lng }, radius: Math.round(metros) });
      };
      const mover = (e: L.LeafletMouseEvent) => {
        if (!centro || !circulo) return;
        const metros = centro.distanceTo(e.latlng);
        circulo.setRadius(metros);
        rotulo?.setLatLng(e.latlng).setContent(formatarDistancia(metros));
      };
      mapa.on('click', clique);
      mapa.on('mousemove', mover);
      return () => {
        mapa.off('click', clique);
        mapa.off('mousemove', mover);
        rotulo?.remove();
        caixa.classList.remove('opm-mirando');
      };
    }

    if (!raio) return;

    const centro = L.latLng(raio.center.lat, raio.center.lng);
    const circulo = L.circle(centro, {
      radius: raio.radius,
      color: LARANJA,
      weight: 2.5,
      fillColor: LARANJA,
      fillOpacity: 0.08,
      dashArray: '8 7',
      interactive: false,
      className: 'opm-raio-vivo'
    }).addTo(grupo);

    if (modo !== 'selecionar') return;

    const medida = L.tooltip({ permanent: true, direction: 'right', className: 'opm-medida', offset: [14, 0] });
    const borda = L.marker(pontoNaBorda(centro, raio.radius), {
      icon: alca('opm-alca-borda'),
      draggable: true,
      zIndexOffset: 1000
    }).addTo(grupo);
    medida.setLatLng(borda.getLatLng()).setContent(formatarDistancia(raio.radius));
    medida.addTo(mapa);

    const meio = L.marker(centro, { icon: alca('opm-alca-centro'), draggable: true, zIndexOffset: 1000 }).addTo(grupo);
    meio.bindTooltip('Arraste para mover o raio', { direction: 'top', offset: [0, -12], className: 'opm-dica' });
    borda.bindTooltip('Arraste para mudar o tamanho', { direction: 'top', offset: [0, -12], className: 'opm-dica' });

    let raioAtual = raio.radius;
    let centroAtual = centro;

    borda.on('drag', () => {
      raioAtual = Math.max(30, centroAtual.distanceTo(borda.getLatLng()));
      circulo.setRadius(raioAtual);
      medida.setLatLng(borda.getLatLng()).setContent(formatarDistancia(raioAtual));
    });
    meio.on('drag', () => {
      centroAtual = meio.getLatLng();
      circulo.setLatLng(centroAtual);
      const b = pontoNaBorda(centroAtual, raioAtual);
      borda.setLatLng(b);
      medida.setLatLng(b);
    });
    const soltar = () =>
      atual.current.onRaio?.({
        center: { lat: centroAtual.lat, lng: centroAtual.lng },
        radius: Math.round(raioAtual)
      });
    borda.on('dragend', soltar);
    meio.on('dragend', soltar);

    return () => {
      medida.remove();
    };
  }, [modo, raio?.center.lat, raio?.center.lng, raio?.radius]);

  return (
    <div
      ref={caixaRef}
      className={`absolute inset-0 ${escuro ? 'opm-escuro' : ''} ${interativo ? '' : 'pointer-events-none'}`}
    />
  );
}
