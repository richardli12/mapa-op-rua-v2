import { useMemo, useState } from 'react';
import { ChevronRight, Search, Users2 } from 'lucide-react';
import type { GrupoDeIndicadores, IndicadorDoCenso, IndicadoresDoRecorte } from '../../services/territorio';

/**
 * A visão geral do Censo: o painel de indicadores redesenhado.
 *
 * A lista de grupos que já existia (accordion de "Domicílios", "Renda"...)
 * respondia bem a "me dê o indicador X", mas não respondia à primeira
 * pergunta de quem abre um recorte: "quem mora aqui, em uma olhada". Este
 * painel é essa primeira olhada — população, quem é a maioria, como estão os
 * domicílios — com a lista de sempre um botão abaixo, para quem quer o
 * indicador específico.
 *
 * DE ONDE VÊM OS NÚMEROS, E O QUE É ADIVINHADO E O QUE NÃO É.
 *
 * População, domicílios e o total de setores do recorte chegam como campos
 * próprios da API (`populacaoDoRecorte`, `domiciliosDoRecorte`,
 * `censo.totalSetores`) — não são lidos de dentro da lista de indicadores, e
 * por isso não dependem de como o CCO escreveu o rótulo.
 *
 * A pirâmide etária, a composição por cor ou raça e o saneamento SÃO lidos da
 * lista de indicadores, por padrão de texto no rótulo ("Homens de 20 a 29
 * anos", "Cor ou raça parda", indicadores com "água"/"esgoto"/"lixo" no nome).
 * É o mesmo tipo de leitura que o Censo do IBGE usa nas suas próprias
 * publicações — não é uma convenção nossa. Quando o padrão não bate com o que
 * a fonte mandou, a seção correspondente some inteira: um gráfico com metade
 * dos dados, sem avisar, é pior do que a seção não aparecer.
 */

/* ---------------------------------------------------------------- utils --- */

const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const numero = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? '—'
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const porcento = (fracao: number, casas = 1) =>
  `${(fracao * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  })}%`;

/** Todo indicador de todos os grupos, numa lista só, com o grupo de origem junto. */
function achatar(grupos: GrupoDeIndicadores[]) {
  return grupos.flatMap((grupo) =>
    [...grupo.principais, ...grupo.detalhes].map((indicador) => ({
      ...indicador,
      grupoId: grupo.id,
      grupoTitulo: grupo.titulo
    }))
  );
}

/** O primeiro indicador cujo rótulo bate no padrão, com valor numérico. */
function acharPorRotulo(
  lista: ReturnType<typeof achatar>,
  padrao: RegExp
): (ReturnType<typeof achatar>[number]) | null {
  return lista.find((i) => i.valor !== null && padrao.test(semAcento(i.rotulo))) || null;
}

/* --------------------------------------------------------- perfil etário --- */

interface FaixaEtaria {
  chave: string;
  rotulo: string;
  inicio: number;
  homens: number | null;
  mulheres: number | null;
}

/**
 * Lê a pirâmide etária de dentro da lista de indicadores.
 *
 * O padrão de rótulo é o do próprio Censo: "Homens de 0 a 9 anos", "Mulheres
 * com 80 anos ou mais". A largura das faixas (dez em dez anos, cinco em cinco)
 * é a que a fonte publicou — não fixamos nenhuma, para não desenhar uma faixa
 * que o dado não tem.
 */
function lerPiramide(lista: ReturnType<typeof achatar>): FaixaEtaria[] {
  const PADRAO = /^(homens|mulheres)\s+(?:de\s+(\d+)\s+a\s+(\d+)\s+anos?|com\s+(\d+)\s+anos?\s+ou\s+mais)$/;
  const porFaixa = new Map<string, FaixaEtaria>();

  lista.forEach((indicador) => {
    const m = PADRAO.exec(semAcento(indicador.rotulo));
    if (!m || indicador.valor === null) return;
    const sexo = m[1];
    const inicio = Number(m[2] ?? m[4]);
    const fim = m[3] ?? null;
    const chave = fim ? `${inicio}-${fim}` : `${inicio}+`;
    const rotulo = fim ? `${inicio} a ${fim} anos` : `${inicio} anos ou mais`;

    const atual = porFaixa.get(chave) || { chave, rotulo, inicio, homens: null, mulheres: null };
    if (sexo === 'homens') atual.homens = indicador.valor;
    else atual.mulheres = indicador.valor;
    porFaixa.set(chave, atual);
  });

  return Array.from(porFaixa.values())
    .filter((f) => f.homens !== null || f.mulheres !== null)
    .sort((a, b) => a.inicio - b.inicio);
}

