import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Check,
  Camera,
  Flag,
  MapPin,
  Mic,
  MessageSquare,
  Clock,
  Loader2,
  Pencil
} from 'lucide-react';
import { reverseGeocode } from '../services/streetSources';
import { DatabaseService } from '../databaseClient';
import { OperationType, CheckIn, CheckInMedia, CheckInNote, CheckInOperationRef } from '../types';
import OperationIcon from './OperationIcon';
import BrandMark from './BrandMark';
import MiniMapa from './MiniMapa';
import MapaAjuste from './MapaAjuste';
import CheckInMidias, { MidiaItem, MidiaTipo } from './CheckInMidias';
import CheckInObservacoes, { ObservacaoItem } from './CheckInObservacoes';

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

const TOTAL_ETAPAS = 5;

const horaAgora = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Identificador das linhas filhas do check-in, que o banco guarda como uuid. */
const novoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Foto do integrante, do lado direito da conversa. */
function Avatar({ nome, foto }: { nome: string; foto: string }) {
  return (
    <span className="w-7 h-7 rounded-full bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
      {foto ? (
        <img
          src={foto}
          alt={nome}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-[10px] font-black text-slate-500 uppercase">
          {nome.substring(0, 2)}
        </span>
      )}
    </span>
  );
}

const contar = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

