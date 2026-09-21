import { useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  Store,
  Star,
  Phone,
  Globe,
  MapPin,
  Loader2,
  AlertCircle,
  Crosshair,
  Circle as CirculoIcone,
  Footprints,
  Maximize2,
  Building2,
  Trash2
} from 'lucide-react';
import {
  pesquisarEstabelecimentos,
  varrerRaio,
  Estabelecimento,
  EstabelecimentoNoRaio,
  ErroDaPesquisa
} from '../services/estabelecimentos';
import { distanciaCurta, tempoAPeCurto } from './checkin/missoes';

/** O círculo que recorta a busca: centro marcado no mapa e raio em metros. */
export interface CirculoDeBusca {
  lat: number;
  lng: number;
  raio: number;
}

/** Onde a busca procura. */
type Modo = 'cidade' | 'area' | 'raio';

/**
 * Raios de bolso.
 *
 * Não são números redondos por estética: cem metros é a quadra em volta,
 * duzentos e cinquenta é o quarteirão inteiro, quinhentos é a caminhada de
 * cinco minutos e mil é o limite do que se faz a pé numa manhã.
 */
const RAIOS = [100, 250, 500, 1000];

/**
 * O que se procura em volta de um ponto, sem precisar digitar.
 *
 * Quem está no mapa decidindo onde panfletar não quer escrever: quer saber o
 * que existe ali. Estes são os lugares onde há fila, sombra e gente parada —
 * que é o que interessa para o trabalho de rua.
 */
const ATALHOS = [
  'Farmácia',
  'Mercado',
  'Padaria',
  'Escola',
  'Posto de saúde',
  'Igreja',
  'Bar',
  'Restaurante',
  'Salão de beleza',
  'Posto de gasolina'
];

/** Sem acento, sem caixa, sem espaço sobrando: para comparar nome de cidade. */
const semAcento = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * O TERMO QUE VAI PARA A FONTE.
 *
 * A API do CCO recebe um ponto e um zoom, e trata os dois como dica de
 * escala — não como fronteira. Buscar "farmácia" com o mapa em Parauapebas
 * devolvia farmácia de Marabá, de Belém e de outro estado, porque nada na
 * consulta dizia de que cidade se estava falando. No modo "na cidade", que
 * não mandava nem o ponto, a busca era literalmente o país inteiro.
 *
 * Então a cidade entra no texto, que é a única parte da consulta que a fonte
 * trata como endereço. Se a pessoa já escreveu o nome da cidade, nada é
 * acrescentado: "farmácia em Parauapebas Parauapebas - PA" piora a busca em
 * vez de melhorar.
 */
const termoComCidade = (texto: string, municipio?: string | null, uf?: string | null) => {
  const limpo = texto.trim();
  const cidade = (municipio || '').trim();
  if (!cidade) return limpo;
  if (semAcento(limpo).includes(semAcento(cidade))) return limpo;
  return `${limpo} em ${cidade}${uf ? ` - ${uf}` : ''}`;
};

/**
 * Este resultado é do município do cliente?
 *
 * A pergunta é respondida pelo endereço, que é o que a fonte devolve escrito.
 * Endereço que não cita a cidade é de outro lugar — a fonte escreve a cidade
 * em todo endereço que tem. Resultado SEM endereço nenhum não é descartado:
 * ausência de prova não é prova de ausência, e sumir com um lugar por falta
 * de dado seria esconder, não filtrar.
 */
const doMunicipio = (endereco: string | null, municipio?: string | null) => {
  const cidade = (municipio || '').trim();
  if (!cidade) return true;
  if (!endereco || !endereco.trim()) return true;
  return semAcento(endereco).includes(semAcento(cidade));
};

/** "1 km" em vez de "1000 m": é assim que se fala de distância na rua. */
const raioCurto = (metros: number) =>
  metros >= 1000
    ? `${(metros / 1000).toFixed(1).replace('.0', '').replace('.', ',')} km`
    : `${Math.round(metros)} m`;

