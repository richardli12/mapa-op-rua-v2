import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { GrupoDeIndicadores, IndicadorDoCenso, IndicadoresDoRecorte } from '../../services/territorio';

/**
 * A visão geral do Censo: o painel de indicadores.
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
 *
 * DIRETO E DERIVADO ESTÃO NA TELA, NÃO SÓ NO CÓDIGO.
 *
 * Todo número carrega o selo da sua origem: o do instituto quando veio
 * publicado ("IBGE"), "derivado" quando foi calculado a partir de outros.
 * São confiabilidades diferentes, e quem decide alguma coisa olhando para
 * eles precisa saber qual está olhando.
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

/** O jeito de escrever um valor de indicador: uma casa, e o '%' colado. */
const valorComUnidade = (valor: number, unidade: string) => {
  const escrito = valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (!unidade) return escrito;
  return unidade === '%' ? `${escrito}%` : `${escrito} ${unidade}`;
};

const porcento = (fracao: number, casas = 1) =>
  `${(fracao * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  })}%`;

type IndicadorComGrupo = IndicadorDoCenso & { grupoId: string; grupoTitulo: string };

/** Todo indicador de todos os grupos, numa lista só, com o grupo de origem junto. */
function achatar(grupos: GrupoDeIndicadores[]): IndicadorComGrupo[] {
  return grupos.flatMap((grupo) =>
    [...grupo.principais, ...grupo.detalhes].map((indicador) => ({
      ...indicador,
      grupoId: grupo.id,
      grupoTitulo: grupo.titulo
    }))
  );
}

