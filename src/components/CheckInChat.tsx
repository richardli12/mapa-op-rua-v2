import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  BellRing,
  Camera,
  Check,
  Flag,
  Loader2,
  Maximize2,
  MapPin,
  Navigation,
  MessageSquare,
  Pencil,
  Plus,
  Siren,
  Target,
  TriangleAlert,
  X
} from 'lucide-react';
import { reverseGeocode } from '../services/streetSources';
import { DatabaseService, isDatabaseConfigured } from '../databaseClient';
import {
  MaterialDeApoio,
  OperationType,
  CheckIn,
  CheckInMedia,
  CheckInNote,
  CheckInOperationRef,
  PriorityLevel,
  CHECKIN_PRIORITIES
} from '../types';
import OperationIcon from './OperationIcon';
import MiniMapa from './MiniMapa';
import MapaAjuste from './MapaAjuste';
import {
  METAS_VAZIAS,
  MetasDoCliente,
  alvoDoDia,
  corDoAvanco,
  janelaDaMeta,
  progressoDaPessoa,
  temMeta
} from '../metas';
import {
  CHAVE_TURNOS,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TURNOS_PADRAO,
  TurnoId,
  janelaDoTurno,
  lerTurnos,
  ordemDoTurno,
  situacaoDoTurno,
  turnoDeAgora
} from '../turnos';
import {
  AZUL,
  Avatar,
  BlocoDoIntegrante,
  BotaoPrincipal,
  Fala,
  FUNDO,
  Resposta,
  VERDE,
  contar,
  horaAgora,
  vibrar
} from './checkin/pecas';
import Cabecalho from './checkin/Cabecalho';
import { EtapaDaTrilha } from './checkin/Trilha';
import Doca from './checkin/Doca';
import ControlesDeMidia from './checkin/ControlesDeMidia';
import CompositorDeObservacao from './checkin/CompositorDeObservacao';
import BolhaDeMidias from './checkin/BolhaDeMidias';
import BolhaDeObservacoes from './checkin/BolhaDeObservacoes';
import PainelDoDia from './checkin/PainelDoDia';
import FolhaDeSaida from './checkin/FolhaDeSaida';
import Concluido from './checkin/Concluido';
import OrdemDoComite from './checkin/OrdemDoComite';
import { MidiaItem, MidiaTipo, MissaoDoCampo, ObservacaoItem } from './checkin/tipos';
import {
  cumpridaHoje,
  distanciaCurta,
  distanciaEmMetros,
  eUrgente,
  linkDeRota,
  nivelDoTopo,
  situacaoDeChegada
} from './checkin/missoes';
import Chegada from './checkin/Chegada';

/*
 * O tipo continua saindo daqui para quem já o importava — o painel monta as
 * missões antes de passá-las para esta tela.
 */
export type { MissaoDoCampo };

interface CheckInChatProps {
  member: any;
  clientId: string;
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
  /** A meta que o comitê cadastrou para esta equipe. */
  metas?: MetasDoCliente;
  /** Os check-ins que esta pessoa já fez neste cliente. */
  meusCheckIns?: any[];
  onSaved: (checkIn: CheckIn) => void;
  onBack: () => void;
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
}

const TOTAL_ETAPAS = 5;

/** Identificador das linhas filhas do check-in, que o banco guarda como uuid. */
const novoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/**
 * Check-in de campo em forma de conversa.
 *
 * O componente de fora existe só para uma coisa: trocar a chave do fio quando
 * a pessoa pede o próximo check-in. Cada registro é uma sessão inteira — GPS,
 * rascunho no banco, arquivos no Storage, etapas confirmadas — e a forma
 * honesta de começar outro é nascer de novo, não limpar campo por campo e
 * torcer para não ter esquecido nenhum.
 */
export default function CheckInChat(props: CheckInChatProps) {
  const [sessao, setSessao] = useState(0);
  /* A chave vai no fragmento: trocá-la desmonta o fio inteiro e monta outro
     do zero, que é exatamente o que "fazer outro check-in" significa. */
  return (
    <React.Fragment key={sessao}>
      <FioDoCheckIn {...props} onNovo={() => setSessao(s => s + 1)} />
    </React.Fragment>
  );
}

/**
 * O fio: cinco etapas, uma de cada vez.
 *
 * Localização, mídias, observações, tipos de operação e revisão. Cada etapa só
 * termina quando a pessoa confirma, e até a confirmação final o check-in fica
 * no banco como rascunho — é a ele que cada foto, vídeo e áudio se liga assim
 * que sobe para o Storage, para nenhum arquivo ficar solto sem dono.
 *
 * A conversa não é uma lista de mensagens acumuladas: ela é desenhada a partir
 * do estado de cada etapa. Por isso voltar para corrigir qualquer etapa é só
 * mudar o número da etapa — o fio se redesenha sozinho, sem mensagem repetida.
 *
 * A tela tem três faixas fixas e uma que rola. Em cima, o cabeçalho vivo
 * (quem é, turno, GPS, sinal, meta) com a trilha das etapas. No meio, o fio.
 * Embaixo, a doca — o único lugar onde a ação da etapa acontece. Quem está na
 * rua nunca precisa rolar atrás de um botão.
 */
