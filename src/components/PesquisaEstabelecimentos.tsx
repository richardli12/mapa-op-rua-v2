import { useRef, useState } from 'react';
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
  Crosshair
} from 'lucide-react';
import {
  pesquisarEstabelecimentos,
  Estabelecimento,
  ErroDaPesquisa
} from '../services/estabelecimentos';

interface PesquisaEstabelecimentosProps {
  aberto: boolean;
  onFechar: () => void;
  /** Centro do mapa agora, usado como área da busca. */
  centroDoMapa: () => { lat: number; lng: number; zoom: number } | null;
  /** Resultados desenhados no mapa. */
  onResultados: (lugares: Estabelecimento[]) => void;
  /** Levar o mapa até um resultado escolhido na lista. */
  onEscolher: (lugar: Estabelecimento) => void;
  /** Id do que está em foco, para a lista acompanhar o mapa. */
  emFoco?: string | null;
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
  onResultados,
  onEscolher,
  emFoco
}: PesquisaEstabelecimentosProps) {
  const [termo, setTermo] = useState('');
  const [usarArea, setUsarArea] = useState(true);
  const [lugares, setLugares] = useState<Estabelecimento[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscandoMais, setBuscandoMais] = useState(false);
  const [erro, setErro] = useState<ErroDaPesquisa | null>(null);
  const [proximoInicio, setProximoInicio] = useState<number | null>(null);
  const [pesquisou, setPesquisou] = useState(false);
  /** Termo da busca em tela, para a paginação repetir exatamente ele. */
  const termoBuscadoRef = useRef('');

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
        termo: texto,
        centro: usarArea ? centroDoMapa() : null,
        inicio: continuando ? proximoInicio || 0 : 0
      });

      const juntos = continuando
        ? [...lugares, ...pagina.estabelecimentos]
        : pagina.estabelecimentos;

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

  const limpar = () => {
    setTermo('');
    setLugares([]);
    setErro(null);
    setProximoInicio(null);
    setPesquisou(false);
    termoBuscadoRef.current = '';
    onResultados([]);
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
              {pesquisou && !erro
                ? `${lugares.length} ${lugares.length === 1 ? 'resultado' : 'resultados'} no mapa`
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
            buscar(false);
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

          <div className="mt-2 flex items-center gap-2">
            {/* A área do mapa é o recorte natural de quem está olhando o mapa. */}
            <button
              type="button"
              onClick={() => setUsarArea((v) => !v)}
              className={`h-8 px-2.5 rounded-lg border text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                usarArea
                  ? 'bg-[#EFF4FB] border-[#015FC9]/30 text-[#015FC9]'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
              title={
                usarArea
                  ? 'Buscando na área que o mapa mostra'
                  : 'Buscando pelo texto, sem usar a área do mapa'
              }
            >
              <Crosshair className="w-3.5 h-3.5" />
              Nesta área
            </button>

            <button
              type="submit"
              disabled={!termo.trim() || buscando}
              className="flex-1 h-8 bg-[#015FC9] hover:bg-[#0150ab] text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            >
              Pesquisar
            </button>
          </div>
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

        {!erro && pesquisou && lugares.length === 0 && (
          <p className="py-10 text-center text-[10.5px] font-bold uppercase tracking-widest text-slate-300">
            Nada encontrado para esta pesquisa
          </p>
        )}

        {!pesquisou && !erro && (
          <p className="py-10 px-4 text-center text-[11.5px] font-semibold text-slate-400 leading-snug">
            Escreva o que procura e a pesquisa devolve os estabelecimentos da
            região, com endereço, telefone e avaliação.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {lugares.map((lugar) => {
            const ativo = emFoco === lugar.id;
            return (
              <button
                key={lugar.id}
                type="button"
                onClick={() => onEscolher(lugar)}
                className={`w-full text-left p-2 rounded-xl border cursor-pointer transition-all flex gap-2.5 ${
                  ativo
                    ? 'bg-[#EFF4FB] border-[#015FC9]/40'
                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                }`}
              >
                <span className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
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

        {/* A próxima página é a que a resposta indicou, não uma conta nossa. */}
        {proximoInicio !== null && lugares.length > 0 && (
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