/** O primeiro indicador cujo rótulo bate no padrão, com valor numérico. */
function acharPorRotulo(lista: IndicadorComGrupo[], padrao: RegExp): IndicadorComGrupo | null {
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
 *
 * A ordem na tela é a da pirâmide impressa: os mais velhos em cima.
 */
function lerPiramide(lista: IndicadorComGrupo[]): FaixaEtaria[] {
  const PADRAO = /^(homens|mulheres)\s+(?:de\s+(\d+)\s+a\s+(\d+)\s+anos?|com\s+(\d+)\s+anos?\s+ou\s+mais)$/;
  const porFaixa = new Map<string, FaixaEtaria>();

  lista.forEach((indicador) => {
    const m = PADRAO.exec(semAcento(indicador.rotulo));
    if (!m || indicador.valor === null) return;
    const sexo = m[1];
    const inicio = Number(m[2] ?? m[4]);
    const fim = m[3] ?? null;
    const chave = fim ? `${inicio}-${fim}` : `${inicio}+`;
    const rotulo = fim ? `${inicio} a ${fim}` : `${inicio} ou +`;

    const atual = porFaixa.get(chave) || { chave, rotulo, inicio, homens: null, mulheres: null };
    if (sexo === 'homens') atual.homens = indicador.valor;
    else atual.mulheres = indicador.valor;
    porFaixa.set(chave, atual);
  });

  return Array.from(porFaixa.values())
    .filter((f) => f.homens !== null || f.mulheres !== null)
    .sort((a, b) => b.inicio - a.inicio);
}

/* ------------------------------------------------------------ cor ou raça --- */

interface FatiaDeRaca {
  categoria: string;
  valor: number;
}

const CORES_RACA: { [chave: string]: string } = {
  parda: '#B4763C',
  branca: '#3B82F6',
  preta: '#1F2937',
  indigena: '#0D9488',
  amarela: '#EAB308'
};

/** "Cor ou raça parda" → { categoria: "Parda", valor }. Só as cinco do Censo. */
function lerRaca(lista: IndicadorComGrupo[]): FatiaDeRaca[] {
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
  indicador: IndicadorComGrupo;
  /** Como o nome aparece na barra — ver `lerSaneamento`. */
  rotulo: string;
  cor: string;
}

/**
 * Água, esgoto e coleta de lixo — um indicador de cada, o mais "adequado".
 *
 * Cada tema costuma vir com mais de uma variante (água de rede geral, de
 * poço...). Preferimos a que descreve o serviço formal ("rede geral",
 * "coletora", "serviço de limpeza"); na falta dela, a primeira que bater no
 * tema, para a seção não sumir por causa de uma palavra que a fonte não usou.
 */
function lerSaneamento(lista: IndicadorComGrupo[]): ItemDeSaneamento[] {
  const TEMAS: { tema: RegExp; preferido: RegExp; curto: string; cor: string }[] = [
    { tema: /agua/, preferido: /rede geral/, curto: 'Água por rede geral', cor: '#2563EB' },
    {
      tema: /esgot/,
      preferido: /rede (geral|coletora)|coletora/,
      curto: 'Esgoto em rede geral ou pluvial',
      cor: '#0D9488'
    },
    {
      tema: /lixo/,
      preferido: /servi[cç]o|coletad/,
      curto: 'Coleta de lixo por serviço',
      cor: '#16A34A'
    }
  ];

  const itens: ItemDeSaneamento[] = [];
  TEMAS.forEach(({ tema, preferido, curto, cor }) => {
    const doTema = lista.filter((i) => i.valor !== null && tema.test(semAcento(i.rotulo)));
    if (doTema.length === 0) return;
    const oPreferido = doTema.find((i) => preferido.test(semAcento(i.rotulo)));
    /*
      O nome curto só vale quando a variante preferida é a que veio.

      "Água por rede geral de distribuição" cabe bem como "Água por rede
      geral" — mas só porque sabemos QUAL indicador é esse. Se o padrão não
      bateu e caímos no primeiro do tema, ele pode ser "Água de poço ou
      nascente": encurtar ali seria trocar o rótulo da fonte por um que diz
      outra coisa.
    */
    itens.push({
      indicador: oPreferido || doTema[0],
      rotulo: oPreferido ? curto : doTema[0].rotulo,
      cor
    });
  });
  return itens;
}

/* ------------------------------------------------------------------ peças --- */

const DICA_DERIVADO =
  'Derivado: não vem publicado assim. É calculado aqui a partir dos números do Censo deste recorte.';

/**
 * O selo de origem do número.
 *
 * Verde e curto para o que o instituto publicou; azul e com o "i" para o que
 * foi calculado. É a diferença entre "está escrito lá" e "a conta é nossa".
 */
function Selo({ origem, instituto }: { origem: 'direto' | 'derivado'; instituto: string }) {
  if (origem === 'derivado') {
    return (
      <span
        title={DICA_DERIVADO}
        className="shrink-0 inline-flex items-center gap-1 px-[5px] py-[3px] rounded-[5px] bg-[#F0F9FF] text-[#1575B0] text-[8px] font-bold leading-none"
      >
        derivado
        <Info className="w-[10px] h-[10px]" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      title={`Publicado pelo ${instituto} para este recorte.`}
      className="shrink-0 inline-flex items-center px-[5px] py-[3px] rounded-[5px] bg-[#ECFDF5] text-[#188765] text-[8px] font-bold leading-none"
    >
      {instituto}
    </span>
  );
}

/** Cartão branco: a moldura de toda seção da visão geral. */
function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[14px] bg-white border border-slate-100 shadow-[0_1px_2px_rgba(15,23,43,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function TituloDeCartao({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] font-bold text-[#0F172B]">{children}</p>;
}

/** Um cartão de número, para a grade de "visão geral". */
function CartaoDeNumero({
  rotulo,
  valor,
  origem,
  instituto
}: {
  rotulo: string;
  valor: string;
  origem: 'direto' | 'derivado';
  instituto: string;
}) {
  return (
    <Cartao className="p-3.5">
      {/*
        Rótulo e selo no mesmo fluxo, de propósito: em "População" o selo cabe
        na linha do rótulo, em "Alfabetização (15+)" ele desce sozinho. É a
        quebra natural do texto fazendo o trabalho que uma grade fixa faria
        pior num painel que muda de largura.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-[11px] text-[#62748E] leading-tight">{rotulo}</p>
        <Selo origem={origem} instituto={instituto} />
      </div>
      <p className="mt-1.5 text-[20px] font-bold text-[#0F172B] leading-none tracking-tight">
        {valor}
      </p>
    </Cartao>
  );
}

/** Uma linha de indicador: rótulo, aviso de soma parcial, valor e selo. */
function LinhaDeIndicador({
  indicador,
  instituto
}: {
  indicador: IndicadorDoCenso;
  instituto: string;
  key?: string;
}) {
  return (
    <div className="py-3 flex items-start justify-between gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-[#45556C] leading-snug">{indicador.rotulo}</span>
        {indicador.setoresSemDado > 0 && (
          <span className="block mt-0.5 text-[11.5px] text-[#C05A13] leading-snug">
            Soma parcial — {numero(indicador.setoresSemDado)} setores sem dado
          </span>
        )}
      </span>
      <span className="shrink-0 flex items-center gap-2 pt-[1px]">
        {indicador.valor === null ? (
          <span className="text-[11.5px] text-slate-400 italic">
            {indicador.motivoIndisponivel === 'sem-dado-na-fonte'
              ? 'não divulgado'
              : indicador.motivoIndisponivel === 'denominador-zero'
                ? 'sem denominador aqui'
                : 'sem dado'}
          </span>
        ) : (
          <span className="text-[13px] font-bold text-[#0F172B] whitespace-nowrap">
            {valorComUnidade(indicador.valor, indicador.unidade)}
          </span>
        )}
        <Selo origem={indicador.origem} instituto={instituto} />
      </span>
    </div>
  );
}

/** Uma seção da lista completa: título de grupo e as linhas dele. */
function SecaoDeIndicadores({
  titulo,
  itens,
  instituto
}: {
  titulo: string;
  itens: IndicadorDoCenso[];
  instituto: string;
  key?: string;
}) {
  if (itens.length === 0) return null;
  return (
    <Cartao className="px-4 py-3.5">
      <p className="text-[11.5px] font-bold uppercase tracking-wider text-[#62748E]">{titulo}</p>
      <div className="mt-1 divide-y divide-slate-100">
        {itens.map((indicador) => (
          <LinhaDeIndicador key={indicador.id} indicador={indicador} instituto={instituto} />
        ))}
      </div>
    </Cartao>
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
function GraficoDoGrupo({
  titulo,
  itens
}: {
  titulo?: string;
  itens: IndicadorDoCenso[];
  key?: string;
}) {
  const comValor = itens
    .filter((i) => i.valor !== null && (i.valor as number) > 0)
    .sort((a, b) => (b.valor as number) - (a.valor as number))
    .slice(0, 12);

  // Um indicador só não é comparação nenhuma — a barra ficaria sozinha.
  if (comValor.length < 2) return null;

  const maior = Math.max(...comValor.map((i) => i.valor as number));
  const mesmaUnidade = comValor.every((i) => i.unidade === comValor[0].unidade);

  return (
    <Cartao className="p-4">
      {titulo && <TituloDeCartao>{titulo}</TituloDeCartao>}
      <div className={titulo ? 'mt-3.5 space-y-2.5' : 'space-y-2.5'}>
        {comValor.map((indicador) => (
          <div key={indicador.id} className="flex items-center gap-2.5">
            <span className="w-[36%] shrink-0 text-[12px] text-[#45556C] truncate">
              {indicador.rotulo}
            </span>
            <span className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
              <span
                className="block h-full rounded-full bg-[#2563EB]"
                style={{ width: `${Math.max(2, ((indicador.valor as number) / maior) * 100)}%` }}
              />
            </span>
            <span className="shrink-0 text-[12.5px] font-bold text-[#0F172B] tabular-nums">
              {(indicador.valor as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              {mesmaUnidade ? '' : ` ${indicador.unidade}`}
            </span>
          </div>
        ))}
      </div>
      {mesmaUnidade && comValor[0].unidade && (
        <p className="mt-3 text-[11px] text-slate-400">Valores em {comValor[0].unidade}.</p>
      )}
    </Cartao>
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
  const [explorarAberto, setExplorarAberto] = useState(false);

  const lista = useMemo(() => achatar(censo.grupos), [censo.grupos]);

  const piramide = useMemo(() => lerPiramide(lista), [lista]);
  const raca = useMemo(() => lerRaca(lista), [lista]);
  const saneamento = useMemo(() => lerSaneamento(lista), [lista]);

  /** Quem publicou: é o que vai no selo verde. */
  const instituto = censo.fonte?.instituto || 'IBGE';

  const homens = acharPorRotulo(lista, /^homens$/);
  const mulheres = acharPorRotulo(lista, /^mulheres$/);
  const envelhecimento = acharPorRotulo(lista, /envelhecimento/);
  const alfabetizacao =
    lista.find(
      (i) => i.valor !== null && /alfabetiz/.test(semAcento(i.rotulo)) && semAcento(i.rotulo).includes('15')
    ) || acharPorRotulo(lista, /alfabetiz/);

  /*
   * O indicador por trás do cartão, quando ele existe.
   *
   * O número grande continua vindo do cadastro do recorte (é ele que não
   * depende de rótulo), mas o selo precisa dizer de onde aquele número veio —
   * e quem sabe isso é o indicador correspondente na lista.
   */
  const populacaoIndicador = acharPorRotulo(lista, /morador|^populacao( total| residente)?$/);
  const domiciliosIndicador = acharPorRotulo(
    lista,
    /^domicilios particulares permanentes ocupados$|^domicilios( total)?$|domicilios particulares/
  );

  const populacao = populacaoDoRecorte ?? populacaoIndicador?.valor ?? null;
  const domicilios = domiciliosDoRecorte ?? domiciliosIndicador?.valor ?? null;

  /*
   * Homens/mulheres em percentual, não em contagem.
   *
   * O Censo às vezes publica os dois já em '%', às vezes em pessoas. Quando
   * vem em pessoas, a conta é feita aqui contra a soma dos dois — nunca contra
   * a população total do recorte, que pode incluir gente sem sexo declarado e
   * faria os dois lados não somarem 100%.
   */
  const percentualPorSexo = (indicador: IndicadorComGrupo | null) => {
    if (!indicador) return null;
    if (indicador.unidade === '%') return indicador.valor as number;
    const soma = (homens?.valor || 0) + (mulheres?.valor || 0);
    return soma > 0 ? ((indicador.valor as number) / soma) * 100 : null;
  };

  const percentualHomens = percentualPorSexo(homens);
  const percentualMulheres = percentualPorSexo(mulheres);

  /* ---------------------------------------------------------- categorias --- */
  const categorias = [
    { id: 'geral', rotulo: 'Visão geral' },
    ...censo.grupos.map((g) => ({ id: g.id, rotulo: g.titulo }))
  ];

  const maiorFaixa = Math.max(
    1,
    ...piramide.map((f) => Math.max(f.homens || 0, f.mulheres || 0))
  );

  const grupoSelecionado = censo.grupos.find((g) => g.id === categoria);

  /*
   * A seção "Visão geral" da lista completa.
   *
   * São os indicadores que estão por trás do que a tela mostrou em cartão e
   * em gráfico — os mesmos números, agora com rótulo inteiro, unidade e o
   * aviso de soma parcial. Sem ela, "explorar todos os indicadores" abriria
   * direto nos grupos e deixaria de fora justamente o que a pessoa acabou de
   * ver.
   */
  const indicadoresDaVisaoGeral = useMemo(() => {
    const escolhidos = [
      populacaoIndicador,
      domiciliosIndicador,
      envelhecimento,
      alfabetizacao,
      ...saneamento.map((s) => s.indicador)
    ].filter((i): i is IndicadorComGrupo => Boolean(i));
    const vistos = new Set<string>();
    return escolhidos.filter((i) => (vistos.has(i.id) ? false : (vistos.add(i.id), true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [populacaoIndicador?.id, domiciliosIndicador?.id, envelhecimento?.id, alfabetizacao?.id, saneamento]);

  /** O rodapé de contagem de setores, igual nas duas visões. */
  const rodape = censo.totalSetores !== null && (
    <p className="px-0.5 text-[11px] text-slate-400">
      Recorte com {numero(censo.totalSetores)} setores censitários.
    </p>
  );

  return (
    <div>
      {/* ------------------------------------------------------ categorias --- */}
      {/*
        A faixa das categorias fica branca e colada no topo enquanto o resto
        rola: é a única coisa desta tela que responde "o que estou vendo", e
        perdê-la de vista no meio de uma lista de cinquenta indicadores é
        perder o fio.
      */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3.5 pt-1 pb-3.5">
        <div className="grid grid-cols-3 gap-x-1.5 gap-y-2.5">
          {categorias.map((c) => {
            const ativa = categoria === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                title={c.rotulo}
                className={`h-7 px-2 rounded-[9px] border text-[12px] leading-tight truncate cursor-pointer transition-colors ${
                  ativa
                    ? 'bg-[#EFF6FF] border-[#BEDBFF] text-[#1447E6] font-semibold'
                    : 'bg-white border-slate-200 text-[#45556C] hover:bg-slate-50'
                }`}
              >
                {c.rotulo}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3.5 py-3">
        {categoria === 'geral' ? (
          <div className="space-y-2.5">
            {/* ------------------------------------------------- cartões --- */}
            <div className="grid grid-cols-3 gap-1">
              <CartaoDeNumero
                rotulo="População"
                valor={numero(populacao)}
                origem={populacaoDoRecorte !== null ? 'direto' : populacaoIndicador?.origem || 'direto'}
                instituto={instituto}
              />
              <CartaoDeNumero
                rotulo="Domicílios"
                valor={numero(domicilios)}
                origem={domiciliosDoRecorte !== null ? 'direto' : domiciliosIndicador?.origem || 'direto'}
                instituto={instituto}
              />
              {percentualHomens !== null && (
                <CartaoDeNumero
                  rotulo="Homens"
                  valor={porcento(percentualHomens / 100)}
                  origem="derivado"
                  instituto={instituto}
                />
              )}
              {percentualMulheres !== null && (
                <CartaoDeNumero
                  rotulo="Mulheres"
                  valor={porcento(percentualMulheres / 100)}
                  origem="derivado"
                  instituto={instituto}
                />
              )}
              {envelhecimento && (
                <CartaoDeNumero
                  rotulo="Envelhecimento"
                  valor={(envelhecimento.valor as number).toLocaleString('pt-BR', {
                    maximumFractionDigits: 1
                  })}
                  origem={envelhecimento.origem}
                  instituto={instituto}
                />
              )}
              {alfabetizacao && (
                <CartaoDeNumero
                  rotulo="Alfabetização (15+)"
                  valor={porcento(
                    (alfabetizacao.valor as number) / (alfabetizacao.unidade === '%' ? 100 : 1)
                  )}
                  origem={alfabetizacao.origem}
                  instituto={instituto}
                />
              )}
            </div>

            {/* ------------------------------------------------ pirâmide --- */}
            {piramide.length > 0 && (
              <Cartao className="p-4">
                <TituloDeCartao>Perfil etário</TituloDeCartao>
                <div className="mt-3 flex items-center justify-between gap-2 text-[12px] font-semibold">
                  <span className="text-[#2563EB]">
                    Homens {percentualHomens !== null ? porcento(percentualHomens / 100) : ''}
                  </span>
                  <span className="text-[#E8467C]">
                    Mulheres {percentualMulheres !== null ? porcento(percentualMulheres / 100) : ''}
                  </span>
                </div>

                <div className="mt-3 space-y-[2px]">
                  {piramide.map((faixa) => {
                    const largH = ((faixa.homens || 0) / maiorFaixa) * 100;
                    const largM = ((faixa.mulheres || 0) / maiorFaixa) * 100;
                    return (
                      <div key={faixa.chave} className="flex items-center h-[9px]">
                        <div className="flex-1 flex justify-end">
                          <div
                            className="h-[9px] bg-[#2563EB] rounded-l-[2px]"
                            style={{ width: `${largH}%` }}
                            title={`Homens · ${faixa.rotulo}: ${numero(faixa.homens)}`}
                          />
                        </div>
                        <span className="shrink-0 w-[66px] text-center text-[10px] leading-none text-[#62748E]">
                          {faixa.rotulo}
                        </span>
                        <div className="flex-1">
                          <div
                            className="h-[9px] bg-[#E8467C] rounded-r-[2px]"
                            style={{ width: `${largM}%` }}
                            title={`Mulheres · ${faixa.rotulo}: ${numero(faixa.mulheres)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  Barras proporcionais à maior faixa ({numero(maiorFaixa)} pessoas).
                </p>
              </Cartao>
            )}

            {/* ------------------------------------------------ cor/raça --- */}
            {raca.length > 0 &&
              (() => {
                const total = raca.reduce((s, f) => s + f.valor, 0);
                return (
                  <Cartao className="p-4">
                    <TituloDeCartao>Composição por cor ou raça</TituloDeCartao>
                    <div className="mt-3.5 h-[15px] rounded-full overflow-hidden flex bg-slate-100">
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
                    <div className="mt-3 space-y-1.5">
                      {raca.map((fatia) => (
                        <div key={fatia.categoria} className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: CORES_RACA[semAcento(fatia.categoria)] || '#94A3B8'
                            }}
                          />
                          <span className="flex-1 min-w-0 truncate text-[12px] text-[#45556C]">
                            {fatia.categoria}
                          </span>
                          <span className="shrink-0 text-[12px] text-slate-400 tabular-nums">
                            {numero(fatia.valor)}
                          </span>
                          <span className="shrink-0 w-11 text-right text-[12px] font-bold text-[#0F172B] tabular-nums">
                            {porcento(fatia.valor / total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Cartao>
                );
              })()}

            {/* ---------------------------------------------- saneamento --- */}
            {saneamento.length > 0 && (
              <Cartao className="p-4">
                <TituloDeCartao>Saneamento básico</TituloDeCartao>
                <div className="mt-3.5 space-y-2.5">
                  {saneamento.map(({ indicador, rotulo, cor }) => {
                    const fracao = indicador.unidade === '%' ? (indicador.valor as number) / 100 : null;
                    return (
                      <div key={indicador.id} className="flex items-center gap-2.5">
                        <span
                          className="w-[36%] shrink-0 text-[12px] text-[#45556C] truncate"
                          title={indicador.rotulo}
                        >
                          {rotulo}
                        </span>
                        <span className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                          {fracao !== null && (
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(2, fracao * 100))}%`,
                                backgroundColor: cor
                              }}
                            />
                          )}
                        </span>
                        <span className="shrink-0 text-[12.5px] font-bold text-[#0F172B] tabular-nums">
                          {fracao !== null
                            ? porcento(fracao)
                            : valorComUnidade(indicador.valor as number, indicador.unidade)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Cartao>
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

            {/* ------------------------------------------------ explorar --- */}
            <button
              type="button"
              onClick={() => setExplorarAberto((v) => !v)}
              className="w-full rounded-[14px] bg-white border border-slate-100 shadow-[0_1px_2px_rgba(15,23,43,0.04)] px-4 h-[46px] flex items-center gap-2.5 cursor-pointer hover:bg-slate-50/70 transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-[#2563EB] shrink-0" />
              <span className="flex-1 text-left text-[12.5px] font-medium text-[#0F172B]">
                {explorarAberto ? 'Ocultar indicadores' : 'Explorar todos os indicadores'}
              </span>
              {explorarAberto ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {explorarAberto && (
              <div className="space-y-2.5">
                <SecaoDeIndicadores
                  titulo="Visão geral"
                  itens={indicadoresDaVisaoGeral}
                  instituto={instituto}
                />
                {censo.grupos.map((grupo) => (
                  <SecaoDeIndicadores
                    key={grupo.id}
                    titulo={grupo.titulo}
                    itens={[...grupo.principais, ...grupo.detalhes]}
                    instituto={instituto}
                  />
                ))}
              </div>
            )}

            {rodape}

            {/* -------------------------------------------------- rodapé --- */}
            {onVerSetores && (
              <button
                type="button"
                onClick={onVerSetores}
                className="w-full rounded-[14px] bg-white border border-slate-100 shadow-[0_1px_2px_rgba(15,23,43,0.04)] px-4 h-[46px] flex items-center gap-2.5 cursor-pointer hover:bg-slate-50/70 transition-colors"
              >
                <span className="flex-1 text-left text-[12.5px] font-medium text-[#0F172B]">
                  Ver os setores deste recorte
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            )}
          </div>
        ) : (
          /* ----------------------------------------- uma categoria só --- */
          <div className="space-y-2.5">
            {grupoSelecionado ? (
              <>
                {/*
                  O gráfico da categoria: os números dela, comparados, sem
                  precisar que o rótulo bata em nenhum padrão conhecido.
                */}
                <GraficoDoGrupo
                  itens={[...grupoSelecionado.principais, ...grupoSelecionado.detalhes]}
                />
                <SecaoDeIndicadores
                  titulo={grupoSelecionado.titulo}
                  itens={[...grupoSelecionado.principais, ...grupoSelecionado.detalhes]}
                  instituto={instituto}
                />
                {rodape}
              </>
            ) : (
              <p className="py-6 text-center text-[12px] text-slate-400">
                Categoria sem indicadores neste recorte.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
