import React, { useMemo, useRef, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';

/**
 * Os gráficos da Inteligência Territorial.
 *
 * Um gráfico aqui não é enfeite de painel: é a resposta a uma pergunta que
 * alguém faz em voz alta antes de montar a rota do dia. Por isso são poucos, e
 * cada um responde uma coisa só.
 *
 * AS REGRAS QUE VALEM PARA TODOS, E POR QUÊ:
 *
 * - **Um eixo, sempre.** Duas escalas no mesmo desenho é o erro mais comum de
 *   gráfico, e o mais difícil de notar depois de pronto: o leitor compara duas
 *   alturas que não são comparáveis. Quando há duas medidas, ou viram dois
 *   gráficos, ou viram a mesma unidade.
 * - **Uma matiz, não um arco-íris.** Cor aqui é grandeza (mais escuro = mais),
 *   não identidade. Categoria colorida só existe quando as séries são o assunto
 *   — e nenhum destes gráficos é assim.
 * - **Ênfase em vez de categoria.** Quando a história é "estes poucos aqui", o
 *   certo é acender esses e apagar o resto em cinza. É a forma mais subusada de
 *   gráfico e quase sempre a resposta honesta para "deixa isso mais claro".
 * - **Rótulo só onde decide.** Número em cima de cada barra vira ruído e não é
 *   lido. Rotula-se o extremo e o ponto de virada; o resto fica no eixo, no
 *   passar do mouse e na tabela.
 * - **A tabela existe.** Todo gráfico tem o botão que troca por tabela. Sem
 *   isso, quem não enxerga cor bem, quem vai imprimir e quem precisa do número
 *   exato ficam de fora — e o passar do mouse não pode ser a única porta para
 *   um dado.
 *
 * As cores saíram do próprio produto e passaram pelo validador do guia de
 * visualização: separação de 17,7 (visão normal) e 12,0 (daltonismo) entre o
 * destaque e o cinza de apagar, que é folga confortável. O cinza fica abaixo de
 * 3:1 contra o branco de propósito — ele é o fundo da história, não a história
 * — e por isso os dois gráficos entregam rótulo visível e tabela, que é o que o
 * guia pede como contrapartida.
 */

/* As cores, por papel. Trocar aqui troca em todos os gráficos. */
const TINTA = {
  destaque: '#059669',
  destaqueForte: '#047857',
  destaqueClaro: '#34D399',
  apagado: '#94A3B8',
  trilho: '#F1F5F9',
  grade: '#E2E8F0',
  texto: '#0D233A',
  textoSecundario: '#64748B',
  textoApagado: '#94A3B8'
};

const numero = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? '—' : valor.toLocaleString('pt-BR');

const porcento = (parte: number, casas = 0) =>
  `${(parte * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  })}%`;

/**
 * Ticks redondos, e uma escala que cabe.
 *
 * Dois cuidados que só aparecem quando se olha o desenho pronto:
 *
 * 1. O eixo tem de terminar ACIMA da maior barra. Parando no último tick
 *    redondo abaixo dela, a barra passava da área do gráfico e invadia a
 *    margem — o desenho ficava mentindo sobre a própria escala.
 * 2. E tem de sobrar largura depois da maior barra, senão o rótulo dela não
 *    tem onde ficar. Quando a folga é menor que 8%, o eixo ganha mais um
 *    passo: é mais barato dar um tick a mais do que esconder o número do
 *    maior bairro da lista.
 */
const ticksDeEscala = (maximo: number) => {
  const passos = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25];
  const passo = passos.find((p) => maximo / p <= 5) ?? 0.5;
  let escala = Math.ceil(maximo / passo) * passo;
  if (escala <= maximo || (escala - maximo) / escala < 0.08) escala += passo;
  const ticks: number[] = [];
  for (let v = 0; v <= escala + 1e-9; v += passo) ticks.push(Number(v.toFixed(4)));
  return ticks;
};

/** O balão do passar do mouse, posicionado dentro da caixa do gráfico. */
function Balao({
  em,
  children
}: {
  em: { x: number; y: number } | null;
  children: React.ReactNode;
}) {
  if (!em) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl bg-white px-2.5 py-2 shadow-xl border border-slate-200/80"
      style={{ left: em.x, top: em.y - 8, maxWidth: 220 }}
    >
      {children}
    </div>
  );
}

