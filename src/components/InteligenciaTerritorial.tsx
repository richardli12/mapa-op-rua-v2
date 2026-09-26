import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Maximize2,
  Minimize2,
  PanelRightClose
} from 'lucide-react';
import {
  lerUfs,
  lerMunicipios,
  lerMunicipio,
  lerBairros,
  lerIndicadores,
  analisarRaio,
  lerSetores,
  todasAsPaginas,
  UfDoTerritorio,
  SetorDoTerritorio,
  BairroDoTerritorio,
  MunicipioDoTerritorio,
  IndicadoresDoRecorte,
  AnaliseDeArea,
  ErroDoTerritorio
} from '../services/territorio';
import {
  ConcentracaoDeBairros,
  GenteJunta,
  CertezaDoRaio
} from './territorio/GraficosDoTerritorio';
import PainelDoCenso from './territorio/PainelDoCenso';
import PainelDoRaio from './territorio/PainelDoRaio';

interface InteligenciaTerritorialProps {
  aberto: boolean;
  onFechar: () => void;
  /** UF e município do cliente em foco, para abrir já no lugar certo. */
  ufDoCliente?: string | null;
  cidadeDoCliente?: string | null;
  /**
   * Um círculo desenhado lá fora, para medir ESTE lugar.
   *
   * Quem marcou um raio no mapa já disse onde e já disse quanto. Fazer essa
   * pessoa reabrir o painel, centralizar o mapa no mesmo ponto e escolher um
   * raio de tabela seria pedir de novo o que ela acabou de fazer — e com menos
   * precisão, porque a régua do painel tem quatro tamanhos e o desenho dela
   * tem o tamanho que ela quis.
   */
  circuloExterno?: { lat: number; lng: number; raio: number } | null;
  /** Centro e zoom do mapa agora — é o ponto que a análise de raio mede. */
  centroDoMapa: () => { lat: number; lng: number; zoom: number } | null;
  /**
   * Muda a cada ✕ tocado na etiqueta do círculo, lá no mapa.
   *
   * O círculo é estado deste painel (centro, medida, o que já foi medido), e
   * não só um desenho: apagar só o desenho deixaria o painel respondendo
   * sobre uma área que ninguém vê mais. Cada novo número pede para o painel
   * sair do círculo por inteiro, como o "voltar" daqui de dentro.
   */
  pedidoParaFecharCirculo?: number;
  /** Desenha no mapa o círculo que foi medido. */
  onCirculoAnalisado: (
    circulo: { lat: number; lng: number; raio: number } | null
  ) => void;
  /** Entrega ao mapa os polígonos a desenhar e a escala que os pinta. */
  onRecortes: (
    recortes: {
      id: string;
      nome: string;
      geometria: any;
      valor: number | null;
      resumo: string;
      tipo: 'bairro' | 'setor';
    }[],
    escala: { corte: number; cor: string }[]
  ) => void;
  /** Recorte que o mapa está destacando, para a lista acompanhar. */
  recorteEmFoco?: string | null;
  onRecorteEmFoco?: (id: string | null) => void;
  /**
   * A camada ligada lá em cima, na gaveta da barra do mapa.
   *
   * Quem manda no que o mapa pinta é ela, não este painel: a mancha existe
   * com o painel fechado, e é para isso que a gaveta serve. `null` é camada
   * desligada — mapa sem mancha.
   *
   * O painel continua desenhando o que ele mesmo mostra quando está aberto,
   * porque uma lista de bairros ao lado de um mapa branco não ajuda ninguém.
   */
  metricaDaCamada?: 'populacao' | 'densidade' | 'domicilios' | null;
  nivelDaCamada?: 'bairros' | 'setores';
  onMetricaDaCamada?: (
    metrica: 'populacao' | 'densidade' | 'domicilios'
  ) => void;
  onNivelDaCamada?: (nivel: 'bairros' | 'setores') => void;
  /**
   * O que a camada está fazendo, para a gaveta da barra poder contar.
   *
   * Sem isto, ligar a camada numa cidade grande é um botão que não faz nada
   * por meio minuto: a malha está vindo em páginas, mas quem olha só vê mapa
   * limpo e conclui que quebrou.
   */
  onEstadoDaCamada?: (estado: {
    carregando: boolean;
    progresso: { lidos: number; total: number } | null;
    municipio: string | null;
    desenhados: number;
    erro: string | null;
  }) => void;
}

type Aba = 'raio' | 'bairros' | 'setores' | 'censo';

const RAIOS = [500, 1000, 2000, 5000];

const numero = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? '—'
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

