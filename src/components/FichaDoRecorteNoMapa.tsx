import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, MousePointerClick, Pin, X } from 'lucide-react';
import { lerIndicadores, IndicadoresDoRecorte } from '../services/territorio';

/** Recorte desenhado no mapa, do jeito que o painel territorial o entrega. */
export interface RecorteNoMapa {
  id: string;
  nome: string;
  valor: number | null;
  resumo: string;
  tipo: 'bairro' | 'setor';
  dados?: {
    populacao: number | null;
    domicilios: number | null;
    areaKm2: number | null;
    densidade: number | null;
    mediaMoradores: number | null;
    imputados: number | null;
  };
}

const numero = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? '—'
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

/** Valor com a unidade que veio da fonte, sem inventar arredondamento. */
const comUnidade = (valor: number | null, unidade: string) => {
  if (valor === null || valor === undefined) return '—';
  const casas = unidade === '%' || Math.abs(valor) < 10 ? 1 : 0;
  const texto = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: unidade === '%' ? 1 : 0,
    maximumFractionDigits: casas
  });
  if (!unidade) return texto;
  if (unidade === '%') return `${texto}%`;
  return `${texto} ${unidade}`;
};

/**
 * Uma dupla rótulo/valor da grade.
 *
 * O rótulo fica EM CIMA do número, não ao lado. Lado a lado, "Índice de
 * envelhecimento" e "Cor ou raça parda" viravam "Índice de en..." e "Cor ou
 * raça par...", e um rótulo cortado não informa nada — é ruído ocupando a
 * linha. Empilhado, o nome cabe inteiro em duas linhas e o número continua
 * sendo a primeira coisa que o olho acha.
 */
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[9.5px] font-semibold text-slate-400 leading-[1.25] hyphens-auto break-words">
        {rotulo}
      </span>
      <span className="block text-[12px] font-black text-white leading-tight mt-px tabular-nums">
        {valor}
      </span>
    </div>
  );
}

function Titulo({ texto }: { texto: string }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 mt-2.5 mb-1">
      {texto}
    </p>
  );
}

/**
 * A ficha do setor sob o cursor.
 *
 * Abaixo da barra de cima, não ao lado dela: a busca e as gavetas de filtro
 * moram no topo, e uma ficha que aparece por cima delas tapa o controle que a
 * pessoa está prestes a usar.
 *
 * O balão que segue o mouse cabia num nome e em dois números; o Censo do setor
 * são quinze. Por isso a ficha tem lugar fixo — canto superior esquerdo do
 * mapa — e o cursor só escolhe de quem ela fala: passar por cima de um setor
 * troca o conteúdo sem mover a caixa, e a leitura não vira perseguição.
 *
 * Os números crus (população, domicílios, densidade) já vêm com o desenho e
 * aparecem no mesmo quadro em que o cursor entra. O resto — demografia,
 * educação, infraestrutura — é uma consulta ao Censo, e por isso:
 *
 * - espera um instante antes de disparar, senão varrer o mapa abriria uma
 *   consulta por setor atravessado;
 * - fica guardado por código, porque voltar a um setor já visto é o gesto mais
 *   comum de quem está comparando dois vizinhos.
 *
 * FIXAR, E LER POR CAMADAS.
 *
 * Seguir o cursor serve para varrer; para ler, o setor precisa parar quieto.
 * O clique fixa: a ficha passa a falar só dele, o mapa o marca em âmbar, e o
 * mouse fica livre para passear pelos vizinhos sem trocar o que está escrito.
 *
 * E a ficha abre curta — nome, população e os quatro números do setor, que
 * respondem "quanta gente e como ela mora" num relance. Os quinze indicadores
 * do Censo ficam atrás de um botão que diz quantos são: a caixa inteira
 * aberta de saída tapava um terço do mapa para responder uma pergunta que
 * ninguém tinha feito ainda.
 */