/**
 * Check-in de campo em forma de conversa.
 *
 * Cinco etapas, uma de cada vez: localização, mídias, observações, tipos de
 * operação e revisão. Cada etapa só termina quando a pessoa confirma, e até a
 * confirmação final o check-in fica no banco como rascunho — é a ele que cada
 * foto, vídeo e áudio se liga assim que sobe para o Storage, para nenhum
 * arquivo ficar solto sem dono.
 *
 * A conversa não é uma lista de mensagens acumuladas: ela é desenhada a partir
 * do estado de cada etapa. Por isso voltar para corrigir qualquer etapa é só
 * mudar o número da etapa — o fio se redesenha sozinho, sem mensagem repetida.
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

  const [midias, setMidias] = useState<MidiaItem[]>([]);
  const [midiasConfirmadas, setMidiasConfirmadas] = useState(false);

  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);
  const [obsConfirmadas, setObsConfirmadas] = useState(false);

  const [operacoes, setOperacoes] = useState<OperationType[]>([]);
  const [operacoesConfirmadas, setOperacoesConfirmadas] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [horas, setHoras] = useState<{ [k: string]: string }>({});
  /** Enviar da galeria: desligado até o administrador liberar. */
  const [permitirGaleria, setPermitirGaleria] = useState(false);

  const fimRef = useRef<HTMLDivElement>(null);
  const watchRef = useRef<number | null>(null);
  const geocodeRef = useRef(0);
  /** Último ponto já consultado, para não repetir a busca do mesmo endereço. */
  const ultimoGeocodeRef = useRef<{ lat: number; lng: number } | null>(null);
  /** Espelho de `seguirGps` para ser lido dentro dos avisos do GPS e do mapa. */
  const seguirGpsRef = useRef(true);
  /** Id do check-in: nasce com a tela e acompanha o rascunho até o fim. */
  const checkInIdRef = useRef('checkin_' + Math.random().toString(36).substr(2, 9));
  /** Prévias locais criadas com objectURL, para devolver a memória no fim. */
  const previasRef = useRef<string[]>([]);
  const salvoRef = useRef(false);
  /** Ordem de chegada de cada mídia: a substituição fica no mesmo lugar. */
  const posicoesRef = useRef<{ mapa: { [id: string]: number }; proxima: number }>({
    mapa: {},
    proxima: 0
  });

  const definirSeguirGps = (valor: boolean) => {
    seguirGpsRef.current = valor;
    setSeguirGps(valor);
  };

  const marcarHora = (chave: string) => setHoras(h => ({ ...h, [chave]: horaAgora() }));

  const nomeMembro: string =
    member?.full_name || member?.name || member?.nome || 'Integrante';
  const fotoMembro: string = member?.image || '';

  const midiasProntas = midias.filter(m => m.estado === 'pronto');
  const obsProntas = observacoes.filter(o => o.estado === 'pronto');
  const fotos = midiasProntas.filter(m => m.tipo === 'image').length;
  const videos = midiasProntas.filter(m => m.tipo === 'video').length;
  const textos = obsProntas.filter(o => o.tipo === 'texto').length;
  const audios = obsProntas.filter(o => o.tipo === 'audio').length;

  useEffect(() => {
    const t = setTimeout(
      () => fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
      90
    );
    return () => clearTimeout(t);
  }, [etapa, coords, midias, observacoes, operacoes, mapaPronto]);

  useEffect(() => {
    (async () => {
      const res = await DatabaseService.lerConfiguracao('midia_galeria');
      setPermitirGaleria(res.value === 'sim');
    })();
  }, []);

  useEffect(() => {
    marcarHora('abertura');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previas = previasRef.current;
    return () => previas.forEach(url => URL.revokeObjectURL(url));
  }, []);

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

  // --------------------------------------------------------------- rascunho
  /** Monta o registro do check-in no formato que o banco e a lista esperam. */
  const montarRegistro = (status: 'rascunho' | 'confirmado'): CheckIn => {
    const partes = (endereco?.resto || '').split(',').map(t => t.trim());
    const media: CheckInMedia[] = midiasProntas.map(m => ({
      url: m.url || '',
      type: m.tipo,
      storagePath: m.storagePath
    }));
    const notes: CheckInNote[] = obsProntas.map(o => ({
      id: o.id,
      kind: o.tipo,
      content: o.texto,
      url: o.url,
      storagePath: o.storagePath,
      durationSeconds: o.duracao
    }));
    const operations: CheckInOperationRef[] = operacoes.map(op => ({
      operationTypeId: op.id,
      operationTypeLabel: op.label
    }));

    return {
      id: checkInIdRef.current,
      name: nomeMembro,
      rua: endereco?.rua || '',
      bairro: partes[0] || '',
      municipio: partes[1] || '',
      estado: partes[2] || '',
      photo: media.find(m => m.type === 'image')?.url || media[0]?.url || '',
      media,
      notes,
      operations,
      coordinates: { lat: coords?.lat || 0, lng: coords?.lng || 0 },
      userLatitude: coords?.lat,
      userLongitude: coords?.lng,
      createdAt: new Date().toISOString(),
      candidateId: clientId,
      mode: 'livre',
      status,
      // Primeiro tipo escolhido, para as telas antigas que leem uma operação só.
      operationTypeId: operacoes[0]?.id,
      operationTypeLabel: operacoes[0]?.label,
      accuracy: precisao,
      memberId: member?.id || '',
      memberPhoto: fotoMembro
    } as CheckIn;
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
    marcarHora('local');
    // Veio da revisão para corrigir? Confirmado o ajuste, volta direto para lá.
    setEtapa(midiasConfirmadas && obsConfirmadas && operacoesConfirmadas ? 5 : 2);
    // O rascunho passa a existir no banco: é nele que as mídias vão se ligar.
    DatabaseService.salvarRascunhoCheckIn(montarRegistro('rascunho'));
  };

  // ----------------------------------------------------------------- mídias
  const tipoDoArquivo = (file: File, padrao: MidiaTipo): MidiaTipo =>
    file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : padrao;

  /**
   * Sobe um arquivo e o liga ao rascunho.
   *
   * Passando um id existente, a mídia é substituída no lugar em que está: o
   * arquivo velho sai do Storage e a linha é regravada com o novo.
   */
  const enviarMidia = async (file: File, padrao: MidiaTipo, idExistente?: string) => {
    const tipo = tipoDoArquivo(file, padrao);
    const id = idExistente || novoId();
    if (posicoesRef.current.mapa[id] === undefined) {
      posicoesRef.current.mapa[id] = posicoesRef.current.proxima++;
    }
    const previa = URL.createObjectURL(file);
    previasRef.current.push(previa);

    setMidias(prev => {
      const novo: MidiaItem = { id, tipo, previa, progresso: 0, estado: 'enviando' };
      return prev.some(m => m.id === id) ? prev.map(m => (m.id === id ? novo : m)) : [...prev, novo];
    });

    const res = await DatabaseService.uploadArquivoCheckIn(file, 'midias', pct =>
      setMidias(prev => prev.map(m => (m.id === id ? { ...m, progresso: pct } : m)))
    );

    if (!res.success || !res.url) {
      setMidias(prev =>
        prev.map(m => (m.id === id ? { ...m, estado: 'erro', erro: res.error } : m))
      );
      notify(res.error || 'Não foi possível enviar o arquivo.', 'error');
      return;
    }

    setMidias(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, url: res.url!, storagePath: res.path || undefined, previa: res.url!, progresso: 100, estado: 'pronto' }
          : m
      )
    );

    DatabaseService.registrarMidiaCheckIn(checkInIdRef.current, {
      id,
      url: res.url,
      type: tipo,
      storagePath: res.path || undefined,
      mimeType: file.type,
      sizeBytes: file.size,
      position: posicoesRef.current.mapa[id]
    });
  };

  const adicionarMidias = (arquivos: FileList, padrao: MidiaTipo) =>
    Array.from(arquivos).forEach(file => enviarMidia(file, padrao));

  /** Tira a mídia do check-in — e o arquivo do Storage junto, sem deixar órfão. */
  const removerMidia = (id: string) => {
    const alvo = midias.find(m => m.id === id);
    setMidias(prev => prev.filter(m => m.id !== id));
    if (!alvo) return;
    if (alvo.storagePath) DatabaseService.removerArquivosStorage([alvo.storagePath]);
    DatabaseService.removerMidiaCheckIn(id);
  };

  const substituirMidia = (id: string, file: File) => {
    const alvo = midias.find(m => m.id === id);
    if (alvo?.storagePath) DatabaseService.removerArquivosStorage([alvo.storagePath]);
    enviarMidia(file, alvo?.tipo || 'image', id);
  };

  const confirmarMidias = () => {
    if (midiasProntas.length === 0) {
      notify('Envie pelo menos uma foto ou vídeo do local.', 'error');
      return;
    }
    setMidiasConfirmadas(true);
    marcarHora('midias');
    setEtapa(obsConfirmadas && operacoesConfirmadas ? 5 : 3);
  };

  // ------------------------------------------------------------ observações
  const adicionarTexto = (texto: string) =>
    setObservacoes(prev => [
      ...prev,
      { id: novoId(), tipo: 'texto', texto, progresso: 100, estado: 'pronto' }
    ]);

  const editarTexto = (id: string, texto: string) =>
    setObservacoes(prev => prev.map(o => (o.id === id ? { ...o, texto } : o)));

  const removerObservacao = (id: string) => {
    const alvo = observacoes.find(o => o.id === id);
    setObservacoes(prev => prev.filter(o => o.id !== id));
    if (alvo?.storagePath) DatabaseService.removerArquivosStorage([alvo.storagePath]);
  };

  const enviarAudio = async (blob: Blob, duracao: number) => {
    const id = novoId();
    const previa = URL.createObjectURL(blob);
    previasRef.current.push(previa);
    const extensao = (blob.type.split('/')[1] || 'webm').split(';')[0];
    const arquivo = new File([blob], `observacao_${Date.now()}.${extensao}`, {
      type: blob.type || 'audio/webm'
    });

    setObservacoes(prev => [
      ...prev,
      { id, tipo: 'audio', previa, duracao, progresso: 0, estado: 'enviando' }
    ]);

    const res = await DatabaseService.uploadArquivoCheckIn(arquivo, 'audios', pct =>
      setObservacoes(prev => prev.map(o => (o.id === id ? { ...o, progresso: pct } : o)))
    );

    if (!res.success || !res.url) {
      setObservacoes(prev =>
        prev.map(o => (o.id === id ? { ...o, estado: 'erro', erro: res.error } : o))
      );
      notify(res.error || 'Não foi possível enviar o áudio.', 'error');
      return;
    }

    setObservacoes(prev =>
      prev.map(o =>
        o.id === id
          ? { ...o, url: res.url!, storagePath: res.path || undefined, progresso: 100, estado: 'pronto' }
          : o
      )
    );
  };

  /** Regravar é apagar o áudio que não serviu e abrir espaço para o próximo. */
  const regravarAudio = (id: string) => {
    removerObservacao(id);
    notify('Áudio apagado. Grave o novo quando quiser.', 'info');
  };

  const confirmarObservacoes = () => {
    setObsConfirmadas(true);
    marcarHora('observacoes');
    setEtapa(operacoesConfirmadas ? 5 : 4);
  };

  // -------------------------------------------------------------- operações
  const alternarOperacao = (tipo: OperationType) =>
    setOperacoes(prev =>
      prev.some(o => o.id === tipo.id) ? prev.filter(o => o.id !== tipo.id) : [...prev, tipo]
    );

  const confirmarOperacoes = () => {
    if (operacoes.length === 0) {
      notify('Escolha pelo menos um tipo de operação.', 'error');
      return;
    }
    setOperacoesConfirmadas(true);
    marcarHora('operacoes');
    setEtapa(5);
  };

  // ------------------------------------------------------- voltar e corrigir
  const voltarPara = (destino: number) => {
    setEtapa(destino);
    if (destino === 1) {
      setLocalConfirmado(false);
      // O ponto azul volta a acompanhar o aparelho enquanto a etapa está aberta.
      if (watchRef.current === null) capturarLocal();
    }
    // Só a etapa aberta perde a confirmação: as outras continuam prontas, e a
    // revisão volta assim que esta for confirmada de novo.
    if (destino === 2) setMidiasConfirmadas(false);
    if (destino === 3) setObsConfirmadas(false);
    if (destino === 4) setOperacoesConfirmadas(false);
  };

  // ------------------------------------------------------------ confirmação
  const pronto =
    localConfirmado && midiasConfirmadas && obsConfirmadas && operacoesConfirmadas;

  const confirmar = async () => {
    if (!pronto || !coords || salvando) return;
    setSalvando(true);

    const registro = montarRegistro('confirmado');
    const res = await DatabaseService.upsertCheckIn(registro);
    if (!res.success) {
      setSalvando(false);
      notify(`Não foi possível salvar: ${res.error || 'erro'}`, 'error');
      return;
    }

    await Promise.all([
      DatabaseService.salvarObservacoesCheckIn(checkInIdRef.current, registro.notes || []),
      DatabaseService.salvarOperacoesCheckIn(checkInIdRef.current, registro.operations || [])
    ]);

    salvoRef.current = true;
    setSalvando(false);
    notify('Check-in confirmado!', 'success');
    onSaved(registro);
  };

  /** Sair antes do fim joga fora o rascunho e os arquivos que já subiram. */
  const sair = () => {
    if (!salvoRef.current) {
      const caminhos = [
        ...midias.map(m => m.storagePath),
        ...observacoes.map(o => o.storagePath)
      ].filter(Boolean) as string[];
      if (caminhos.length) DatabaseService.removerArquivosStorage(caminhos);
      if (localConfirmado) DatabaseService.descartarRascunhoCheckIn(checkInIdRef.current);
    }
    onBack();
  };

  const AvatarSistema = <BrandMark size={28} rounded={7} />;
  const AvatarMembro = <Avatar nome={nomeMembro} foto={fotoMembro} />;

  const Fala = ({ texto, hora }: { texto: string; hora?: string }) => (
    <div className="flex items-end gap-2">
      <span className="shrink-0">{AvatarSistema}</span>
      <div className="max-w-[78%]">
        <div className="px-3.5 py-2.5 text-[13px] leading-snug shadow-sm bg-white text-slate-700 rounded-2xl rounded-bl-md border border-slate-100">
          {texto}
        </div>
        <span className="block text-[10px] text-slate-400 font-semibold mt-1">{hora}</span>
      </div>
    </div>
  );

  const Resposta = ({ children, hora }: { children: React.ReactNode; hora?: string }) => (
    <div className="flex items-end gap-2 flex-row-reverse">
      {AvatarMembro}
      <div className="max-w-[80%] flex flex-col items-end">
        <div
          className="px-3.5 py-2.5 text-[13px] leading-snug shadow-sm text-white rounded-2xl rounded-br-md font-semibold"
          style={{ backgroundColor: AZUL }}
        >
          {children}
        </div>
        <span className="block text-[10px] text-slate-400 font-semibold mt-1 text-right">
          {hora}
        </span>
      </div>
    </div>
  );

  const LinhaResumo = ({
    icone,
    texto,
    etapaDestino
  }: {
    icone: React.ReactNode;
    texto: string;
    etapaDestino: number;
  }) => (
    <li className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#05603F' }}>
      <span className="shrink-0">{icone}</span>
      <span className="flex-1 min-w-0">{texto}</span>
      <button
        type="button"
        onClick={() => voltarPara(etapaDestino)}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/70 text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95"
        style={{ color: '#05603F' }}
      >
        <Pencil className="w-3 h-3" />
        Corrigir
      </button>
    </li>
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
          onClick={sair}
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
        <Fala texto="Primeiro, confirme sua localização." hora={horas.abertura} />

        {/* ETAPA 1: mapa arrastável + confirmação do ponto ajustado */}
        {etapa === 1 && (
          <div className="flex items-end gap-2">
            <span className="shrink-0">{AvatarSistema}</span>
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
        {/* Localização confirmada: cartão do ponto escolhido */}
        {localConfirmado && coords && (
          <div className="flex items-end gap-2 flex-row-reverse">
            {AvatarMembro}
            <div
              className="max-w-[80%] rounded-2xl rounded-br-md overflow-hidden shadow-sm"
              style={{ backgroundColor: AZUL }}
            >
              <MiniMapa lat={coords.lat} lng={coords.lng} height={124} />
              <div className="p-3">
                <p className="text-[13px] font-bold text-white leading-tight">{endereco?.rua}</p>
                <p className="text-[11px] text-white/70 font-semibold mt-0.5">
                  {endereco?.resto}
                  {precisao !== null && (
                    <span className="whitespace-nowrap">
                      {endereco?.resto ? ' • ' : ''}Precisão {precisao} m
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-white/50 font-semibold mt-1.5 text-right">
                  {horas.local}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: fotos e vídeos */}
        {etapa >= 2 && (
          <Fala texto="Agora envie as fotos e os vídeos do local." hora={horas.local} />
        )}
        {etapa >= 2 && (midias.length > 0 || etapa === 2) && (
          <CheckInMidias
            itens={midias}
            permitirGaleria={permitirGaleria}
            editavel={etapa === 2}
            avatar={AvatarMembro}
            hora={horas.midias || horas.local}
            onAdicionar={adicionarMidias}
            onRemover={removerMidia}
            onSubstituir={substituirMidia}
            onConfirmar={confirmarMidias}
          />
        )}

        {/* ETAPA 3: observações */}
        {etapa >= 3 && (
          <Fala
            texto="Quer registrar alguma observação? Pode escrever ou gravar um áudio — esta etapa é opcional."
            hora={horas.midias}
          />
        )}
        {etapa >= 3 && (
          <CheckInObservacoes
            itens={observacoes}
            editavel={etapa === 3}
            avatar={AvatarMembro}
            hora={horas.observacoes || horas.midias}
            onAdicionarTexto={adicionarTexto}
            onEditarTexto={editarTexto}
            onRemover={removerObservacao}
            onGravou={enviarAudio}
            onRegravar={regravarAudio}
            onConfirmar={confirmarObservacoes}
          />
        )}
        {etapa > 3 && obsProntas.length === 0 && (
          <Resposta hora={horas.observacoes}>Sem observações.</Resposta>
        )}

        {/* ETAPA 4: tipos de operação do cliente */}
        {etapa >= 4 && (
          <Fala
            texto="Quais operações você vai iniciar? Pode marcar mais de uma."
            hora={horas.observacoes}
          />
        )}
        {etapa === 4 && (
          <div className="flex items-end gap-2 flex-row-reverse">
            <span className="w-7 shrink-0" />
            <div className="max-w-[80%] w-full flex flex-col items-end gap-2">
              {operationTypes.length === 0 ? (
                <p className="text-[12px] text-slate-400 font-semibold text-right">
                  Nenhuma operação cadastrada para {clientName}.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap justify-end gap-2">
                    {operationTypes.map(tipo => {
                      const marcado = operacoes.some(o => o.id === tipo.id);
                      return (
                        <button
                          key={tipo.id}
                          onClick={() => alternarOperacao(tipo)}
                          className={`px-3.5 py-2 text-[13px] font-semibold rounded-full shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                            marcado
                              ? 'text-white border-transparent'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                          style={marcado ? { backgroundColor: AZUL } : undefined}
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: tipo.color }}
                          >
                            <OperationIcon icon={tipo.icon} size={10} />
                          </span>
                          {tipo.label}
                          {marcado && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={confirmarOperacoes}
                    disabled={operacoes.length === 0}
                    className="w-full py-2.5 text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                    style={{ backgroundColor: AZUL }}
                  >
                    Confirmar operações
                  </button>
                  <p className="text-[11px] text-slate-400 font-semibold text-right">
                    {operacoes.length === 0
                      ? 'Marque pelo menos um tipo de operação.'
                      : `${contar(operacoes.length, 'tipo marcado', 'tipos marcados')}.`}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        {operacoesConfirmadas && etapa > 4 && (
          <Resposta hora={horas.operacoes}>
            <span className="flex flex-wrap gap-1.5">
              {operacoes.map(op => (
                <span
                  key={op.id}
                  className="inline-flex items-center gap-1.5 bg-white/15 rounded-full pl-1 pr-2 py-0.5"
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: op.color }}
                  >
                    <OperationIcon icon={op.icon} size={10} />
                  </span>
                  {op.label}
                </span>
              ))}
            </span>
          </Resposta>
        )}

        {/* ETAPA 5: revisão */}
        {etapa >= 5 && (
          <>
            <Fala texto="Confira tudo antes de confirmar o check-in." hora={horas.operacoes} />
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
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-black leading-tight" style={{ color: '#05603F' }}>
                    Revisão do check-in
                  </p>
                  <ul className="mt-2 space-y-2">
                    <LinhaResumo
                      icone={<MapPin className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={endereco?.rua || 'Local confirmado'}
                      etapaDestino={1}
                    />
                    <LinhaResumo
                      icone={<Camera className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={`${contar(fotos, 'foto', 'fotos')} • ${contar(
                        videos,
                        'vídeo',
                        'vídeos'
                      )}`}
                      etapaDestino={2}
                    />
                    <LinhaResumo
                      icone={<MessageSquare className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={`${contar(textos, 'observação', 'observações')} • ${contar(
                        audios,
                        'áudio',
                        'áudios'
                      )}`}
                      etapaDestino={3}
                    />
                    <LinhaResumo
                      icone={<Flag className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={
                        operacoes.map(o => o.label).join(', ') || 'Nenhuma operação'
                      }
                      etapaDestino={4}
                    />
                    <li
                      className="flex items-center gap-2 text-[12px] font-semibold"
                      style={{ color: '#05603F' }}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: VERDE }} />
                      Horário: {horas.local || horaAgora()}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        <div ref={fimRef} />
      </div>

      {/* CONFIRMAÇÃO FINAL */}
      {etapa >= 5 && (
        <div className="p-3 bg-white border-t border-slate-100 shrink-0">
          <button
            onClick={confirmar}
            disabled={salvando || !pronto}
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
