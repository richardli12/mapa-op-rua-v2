import { useEffect, useState } from 'react';
import {
  X,
  Layers3,
  Users,
  Home,
  Loader2,
  AlertCircle,
  Target,
  Search,
  Info,
  ChevronRight,
  Maximize2,
  Minimize2,
  Map as MapIcon
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

interface InteligenciaTerritorialProps {
  aberto: boolean;
  onFechar: () => void;
  /** UF e município do cliente em foco, para abrir já no lugar certo. */
  ufDoCliente?: string | null;
  cidadeDoCliente?: string | null;
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
 * pergunta que vem antes de decidir para onde ir: quanta gente mora aqui.
 *
 * São três perguntas, e cada uma é uma aba:
 *
 * - **Raio** — quantas pessoas moram dentro do círculo que estou olhando.
 *   É a única que aceita área desenhada, e por isso a resposta vem em dois
 *   números: a estimativa e o piso exato.
 * - **Bairros** — a lista do município com população, domicílios e
 *   densidade, ordenável. É onde se decide qual bairro merece equipe.
 * - **Censo** — os indicadores oficiais do recorte escolhido.
 *
 * Três regras do manual do CCO aparecem na tela, e não só no código, porque
 * são elas que separam número confiável de número bonito: estimativa se
 * chama estimativa, soma parcial é avisada, e `null` nunca é mostrado como
 * zero.
 */
export default function InteligenciaTerritorial({
  aberto,
  onFechar,
  ufDoCliente,
  cidadeDoCliente,
  centroDoMapa,
  onCirculoAnalisado,
  onRecortes,
  recorteEmFoco,
  onRecorteEmFoco
}: InteligenciaTerritorialProps) {
  const [aba, setAba] = useState<Aba>('raio');
  /**
   * Meia tela ou tela cheia.
   *
   * O mesmo par do Mapa Mental, de propósito: são os dois painéis grandes do
   * mapa, e aprender dois comportamentos para a mesma pergunta — "quero mais
   * espaço" — seria trabalho de quem usa, não do sistema.
   */
  const [telaCheia, setTelaCheia] = useState(false);
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
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);

  /* ---------------------------------------------------------- desenho --- */
  const [desenharNoMapa, setDesenharNoMapa] = useState(true);
  const [metrica, setMetrica] = useState<'populacao' | 'densidade' | 'domicilios'>(
    'populacao'
  );
  const [carregandoDesenho, setCarregandoDesenho] = useState(false);
  /** Bairro cujos setores estão abertos: o recorte mais fino, um por vez. */
  const [bairroDosSetores, setBairroDosSetores] = useState<BairroDoTerritorio | null>(
    null
  );
  const [setores, setSetores] = useState<SetorDoTerritorio[]>([]);

  /* ------------------------------------------------------------- raio --- */
  const [raio, setRaio] = useState(1000);
  const [analise, setAnalise] = useState<AnaliseDeArea | null>(null);
  const [analisando, setAnalisando] = useState(false);

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
    if (!aberto || ufsComTerritorio.length > 0) return;
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
  }, [aberto, ufsComTerritorio.length]);

  // Achar o município do cliente pelo nome, uma vez que a UF esteja escolhida.
  useEffect(() => {
    if (!aberto || !uf || municipios.length > 0) return;
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
  }, [aberto, uf, ufsComTerritorio, cidadeDoCliente]);

  const escolherMunicipio = async (alvo: MunicipioDoTerritorio) => {
    setErro(null);
    setMunicipio(alvo);
    setBairros([]);
    setRecorte({ nivel: 'municipio', codigo: alvo.codigo, nome: alvo.nome });
    setCenso(null);
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
      // Setores abertos pertenciam ao desenho anterior; trocar de município
      // ou recarregar a lista os invalida.
      setBairroDosSetores(null);
      setSetores([]);
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
  const abrirSetores = async (bairro: BairroDoTerritorio) => {
    if (!municipio) return;
    if (bairroDosSetores?.codigo === bairro.codigo) {
      setBairroDosSetores(null);
      setSetores([]);
      return;
    }
    setCarregandoDesenho(true);
    setErro(null);
    setAba('setores');
    try {
      const lista = await todasAsPaginas<SetorDoTerritorio>(
        (inicio) => lerSetores(uf, municipio.codigo, bairro.codigo, inicio, true),
        'setores',
      );
      setBairroDosSetores(bairro);
      setSetores(lista);
    } catch (falha: any) {
      setErro(falha);
    } finally {
      setCarregandoDesenho(false);
    }
  };

  const carregarCenso = async (nivel: string, codigo: string, nome: string) => {
    setAba('censo');
    setRecorte({ nivel, codigo, nome });
    setCenso(null);
    setErro(null);
    setCarregandoCenso(true);
    try {
      const dados = await lerIndicadores(uf, nivel, codigo);
      setCenso(dados);
      setGrupoAberto(dados.grupos?.[0]?.id || null);
    } catch (falha: any) {
      setErro(falha);
    } finally {
      setCarregandoCenso(false);
    }
  };

  const analisar = async () => {
    const vista = centroDoMapa();
    if (!vista || !uf || analisando) return;
    setAnalisando(true);
    setErro(null);
    setAnalise(null);
    try {
      const dados = await analisarRaio(uf, vista.lat, vista.lng, raio);
      setAnalise(dados.analise);
      onCirculoAnalisado({ lat: vista.lat, lng: vista.lng, raio });
    } catch (falha: any) {
      setErro(falha);
      onCirculoAnalisado(null);
    } finally {
      setAnalisando(false);
    }
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
    if (!aberto || !desenharNoMapa) {
      onRecortes([], []);
      return;
    }

    const doSetor = bairroDosSetores && setores.length > 0;
    const fonte: { id: string; nome: string; geometria: any; valor: number | null; resumo: string; tipo: 'bairro' | 'setor' }[] =
      doSetor
        ? setores.map((setor) => {
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
              tipo: 'setor' as const
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
              tipo: 'bairro' as const
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

    onRecortes(comGeometria, escala);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, desenharNoMapa, metrica, bairros, setores, bairroDosSetores]);

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

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'raio', rotulo: 'Raio' },
    { id: 'bairros', rotulo: 'Bairros' },
    { id: 'setores', rotulo: 'Setores' },
    { id: 'censo', rotulo: 'Censo' }
  ];

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
     * Agora ela entra no fluxo da página, como o Mapa Mental: metade da tela
     * para ela, metade para o mapa, os dois visíveis ao mesmo tempo. Empurrar
     * o mapa em vez de cobri-lo é o que deixa clicar num bairro da lista e
     * ver onde ele fica, sem fechar nada.
     */
    <div
      className={
        telaCheia
          ? 'fixed inset-0 z-[3200] bg-white flex flex-col font-sans animate-in fade-in duration-150'
          : 'order-3 h-full w-1/2 min-w-[380px] shrink-0 z-[1002] bg-white border-l border-slate-200 shadow-2xl flex flex-col font-sans animate-in fade-in slide-in-from-right-4 duration-200'
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

        {/* UF e município */}
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
              if (alvo) escolherMunicipio(alvo);
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

        {/* A cobertura é estado do sistema, e a tela diz qual é. */}
        {carregandoCobertura && (
          <p className="mt-2 text-[10.5px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verificando o que o CCO tem carregado...
          </p>
        )}
        {semMalha && (
          <p className="mt-2 text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-snug">
            {uf} ainda não tem o território carregado no CCO. Com malha:{' '}
            {ufsComTerritorio.join(', ') || '—'}.
          </p>
        )}
        {!semMalha && semIndicadores && (
          <p className="mt-2 text-[10.5px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug">
            {uf} tem o território, mas ainda não os indicadores do Censo — a aba
            Censo vai vir vazia.
          </p>
        )}

        {!uf && !carregandoCobertura && ufsComTerritorio.length > 1 && (
          <p className="mt-2 text-[10.5px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug">
            Não deu para descobrir a UF deste cliente pelo cadastro. Escolha
            acima qual território consultar.
          </p>
        )}

        {/* ABAS */}
        <div className="mt-3 flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {abas.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAba(item.id);
                if (item.id === 'bairros' && bairros.length === 0) carregarBairros();
              }}
              className={`flex-1 h-7 rounded-lg text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                aba === item.id
                  ? 'bg-white text-[#0D233A] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {item.rotulo}
            </button>
          ))}
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

        {/* ------------------------------------------------------ RAIO --- */}
        {aba === 'raio' && (
          <div>
            <p className="text-[11.5px] font-semibold text-slate-500 leading-snug">
              Quantas pessoas moram em volta do centro do mapa. Mova o mapa até
              o ponto, escolha o raio e analise.
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {RAIOS.map((metros) => (
                <button
                  key={metros}
                  type="button"
                  onClick={() => setRaio(metros)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                    raio === metros
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {metros >= 1000 ? `${metros / 1000} km` : `${metros} m`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={analisar}
              disabled={!uf || analisando || !!semMalha}
              className="mt-3 w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analisando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Analisar esta área
                </>
              )}
            </button>

            {analise && (
              <div className="mt-4 space-y-3">
                {/* foraDaCobertura separa "não toca dado" de "zero gente". */}
                {analise.foraDaCobertura ? (
                  <p className="text-[11.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-snug">
                    Esta área não toca nenhum setor com dado carregado. Não é
                    "zero habitantes" — é ausência de dado aqui.
                  </p>
                ) : (
                  <>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">
                        Estimativa
                      </p>
                      <div className="flex items-end gap-4 mt-1">
                        <div>
                          <p className="text-[22px] font-black text-[#0D233A] leading-none">
                            {numero(analise.estimativa.populacao)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                            <Users className="w-3 h-3" /> moradores
                          </p>
                        </div>
                        <div>
                          <p className="text-[16px] font-black text-[#0D233A] leading-none">
                            {numero(analise.estimativa.domicilios)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                            <Home className="w-3 h-3" /> domicílios
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] font-semibold text-emerald-800/70 mt-2 leading-snug">
                        Setores parciais entram pela fração de área. É
                        aproximação, não contagem.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-3">
                      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
                        Piso exato
                      </p>
                      <div className="flex items-end gap-4 mt-1">
                        <p className="text-[18px] font-black text-[#0D233A] leading-none">
                          {numero(analise.exato.populacao)}
                        </p>
                        <p className="text-[13px] font-black text-slate-600 leading-none">
                          {numero(analise.exato.domicilios)} dom.
                        </p>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1.5 leading-snug">
                        Só os setores inteiramente dentro do círculo. Isto é
                        contagem: use quando a decisão não aceita aproximação.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { r: 'Setores', v: analise.setores.tocados },
                        { r: 'Inteiros', v: analise.setores.inteiros },
                        { r: 'Parciais', v: analise.setores.parciais }
                      ].map((item) => (
                        <div
                          key={item.r}
                          className="rounded-xl border border-slate-100 py-2"
                        >
                          <p className="text-[15px] font-black text-[#0D233A] leading-none">
                            {item.v}
                          </p>
                          <p className="text-[9.5px] font-bold text-slate-400 mt-0.5">
                            {item.r}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10.5px] font-semibold text-slate-400">
                      Área medida: {analise.areaKm2.toFixed(2)} km² ·{' '}
                      {numero(Math.round(analise.estimativa.densidade))} hab/km²
                      {analise.parcialmenteForaDaCobertura &&
                        ' · parte da área está fora da cobertura'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------- BAIRROS --- */}
        {aba === 'bairros' && (
          <div>
            {!municipio ? (
              <p className="py-8 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                Escolha o município acima
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center bg-white border border-slate-200 rounded-xl h-9 px-2.5 flex-1 focus-within:ring-2 focus-within:ring-blue-500/20">
                    <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={buscaBairro}
                      onChange={(e) => setBuscaBairro(e.target.value)}
                      placeholder="Buscar bairro..."
                      className="bg-transparent border-none w-full text-[11.5px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden"
                    />
                  </div>
                  <select
                    value={ordem}
                    onChange={(e) => setOrdem(e.target.value as any)}
                    className="h-9 px-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 cursor-pointer focus:outline-hidden"
                  >
                    <option value="populacao">População</option>
                    <option value="densidade">Densidade</option>
                    <option value="nome">Nome</option>
                  </select>
                </div>

                {/* Desenho no mapa: a mancha é o que a lista não mostra. */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const ligando = !desenharNoMapa;
                      setDesenharNoMapa(ligando);
                      // Ligar depois de carregar sem polígono exige recarregar:
                      // a geometria não vem por padrão, e não dá para inventá-la.
                      if (ligando && bairros.length > 0 && !bairros[0].geometria) {
                        carregarBairros(true);
                      }
                    }}
                    className={`h-8 px-2.5 rounded-lg border text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      desenharNoMapa
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                    title="Pintar os bairros no mapa pela métrica escolhida"
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    No mapa
                  </button>

                  <select
                    value={metrica}
                    onChange={(e) => setMetrica(e.target.value as any)}
                    disabled={!desenharNoMapa}
                    className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-600 cursor-pointer focus:outline-hidden disabled:opacity-50"
                  >
                    <option value="populacao">Pintar por população</option>
                    <option value="densidade">Pintar por densidade</option>
                    <option value="domicilios">Pintar por domicílios</option>
                  </select>

                  {carregandoDesenho && (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
                  )}
                </div>

                {bairroDosSetores && (
                  <p className="mt-2 text-[10.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 leading-snug flex items-center justify-between gap-2">
                    <span>
                      Mostrando {setores.length} setores de {bairroDosSetores.nome}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBairroDosSetores(null);
                        setSetores([]);
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:underline cursor-pointer shrink-0"
                    >
                      Voltar aos bairros
                    </button>
                  </p>
                )}

                {/* Somar bairros não dá o município, e a tela diz por quê. */}
                {municipio.setoresSemBairro !== undefined &&
                  municipio.setoresSemBairro > 0 && (
                    <p className="mt-2 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug flex items-start gap-1.5">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      {municipio.setoresSemBairro} setores de{' '}
                      {municipio.nome} ficam fora da divisão por bairros. Somar
                      a lista não dá o total do município.
                    </p>
                  )}

                {carregandoBairros ? (
                  <p className="py-8 text-center text-[11px] font-bold text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando bairros...
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-1.5">
                    {bairrosNaTela.map((bairro, posicao) => {
                      const densidade =
                        bairro.areaKm2 && bairro.populacao
                          ? Math.round(bairro.populacao / bairro.areaKm2)
                          : null;
                      return (
                        <div
                          key={bairro.codigo}
                          onMouseEnter={() => onRecorteEmFoco?.(bairro.codigo)}
                          onMouseLeave={() => onRecorteEmFoco?.(null)}
                          className={`w-full p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                            recorteEmFoco === bairro.codigo
                              ? 'border-[#015FC9]/40 bg-[#EFF4FB]'
                              : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                          }`}
                          onClick={() =>
                            carregarCenso('bairro', bairro.codigo, bairro.nome)
                          }
                        >
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-[10.5px] font-black flex items-center justify-center shrink-0">
                            {posicao + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-black text-slate-800 truncate leading-tight">
                              {bairro.nome}
                            </span>
                            <span className="block text-[10.5px] font-semibold text-slate-400 mt-0.5">
                              {numero(bairro.populacao)} hab ·{' '}
                              {numero(bairro.domicilios)} dom
                              {densidade !== null && ` · ${numero(densidade)} hab/km²`}
                            </span>
                          </span>
                          {/* Descer ao setor é outra pergunta, então é outro
                              botão: clicar no bairro abre o Censo dele. */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirSetores(bairro);
                            }}
                            title={
                              bairroDosSetores?.codigo === bairro.codigo
                                ? 'Esconder os setores deste bairro'
                                : 'Ver os setores censitários deste bairro'
                            }
                            className={`h-7 px-2 rounded-lg border text-[9.5px] font-black uppercase tracking-wider cursor-pointer transition-all shrink-0 ${
                              bairroDosSetores?.codigo === bairro.codigo
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-700'
                            }`}
                          >
                            Setores
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        </div>
                      );
                    })}
                    {bairrosNaTela.length === 0 && (
                      <p className="py-8 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                        Nenhum bairro encontrado
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* --------------------------------------------------- SETORES --- */}
        {aba === 'setores' && (
          <div>
            {!bairroDosSetores ? (
              <div className="py-6 text-center">
                <p className="text-[11.5px] font-semibold text-slate-500 leading-snug px-2">
                  O setor censitário é a unidade fundamental do Censo: algumas
                  centenas de domicílios. Tudo o mais é soma deles.
                </p>
                <p className="mt-2 text-[10.5px] font-semibold text-slate-400 leading-snug px-2">
                  Escolha um bairro na aba anterior e toque em{' '}
                  <span className="font-black text-slate-500">Setores</span>. É
                  um bairro por vez de propósito: uma cidade grande passa de
                  mil setores, e o polígono de todos eles são dezenas de
                  megabytes.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAba('bairros');
                    if (bairros.length === 0) carregarBairros();
                  }}
                  className="mt-3 h-8 px-3.5 bg-[#015FC9] hover:bg-[#0150ab] text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  Escolher um bairro
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-black text-[#0D233A] truncate">
                      {bairroDosSetores.nome}
                    </p>
                    <p className="text-[10.5px] font-semibold text-slate-400">
                      {setores.length}{' '}
                      {setores.length === 1 ? 'setor' : 'setores'} ·{' '}
                      {numero(
                        setores.reduce(
                          // null é ausência: entra fora da soma, não como zero.
                          (soma, s) => soma + (s.populacao ?? 0),
                          0,
                        ),
                      )}{' '}
                      hab somados
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBairroDosSetores(null);
                      setSetores([]);
                      setAba('bairros');
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 text-[10px] font-black uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    Trocar
                  </button>
                </div>

                {/* Setor com dado faltando na lista: avisar é melhor que somar. */}
                {setores.some((s) => s.populacao === null) && (
                  <p className="mt-2 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-snug flex items-start gap-1.5">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    {setores.filter((s) => s.populacao === null).length} setor(es)
                    sem dado divulgado. A soma acima é parcial — ausência não é
                    zero.
                  </p>
                )}

                <div className="mt-2 grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-1.5">
                  {setores.map((setor) => {
                    const densidade =
                      setor.areaKm2 && setor.populacao !== null
                        ? Math.round(setor.populacao / setor.areaKm2)
                        : null;
                    // Acima de 10%, boa parte do setor foi estimada pelo
                    // instituto: o número existe, mas é menos firme.
                    const muitoImputado =
                      setor.percentualDomiciliosImputados !== null &&
                      setor.percentualDomiciliosImputados >= 10;
                    return (
                      <div
                        key={setor.codigo}
                        onMouseEnter={() => onRecorteEmFoco?.(setor.codigo)}
                        onMouseLeave={() => onRecorteEmFoco?.(null)}
                        onClick={() =>
                          carregarCenso(
                            'setor',
                            setor.codigo,
                            `Setor ${setor.codigo.slice(-6)}`,
                          )
                        }
                        title={setor.codigo}
                        className={`w-full p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                          recorteEmFoco === setor.codigo
                            ? 'border-[#015FC9]/40 bg-[#EFF4FB]'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-black text-slate-800 truncate leading-tight font-mono">
                            …{setor.codigo.slice(-6)}
                          </span>
                          <span className="block text-[10.5px] font-semibold text-slate-400 mt-0.5">
                            {numero(setor.populacao)} hab ·{' '}
                            {numero(setor.domicilios)} dom
                            {densidade !== null &&
                              ` · ${numero(densidade)} hab/km²`}
                          </span>
                          {muitoImputado && (
                            <span className="block text-[9.5px] font-black uppercase tracking-wider text-amber-600 mt-0.5">
                              {setor.percentualDomiciliosImputados!.toFixed(1)}%
                              estimado pelo instituto
                            </span>
                          )}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ----------------------------------------------------- CENSO --- */}
        {aba === 'censo' && (
          <div>
            {!recorte ? (
              <p className="py-8 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                Escolha um município ou bairro
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-black text-[#0D233A] truncate">
                      {recorte.nome}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {recorte.nivel}
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
                    Esta UF ainda não teve os indicadores do Censo carregados no
                    CCO. Não é erro da consulta — é carga que ainda não foi
                    feita.
                  </p>
                )}

                {censo?.status === 'ok' && (
                  /*
                   * Os grupos viram colunas de alvenaria quando há largura.
                   *
                   * Empilhados, "Domicílios" ficava a três rolagens de
                   * "População" e comparar os dois virava exercício de
                   * memória. Lado a lado, a leitura é de relance — que é a
                   * única razão de existir uma tela de indicadores.
                   */
                  <div className="mt-3 @2xl:columns-2 @5xl:columns-3 gap-2 space-y-2 [&>*]:break-inside-avoid">
                    {censo.grupos.map((grupo) => {
                      const aberto2 = grupoAberto === grupo.id;
                      const lista = aberto2
                        ? [...grupo.principais, ...grupo.detalhes]
                        : grupo.principais;
                      return (
                        <div
                          key={grupo.id}
                          className="rounded-xl border border-slate-100 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setGrupoAberto(aberto2 ? null : grupo.id)}
                            className="w-full px-3 py-2 bg-slate-50/60 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100/60"
                          >
                            <span className="text-[11.5px] font-black text-[#0D233A]">
                              {grupo.titulo}
                            </span>
                            <ChevronRight
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                                aberto2 ? 'rotate-90' : ''
                              }`}
                            />
                          </button>

                          <div className="divide-y divide-slate-50">
                            {lista.map((indicador) => (
                              <div
                                key={indicador.id}
                                className="px-3 py-2 flex items-center justify-between gap-3"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[11.5px] font-bold text-slate-700 leading-tight">
                                    {indicador.rotulo}
                                  </span>
                                  <span className="flex items-center gap-1.5 mt-0.5">
                                    {/* Medido ou calculado: quem cita o número
                                        precisa saber a diferença. */}
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                                      {indicador.origem}
                                    </span>
                                    {indicador.setoresSemDado > 0 && (
                                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-600">
                                        soma parcial · {indicador.setoresSemDado}{' '}
                                        setor(es) sem dado
                                      </span>
                                    )}
                                  </span>
                                </span>

                                <span className="text-right shrink-0">
                                  {/* null é ausência, nunca zero. */}
                                  {indicador.valor === null ? (
                                    <span className="text-[10px] font-bold text-slate-300 italic">
                                      {MOTIVOS[indicador.motivoIndisponivel || ''] ||
                                        'sem dado'}
                                    </span>
                                  ) : (
                                    <>
                                      <span className="block text-[13px] font-black text-[#0D233A] leading-none">
                                        {indicador.valor.toLocaleString('pt-BR', {
                                          maximumFractionDigits: 2
                                        })}
                                      </span>
                                      <span className="block text-[9px] font-bold text-slate-400">
                                        {indicador.unidade}
                                      </span>
                                    </>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {censo.fonte && (
                      <p className="text-[9.5px] font-semibold text-slate-400 leading-snug pt-1">
                        {censo.fonte.censo} · {censo.fonte.instituto} ·{' '}
                        {censo.totalSetores} setores no recorte
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
