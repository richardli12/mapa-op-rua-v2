import { useEffect, useRef, useState } from 'react';
import {
  X,
  Layers3,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2
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
  const [carregandoCobertura, setCarregandoCobertura] = useState(false);

  /* -------------------------------------------------------- município --- */
  const [municipios, setMunicipios] = useState<MunicipioDoTerritorio[]>([]);
  const [municipio, setMunicipio] = useState<MunicipioDoTerritorio | null>(null);
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(false);

  /* ---------------------------------------------------------- bairros --- */
  const [bairros, setBairros] = useState<BairroDoTerritorio[]>([]);
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
        ? bairros.find((b) => b.codigo === recorte.codigo)?.populacao ?? null
        : recorte?.nivel === 'setor'
          ? setores.find((s) => s.codigo === recorte.codigo)?.populacao ?? null
          : null;

  const domiciliosDoRecorteAtual =
    recorte?.nivel === 'municipio'
      ? municipio?.domicilios ?? null
      : recorte?.nivel === 'bairro'
        ? bairros.find((b) => b.codigo === recorte.codigo)?.domicilios ?? null
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
    setAnalisando(true);
    setErro(null);
    setAnalise(null);
    try {
      const dados = await analisarRaio(uf, centro.lat, centro.lng, metros);
      setAnalise(dados.analise);
      onCirculoAnalisado({ lat: centro.lat, lng: centro.lng, raio: metros });
    } catch (falha: any) {
      setErro(falha);
      onCirculoAnalisado(null);
    } finally {
      setAnalisando(false);
    }
  };

  /**
   * Chegou um círculo de fora: é ele que manda.
   *
   * A aba do raio passa à frente, o tamanho vira o que foi desenhado — mesmo
   * que não seja nenhum dos quatro da régua — e a medida sai sozinha. Abrir o
   * painel e ainda pedir um toque em "analisar" seria guardar a resposta atrás
   * de uma porta que a pessoa já abriu.
   */
  useEffect(() => {
    if (!circuloExterno || !aberto) return;
    setAba('raio');
    setRaio(circuloExterno.raio);
    setCentroFixo({ lat: circuloExterno.lat, lng: circuloExterno.lng });
    analisar({ lat: circuloExterno.lat, lng: circuloExterno.lng }, circuloExterno.raio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuloExterno?.lat, circuloExterno?.lng, circuloExterno?.raio, aberto]);

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
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-black text-[#0D233A] leading-tight flex items-center gap-1.5">
              <Layers3 className="w-4 h-4 text-emerald-600" />
              Inteligência territorial
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">
              {municipio
                ? `${municipio.nome} · ${numero(municipio.populacao)} habitantes`
                : 'População e Censo do território'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setTelaCheia((v) => !v)}
              title={telaCheia ? 'Voltar para meia tela' : 'Abrir em tela cheia'}
              aria-label={telaCheia ? 'Voltar para meia tela' : 'Abrir em tela cheia'}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              {telaCheia ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onFechar}
              title="Fechar"
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/*
          UF e município.

          Escondido sempre que já existe um município resolvido: é o caso de
          quase toda abertura, porque a cidade vem do cadastro do cliente. Sem
          um município ainda, ou depois de "Trocar município", as duas caixas
          aparecem — é a única situação em que alguém precisa mexer nelas.
        */}
        {municipio && !seletorAberto ? (
          <button
            type="button"
            onClick={() => setSeletorAberto(true)}
            className="mt-2 text-[10.5px] font-bold text-slate-400 hover:text-[#015FC9] cursor-pointer transition-colors"
          >
            Trocar município
          </button>
        ) : (
          <div className="mt-3 grid grid-cols-[76px_1fr] gap-2">
            <select
              value={uf}
              onChange={(e) => {
                setUfEscolhidaNaMao(true);
                setUf(e.target.value.toUpperCase());
                setMunicipios([]);
                setMunicipio(null);
                setBairros([]);
                setCenso(null);
                setAnalise(null);
                onCirculoAnalisado(null);
              }}
              className="h-9 px-2 bg-white border border-slate-200 rounded-xl text-[11.5px] font-bold text-slate-700 cursor-pointer focus:outline-hidden"
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
                  escolherMunicipio(alvo);
                  setSeletorAberto(false);
                }
              }}
              disabled={municipios.length === 0}
              className="h-9 px-2 bg-white border border-slate-200 rounded-xl text-[11.5px] font-bold text-slate-700 cursor-pointer focus:outline-hidden disabled:opacity-50 truncate"
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
          <p className="mt-2 text-[10.5px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verificando a cobertura do território...
          </p>
        )}
        {semMalha && (
          <p className="mt-2 text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-snug">
            {uf} ainda não tem o território publicado. Com malha:{' '}
            {ufsComTerritorio.join(', ') || '—'}.
          </p>
        )}
        {!semMalha && semIndicadores && (
          <p className="mt-2 text-[10.5px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug">
            {uf} tem o território, mas ainda não os indicadores do Censo — o
            painel vai vir vazio.
          </p>
        )}

        {!uf && !carregandoCobertura && ufsComTerritorio.length > 1 && (
          <p className="mt-2 text-[10.5px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug">
            Não deu para descobrir a UF deste cliente pelo cadastro. Escolha
            acima qual território consultar.
          </p>
        )}

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
      */}
      <div className="@container flex-1 min-h-0 overflow-y-auto px-4 py-3.5">
        {erro && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
            <p className="text-[11.5px] font-bold text-rose-700 flex items-start gap-1.5 leading-snug">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {erro.mensagem}
            </p>
            {erro.debugId && (
              <p className="text-[10px] font-semibold text-rose-400 mt-1 pl-5">
                Código de rastreio: {erro.debugId}
              </p>
            )}
          </div>
        )}

        {/* ----------------------------------------------------- CENSO --- */}
          <div>
            {!recorte ? (
              <p className="py-8 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                Escolha um município
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-black text-[#0D233A] truncate">
                      {recorte.nome}
                    </p>
                    {/*
                      A UF e o ano só entram quando o Censo já respondeu: antes
                      disso não sabemos nem se este recorte tem indicador
                      publicado, e escrever "Censo Demográfico 2022" de
                      antemão seria prometer um ano que pode não valer aqui.
                    */}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {recorte.nivel}
                      {uf && ` · ${uf}`}
                      {censo?.fonte?.anoReferencia &&
                        ` · Censo Demográfico ${censo.fonte.anoReferencia}`}
                    </p>
                  </div>
                  {!censo && !carregandoCenso && (
                    <button
                      type="button"
                      onClick={() =>
                        carregarCenso(recorte.nivel, recorte.codigo, recorte.nome)
                      }
                      className="h-8 px-3 bg-[#015FC9] hover:bg-[#0150ab] text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg cursor-pointer shrink-0"
                    >
                      Carregar
                    </button>
                  )}
                </div>

                {carregandoCenso && (
                  <p className="py-8 text-center text-[11px] font-bold text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Consultando o Censo...
                  </p>
                )}

                {censo?.status === 'sem_indicadores' && (
                  <p className="mt-3 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 leading-snug">
                    Esta UF ainda não teve os indicadores do Censo publicados.
                    Não é erro da consulta — é carga que ainda não foi feita.
                  </p>
                )}

                {censo?.status === 'ok' && (
                  <div className="mt-3">
                    {/*
                      Sem onVerSetores: a lista de setores não tem mais tela
                      própria neste painel. Um botão "ver setores" sem lugar
                      para ir seria pior do que não existir — o PainelDoCenso
                      já sabe virar a linha em texto simples quando isto vem
                      vazio.
                    */}
                    <PainelDoCenso
                      censo={censo}
                      populacaoDoRecorte={populacaoDoRecorteAtual}
                      domiciliosDoRecorte={domiciliosDoRecorteAtual}
                    />
                  </div>
                )}
              </>
            )}
          </div>
      </div>
    </div>
  );
}
