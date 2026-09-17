import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Check, Camera, MapPin, Clock, Loader2 } from 'lucide-react';
import { reverseGeocode } from '../services/streetSources';
import { DatabaseService } from '../databaseClient';
import { OperationType, CheckIn } from '../types';
import OperationIcon from './OperationIcon';

interface CheckInChatProps {
  /** Integrante autenticado: nome e foto reais dele. */
  member: any;
  /** Cliente do link de check-in. */
  clientId: string;
  clientName: string;
  /** Logo do sistema, usada no topo e nas falas do sistema. */
  brandLogo: string;
  /** Tipos de operação cadastrados para este cliente. */
  operationTypes: OperationType[];
  onSaved: (checkIn: CheckIn) => void;
  onBack: () => void;
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
}

type Autor = 'sistema' | 'membro';

interface Mensagem {
  id: string;
  autor: Autor;
  hora: string;
  texto?: string;
  /** Conteúdo especial da bolha: o cartão de localização ou o da foto. */
  bloco?: 'mapa' | 'foto';
}

const TOTAL_ETAPAS = 4;

const horaAgora = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Check-in de campo em forma de conversa.
 *
 * A tela conduz o integrante por quatro etapas — localização, foto, operação e
 * confirmação — e cada passo concluído vira uma mensagem no fio. Tudo o que
 * aparece é real: o nome e a foto vêm do cadastro do integrante, o endereço do
 * GPS do aparelho e os tipos de operação são os que o cliente cadastrou.
 */