/** "500 m", "1,5 km": o raio escrito como se fala. */
const distancia = (metros: number) =>
  metros >= 1000
    ? `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : `${numero(metros)} m`;

/** Como cada nível de recorte é escrito na ficha do cabeçalho. */
const NIVEIS: { [nivel: string]: string } = {
  municipio: 'Município',
  bairro: 'Bairro',
  setor: 'Setor censitário'
};

/** Texto do motivo pelo qual um indicador veio sem valor. */
const MOTIVOS: { [chave: string]: string } = {
  'sem-dado-na-fonte': 'não divulgado para este recorte',
  'denominador-zero': 'sem denominador aqui',
  'recorte-sem-enriquecimento': 'recorte sem indicadores'
};

/**
 * Inteligência territorial: quem mora no território que a equipe trabalha.
 *
 * O mapa operacional responde onde a equipe esteve. Este painel responde a
 * pergunta que vem antes de decidir para onde ir: quanta gente mora aqui —
 * com os indicadores do Censo do município, direto, sem escolher aba nem
 * apertar "Carregar".
 *
 * Duas regras do manual do CCO aparecem na tela, e não só no código, porque
 * são elas que separam número confiável de número bonito: soma parcial é
 * avisada, e `null` nunca é mostrado como zero.
 */
export default function InteligenciaTerritorial({
  aberto,
  onFechar,
  ufDoCliente,
  cidadeDoCliente,
  centroDoMapa,
  circuloExterno,
  pedidoParaFecharCirculo = 0,
  onCirculoAnalisado,
  onRecortes,
  recorteEmFoco,
  onRecorteEmFoco,
  metricaDaCamada = null,
  nivelDaCamada = 'bairros',
  onMetricaDaCamada,
  onNivelDaCamada,
  onEstadoDaCamada
}: InteligenciaTerritorialProps) {
  /**
   * O painel trabalha fechado quando a camada está ligada.
   *
   * Cobertura, município e malha são cargas de rede, e antes todas esperavam
   * o painel abrir. Com a camada na barra de cima, ligar "População" tem de
   * pintar o mapa sem abrir painel nenhum — então quem libera as cargas é
   * isto, não o `aberto`.
   */
  const camadaLigada = metricaDaCamada !== null;
  /**
   * Quantos polígonos foram parar no mapa da última vez.
   *
   * Estado, e não `ref`, porque quem lê isso é o recibo da gaveta: guardado
   * numa `ref`, o recibo era escrito antes do desenho acontecer e dizia "não
   * devolveu nada" com três bairros já pintados.
   */
  const [desenhados, setDesenhados] = useState(0);
  /*
   * A tela abre nos bairros, e não no raio.
   *
   * "Raio" é a aba que só sabe perguntar: uma régua de distâncias e um botão
   * "analisar esta área". Quem abria a inteligência territorial encontrava um
   * painel sem um número sequer e tinha de decidir alguma coisa antes de ver
   * qualquer coisa. Bairros já tem o que mostrar -- a lista do município, com
   * população -- e chega sozinha. O raio continua a um toque, e volta a ser a
   * primeira aba sozinho quando alguém desenha um círculo no mapa.
   */
  const [aba, setAba] = useState<Aba>('bairros');
  /**
   * Meia tela ou tela cheia.
   *
   * O mesmo par do Mapa Mental, de propósito: são os dois painéis grandes do
   * mapa, e aprender dois comportamentos para a mesma pergunta — "quero mais
   * espaço" — seria trabalho de quem usa, não do sistema.
   */
  const [telaCheia, setTelaCheia] = useState(false);
  /*
   * O seletor de UF/município só aparece quando é preciso escolher.
   *
   * Para a esmagadora maioria das aberturas, o município já vem certo do
   * cadastro do cliente -- e duas caixas de seleção mostrando um valor que
   * ninguém vai trocar são só ruído acima do que a pessoa realmente veio ver.
   * "Trocar município" chama o seletor de volta para os casos raros: cliente
   * com cidade ambígua, ou a detecção errando.
   */
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [erro, setErro] = useState<ErroDoTerritorio | null>(null);

  /* ------------------------------------------------------- cobertura --- */
  const [uf, setUf] = useState<string>((ufDoCliente || '').toUpperCase());
  /** Trocar de UF na mão manda; a do cliente só preenche o que está vazio. */
  const [ufEscolhidaNaMao, setUfEscolhidaNaMao] = useState(false);
  const [ufsComTerritorio, setUfsComTerritorio] = useState<string[]>([]);
  const [ufsComIndicadores, setUfsComIndicadores] = useState<string[]>([]);
  /**
   * As UFs por extenso.
   *
   * A trilha do cabeçalho diz "Pará", não "PA": a sigla já está no crachá ao
   * lado do nome da cidade, e repeti-la na trilha não situa ninguém. O nome
   * vem da mesma chamada de cobertura que já era feita — não é consulta nova.
   */
  const [ufs, setUfs] = useState<UfDoTerritorio[]>([]);
  const [carregandoCobertura, setCarregandoCobertura] = useState(false);

  /* -------------------------------------------------------- município --- */
  const [municipios, setMunicipios] = useState<MunicipioDoTerritorio[]>([]);
  const [municipio, setMunicipio] = useState<MunicipioDoTerritorio | null>(null);
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(false);

  /* ---------------------------------------------------------- bairros --- */
  const [bairros, setBairros] = useState<BairroDoTerritorio[]>([]);
  /**
   * Os bairros do seletor do cabeçalho — lista separada, e sem geometria.
   *
   * `bairros` é a lista que o mapa pinta, e por isso vem com o polígono junto:
   * é o dado mais pesado da base e derruba a página de 1000 para 200 linhas.
   * O seletor só precisa de nome e código, e carregá-lo pela outra lista teria
   * dois efeitos que ninguém pediu — a espera da geometria antes de a caixa
   * ficar utilizável, e o mapa começando a se pintar sozinho só porque alguém
   * abriu o painel do Censo.
   */
  const [bairrosDoSeletor, setBairrosDoSeletor] = useState<BairroDoTerritorio[]>([]);
  const [carregandoBairrosDoSeletor, setCarregandoBairrosDoSeletor] = useState(false);
  const [carregandoBairros, setCarregandoBairros] = useState(false);
  const [ordem, setOrdem] = useState<'populacao' | 'densidade' | 'nome'>('populacao');
  const [buscaBairro, setBuscaBairro] = useState('');

  /* ------------------------------------------------------------ censo --- */
  const [recorte, setRecorte] = useState<{ nivel: string; codigo: string; nome: string } | null>(
    null
  );
  const [censo, setCenso] = useState<IndicadoresDoRecorte | null>(null);
  const [carregandoCenso, setCarregandoCenso] = useState(false);

  /* ---------------------------------------------------------- desenho --- */
  const [desenharNoMapa, setDesenharNoMapa] = useState(true);
  const [metricaLocal, setMetricaLocal] = useState<
    'populacao' | 'densidade' | 'domicilios'
  >('populacao');
  /** Uma métrica só, venha da gaveta ou da régua deste painel. */
  const metrica = metricaDaCamada ?? metricaLocal;
  const setMetrica = (nova: 'populacao' | 'densidade' | 'domicilios') => {
    setMetricaLocal(nova);
    onMetricaDaCamada?.(nova);
  };
  const [carregandoDesenho, setCarregandoDesenho] = useState(false);
  /** Bairro cujos setores estão abertos: o recorte mais fino, um por vez. */
  const [bairroDosSetores, setBairroDosSetores] = useState<BairroDoTerritorio | null>(
    null
  );
  const [setores, setSetores] = useState<SetorDoTerritorio[]>([]);
  /**
   * A última carga da malha quebrou no caminho.
   *
   * Sem isso, a tela vazia só sabia dizer uma coisa — "este município não tem
   * malha" — e dizia a mesma coisa quando a rede caiu, quando o serviço não
   * respondeu e quando a carga foi interrompida. É diagnóstico errado, e o pior
   * tipo: manda a pessoa desistir de um dado que está lá.
   */
  const [falhaDeSetores, setFalhaDeSetores] = useState(false);
  /** De qual município é a malha de setores que está na memória. */
  const [setoresDe, setSetoresDe] = useState<string | null>(null);
  /** Quantos setores já chegaram, e quantos são: a carga é longa e paginada. */
  const [progressoSetores, setProgressoSetores] = useState<{
    lidos: number;
    total: number;
  } | null>(null);

  /* ------------------------------------------------------------- raio --- */
  const [raio, setRaio] = useState(1000);
  const [analise, setAnalise] = useState<AnaliseDeArea | null>(null);
  const [analisando, setAnalisando] = useState(false);
  /**
   * O centro que a análise está usando, quando não é o do mapa.
   *
   * Nulo significa "o que estiver no meio da tela" — o jeito antigo, e ainda o
   * padrão. Preenchido, é um ponto que a pessoa marcou: o mapa pode rolar à
   * vontade que a medida continua sendo daquele lugar, que é o que faz dela
   * uma medida e não um acaso de enquadramento.
   */
  const [centroFixo, setCentroFixo] = useState<{ lat: number; lng: number } | null>(null);
  /**
   * O círculo que esta tela está medindo — `null` é "o recorte do Censo".
   *
   * É o que decide a tela inteira: com ele, o painel responde "quem mora
   * dentro do que acabei de desenhar"; sem ele, "como é este município".
   * Vive aqui, e não no `circuloExterno` que chega de fora, porque quem
   * desenhou precisa poder voltar para o município sem que o desenho suma
   * do mapa.
   */
  const [circuloEmFoco, setCirculoEmFoco] = useState<{
    lat: number;
    lng: number;
    raio: number;
  } | null>(null);
  /**
   * De qual círculo é a medida que está na tela.
   *
   * Sem esta marca, a medida ficava presa numa corrida: a análise precisa da
   * UF, a UF chega depois da consulta de cobertura, e o efeito que media
   * rodava uma vez só — antes da UF existir. Resultado: "Quem mora aqui"
   * abria o painel no Censo do município e o círculo desenhado era ignorado
   * em silêncio. Agora o efeito pode rodar de novo quando a UF chegar, e é
   * esta chave que o impede de medir o mesmo círculo duas vezes.
   */
  const [analiseDe, setAnaliseDe] = useState<string | null>(null);

  /**
   * A UF do cliente chega depois.
   *
   * A lista de clientes e o endereço dela são carregados enquanto a tela já
   * está montada, então ler a UF só no estado inicial deixaria o painel vazio
   * para sempre. Aqui ela é adotada assim que aparece — e nunca por cima de
   * uma escolha feita à mão.
   */
  useEffect(() => {
    const sigla = (ufDoCliente || '').toUpperCase();
    if (!sigla || ufEscolhidaNaMao) return;
    setUf((atual) => (atual === sigla ? atual : sigla));
  }, [ufDoCliente, ufEscolhidaNaMao]);

  // Cobertura primeiro: malha e indicadores são cargas separadas no CCO, e uma
  // UF sem malha responde 404 em tudo — o que não é erro de quem chamou.
  useEffect(() => {
    if ((!aberto && !camadaLigada) || ufsComTerritorio.length > 0) return;
    setCarregandoCobertura(true);
    lerUfs()
      .then((dados) => {
        setUfsComTerritorio(dados.comTerritorio || []);
        setUfsComIndicadores(dados.comIndicadores || []);
        setUfs(dados.ufs || []);

        /*
         * Sem UF em mãos, a única carregada serve.
         *
         * Cadastro com só a cidade ("Maceió") não diz a UF, e descobri-la
         * depende de um serviço de fora que pode não responder. Quando o CCO
         * tem uma UF só carregada, não há escolha a fazer — deixar o painel
         * vazio esperando seria pedir para a pessoa adivinhar qual.
         */
        const carregadas = dados.comTerritorio || [];
        if (carregadas.length === 1) {
          setUf((atual) => atual || carregadas[0]);
        }
      })
      .catch((falha) => setErro(falha))
      .finally(() => setCarregandoCobertura(false));
  }, [aberto, camadaLigada, ufsComTerritorio.length]);

  // Achar o município do cliente pelo nome, uma vez que a UF esteja escolhida.
  useEffect(() => {
    if ((!aberto && !camadaLigada) || !uf || municipios.length > 0) return;
    if (ufsComTerritorio.length > 0 && !ufsComTerritorio.includes(uf)) return;

    setCarregandoMunicipios(true);
    lerMunicipios(uf)
      .then(async (dados) => {
        setMunicipios(dados.municipios || []);
        const alvo = (cidadeDoCliente || '')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .trim();
        const achado = (dados.municipios || []).find(
          (m) =>
            m.nome
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .toLowerCase() === alvo
        );
        if (achado) await escolherMunicipio(achado);
      })
      .catch((falha) => setErro(falha))
      .finally(() => setCarregandoMunicipios(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, camadaLigada, uf, ufsComTerritorio, cidadeDoCliente]);

  const escolherMunicipio = async (alvo: MunicipioDoTerritorio) => {
    setErro(null);
    setMunicipio(alvo);
    setBairros([]);
    setBairrosDoSeletor([]);
    /*
     * A malha de setores é do município, e só dele.
     *
     * É aqui — e em nenhum outro lugar — que ela é jogada fora. Recarregar a
     * lista de bairros limpava os setores junto, e o efeito era invisível e
     * cruel: a pessoa ia para a aba de bairros, voltava para setores, e o mapa
     * ficava branco porque a carga achava que já tinha feito o trabalho.
     */
    setSetores([]);
    setSetoresDe(null);
    setBairroDosSetores(null);
    setFalhaDeSetores(false);
    cargaDeSetores.current = null;
    /*
     * O Censo do município escolhido vem sozinho.
     *
     * Não existe mais um botão "Carregar" nem uma aba para trocar: a pergunta
     * que este painel responde é "quem mora aqui", e ela já tem resposta no
     * instante em que o município é escolhido.
     */
    carregarCenso('municipio', alvo.codigo, alvo.nome);
    try {
      // A ficha do município traz setoresSemBairro, que é o que explica a
      // soma dos bairros não fechar com o total.
      const ficha = await lerMunicipio(uf, alvo.codigo);
      setMunicipio(ficha.municipio);
    } catch {
      // Sem a ficha detalhada seguimos com o que a listagem já trouxe.
    }
  };

  /**
   * O que o desenho e a lista mostram: a cidade inteira, ou o bairro escolhido
   * como filtro.
   *
   * O filtro corta o que já está na memória — não é outra consulta, e por isso
   * é instantâneo. Setor sem bairro (parte do território fica fora da divisão)
   * só aparece na visão da cidade, que é onde ele existe.
   *
   * FICA AQUI EM CIMA, ANTES DOS EFEITOS, e não junto do resto da tela: o
   * painel tem um `return null` quando está fechado, e com a camada ligada o
   * efeito do desenho roda justamente nesse estado. Declarada lá embaixo, a
   * const nem chegava a existir quando o efeito a lia — e o erro derruba a
   * página inteira, não só o painel.
   */
  const setoresNaTela = bairroDosSetores
    ? setores.filter((s) => s.bairroCodigo === bairroDosSetores.codigo)
    : setores;

  /**
   * Bairros do município.
   *
   * A geometria só é pedida quando o mapa vai desenhar — ela é o dado mais
   * pesado da base, e para ordenar uma lista por população o polígono não
   * serve para nada. Com ela ligada, a página cai para 200 linhas, então as
   * páginas são percorridas até o `proximoInicio` vir nulo.
   */
  const carregarBairros = async (comGeometria = desenharNoMapa) => {
    if (!municipio || carregandoBairros) return;
    setCarregandoBairros(true);
    if (comGeometria) setCarregandoDesenho(true);
    setErro(null);
    try {
      const lista = await todasAsPaginas<BairroDoTerritorio>(
        (inicio) => lerBairros(uf, municipio.codigo, inicio, comGeometria),
        'bairros',
      );
      setBairros(lista);
    } catch (falha: any) {
      setErro(falha);
    } finally {
      setCarregandoBairros(false);
      setCarregandoDesenho(false);
    }
  };

  /**
   * Setores de um bairro.
   *
   * Um bairro por vez, de propósito: com geometria o teto é de 100 por página,
   * e um município grande passa de mil setores. Puxar a cidade inteira seriam
   * dezenas de megabytes para desenhar um mapa que ninguém lê de uma vez.
   */
  /**
   * A MALHA DE SETORES DA CIDADE INTEIRA, de uma vez.
   *
   * Antes era um bairro por vez, e a aba abria pedindo que a pessoa voltasse,
   * escolhesse um bairro e tocasse em "Setores". A razão era o peso: o setor é
   * a menor peça do Censo, uma cidade grande passa de mil deles e o polígono de
   * todos são muitos megabytes.
   *
   * Só que o setor é justamente a camada que só faz sentido inteira. É nela que
   * se vê o quarteirão cheio ao lado do vazio, e o recorte por bairro esconde
   * exatamente isso — a divisa entre dois bairros é onde a diferença costuma
   * estar. Pedir um bairro antes é pedir que a pessoa já saiba a resposta que
   * veio procurar.
   *
   * Então a malha vem toda, e o peso é tratado como o que é: uma espera. Ela
   * chega em páginas, o contador mostra quantos já entraram de quantos, e quem
   * não quiser esperar pode sair da aba — a carga para. Uma vez na memória, ela
   * fica: trocar de aba não recomeça nada, e só um município novo a refaz.
   */
  const cargaDeSetores = useRef<string | null>(null);

  const carregarSetoresDaCidade = async () => {
    if (!municipio || !uf) return;
    if (cargaDeSetores.current === municipio.codigo) return;
    cargaDeSetores.current = municipio.codigo;

    setCarregandoDesenho(true);
    setErro(null);
    setFalhaDeSetores(false);
    setProgressoSetores({ lidos: 0, total: municipio.totalSetores || 0 });

    const tudo: SetorDoTerritorio[] = [];
    let inicio: number | null = 0;
    try {
      while (inicio !== null) {
        const pagina = await lerSetores(uf, municipio.codigo, undefined, inicio, true);
        // Saiu da aba no meio da carga: o resto não interessa mais a ninguém.
        if (cargaDeSetores.current !== municipio.codigo) return;
        tudo.push(...pagina.setores);
        setProgressoSetores({
          lidos: tudo.length,
          total: pagina.paginacao.total || municipio.totalSetores || tudo.length
        });
        inicio = pagina.paginacao.proximoInicio ?? null;
        // A malha já desenhada acompanha a chegada: o mapa vai se preenchendo
        // em vez de ficar branco esperando a última página.
        setSetores([...tudo]);
      }
      setSetoresDe(municipio.codigo);
    } catch (falha: any) {
      cargaDeSetores.current = null;
      setFalhaDeSetores(true);
      setErro(falha);
    } finally {
      setCarregandoDesenho(false);
      setProgressoSetores(null);
    }
  };

  /**
   * O relatório para a gaveta da barra.
   *
   * Ela é quem liga a camada, então é ela que precisa dizer se está vindo,
   * se veio vazia, ou se nem começou por falta de cidade escolhida.
   */
  useEffect(() => {
    onEstadoDaCamada?.({
      carregando: carregandoDesenho || carregandoBairros || carregandoMunicipios,
      progresso: progressoSetores,
      municipio: municipio?.nome || null,
      desenhados,
      erro: erro?.mensagem || null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    carregandoDesenho,
    carregandoBairros,
    carregandoMunicipios,
    progressoSetores?.lidos,
    progressoSetores?.total,
    municipio?.nome,
    desenhados,
    bairros.length,
    setores.length,
    erro?.mensagem,
    camadaLigada,
    nivelDaCamada,
    metricaDaCamada
  ]);

  /**
   * Camada ligada com a tela fechada: os bairros vêm sozinhos.
   *
   * A lista de bairros era carregada por um toque na aba — e com a gaveta da
   * barra ligando a camada sem abrir painel nenhum, esse toque não acontece
   * mais. Sem isto, ligar "População" pintaria o mapa de nada.
   */
  useEffect(() => {
    if (!camadaLigada || nivelDaCamada !== 'bairros') return;
    if (!municipio || bairros.length > 0 || carregandoBairros) return;
    carregarBairros(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camadaLigada, nivelDaCamada, municipio?.codigo, bairros.length]);

  /**
   * Abriu a tela nos bairros: a lista vem sozinha.
   *
   * O toque na aba já carregava, mas agora a aba vem escolhida de fábrica e
   * esse toque não acontece -- sem isto, a tela abriria na lista vazia, que é
   * exatamente o que ela deixou de fazer.
   */
  useEffect(() => {
    if (!aberto || aba !== 'bairros' || !municipio) return;
    if (bairros.length > 0 || carregandoBairros) return;
    carregarBairros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, aba, municipio?.codigo, bairros.length]);

  /**
   * Os bairros do seletor vêm junto com o município.
   *
   * Sem isto, a caixa do cabeçalho abriria sempre dizendo que o município não
   * tem bairros publicados — que é uma afirmação sobre o dado, não sobre a
   * carga, e estaria errada na maioria das cidades.
   */
  useEffect(() => {
    if (!aberto || !municipio) return;
    if (bairrosDoSeletor.length > 0 || carregandoBairrosDoSeletor) return;
    let cancelado = false;
    setCarregandoBairrosDoSeletor(true);
    todasAsPaginas<BairroDoTerritorio>(
      (inicio) => lerBairros(uf, municipio.codigo, inicio, false),
      'bairros'
    )
      .then((lista) => {
        if (cancelado) return;
        setBairrosDoSeletor(
          lista.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        );
      })
      // Falhar aqui não é motivo para banner de erro: o Censo do município,
      // que é o que a tela veio mostrar, não depende desta lista.
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCarregandoBairrosDoSeletor(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, uf, municipio?.codigo]);

  /**
   * Entrou na aba: a malha carrega sozinha.
   *
   * A aba de setores sem setores é uma tela que só sabe pedir. Se a malha já
   * está na memória, nada acontece; se não está, ela começa a vir.
   */
  useEffect(() => {
    const querSetores =
      (aberto && aba === 'setores') || (camadaLigada && nivelDaCamada === 'setores');
    if (!querSetores || !municipio) return;
    if (setoresDe === municipio.codigo) return;
    carregarSetoresDaCidade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, aba, camadaLigada, nivelDaCamada, municipio?.codigo]);

  /** O bairro deixa de ser porta de entrada e vira filtro do que já está aqui. */
  const abrirSetores = async (bairro: BairroDoTerritorio) => {
    if (!municipio) return;
    setAba('setores');
    setBairroDosSetores(
      bairroDosSetores?.codigo === bairro.codigo ? null : bairro
    );
    if (setoresDe !== municipio.codigo) carregarSetoresDaCidade();
  };

  /**
   * População e domicílios do recorte aberto no Censo, direto do cadastro.
   *
   * Não são lidos de dentro dos indicadores: `MunicipioDoTerritorio`,
   * `BairroDoTerritorio` e `SetorDoTerritorio` já trazem os dois campos,
   * tipados, e é o mesmo número usado nas listas de bairros e setores desta
   * tela. Ler daqui em vez de caçar um indicador chamado "população" evita
   * depender de como o Censo escreveu o rótulo.
   */
  const populacaoDoRecorteAtual =
    recorte?.nivel === 'municipio'
      ? municipio?.populacao ?? null
      : recorte?.nivel === 'bairro'
        ? [...bairros, ...bairrosDoSeletor].find((b) => b.codigo === recorte.codigo)
            ?.populacao ?? null
        : recorte?.nivel === 'setor'
          ? setores.find((s) => s.codigo === recorte.codigo)?.populacao ?? null
          : null;

  const domiciliosDoRecorteAtual =
    recorte?.nivel === 'municipio'
      ? municipio?.domicilios ?? null
      : recorte?.nivel === 'bairro'
        ? [...bairros, ...bairrosDoSeletor].find((b) => b.codigo === recorte.codigo)
            ?.domicilios ?? null
        : recorte?.nivel === 'setor'
          ? setores.find((s) => s.codigo === recorte.codigo)?.domicilios ?? null
          : null;

  const carregarCenso = async (nivel: string, codigo: string, nome: string) => {
    setAba('censo');
    setRecorte({ nivel, codigo, nome });
    setCenso(null);
    setErro(null);
    setCarregandoCenso(true);
    try {
      const dados = await lerIndicadores(uf, nivel, codigo);
      setCenso(dados);
      // Qual grupo abre expandido é decisão do PainelDoCenso, não daqui.
    } catch (falha: any) {
      setErro(falha);
    } finally {
      setCarregandoCenso(false);
    }
  };

  /**
   * Mede um círculo.
   *
   * Os argumentos existem para quem chama logo depois de mudar o estado: o
   * React ainda não aplicou a troca, e ler `raio` aqui dentro mediria o valor
   * velho. Quem não passa nada usa o que está na tela — centro marcado, se
   * houver, e o centro do mapa quando não houver.
   */
  const analisar = async (
    alvo?: { lat: number; lng: number } | null,
    raioAlvo?: number
  ) => {
    const centro = alvo || centroFixo || centroDoMapa();
    const metros = raioAlvo || raio;
    if (!centro || !uf || analisando) return;
    const geracao = geracaoDoCirculoRef.current;
    setAnalisando(true);
    setErro(null);
    setAnalise(null);
    try {
      const dados = await analisarRaio(uf, centro.lat, centro.lng, metros);
      // Fechado no meio da medida: a resposta chegou tarde e não redesenha nada.
      if (geracao !== geracaoDoCirculoRef.current) return;
      setAnalise(dados.analise);
      onCirculoAnalisado({ lat: centro.lat, lng: centro.lng, raio: metros });
    } catch (falha: any) {
      if (geracao !== geracaoDoCirculoRef.current) return;
      setErro(falha);
      onCirculoAnalisado(null);
    } finally {
      setAnalisando(false);
    }
  };

  /**
   * Muda a cada vez que o círculo é largado. Uma medida que sai antes e volta
   * depois do fechar compara a geração e morre calada — senão o círculo
   * fechado reaparecia sozinho segundos depois.
   */
  const geracaoDoCirculoRef = useRef(0);

  /** A identidade de um círculo: dois círculos iguais não são medidos duas vezes. */
  const chaveDoCirculo = (circulo: { lat: number; lng: number; raio: number }) =>
    `${circulo.lat.toFixed(6)},${circulo.lng.toFixed(6)},${circulo.raio}`;

  /**
   * Chegou um círculo de fora: é ele que manda.
   *
   * Quem tocou em "Quem mora aqui" já disse onde e já disse quanto. O painel
   * passa a responder sobre ESSA área — o tamanho vira o que foi desenhado,
   * mesmo que não seja nenhum dos quatro da régua.
   *
   * Aqui só se anota o alvo. Medir é o efeito de baixo, porque a medida
   * depende da UF e a UF chega depois.
   */
  useEffect(() => {
    if (!circuloExterno || !aberto) return;
    setAba('raio');
    setRaio(circuloExterno.raio);
    setCentroFixo({ lat: circuloExterno.lat, lng: circuloExterno.lng });
    setCirculoEmFoco({
      lat: circuloExterno.lat,
      lng: circuloExterno.lng,
      raio: circuloExterno.raio
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuloExterno, aberto]);

  /**
   * A medida sai assim que houver UF — e uma vez só por círculo.
   *
   * A UF vem do cadastro do cliente ou da consulta de cobertura, e as duas
   * chegam depois da montagem. Medir num efeito que roda uma vez só, no
   * instante em que o círculo chega, era medir com a UF ainda vazia: a
   * chamada era abortada na porta e nada aparecia na tela.
   *
   * `analiseDe` é marcado ANTES do `await` de propósito. O efeito depende de
   * `analisando`, e sem a marca a volta ao `false` — inclusive a volta por
   * erro — dispararia a medida de novo, para sempre.
   */
  useEffect(() => {
    if (!aberto || !circuloEmFoco || !uf || analisando) return;
    const chave = chaveDoCirculo(circuloEmFoco);
    if (analiseDe === chave) return;
    setAnaliseDe(chave);
    analisar(
      { lat: circuloEmFoco.lat, lng: circuloEmFoco.lng },
      circuloEmFoco.raio
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, uf, circuloEmFoco, analiseDe, analisando]);

  /** Sai do círculo e volta para o recorte do Censo, sem perder o desenho. */
  const voltarParaORecorte = () => {
    geracaoDoCirculoRef.current += 1;
    setCirculoEmFoco(null);
    setAnalise(null);
    setAnaliseDe(null);
    setCentroFixo(null);
    setErro(null);
    onCirculoAnalisado(null);
  };

  /**
   * Fechar é fechar: o círculo não sobrevive ao painel.
   *
   * O painel fica montado quando some (é assim que ele lembra o município e
   * o recorte), e o círculo ia junto nessa memória — fechava-se o painel e a
   * área verde continuava no mapa, sem ter mais de onde tirá-la. Os recortes
   * do Censo continuam lembrados; a pergunta do raio, não.
   */
  useEffect(() => {
    if (aberto) return;
    geracaoDoCirculoRef.current += 1;
    setCirculoEmFoco(null);
    setAnalise(null);
    setAnaliseDe(null);
    setCentroFixo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  /** O ✕ do mapa: sai do círculo como se fosse pelo botão daqui de dentro. */
  useEffect(() => {
    if (!pedidoParaFecharCirculo) return;
    voltarParaORecorte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoParaFecharCirculo]);

  /** Mede de novo o mesmo círculo — o botão que a falha deixa na tela. */
  const medirDeNovo = () => {
    if (!circuloEmFoco) return;
    setErro(null);
    setAnaliseDe(null);
  };

  /**
   * O que o mapa desenha, e com que cores.
   *
   * Com um bairro aberto, o desenho é dos setores dele — o recorte mais fino
   * responde melhor à pergunta "onde dentro deste bairro". Sem bairro aberto,
   * são os bairros do município.
   *
   * A escala é por quantis, não por fatias iguais do intervalo: com um bairro
   * de 51 mil habitantes e dez de 3 mil, fatiar o intervalo em cinco partes
   * pintaria quase tudo com a mesma cor e esconderia justamente a diferença
   * entre os dez.
   */
  useEffect(() => {
    /*
     * A mancha sobrevive ao painel.
     *
     * Antes o desenho morria junto com o fechamento: quem tinha acabado de
     * escolher "densidade por setor" fechava o painel para ver o mapa e
     * perdia exatamente o que tinha ido ver. Agora, com a camada ligada na
     * barra, é ela quem manda — e o painel só desenha por conta própria
     * enquanto está aberto.
     */
    const desenhar = camadaLigada || (aberto && desenharNoMapa);
    if (!desenhar) {
      setDesenhados(0);
      onRecortes([], []);
      return;
    }

    /*
     * QUEM MANDA NA PINTURA É A ABA ABERTA.
     *
     * Antes era "tem setor carregado?", e isso bastava enquanto setor só
     * existia depois de escolher um bairro. Agora a malha da cidade fica na
     * memória: sem esta regra, voltar para a aba de bairros continuaria
     * mostrando setores, e a lista ao lado falaria de uma coisa enquanto o mapa
     * mostraria outra.
     */
    const doSetor = camadaLigada
      ? nivelDaCamada === 'setores' && setoresNaTela.length > 0
      : aba === 'setores' && setoresNaTela.length > 0;
    const fonte: {
      id: string;
      nome: string;
      geometria: any;
      valor: number | null;
      resumo: string;
      tipo: 'bairro' | 'setor';
      /** Números crus do recorte, para a ficha que abre sob o cursor. */
      dados: {
        populacao: number | null;
        domicilios: number | null;
        areaKm2: number | null;
        densidade: number | null;
        mediaMoradores: number | null;
        imputados: number | null;
      };
    }[] =
      doSetor
        ? setoresNaTela.map((setor) => {
            const valor =
              metrica === 'densidade'
                ? setor.areaKm2 && setor.populacao !== null
                  ? Math.round(setor.populacao / setor.areaKm2)
                  : null
                : metrica === 'domicilios'
                  ? setor.domicilios
                  : setor.populacao;
            return {
              id: setor.codigo,
              nome: `Setor ${setor.codigo.slice(-6)}`,
              geometria: setor.geometria,
              valor,
              resumo: [
                `${numero(setor.populacao)} hab · ${numero(setor.domicilios)} dom`,
                setor.percentualDomiciliosImputados !== null &&
                setor.percentualDomiciliosImputados > 0
                  ? `${setor.percentualDomiciliosImputados.toFixed(1)}% estimado pelo instituto`
                  : ''
              ]
                .filter(Boolean)
                .join(' · '),
              tipo: 'setor' as const,
              dados: {
                populacao: setor.populacao,
                domicilios: setor.domicilios,
                areaKm2: setor.areaKm2,
                densidade:
                  setor.areaKm2 && setor.populacao !== null
                    ? Math.round(setor.populacao / setor.areaKm2)
                    : null,
                mediaMoradores: setor.mediaMoradoresPorDomicilioOcupado,
                imputados: setor.percentualDomiciliosImputados
              }
            };
          })
        : bairros.map((bairro) => {
            const densidade =
              bairro.areaKm2 && bairro.populacao !== null
                ? Math.round(bairro.populacao / bairro.areaKm2)
                : null;
            const valor =
              metrica === 'densidade'
                ? densidade
                : metrica === 'domicilios'
                  ? bairro.domicilios
                  : bairro.populacao;
            return {
              id: bairro.codigo,
              nome: bairro.nome,
              geometria: bairro.geometria,
              valor,
              resumo: `${numero(bairro.populacao)} hab · ${numero(bairro.domicilios)} dom${
                densidade !== null ? ` · ${numero(densidade)} hab/km²` : ''
              }`,
              tipo: 'bairro' as const,
              dados: {
                populacao: bairro.populacao,
                domicilios: bairro.domicilios,
                areaKm2: bairro.areaKm2,
                densidade,
                mediaMoradores: bairro.mediaMoradoresPorDomicilioOcupado,
                imputados: null
              }
            };
          });

    const comGeometria = fonte.filter((r) => r.geometria);

    // Só os valores medidos entram na escala: um `null` no meio dos cortes
    // empurraria a régua inteira para baixo.
    const valores = comGeometria
      .map((r) => r.valor)
      .filter((v): v is number => v !== null && v !== undefined)
      .sort((a, b) => a - b);

    const TONS = ['#DBEAFE', '#93C5FD', '#60A5FA', '#2563EB', '#1E3A8A'];
    const escala =
      valores.length === 0
        ? []
        : TONS.map((cor, i) => ({
            corte: valores[Math.min(
              valores.length - 1,
              Math.floor(((i + 1) / TONS.length) * (valores.length - 1))
            )],
            cor
          }));

    setDesenhados(comGeometria.length);
    onRecortes(comGeometria, escala);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aberto,
    desenharNoMapa,
    metrica,
    bairros,
    setores,
    bairroDosSetores,
    aba,
    camadaLigada,
    nivelDaCamada
  ]);

  if (!aberto) return null;

  const semMalha = ufsComTerritorio.length > 0 && uf && !ufsComTerritorio.includes(uf);
  const semIndicadores =
    ufsComIndicadores.length > 0 && uf && !ufsComIndicadores.includes(uf);

  const bairrosNaTela = bairros
    .filter((b) =>
      buscaBairro.trim()
        ? b.nome.toLowerCase().includes(buscaBairro.trim().toLowerCase())
        : true
    )
    .slice()
    .sort((a, b) => {
      if (ordem === 'nome') return a.nome.localeCompare(b.nome);
      if (ordem === 'densidade') {
        const da = a.areaKm2 && a.populacao ? a.populacao / a.areaKm2 : -1;
        const db = b.areaKm2 && b.populacao ? b.populacao / b.areaKm2 : -1;
        return db - da;
      }
      return (b.populacao ?? -1) - (a.populacao ?? -1);
    });

  return (
    /*
     * PAINEL DE MEIA TELA, NÃO CARTÃO FLUTUANTE.
     *
     * Isto era um cartão de 360px boiando sobre o mapa, e o conteúdo não
     * cabia: nome de aba cortado no meio ("Domicílios e sanea..."), pirâmide
     * etária espremida em barras de dois centímetros, tabela de indicadores
     * rolando sem fim. Uma tela de análise territorial precisa de largura
     * para ser lida — é disso que ela trata.
     *
     * Agora ela entra no fluxo da página, como o Mapa Mental: uma faixa de 30%
     * para ela, o resto para o mapa, os dois visíveis ao mesmo tempo -- e é o
     * mapa que precisa da folga, porque é nele que a resposta aparece quando
     * este painel devolve uma coordenada.
     *
     * SÓ UMA PERGUNTA, SEM ABA PARA ESCOLHER.
     *
     * Isto tinha quatro abas -- Raio, Bairros, Setores, Censo -- e cada uma
     * era outra pergunta ("quanta gente num raio", "qual bairro tem mais
     * gente", "o que tem neste setor"). Na prática só uma delas era a que se
     * abria o painel para responder: quem mora aqui. As outras três viraram
     * cliques a mais entre abrir o painel e ver um número. Agora, escolhido o
     * município, o Censo aparece sozinho -- sem aba, sem botão "Carregar".
     *
     * O piso de 380px continua: abaixo disso os nomes das categorias do Censo
     * voltam a quebrar, e numa tela de 1280 os 30% dariam menos que isso.
     * Para a leitura detalhada existe a tela cheia, no botão do cabeçalho.
     */
    <div
      className={
        telaCheia
          ? 'fixed inset-0 z-[3200] bg-white flex flex-col font-sans animate-in fade-in duration-150'
          : 'order-3 h-full w-[30%] min-w-[380px] shrink-0 z-[1002] bg-white border-l border-slate-200 shadow-2xl flex flex-col font-sans animate-in fade-in slide-in-from-right-4 duration-200'
      }
    >
      {/* CABEÇALHO */}
      {/*
        O cabeçalho é a ficha do recorte, não a etiqueta da ferramenta.

        Antes ele repetia o nome do painel em letra grande e mandava o nome da
        cidade para uma linha de apoio cinza. Quem abre esta tela já sabe que
        abriu a inteligência territorial — o que ela precisa ler primeiro é
        QUAL lugar está na tela, em que nível de recorte e de que ano é o
        Censo. Por isso o nome do painel virou a faixa miúda de cima e a
        cidade ficou com o tamanho do título.
      */}
      <div className="shrink-0 bg-white">
        <div className="group px-3.5 pt-3 flex items-center justify-between gap-2">
          <h3 className="min-w-0 flex items-center gap-2">
            <span className="w-[3px] h-3.5 rounded-full bg-[#1447E6] shrink-0" />
            <span className="truncate text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#1447E6]">
              Inteligência territorial
            </span>
          </h3>
          <div className="shrink-0 flex items-center gap-1">
            {/*
              A tela cheia aparece com o ponteiro em cima do cabeçalho.

              São dois botões para duas coisas muito diferentes de frequência:
              fechar o painel é o gesto de todo dia, abrir em tela cheia é o de
              quando a leitura ficou apertada. Deixar os dois sempre visíveis
              fazia o canto do cabeçalho competir com o nome da cidade.
            */}
            <button
              type="button"
              onClick={() => setTelaCheia((v) => !v)}
              title={telaCheia ? 'Voltar para meia tela' : 'Abrir em tela cheia'}
              aria-label={telaCheia ? 'Voltar para meia tela' : 'Abrir em tela cheia'}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              {telaCheia ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onFechar}
              title="Fechar o painel"
              aria-label="Fechar o painel"
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------- ficha do recorte --- */}
        <div className="px-3.5 pt-1.5 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#1447E6] text-[12px] font-bold flex items-center justify-center shrink-0">
            {uf || '—'}
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-[#0F172B] leading-tight truncate">
              {circuloEmFoco
                ? 'Área desenhada'
                : recorte?.nome || municipio?.nome || 'Escolha um município'}
            </p>
            {/*
              A UF e o ano só entram quando o Censo já respondeu: antes disso
              não sabemos nem se este recorte tem indicador publicado, e
              escrever "Censo Demográfico 2022" de antemão seria prometer um
              ano que pode não valer aqui.
            */}
            <p className="text-[11px] text-[#62748E] truncate">
              {circuloEmFoco
                ? [
                    `Raio de ${distancia(circuloEmFoco.raio)}`,
                    uf || null,
                    analise
                      ? `${analise.areaKm2.toLocaleString('pt-BR', {
                          maximumFractionDigits: 2
                        })} km²`
                      : null
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : recorte
                  ? [
                      NIVEIS[recorte.nivel] || recorte.nivel,
                      uf || null,
                      censo?.fonte?.anoReferencia
                        ? `Censo Demográfico ${censo.fonte.anoReferencia}`
                        : null
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'População e Censo do território'}
            </p>
          </div>
        </div>

        {/* -------------------------------------------------- trilha --- */}
        {circuloEmFoco ? (
          <div className="px-3.5 mt-3 flex items-center gap-1.5 text-[12px] min-w-0">
            <button
              type="button"
              onClick={() => setSeletorAberto(true)}
              title="Trocar de UF ou de município"
              className="shrink-0 text-[#2563EB] hover:underline cursor-pointer"
            >
              {ufs.find((u) => u.sigla === uf)?.nome || uf || 'Território'}
            </button>
            {municipio && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                <button
                  type="button"
                  onClick={voltarParaORecorte}
                  title="Voltar para o Censo do município"
                  className="min-w-0 text-[#2563EB] hover:underline cursor-pointer truncate"
                >
                  {municipio.nome}
                </button>
              </>
            )}
            <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
            <span className="shrink-0 font-semibold text-[#0F172B] flex items-center gap-1">
              <Circle className="w-3 h-3 text-[#2563EB]" />
              Raio de {distancia(circuloEmFoco.raio)}
            </span>
          </div>
        ) : municipio ? (
          <div className="px-3.5 mt-3 flex items-center gap-1.5 text-[12px] min-w-0">
            <button
              type="button"
              onClick={() => setSeletorAberto(true)}
              title="Trocar de UF ou de município"
              className="shrink-0 text-[#2563EB] hover:underline cursor-pointer"
            >
              {ufs.find((u) => u.sigla === uf)?.nome || uf || 'Território'}
            </button>
            <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
            {recorte?.nivel === 'bairro' ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    carregarCenso('municipio', municipio.codigo, municipio.nome)
                  }
                  className="shrink-0 text-[#2563EB] hover:underline cursor-pointer truncate"
                >
                  {municipio.nome}
                </button>
                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="font-semibold text-[#0F172B] truncate">{recorte.nome}</span>
              </>
            ) : (
              <span className="font-semibold text-[#0F172B] truncate">{municipio.nome}</span>
            )}
          </div>
        ) : null}

        {/* ------------------------------------------- seletor de recorte --- */}
        <div className="px-3.5 mt-3.5 pb-4 border-b border-slate-200">
          {/*
            UF e município.

            Escondidos sempre que já existe um município resolvido: é o caso de
            quase toda abertura, porque a cidade vem do cadastro do cliente.
            Sem um município ainda, ou depois de um toque na UF da trilha, as
            duas caixas voltam — é a única situação em que alguém precisa mexer
            nelas.
          */}
          {circuloEmFoco ? (
            /*
              Com um círculo na tela, a caixa de bairro não tem o que fazer:
              ela troca o recorte do Censo, e o recorte agora é o desenho.
              O lugar é o da saída — e ela diz para onde leva.
            */
            <button
              type="button"
              onClick={voltarParaORecorte}
              className="w-full h-8 px-3 rounded-[10px] border border-slate-100 bg-white text-[12px] text-[#45556C] hover:bg-slate-50 cursor-pointer flex items-center gap-2 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {municipio ? `Voltar para ${municipio.nome}` : 'Voltar para o território'}
              </span>
            </button>
          ) : municipio && !seletorAberto ? (
            <div className="relative">
              <select
                value={recorte?.nivel === 'bairro' ? recorte.codigo : ''}
                onChange={(e) => {
                  const alvo = bairrosDoSeletor.find((b) => b.codigo === e.target.value);
                  if (alvo) carregarCenso('bairro', alvo.codigo, alvo.nome);
                  else carregarCenso('municipio', municipio.codigo, municipio.nome);
                }}
                disabled={bairrosDoSeletor.length === 0}
                className={`w-full h-8 pl-3 pr-9 rounded-[10px] border border-slate-100 bg-white text-[12px] appearance-none cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#BEDBFF] disabled:cursor-default ${
                  bairrosDoSeletor.length === 0 ? 'text-slate-400' : 'text-[#0F172B]'
                }`}
              >
                <option value="">
                  {carregandoBairrosDoSeletor
                    ? 'Carregando os bairros...'
                    : bairrosDoSeletor.length === 0
                      ? 'Este município não tem bairros publicados'
                      : `Município inteiro · ${numero(bairrosDoSeletor.length)} bairros`}
                </option>
                {bairrosDoSeletor.map((b) => (
                  <option key={b.codigo} value={b.codigo}>
                    {b.nome}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="grid grid-cols-[76px_1fr] gap-2">
              <select
                value={uf}
                onChange={(e) => {
                  setUfEscolhidaNaMao(true);
                  setUf(e.target.value.toUpperCase());
                  setMunicipios([]);
                  setMunicipio(null);
                  setBairros([]);
                  setBairrosDoSeletor([]);
                  setCenso(null);
                  setAnalise(null);
                  setCirculoEmFoco(null);
                  setAnaliseDe(null);
                  onCirculoAnalisado(null);
                }}
                className="h-8 px-2.5 bg-white border border-slate-200 rounded-[10px] text-[12px] font-semibold text-[#0F172B] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#BEDBFF]"
              >
                <option value="">UF</option>
                {(ufsComTerritorio.length > 0 ? ufsComTerritorio : [uf].filter(Boolean)).map(
                  (sigla) => (
                    <option key={sigla} value={sigla}>
                      {sigla}
                    </option>
                  )
                )}
              </select>

              <select
                value={municipio?.codigo || ''}
                onChange={(e) => {
                  const alvo = municipios.find((m) => m.codigo === e.target.value);
                  if (alvo) {
                    /*
                      Sair do círculo aqui, e não dentro de `escolherMunicipio`:
                      o município do cliente é escolhido sozinho quando o painel
                      abre, e limpar lá apagaria o círculo que acabou de chegar
                      pelo "Quem mora aqui".
                    */
                    voltarParaORecorte();
                    escolherMunicipio(alvo);
                    setSeletorAberto(false);
                  }
                }}
                disabled={municipios.length === 0}
                className="h-8 px-2.5 bg-white border border-slate-200 rounded-[10px] text-[12px] text-[#0F172B] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#BEDBFF] disabled:opacity-50 truncate"
              >
                <option value="">
                  {carregandoMunicipios ? 'Carregando municípios...' : 'Escolha o município'}
                </option>
                {municipios.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* A cobertura é estado do sistema, e a tela diz qual é. */}
          {carregandoCobertura && (
            <p className="mt-2 text-[11.5px] text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Verificando a cobertura do território...
            </p>
          )}
          {semMalha && (
            <p className="mt-2 text-[11.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-snug">
              {uf} ainda não tem o território publicado. Com malha:{' '}
              {ufsComTerritorio.join(', ') || '—'}.
            </p>
          )}
          {!semMalha && semIndicadores && (
            <p className="mt-2 text-[11.5px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug">
              {uf} tem o território, mas ainda não os indicadores do Censo — o
              painel vai vir vazio.
            </p>
          )}
          {!uf && !carregandoCobertura && ufsComTerritorio.length > 1 && (
            <p className="mt-2 text-[11.5px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug">
              Não deu para descobrir a UF deste cliente pelo cadastro. Escolha
              acima qual território consultar.
            </p>
          )}
        </div>
      </div>

      {/* CORPO */}
      {/*
        O CONTEÚDO RESPONDE À LARGURA DO PAINEL, NÃO À DA JANELA.

        Meia tela num notebook e meia tela num monitor grande são larguras
        muito diferentes, e o painel ainda abre em tela cheia. Consulta de
        container (`@container`) mede a caixa em que o conteúdo está, que é a
        medida que decide se cabem duas colunas — `md:` e `lg:` mediriam a
        janela e dariam duas colunas num painel estreito ao lado de um monitor
        largo.

        O fundo é cinza, e não branco: é ele que separa um cartão do outro na
        visão geral. Sem essa diferença, "cartão" vira só uma borda fininha
        repetida vinte vezes, e a tela inteira lê como uma lista só.
      */}
      <div className="@container flex-1 min-h-0 overflow-y-auto bg-[#F6F8FC]">
        {erro && (
          <div className="mx-3.5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
            <p className="text-[12.5px] font-semibold text-rose-700 flex items-start gap-1.5 leading-snug">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {erro.mensagem}
            </p>
            {erro.debugId && (
              <p className="text-[11px] text-rose-400 mt-1 pl-5">
                Código de rastreio: {erro.debugId}
              </p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ RAIO --- */}
        {circuloEmFoco ? (
          !uf ? (
            <p className="px-4 py-10 text-center text-[12.5px] text-slate-400 leading-snug">
              Escolha a UF acima para medir esta área. A malha de setores é
              carregada por estado, e a medida precisa saber em qual procurar.
            </p>
          ) : analisando ? (
            <p className="py-10 text-center text-[12.5px] text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Medindo a área desenhada...
            </p>
          ) : analise ? (
            <PainelDoRaio
              analise={analise}
              raio={circuloEmFoco.raio}
              instituto={censo?.fonte?.instituto || 'IBGE'}
            />
          ) : (
            /*
              Sem medida e sem espera: a chamada falhou. O aviso do erro já
              está acima; o que falta aqui é o caminho de volta — tentar de
              novo sem ter de redesenhar o círculo no mapa.
            */
            <div className="px-4 py-8 flex justify-center">
              <button
                type="button"
                onClick={medirDeNovo}
                className="h-10 px-4 bg-[#1447E6] hover:bg-[#0F3BC4] text-white text-[12.5px] font-semibold rounded-xl cursor-pointer"
              >
                Medir esta área de novo
              </button>
            </div>
          )
        ) : /* ------------------------------------------------- CENSO --- */
        !recorte ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">
            Escolha um município para ver quem mora nele.
          </p>
        ) : carregandoCenso ? (
          <p className="py-10 text-center text-[12.5px] text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Consultando o Censo...
          </p>
        ) : censo?.status === 'sem_indicadores' ? (
          <p className="m-4 text-[12.5px] text-slate-500 bg-white border border-slate-100 rounded-[14px] px-4 py-3.5 leading-snug">
            Esta UF ainda não teve os indicadores do Censo publicados. Não é
            erro da consulta — é carga que ainda não foi feita.
          </p>
        ) : censo?.status === 'ok' ? (
          /*
            Sem onVerSetores: a lista de setores não tem mais tela própria
            neste painel. Um botão "ver setores" sem lugar para ir seria pior
            do que não existir — o PainelDoCenso já sabe esconder a linha
            quando isto vem vazio.
          */
          <PainelDoCenso
            censo={censo}
            populacaoDoRecorte={populacaoDoRecorteAtual}
            domiciliosDoRecorte={domiciliosDoRecorteAtual}
          />
        ) : (
          <div className="px-4 py-6 flex justify-center">
            <button
              type="button"
              onClick={() => carregarCenso(recorte.nivel, recorte.codigo, recorte.nome)}
              className="h-10 px-4 bg-[#1447E6] hover:bg-[#0F3BC4] text-white text-[12.5px] font-semibold rounded-xl cursor-pointer"
            >
              Carregar o Censo deste recorte
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
