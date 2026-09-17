import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Check, Camera, MapPin, Clock, Loader2 } from 'lucide-react';
import { reverseGeocode } from '../services/streetSources';
import { DatabaseService } from '../databaseClient';
import { OperationType, CheckIn } from '../types';
import OperationIcon from './OperationIcon';
import BrandMark from './BrandMark';
import MiniMapa from './MiniMapa';
import MapaAjuste from './MapaAjuste';

interface CheckInChatProps {
  member: any;
  clientId: string;
  clientName: string;
  operationTypes: OperationType[];
  onSaved: (checkIn: CheckIn) => void;
  onBack: () => void;
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
}

/** Cores da marca, fixadas aqui para o fio inteiro falar a mesma língua. */
const AZUL = '#0C3556';
const FUNDO = '#F3F6FA';
const VERDE = '#08A47B';

const TOTAL_ETAPAS = 4;

type Autor = 'sistema' | 'membro';
type Bloco = 'local' | 'foto';

interface Mensagem {
  id: string;
  autor: Autor;
  hora: string;
  texto?: string;
  bloco?: Bloco;
}

const horaAgora = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Check-in de campo em forma de conversa.
 *
 * Cada etapa só termina quando a pessoa conclui a ação: a localização vira
 * mensagem depois de ela confirmar, a foto depois do envio, a operação depois
 * da escolha. Nada aqui é de enfeite — endereço, precisão, foto, horário e
 * tipos de operação são os dados reais do aparelho e do cliente.
 */
