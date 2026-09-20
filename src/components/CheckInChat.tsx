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
  Pencil,
  Plus,
  Maximize2,
  ArrowUp,
  BellRing,
  ClipboardList,
  Target,
  TriangleAlert,
  X
} from 'lucide-react';
import { reverseGeocode } from '../services/streetSources';
import { DatabaseService, isDatabaseConfigured } from '../databaseClient';
import {
  OperationType,
  CheckIn,
  CheckInMedia,
  CheckInNote,
  CheckInOperationRef,
  PriorityLevel,
  CHECKIN_PRIORITIES
} from '../types';
import OperationIcon from './OperationIcon';
import BrandMark from './BrandMark';
import MiniMapa from './MiniMapa';
import MapaAjuste from './MapaAjuste';
import CheckInMidias, { MidiaItem, MidiaTipo } from './CheckInMidias';
import CheckInObservacoes, { ObservacaoItem } from './CheckInObservacoes';

/**
 * Missão enviada pelo comitê e mostrada no alto da conversa.
 *
 * Área e ponto viram a mesma coisa aqui de propósito: na rua os dois são um
 * lugar para ir com uma instrução junto, e a diferença entre círculo e pino
 * só importa no mapa do painel.
 */
export interface MissaoDoCampo {
  id: string;
  tipo: 'area' | 'pin';
  title: string;
  description: string;
  bairro?: string;
  color: string;
  lat: number;
  lng: number;
  /** Só na área: o raio em metros que o comitê desenhou. */
  raio?: number;
  /** Rótulo do tipo de operação, quando o comitê escolheu um. */
  tipoLabel?: string;
  /** Missão sem lugar no mapa: a tarefa é a missão, e o local é onde ela estiver. */
  semLocal?: boolean;
  createdAt?: string;
}

interface CheckInChatProps {
  member: any;
  clientId: string;
  clientName: string;
  operationTypes: OperationType[];
  /**
   * Rótulos já cadastrados no cliente, ligados ou desligados.
   *
   * A lista de cima só traz os ligados, então sem isto quem está na rua
   * recriaria uma categoria que o administrador tinha acabado de desligar.
   */
  nomesReservados?: string[];
  /** Avisa o painel quando uma categoria nasce em campo. */
  onTipoCriado?: (tipo: OperationType) => void;
  /**
   * Missões que o comitê enviou para esta pessoa, neste cliente.
   *
   * Chegam prontas do painel: quem decide o que ela vê é a atribuição feita
   * lá, não esta tela. E chegam pelo tempo real do banco, então uma missão
   * enviada agora aparece na conversa sem ninguém recarregar nada.
   */
  missoes?: MissaoDoCampo[];
  onSaved: (checkIn: CheckIn) => void;
  onBack: () => void;
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
}

/** Cores da marca, fixadas aqui para o fio inteiro falar a mesma língua. */
const AZUL = '#0C3556';
const FUNDO = '#F3F6FA';
const VERDE = '#08A47B';

const TOTAL_ETAPAS = 5;