export default function CheckInChat({
  member,
  clientId,
  clientName,
  brandLogo,
  operationTypes,
  onSaved,
  onBack,
  notify
}: CheckInChatProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [etapa, setEtapa] = useState(1);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);
  const [endereco, setEndereco] = useState<{
    rua: string;
    bairro: string;
    cidade: string;
    uf: string;
  } | null>(null);
  const [erroGps, setErroGps] = useState<string | null>(null);

  const [foto, setFoto] = useState<string>('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [operacao, setOperacao] = useState<OperationType | null>(null);
  const [salvando, setSalvando] = useState(false);

  const fimRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const mapaRef = useRef<HTMLDivElement>(null);
  const pediuGps = useRef(false);
  const abriuFio = useRef(false);

  const nomeMembro: string =
    member?.full_name || member?.name || member?.nome || 'Integrante';
  const fotoMembro: string = member?.image || '';

  const empilhar = (msg: Omit<Mensagem, 'id' | 'hora'> & { hora?: string }) =>
    setMensagens(prev => [
      ...prev,
      { id: `m${prev.length}_${Date.now()}`, hora: msg.hora || horaAgora(), ...msg }
    ]);

  // O fio já começa pedindo a localização: sem pergunta de abertura.
  useEffect(() => {
    if (abriuFio.current) return;
    abriuFio.current = true;
    empilhar({ autor: 'sistema', texto: 'Primeiro, confirme sua localização.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rola sozinho a cada mensagem nova.
  useEffect(() => {
    // Um quadro de espera: o cartão que acabou de entrar precisa ter altura
    // antes de o fio saber até onde rolar.
    const t = setTimeout(
      () => fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
      80
    );
    return () => clearTimeout(t);
  }, [mensagens, etapa, foto, operacao]);

  // ---------------------------------------------------------------- etapa 1
  useEffect(() => {
    if (pediuGps.current || !navigator.geolocation) return;
    pediuGps.current = true;

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setPrecisao(accuracy ? Math.round(accuracy) : null);

        let achado = { rua: '', bairro: '', cidade: '', uf: '' };
        try {
          const addr = await reverseGeocode(latitude, longitude);
          achado = {
            rua: addr?.road || addr?.displayName || 'Local sem nome de rua',
            bairro: addr?.suburb || '',
            cidade: addr?.city || '',
            uf: addr?.uf || ''
          };
        } catch {
          achado.rua = 'Local capturado por GPS';
        }
        setEndereco(achado);
        setEtapa(2);
        empilhar({ autor: 'sistema', bloco: 'mapa' });
        empilhar({ autor: 'sistema', texto: 'Agora envie uma foto do local.' });
      },
      err => {
        setErroGps(
          err?.code === 1
            ? 'Permita o acesso à localização para continuar.'
            : 'Não foi possível capturar sua localização agora.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mini mapa do cartão de localização, com o pino onde a pessoa está.
  useEffect(() => {
    if (!coords || !mapaRef.current) return;
    let mapa: any;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!mapaRef.current) return;
      mapa = L.map(mapaRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        keyboard: false
      }).setView([coords.lat, coords.lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
      L.marker([coords.lat, coords.lng]).addTo(mapa);
      setTimeout(() => mapa.invalidateSize(), 120);
    })();
    return () => {
      if (mapa) mapa.remove();
    };
  }, [coords]);

  // ---------------------------------------------------------------- etapa 2
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
    empilhar({ autor: 'sistema', bloco: 'foto' });
    empilhar({ autor: 'sistema', texto: 'Qual operação você vai iniciar?' });
  };

  // ---------------------------------------------------------------- etapa 3
  const escolherOperacao = (tipo: OperationType) => {
    setOperacao(tipo);
    setEtapa(4);
    empilhar({ autor: 'membro', texto: tipo.label });
  };

  // ---------------------------------------------------------------- etapa 4
  const confirmar = async () => {
    if (!coords || !foto || !operacao) return;
    setSalvando(true);

    const agora = new Date();
    const registro: any = {
      id: 'checkin_' + Math.random().toString(36).substr(2, 9),
      name: nomeMembro,
      bairro: endereco?.bairro || '',
      rua: endereco?.rua || '',
      municipio: endereco?.cidade || '',
      estado: endereco?.uf || '',
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

  const enderecoLinha1 = endereco?.rua || 'Localização capturada';
  const enderecoLinha2 = [endereco?.bairro, endereco?.cidade, endereco?.uf]
    .filter(Boolean)
    .join(', ');

  const pronto = Boolean(coords && foto && operacao);

  const Avatar = ({ autor }: { autor: Autor }) =>
    autor === 'sistema' ? (
      <div className="w-7 h-7 rounded-full bg-[#0F4C9B] flex items-center justify-center shrink-0 overflow-hidden">
        {brandLogo ? (
          <img src={brandLogo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <MapPin className="w-3.5 h-3.5 text-white" />
        )}
      </div>
    ) : (
      <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
        {fotoMembro ? (
          <img src={fotoMembro} alt={nomeMembro} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-[10px] font-black text-slate-500 uppercase">
            {nomeMembro.substring(0, 2)}
          </span>
        )}
      </div>
    );

  return (
    <div className="h-[100dvh] bg-[#EEF2F7] flex flex-col font-sans overflow-hidden">
      {/* TOPO */}
      <header className="bg-[#0F4C9B] text-white px-3 py-3 flex items-center gap-2.5 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center overflow-hidden shrink-0">
          {brandLogo ? (
            <img src={brandLogo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
        </div>
        <h1 className="text-[15px] font-bold tracking-tight">Check-in de campo</h1>
      </header>

      {/* PROGRESSO */}
      <div className="bg-white px-5 pt-3 pb-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_ETAPAS }).map((_, i) => {
            const n = i + 1;
            const feito = n < etapa;
            const atual = n === etapa;
            return (
              <React.Fragment key={n}>
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    feito || atual ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
                {n < TOTAL_ETAPAS && (
                  <span
                    className={`flex-1 h-0.5 rounded-full transition-colors ${
                      feito ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
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

      {/* FIO DA CONVERSA */}
      <div
        className="flex-1 min-h-0 px-3 pt-4 pb-6 space-y-3 overflow-y-auto"
      >
        {mensagens.map(msg => {
          const doSistema = msg.autor === 'sistema';
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${doSistema ? '' : 'flex-row-reverse'}`}
            >
              <Avatar autor={msg.autor} />
              <div className={`max-w-[78%] ${doSistema ? '' : 'flex flex-col items-end'}`}>
                {msg.bloco === 'mapa' ? (
                  <div className="bg-white rounded-2xl rounded-bl-md shadow-sm border border-slate-100 overflow-hidden">
                    <div ref={mapaRef} className="h-28 w-full bg-slate-100" />
                    <div className="p-3">
                      <p className="text-[13px] font-bold text-slate-800 leading-tight">
                        {enderecoLinha1}
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        {[enderecoLinha2, precisao !== null ? `Precisão ${precisao} m` : '']
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-1 rounded-lg">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Localização confirmada
                        </span>
                        <span className="text-[10px] text-slate-300 font-semibold">
                          {msg.hora}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : msg.bloco === 'foto' ? (
                  <div className="bg-white rounded-2xl rounded-bl-md shadow-sm border border-slate-100 overflow-hidden">
                    <img src={foto} alt="Foto do local" className="w-full h-32 object-cover" />
                    <div className="p-3 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-1 rounded-lg">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Foto enviada
                      </span>
                      <span className="text-[10px] text-slate-300 font-semibold">
                        {msg.hora}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`px-3.5 py-2.5 text-[13px] leading-snug shadow-sm ${
                      doSistema
                        ? 'bg-white text-slate-700 rounded-2xl rounded-bl-md border border-slate-100'
                        : 'bg-[#1D6FD8] text-white rounded-2xl rounded-br-md font-semibold'
                    }`}
                  >
                    {msg.texto}
                  </div>
                )}
                {!msg.bloco && (
                  <span
                    className={`block text-[10px] text-slate-300 font-semibold mt-1 ${
                      doSistema ? '' : 'text-right'
                    }`}
                  >
                    {msg.hora}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Etapa 1 sem GPS */}
        {etapa === 1 && (
          <div className="flex items-center gap-2 pl-9 text-[12px] font-semibold text-slate-400">
            {erroGps ? (
              <span className="text-rose-600">{erroGps}</span>
            ) : (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Capturando sua localização...
              </>
            )}
          </div>
        )}

        {/* Etapa 2: abrir a câmera */}
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
              className="px-4 py-2.5 bg-[#1D6FD8] hover:bg-blue-700 text-white text-[13px] font-bold rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95"
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

        {/* Etapa 3: tipos de operação do cliente */}
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

        {/* Etapa 4: resumo */}
        {pronto && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-1">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-white stroke-[3]" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-black text-emerald-900 leading-tight">
                  Tudo pronto para iniciar
                </p>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-center gap-2 text-[12px] font-semibold text-emerald-800">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Localização confirmada
                  </li>
                  <li className="flex items-center gap-2 text-[12px] font-semibold text-emerald-800">
                    <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Foto anexada
                  </li>
                  <li className="flex items-center gap-2 text-[12px] font-semibold text-emerald-800">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Horário: {horaAgora()}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <div ref={fimRef} />
      </div>

      {/* BOTÃO FINAL */}
      {pronto && (
        <div className="p-3 bg-white border-t border-slate-100 shrink-0">
          <button
            onClick={confirmar}
            disabled={salvando}
            className="w-full py-3.5 bg-[#1D6FD8] hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-black uppercase tracking-wider rounded-2xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
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