/* ------------------------------------------------------------ cor ou raça --- */

interface FatiaDeRaca {
  categoria: string;
  valor: number;
}

const CORES_RACA: { [chave: string]: string } = {
  parda: '#B45309',
  branca: '#94A3B8',
  preta: '#1E293B',
  indigena: '#059669',
  amarela: '#D97706'
};

/** "Cor ou raça parda" → { categoria: "Parda", valor }. Só as cinco do Censo. */
function lerRaca(lista: ReturnType<typeof achatar>): FatiaDeRaca[] {
  const PADRAO = /^(?:cor ou ra[cç]a|ra[cç]a ou cor)\s+(parda|branca|preta|indigena|ind[ií]gena|amarela)$/;
  const fatias: FatiaDeRaca[] = [];

  lista.forEach((indicador) => {
    const m = PADRAO.exec(semAcento(indicador.rotulo));
    if (!m || indicador.valor === null || indicador.valor <= 0) return;
    const chave = m[1].startsWith('ind') ? 'indigena' : m[1];
    fatias.push({
      categoria: chave === 'indigena' ? 'Indígena' : chave[0].toUpperCase() + chave.slice(1),
      valor: indicador.valor
    });
  });

  return fatias.sort((a, b) => b.valor - a.valor);
}

/* -------------------------------------------------------------- saneamento --- */

interface ItemDeSaneamento {
  rotulo: string;
  valor: number;
  unidade: string;
}

/**
 * Água, esgoto e coleta de lixo — um indicador de cada, o mais "adequado".
 *
 * Cada tema costuma vir com mais de uma variante (água de rede geral, de
 * poço...). Preferimos a que descreve o serviço formal ("rede geral",
 * "coletora", "serviço de limpeza"); na falta dela, a primeira que bater no
 * tema, para a seção não sumir por causa de uma palavra que a fonte não usou.
 */
function lerSaneamento(lista: ReturnType<typeof achatar>): ItemDeSaneamento[] {
  const TEMAS: { tema: RegExp; preferido: RegExp }[] = [
    { tema: /agua/, preferido: /rede geral/ },
    { tema: /esgot/, preferido: /rede (geral|coletora)|coletora/ },
    { tema: /lixo/, preferido: /servi[cç]o|coletad/ }
  ];

  const itens: ItemDeSaneamento[] = [];
  TEMAS.forEach(({ tema, preferido }) => {
    const doTema = lista.filter((i) => i.valor !== null && tema.test(semAcento(i.rotulo)));
    if (doTema.length === 0) return;
    const escolhido =
      doTema.find((i) => preferido.test(semAcento(i.rotulo))) || doTema[0];
    itens.push({ rotulo: escolhido.rotulo, valor: escolhido.valor as number, unidade: escolhido.unidade });
  });
  return itens;
}

/* ----------------------------------------------------------- indicador --- */