/** Distância em metros entre dois pontos, para dizer o quão longe é a missão. */
const distanciaEmMetros = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) => {
  const R = 6371000;
  const rad = (grau: number) => (grau * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Metro vira quilômetro quando a conta fica comprida demais para a rua. */
const distanciaCurta = (metros: number) =>
  metros < 1000
    ? `${Math.round(metros)} m`
    : `${(metros / 1000).toFixed(1).replace('.', ',')} km`;

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
  nomesReservados = [],
  onTipoCriado,
  missoes = [],
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
  /** Mapa ocupando a tela toda, para posicionar o ponto com folga. */
  const [mapaCheio, setMapaCheio] = useState(false);
  const [seguirGps, setSeguirGps] = useState(true);
  const [localConfirmado, setLocalConfirmado] = useState(false);

  const [midias, setMidias] = useState<MidiaItem[]>([]);
  const [midiasConfirmadas, setMidiasConfirmadas] = useState(false);

  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);
  const [obsConfirmadas, setObsConfirmadas] = useState(false);

  const [operacoes, setOperacoes] = useState<OperationType[]>([]);
  const [operacoesConfirmadas, setOperacoesConfirmadas] = useState(false);

  /** Categorias criadas aqui na rua, já disponíveis sem recarregar a tela. */
  const [tiposCriados, setTiposCriados] = useState<OperationType[]>([]);
  /**
   * Cadastro rápido de categoria: fechado, digitando o nome, ou conferindo o
   * nome digitado antes de gravar.
   */
  const [passoCategoria, setPassoCategoria] = useState<
    'fechado' | 'digitando' | 'conferindo'
  >('fechado');
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  /** Nível de prioridade escolhido, da lista que o administrador cadastrou. */
  const [prioridade, setPrioridade] = useState('');
  const [niveis, setNiveis] = useState<PriorityLevel[]>([]);

  /**
   * Missão escolhida para este check-in, das que o comitê enviou.
   *
   * Fica em aberto de propósito: quem tem missão atribuída também topa com
   * coisa fora dela na rua, e obrigar a escolher uma transformaria todo
   * registro livre numa missão que ninguém pediu.
   */
  const [missaoId, setMissaoId] = useState<string | null>(null);
  /**
   * Missões que chegaram com a tela já aberta e que a pessoa ainda não viu.
   *
   * Elas ficam marcadas até ela olhar: um aviso que some sozinho em quatro
   * segundos não serve para uma ordem do comitê que ela precisa cumprir.
   */
  const [missoesNovas, setMissoesNovas] = useState<string[]>([]);
  /**
   * Tarja do alto já lida.
   *
   * Tocar nela leva até a missão, mas não apaga o selo do cartão: chegar lá e
   * encontrar três cartões iguais, sem saber qual é o novo, é o mesmo que não
   * ter avisado. O selo só sai quando a pessoa toca no cartão certo.
   */
  const [tarjaVista, setTarjaVista] = useState(false);
  /** Título da missão que o comitê retirou, para explicar o sumiço. */
  const [missaoRetirada, setMissaoRetirada] = useState<string | null>(null);
  /** Aviso curto na própria tela do check-in. */
  const [aviso, setAviso] = useState<{
    texto: string;
    tipo: 'success' | 'error' | 'info';
  } | null>(null);

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
  /** Missões já na tela, para saber o que é novidade e o que foi retirado. */
  const missoesVistasRef = useRef<{ id: string; title: string }[] | null>(null);
  /** Topo do bloco de missões, para o aviso saber para onde levar a pessoa. */
  const blocoMissoesRef = useRef<HTMLDivElement>(null);
  const avisoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ordem de chegada de cada mídia: a substituição fica no mesmo lugar. */
  const posicoesRef = useRef<{ mapa: { [id: string]: number }; proxima: number }>({
    mapa: {},
    proxima: 0
  });

  /**
   * Mostra o recado na tela do check-in, e não só no painel.
   *
   * Esta tela é a única coisa que aparece no aparelho de quem está na rua: o
   * aviso do painel fica numa parte da aplicação que ela nunca vê. Sem isto,
   * "não foi possível enviar o arquivo" some no silêncio.
   */
  const avisar = (texto: string, tipo: 'success' | 'error' | 'info' = 'info') => {
    setAviso({ texto, tipo });
    if (avisoRef.current) clearTimeout(avisoRef.current);
    // Erro fica mais tempo: é o que precisa ser lido até o fim.
    avisoRef.current = setTimeout(() => setAviso(null), tipo === 'error' ? 6500 : 4000);
    // O painel continua sabendo: é dele o histórico da sessão.
    notify(texto, tipo);
  };

  useEffect(
    () => () => {
      if (avisoRef.current) clearTimeout(avisoRef.current);
    },
    []
  );

  const definirSeguirGps = (valor: boolean) => {
    seguirGpsRef.current = valor;
    setSeguirGps(valor);
  };

  const marcarHora = (chave: string) => setHoras(h => ({ ...h, [chave]: horaAgora() }));

  const nomeMembro: string =
    member?.full_name || member?.name || member?.nome || 'Integrante';
  const primeiroNome = nomeMembro.split(' ')[0];
  const fotoMembro: string = member?.image || '';

  /** A missão deste check-in, ou nada: o registro livre continua existindo. */
  const missao = missoes.find(m => m.id === missaoId) || null;

  /**
   * Missões novas que ainda estão de pé.
   *
   * A marca de "nova" é lembrada por id; se o comitê enviou e recolheu antes
   * de a pessoa olhar, a tarja tem de sumir junto — senão ela rola a tela
   * atrás de uma missão que não está mais lá.
   */
  const novasDePe = missoesNovas.filter(id => missoes.some(m => m.id === id));
  const titulosNovos = novasDePe
    .map(id => missoes.find(m => m.id === id)?.title)
    .filter(Boolean)
    .join(', ');

  /**
   * Níveis oferecidos na tela.
   *
   * A lista é a do administrador; sem nada cadastrado, valem os quatro que o
   * sistema já trazia — a etapa não pode ficar sem opção nenhuma.
   */
  const opcoesPrioridade =
    niveis.length > 0
      ? niveis.map(n => ({ id: n.id, label: n.label, color: n.color }))
      : CHECKIN_PRIORITIES.map(p => ({ id: p.value as string, label: p.label, color: p.color }));

  const nivelEscolhido = opcoesPrioridade.find(n => n.id === prioridade);

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

  /**
   * O que mudou nas missões enquanto a tela estava aberta.
   *
   * O banco sincroniza em tempo real, mas a conversa pode estar rolada lá
   * embaixo, na foto ou no áudio: o comitê manda e ninguém vê. Então a
   * chegada vira uma tarja fixa no alto da conversa, que fica lá até a
   * pessoa tocar — e a retirada vira um recado escrito, porque muda o que
   * vai ser gravado.
   */
  useEffect(() => {
    const atuais = missoes.map(m => ({ id: m.id, title: m.title }));
    const antes = missoesVistasRef.current;
    missoesVistasRef.current = atuais;
    // Primeira passada é a carga da tela, não novidade.
    if (antes === null) return;

    const chegaram = atuais.filter(m => !antes.some(a => a.id === m.id));
    if (chegaram.length > 0) {
      setMissoesNovas(prev => [
        ...chegaram.map(m => m.id).filter(id => !prev.includes(id)),
        ...prev
      ]);
      // Missão nova traz a tarja de volta, mesmo que a anterior já tenha sido lida.
      setTarjaVista(false);
    }

    if (missaoId && !atuais.some(m => m.id === missaoId)) {
      setMissaoId(null);
      setMissaoRetirada(antes.find(a => a.id === missaoId)?.title || 'a missão escolhida');
    }
  }, [missoes, missaoId]);

  useEffect(() => {
    (async () => {
      const [galeriaCfg, niveisCfg] = await Promise.all([
        DatabaseService.lerConfiguracao('midia_galeria'),
        DatabaseService.fetchPriorityLevels()
      ]);
      setPermitirGaleria(galeriaCfg.value === 'sim');
      setNiveis(niveisCfg.data);
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
      // Escolheu uma missão, o check-in é dela; sem escolha, é registro livre.
      mode: missao ? 'missao' : 'livre',
      missionId: missao?.id,
      missionTitle: missao?.title,
      priority: prioridade || undefined,
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
    setEtapa(midiasConfirmadas && obsConfirmadas ? 5 : 3);
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
      avisar(res.error || 'Não foi possível enviar o arquivo.', 'error');
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
      avisar('Envie pelo menos uma foto ou vídeo do local.', 'error');
      return;
    }
    setMidiasConfirmadas(true);
    marcarHora('midias');
    setEtapa(obsConfirmadas ? 5 : 4);
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
      avisar(res.error || 'Não foi possível enviar o áudio.', 'error');
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
    avisar('Áudio apagado. Grave o novo quando quiser.', 'info');
  };

  const confirmarObservacoes = () => {
    setObsConfirmadas(true);
    marcarHora('observacoes');
    setEtapa(5);
  };

  // -------------------------------------------------------------- operações
  /**
   * Lista que aparece na etapa 1: os tipos do cliente mais os que nasceram
   * aqui. O id manda na hora de juntar, porque o painel devolve pelas props a
   * mesma categoria que acabou de ser criada — e ela não pode aparecer duas
   * vezes.
   */
  const tiposDisponiveis = React.useMemo(() => {
    const porId = new Map<string, OperationType>();
    [...operationTypes, ...tiposCriados].forEach(t => porId.set(t.id, t));
    return [...porId.values()];
  }, [operationTypes, tiposCriados]);

  /** Nome já usado no cliente, olhando também as categorias desligadas. */
  const nomeJaExiste = (nome: string) =>
    [...tiposDisponiveis.map(t => t.label), ...nomesReservados].some(
      label => label.trim().toLowerCase() === nome.toLowerCase()
    );

  const abrirNovaCategoria = () => {
    setNomeCategoria('');
    setPassoCategoria('digitando');
  };

  /** Do nome digitado para a conferência: "é isso mesmo?". */
  const conferirCategoria = () => {
    const nome = nomeCategoria.trim().replace(/\s+/g, ' ');
    if (nome.length < 2) {
      avisar('Escreva o nome da categoria.', 'error');
      return;
    }
    if (nomeJaExiste(nome)) {
      avisar(`"${nome}" já existe na lista deste cliente.`, 'error');
      return;
    }
    setNomeCategoria(nome);
    setPassoCategoria('conferindo');
  };

  /**
   * Grava a categoria conferida e já deixa ela marcada no check-in.
   *
   * Só o nome é pedido: ícone e cor ficam no padrão e o administrador ajusta
   * depois, no painel. Quem está na rua não deve parar para escolher desenho.
   */
  const criarCategoria = async () => {
    const nome = nomeCategoria.trim();
    if (!nome || salvandoCategoria) return;

    const tipo: OperationType = {
      id: 'op_' + Math.random().toString(36).slice(2, 11),
      label: nome,
      icon: 'flag',
      color: AZUL,
      description: '',
      active: true,
      position: tiposDisponiveis.length,
      candidateId: clientId,
      createdAt: new Date().toISOString()
    };

    // Sem banco configurado (demonstração) a categoria vale só nesta tela.
    if (isDatabaseConfigured) {
      setSalvandoCategoria(true);
      const res = await DatabaseService.upsertOperationType(tipo);
      setSalvandoCategoria(false);

      if (!res.success) {
        avisar('Não deu para salvar a categoria agora. Tente de novo.', 'error');
        return;
      }
    }

    setTiposCriados(prev => [...prev, tipo]);
    // Quem cadastrou é porque vai usar: a categoria nova já entra marcada.
    setOperacoes(prev => [...prev, tipo]);
    onTipoCriado?.(tipo);
    setNomeCategoria('');
    setPassoCategoria('fechado');
    avisar(`Categoria "${nome}" criada e marcada.`, 'success');
  };

  const alternarOperacao = (tipo: OperationType) =>
    setOperacoes(prev =>
      prev.some(o => o.id === tipo.id) ? prev.filter(o => o.id !== tipo.id) : [...prev, tipo]
    );

  const confirmarOperacoes = () => {
    if (operacoes.length === 0) {
      avisar('Escolha pelo menos um tipo de operação.', 'error');
      return;
    }
    if (!prioridade) {
      avisar('Escolha o nível de prioridade.', 'error');
      return;
    }
    setOperacoesConfirmadas(true);
    marcarHora('operacoes');
    // Escolhida a ação, o próximo passo é dizer de onde ela está sendo feita.
    setEtapa(localConfirmado && midiasConfirmadas && obsConfirmadas ? 5 : 2);
  };

  // ------------------------------------------------------- voltar e corrigir
  const voltarPara = (destino: number) => {
    setEtapa(destino);
    // Só a etapa aberta perde a confirmação: as outras continuam prontas, e a
    // revisão volta assim que esta for confirmada de novo.
    if (destino === 1) setOperacoesConfirmadas(false);
    if (destino === 2) {
      setLocalConfirmado(false);
      // O ponto azul volta a acompanhar o aparelho enquanto a etapa está aberta.
      if (watchRef.current === null) capturarLocal();
    }
    if (destino === 3) setMidiasConfirmadas(false);
    if (destino === 4) setObsConfirmadas(false);
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
      avisar(`Não foi possível salvar: ${res.error || 'erro'}`, 'error');
      return;
    }

    await Promise.all([
      DatabaseService.salvarObservacoesCheckIn(checkInIdRef.current, registro.notes || []),
      DatabaseService.salvarOperacoesCheckIn(checkInIdRef.current, registro.operations || [])
    ]);

    salvoRef.current = true;
    setSalvando(false);
    avisar('Check-in confirmado!', 'success');
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

      {/* AVISO: o recado do sistema, na tela que a pessoa está olhando */}
      {aviso && (
        <div
          className="fixed top-3 left-3 right-3 z-50 rounded-2xl px-3.5 py-3 shadow-xl flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            backgroundColor:
              aviso.tipo === 'error' ? '#B91C1C' : aviso.tipo === 'success' ? VERDE : AZUL
          }}
        >
          <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center shrink-0 mt-px">
            {aviso.tipo === 'error' ? (
              <TriangleAlert className="w-3 h-3 text-white" />
            ) : (
              <Check className="w-3 h-3 text-white stroke-[3]" />
            )}
          </span>
          <p className="flex-1 text-[12.5px] font-bold text-white leading-snug">{aviso.texto}</p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="shrink-0 p-0.5 rounded-lg hover:bg-white/15 cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5 text-white/90" />
          </button>
        </div>
      )}

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
        {/* MISSÃO NOVA: fica no alto até a pessoa tocar, não some sozinha */}
        {novasDePe.length > 0 && !tarjaVista && (
          <button
            type="button"
            onClick={() => {
              setTarjaVista(true);
              // A tarja sai do fluxo ao sumir, e a conversa sobe a altura dela.
              // Rolar antes disso deixa o cartão novo cortado no topo.
              setTimeout(
                () =>
                  blocoMissoesRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                  }),
                60
              );
            }}
            className="sticky top-0 z-30 w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-3 shadow-lg cursor-pointer active:scale-[0.99] animate-in fade-in slide-in-from-top-2 duration-200"
            style={{ backgroundColor: VERDE }}
          >
            <span className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center shrink-0">
              <BellRing className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[12.5px] font-black text-white leading-tight">
                {novasDePe.length === 1
                  ? 'O comitê acabou de enviar uma missão para você'
                  : `O comitê acabou de enviar ${novasDePe.length} missões para você`}
              </span>
              <span className="block text-[11px] font-semibold text-white/90 truncate mt-0.5">
                {titulosNovos} · toque para ver
              </span>
            </span>
            <ArrowUp className="w-4 h-4 text-white shrink-0" />
          </button>
        )}

        {/* MISSÃO RETIRADA: muda o que vai ser gravado, então fica escrito */}
        {missaoRetirada && (
          <div
            /* Gruda no alto igual à tarja: se some da vista, o check-in vai
               ser gravado sem a missão e ninguém vai entender por quê. */
            className="sticky top-0 z-20 rounded-2xl border px-3.5 py-3 flex items-start gap-2.5 shadow-lg animate-in fade-in duration-200"
            style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}
          >
            <TriangleAlert className="w-4 h-4 shrink-0 mt-px" style={{ color: '#B45309' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-black leading-tight" style={{ color: '#7C2D12' }}>
                O comitê retirou a missão "{missaoRetirada}"
              </p>
              <p className="text-[11.5px] font-semibold leading-snug mt-0.5" style={{ color: '#92400E' }}>
                Ela saiu da sua lista e não está mais ligada a este check-in. Escolha
                outra missão abaixo ou siga como registro livre.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMissaoRetirada(null)}
              className="shrink-0 p-0.5 rounded-lg hover:bg-black/5 cursor-pointer"
              title="Entendi"
            >
              <X className="w-3.5 h-3.5" style={{ color: '#92400E' }} />
            </button>
          </div>
        )}

        {/* MISSÕES: o que o comitê enviou para esta pessoa, antes de tudo */}
        {missoes.length > 0 && (
          <>
            <Fala
              texto={
                missoes.length === 1
                  ? `${primeiroNome}, o comitê enviou uma missão para você.`
                  : `${primeiroNome}, o comitê enviou ${missoes.length} missões para você. Qual delas você está fazendo agora?`
              }
              hora={horas.abertura}
            />
            <div className="flex items-end gap-2 flex-row-reverse" ref={blocoMissoesRef}>
              <span className="w-7 shrink-0" />
              <div className="max-w-[86%] w-full flex flex-col items-stretch gap-2">
                {missoes.map(missaoDaLista => {
                  const escolhida = missaoDaLista.id === missaoId;
                  const eNova = novasDePe.includes(missaoDaLista.id);
                  // A distância só existe depois do GPS: antes dele, some.
                  const longe = coords
                    ? distanciaEmMetros(coords, missaoDaLista)
                    : null;
                  const cor = missaoDaLista.color || AZUL;
                  /**
                   * Onde a pessoa está em relação à missão.
                   *
                   * Dentro da área, distância até o centro não diz nada de
                   * útil — o que importa é que ela já chegou. Fora dela, o
                   * número é o que decide se dá para ir a pé.
                   */
                  const ondeEstou =
                    missaoDaLista.semLocal || longe === null
                      ? null
                      : missaoDaLista.raio && longe <= missaoDaLista.raio
                        ? 'você já está dentro'
                        : longe < 30
                          ? 'você está no ponto'
                          : `a ${distanciaCurta(longe)} de você`;
                  const detalhes = [
                    missaoDaLista.semLocal
                      ? 'Sem local marcado · faça o check-in onde você estiver'
                      : missaoDaLista.tipo === 'area'
                        ? 'Área de trabalho'
                        : 'Ponto no mapa',
                    missaoDaLista.bairro,
                    missaoDaLista.tipoLabel,
                    missaoDaLista.raio
                      ? `raio de ${distanciaCurta(missaoDaLista.raio)}`
                      : null,
                    ondeEstou
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <button
                      key={missaoDaLista.id}
                      type="button"
                      onClick={() => {
                        setMissaoId(escolhida ? null : missaoDaLista.id);
                        // Tocou: já viu. A marca de novidade sai deste cartão.
                        setMissoesNovas(prev => prev.filter(id => id !== missaoDaLista.id));
                      }}
                      className="w-full text-left rounded-2xl border bg-white px-3.5 py-3 shadow-sm transition-all active:scale-[0.99] cursor-pointer"
                      style={{
                        borderColor: escolhida || eNova ? VERDE : '#E2E8F0',
                        boxShadow:
                          escolhida || eNova ? `0 0 0 2px ${VERDE}33` : undefined
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: `${cor}1A`, color: cor }}
                        >
                          {missaoDaLista.semLocal ? (
                            <ClipboardList className="w-4 h-4" />
                          ) : missaoDaLista.tipo === 'area' ? (
                            <Target className="w-4 h-4" />
                          ) : (
                            <MapPin className="w-4 h-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-black leading-tight" style={{ color: AZUL }}>
                            {missaoDaLista.title}
                          </p>
                          {eNova && (
                            <span
                              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider text-white"
                              style={{ backgroundColor: VERDE }}
                            >
                              <BellRing className="w-2.5 h-2.5" />
                              Chegou agora
                            </span>
                          )}
                          {missaoDaLista.description && (
                            <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5 whitespace-pre-line">
                              {missaoDaLista.description}
                            </p>
                          )}
                          {detalhes && (
                            <p className="text-[10.5px] text-slate-400 font-bold mt-1.5">
                              {detalhes}
                            </p>
                          )}
                        </div>
                        {escolhida && (
                          <span
                            className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: VERDE }}
                          >
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {missaoId ? (
                  <button
                    type="button"
                    onClick={() => setMissaoId(null)}
                    className="self-end px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 cursor-pointer"
                  >
                    Tirar a missão deste check-in
                  </button>
                ) : (
                  <p className="text-[10.5px] text-slate-400 font-semibold text-right leading-snug">
                    Toque na missão que você está fazendo. Se for outra coisa,
                    siga sem escolher — entra como registro livre.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ETAPA 1: tipo de ação do cliente */}
        <Fala
          texto="Qual ação você vai fazer e qual a prioridade dela?"
          hora={horas.abertura}
        />
        {etapa === 1 && (
          <div className="flex items-end gap-2 flex-row-reverse">
            <span className="w-7 shrink-0" />
            <div className="max-w-[80%] w-full flex flex-col items-end gap-2">
              {tiposDisponiveis.length === 0 ? (
                <p className="text-[12px] text-slate-400 font-semibold text-right">
                  Nenhuma operação cadastrada para {clientName}. Crie a sua
                  abaixo.
                </p>
              ) : (
                <div className="w-full grid grid-cols-2 gap-2">
                  {tiposDisponiveis.map(tipo => {
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
              )}

              {/* Categoria que falta: cadastro rápido, só o nome */}
              {passoCategoria === 'fechado' && (
                <button
                  type="button"
                  onClick={abrirNovaCategoria}
                  className="px-3.5 py-2 text-[12.5px] font-bold rounded-full border border-dashed border-slate-300 bg-white text-slate-500 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 hover:border-slate-400 hover:text-slate-700"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  Não achei minha categoria
                </button>
              )}

              {passoCategoria === 'digitando' && (
                <div className="w-full bg-white border border-slate-200 rounded-2xl p-3 shadow-sm space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Nova categoria
                  </p>
                  <input
                    autoFocus
                    value={nomeCategoria}
                    onChange={e => setNomeCategoria(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        conferirCategoria();
                      }
                    }}
                    maxLength={40}
                    placeholder="Nome da categoria"
                    className="w-full px-3 py-2.5 text-[13px] font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-slate-400"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPassoCategoria('fechado')}
                      className="flex-1 py-2.5 text-[12px] font-black uppercase tracking-wider rounded-xl border border-slate-200 text-slate-500 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={conferirCategoria}
                      disabled={nomeCategoria.trim().length < 2}
                      className="flex-1 py-2.5 text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                      style={{ backgroundColor: AZUL }}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {/* Conferência: o nome é lido de volta antes de virar categoria */}
              {passoCategoria === 'conferindo' && (
                <div className="w-full bg-white border border-slate-200 rounded-2xl p-3 shadow-sm space-y-2.5">
                  <p className="text-[12.5px] font-semibold text-slate-600">
                    O nome está certo?
                  </p>
                  <p
                    className="text-[15px] font-black break-words"
                    style={{ color: AZUL }}
                  >
                    {nomeCategoria}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPassoCategoria('digitando')}
                      disabled={salvandoCategoria}
                      className="flex-1 py-2.5 text-[12px] font-black uppercase tracking-wider rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={criarCategoria}
                      disabled={salvandoCategoria}
                      className="flex-1 py-2.5 text-white text-[12px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                      style={{ backgroundColor: VERDE }}
                    >
                      {salvandoCategoria ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                      Está certo
                    </button>
                  </div>
                </div>
              )}

              {/* Nível de prioridade, da lista do administrador */}
              <p className="w-full text-[11px] font-extrabold uppercase tracking-wider text-slate-400 text-right mt-1">
                Prioridade
              </p>
              <div className="w-full grid grid-cols-2 gap-2">
                {opcoesPrioridade.map(nivel => {
                  const marcado = prioridade === nivel.id;
                  return (
                    <button
                      key={nivel.id}
                      type="button"
                      onClick={() => setPrioridade(nivel.id)}
                      className={`px-3.5 py-2 text-[13px] font-semibold rounded-full shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                        marcado
                          ? 'text-white border-transparent'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                      style={marcado ? { backgroundColor: nivel.color } : undefined}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: marcado ? '#ffffff' : nivel.color }}
                      />
                      <span className="truncate">{nivel.label}</span>
                      {marcado && <Check className="w-3.5 h-3.5 stroke-[3] ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={confirmarOperacoes}
                disabled={operacoes.length === 0 || !prioridade}
                className="w-full py-2.5 text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                style={{ backgroundColor: AZUL }}
              >
                Confirmar operações
              </button>
              <p className="text-[11px] text-slate-400 font-semibold text-right">
                {operacoes.length === 0
                  ? 'Marque pelo menos um tipo de operação.'
                  : !prioridade
                    ? 'Escolha o nível de prioridade.'
                    : `${contar(operacoes.length, 'tipo marcado', 'tipos marcados')} • ${
                        nivelEscolhido?.label
                      }.`}
              </p>
            </div>
          </div>
        )}
        {operacoesConfirmadas && etapa > 1 && (
          <Resposta hora={horas.operacoes}>
            <span className="flex flex-wrap gap-1.5">
              {nivelEscolhido && (
                <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full pl-1 pr-2 py-0.5">
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border-2 border-white/50"
                    style={{ backgroundColor: nivelEscolhido.color }}
                  />
                  {nivelEscolhido.label}
                </span>
              )}
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


        {etapa >= 2 && (
          <Fala texto="Agora confirme sua localização." hora={horas.operacoes} />
        )}
        {/* ETAPA 2: mapa arrastável + confirmação do ponto ajustado */}
        {etapa === 2 && (
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
                  {/* Um mapa de cada vez: em tela cheia este sai de cena. */}
                  {mapaCheio ? (
                    <div className="h-[260px] bg-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-500">
                      Ajustando em tela cheia...
                    </div>
                  ) : (
                    <div className="relative">
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
                      <button
                        type="button"
                        onClick={() => setMapaCheio(true)}
                        title="Abrir o mapa em tela cheia"
                        aria-label="Abrir o mapa em tela cheia"
                        className="absolute z-[600] top-2.5 right-2.5 h-9 px-3 rounded-full bg-white shadow-md border border-slate-200 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 cursor-pointer active:scale-95 transition-transform"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Tela cheia
                      </button>
                    </div>
                  )}

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

        {/* ETAPA 3: fotos e vídeos */}
        {etapa >= 3 && (
          <Fala texto="Agora envie as fotos e os vídeos do local." hora={horas.local} />
        )}
        {etapa >= 3 && (midias.length > 0 || etapa === 3) && (
          <CheckInMidias
            itens={midias}
            permitirGaleria={permitirGaleria}
            editavel={etapa === 3}
            avatar={AvatarMembro}
            hora={horas.midias || horas.local}
            onAdicionar={adicionarMidias}
            onRemover={removerMidia}
            onSubstituir={substituirMidia}
            onConfirmar={confirmarMidias}
          />
        )}

        {/* ETAPA 4: observações */}
        {etapa >= 4 && (
          <Fala
            texto="Quer registrar alguma observação? Pode escrever ou gravar um áudio — esta etapa é opcional."
            hora={horas.midias}
          />
        )}
        {etapa >= 4 && (
          <CheckInObservacoes
            itens={observacoes}
            editavel={etapa === 4}
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
        {etapa > 4 && obsProntas.length === 0 && (
          <Resposta hora={horas.observacoes}>Sem observações.</Resposta>
        )}

        {/* ETAPA 5: revisão */}
        {etapa >= 5 && (
          <>
            <Fala texto="Confira tudo antes de confirmar o check-in." hora={horas.observacoes} />
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
                    {missao && (
                      <li
                        className="flex items-center gap-2 text-[12px] font-semibold"
                        style={{ color: '#05603F' }}
                      >
                        <Target className="w-3.5 h-3.5 shrink-0" style={{ color: VERDE }} />
                        <span className="flex-1 min-w-0 truncate">
                          Missão: {missao.title}
                        </span>
                      </li>
                    )}
                    <LinhaResumo
                      icone={<MapPin className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={endereco?.rua || 'Local confirmado'}
                      etapaDestino={2}
                    />
                    <LinhaResumo
                      icone={<Camera className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={`${contar(fotos, 'foto', 'fotos')} • ${contar(
                        videos,
                        'vídeo',
                        'vídeos'
                      )}`}
                      etapaDestino={3}
                    />
                    <LinhaResumo
                      icone={<MessageSquare className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={`${contar(textos, 'observação', 'observações')} • ${contar(
                        audios,
                        'áudio',
                        'áudios'
                      )}`}
                      etapaDestino={4}
                    />
                    <LinhaResumo
                      icone={<Flag className="w-3.5 h-3.5" style={{ color: VERDE }} />}
                      texto={`${operacoes.map(o => o.label).join(', ') || 'Nenhuma operação'}${
                        nivelEscolhido ? ` • ${nivelEscolhido.label}` : ''
                      }`}
                      etapaDestino={1}
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

      {/* MAPA EM TELA CHEIA: o mesmo ajuste, com a tela inteira para mirar */}
      {mapaCheio && coords && (
        <div className="fixed inset-0 z-[4000] bg-white flex flex-col">
          <header
            className="shrink-0 px-3 py-2.5 flex items-center gap-2 text-white"
            style={{ backgroundColor: AZUL }}
          >
            <button
              type="button"
              onClick={() => setMapaCheio(false)}
              aria-label="Sair da tela cheia"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[14px] font-bold tracking-tight">
              Posicione o seu ponto
            </h2>
          </header>

          <div className="flex-1 min-h-0 relative">
            <MapaAjuste
              gps={gps}
              centroInicial={coords}
              seguirGps={seguirGps}
              height="100%"
              onReady={() => setMapaPronto(true)}
              onMoverInicio={() => setAjustando(true)}
              onArrastarInicio={() => definirSeguirGps(false)}
              onAjustado={aoAjustar}
              onVoltarAoGps={() => definirSeguirGps(true)}
            />
          </div>

          <div className="shrink-0 p-3 bg-white border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: AZUL }} />
              Arraste o mapa para ajustar o ponto.
            </p>

            {ajustando ? (
              <p className="mt-1.5 text-[13px] font-bold text-slate-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Atualizando endereço...
              </p>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] font-bold text-slate-800 leading-tight">
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

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMapaCheio(false)}
                className="flex-1 py-3 text-[12px] font-black uppercase tracking-wider rounded-xl border border-slate-200 text-slate-500 cursor-pointer transition-all active:scale-[0.99]"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  // Confirmar daqui fecha a tela cheia e segue o fio normalmente.
                  confirmarLocal();
                  setMapaCheio(false);
                }}
                disabled={!mapaPronto || ajustando}
                className="flex-[2] py-3 text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                style={{ backgroundColor: AZUL }}
              >
                {mapaPronto ? 'Confirmar local' : 'Carregando mapa...'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