/**
 * O menor raio redondo que alcançaria uma distância.
 *
 * Serve para a oferta de ampliar: ninguém quer "ampliar para 137 m". Sobe
 * para a dezena, a cinquentena ou a centena mais próxima acima, conforme o
 * tamanho — e sempre um pouco além do alvo, para ele entrar com folga.
 */
const raioQueAlcanca = (metros: number) => {
  const alvo = metros + 1;
  const passo = alvo <= 200 ? 25 : alvo <= 1000 ? 50 : 250;
  return Math.ceil(alvo / passo) * passo;
};

interface PesquisaEstabelecimentosProps {
  aberto: boolean;
  onFechar: () => void;
  /** Centro do mapa agora, usado como área da busca. */
  centroDoMapa: () => { lat: number; lng: number; zoom: number } | null;
  /**
   * O município do cliente em foco, e a UF dele.
   *
   * É o que amarra a busca ao lugar certo: entra no texto da consulta e
   * decide o que é resultado de fora. Vazio (nenhum cliente escolhido no
   * mapa) devolve a busca ao comportamento antigo, e a tela avisa.
   */
  municipio?: string | null;
  uf?: string | null;
  /** O círculo da busca, desenhado no mapa por quem é dono dele: o mapa. */
  circulo: CirculoDeBusca | null;
  onCirculo: (circulo: CirculoDeBusca | null) => void;
  /** Ferramenta de desenhar o raio armada no mapa. */
  desenhando: boolean;
  onDesenhar: (armar: boolean) => void;
  /** Resultados desenhados no mapa. */
  onResultados: (lugares: Estabelecimento[]) => void;
  /** Levar o mapa até um resultado escolhido na lista. */
  onEscolher: (lugar: Estabelecimento) => void;
  /** Id do que está em foco, para a lista acompanhar o mapa. */
  emFoco?: string | null;
  /**
   * Passar o olho na lista acende o pino no mapa.
   *
   * Ler "Farmácia Central" não diz onde ela fica. Com o cursor em cima da
   * linha, o pino correspondente cresce lá fora — dá para varrer a lista
   * inteira e entender a distribuição sem clicar em nada nem perder o
   * enquadramento.
   */
  onDestacar?: (id: string | null) => void;
}

/**
 * Pesquisa de estabelecimentos do CCO, dentro do mapa.
 *
 * O painel manda o texto e desenha o que voltar. Duas decisões de operação
 * guiam o resto:
 *
 * - **A área da busca é o que está na tela.** Quem está olhando um bairro
 *   quer as farmácias daquele bairro, não as da capital. O centro e o zoom do
 *   mapa vão junto do texto, e há uma chave para desligar isso quando a busca
 *   é por outro lugar ("farmácia em Maceió").
 * - **A próxima página vem do `proximoInicio` da resposta**, nunca de somar
 *   de 20 em 20: o tamanho da página é decidido pela fonte externa.
 */