/** Uma linha de indicador: rótulo, origem e valor. A mesma em toda seção. */
function LinhaDeIndicador({ indicador }: { indicador: IndicadorDoCenso; key?: string }) {
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-bold text-slate-700 leading-tight">
          {indicador.rotulo}
        </span>
        <span className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
            {indicador.origem}
          </span>
          {indicador.setoresSemDado > 0 && (
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600">
              soma parcial · {indicador.setoresSemDado} setor(es) sem dado
            </span>
          )}
        </span>
      </span>
      <span className="text-right shrink-0">
        {indicador.valor === null ? (
          <span className="text-[10px] font-bold text-slate-300 italic">
            {indicador.motivoIndisponivel === 'sem-dado-na-fonte'
              ? 'não divulgado'
              : indicador.motivoIndisponivel === 'denominador-zero'
                ? 'sem denominador aqui'
                : 'sem dado'}
          </span>
        ) : (
          <>
            <span className="block text-[13px] font-black text-[#0D233A] leading-none">
              {indicador.valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </span>
            <span className="block text-[9px] font-bold text-slate-400">{indicador.unidade}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** Um cartão de número, para a grade de "visão geral". */
function CartaoDeNumero({
  rotulo,
  valor,
  unidade,
  fonte
}: {
  rotulo: string;
  valor: string;
  unidade?: string;
  fonte: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold text-slate-400 leading-tight">{rotulo}</p>
        <span className="shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded-md bg-[#EFF4FB] text-[#015FC9] text-[8px] font-black uppercase tracking-wider">
          {fonte}
        </span>
      </div>
      <p className="mt-1.5 text-[19px] font-black text-[#0D233A] leading-none">
        {valor}
        {unidade && <span className="text-[11px] font-bold text-slate-400 ml-1">{unidade}</span>}
      </p>
    </div>
  );
}

/* ----------------------------------------------------- gráfico genérico --- */

/**
 * Um gráfico de barras para QUALQUER grupo de indicadores, sem saber o nome
 * de nenhum deles de antemão.
 *
 * A pirâmide etária, a composição por raça e o saneamento são leituras
 * PRECISAS, mas dependem de acertar o texto exato que a fonte usa — e a
 * fonte é de fora, o texto muda de estado para estado, e às vezes o padrão
 * não bate. Quando isso acontece, a seção correspondente some (é a regra: um
 * gráfico com metade do dado é pior que gráfico nenhum) — mas sumir tudo não
 * pode ser a experiência inteira. Este gráfico não lê rótulo nenhum: pega os
 * indicadores numéricos que o grupo realmente tem e desenha, sempre.
 */
function GraficoDoGrupo({ titulo, itens }: { titulo?: string; itens: IndicadorDoCenso[]; key?: string }) {
  const comValor = itens
    .filter((i) => i.valor !== null && (i.valor as number) > 0)
    .sort((a, b) => (b.valor as number) - (a.valor as number))
    .slice(0, 12);

  // Um indicador só não é comparação nenhuma — a barra ficaria sozinha.
  if (comValor.length < 2) return null;

  const maior = Math.max(...comValor.map((i) => i.valor as number));
  const mesmaUnidade = comValor.every((i) => i.unidade === comValor[0].unidade);

  return (
    <div className="rounded-xl border border-slate-100 p-3.5">
      {titulo && <p className="text-[11.5px] font-black text-[#0D233A] mb-3">{titulo}</p>}
      <div className="space-y-2">
        {comValor.map((indicador) => (
          <div key={indicador.id}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10.5px] font-bold text-slate-600 truncate">
                {indicador.rotulo}
              </span>
              <span className="text-[10.5px] font-black text-[#0D233A] shrink-0 tabular-nums">
                {(indicador.valor as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                {mesmaUnidade ? '' : ` ${indicador.unidade}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#015FC9]"
                style={{ width: `${Math.max(2, ((indicador.valor as number) / maior) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {mesmaUnidade && comValor[0].unidade && (
        <p className="mt-2.5 text-[9.5px] font-semibold text-slate-400">
          Valores em {comValor[0].unidade}.
        </p>
      )}
    </div>
  );
}

/* =============================================================== painel === */

export default function PainelDoCenso({
  censo,
  populacaoDoRecorte,
  domiciliosDoRecorte,
  onVerSetores
}: {
  censo: IndicadoresDoRecorte;
  /** População do recorte, vinda do cadastro — não de um indicador. */
  populacaoDoRecorte: number | null;
  /** Domicílios do recorte, mesma origem. */
  domiciliosDoRecorte: number | null;
  /** "Registros territoriais": pula para a lista de setores deste recorte. */
  onVerSetores?: () => void;
}) {
  const [categoria, setCategoria] = useState<string>('geral');
  const [busca, setBusca] = useState('');
  const [explorarAberto, setExplorarAberto] = useState(false);
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);

  const lista = useMemo(() => achatar(censo.grupos), [censo.grupos]);

  const piramide = useMemo(() => lerPiramide(lista), [lista]);
  const raca = useMemo(() => lerRaca(lista), [lista]);
  const saneamento = useMemo(() => lerSaneamento(lista), [lista]);

  const homens = acharPorRotulo(lista, /^homens$/);
  const mulheres = acharPorRotulo(lista, /^mulheres$/);
  const envelhecimento = acharPorRotulo(lista, /envelhecimento/);
  const alfabetizacao =
    lista.find(
      (i) => i.valor !== null && /alfabetiz/.test(semAcento(i.rotulo)) && semAcento(i.rotulo).includes('15')
    ) || acharPorRotulo(lista, /alfabetiz/);

  const populacao =
    populacaoDoRecorte ?? acharPorRotulo(lista, /^populacao( total)?$/)?.valor ?? null;
  const domicilios =
    domiciliosDoRecorte ?? acharPorRotulo(lista, /^domicilios( total)?$/)?.valor ?? null;

  /*
   * Homens/mulheres em percentual, não em contagem.
   *
   * O Censo às vezes publica os dois já em '%', às vezes em pessoas. Quando
   * vem em pessoas, a conta é feita aqui contra a soma dos dois — nunca contra
   * a população total do recorte, que pode incluir gente sem sexo declarado e
   * faria os dois lados não somarem 100%.
   */
  const percentualPorSexo = (indicador: typeof homens) => {
    if (!indicador) return null;
    if (indicador.unidade === '%') return indicador.valor as number;
    const soma = (homens?.valor || 0) + (mulheres?.valor || 0);
    return soma > 0 ? ((indicador.valor as number) / soma) * 100 : null;
  };

  const percentualHomens = percentualPorSexo(homens);
  const percentualMulheres = percentualPorSexo(mulheres);

  /*
   * A etiqueta do cartão é curta de propósito: "censo", não o nome completo
   * da pesquisa. É selo de origem, para quando este painel ganhar uma segunda
   * fonte de dado — não é o lugar de repetir o que o cabeçalho já disse.
   */
  const fonteRotulo = 'censo';

  /* ---------------------------------------------------------- categorias --- */
  const categorias = [
    { id: 'geral', rotulo: 'Visão geral' },
    ...censo.grupos.map((g) => ({ id: g.id, rotulo: g.titulo }))
  ];

  /* --------------------------------------------------------------- busca --- */
  const buscaNormalizada = semAcento(busca);
  const resultadosDaBusca = buscaNormalizada
    ? lista.filter((i) => semAcento(i.rotulo).includes(buscaNormalizada))
    : [];

  const maiorFaixa = Math.max(
    1,
    ...piramide.map((f) => (f.homens || 0) + (f.mulheres || 0))
  );
  const totalPiramide = piramide.reduce((s, f) => s + (f.homens || 0) + (f.mulheres || 0), 0);

  const grupoSelecionado = censo.grupos.find((g) => g.id === categoria);

  return (
    <div>
      {/* ---------------------------------------------------------- busca --- */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar um indicador deste recorte..."
          className="w-full h-9 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-[11.5px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#015FC9]/20 focus:bg-white"
        />
      </div>

      {/* ---------------------------------------------------- resultado da busca --- */}
      {buscaNormalizada ? (
        <div className="mt-3 rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
          {resultadosDaBusca.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] font-bold text-slate-400">
              Nada encontrado para "{busca}".
            </p>
          ) : (
            resultadosDaBusca.map((indicador) => (
              <div key={`${indicador.grupoId}-${indicador.id}`}>
                <p className="px-3 pt-2 text-[9px] font-black uppercase tracking-wider text-slate-300">
                  {indicador.grupoTitulo}
                </p>
                <LinhaDeIndicador indicador={indicador} />
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* -------------------------------------------------- categorias --- */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`px-3 h-7 rounded-lg text-[10.5px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                  categoria === c.id
                    ? 'bg-[#015FC9] text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {c.rotulo}
              </button>
            ))}
          </div>

          {categoria === 'geral' ? (
            <div className="mt-3 space-y-4">
              {/* --------------------------------------------- cartões --- */}
              <div className="grid grid-cols-2 gap-2">
                <CartaoDeNumero rotulo="População" valor={numero(populacao)} fonte={fonteRotulo} />
                <CartaoDeNumero rotulo="Domicílios" valor={numero(domicilios)} fonte={fonteRotulo} />
                {percentualHomens !== null && (
                  <CartaoDeNumero
                    rotulo="Homens"
                    valor={porcento(percentualHomens / 100)}
                    fonte={fonteRotulo}
                  />
                )}
                {percentualMulheres !== null && (
                  <CartaoDeNumero
                    rotulo="Mulheres"
                    valor={porcento(percentualMulheres / 100)}
                    fonte={fonteRotulo}
                  />
                )}
                {envelhecimento && (
                  <CartaoDeNumero
                    rotulo="Envelhecimento"
                    valor={(envelhecimento.valor as number).toLocaleString('pt-BR', {
                      maximumFractionDigits: 1
                    })}
                    fonte={fonteRotulo}
                  />
                )}
                {alfabetizacao && (
                  <CartaoDeNumero
                    rotulo="Alfabetização (15+)"
                    valor={porcento((alfabetizacao.valor as number) / (alfabetizacao.unidade === '%' ? 100 : 1))}
                    fonte={fonteRotulo}
                  />
                )}
              </div>

              {/* -------------------------------------------- pirâmide --- */}
              {piramide.length > 0 && (
                <div className="rounded-xl border border-slate-100 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11.5px] font-black text-[#0D233A]">Perfil etário</p>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider">
                      <span className="flex items-center gap-1 text-[#015FC9]">
                        <span className="w-2 h-2 rounded-full bg-[#015FC9]" />
                        {percentualHomens !== null ? porcento(percentualHomens / 100) : 'Homens'}
                      </span>
                      <span className="flex items-center gap-1 text-rose-600">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        {percentualMulheres !== null ? porcento(percentualMulheres / 100) : 'Mulheres'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    {piramide.map((faixa) => {
                      const largH = ((faixa.homens || 0) / maiorFaixa) * 100;
                      const largM = ((faixa.mulheres || 0) / maiorFaixa) * 100;
                      return (
                        <div key={faixa.chave} className="flex items-center gap-1.5">
                          <div className="flex-1 flex justify-end">
                            <div
                              className="h-3.5 bg-[#015FC9] rounded-l"
                              style={{ width: `${largH}%` }}
                              title={`Homens · ${faixa.rotulo}: ${numero(faixa.homens)}`}
                            />
                          </div>
                          <span className="shrink-0 w-16 text-center text-[9.5px] font-bold text-slate-400">
                            {faixa.rotulo}
                          </span>
                          <div className="flex-1">
                            <div
                              className="h-3.5 bg-rose-500 rounded-r"
                              style={{ width: `${largM}%` }}
                              title={`Mulheres · ${faixa.rotulo}: ${numero(faixa.mulheres)}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2.5 text-[9.5px] font-semibold text-slate-400 leading-snug">
                    Barras proporcionais à maior faixa ({numero(maiorFaixa)} pessoas
                    {totalPiramide > 0 && `, de ${numero(totalPiramide)} contabilizadas nas faixas`}
                    ).
                  </p>
                </div>
              )}

              {/* -------------------------------------------- cor/raça --- */}
              {raca.length > 0 && (
                <div className="rounded-xl border border-slate-100 p-3.5">
                  <p className="text-[11.5px] font-black text-[#0D233A]">Composição por cor ou raça</p>
                  {(() => {
                    const total = raca.reduce((s, f) => s + f.valor, 0);
                    return (
                      <>
                        <div className="mt-3 h-3 rounded-full overflow-hidden flex bg-slate-100">
                          {raca.map((fatia) => (
                            <div
                              key={fatia.categoria}
                              style={{
                                width: `${(fatia.valor / total) * 100}%`,
                                backgroundColor: CORES_RACA[semAcento(fatia.categoria)] || '#94A3B8'
                              }}
                              title={`${fatia.categoria}: ${porcento(fatia.valor / total)}`}
                            />
                          ))}
                        </div>
                        <div className="mt-2.5 space-y-1">
                          {raca.map((fatia) => (
                            <div key={fatia.categoria} className="flex items-center gap-2 text-[10.5px]">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: CORES_RACA[semAcento(fatia.categoria)] || '#94A3B8' }}
                              />
                              <span className="font-bold text-slate-600 flex-1">{fatia.categoria}</span>
                              <span className="font-black text-[#0D233A]">
                                {porcento(fatia.valor / total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ------------------------------------------ saneamento --- */}
              {saneamento.length > 0 && (
                <div className="rounded-xl border border-slate-100 p-3.5">
                  <p className="text-[11.5px] font-black text-[#0D233A]">Saneamento básico</p>
                  <div className="mt-3 space-y-2.5">
                    {saneamento.map((item) => {
                      const fracao = item.unidade === '%' ? item.valor / 100 : null;
                      return (
                        <div key={item.rotulo}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10.5px] font-bold text-slate-600 truncate">
                              {item.rotulo}
                            </span>
                            <span className="text-[10.5px] font-black text-[#0D233A] shrink-0">
                              {fracao !== null
                                ? porcento(fracao)
                                : `${numero(item.valor)} ${item.unidade}`}
                            </span>
                          </div>
                          {fracao !== null && (
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${Math.min(100, fracao * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/*
                FALLBACK: nenhum dos três gráficos curados bateu.

                Pirâmide, raça e saneamento dependem de acertar o texto exato
                que esta fonte usa, e às vezes não bate. Quando isso acontece
                para os três de uma vez, a resposta não pode ser "visão geral
                sem gráfico nenhum" — é o próprio motivo de existir da tela.
                Desenha-se então um gráfico de cada um dos dois primeiros
                grupos que a fonte realmente mandou, sem tentar adivinhar o
                que eles significam: os números que existem, do jeito que
                vieram.
              */}
              {piramide.length === 0 && raca.length === 0 && saneamento.length === 0 && (
                <>
                  {censo.grupos.slice(0, 2).map((grupo) => (
                    <GraficoDoGrupo
                      key={grupo.id}
                      titulo={grupo.titulo}
                      itens={[...grupo.principais, ...grupo.detalhes]}
                    />
                  ))}
                </>
              )}

              {/* ------------------------------------------- explorar --- */}
              <button
                type="button"
                onClick={() => setExplorarAberto((v) => !v)}
                className="w-full h-10 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                Explorar todos os indicadores
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${explorarAberto ? 'rotate-90' : ''}`}
                />
              </button>

              {explorarAberto && (
                <div className="space-y-2">
                  {censo.grupos.map((grupo) => {
                    const aberto2 = grupoAberto === grupo.id;
                    const itens = aberto2 ? [...grupo.principais, ...grupo.detalhes] : grupo.principais;
                    return (
                      <div key={grupo.id} className="rounded-xl border border-slate-100 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setGrupoAberto(aberto2 ? null : grupo.id)}
                          className="w-full px-3 py-2 bg-slate-50/60 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100/60"
                        >
                          <span className="text-[11.5px] font-black text-[#0D233A]">{grupo.titulo}</span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                              aberto2 ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                        <div className="divide-y divide-slate-50">
                          {itens.map((indicador) => (
                            <LinhaDeIndicador key={indicador.id} indicador={indicador} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* --------------------------------------------- rodapé --- */}
              <button
                type="button"
                onClick={onVerSetores}
                disabled={!onVerSetores}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:hover:bg-slate-50 disabled:cursor-default text-left cursor-pointer transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <Users2 className="w-4 h-4 text-slate-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Registros territoriais
                  </span>
                  <span className="block text-[11.5px] font-bold text-slate-600">
                    Recorte com {numero(censo.totalSetores)} setores cadastrados
                  </span>
                </span>
                {onVerSetores && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
              </button>
            </div>
          ) : (
            /* --------------------------------------- uma categoria só --- */
            <div className="mt-3 space-y-3">
              {grupoSelecionado ? (
                <>
                  {/*
                    O gráfico da categoria: os números dela, comparados, sem
                    precisar que o rótulo bata em nenhum padrão conhecido.
                  */}
                  <GraficoDoGrupo
                    itens={[...grupoSelecionado.principais, ...grupoSelecionado.detalhes]}
                  />
                  <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                    {[...grupoSelecionado.principais, ...grupoSelecionado.detalhes].map(
                      (indicador) => (
                        <LinhaDeIndicador key={indicador.id} indicador={indicador} />
                      )
                    )}
                  </div>
                </>
              ) : (
                <p className="px-3 py-6 text-center text-[11px] font-bold text-slate-400">
                  Categoria sem indicadores neste recorte.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