export default function CheckInChat({
  member,
  clientId,
  clientName,
  operationTypes,
  onSaved,
  onBack,
  notify
}: CheckInChatProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [etapa, setEtapa] = useState(1);

  /** Onde o aparelho está, segundo o GPS. Só muda com leitura nova. */
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(
    null
  );
  /** Ponto que será salvo: o centro do mapa depois do ajuste da pessoa. */
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);
  const [endereco, setEndereco] = useState<{ rua: string; resto: string } | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(true);
  const [erroGps, setErroGps] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const [seguirGps, setSeguirGps] = useState(true);
  const [localConfirmado, setLocalConfirmado] = useState(false);
  const [horaLocal, setHoraLocal] = useState('');

  const [foto, setFoto] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [operacao, setOperacao] = useState<OperationType | null>(null);
  const [salvando, setSalvando] = useState(false);

  const fimRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abriuFio = useRef(false);
  const watchRef = useRef<number | null>(null);
  const geocodeRef = useRef(0);
  /** Último ponto já consultado, para não repetir a busca do mesmo endereço. */
  const ultimoGeocodeRef = useRef<{ lat: number; lng: number } | null>(null);
  /** Espelho de `seguirGps` para ser lido dentro dos avisos do GPS e do mapa. */
  const seguirGpsRef = useRef(true);

  const definirSeguirGps = (valor: boolean) => {
    seguirGpsRef.current = valor;
    setSeguirGps(valor);
  };

  const nomeMembro: string =
    member?.full_name || member?.name || member?.nome || 'Integrante';
  const fotoMembro: string = member?.image || '';

  const empilhar = (msg: Omit<Mensagem, 'id' | 'hora'> & { hora?: string }) =>
    setMensagens(prev => [
      ...prev,
      { id: `m${prev.length}_${Date.now()}`, hora: msg.hora || horaAgora(), ...msg }
    ]);

  useEffect(() => {
    if (abriuFio.current) return;
    abriuFio.current = true;
    empilhar({ autor: 'sistema', texto: 'Primeiro, confirme sua localização.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
      90
    );
    return () => clearTimeout(t);
  }, [mensagens, etapa, mapaPronto, coords, foto, operacao]);

  // ------------------------------------------------------------ localização
  /**
   * Endereço do ponto escolhido.
   *
   * Cada chamada leva um número de ordem: resposta atrasada de um ponto antigo
   * é descartada, senão o endereço de um arrasto anterior sobrescreveria o atual.
   */
  const atualizarEndereco = async (lat: number, lng: number) => {
    // Recentralizar no GPS repete o mesmo ponto: o Nominatim não precisa saber.
    const anterior = ultimoGeocodeRef.current;
    if (
      anterior &&
      Math.abs(anterior.lat - lat) < 1e-5 &&
      Math.abs(anterior.lng - lng) < 1e-5
    ) {
      setAjustando(false);
      return;
    }
    ultimoGeocodeRef.current = { lat, lng };

    const vez = ++geocodeRef.current;
    setAjustando(true);
    let rua = 'Local capturado por GPS';
    let resto = '';
    try {
      const addr = await reverseGeocode(lat, lng);
      rua = addr?.road || addr?.displayName || rua;
      resto = [addr?.suburb, addr?.city, addr?.uf].filter(Boolean).join(', ');
    } catch {
      /* sem endereço, fica o ponto do mapa */
    }
    if (vez !== geocodeRef.current) return;
    setEndereco({ rua, resto });
    setAjustando(false);
  };

  /**
   * Captura do GPS em alta precisão.
   *
   * A primeira leitura do aparelho costuma vir da rede, com dezenas de metros
   * de erro. Por isso o sinal fica sendo acompanhado por alguns segundos e o
   * mapa se centraliza na melhor coordenada obtida — a de menor raio de erro.
   */
  const capturarLocal = () => {
    if (!navigator.geolocation) {
      setErroGps('Este aparelho não oferece localização.');
      setBuscandoGps(false);
      return;
    }
    setBuscandoGps(true);
    setErroGps(null);
    setMapaPronto(false);
    definirSeguirGps(true);

    let melhor: GeolocationPosition | null = null;
    const encerrarBusca = () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };

    const receber = (pos: GeolocationPosition) => {
      const anterior = melhor?.coords.accuracy ?? Infinity;
      if (melhor && pos.coords.accuracy > anterior) return;
      melhor = pos;

      const { latitude, longitude, accuracy } = pos.coords;
      setGps({ lat: latitude, lng: longitude, accuracy: accuracy ?? null });
      setBuscandoGps(false);

      // Enquanto a pessoa não arrastou, o ponto do check-in acompanha o GPS.
      // Depois do arrasto o mapa manda: quem atualiza o ponto é o `moveend`.
      if (seguirGpsRef.current) {
        setCoords({ lat: latitude, lng: longitude });
        setPrecisao(accuracy ? Math.round(accuracy) : null);
        atualizarEndereco(latitude, longitude);
      }

      // Boa o bastante: não adianta gastar bateria atrás de mais precisão.
      if (accuracy && accuracy <= 20) encerrarBusca();
    };

    watchRef.current = navigator.geolocation.watchPosition(
      receber,
      err => {
        encerrarBusca();
        setBuscandoGps(false);
        if (melhor) return; // já havia uma leitura boa; o erro seguinte não apaga
        setErroGps(
          err?.code === 1
            ? 'Permita o acesso à localização para continuar.'
            : 'Não foi possível capturar sua localização agora.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    setTimeout(encerrarBusca, 12000);
  };

  useEffect(() => {
    capturarLocal();
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Fim do arrasto: o centro do mapa vira a coordenada do check-in.
   *
   * A precisão passa a somar o erro do GPS com o quanto o ponto foi afastado
   * dele — é essa a distância real entre o que foi marcado e onde o aparelho
   * está.
   */
  const aoAjustar = (lat: number, lng: number, distanciaDoGps: number) => {
    setCoords({ lat, lng });
    const erroGpsMetros = gps?.accuracy ?? 0;
    setPrecisao(Math.round(erroGpsMetros + distanciaDoGps));
    atualizarEndereco(lat, lng);
  };

  const confirmarLocal = () => {
    // O ponto salvo é o centro do mapa neste instante, já ajustado pela pessoa.
    if (!coords || ajustando) return;
    // A partir daqui o ponto está fechado: o GPS para de acompanhar.
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    definirSeguirGps(false);
    setLocalConfirmado(true);
    setHoraLocal(horaAgora());
    setEtapa(2);
    empilhar({ autor: 'membro', bloco: 'local' });
    empilhar({ autor: 'sistema', texto: 'Agora envie uma foto do local.' });
  };

  // ------------------------------------------------------------------ foto
  const enviarFoto = async (file: File) => {
    setEnviandoFoto(true);
    const res = await DatabaseService.uploadMedia(file);
    setEnviandoFoto(false);
    if (!res.success || !res.url) {
      notify(res.error || 'Não foi possível enviar a foto.', 'error');
      return;
    }
    setFoto(res.url);
    setEtapa(3);
    empilhar({ autor: 'membro', bloco: 'foto' });
    empilhar({ autor: 'sistema', texto: 'Qual operação você vai iniciar?' });
  };

  // -------------------------------------------------------------- operação
  const escolherOperacao = (tipo: OperationType) => {
    setOperacao(tipo);
    setEtapa(4);
    empilhar({ autor: 'membro', texto: tipo.label });
  };

  // ------------------------------------------------------------ confirmação
  const confirmar = async () => {
    if (!coords || !foto || !operacao) return;
    setSalvando(true);

    const agora = new Date();
    const partes = (endereco?.resto || '').split(',').map(t => t.trim());
    const registro: any = {
      id: 'checkin_' + Math.random().toString(36).substr(2, 9),
      name: nomeMembro,
      rua: endereco?.rua || '',
      bairro: partes[0] || '',
      municipio: partes[1] || '',
      estado: partes[2] || '',
      photo: foto,
      media: [{ url: foto, type: 'image' }],
      coordinates: { lat: coords.lat, lng: coords.lng },
      userLatitude: coords.lat,
      userLongitude: coords.lng,
      createdAt: agora.toISOString(),
      candidateId: clientId,
      mode: 'livre',
      operationTypeId: operacao.id,
      operationTypeLabel: operacao.label,
      accuracy: precisao,
      memberId: member?.id || '',
      memberPhoto: fotoMembro
    };

    const res = await DatabaseService.upsertCheckIn(registro);
    setSalvando(false);
    if (!res.success) {
      notify(`Não foi possível salvar: ${res.error || 'erro'}`, 'error');
      return;
    }
    notify('Check-in confirmado!', 'success');
    onSaved(registro as CheckIn);
  };

  const pronto = Boolean(localConfirmado && foto && operacao);

  const AvatarSistema = () => (
    <span className="shrink-0">
      <BrandMark size={28} rounded={7} />
    </span>
  );

  const AvatarMembro = () => (
    <span className="w-7 h-7 rounded-full bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
      {fotoMembro ? (
        <img
          src={fotoMembro}
          alt={nomeMembro}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-[10px] font-black text-slate-500 uppercase">
          {nomeMembro.substring(0, 2)}
        </span>
      )}
    </span>
  );

  return (
    <div
      className="h-[100dvh] flex flex-col font-sans overflow-hidden"
      style={{ backgroundColor: FUNDO }}
    >
      {/* CABEÇALHO */}
      <header
        className="text-white px-3 py-3 flex items-center gap-2.5 shrink-0"
        style={{ backgroundColor: AZUL }}
      >
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <BrandMark size={32} rounded={8} />
        <h1 className="text-[15px] font-bold tracking-tight">Check-in de campo</h1>
      </header>

      {/* ETAPAS */}
      <div className="bg-white px-5 pt-3 pb-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_ETAPAS }).map((_, i) => {
            const n = i + 1;
            const feito = n < etapa;
            const atual = n === etapa;
            return (
              <React.Fragment key={n}>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 transition-colors"
                  style={{ backgroundColor: feito || atual ? VERDE : '#E2E8F0' }}
                />
                {n < TOTAL_ETAPAS && (
                  <span
                    className="flex-1 h-0.5 rounded-full transition-colors"
                    style={{ backgroundColor: feito ? VERDE : '#E2E8F0' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 font-semibold mt-1.5">
          Etapa {Math.min(etapa, TOTAL_ETAPAS)} de {TOTAL_ETAPAS}
        </p>
      </div>

      {/* FIO */}
      <div className="flex-1 min-h-0 px-3 pt-4 pb-6 space-y-3 overflow-y-auto">
        {mensagens.map(msg => {
          const doSistema = msg.autor === 'sistema';

          // Localização e foto viram cartão azul do lado do integrante.
          if (msg.bloco === 'local' && coords) {
            return (
              <div key={msg.id} className="flex items-end gap-2 flex-row-reverse">
                <AvatarMembro />
                <div
                  className="max-w-[80%] rounded-2xl rounded-br-md overflow-hidden shadow-sm"
                  style={{ backgroundColor: AZUL }}
                >
                  <MiniMapa lat={coords.lat} lng={coords.lng} height={124} />
                  <div className="p-3">
                    <p className="text-[13px] font-bold text-white leading-tight">
                      {endereco?.rua}
                    </p>
                    <p className="text-[11px] text-white/70 font-semibold mt-0.5">
                      {endereco?.resto}
                      {precisao !== null && (
                        <span className="whitespace-nowrap">
                          {endereco?.resto ? ' • ' : ''}Precisão {precisao} m
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-white/50 font-semibold mt-1.5 text-right">
                      {msg.hora}
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          if (msg.bloco === 'foto' && foto) {
            return (
              <div key={msg.id} className="flex items-end gap-2 flex-row-reverse">
                <AvatarMembro />
                <div
                  className="max-w-[80%] rounded-2xl rounded-br-md overflow-hidden shadow-sm"
                  style={{ backgroundColor: AZUL }}
                >
                  <img src={foto} alt="Foto do local" className="w-full h-36 object-cover" />
                  <div className="px-3 py-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white">
                      <Check className="w-3 h-3 stroke-[3]" style={{ color: VERDE }} />
                      Foto enviada
                    </span>
                    <span className="text-[10px] text-white/50 font-semibold">{msg.hora}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${doSistema ? '' : 'flex-row-reverse'}`}
            >
              {doSistema ? <AvatarSistema /> : <AvatarMembro />}
              <div className={`max-w-[78%] ${doSistema ? '' : 'flex flex-col items-end'}`}>
                <div
                  className={`px-3.5 py-2.5 text-[13px] leading-snug shadow-sm ${
                    doSistema
                      ? 'bg-white text-slate-700 rounded-2xl rounded-bl-md border border-slate-100'
                      : 'text-white rounded-2xl rounded-br-md font-semibold'
                  }`}
                  style={doSistema ? undefined : { backgroundColor: AZUL }}
                >
                  {msg.texto}
                </div>
                <span
                  className={`block text-[10px] text-slate-400 font-semibold mt-1 ${
                    doSistema ? '' : 'text-right'
                  }`}
                >
                  {msg.hora}
                </span>
              </div>
            </div>
          );
        })}

        {/* ETAPA 1: mapa arrastável + confirmação do ponto ajustado */}
        {!localConfirmado && (
          <div className="flex items-end gap-2">
            <AvatarSistema />
            <div className="max-w-[80%] w-full">
              {buscandoGps && !coords ? (
                <div className="bg-white rounded-2xl rounded-bl-md border border-slate-100 shadow-sm px-3.5 py-3 flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Capturando sua localização...
                </div>
              ) : erroGps && !coords ? (
                <div className="bg-white rounded-2xl rounded-bl-md border border-slate-100 shadow-sm px-3.5 py-3">
                  <p className="text-[12px] font-bold text-rose-600">{erroGps}</p>
                  <button
                    onClick={capturarLocal}
                    className="mt-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white rounded-xl cursor-pointer"
                    style={{ backgroundColor: AZUL }}
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : coords ? (
                <div className="bg-white rounded-2xl rounded-bl-md border border-slate-100 shadow-sm overflow-hidden">
                  <MapaAjuste
                    gps={gps}
                    centroInicial={coords}
                    seguirGps={seguirGps}
                    height={260}
                    onReady={() => setMapaPronto(true)}
                    onMoverInicio={() => setAjustando(true)}
                    onArrastarInicio={() => definirSeguirGps(false)}
                    onAjustado={aoAjustar}
                    onVoltarAoGps={() => definirSeguirGps(true)}
                  />

                  <div className="p-3">
                    <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: AZUL }} />
                      Arraste o mapa para ajustar o ponto.
                    </p>

                    {ajustando ? (
                      <p className="mt-2 text-[13px] font-bold text-slate-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        Atualizando endereço...
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-[13px] font-bold text-slate-800 leading-tight">
                          {endereco?.rua || 'Localizando endereço...'}
                        </p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                          {endereco?.resto}
                          {precisao !== null && (
                            <span className="whitespace-nowrap">
                              {endereco?.resto ? ' • ' : ''}Precisão {precisao} m
                            </span>
                          )}
                        </p>
                      </>
                    )}

                    <p className="text-[13px] font-bold text-slate-800 mt-3">
                      Este é o seu local atual?
                    </p>

                    <button
                      onClick={confirmarLocal}
                      disabled={!mapaPronto || ajustando}
                      className="mt-2 w-full py-2.5 text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                      style={{ backgroundColor: AZUL }}
                    >
                      {mapaPronto ? 'Confirmar local' : 'Carregando mapa...'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ETAPA 2: câmera */}
        {etapa === 2 && (
          <div className="pl-9">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) enviarFoto(file);
              }}
            />
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={enviandoFoto}
              className="px-4 py-2.5 text-white text-[13px] font-bold rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              style={{ backgroundColor: AZUL }}
            >
              {enviandoFoto ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando foto...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Abrir câmera
                </>
              )}
            </button>
          </div>
        )}

        {/* ETAPA 3: operações do cliente */}
        {etapa === 3 && (
          <div className="pl-9 flex flex-wrap gap-2">
            {operationTypes.length === 0 ? (
              <p className="text-[12px] text-slate-400 font-semibold">
                Nenhuma operação cadastrada para {clientName}.
              </p>
            ) : (
              operationTypes.map(tipo => (
                <button
                  key={tipo.id}
                  onClick={() => escolherOperacao(tipo)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[13px] font-semibold rounded-full shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: tipo.color }}
                  >
                    <OperationIcon icon={tipo.icon} size={10} />
                  </span>
                  {tipo.label}
                </button>
              ))
            )}
          </div>
        )}

        {/* ETAPA 4: resumo */}
        {pronto && (
          <div
            className="rounded-2xl p-4 mt-1 border"
            style={{ backgroundColor: '#E9F8F3', borderColor: '#B6E6D7' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: VERDE }}
              >
                <Check className="w-5 h-5 text-white stroke-[3]" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-black leading-tight" style={{ color: '#05603F' }}>
                  Tudo pronto para iniciar
                </p>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#05603F' }}>
                    <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: VERDE }} />
                    Localização confirmada
                  </li>
                  <li className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#05603F' }}>
                    <Camera className="w-3.5 h-3.5 shrink-0" style={{ color: VERDE }} />
                    Foto anexada
                  </li>
                  <li className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#05603F' }}>
                    <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: VERDE }} />
                    Horário: {horaLocal || horaAgora()}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <div ref={fimRef} />
      </div>

      {/* CONFIRMAÇÃO FINAL */}
      {pronto && (
        <div className="p-3 bg-white border-t border-slate-100 shrink-0">
          <button
            onClick={confirmar}
            disabled={salvando}
            className="w-full py-3.5 text-white text-[13px] font-black uppercase tracking-wider rounded-2xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundColor: AZUL }}
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Confirmar check-in'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
