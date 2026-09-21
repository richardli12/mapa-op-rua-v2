import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
 */
export default function FichaDoRecorteNoMapa({
  recorte,
  uf
}: {
  recorte: RecorteNoMapa | null;
  uf: string | null;
}) {
  const [censo, setCenso] = useState<IndicadoresDoRecorte | null>(null);
  const [carregando, setCarregando] = useState(false);
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

  return (
    <div className="absolute top-[4.75rem] left-4 z-[1150] w-[340px] max-h-[calc(100%-6.5rem)] overflow-y-auto bg-[#0D233A]/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/10 px-4 py-3 font-sans pointer-events-none">
      <p className="text-[13px] font-black text-white leading-tight">
        {recorte.nome}
      </p>
      <p className="text-[11px] font-bold text-[#4E9BE8] mt-0.5">
        {numero(d?.populacao ?? recorte.valor)} habitantes
      </p>

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

      {censo?.status === 'ok' &&
        censo.grupos.map((grupo) => {
          /*
           * O grupo de visão geral repete população, domicílios e alfabetização
           * — que já estão no bloco de cima, tirados do próprio desenho. Duas
           * vezes o mesmo número em telas de distância é o que faz a pessoa
           * conferir se são mesmo iguais.
           */
          if (/vis[aã]o.?geral|resumo/i.test(`${grupo.id} ${grupo.titulo}`)) {
            return null;
          }
          const lista = grupo.principais.filter((i) => i.valor !== null);
          if (lista.length === 0) return null;
          return (
            <React.Fragment key={grupo.id}>
              <Titulo texto={grupo.titulo} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {lista.map((indicador) => (
                  <Linha
                    key={indicador.id}
                    rotulo={indicador.rotulo}
                    valor={comUnidade(indicador.valor, indicador.unidade)}
                  />
                ))}
              </div>
            </React.Fragment>
          );
        })}

      {censo?.status === 'sem_indicadores' && (
        <p className="text-[10px] font-semibold text-slate-400 mt-2 leading-snug">
          Esta UF ainda não teve os indicadores do Censo carregados.
        </p>
      )}

      {d?.imputados !== null && d?.imputados !== undefined && d.imputados > 0 && (
        <p className="text-[9.5px] font-bold text-amber-400/90 mt-2">
          {d.imputados.toFixed(1)}% estimado pelo instituto
        </p>
      )}

      <div className="h-px bg-white/10 mt-2.5 mb-1.5" />
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        Clique para ver detalhes
      </p>
    </div>
  );
}