export default function FichaDoRecorteNoMapa({
  recorte,
  uf,
  fixado = false,
  onSoltar
}: {
  recorte: RecorteNoMapa | null;
  uf: string | null;
  /** O recorte veio do clique, e não do cursor: a ficha fica e responde. */
  fixado?: boolean;
  /** Tira o recorte da ficha e do destaque no mapa. */
  onSoltar?: () => void;
}) {
  const [censo, setCenso] = useState<IndicadoresDoRecorte | null>(null);
  const [carregando, setCarregando] = useState(false);
  /**
   * O restante aberto ou fechado.
   *
   * Sobrevive à troca de setor: quem abriu o Censo de um e clica no vizinho
   * está comparando, e fechar a cada clique seria cobrar o mesmo botão de
   * novo para cada setor.
   */
  const [expandida, setExpandida] = useState(false);
  const cache = useRef<{ [chave: string]: IndicadoresDoRecorte }>({});

  const chave = recorte ? `${uf}:${recorte.tipo}:${recorte.id}` : null;

  useEffect(() => {
    if (!chave || !recorte || !uf) {
      setCenso(null);
      setCarregando(false);
      return;
    }

    const guardado = cache.current[chave];
    if (guardado) {
      setCenso(guardado);
      setCarregando(false);
      return;
    }

    setCenso(null);
    setCarregando(true);
    let vivo = true;
    const espera = setTimeout(async () => {
      try {
        const dados = await lerIndicadores(uf, recorte.tipo, recorte.id);
        cache.current[chave] = dados;
        if (vivo) setCenso(dados);
      } catch {
        // Ficha sem o Censo ainda mostra os números crus: falhar aqui não
        // pode apagar o que já está na tela.
      } finally {
        if (vivo) setCarregando(false);
      }
    }, 220);

    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [chave, uf]);

  if (!recorte) return null;

  const d = recorte.dados;

  /*
   * O que fica atrás do botão.
   *
   * O grupo de visão geral repete população, domicílios e alfabetização —
   * que já estão no bloco de cima, tirados do próprio desenho. Duas vezes o
   * mesmo número em telas de distância é o que faz a pessoa conferir se são
   * mesmo iguais.
   */
  const grupos =
    censo?.status === 'ok'
      ? censo.grupos
          .filter((grupo) => !/vis[aã]o.?geral|resumo/i.test(`${grupo.id} ${grupo.titulo}`))
          .map((grupo) => ({
            ...grupo,
            lista: grupo.principais.filter((i) => i.valor !== null)
          }))
          .filter((grupo) => grupo.lista.length > 0)
      : [];
  const totalRestante = grupos.reduce((soma, g) => soma + g.lista.length, 0);
  const temImputados =
    d?.imputados !== null && d?.imputados !== undefined && d.imputados > 0;
  const semIndicadores = censo?.status === 'sem_indicadores';
  const temRestante = totalRestante > 0 || semIndicadores || temImputados;
  const aberta = fixado && expandida && temRestante;

  return (
    <div
      key={fixado ? `fixo-${recorte.id}` : 'cursor'}
      className={`absolute top-[4.75rem] left-4 z-[1150] w-[340px] max-h-[calc(100%-6.5rem)] overflow-y-auto overscroll-contain bg-[#0D233A]/95 backdrop-blur-sm rounded-2xl shadow-2xl border font-sans ${
        fixado
          ? 'pointer-events-auto border-amber-400/40 ficha-recorte-entra'
          : 'pointer-events-none border-white/10'
      }`}
    >
      {/* O fio âmbar é o mesmo tom que marca o setor no mapa: liga a ficha
          ao desenho sem precisar dizer "é este aqui". */}
      {fixado && (
        <div className="sticky top-0 z-10 h-[3px] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
      )}

      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-black text-white leading-tight truncate">
                {recorte.nome}
              </p>
              {fixado && (
                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-amber-400/15 text-amber-300 text-[8.5px] font-black uppercase tracking-[0.12em] leading-none">
                  <Pin className="w-2.5 h-2.5 fill-current" />
                  Fixado
                </span>
              )}
            </div>
            <p className="text-[11px] font-bold text-[#4E9BE8] mt-0.5">
              {numero(d?.populacao ?? recorte.valor)} habitantes
            </p>
          </div>
          {fixado && onSoltar && (
            <button
              type="button"
              onClick={onSoltar}
              className="shrink-0 -mr-1.5 -mt-0.5 w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title={recorte.tipo === 'setor' ? 'Soltar este setor' : 'Soltar este bairro'}
              aria-label={`Soltar ${recorte.nome}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="h-px bg-white/10 my-2.5" />

        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
            {censo?.fonte?.censo || 'Censo 2022'}
          </p>
          {carregando && (
            <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
          )}
        </div>

        {d && (
          <>
            <Titulo texto={recorte.tipo === 'setor' ? 'Setor' : 'Bairro'} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Linha rotulo="População" valor={numero(d.populacao)} />
              <Linha rotulo="Domicílios" valor={numero(d.domicilios)} />
              <Linha
                rotulo="Densidade"
                valor={
                  d.densidade === null ? '—' : `${numero(d.densidade)} hab/km²`
                }
              />
              {d.mediaMoradores !== null && (
                <Linha
                  rotulo="Moradores/dom."
                  valor={comUnidade(d.mediaMoradores, '')}
                />
              )}
            </div>
          </>
        )}

        {/*
          O RESTANTE DO CENSO.

          Abre e fecha deslizando, sem pular: a caixa cresce de onde o botão
          está, e o olho não perde o lugar em que estava lendo.
        */}
        {fixado && (
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              aberta ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
            aria-hidden={!aberta}
          >
            <div className="overflow-hidden min-h-0">
              {grupos.map((grupo) => (
                <React.Fragment key={grupo.id}>
                  <Titulo texto={grupo.titulo} />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {grupo.lista.map((indicador) => (
                      <React.Fragment key={indicador.id}>
                        <Linha
                          rotulo={indicador.rotulo}
                          valor={comUnidade(indicador.valor, indicador.unidade)}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                </React.Fragment>
              ))}

              {semIndicadores && (
                <p className="text-[10px] font-semibold text-slate-400 mt-2.5 leading-snug">
                  Esta UF ainda não teve os indicadores do Censo carregados.
                </p>
              )}

              {temImputados && (
                <p className="text-[9.5px] font-bold text-amber-400/90 mt-2.5">
                  {d!.imputados!.toFixed(1)}% estimado pelo instituto
                </p>
              )}
            </div>
          </div>
        )}

        <div className="h-px bg-white/10 mt-3 mb-2" />

        {fixado ? (
          carregando && !censo ? (
            <p className="h-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Buscando o Censo {recorte.tipo === 'setor' ? 'do setor' : 'do bairro'}...
            </p>
          ) : temRestante ? (
            <button
              type="button"
              onClick={() => setExpandida((v) => !v)}
              aria-expanded={aberta}
              className="group w-full h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-amber-400/40 text-white text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
            >
              {aberta ? 'Mostrar menos' : 'Ver o restante do Censo'}
              {!aberta && totalRestante > 0 && (
                <span className="px-1.5 py-px rounded-md bg-amber-400/20 text-amber-300 text-[9.5px] tabular-nums">
                  +{totalRestante}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 transition-transform duration-300 ${
                  aberta ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : (
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Clique de novo no mapa para soltar
            </p>
          )
        ) : (
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            <MousePointerClick className="w-3 h-3" />
            Clique para fixar e ver o Censo completo
          </p>
        )}
      </div>
    </div>
  );
}
