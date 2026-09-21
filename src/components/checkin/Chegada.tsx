import React from 'react';
import { Check, Loader2, LocateFixed, MapPin, Navigation } from 'lucide-react';
import MiniMapa from '../MiniMapa';
import { AZUL, VERDE } from './pecas';
import { MissaoDoCampo } from './tipos';
import { Chegada as ChegadaDaMissao, distanciaCurta, tempoAPeCurto } from './missoes';

/**
 * A tela de chegada da missão.
 *
 * É a etapa que substitui o "confirme sua localização" quando o check-in é de
 * uma missão. E a diferença não é de nome: no registro livre o lugar é uma
 * pergunta ("onde você está?"), na missão o lugar já foi decidido pelo comitê
 * e a pergunta virou outra — "você já chegou?".
 *
 * Por isso o mapa mostra dois pontos, e não um: onde a pessoa está e onde a
 * missão é. Entre eles, a distância que falta, que encolhe sozinha enquanto
 * ela anda. É o mapa de quem está indo, não o formulário de quem já chegou.
 */
export default function Chegada({
  missao,
  coords,
  precisao,
  endereco,
  buscandoGps,
  erroGps,
  chegada,
  onAtualizarGps
}: {
  missao: MissaoDoCampo;
  coords: { lat: number; lng: number } | null;
  precisao: number | null;
  endereco: { rua: string; resto: string } | null;
  buscandoGps: boolean;
  erroGps: string | null;
  chegada: ChegadaDaMissao;
  onAtualizarGps: () => void;
}) {
  /*
   * O mapa se refaz quando a lista de pontos muda, e a posição do GPS muda a
   * cada segundo: sem arredondar, o cartão piscaria sem parar. Quatro casas
   * são cerca de onze metros — o bastante para o desenho acompanhar quem
   * anda, sem refazer o mapa a cada respiração do aparelho.
   */
  const pontos = React.useMemo(() => {
    if (!coords) return [];
    const eu = {
      lat: coords.lat,
      lng: coords.lng,
      cor: AZUL,
      forma: 'pessoa' as const,
      titulo: 'Você'
    };
    if (missao.semLocal) return [eu];
    return [eu, { lat: missao.lat, lng: missao.lng, cor: missao.color || VERDE, titulo: missao.title }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coords ? coords.lat.toFixed(4) : '',
    coords ? coords.lng.toFixed(4) : '',
    missao.id,
    missao.semLocal
  ]);

  if (buscandoGps && !coords) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3.5 py-4 flex items-center gap-2.5 text-[12.5px] font-bold text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Procurando você no mapa...
      </div>
    );
  }

  if (erroGps && !coords) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3.5 py-3">
        <p className="text-[12.5px] font-bold text-rose-600">{erroGps}</p>
        <p className="text-[11.5px] font-semibold text-slate-400 leading-snug mt-1">
          Sem a sua posição não dá para começar a missão: é ela que prova que
          você está no lugar.
        </p>
        <button
          onClick={onAtualizarGps}
          className="mt-2.5 h-[44px] px-4 text-[12px] font-black uppercase tracking-wider text-white rounded-xl cursor-pointer"
          style={{ backgroundColor: AZUL }}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const chegou = chegada.pode;

  return (
    <div
      className="bg-white rounded-2xl border shadow-sm overflow-hidden"
      style={{ borderColor: chegou ? `${VERDE}66` : '#E2E8F0' }}
    >
      {coords && <MiniMapa lat={coords.lat} lng={coords.lng} pontos={pontos} height={190} />}

      <div className="px-3.5 py-3">
        {missao.semLocal ? (
          <p className="flex items-center gap-2 text-[15px] font-black" style={{ color: VERDE }}>
            <Check className="w-4 h-4 stroke-[3] shrink-0" />
            Esta missão é onde você estiver
          </p>
        ) : chegou ? (
          <p className="flex items-center gap-2 text-[15px] font-black" style={{ color: VERDE }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: VERDE }}>
              <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
            </span>
            Você chegou ao ponto da missão
          </p>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4 text-amber-600" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[15px] font-black" style={{ color: AZUL }}>
                Faltam {distanciaCurta(chegada.faltam)}
              </span>
              <span className="block text-[11.5px] font-bold text-slate-400 mt-0.5">
                {chegada.distancia !== null && (
                  <>
                    {distanciaCurta(chegada.distancia)} até o ponto ·{' '}
                    {tempoAPeCurto(chegada.distancia)} a pé
                  </>
                )}
              </span>
            </span>
          </div>
        )}

        <p className="text-[11.5px] text-slate-400 font-bold mt-2 flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span className="min-w-0 flex-1">
            {endereco?.rua || 'Localizando endereço...'}
            {precisao !== null && (
              <span className="text-slate-300"> · precisão {precisao} m</span>
            )}
          </span>
        </p>

        {!chegou && !missao.semLocal && (
          <button
            type="button"
            onClick={onAtualizarGps}
            className="mt-2.5 h-[40px] w-full rounded-xl border border-slate-200 text-slate-600 text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            Atualizar minha posição
          </button>
        )}
      </div>
    </div>
  );
}