function FioDoCheckIn({
  member,
  clientId,
  operationTypes,
  nomesReservados = [],
  onTipoCriado,
  missoes = [],
  metas = METAS_VAZIAS,
  meusCheckIns = [],
  onSaved,
  onBack,
  onNovo,
  notify
}: CheckInChatProps & { onNovo: () => void }) {
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
  const [janelas, setJanelas] = useState<JanelaDeTurno[]>(TURNOS_PADRAO);
  /**
   * O minuto de agora, batendo de dois em dois minutos.
   *
   * O cabeçalho diz "fecha em 12 min" e a lista da rua reordena sozinha quando
   * o turno vira. Sem este pulso, quem deixa a tela aberta às 11h50 continua
   * vendo a manhã como o turno de agora ao meio-dia e meia.
   */
  const [pulso, setPulso] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setPulso(Date.now()), 120000);
    return () => window.clearInterval(t);
  }, []);

  /**
   * Tem sinal?
   *
   * Câmera aberta sem rede é foto perdida e minuto perdido: o arquivo sobe,
   * falha, e quem está na rua descobre pelo aviso vermelho. Com isto, a doca
   * apaga os botões antes de a pessoa gastar o movimento, e o cabeçalho diz
   * por quê.
   */
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  useEffect(() => {
    const ligou = () => setOnline(true);
    const caiu = () => setOnline(false);
    window.addEventListener('online', ligou);
    window.addEventListener('offline', caiu);
    return () => {
      window.removeEventListener('online', ligou);
      window.removeEventListener('offline', caiu);
    };
  }, []);

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
  /** A folha do dia (meta, turnos, o que já entrou), aberta pelo cabeçalho. */
  const [diaAberto, setDiaAberto] = useState(false);
  /** A pergunta antes de descartar o que já foi juntado. */
  const [perguntandoSaida, setPerguntandoSaida] = useState(false);
  /** O check-in gravado: daqui em diante a tela é o fecho, não o fio. */
  const [concluido, setConcluido] = useState<CheckIn | null>(null);

  const fimRef = useRef<HTMLDivElement>(null);
  const watchRef = useRef<number | null>(null);
  const geocodeRef = useRef(0);
  /** Último ponto já consultado, para não repetir a busca do mesmo endereço. */
  const ultimoGeocodeRef = useRef<{ lat: number; lng: number } | null>(null);
  /** Espelho de `seguirGps` para ser lido dentro dos avisos do GPS e do mapa. */
  const seguirGpsRef = useRef(true);
  /**
   * Indo para uma missão: o GPS não pode parar.
   *
   * No registro livre a captura é uma foto do lugar — pega a melhor leitura,
   * desliga e economiza bateria. Indo para a missão é outra coisa: a tela diz
   * "faltam 640 m" e esse número tem de encolher enquanto a pessoa anda. Com
   * o acompanhamento desligado ela caminharia até a porta e o botão de
   * iniciar continuaria apagado, jurando que ela está a seiscentos metros de
   * onde está pisando.
   *
   * Por isso, enquanto a missão não começa, toda leitura vale — inclusive a
   * de precisão pior, porque ela não é um chute melhor sobre o mesmo ponto: é
   * um ponto novo.
   */
  const seguindoMissaoRef = useRef(false);
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
    if (tipo === 'error') vibrar([25, 70, 25]);
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

  /** O topo da régua de gravidade deste cliente. */
  const topoDaRegua = React.useMemo(() => nivelDoTopo(niveis), [niveis]);

  /**
   * As ordens urgentes que ainda estão de pé.
   *
   * Urgente é o topo da régua que o administrador cadastrou — não um nome
   * fixo no código. E "de pé" é o que ainda não foi cumprido hoje: a ordem
   * gravada sai da lista na hora, senão quem cumpriu ficaria trancado o
   * resto do dia por causa do próprio trabalho.
   */
  const urgentesPendentes = React.useMemo(
    () =>
      missoes
        .filter(m => eUrgente(m, topoDaRegua) && !cumpridaHoje(m, meusCheckIns))
        /*
         * A que espera há mais tempo vem antes — a mesma régua que a lista lá
         * embaixo usa. Ordenar aqui e não só na lista importa: é desta ordem
         * que sai a ordem escolhida sozinha quando a tela tranca.
         */
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    [missoes, topoDaRegua, meusCheckIns]
  );

  /**
   * A rua está trancada?
   *
   * Existindo ordem urgente aberta, não há escolha a fazer: ela entra no
   * check-in e o registro livre e as outras missões saem de cena.
   *
   * A exceção é a ordem que chega no meio do caminho. Quem já marcou o ponto
   * ou já mandou foto está com trabalho em cima da mesa, e apagar isso para
   * impor a ordem nova seria punir quem estava trabalhando: nesse caso a
   * tranca espera o registro atual ser gravado. Escolher a operação não
   * conta como trabalho em cima da mesa — é um toque, e se refaz em um.
   */
  const trabalhoEmCima =
    localConfirmado || midias.length > 0 || observacoes.length > 0;
  const travado =
    urgentesPendentes.length > 0 &&
    (!trabalhoEmCima || urgentesPendentes.some(m => m.id === missaoId));

  /**
   * Trancado, a ordem entra sozinha no check-in.
   *
   * Sem isto a pessoa veria a ordem na tela e mesmo assim gravaria um
   * registro livre — e é exatamente isso que não pode acontecer.
   */
  useEffect(() => {
    if (!travado) return;
    if (missaoId && urgentesPendentes.some(m => m.id === missaoId)) return;
    setMissaoId(urgentesPendentes[0]?.id ?? null);
  }, [travado, urgentesPendentes, missaoId]);

  /** A ordem urgente chegou com um registro livre já em andamento. */
  const urgenteEsperando = urgentesPendentes.length > 0 && !travado;

  /**
   * O check-in é de missão?
   *
   * É a pergunta que muda a forma da tela inteira. Com missão, o comitê já
   * decidiu o que é para fazer e o quanto aquilo é grave — perguntar de novo
   * na rua é pedir para a pessoa concordar consigo mesma, com o risco de ela
   * contradizer a classificação de quem mandou. Então a etapa da ação some,
   * e o que sobra é o que só quem está lá pode dar: chegar, fotografar,
   * contar o que viu.
   */
  const modoMissao = !!missao;

  /**
   * Escolhida a missão, a etapa da ação não existe mais.
   *
   * Vale também para a ordem urgente que entra sozinha: a tela tranca e já
   * abre na chegada, sem passar por uma pergunta que não é mais dela.
   */
  useEffect(() => {
    if (modoMissao && etapa === 1) setEtapa(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoMissao]);

  /** O turno que está acontecendo agora, recalculado a cada pulso. */
  const turnoAgora = React.useMemo(() => turnoDeAgora(janelas), [janelas, pulso]);

  /** "Bom dia, Daniel" — pelo relógio do aparelho, como qualquer conversa. */
  const saudacao = React.useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * O quanto um nível pesa.
   *
   * A régua é a do administrador: quanto maior a posição na lista dele, mais
   * grave. Missão sem prioridade fica abaixo de qualquer nível cadastrado —
   * não é "a menos grave", é a que ninguém classificou.
   */
  const pesoDaPrioridade = (id?: string) => {
    const nivel = niveis.find(n => n.id === id);
    return nivel ? nivel.position : -1;
  };

  /**
   * A ordem do dia.
   *
   * Cinco missões chegam juntas e a pessoa na rua escolhe a primeira da
   * lista — então a primeira da lista precisa ser a certa. A ordem é a de
   * quem está com o colete na rua às dez da manhã: primeiro o que é para
   * agora, do mais grave para o menos; depois o que serve a qualquer hora;
   * depois o que ainda vai abrir, na ordem do relógio; e por último o que
   * perdeu a janela — que continua na tela, porque missão atrasada não pode
   * sumir, mas sai da frente do que ainda dá para fazer.
   */
  const missoesEmOrdem = React.useMemo(() => {
    const urgente = (m: MissaoDoCampo) => urgentesPendentes.some(u => u.id === m.id);
    const grupo = (m: MissaoDoCampo) => {
      // A ordem urgente não espera turno: ela é a primeira, sempre.
      if (urgente(m)) return -1;
      if (!m.turno) return 1;
      if (m.turno === turnoAgora) return 0;
      return situacaoDoTurno(janelaDoTurno(janelas, m.turno)).estado === 'passou' ? 3 : 2;
    };
    return [...missoes].sort((a, b) => {
      const ga = grupo(a);
      const gb = grupo(b);
      if (ga !== gb) return ga - gb;
      /*
       * Entre urgentes, a que espera há mais tempo vem antes.
       * Poderia ser a mais perto, mas a distância muda a cada passo que a
       * pessoa dá — e lista que se reordena sozinha debaixo do dedo faz
       * tocar na missão errada.
       */
      if (ga === -1) return (a.createdAt || '').localeCompare(b.createdAt || '');
      if (ga === 2) {
        const oa = ordemDoTurno(janelas, a.turno);
        const ob = ordemDoTurno(janelas, b.turno);
        if (oa !== ob) return oa - ob;
      }
      const pa = pesoDaPrioridade(a.priority);
      const pb = pesoDaPrioridade(b.priority);
      if (pa !== pb) return pb - pa;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missoes, janelas, niveis, turnoAgora, pulso, urgentesPendentes]);

  /** Quantas missões são para a hora de agora. */
  const quantasAgora = missoesEmOrdem.filter(m => m.turno && m.turno === turnoAgora).length;

  /**
   * Missões novas que ainda estão de pé.
   *
   * A marca de "nova" é lembrada por id; se o comitê enviou e recolheu antes
   * de a pessoa olhar, a tarja tem de sumir junto — senão ela rola a tela
   * atrás de uma missão que não está mais lá.
   */
  const novasDePe = missoesNovas.filter(id => missoes.some(m => m.id === id));
  /** Alguma das novidades é ordem urgente? Muda a cor e o texto da tarja. */
  const algumaNovaUrgente = novasDePe.some(id =>
    urgentesPendentes.some(m => m.id === id)
  );
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
  const enviandoMidia = midias.some(m => m.estado === 'enviando');
  const enviandoAudio = observacoes.some(o => o.estado === 'enviando');

  /**
   * A meta desta pessoa, do jeito que o cabeçalho precisa.
   *
   * Sem meta cadastrada o anel some: cobrar número que ninguém definiu é
   * inventar cobrança.
   */
  const meta = React.useMemo(() => {
    if (!temMeta(metas)) return null;
    const alvo = alvoDoDia(metas, member?.id || '');
    if (alvo <= 0) return null;
    const janelaDoAlvo = janelaDaMeta(metas);
    const avanco = progressoDaPessoa(meusCheckIns, janelas, janelaDoAlvo.de, janelaDoAlvo.ate);
    return {
      feito: avanco.total,
      alvo,
      rotulo: janelaDoAlvo.rotulo,
      cor: corDoAvanco(avanco.total, alvo)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas, meusCheckIns, janelas, member?.id, pulso]);

  /**
   * O fim do fio sempre à vista.
   *
   * São dois tempos de propósito. O primeiro acompanha a mudança que acabou de
   * acontecer; o segundo existe porque o que entra no fio tem altura tardia —
   * o mapa mede o container depois de montado, a foto só ocupa espaço quando
   * carrega, a bolha entra animada. Com um tempo só, a ficha da revisão ficava
   * cortada pela doca e parecia que faltava alguma coisa.
   */
  /*
   * O que faz o fio CRESCER — e só isso.
   *
   * A rolagem tem de acompanhar o que entra na conversa: uma etapa
   * confirmada, uma foto, um recado, o mapa que terminou de montar. Ela não
   * pode disparar no que apenas muda de valor dentro do que já está na tela,
   * e era isso que acontecia: cada leitura do GPS, cada 1% de upload, cada
   * endereço rebuscado e cada letra digitada na edição de um recado geravam
   * um objeto novo, o efeito rodava de novo e a tela descia sozinha debaixo
   * do dedo de quem estava lendo ou escrevendo. Andando para uma missão, com
   * o GPS acompanhando cada passo, isso era uma tela que não parava quieta.
   *
   * Por isso a dependência deixa de ser o conteúdo e passa a ser a forma
   * dele: as contagens e os marcos que mudam a altura do fio.
   */
  const formaDoFio = [
    etapa,
    midias.length,
    observacoes.length,
    operacoes.length,
    coords ? 1 : 0,
    mapaPronto ? 1 : 0,
    travado ? 1 : 0,
    localConfirmado ? 1 : 0
  ].join('|');

  useEffect(() => {
    /*
     * Com ordem urgente aberta e nada feito ainda, o fim do fio é o lugar
     * errado. O fio desce sozinho até a etapa 1 e a ordem — que é o que a
     * pessoa precisa ler antes de qualquer coisa — fica acima da dobra,
     * escondida pela própria rolagem automática. Enquanto ela não confirma a
     * primeira etapa, quem manda na tela é a ordem.
     */
    const naOrdem = travado && etapa <= 2 && !localConfirmado;
    const ancora = naOrdem ? blocoMissoesRef.current : fimRef.current;
    const ir = () =>
      ancora?.scrollIntoView({ behavior: 'smooth', block: naOrdem ? 'start' : 'end' });
    const perto = setTimeout(ir, 90);
    const longe = setTimeout(ir, 520);
    return () => {
      clearTimeout(perto);
      clearTimeout(longe);
    };
    // A forma do fio já resume as dependências; o resto é leitura de valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formaDoFio]);

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
      /* Ordem urgente chega com outro tranco: quem está de costas para a tela
         precisa sentir a diferença sem olhar. */
      const temUrgente = chegaram.some(c => {
        const m = missoes.find(x => x.id === c.id);
        return m ? eUrgente(m, nivelDoTopo(niveis)) : false;
      });
      vibrar(temUrgente ? [60, 90, 60, 90, 120] : [15, 80, 15]);
    }

    if (missaoId && !atuais.some(m => m.id === missaoId)) {
      setMissaoId(null);
      setMissaoRetirada(antes.find(a => a.id === missaoId)?.title || 'a missão escolhida');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missoes, missaoId]);

  useEffect(() => {
    (async () => {
      const [galeriaCfg, niveisCfg, turnosCfg] = await Promise.all([
        DatabaseService.lerConfiguracao('midia_galeria'),
        DatabaseService.fetchPriorityLevels(),
        DatabaseService.lerConfiguracao(CHAVE_TURNOS)
      ]);
      setPermitirGaleria(galeriaCfg.value === 'sim');
      setNiveis(niveisCfg.data);
      if (turnosCfg.value) setJanelas(lerTurnos(turnosCfg.value));
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
  const atualizarEndereco = async (lat: number, lng: number, forcado = false) => {
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
    /*
     * Andando até a missão, o endereço espera.
     *
     * O acompanhamento entrega uma leitura por segundo, e uma consulta de
     * endereço por leitura é uma consulta por segundo no Nominatim — que
     * responde a isso bloqueando o serviço inteiro. Durante o trajeto o
     * endereço também não serve para nada: quem está andando olha a
     * distância, não o nome da rua em que pisa agora. Ele é buscado de novo a
     * cada oitenta metros, para o cartão não ficar mentindo, e sempre na hora
     * de iniciar a missão, que é quando ele vira parte do registro.
     */
    if (!forcado && seguindoMissaoRef.current && anterior) {
      const longe = distanciaEmMetros(anterior, { lat, lng });
      if (longe < 80) {
        setAjustando(false);
        return;
      }
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
      const seguindo = seguindoMissaoRef.current;
      const anterior = melhor?.coords.accuracy ?? Infinity;
      if (!seguindo && melhor && pos.coords.accuracy > anterior) return;
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
      // Indo para a missão, porém, o que interessa não é a precisão: é o
      // próximo passo que a pessoa dá.
      if (!seguindo && accuracy && accuracy <= 20) encerrarBusca();
    };

    watchRef.current = navigator.geolocation.watchPosition(
      receber,
      err => {
        /*
         * Erro de GPS quase nunca é o fim do GPS.
         *
         * Quem anda dois quarteirões entra numa galeria, passa embaixo de uma
         * marquise e o aparelho devolve "posição indisponível" por alguns
         * segundos — e volta sozinho assim que enxerga o céu. Encerrar o
         * acompanhamento no primeiro tropeço congelava a distância até a
         * missão: a pessoa chegava na porta e o botão de iniciar continuava
         * apagado, jurando que ela estava a dois quilômetros dali.
         *
         * Então, indo para a missão e já tendo uma leitura no bolso, o erro é
         * ignorado. Só a negativa de permissão e o erro antes da primeira
         * leitura encerram de verdade.
         */
        const negado = err?.code === 1;
        if (!negado && melhor && seguindoMissaoRef.current) return;
        encerrarBusca();
        setBuscandoGps(false);
        if (melhor) return; // já havia uma leitura boa; o erro seguinte não apaga
        setErroGps(
          negado
            ? 'Permita o acesso à localização para continuar.'
            : 'Não foi possível capturar sua localização agora.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    setTimeout(() => {
      if (!seguindoMissaoRef.current) encerrarBusca();
    }, 12000);
  };

  useEffect(() => {
    capturarLocal();
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Pegando uma missão depois de o GPS já ter desligado, ele volta a ligar.
   *
   * O acompanhamento se encerra sozinho quando a leitura fica boa — e é aí
   * que a pessoa costuma escolher a missão. Sem isto, ela sairia andando com
   * a distância congelada no valor de quando abriu a tela.
   */
  useEffect(() => {
    seguindoMissaoRef.current = modoMissao && !localConfirmado;
    if (seguindoMissaoRef.current && watchRef.current === null) capturarLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoMissao, localConfirmado]);

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
    const operations: CheckInOperationRef[] = operacoesDoRegistro.map(op => ({
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
      priority: prioridadeDoRegistro || undefined,
      status,
      // Primeiro tipo escolhido, para as telas antigas que leem uma operação só.
      operationTypeId: operacoesDoRegistro[0]?.id,
      operationTypeLabel: operacoesDoRegistro[0]?.label,
      accuracy: precisao,
      memberId: member?.id || '',
      memberPhoto: fotoMembro
    } as CheckIn;
  };

  const confirmarLocal = () => {
    // O ponto salvo é o centro do mapa neste instante, já ajustado pela pessoa.
    if (!coords || ajustando) return;
    /*
     * Missão só começa no lugar dela.
     *
     * A doca já mantém o botão apagado enquanto a pessoa está longe, mas a
     * checagem mora aqui também: o botão da tela cheia do mapa chama esta
     * mesma função, e uma regra que vale em um caminho e não no outro não é
     * regra.
     */
    if (modoMissao && !chegada.pode) {
      avisar(
        `Você ainda está a ${distanciaCurta(chegada.faltam)} do ponto da missão.`,
        'error'
      );
      return;
    }
    // A partir daqui o ponto está fechado: o GPS para de acompanhar.
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    definirSeguirGps(false);
    setLocalConfirmado(true);
    marcarHora('local');
    // O endereço do ponto gravado é buscado agora, sem a espera do trajeto.
    if (modoMissao) atualizarEndereco(coords.lat, coords.lng, true);
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

  /**
   * A ação e a prioridade que vão para o banco.
   *
   * No registro livre são as que a pessoa marcou. Na missão são as que o
   * comitê definiu quando mandou a ordem — o rótulo sai do cadastro do
   * cliente pelo id que veio junto, e não do texto solto, para o painel poder
   * agrupar depois. Missão de área não traz tipo nenhum: aí o check-in vai
   * sem operação, e quem classifica é o título da missão.
   */
  const operacoesDoRegistro = React.useMemo<OperationType[]>(() => {
    if (!modoMissao) return operacoes;
    const doCadastro = missao?.tipoId
      ? tiposDisponiveis.find(t => t.id === missao.tipoId)
      : undefined;
    if (doCadastro) return [doCadastro];
    if (missao?.tipoId && missao?.tipoLabel) {
      // Tipo apagado do cadastro depois de a missão ter sido criada.
      return [{ id: missao.tipoId, label: missao.tipoLabel } as OperationType];
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoMissao, operacoes, missao, tiposDisponiveis]);

  const prioridadeDoRegistro = modoMissao ? missao?.priority || '' : prioridade;

  /** O nível que vai gravado: o da ordem na missão, o marcado no livre. */
  const nivelDoRegistro = opcoesPrioridade.find(n => n.id === prioridadeDoRegistro);

  /**
   * A trava de chegada da missão escolhida.
   *
   * Recalculada a cada leitura nova do GPS: é ela que faz o "faltam 640 m"
   * encolher enquanto a pessoa anda, e é ela que acende o botão de iniciar.
   */
  const chegada = React.useMemo(
    () =>
      missao
        ? situacaoDeChegada(missao, coords, precisao)
        : { pode: false, semLocal: false, distancia: null, faltam: 0, limite: 0 },
    [missao, coords, precisao]
  );

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

  const alternarOperacao = (tipo: OperationType) => {
    vibrar();
    setOperacoes(prev =>
      prev.some(o => o.id === tipo.id) ? prev.filter(o => o.id !== tipo.id) : [...prev, tipo]
    );
  };

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
  /*
   * Na missão são três etapas, e não quatro: a ação veio com a ordem.
   */
  const pronto =
    localConfirmado &&
    midiasConfirmadas &&
    obsConfirmadas &&
    (modoMissao || operacoesConfirmadas);

  const confirmar = async () => {
    if (!pronto || !coords || salvando) return;
    /*
     * Última porta antes do banco.
     *
     * A tela já impede escolher outra coisa enquanto a ordem está aberta,
     * mas uma ordem urgente pode chegar entre a revisão e o toque no botão.
     * Gravar um registro livre nesse instante seria furar a regra por uma
     * fresta de dois segundos.
     */
    if (travado && !urgentesPendentes.some(m => m.id === missaoId)) {
      avisar('Há uma ordem urgente aberta: este check-in tem de ser o dela.', 'error');
      return;
    }
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
    // O painel recebe o registro; o fecho quem mostra é esta tela.
    onSaved(registro);
    setConcluido(registro);
  };

  /**
   * O que a pessoa perde se sair agora.
   *
   * Em palavras, não em "dados não salvos": é a diferença entre entender o
   * aviso e tocar em "sair" no automático.
   */
  const perdasAoSair = [
    midiasProntas.length > 0 ? contar(midiasProntas.length, 'foto/vídeo', 'fotos e vídeos') : '',
    obsProntas.length > 0 ? contar(obsProntas.length, 'observação', 'observações') : '',
    localConfirmado && endereco?.rua ? 'o ponto que você marcou' : ''
  ].filter(Boolean);

  /** Sair antes do fim joga fora o rascunho e os arquivos que já subiram. */
  const descartarESair = () => {
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

  /** O "voltar" do cabeçalho: pergunta antes, quando há o que perder. */
  const pedirSaida = () => {
    if (perdasAoSair.length === 0 && operacoes.length === 0) {
      descartarESair();
      return;
    }
    setPerguntandoSaida(true);
  };

  const AvatarMembro = <Avatar nome={nomeMembro} foto={fotoMembro} />;

  /**
   * A trilha muda de tamanho conforme o caminho.
   *
   * Registro livre tem cinco etapas; missão tem quatro, porque a ação já veio
   * decidida. Mostrar uma etapa "Ação" apagada e intocável na missão seria
   * dizer que falta alguma coisa que não falta.
   */
  const etapasDaTrilha: EtapaDaTrilha[] = [
    ...(modoMissao
      ? []
      : [
          {
            numero: 1,
            rotulo: 'Ação',
            icone: <Flag className="w-3.5 h-3.5" />,
            feita: operacoesConfirmadas
          }
        ]),
    {
      numero: 2,
      rotulo: modoMissao ? 'Chegada' : 'Local',
      icone: modoMissao ? <Navigation className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />,
      feita: localConfirmado
    },
    {
      numero: 3,
      rotulo: 'Fotos',
      icone: <Camera className="w-3.5 h-3.5" />,
      feita: midiasConfirmadas
    },
    {
      numero: 4,
      rotulo: 'Notas',
      icone: <MessageSquare className="w-3.5 h-3.5" />,
      feita: obsConfirmadas
    },
    {
      numero: 5,
      rotulo: 'Revisão',
      icone: <Check className="w-3.5 h-3.5" />,
      feita: false
    }
  ];

  /** A linha do resumo da revisão, com o atalho para corrigir aquela etapa. */
  const LinhaResumo = ({
    icone,
    rotulo,
    texto,
    etapaDestino
  }: {
    icone: React.ReactNode;
    rotulo: string;
    texto: string;
    etapaDestino: number;
  }) => (
    <li className="flex items-center gap-2.5 py-2.5">
      <span
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white"
        style={{ backgroundColor: VERDE }}
      >
        {icone}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[9.5px] font-black uppercase tracking-widest text-emerald-700/60">
          {rotulo}
        </span>
        <span className="block text-[12.5px] font-bold leading-snug" style={{ color: '#05603F' }}>
          {texto}
        </span>
      </span>
      <button
        type="button"
        onClick={() => voltarPara(etapaDestino)}
        className="shrink-0 w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center cursor-pointer active:scale-95"
        title="Corrigir"
        aria-label="Corrigir"
        style={{ color: '#05603F' }}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </li>
  );

  // O check-in gravado: daqui em diante quem manda na tela é o fecho.
  if (concluido) {
    return (
      <Concluido
        registro={concluido}
        metaDepois={meta}
        onNovo={onNovo}
        onSair={onBack}
      />
    );
  }

  return (
    <div
      className="h-[100dvh] flex flex-col font-sans overflow-hidden"
      style={{ backgroundColor: FUNDO }}
    >
      <Cabecalho
        nome={nomeMembro}
        foto={fotoMembro}
        online={online}
        precisao={precisao}
        buscandoGps={buscandoGps}
        turnoAgora={turnoAgora}
        janelas={janelas}
        meta={meta}
        etapas={etapasDaTrilha}
        etapaAtual={etapa}
        onIr={voltarPara}
        onSair={pedirSaida}
        onAbrirDia={() => setDiaAberto(true)}
      />

      {/*
        A TRANCA, escrita onde não dá para não ver.

        A regra mora no cartão da ordem, lá no fio — mas o fio rola, e a regra
        não pode rolar junto. Quem desceu até as fotos precisa continuar
        sabendo por que o registro livre não está disponível.
      */}
      {travado && (
        <div
          className="shrink-0 px-3 py-2 flex items-center gap-2 ck-desce"
          style={{ backgroundColor: '#E11D48' }}
        >
          <span className="relative w-4 h-4 flex items-center justify-center shrink-0">
            <span className="ck-bate absolute inset-0 rounded-full bg-white/40" />
            <Siren className="relative w-3.5 h-3.5 text-white" />
          </span>
          <p className="shrink-0 text-[11px] font-black uppercase tracking-wider text-white leading-none">
            Ordem urgente
          </p>
          {/* O título da ordem já está no cartão, logo abaixo: repetir aqui
              seria gaguejar. O que a faixa tem de dizer, e o cartão não diz
              quando a rolagem passa por ele, é a regra que está valendo. */}
          <span className="flex-1 min-w-0 text-[10.5px] font-bold text-white/80 truncate text-right">
            registro livre bloqueado
          </span>
        </div>
      )}

      {/* A ordem chegou com trabalho em cima da mesa: avisa, mas não atropela. */}
      {urgenteEsperando && (
        <div
          className="shrink-0 px-3 py-2 flex items-center gap-2 ck-desce"
          style={{ backgroundColor: '#FEF3C7' }}
        >
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" style={{ color: '#B45309' }} />
          <p className="flex-1 text-[11px] font-bold leading-tight" style={{ color: '#92400E' }}>
            Uma ordem urgente chegou. Termine e grave este registro — ela entra
            sozinha no próximo.
          </p>
        </div>
      )}

      {/* AVISO: o recado do sistema, na tela que a pessoa está olhando */}
      {aviso && (
        <div
          className="fixed left-3 right-3 z-[2000] rounded-2xl px-3.5 py-3 shadow-xl flex items-start gap-2.5 ck-desce"
          style={{
            top: 'calc(env(safe-area-inset-top) + 0.75rem)',
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

      {/* FIO */}
      <div className="flex-1 min-h-0 px-3 pt-3.5 pb-5 space-y-3 overflow-y-auto">
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
            className="sticky top-0 z-30 w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-3 shadow-lg cursor-pointer active:scale-[0.99] ck-desce"
            /* Novidade urgente não pode ter a mesma cor de novidade comum. */
            style={{ backgroundColor: algumaNovaUrgente ? '#E11D48' : VERDE }}
          >
            <span className="relative w-7 h-7 rounded-full bg-white/25 flex items-center justify-center shrink-0">
              {algumaNovaUrgente && (
                <span className="ck-bate absolute inset-0 rounded-full bg-white/40" />
              )}
              {algumaNovaUrgente ? (
                <Siren className="relative w-3.5 h-3.5 text-white" />
              ) : (
                <BellRing className="w-3.5 h-3.5 text-white" />
              )}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[12.5px] font-black text-white leading-tight">
                {algumaNovaUrgente
                  ? novasDePe.length === 1
                    ? 'Chegou uma ORDEM URGENTE para você'
                    : 'Chegou uma ORDEM URGENTE e mais missões para você'
                  : novasDePe.length === 1
                    ? 'Chegou uma missão nova para você'
                    : `Chegaram ${novasDePe.length} missões novas para você`}
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
            className="sticky top-0 z-20 rounded-2xl border px-3.5 py-3 flex items-start gap-2.5 shadow-lg ck-desce"
            style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}
          >
            <TriangleAlert className="w-4 h-4 shrink-0 mt-px" style={{ color: '#B45309' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-black leading-tight" style={{ color: '#7C2D12' }}>
                A missão "{missaoRetirada}" foi retirada
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

        {/* A abertura: uma conversa começa cumprimentando */}
        <Fala hora={horas.abertura} destaque>
          <strong className="font-black" style={{ color: AZUL }}>
            {saudacao}, {primeiroNome}.
          </strong>{' '}
          Vamos registrar o que você está fazendo agora — são cinco passos curtos
          e eu vou junto.
        </Fala>

        {/* A ORDEM DO COMITÊ: o que ele mandou, antes de qualquer pergunta */}
        {missoes.length > 0 && (
          <>
            <Fala hora={horas.abertura} atraso={450}>
              {travado ? (
                urgentesPendentes.length === 1 ? (
                  <>
                    <strong className="font-black" style={{ color: '#E11D48' }}>
                      Chegou uma ordem urgente para você.
                    </strong>{' '}
                    É ela agora — o resto espera.
                  </>
                ) : (
                  <>
                    <strong className="font-black" style={{ color: '#E11D48' }}>
                      Você tem {urgentesPendentes.length} ordens urgentes abertas.
                    </strong>{' '}
                    Comece por uma delas.
                  </>
                )
              ) : missao ? (
                <>Você está na missão abaixo. Se mudar de ideia, dá para trocar.</>
              ) : missoes.length === 1 ? (
                <>Você recebeu uma missão. É essa que você está fazendo?</>
              ) : (
                <>
                  Você recebeu {missoes.length} missões
                  {quantasAgora > 0 && turnoAgora && (
                    <>
                      {' '}
                      — {quantasAgora === 1 ? 'uma é' : `${quantasAgora} são`} para{' '}
                      {NOME_DO_TURNO[turnoAgora].toLowerCase()}, e{' '}
                      {quantasAgora === 1 ? 'ela está' : 'elas estão'} no topo
                    </>
                  )}
                  . Qual delas você está fazendo agora?
                </>
              )}
            </Fala>

            <div className="ck-entra flex items-end gap-2 flex-row-reverse" ref={blocoMissoesRef}>
              <span className="w-7 shrink-0" />
              <div className="max-w-[92%] w-full">
                <OrdemDoComite
                  missoes={missoesEmOrdem}
                  urgentes={urgentesPendentes}
                  travado={travado}
                  missaoId={missaoId}
                  onEscolher={id => {
                    setMissaoId(id);
                    // Tocou: já viu. A marca de novidade sai daqui.
                    if (id) setMissoesNovas(prev => prev.filter(n => n !== id));
                    /*
                     * A escolha muda o caminho, e o caminho muda de etapa.
                     * Pegando missão, a pergunta da ação deixa de existir;
                     * largando a missão antes de ter respondido a ela, é para
                     * lá que a conversa tem de voltar.
                     */
                    if (id && etapa === 1) setEtapa(2);
                    if (!id && !operacoesConfirmadas) setEtapa(1);
                  }}
                  novas={novasDePe}
                  niveis={niveis}
                  janelas={janelas}
                  turnoAgora={turnoAgora}
                  coords={coords}
                  rotaNaDoca={etapa === 2 && modoMissao}
                />
              </div>
            </div>
          </>
        )}

        {/*
          ETAPA 1: a ação e a prioridade — só no registro livre.

          Na missão esta conversa não acontece: o comitê já respondeu as duas
          coisas quando mandou a ordem, e repetir a pergunta na rua é só
          chance de a resposta sair diferente da ordem.
        */}
        {!modoMissao && (
          <Fala hora={horas.abertura} atraso={missoes.length > 0 ? 700 : 450}>
            O que você vai fazer aqui, e qual a prioridade disso?
          </Fala>
        )}

        {!modoMissao && etapa === 1 && (
          <BlocoDoIntegrante>
            {tiposDisponiveis.length === 0 ? (
              <p className="text-[12px] text-slate-400 font-semibold text-right">
                Nenhuma operação cadastrada ainda. Crie a sua abaixo.
              </p>
            ) : (
              <div className="w-full grid grid-cols-2 gap-2">
                {tiposDisponiveis.map(tipo => {
                  const marcado = operacoes.some(o => o.id === tipo.id);
                  return (
                    <button
                      key={tipo.id}
                      onClick={() => alternarOperacao(tipo)}
                      className={`min-h-[46px] px-3 py-2 text-[13px] font-bold rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 border text-left ${
                        marcado ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-200'
                      }`}
                      style={marcado ? { backgroundColor: AZUL } : undefined}
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: tipo.color }}
                      >
                        <OperationIcon icon={tipo.icon} size={12} />
                      </span>
                      <span className="flex-1 min-w-0 leading-tight">{tipo.label}</span>
                      {marcado && <Check className="w-4 h-4 stroke-[3] shrink-0" />}
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
                className="self-end min-h-[42px] px-3.5 py-2 text-[12.5px] font-bold rounded-2xl border border-dashed border-slate-300 bg-white text-slate-500 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 hover:border-slate-400 hover:text-slate-700"
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
                  className="w-full px-3 py-3 text-[14px] font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-slate-400"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPassoCategoria('fechado')}
                    className="flex-1 h-[46px] text-[12px] font-black uppercase tracking-wider rounded-xl border border-slate-200 text-slate-500 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={conferirCategoria}
                    disabled={nomeCategoria.trim().length < 2}
                    className="flex-1 h-[46px] text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
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
                <p className="text-[12.5px] font-semibold text-slate-600">O nome está certo?</p>
                <p className="text-[16px] font-black break-words" style={{ color: AZUL }}>
                  {nomeCategoria}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPassoCategoria('digitando')}
                    disabled={salvandoCategoria}
                    className="flex-1 h-[46px] text-[12px] font-black uppercase tracking-wider rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={criarCategoria}
                    disabled={salvandoCategoria}
                    className="flex-1 h-[46px] text-white text-[12px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
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
            <p className="w-full text-[10.5px] font-black uppercase tracking-widest text-slate-400 text-right mt-1">
              Prioridade
            </p>
            <div className="w-full grid grid-cols-2 gap-2">
              {opcoesPrioridade.map(nivel => {
                const marcado = prioridade === nivel.id;
                return (
                  <button
                    key={nivel.id}
                    type="button"
                    onClick={() => {
                      vibrar();
                      setPrioridade(nivel.id);
                    }}
                    className={`min-h-[46px] px-3 py-2 text-[13px] font-bold rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 border ${
                      marcado ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                    style={marcado ? { backgroundColor: nivel.color } : undefined}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: marcado ? '#ffffff' : nivel.color }}
                    />
                    <span className="truncate flex-1 text-left">{nivel.label}</span>
                    {marcado && <Check className="w-4 h-4 stroke-[3] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </BlocoDoIntegrante>
        )}

        {!modoMissao && operacoesConfirmadas && etapa > 1 && (
          <Resposta hora={horas.operacoes} avatar={AvatarMembro}>
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

        {/* ETAPA 2: mapa arrastável + confirmação do ponto ajustado */}
        {etapa >= 2 && (
          <Fala hora={horas.operacoes || horas.abertura} atraso={400}>
            {modoMissao ? (
              missao?.semLocal ? (
                <>
                  Esta missão não tem lugar marcado: ela acontece onde você
                  estiver. Pode começar.
                </>
              ) : (
                <>
                  Vá até o ponto da missão. Quando você chegar, o botão de
                  iniciar acende aqui embaixo.
                </>
              )
            ) : (
              <>
                Agora o lugar. Confira o pino e arraste se ele não estiver na
                porta certa.
              </>
            )}
          </Fala>
        )}

        {etapa === 2 && modoMissao && missao && (
          <div className="ck-entra flex items-end gap-2">
            <span className="w-7 shrink-0" />
            <div className="max-w-[88%] w-full">
              <Chegada
                missao={missao}
                coords={coords}
                precisao={precisao}
                endereco={endereco}
                buscandoGps={buscandoGps}
                erroGps={erroGps}
                chegada={chegada}
                onAtualizarGps={capturarLocal}
              />
            </div>
          </div>
        )}

        {etapa === 2 && !modoMissao && (
          <div className="ck-entra flex items-end gap-2">
            <span className="w-7 shrink-0" />
            <div className="max-w-[88%] w-full">
              {buscandoGps && !coords ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3.5 py-4 flex items-center gap-2.5 text-[12.5px] font-bold text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Capturando sua localização...
                </div>
              ) : erroGps && !coords ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3.5 py-3">
                  <p className="text-[12.5px] font-bold text-rose-600">{erroGps}</p>
                  <button
                    onClick={capturarLocal}
                    className="mt-2.5 h-[44px] px-4 text-[12px] font-black uppercase tracking-wider text-white rounded-xl cursor-pointer"
                    style={{ backgroundColor: AZUL }}
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : coords ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Um mapa de cada vez: em tela cheia este sai de cena. */}
                  {mapaCheio ? (
                    <div className="h-[280px] bg-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-500">
                      Ajustando em tela cheia...
                    </div>
                  ) : (
                    <div className="relative">
                      <MapaAjuste
                        gps={gps}
                        centroInicial={coords}
                        seguirGps={seguirGps}
                        height={280}
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
                        className="absolute z-[600] top-2.5 right-2.5 h-10 px-3.5 rounded-full bg-white shadow-md border border-slate-200 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 cursor-pointer active:scale-95 transition-transform"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Tela cheia
                      </button>
                    </div>
                  )}

                  <div className="px-3.5 py-3">
                    {ajustando ? (
                      <p className="text-[13px] font-bold text-slate-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        Atualizando endereço...
                      </p>
                    ) : (
                      <>
                        <p className="text-[14px] font-black leading-tight" style={{ color: AZUL }}>
                          {endereco?.rua || 'Localizando endereço...'}
                        </p>
                        <p className="text-[11.5px] text-slate-400 font-bold mt-0.5">
                          {endereco?.resto}
                          {precisao !== null && (
                            <span className="whitespace-nowrap">
                              {endereco?.resto ? ' • ' : ''}Precisão {precisao} m
                            </span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Localização confirmada: cartão do ponto escolhido */}
        {localConfirmado && coords && etapa !== 2 && (
          <div className="ck-entra flex items-end gap-2 flex-row-reverse">
            {AvatarMembro}
            <div
              className="max-w-[86%] rounded-2xl rounded-br-md overflow-hidden shadow-sm"
              style={{ backgroundColor: AZUL }}
            >
              <MiniMapa lat={coords.lat} lng={coords.lng} height={124} />
              <div className="p-3">
                {modoMissao && (
                  <p className="text-[9.5px] font-black uppercase tracking-widest text-white/50 mb-1">
                    Missão iniciada
                  </p>
                )}
                <p className="text-[13.5px] font-bold text-white leading-tight">{endereco?.rua}</p>
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
          <Fala hora={horas.local} atraso={400}>
            Agora a prova: fotografe o que você está vendo. Vídeo também vale.
          </Fala>
        )}
        {etapa >= 3 && (
          <BolhaDeMidias
            itens={midias}
            editavel={etapa === 3}
            avatar={AvatarMembro}
            hora={horas.midias || horas.local}
            permitirGaleria={permitirGaleria}
            onRemover={removerMidia}
            onSubstituir={substituirMidia}
          />
        )}

        {/* ETAPA 4: observações */}
        {etapa >= 4 && (
          <Fala hora={horas.midias} atraso={400}>
            Quer deixar alguma observação? Escreva ou grave um áudio aqui
            embaixo — esta parte é opcional.
          </Fala>
        )}
        {etapa >= 4 && (
          <BolhaDeObservacoes
            itens={observacoes}
            editavel={etapa === 4}
            avatar={AvatarMembro}
            hora={horas.observacoes || horas.midias}
            onEditarTexto={editarTexto}
            onRemover={removerObservacao}
            onRegravar={regravarAudio}
          />
        )}
        {etapa > 4 && obsProntas.length === 0 && (
          <Resposta hora={horas.observacoes} avatar={AvatarMembro}>
            Sem observações.
          </Resposta>
        )}

        {/* ETAPA 5: revisão */}
        {etapa >= 5 && (
          <>
            <Fala hora={horas.observacoes} atraso={400}>
              É isso? Confira e confirme — depois de gravado, ele já aparece
              no painel.
            </Fala>

            <div
              className="ck-entra rounded-3xl border overflow-hidden"
              style={{ backgroundColor: '#E9F8F3', borderColor: '#B6E6D7' }}
            >
              <div className="px-4 pt-3.5 pb-1 flex items-center gap-2">
                <span className="text-[10.5px] font-black uppercase tracking-widest" style={{ color: '#05603F' }}>
                  Ficha do check-in
                </span>
                <span className="flex-1 h-px" style={{ backgroundColor: '#B6E6D7' }} />
                <span className="text-[10.5px] font-black tabular-nums" style={{ color: '#05603F' }}>
                  {horas.local || horaAgora()}
                </span>
              </div>

              <ul className="px-4 pb-2 divide-y" style={{ borderColor: '#CDEDE1' }}>
                {missao && (
                  <li className="flex items-center gap-2.5 py-2.5">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: VERDE }}
                    >
                      <Target className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[9.5px] font-black uppercase tracking-widest text-emerald-700/60">
                        {travado ? 'Ordem urgente' : 'Missão'}
                      </span>
                      <span className="block text-[12.5px] font-bold leading-snug" style={{ color: '#05603F' }}>
                        {missao.title}
                      </span>
                    </span>
                  </li>
                )}
                {/*
                  Na missão a linha da ação não tem "corrigir": ela não é uma
                  escolha da rua, é a ordem de quem mandou. Mostrar o lápis ao
                  lado dela prometeria um poder que a pessoa não tem.
                */}
                {modoMissao ? (
                  <li className="flex items-center gap-2.5 py-2.5">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: VERDE }}
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[9.5px] font-black uppercase tracking-widest text-emerald-700/60">
                        O que · definido na missão
                      </span>
                      <span
                        className="block text-[12.5px] font-bold leading-snug"
                        style={{ color: '#05603F' }}
                      >
                        {[
                          operacoesDoRegistro.map(o => o.label).join(', '),
                          nivelDoRegistro?.label
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Sem classificação na ordem'}
                      </span>
                    </span>
                  </li>
                ) : (
                  <LinhaResumo
                    icone={<Flag className="w-3.5 h-3.5" />}
                    rotulo="O que"
                    texto={`${operacoes.map(o => o.label).join(', ') || 'Nenhuma operação'}${
                      nivelEscolhido ? ` · ${nivelEscolhido.label}` : ''
                    }`}
                    etapaDestino={1}
                  />
                )}
                <LinhaResumo
                  icone={<MapPin className="w-3.5 h-3.5" />}
                  rotulo={modoMissao ? 'Onde a missão foi iniciada' : 'Onde'}
                  texto={endereco?.rua || 'Local confirmado'}
                  etapaDestino={2}
                />
                <LinhaResumo
                  icone={<Camera className="w-3.5 h-3.5" />}
                  rotulo="Provas"
                  texto={`${contar(fotos, 'foto', 'fotos')} · ${contar(videos, 'vídeo', 'vídeos')}`}
                  etapaDestino={3}
                />
                <LinhaResumo
                  icone={<MessageSquare className="w-3.5 h-3.5" />}
                  rotulo="Observações"
                  texto={
                    textos + audios === 0
                      ? 'Nenhuma'
                      : `${contar(textos, 'texto', 'textos')} · ${contar(audios, 'áudio', 'áudios')}`
                  }
                  etapaDestino={4}
                />
              </ul>
            </div>
          </>
        )}

        <div ref={fimRef} />
      </div>

      {/* A DOCA: a ação da etapa, sempre no mesmo lugar */}
      <Doca chave={etapa}>
        {etapa === 1 && (
          <BotaoPrincipal
            onClick={confirmarOperacoes}
            disabled={operacoes.length === 0 || !prioridade}
            motivo={
              operacoes.length === 0
                ? 'Marque pelo menos um tipo de operação.'
                : !prioridade
                  ? 'Falta escolher o nível de prioridade.'
                  : `${contar(operacoes.length, 'tipo marcado', 'tipos marcados')} · ${nivelEscolhido?.label}`
            }
          >
            Confirmar ação
          </BotaoPrincipal>
        )}

        {/*
          A CHEGADA DA MISSÃO.

          O botão de iniciar é a trava em forma de botão: enquanto a pessoa
          está longe ele fica apagado e diz, em metros, o que falta para
          acender. Do lado, o caminho — porque um botão que não dá para
          apertar sem uma saída ao lado é só uma porta trancada.
        */}
        {etapa === 2 && modoMissao && missao && (
          <>
            {!chegada.pode && !missao.semLocal && (
              <a
                href={linkDeRota(missao)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => vibrar()}
                className="w-full h-[46px] rounded-2xl border border-slate-200 bg-white text-slate-700 text-[12.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Navigation className="w-4 h-4" style={{ color: AZUL }} />
                Como chegar até a missão
              </a>
            )}
            <BotaoPrincipal
              onClick={confirmarLocal}
              disabled={!coords || !chegada.pode || ajustando}
              cor={VERDE}
              icone={<Navigation className="w-4 h-4" />}
              motivo={
                !coords
                  ? 'Esperando o GPS achar você.'
                  : missao.semLocal
                    ? 'Missão sem lugar marcado: pode começar daqui.'
                    : chegada.pode
                      ? `Você está no ponto — ${endereco?.rua || 'posição confirmada'}.`
                      : `Faltam ${distanciaCurta(chegada.faltam)} para você poder iniciar.`
              }
            >
              Iniciar missão
            </BotaoPrincipal>
          </>
        )}

        {/* A tela cheia mora no canto do mapa, onde o dedo já está arrastando:
            repetir o atalho aqui embaixo só roubava altura do botão que fecha
            a etapa. */}
        {etapa === 2 && !modoMissao && (
          <>
            <BotaoPrincipal
              onClick={confirmarLocal}
              disabled={!coords || !mapaPronto || ajustando}
              motivo={
                !coords
                  ? 'Esperando o GPS achar você.'
                  : ajustando
                    ? 'Atualizando o endereço do ponto...'
                    : !mapaPronto
                      ? 'Carregando o mapa...'
                      : endereco?.rua || 'Ponto capturado por GPS'
              }
              icone={<MapPin className="w-4 h-4" />}
            >
              Confirmar local
            </BotaoPrincipal>
          </>
        )}

        {etapa === 3 && (
          <>
            <ControlesDeMidia
              permitirGaleria={permitirGaleria}
              online={online}
              onArquivos={adicionarMidias}
            />
            <BotaoPrincipal
              onClick={confirmarMidias}
              disabled={midiasProntas.length === 0 || enviandoMidia}
              motivo={
                enviandoMidia
                  ? 'Enviando os arquivos...'
                  : midiasProntas.length === 0
                    ? 'Envie pelo menos uma foto ou vídeo.'
                    : `${contar(fotos, 'foto', 'fotos')} · ${contar(videos, 'vídeo', 'vídeos')} — dá para mandar mais.`
              }
            >
              {enviandoMidia ? 'Enviando...' : 'Confirmar fotos'}
            </BotaoPrincipal>
          </>
        )}

        {etapa === 4 && (
          <>
            <CompositorDeObservacao
              online={online}
              onTexto={adicionarTexto}
              onAudio={enviarAudio}
            />
            <BotaoPrincipal
              onClick={confirmarObservacoes}
              disabled={enviandoAudio}
              motivo={
                enviandoAudio
                  ? 'Enviando o áudio...'
                  : obsProntas.length === 0
                    ? 'Esta parte é opcional.'
                    : `${contar(textos, 'texto', 'textos')} · ${contar(audios, 'áudio', 'áudios')}`
              }
            >
              {obsProntas.length === 0 ? 'Seguir sem observação' : 'Confirmar observações'}
            </BotaoPrincipal>
          </>
        )}

        {etapa >= 5 && (
          <BotaoPrincipal
            onClick={confirmar}
            disabled={!pronto}
            carregando={salvando}
            cor={VERDE}
            icone={
              salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[3]" />
              )
            }
            motivo={
              salvando
                ? 'Gravando o check-in...'
                : missao
                  ? `${travado ? 'Vai como ordem urgente' : 'Vai como missão'}: ${missao.title}`
                  : 'Vai como registro livre.'
            }
          >
            {salvando ? 'Gravando...' : 'Confirmar check-in'}
          </BotaoPrincipal>
        )}
      </Doca>

      {/* MAPA EM TELA CHEIA: o mesmo ajuste, com a tela inteira para mirar */}
      {mapaCheio && coords && (
        <div className="fixed inset-0 z-[4000] bg-white flex flex-col">
          <header
            className="shrink-0 px-3 py-2.5 flex items-center gap-2 text-white"
            style={{ backgroundColor: AZUL, paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
          >
            <button
              type="button"
              onClick={() => setMapaCheio(false)}
              aria-label="Sair da tela cheia"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[14.5px] font-bold tracking-tight">Posicione o seu ponto</h2>
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

          <div
            className="shrink-0 p-3 bg-white border-t border-slate-100"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
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
                <p className="mt-1.5 text-[13.5px] font-bold text-slate-800 leading-tight">
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
                className="flex-1 h-[52px] text-[12px] font-black uppercase tracking-wider rounded-2xl border border-slate-200 text-slate-500 cursor-pointer transition-all active:scale-[0.99]"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  // Confirmar daqui fecha a tela cheia e segue o fio normalmente.
                  vibrar();
                  confirmarLocal();
                  setMapaCheio(false);
                }}
                disabled={!mapaPronto || ajustando}
                className="flex-[2] h-[52px] text-white text-[12px] font-black uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                style={{ backgroundColor: AZUL }}
              >
                {mapaPronto ? 'Confirmar local' : 'Carregando mapa...'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PainelDoDia
        aberto={diaAberto}
        onFechar={() => setDiaAberto(false)}
        metas={metas}
        pessoaId={member?.id || ''}
        meusCheckIns={meusCheckIns}
        janelas={janelas}
        turnoAgora={turnoAgora}
      />

      <FolhaDeSaida
        aberto={perguntandoSaida}
        perdas={perdasAoSair}
        onFicar={() => setPerguntandoSaida(false)}
        onSair={descartarESair}
      />
    </div>
  );
}