/** Cabeçalho comum: título, uma frase de leitura e o botão da tabela. */
function CabecalhoDoGrafico({
  titulo,
  leitura,
  tabelaAberta,
  onTrocar
}: {
  titulo: string;
  leitura: React.ReactNode;
  tabelaAberta: boolean;
  onTrocar: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {titulo}
        </p>
        {/*
          A frase de leitura é o próprio achado escrito por extenso.
          Um gráfico que precisa ser decifrado já falhou: quem só passa o olho
          leva a conclusão, e quem quer conferir tem o desenho logo abaixo.
        */}
        <p className="text-[12.5px] font-bold text-[#0D233A] leading-snug mt-0.5">
          {leitura}
        </p>
      </div>
      <button
        type="button"
        onClick={onTrocar}
        title={tabelaAberta ? 'Ver como gráfico' : 'Ver como tabela'}
        aria-label={tabelaAberta ? 'Ver como gráfico' : 'Ver como tabela'}
        className="shrink-0 w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-emerald-700 hover:border-emerald-300 flex items-center justify-center cursor-pointer transition-colors"
      >
        {tabelaAberta ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export interface BairroDoGrafico {
  codigo: string;
  nome: string;
  populacao: number | null;
  domicilios: number | null;
  areaKm2: number | null;
}

/**
 * ONDE MORA A CIDADE — concentração da população por bairro.
 *
 * A pergunta que este gráfico responde é de rota, não de curiosidade: *quantos
 * bairros eu preciso cobrir para falar com metade da cidade?* A lista ordenada
 * por população não responde isso — ela mostra quem é o maior, e o olho não
 * soma barra por barra até chegar na metade.
 *
 * Então a soma é feita aqui, e o corte fica desenhado: os bairros até a metade
 * da população saem no verde do painel, o resto sai em cinza, e uma linha marca
 * exatamente onde a metade acontece. É a forma de ÊNFASE — um destaque e um
 * fundo —, e não oito cores disputando atenção para dizer uma coisa só.
 *
 * O DENOMINADOR É HONESTO. A base não é a população do município: parte do
 * território fica fora da divisão por bairros, e usar o total municipal faria a
 * soma das barras nunca fechar em 100% sem explicação. A base é a soma dos
 * bairros que a fonte entregou, e está escrito na tela que é isso.
 */
export function ConcentracaoDeBairros({
  bairros,
  emFoco,
  onFocar,
  onAbrir
}: {
  bairros: BairroDoGrafico[];
  emFoco?: string | null;
  onFocar?: (codigo: string | null) => void;
  onAbrir?: (bairro: BairroDoGrafico) => void;
}) {
  const [tabela, setTabela] = useState(false);
  const [sob, setSob] = useState<{ codigo: string; x: number; y: number } | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);

  const dados = useMemo(() => {
    const comGente = bairros
      .filter((b) => (b.populacao ?? 0) > 0)
      .sort((a, b) => (b.populacao || 0) - (a.populacao || 0));
    const total = comGente.reduce((soma, b) => soma + (b.populacao || 0), 0);
    let acumulado = 0;
    const linhas = comGente.map((bairro) => {
      const populacao = bairro.populacao || 0;
      const parte = total > 0 ? populacao / total : 0;
      acumulado += parte;
      return {
        ...bairro,
        populacao,
        parte,
        acumulado,
        densidade:
          bairro.areaKm2 && bairro.areaKm2 > 0 ? Math.round(populacao / bairro.areaKm2) : null
      };
    });
    // O primeiro bairro em que a soma alcança a metade: é ele que leva o corte.
    const corte = linhas.findIndex((l) => l.acumulado >= 0.5);
    return { linhas, total, corte: corte === -1 ? linhas.length - 1 : corte };
  }, [bairros]);

  if (dados.linhas.length < 3) return null;

  const { linhas, total, corte } = dados;
  const maior = linhas[0].parte;
  const ticks = ticksDeEscala(maior);
  const escala = ticks[ticks.length - 1];
  const naMetade = corte + 1;

  const leitura = (
    <>
      {naMetade === 1 ? (
        <>
          <strong className="font-black" style={{ color: TINTA.destaque }}>
            {linhas[0].nome}
          </strong>{' '}
          sozinho tem metade
        </>
      ) : (
        <>
          <strong className="font-black" style={{ color: TINTA.destaque }}>
            {naMetade} bairros
          </strong>{' '}
          concentram metade
        </>
      )}{' '}
      dos {numero(total)} moradores, de {linhas.length} no total.
    </>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <CabecalhoDoGrafico
        titulo="Onde mora a cidade"
        leitura={leitura}
        tabelaAberta={tabela}
        onTrocar={() => setTabela((v) => !v)}
      />

      {tabela ? (
        <div className="max-h-[320px] overflow-y-auto -mx-1 px-1">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-400 font-black uppercase tracking-wider text-[9.5px]">
                <th className="py-1 pr-2">Bairro</th>
                <th className="py-1 px-1 text-right">Moradores</th>
                <th className="py-1 px-1 text-right">Parte</th>
                <th className="py-1 pl-1 text-right">Acum.</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {linhas.map((linha, i) => (
                <tr
                  key={linha.codigo}
                  className={`border-t border-slate-100 ${i <= corte ? 'font-bold' : ''}`}
                >
                  <td className="py-1 pr-2 text-slate-700">{linha.nome}</td>
                  <td className="py-1 px-1 text-right text-slate-700">
                    {numero(linha.populacao)}
                  </td>
                  <td className="py-1 px-1 text-right text-slate-500">
                    {porcento(linha.parte, 1)}
                  </td>
                  <td className="py-1 pl-1 text-right text-slate-500">
                    {porcento(linha.acumulado, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={caixaRef} className="relative">
          {/* A grade: fio sólido de um passo fora da superfície, atrás de tudo. */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: 104, right: 8 }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-0 bottom-[18px] w-px"
                style={{
                  left: `${(tick / escala) * 100}%`,
                  backgroundColor: tick === 0 ? TINTA.grade : TINTA.grade
                }}
              />
            ))}
          </div>

          {/* Sem rolagem dentro de rolagem: o painel inteiro já rola, e uma
              caixa que corta a última barra no meio parece defeito. */}
          <div className="relative pr-2">
            {linhas.map((linha, i) => {
              const dentro = i <= corte;
              const destacado = emFoco === linha.codigo;
              return (
                <React.Fragment key={linha.codigo}>
                  <button
                    type="button"
                    onMouseEnter={(e) => {
                      onFocar?.(linha.codigo);
                      const caixa = caixaRef.current?.getBoundingClientRect();
                      const alvo = e.currentTarget.getBoundingClientRect();
                      if (caixa) {
                        setSob({
                          codigo: linha.codigo,
                          x: Math.min(Math.max(alvo.left - caixa.left + 140, 90), caixa.width - 90),
                          y: alvo.top - caixa.top
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      onFocar?.(null);
                      setSob(null);
                    }}
                    onFocus={(e) => {
                      onFocar?.(linha.codigo);
                      const caixa = caixaRef.current?.getBoundingClientRect();
                      const alvo = e.currentTarget.getBoundingClientRect();
                      if (caixa) {
                        setSob({
                          codigo: linha.codigo,
                          x: Math.min(Math.max(alvo.left - caixa.left + 140, 90), caixa.width - 90),
                          y: alvo.top - caixa.top
                        });
                      }
                    }}
                    onBlur={() => {
                      onFocar?.(null);
                      setSob(null);
                    }}
                    onClick={() => onAbrir?.(linha)}
                    /* O alvo do ponteiro é a linha inteira, e não os pixels
                       pintados: barra de 10px é mira, não botão. */
                    className="w-full flex items-center gap-2 py-[3px] text-left cursor-pointer group"
                  >
                    <span
                      className={`w-[96px] shrink-0 truncate text-[10.5px] leading-tight ${
                        dentro ? 'font-black' : 'font-bold'
                      }`}
                      style={{ color: dentro ? TINTA.texto : TINTA.textoSecundario }}
                      title={linha.nome}
                    >
                      {linha.nome}
                    </span>

                    <span className="relative flex-1 h-[13px]">
                      <span
                        className="absolute left-0 top-0 h-full rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                        style={{
                          width: `${Math.max((linha.parte / escala) * 100, 1.5)}%`,
                          backgroundColor: dentro ? TINTA.destaque : TINTA.apagado,
                          outline: destacado ? `2px solid ${TINTA.destaqueForte}` : undefined,
                          outlineOffset: 1
                        }}
                      />
                      {/*
                        Rótulo só nos dois pontos que decidem: o maior bairro e
                        o que fecha a metade. Número em toda barra não é lido.

                        E ele muda de lado quando não cabe. A barra mais longa
                        chega perto do fim do eixo, e o rótulo do lado de fora
                        passava da borda do cartão — em painel estreito, o
                        número do maior bairro saía cortado. Passando de 68% da
                        largura, o rótulo entra na própria barra, em branco
                        sobre o verde. Nunca fica cortado: ou cabe fora, ou cabe
                        dentro, ou fica só no balão e na tabela.
                      */}
                      {(i === 0 || i === corte) &&
                        (() => {
                          const largura = Math.max((linha.parte / escala) * 100, 1.5);
                          const dentroDaBarra = largura > 68;
                          if (dentroDaBarra && largura < 30) return null;
                          return (
                            <span
                              className="absolute top-1/2 -translate-y-1/2 text-[9.5px] font-black tabular-nums whitespace-nowrap"
                              style={
                                dentroDaBarra
                                  ? {
                                      left: `calc(${largura}% - 6px)`,
                                      /*
                                        Só o deslocamento horizontal aqui. A
                                        classe `-translate-y-1/2` do Tailwind v4
                                        escreve na propriedade `translate`, e um
                                        `transform` com Y somava com ela: o
                                        rótulo subia duas vezes e saía por cima
                                        da barra, cortado pela borda do cartão.
                                      */
                                      transform: 'translateX(-100%)',
                                      color: '#FFFFFF'
                                    }
                                  : {
                                      left: `calc(${largura}% + 6px)`,
                                      color: TINTA.textoSecundario
                                    }
                              }
                            >
                              {numero(linha.populacao)} · {porcento(linha.parte, 1)}
                            </span>
                          );
                        })()}
                    </span>
                  </button>

                  {/*
                    O CORTE DA METADE, desenhado onde ele acontece.
                    É anotação, não grade: fio sólido na cor do destaque, com o
                    que ele significa escrito ao lado — senão vira mais uma
                    linha que o leitor tem de adivinhar.
                  */}
                  {i === corte && i < linhas.length - 1 && (
                    <div className="flex items-center gap-2 my-1">
                      <span className="w-[96px] shrink-0 text-right text-[9px] font-black uppercase tracking-wider"
                        style={{ color: TINTA.destaqueForte }}
                      >
                        metade
                      </span>
                      <span className="flex-1 h-px" style={{ backgroundColor: TINTA.destaque }} />
                      <span className="text-[9px] font-bold" style={{ color: TINTA.textoApagado }}>
                        daqui para baixo, a outra metade em {linhas.length - naMetade} bairros
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Eixo: a unidade é parte da população mapeada, e só. */}
          <div className="relative h-[18px] mt-1" style={{ marginLeft: 104, marginRight: 8 }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-0 -translate-x-1/2 text-[9px] font-bold tabular-nums"
                style={{ left: `${(tick / escala) * 100}%`, color: TINTA.textoApagado }}
              >
                {porcento(tick)}
              </span>
            ))}
          </div>

          <Balao
            em={sob ? { x: sob.x, y: sob.y } : null}
          >
            {(() => {
              const linha = linhas.find((l) => l.codigo === sob?.codigo);
              if (!linha) return null;
              return (
                <>
                  <p className="text-[13px] font-black tabular-nums" style={{ color: TINTA.texto }}>
                    {numero(linha.populacao)}{' '}
                    <span className="text-[10px] font-bold" style={{ color: TINTA.textoSecundario }}>
                      moradores
                    </span>
                  </p>
                  <p className="text-[10.5px] font-bold leading-tight" style={{ color: TINTA.textoSecundario }}>
                    {linha.nome}
                  </p>
                  <p className="text-[10px] font-semibold mt-1 leading-snug" style={{ color: TINTA.textoApagado }}>
                    {porcento(linha.parte, 1)} da cidade mapeada · {porcento(linha.acumulado, 1)} acumulado
                    {linha.densidade !== null && <> · {numero(linha.densidade)} hab/km²</>}
                  </p>
                </>
              );
            })()}
          </Balao>
        </div>
      )}

      <p className="text-[9.5px] font-semibold mt-2 leading-snug" style={{ color: TINTA.textoApagado }}>
        Base: a soma dos {linhas.length} bairros com população divulgada. Parte do
        município fica fora da divisão por bairros e não entra nesta conta.
      </p>
    </div>
  );
}

/**
 * O QUE O CÍRCULO ALCANÇA — e o quanto disso é contagem.
 *
 * A análise de raio devolve dois números que parecem o mesmo e não são: o piso
 * exato (só os setores inteiramente dentro do círculo, contados) e a estimativa
 * (que soma os setores da borda pela fração de área coberta). Em dois cartões
 * separados, como estava, ninguém enxergava a relação entre eles — e a decisão
 * de campo muda conforme a borda seja um detalhe ou seja metade do número.
 *
 * Aqui os dois viram uma barra só, empilhada: o pedaço escuro é o que está
 * contado, o claro é o que foi estimado. A incerteza deixa de ser uma nota de
 * rodapé e passa a ter tamanho — que é o único jeito de ela ser levada em conta.
 *
 * Mesma matiz em dois passos, e não duas cores: não são duas categorias, é a
 * mesma população com dois graus de certeza. Entre os dois passos há a folga de
 * 2px na cor da superfície, que é o que separa — nunca um contorno, que seria
 * tinta a mais fingindo ser dado.
 */
export function CertezaDoRaio({
  exato,
  estimado,
  setoresInteiros,
  setoresParciais
}: {
  exato: number;
  estimado: number;
  setoresInteiros: number;
  setoresParciais: number;
}) {
  const [tabela, setTabela] = useState(false);
  const total = Math.max(estimado, exato, 1);
  const parteExata = Math.min(exato / total, 1);
  const parteEstimada = Math.max(0, 1 - parteExata);
  const naBorda = Math.max(0, estimado - exato);

  const leitura =
    parteEstimada < 0.02 ? (
      <>Quase tudo aqui é contagem: a borda quase não pesa.</>
    ) : (
      <>
        <strong className="font-black" style={{ color: TINTA.destaque }}>
          {porcento(parteExata)}
        </strong>{' '}
        deste número é contagem; o resto vem da borda do círculo.
      </>
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <CabecalhoDoGrafico
        titulo="Quanto disto é contagem"
        leitura={leitura}
        tabelaAberta={tabela}
        onTrocar={() => setTabela((v) => !v)}
      />

      {tabela ? (
        <table className="w-full text-[11px] tabular-nums">
          <tbody>
            {[
              { r: 'Piso contado (setores inteiros)', v: exato, d: `${setoresInteiros} setores` },
              { r: 'Estimado na borda', v: naBorda, d: `${setoresParciais} setores parciais` },
              { r: 'Estimativa total', v: estimado, d: `${setoresInteiros + setoresParciais} setores` }
            ].map((linha) => (
              <tr key={linha.r} className="border-t border-slate-100 first:border-0">
                <td className="py-1.5 pr-2 text-slate-700 font-bold">{linha.r}</td>
                <td className="py-1.5 px-1 text-right text-slate-700 font-black">
                  {numero(linha.v)}
                </td>
                <td className="py-1.5 pl-1 text-right text-slate-400 font-semibold">{linha.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="flex h-[22px] rounded-lg overflow-hidden" style={{ backgroundColor: TINTA.trilho }}>
            <span
              className="h-full"
              style={{ width: `${parteExata * 100}%`, backgroundColor: TINTA.destaqueForte }}
              title="Piso contado"
            />
            {/* A folga de 2px na cor da superfície é o que separa os dois. */}
            {parteEstimada > 0 && <span className="h-full w-[2px] bg-white" />}
            {parteEstimada > 0 && (
              <span
                className="h-full"
                style={{ width: `calc(${parteEstimada * 100}% - 2px)`, backgroundColor: TINTA.destaqueClaro }}
                title="Estimado na borda"
              />
            )}
          </div>

          {/*
            Legenda sempre presente: são duas séries, e a identidade não pode
            depender de o leitor acertar qual verde é qual.
          */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {[
              {
                cor: TINTA.destaqueForte,
                rotulo: 'contado',
                valor: exato,
                nota: `${setoresInteiros} setores inteiros`
              },
              {
                cor: TINTA.destaqueClaro,
                rotulo: 'estimado na borda',
                valor: naBorda,
                nota: `${setoresParciais} setores parciais`
              }
            ].map((item) => (
              <span key={item.rotulo} className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                  style={{ backgroundColor: item.cor }}
                />
                <span className="text-[10.5px] font-black tabular-nums" style={{ color: TINTA.texto }}>
                  {numero(item.valor)}
                </span>
                <span className="text-[10px] font-semibold truncate" style={{ color: TINTA.textoSecundario }}>
                  {item.rotulo}
                </span>
                <span className="text-[9.5px] font-semibold truncate" style={{ color: TINTA.textoApagado }}>
                  · {item.nota}
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * GENTE JUNTA — população contra densidade, bairro a bairro.
 *
 * Depois de "onde mora a cidade" vem a pergunta que decide a rota do dia:
 * *onde a gente está junta?* Panfletagem não se mede em moradores, se mede em
 * moradores por hora de caminhada — e 20 mil pessoas espalhadas em 12 km² é um
 * dia inteiro, enquanto 20 mil em 2 km² é uma manhã.
 *
 * A lista tem os dois números em cada linha e mesmo assim não responde isso:
 * comparar dezoito pares de números de cabeça não é leitura, é conta. No plano,
 * a resposta é uma posição — quem está no alto e à direita é muita gente e
 * junta.
 *
 * Os mesmos bairros que o gráfico de cima acende continuam acesos aqui. Dois
 * desenhos sobre o mesmo assunto não podem destacar conjuntos diferentes: seria
 * o painel discordando de si mesmo na mesma rolagem.
 *
 * A linha vertical é a densidade do meio da lista (a mediana, não a média — uma
 * Cidade Nova de vinte mil por km² puxaria a média para longe de todo mundo).
 * Ela divide a tela em "mais espalhado" e "mais concentrado", que é a leitura
 * que interessa.
 */
export function GenteJunta({
  bairros,
  emFoco,
  onFocar,
  onAbrir
}: {
  bairros: BairroDoGrafico[];
  emFoco?: string | null;
  onFocar?: (codigo: string | null) => void;
  onAbrir?: (bairro: BairroDoGrafico) => void;
}) {
  const [tabela, setTabela] = useState(false);
  const [sob, setSob] = useState<{ codigo: string; x: number; y: number } | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);

  const dados = useMemo(() => {
    const pontos = bairros
      .filter((b) => (b.populacao ?? 0) > 0 && (b.areaKm2 ?? 0) > 0)
      .map((b) => ({
        ...b,
        populacao: b.populacao || 0,
        densidade: Math.round((b.populacao || 0) / (b.areaKm2 || 1))
      }))
      .sort((a, b) => b.populacao - a.populacao);

    // Os mesmos que fecham metade da cidade no gráfico de cima.
    const total = pontos.reduce((soma, p) => soma + p.populacao, 0);
    let acumulado = 0;
    const destacados = new Set<string>();
    for (const ponto of pontos) {
      destacados.add(ponto.codigo);
      acumulado += ponto.populacao / (total || 1);
      if (acumulado >= 0.5) break;
    }

    const densidades = pontos.map((p) => p.densidade).sort((a, b) => a - b);
    const mediana =
      densidades.length === 0
        ? 0
        : densidades.length % 2
          ? densidades[(densidades.length - 1) / 2]
          : Math.round(
              (densidades[densidades.length / 2 - 1] + densidades[densidades.length / 2]) / 2
            );

    return { pontos, destacados, mediana };
  }, [bairros]);

  if (dados.pontos.length < 4) return null;

  const { pontos, destacados, mediana } = dados;
  const maxPop = Math.max(...pontos.map((p) => p.populacao));
  const maxDen = Math.max(...pontos.map((p) => p.densidade));
  /* Folga de 8% nos dois eixos: ponto colado na borda parece cortado. */
  const topoY = maxPop * 1.08;
  const topoX = maxDen * 1.08;

  const ALTURA = 190;
  const MARGEM = { cima: 8, direita: 10, baixo: 22, esquerda: 44 };

  const px = (densidade: number) => (densidade / topoX) * 100;
  const py = (populacao: number) => 100 - (populacao / topoY) * 100;

  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((topoY * f) / 1000) * 1000);
  const ticksX = [0, 0.5, 1].map((f) => Math.round((topoX * f) / 1000) * 1000);

  const melhores = pontos
    .filter((p) => destacados.has(p.codigo) && p.densidade >= mediana)
    .slice(0, 3);

  const leitura =
    melhores.length > 0 ? (
      <>
        <strong className="font-black" style={{ color: TINTA.destaque }}>
          {melhores.map((m) => m.nome).join(', ')}
        </strong>{' '}
        {melhores.length === 1 ? 'junta' : 'juntam'} muita gente em pouco chão.
      </>
    ) : (
      <>Os bairros mais cheios são também os mais espalhados — aqui o dia rende menos.</>
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <CabecalhoDoGrafico
        titulo="Gente junta"
        leitura={leitura}
        tabelaAberta={tabela}
        onTrocar={() => setTabela((v) => !v)}
      />

      {tabela ? (
        <div className="max-h-[300px] overflow-y-auto -mx-1 px-1">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-400 font-black uppercase tracking-wider text-[9.5px]">
                <th className="py-1 pr-2">Bairro</th>
                <th className="py-1 px-1 text-right">Moradores</th>
                <th className="py-1 px-1 text-right">km²</th>
                <th className="py-1 pl-1 text-right">hab/km²</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...pontos]
                .sort((a, b) => b.densidade - a.densidade)
                .map((ponto) => (
                  <tr
                    key={ponto.codigo}
                    className={`border-t border-slate-100 ${
                      destacados.has(ponto.codigo) ? 'font-bold' : ''
                    }`}
                  >
                    <td className="py-1 pr-2 text-slate-700">{ponto.nome}</td>
                    <td className="py-1 px-1 text-right text-slate-700">
                      {numero(ponto.populacao)}
                    </td>
                    <td className="py-1 px-1 text-right text-slate-500">
                      {(ponto.areaKm2 || 0).toLocaleString('pt-BR', {
                        maximumFractionDigits: 1
                      })}
                    </td>
                    <td className="py-1 pl-1 text-right text-slate-500">
                      {numero(ponto.densidade)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={caixaRef} className="relative" style={{ height: ALTURA + MARGEM.baixo }}>
          <div
            className="absolute"
            style={{
              left: MARGEM.esquerda,
              right: MARGEM.direita,
              top: MARGEM.cima,
              height: ALTURA - MARGEM.cima
            }}
          >
            {/* Grade: fio sólido, um passo fora da superfície, recessiva. */}
            {ticksY.map((tick) => (
              <span
                key={tick}
                className="absolute left-0 right-0 h-px"
                style={{ top: `${py(tick)}%`, backgroundColor: TINTA.grade }}
              />
            ))}

            {/*
              A mediana da densidade: a divisa entre espalhado e concentrado.
              É anotação, não grade — por isso leva cor e nome.
            */}
            <span
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${px(mediana)}%`, backgroundColor: TINTA.destaqueClaro }}
            />
            <span
              className="absolute -top-1 text-[8.5px] font-black uppercase tracking-wider whitespace-nowrap"
              style={{ left: `calc(${px(mediana)}% + 4px)`, color: TINTA.destaqueForte }}
            >
              mais concentrado →
            </span>

            {pontos.map((ponto) => {
              const aceso = destacados.has(ponto.codigo);
              const destacado = emFoco === ponto.codigo;
              const rotulado = melhores.some((m) => m.codigo === ponto.codigo);
              const x = px(ponto.densidade);
              const y = py(ponto.populacao);
              return (
                <React.Fragment key={ponto.codigo}>
                  <button
                    type="button"
                    /* Alvo de 24px em volta de um ponto de 10px: ponto é mira,
                       e ninguém acerta mira com o dedo nem com pressa. */
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full cursor-pointer"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onMouseEnter={(e) => {
                      onFocar?.(ponto.codigo);
                      const caixa = caixaRef.current?.getBoundingClientRect();
                      const alvo = e.currentTarget.getBoundingClientRect();
                      if (caixa) {
                        setSob({
                          codigo: ponto.codigo,
                          x: Math.min(Math.max(alvo.left - caixa.left + 12, 80), caixa.width - 80),
                          y: alvo.top - caixa.top
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      onFocar?.(null);
                      setSob(null);
                    }}
                    onFocus={(e) => {
                      onFocar?.(ponto.codigo);
                      const caixa = caixaRef.current?.getBoundingClientRect();
                      const alvo = e.currentTarget.getBoundingClientRect();
                      if (caixa) {
                        setSob({
                          codigo: ponto.codigo,
                          x: Math.min(Math.max(alvo.left - caixa.left + 12, 80), caixa.width - 80),
                          y: alvo.top - caixa.top
                        });
                      }
                    }}
                    onBlur={() => {
                      onFocar?.(null);
                      setSob(null);
                    }}
                    onClick={() => onAbrir?.(ponto)}
                    aria-label={`${ponto.nome}: ${numero(ponto.populacao)} moradores, ${numero(
                      ponto.densidade
                    )} por km²`}
                  >
                    {/* Anel de 2px na cor da superfície: é o que separa dois
                        pontos encostados, sem contorno de tinta por cima. */}
                    <span
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: destacado ? 14 : 10,
                        height: destacado ? 14 : 10,
                        backgroundColor: aceso ? TINTA.destaque : TINTA.apagado,
                        boxShadow: `0 0 0 2px #fff${destacado ? `, 0 0 0 4px ${TINTA.destaqueForte}` : ''}`
                      }}
                    />
                  </button>

                  {rotulado && (
                    <span
                      className="absolute text-[9.5px] font-black whitespace-nowrap pointer-events-none"
                      style={{
                        left: x > 62 ? undefined : `calc(${x}% + 10px)`,
                        right: x > 62 ? `calc(${100 - x}% + 10px)` : undefined,
                        top: `calc(${y}% - 7px)`,
                        color: TINTA.texto
                      }}
                    >
                      {ponto.nome}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Eixo vertical: moradores. */}
          <div
            className="absolute"
            style={{ left: 0, width: MARGEM.esquerda - 6, top: MARGEM.cima, height: ALTURA - MARGEM.cima }}
          >
            {ticksY.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 text-[9px] font-bold tabular-nums"
                style={{ top: `${py(tick)}%`, color: TINTA.textoApagado }}
              >
                {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
              </span>
            ))}
          </div>

          {/* Eixo horizontal: densidade. */}
          <div
            className="absolute"
            style={{ left: MARGEM.esquerda, right: MARGEM.direita, top: ALTURA }}
          >
            {ticksX.map((tick, i) => (
              <span
                key={tick}
                className="absolute text-[9px] font-bold tabular-nums whitespace-nowrap"
                style={{
                  left: `${px(tick)}%`,
                  /* O primeiro tick encosta à esquerda e o último à direita:
                     centrado, o último saía pela borda do cartão e a unidade
                     aparecia cortada no meio. */
                  transform:
                    i === 0
                      ? 'none'
                      : i === ticksX.length - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  color: TINTA.textoApagado
                }}
              >
                {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
                {i === ticksX.length - 1 ? ' hab/km²' : ''}
              </span>
            ))}
          </div>

          <Balao em={sob ? { x: sob.x, y: sob.y } : null}>
            {(() => {
              const ponto = pontos.find((p) => p.codigo === sob?.codigo);
              if (!ponto) return null;
              return (
                <>
                  <p className="text-[13px] font-black tabular-nums" style={{ color: TINTA.texto }}>
                    {numero(ponto.densidade)}{' '}
                    <span className="text-[10px] font-bold" style={{ color: TINTA.textoSecundario }}>
                      hab/km²
                    </span>
                  </p>
                  <p className="text-[10.5px] font-bold leading-tight" style={{ color: TINTA.textoSecundario }}>
                    {ponto.nome}
                  </p>
                  <p className="text-[10px] font-semibold mt-1 leading-snug" style={{ color: TINTA.textoApagado }}>
                    {numero(ponto.populacao)} moradores em{' '}
                    {(ponto.areaKm2 || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km²
                  </p>
                </>
              );
            })()}
          </Balao>
        </div>
      )}

      <p className="text-[9.5px] font-semibold mt-1 leading-snug" style={{ color: TINTA.textoApagado }}>
        Em verde, os mesmos bairros que fecham metade da cidade. A linha é a
        densidade do meio da lista.
      </p>
    </div>
  );
}