export default function PesquisaEstabelecimentos({
  aberto,
  onFechar,
  centroDoMapa,
  municipio,
  uf,
  circulo,
  onCirculo,
  desenhando,
  onDesenhar,
  onResultados,
  onEscolher,
  emFoco,
  onDestacar
}: PesquisaEstabelecimentosProps) {
  const [termo, setTermo] = useState('');
  const [modo, setModo] = useState<Modo>('area');
  /** Quantos resultados a fonte devolveu de fora do município, e sumiram. */
  const [deFora, setDeFora] = useState(0);
  /** Tudo que a última varredura mediu, inclusive o que caiu fora do raio. */
  const [medidos, setMedidos] = useState<EstabelecimentoNoRaio[]>([]);
  const [truncado, setTruncado] = useState(false);
  /**
   * Já houve varredura neste raio?
   *
   * Separado do `pesquisou` da busca por texto de propósito: trocar de "nesta
   * área" para "no raio" com resultados na tela mostrava "nada encontrado"
   * antes de a pessoa ter procurado qualquer coisa dentro do círculo. Cada
   * recorte responde pelo que ele mesmo procurou.
   */
  const [varreu, setVarreu] = useState(false);
  const [lugares, setLugares] = useState<Estabelecimento[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscandoMais, setBuscandoMais] = useState(false);
  const [erro, setErro] = useState<ErroDaPesquisa | null>(null);
  const [proximoInicio, setProximoInicio] = useState<number | null>(null);
  const [pesquisou, setPesquisou] = useState(false);
  /** Termo da busca em tela, para a paginação repetir exatamente ele. */
  const termoBuscadoRef = useRef('');
  /** O raio da última varredura, para saber quando refazê-la. */
  const raioBuscadoRef = useRef(0);

  const noRaio = modo === 'raio' && circulo;

  /*
   * O raio manda na lista na hora.
   *
   * Mudar de cem para duzentos metros refiltra o que já está na mão, sem
   * esperar a rede — e é essa resposta imediata que deixa o raio virar um
   * controle, e não um formulário. A busca é refeita logo depois, por baixo,
   * porque um círculo maior alcança lugares que a escala anterior nem pediu.
   */
  const dentroDoRaio = circulo
    ? medidos.filter(l => l.distancia <= circulo.raio)
    : [];
  const foraDoRaio = circulo ? medidos.filter(l => l.distancia > circulo.raio) : [];
  const maisPertoDeFora = foraDoRaio.length > 0 ? foraDoRaio[0].distancia : null;

  const mostrados: (Estabelecimento | EstabelecimentoNoRaio)[] = noRaio
    ? dentroDoRaio
    : lugares;

  /*
   * O mapa desenha o que a lista está mostrando — sempre os dois de acordo.
   *
   * Sem isto, apertar o raio deixaria na tela pinos que a lista já não conta,
   * e a pessoa passaria a contar pinos com o dedo para saber em quem
   * acreditar.
   */
  useEffect(() => {
    onResultados(noRaio ? dentroDoRaio : lugares);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noRaio, circulo?.raio, medidos, lugares]);

  /*
   * CENTRO NOVO, MESMA PERGUNTA.
   *
   * Depois da primeira varredura, remarcar o círculo noutra esquina é
   * perguntar a mesma coisa sobre outro lugar — "e aqui, quantas farmácias
   * tem?". Obrigar a apertar Pesquisar de novo seria cobrar duas vezes pelo
   * mesmo pedido: o gesto no mapa já é o pedido. Só o centro dispara isto; o
   * raio tem o caminho dele, que refiltra na hora.
   */
  const varrerRef = useRef<((texto: string, alvo: CirculoDeBusca) => void) | null>(null);
  const centroVarridoRef = useRef('');
  useEffect(() => {
    if (!circulo || modo !== 'raio') return;
    const chave = `${circulo.lat.toFixed(6)},${circulo.lng.toFixed(6)}`;
    if (centroVarridoRef.current === chave) return;
    centroVarridoRef.current = chave;
    const texto = (termo || termoBuscadoRef.current).trim();
    if (texto) varrerRef.current?.(texto, circulo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circulo?.lat, circulo?.lng, modo]);

  if (!aberto) return null;

  const buscar = async (continuando = false) => {
    const texto = (continuando ? termoBuscadoRef.current : termo).trim();
    if (!texto) return;
    if (continuando && proximoInicio === null) return;

    if (continuando) setBuscandoMais(true);
    else {
      setBuscando(true);
      setErro(null);
    }

    try {
      const pagina = await pesquisarEstabelecimentos({
        termo: termoComCidade(texto, municipio, uf),
        centro: modo === 'area' ? centroDoMapa() : null,
        inicio: continuando ? proximoInicio || 0 : 0
      });

      /*
       * O que é de outra cidade não entra na lista.
       *
       * Amarrar o texto à cidade melhora muito o que a fonte devolve, mas não
       * garante nada: ela continua livre para mandar a farmácia do município
       * vizinho quando acha que é o que se procurava. Quem está no mapa de
       * uma cidade não tem o que fazer com o comércio de outra, então o
       * resultado de fora é descartado aqui — e contado, para a tela poder
       * dizer que ele existiu em vez de só sumir com ele.
       */
      const dentro = pagina.estabelecimentos.filter(l => doMunicipio(l.endereco, municipio));
      const fora = pagina.estabelecimentos.length - dentro.length;

      const juntos = continuando ? [...lugares, ...dentro] : dentro;
      setDeFora(prev => (continuando ? prev + fora : fora));

      termoBuscadoRef.current = texto;
      setLugares(juntos);
      setProximoInicio(pagina.proximoInicio);
      setPesquisou(true);
      onResultados(juntos);
    } catch (falha: any) {
      setErro(falha as ErroDaPesquisa);
      if (!continuando) {
        setLugares([]);
        onResultados([]);
        setPesquisou(true);
      }
    } finally {
      setBuscando(false);
      setBuscandoMais(false);
    }
  };

  /**
   * A varredura do círculo.
   *
   * Aqui não há "carregar mais": o recorte é fechado, e o que existe dentro
   * dele é finito. O serviço busca as páginas que forem necessárias, mede
   * cada lugar e devolve tudo medido — a lista só escolhe o que mostrar.
   */
  const varrer = async (texto: string, alvo: CirculoDeBusca) => {
    const limpo = texto.trim();
    if (!limpo) return;

    setBuscando(true);
    setErro(null);
    try {
      const varredura = await varrerRaio({
        /*
         * No raio o círculo já é a fronteira, e ele pode atravessar o limite
         * do município de propósito — quem desenhou sabe onde desenhou. Por
         * isso aqui a cidade entra só como dica no texto, para a fonte olhar
         * para o lugar certo, e nenhum resultado é descartado por endereço.
         */
        termo: termoComCidade(limpo, municipio, uf),
        centro: { lat: alvo.lat, lng: alvo.lng },
        raio: alvo.raio
      });
      termoBuscadoRef.current = limpo;
      raioBuscadoRef.current = alvo.raio;
      setMedidos(varredura.todos);
      setTruncado(varredura.truncado);
      // Quem marca "já procurei" aqui é o `varreu`: `pesquisou` é da busca
      // por texto, e marcá-lo faria a volta para "nesta área" anunciar zero
      // resultados de uma pesquisa que nunca aconteceu lá.
      setVarreu(true);
      setProximoInicio(null);
      onResultados(varredura.dentro);
    } catch (falha: any) {
      setErro(falha as ErroDaPesquisa);
      setMedidos([]);
      onResultados([]);
      setVarreu(true);
    } finally {
      setBuscando(false);
    }
  };

  // O efeito do centro roda antes desta linha existir: o aviso passa por ref.
  varrerRef.current = varrer;

  /** O botão de pesquisar e o Enter: cada modo sabe para onde ir. */
  const disparar = (texto = termo) => {
    if (modo === 'raio') {
      if (!circulo) {
        onDesenhar(true);
        return;
      }
      varrer(texto, circulo);
      return;
    }
    if (texto !== termo) setTermo(texto);
    termoBuscadoRef.current = texto;
    buscar(false);
  };

  /**
   * Trocar o raio: a lista responde na hora, a rede responde depois.
   *
   * O filtro local já aconteceu (é derivado do estado), então aqui só resta
   * refazer a varredura quando o círculo cresceu — encolher nunca revela
   * nada novo, e gastar cota do CCO para devolver menos resultados seria
   * trabalho para piorar.
   */
  const mudarRaio = (metros: number) => {
    if (!circulo) return;
    const novo = { ...circulo, raio: metros };
    onCirculo(novo);
    if (termoBuscadoRef.current && metros > raioBuscadoRef.current) {
      varrer(termoBuscadoRef.current, novo);
    }
  };

  const limpar = () => {
    setTermo('');
    setLugares([]);
    setMedidos([]);
    setDeFora(0);
    setTruncado(false);
    setVarreu(false);
    setErro(null);
    setProximoInicio(null);
    setPesquisou(false);
    termoBuscadoRef.current = '';
    raioBuscadoRef.current = 0;
    onResultados([]);
    onDestacar?.(null);
  };

  return (
    <div className="absolute left-[5.5rem] top-1/2 -translate-y-1/2 z-[1200] w-[350px] max-h-[86vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col font-sans animate-in fade-in slide-in-from-left-2 duration-150">
      {/* CABEÇALHO */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-black text-[#0D233A] leading-tight flex items-center gap-1.5">
              <Store className="w-4 h-4 text-[#015FC9]" />
              Estabelecimentos
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {(noRaio ? varreu : pesquisou) && !erro
                ? noRaio && circulo
                  ? `${dentroDoRaio.length} ${
                      dentroDoRaio.length === 1 ? 'lugar' : 'lugares'
                    } dentro de ${raioCurto(circulo.raio)}`
                  : `${lugares.length} ${
                      lugares.length === 1 ? 'resultado' : 'resultados'
                    } no mapa`
                : 'Pesquise comércios e serviços da região'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(lugares.length > 0 || termo) && (
              <button
                type="button"
                onClick={limpar}
                title="Limpar a pesquisa"
                className="h-8 px-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 text-[10.5px] font-black uppercase tracking-wider cursor-pointer transition-all"
              >
                Limpar
              </button>
            )}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            disparar();
          }}
          className="mt-3"
        >
          <div className="relative flex items-center bg-white border border-slate-200 rounded-xl h-10 px-3 focus-within:ring-2 focus-within:ring-blue-500/20">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              autoFocus
              type="text"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              maxLength={200}
              placeholder="Farmácia, escola, mercado..."
              className="bg-transparent border-none w-full text-[12px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden"
            />
            {buscando && (
              <Loader2 className="w-3.5 h-3.5 text-[#015FC9] animate-spin shrink-0" />
            )}
          </div>

          {/*
            ONDE PROCURAR — a pergunta que vinha antes da resposta e não
            estava escrita em lugar nenhum.

            Era uma chavinha só, "Nesta área", ligada ou desligada: ninguém
            sabia o que "desligada" significava, nem que dava para recortar
            um pedaço do mapa. Agora os três recortes possíveis estão à
            vista, e o que está valendo tem cor.
          */}
          <div className="mt-2 grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
            {(
              [
                {
                  id: 'cidade',
                  // O rótulo nomeia a cidade porque o recorte é ela. "Na
                  // cidade" não dizia qual, e era justamente o modo que
                  // procurava no país inteiro.
                  rotulo: municipio ? `Em ${municipio}` : 'Na cidade',
                  icone: Building2,
                  ajuda: municipio
                    ? `Busca em ${municipio} inteira, sem recorte de mapa`
                    : 'Escolha um cliente no mapa para limitar a busca à cidade dele'
                },
                {
                  id: 'area',
                  rotulo: 'Nesta área',
                  icone: Crosshair,
                  ajuda: municipio
                    ? `Busca no pedaço de mapa que está na tela, dentro de ${municipio}`
                    : 'Busca no pedaço de mapa que está na tela'
                },
                { id: 'raio', rotulo: 'No raio', icone: CirculoIcone, ajuda: 'Busca dentro de um círculo marcado no mapa' }
              ] as const
            ).map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                onClick={() => setModo(opcao.id)}
                title={opcao.ajuda}
                className={`h-8 rounded-lg text-[10.5px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  modo === opcao.id
                    ? 'bg-white text-[#015FC9] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <opcao.icone className="w-3.5 h-3.5" />
                {opcao.rotulo}
              </button>
            ))}
          </div>

          {/*
            SEM CIDADE, A BUSCA NÃO TEM FRONTEIRA — e isso fica escrito.

            Com "todos os clientes" no mapa não há município para amarrar a
            consulta, e a fonte volta a responder o que quiser, de onde
            quiser. Antes isso acontecia calado.
          */}
          {!municipio && modo !== 'raio' && (
            <p className="mt-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10.5px] font-bold text-amber-800 leading-snug">
              Nenhum cliente escolhido no mapa: a pesquisa não tem cidade para
              se prender e pode trazer resultados de qualquer lugar. Escolha um
              cliente, ou marque um raio.
            </p>
          )}

          {/* O RAIO: marcar, medir e apertar — tudo no mesmo lugar. */}
          {modo === 'raio' && (
            <div className="mt-2 rounded-xl border border-[#015FC9]/25 bg-[#F5F9FF] p-2">
              {!circulo ? (
                <>
                  <button
                    type="button"
                    onClick={() => onDesenhar(!desenhando)}
                    className={`w-full h-9 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99] ${
                      desenhando
                        ? 'bg-[#0D233A] text-white'
                        : 'bg-[#015FC9] hover:bg-[#0150ab] text-white'
                    }`}
                  >
                    <CirculoIcone className="w-3.5 h-3.5" />
                    {desenhando ? 'Desenhe no mapa…' : 'Marcar o raio no mapa'}
                  </button>
                  <p className="mt-1.5 text-[10.5px] font-semibold text-slate-500 leading-snug text-center">
                    {desenhando ? (
                      <>
                        Aperte no centro e arraste até a borda. Um clique seco
                        marca {raioCurto(100)}.
                      </>
                    ) : (
                      <>
                        Ou{' '}
                        <button
                          type="button"
                          onClick={() => {
                            const vista = centroDoMapa();
                            if (vista) onCirculo({ lat: vista.lat, lng: vista.lng, raio: 250 });
                          }}
                          className="font-black text-[#015FC9] hover:underline cursor-pointer"
                        >
                          use o centro do mapa
                        </button>{' '}
                        como centro.
                      </>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 min-w-0 text-[11px] font-black text-[#0D233A] flex items-center gap-1.5">
                      <CirculoIcone className="w-3.5 h-3.5 text-[#015FC9] shrink-0" />
                      Raio de {raioCurto(circulo.raio)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDesenhar(true)}
                      title="Marcar outro centro no mapa"
                      className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#015FC9] hover:border-[#015FC9]/40 cursor-pointer transition-all"
                    >
                      Remarcar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCirculo(null);
                        onDesenhar(false);
                      }}
                      title="Tirar o círculo do mapa"
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center cursor-pointer transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/*
                    O raio arrastado à mão quase nunca é redondo: 137 m, 418 m.
                    Os tamanhos de bolso ficam do lado para arredondar num
                    toque, e o que está valendo aparece aceso mesmo sendo um
                    número torto.
                  */}
                  <div className="mt-1.5 flex items-center gap-1">
                    {RAIOS.map((metros) => (
                      <button
                        key={metros}
                        type="button"
                        onClick={() => mudarRaio(metros)}
                        className={`flex-1 h-7 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${
                          Math.round(circulo.raio) === metros
                            ? 'bg-[#015FC9] text-white'
                            : 'bg-white border border-slate-200 text-slate-500 hover:border-[#015FC9]/40 hover:text-[#015FC9]'
                        }`}
                      >
                        {raioCurto(metros)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={(!termo.trim() && !(modo === 'raio' && !circulo)) || buscando}
              className="flex-1 h-8 bg-[#015FC9] hover:bg-[#0150ab] text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {modo === 'raio' && !circulo ? 'Marcar o raio' : 'Pesquisar'}
            </button>
          </div>

          {/*
            ATALHOS — a varredura sem teclado.

            Com um círculo marcado, a pergunta quase nunca é "onde fica a
            Farmácia Tal": é "o que existe aqui dentro". Cada atalho é uma
            varredura de um toque, e é assim que se lê um quarteirão em dez
            segundos.
          */}
          {modo === 'raio' && circulo && (
            <div
              /*
                Antes da primeira varredura os atalhos são o convite, e ficam
                todos à vista. Depois, quem manda na tela é a lista: eles
                encolhem numa fila que corre de lado, ainda a um toque de
                trocar de categoria.
              */
              className={
                varreu
                  ? 'mt-2 flex gap-1 overflow-x-auto rolagem-invisivel'
                  : 'mt-2 flex flex-wrap gap-1'
              }
            >
              {ATALHOS.map((atalho) => (
                <button
                  key={atalho}
                  type="button"
                  onClick={() => {
                    setTermo(atalho);
                    varrer(atalho, circulo);
                  }}
                  className={`h-7 px-2 shrink-0 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all ${
                    termoBuscadoRef.current.toLowerCase() === atalho.toLowerCase()
                      ? 'bg-[#EFF4FB] border-[#015FC9]/40 text-[#015FC9]'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-[#015FC9]/40 hover:text-[#015FC9]'
                  }`}
                >
                  {atalho}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* RESULTADOS */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
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

        {/*
          VAZIO COM RAIO NÃO É "NADA ENCONTRADO".

          Se a varredura trouxe gente e o círculo recusou todo mundo, o
          problema não é a pesquisa: é o tamanho do círculo. Dizer "nada
          encontrado" mandaria a pessoa procurar outra palavra quando o que
          falta é meia quadra de raio.
        */}
        {!erro && (noRaio ? varreu : pesquisou) && mostrados.length === 0 && (
          noRaio && maisPertoDeFora !== null ? (
            <div className="py-8 px-3 text-center">
              <p className="text-[12px] font-bold text-slate-500 leading-snug">
                Nenhum dentro de {circulo && raioCurto(circulo.raio)} — mas o
                mais perto está a {distanciaCurta(maisPertoDeFora)} do centro.
              </p>
              <button
                type="button"
                onClick={() => mudarRaio(raioQueAlcanca(maisPertoDeFora))}
                className="mt-2.5 h-8 px-3 rounded-lg bg-[#015FC9] hover:bg-[#0150ab] text-white text-[11px] font-black cursor-pointer inline-flex items-center gap-1.5 active:scale-[0.99] transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Ampliar para {raioCurto(raioQueAlcanca(maisPertoDeFora))}
              </button>
            </div>
          ) : (
            <p className="py-10 text-center text-[10.5px] font-bold uppercase tracking-widest text-slate-300">
              Nada encontrado para esta pesquisa
            </p>
          )
        )}

        {!(noRaio ? varreu : pesquisou) && !erro && (
          <p className="py-10 px-4 text-center text-[11.5px] font-semibold text-slate-400 leading-snug">
            {modo === 'raio' ? (
              circulo ? (
                <>
                  Toque num atalho aí em cima, ou escreva o que procura: a
                  pesquisa devolve só o que estiver dentro do círculo, do mais
                  perto para o mais longe.
                </>
              ) : (
                <>
                  Marque um círculo no mapa e a pesquisa passa a valer só ali
                  dentro — com a distância e o tempo a pé de cada lugar até o
                  centro que você marcou.
                </>
              )
            ) : (
              <>
                Escreva o que procura e a pesquisa devolve os estabelecimentos
                da região, com endereço, telefone e avaliação.
              </>
            )}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {mostrados.map((lugar) => {
            const ativo = emFoco === lugar.id;
            const distancia = (lugar as EstabelecimentoNoRaio).distancia;
            return (
              <button
                key={lugar.id}
                type="button"
                onClick={() => onEscolher(lugar)}
                onMouseEnter={() => onDestacar?.(lugar.id)}
                onMouseLeave={() => onDestacar?.(null)}
                onFocus={() => onDestacar?.(lugar.id)}
                onBlur={() => onDestacar?.(null)}
                className={`w-full text-left p-2 rounded-xl border cursor-pointer transition-all flex gap-2.5 ${
                  ativo
                    ? 'bg-[#EFF4FB] border-[#015FC9]/40'
                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                }`}
              >
                <span className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {lugar.imagem ? (
                    <img
                      src={lugar.imagem}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-4 h-4 text-slate-300" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-black text-slate-800 truncate leading-tight">
                    {lugar.nome}
                  </span>

                  {/*
                    A distância vem antes da categoria e da nota: numa lista
                    ordenada por proximidade, ela é o que diz em que ordem
                    andar. O tempo a pé vem junto porque é o número que decide
                    se vale o trajeto.
                  */}
                  {distancia !== undefined && (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md bg-[#EFF4FB] text-[10.5px] font-black text-[#015FC9]">
                      <Footprints className="w-3 h-3" />
                      {distanciaCurta(distancia)} · {tempoAPeCurto(distancia)}
                    </span>
                  )}

                  <span className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {lugar.categoria && (
                      <span className="text-[10.5px] font-bold text-[#015FC9] truncate max-w-[130px]">
                        {lugar.categoria}
                      </span>
                    )}
                    {lugar.avaliacao !== null && (
                      <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-amber-600">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {lugar.avaliacao.toFixed(1)}
                        {lugar.totalAvaliacoes !== null && (
                          <span className="text-slate-400 font-semibold">
                            ({lugar.totalAvaliacoes})
                          </span>
                        )}
                      </span>
                    )}
                    {lugar.faixaDePreco && (
                      <span className="text-[10.5px] font-bold text-slate-400">
                        {lugar.faixaDePreco}
                      </span>
                    )}
                  </span>

                  {lugar.endereco && (
                    <span className="flex items-start gap-1 text-[10.5px] text-slate-400 font-semibold mt-1 leading-snug">
                      <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{lugar.endereco}</span>
                    </span>
                  )}

                  <span className="flex items-center gap-2.5 mt-1 flex-wrap">
                    {lugar.situacao && (
                      <span
                        className={`text-[10px] font-black ${
                          /aberto/i.test(lugar.situacao)
                            ? 'text-emerald-600'
                            : 'text-rose-500'
                        }`}
                      >
                        {lugar.situacao}
                      </span>
                    )}
                    {lugar.telefone && (
                      <span
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500"
                      >
                        <Phone className="w-3 h-3" />
                        {lugar.telefone}
                      </span>
                    )}
                    {lugar.site && (
                      <a
                        href={lugar.site}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#015FC9] hover:underline"
                      >
                        <Globe className="w-3 h-3" />
                        Site
                      </a>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/*
          O QUE FICOU DE FORA, E O RAIO QUE O ALCANÇARIA.

          Um resultado a cinco metros da borda é o caso mais comum e o mais
          irritante: a farmácia da esquina não aparece porque o círculo parou
          um passo antes dela. Em vez de esconder isso, a lista conta quantos
          ficaram de fora, diz a que distância está o mais próximo e oferece o
          raio redondo que o traria para dentro — um toque, sem redesenhar
          nada.
        */}
        {noRaio && foraDoRaio.length > 0 && mostrados.length > 0 && maisPertoDeFora !== null && (
          <div className="mt-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <p className="text-[11px] font-bold text-slate-500 leading-snug">
              {foraDoRaio.length === 1
                ? 'Mais 1 lugar ficou fora do círculo'
                : `Mais ${foraDoRaio.length} lugares ficaram fora do círculo`}
              , o mais perto a {distanciaCurta(maisPertoDeFora)}.
            </p>
            <button
              type="button"
              onClick={() => mudarRaio(raioQueAlcanca(maisPertoDeFora))}
              className="mt-1.5 h-7 px-2.5 rounded-lg bg-white border border-[#015FC9]/30 text-[#015FC9] text-[10.5px] font-black cursor-pointer inline-flex items-center gap-1.5 hover:bg-[#EFF4FB] transition-all"
            >
              <Maximize2 className="w-3 h-3" />
              Ampliar para {raioCurto(raioQueAlcanca(maisPertoDeFora))}
            </button>
          </div>
        )}

        {/* A fonte ainda tinha páginas: o número pode não ser o total. */}
        {noRaio && truncado && mostrados.length > 0 && (
          <p className="mt-2 text-[10px] font-bold text-slate-400 leading-snug text-center">
            A fonte tinha mais resultados para este termo. Um raio menor, ou um
            termo mais específico, fecha a conta.
          </p>
        )}

        {/*
          O que a fonte mandou de outra cidade some da lista, mas não da
          conta: dizer quantos eram é o que separa "filtrei" de "engoli".
        */}
        {!noRaio && pesquisou && deFora > 0 && (
          <p className="mt-2 text-[10.5px] font-bold text-slate-400 leading-snug text-center">
            {deFora === 1
              ? '1 resultado de fora'
              : `${deFora} resultados de fora`}{' '}
            de {municipio} {deFora === 1 ? 'foi descartado' : 'foram descartados'}.
          </p>
        )}

        {/* A próxima página é a que a resposta indicou, não uma conta nossa. */}
        {!noRaio && proximoInicio !== null && lugares.length > 0 && (
          <button
            type="button"
            onClick={() => buscar(true)}
            disabled={buscandoMais}
            className="mt-2.5 w-full h-9 bg-white border border-slate-200 hover:border-[#015FC9] hover:text-[#015FC9] text-slate-600 text-[11px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {buscandoMais ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Buscando...
              </>
            ) : (
              'Carregar mais'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
