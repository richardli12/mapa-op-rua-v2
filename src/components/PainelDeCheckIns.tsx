import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock,
  Crosshair,
  EyeOff,
  Flag,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Target,
  Users,
  X
} from 'lucide-react';
import { CampaignPin, PanfletagemArea, OperationType, PriorityLevel } from '../types';
import { IconeDoTurno } from './TurnoEPrioridade';
import {
  METAS_VAZIAS,
  MetasDoCliente,
  alvoDe,
  alvoDoDia,
  corDoAvanco,
  janelaDaMeta,
  progressoDaPessoa,
  temMeta
} from '../metas';
import {
  COR_DO_TURNO,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TURNOS,
  TURNOS_PADRAO,
  TurnoId,
  janelaDoTurno,
  turnoDeAgora
} from '../turnos';

/* ------------------------------------------------------------------ cores ---
 * A régua de cor do painel.
 *
 * Magnitude é sempre o mesmo azul, do claro ao escuro: barra de bairro, coluna
 * de dia e barra de pessoa medem a mesma coisa — quantidade — e mudar de cor
 * entre elas só faria o olho procurar significado onde não há.
 *
 * O trio de situação (atrasada, hoje, em dia) é separado e foi conferido no
 * validador de paleta: passa nas distâncias de daltonismo e de visão normal
 * lado a lado. Como amarelo e verde ficam abaixo de 3:1 no fundo claro, cada
 * pedaço da barra sai sempre com número e rótulo escritos — nunca só a cor.
 */
const AZUL = '#015FC9';
const SITUACAO = {
  atrasada: '#dc2626',
  hoje: '#eda100',
  emDia: '#1baf7a',
  semPrazo: '#94a3b8'
};

/** Um dia no formato do calendário, no fuso de quem está olhando. */
const diaISO = (data: Date) => data.toLocaleDateString('sv-SE');

const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return diaISO(d);
};

const diasEntre = (a: string, b: string) =>
  Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000
  );

const curto = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

/** O dia em que um check-in entrou, no fuso de quem está olhando. */
const diaDoCheckIn = (c: any) => {
  const d = new Date(c.createdAt);
  return Number.isNaN(d.getTime()) ? '' : diaISO(d);
};

/** A hora do registro, que é o que separa dois check-ins do mesmo dia. */
const horaDoCheckIn = (c: any) => {
  const d = new Date(c.createdAt);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/** "há 3 dias", "hoje", "ontem" — o jeito que a pessoa conta tempo. */
const desdeQuando = (dias: number) => {
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) return `há ${Math.floor(dias / 7)} sem`;
  return `há ${Math.floor(dias / 30)} ${Math.floor(dias / 30) === 1 ? 'mês' : 'meses'}`;
};

export interface PessoaResolvida {
  chave: string;
  nome: string;
  foto?: string;
  daEquipe: boolean;
}

interface Props {
  aberto: boolean;
  telaCheia: boolean;
  onAlternarTelaCheia: () => void;
  onFechar: () => void;

  /** Check-ins do cliente, ainda sem o corte de período: a comparação precisa do antes. */
  checkIns: any[];
  /** Missões do cliente, também sem corte, pelo mesmo motivo. */
  pins: CampaignPin[];
  areas: PanfletagemArea[];
  equipe: any[];
  operationTypes: OperationType[];
  priorityLevels: PriorityLevel[];
  pessoaDoCheckIn: (c: any) => PessoaResolvida;

  /** O relógio da campanha, para a conta de missões falar em turnos. */
  janelasDeTurno?: JanelaDeTurno[];
  /** As metas do cliente em foco, para a equipe ser lida contra o alvo. */
  metas?: MetasDoCliente;

  /** Recorte ligado na barra de cima. Vazio quer dizer "desde sempre". */
  de: string;
  ate: string;
  rotuloDoPeriodo: string;

  /** Os mesmos filtros do mapa: clicar aqui liga e desliga lá. */
  pessoasSelecionadas: string[];
  onPessoa: (chave: string) => void;
  niveisSelecionados: string[];
  onNivel: (id: string) => void;
  tiposSelecionados: string[];
  onTipo: (id: string) => void;
  onLimparFiltros: () => void;
  /** Leva o mapa até um registro. */
  onIrParaCheckIn: (id: string) => void;
  /** Troca o período de tudo — painel e mapa —, como a barra de cima faz. */
  onPeriodo: (de: string, ate: string) => void;
}

/** Cabeçalho de seção, com o mesmo peso em todas. */
function Secao({
  titulo,
  Icone,
  aviso,
  children
}: {
  titulo: string;
  Icone: typeof Users;
  aviso?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 py-4 border-b border-slate-100">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h4 className="text-[10.5px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5">
          <Icone className="w-3.5 h-3.5" />
          {titulo}
        </h4>
        {aviso && (
          <span className="text-[10px] font-bold text-slate-400 shrink-0">{aviso}</span>
        )}
      </div>
      {children}
    </section>
  );
}

/** A variação contra o período anterior, que é o que se pergunta primeiro. */
function Variacao({ agora, antes }: { agora: number; antes: number }) {
  if (antes === 0 && agora === 0) {
    return <span className="text-[10px] font-bold text-slate-300">sem base</span>;
  }
  if (antes === 0) {
    return (
      <span className="text-[10px] font-black text-slate-500 flex items-center gap-0.5">
        <ArrowUp className="w-3 h-3" />
        novo
      </span>
    );
  }
  const pct = Math.round(((agora - antes) / antes) * 100);
  if (pct === 0) {
    return (
      <span className="text-[10px] font-black text-slate-400 flex items-center gap-0.5">
        <Minus className="w-3 h-3" />
        igual
      </span>
    );
  }
  const subiu = pct > 0;
  return (
    <span
      className={`text-[10px] font-black flex items-center gap-0.5 ${
        subiu ? 'text-[#015FC9]' : 'text-slate-400'
      }`}
      title={`${antes} no período anterior`}
    >
      {subiu ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

/* --------------------------------------------------- atividades da pessoa ---
 * O recorte de tempo, à mão de quem está olhando uma pessoa.
 *
 * Quem abre a ficha de alguém e pede "hoje" está perguntando o que essa
 * pessoa fez hoje — no mapa, não só nesta lista. Um recorte que valesse só
 * aqui dentro deixaria a tela contando duas histórias ao mesmo tempo: a lista
 * com o dia e o mapa com tudo. Então estes botões são os mesmos da barra de
 * cima: mexem no período inteiro — mapa, painel e ficha juntos.
 */
const ATALHOS_DA_PESSOA: { rotulo: string; calcular: () => { de: string; ate: string } }[] = [
  { rotulo: 'Hoje', calcular: () => ({ de: diaISO(new Date()), ate: diaISO(new Date()) }) },
  {
    rotulo: 'Ontem',
    calcular: () => {
      const d = somarDias(diaISO(new Date()), -1);
      return { de: d, ate: d };
    }
  },
  {
    rotulo: '7 dias',
    calcular: () => ({ de: somarDias(diaISO(new Date()), -6), ate: diaISO(new Date()) })
  },
  {
    rotulo: '30 dias',
    calcular: () => ({ de: somarDias(diaISO(new Date()), -29), ate: diaISO(new Date()) })
  },
  {
    rotulo: 'Este mês',
    calcular: () => {
      const agora = new Date();
      return {
        de: diaISO(new Date(agora.getFullYear(), agora.getMonth(), 1)),
        ate: diaISO(agora)
      };
    }
  },
  { rotulo: 'Tudo', calcular: () => ({ de: '', ate: '' }) }
];

function AtividadesDaPessoa({
  chave,
  nome,
  checkIns,
  pessoaDoCheckIn,
  operationTypes,
  priorityLevels,
  de,
  ate,
  rotuloDoPeriodo,
  onPeriodo,
  onIrParaCheckIn
}: {
  chave: string;
  nome: string;
  checkIns: any[];
  pessoaDoCheckIn: (c: any) => PessoaResolvida;
  operationTypes: OperationType[];
  priorityLevels: PriorityLevel[];
  de: string;
  ate: string;
  rotuloDoPeriodo: string;
  onPeriodo: (de: string, ate: string) => void;
  onIrParaCheckIn: (id: string) => void;
}) {
  /* O recorte é o do painel: um só relógio para a tela inteira. */
  const recorte = { de, ate };

  const { dias, total, graves, ultimo } = useMemo(() => {
    const hoje = diaISO(new Date());
    const niveisOrdenados = [...priorityLevels].sort((a, b) => b.position - a.position);
    const idsGraves = niveisOrdenados.slice(0, 2).map(n => n.id);

    const meus = checkIns.filter(c => pessoaDoCheckIn(c).chave === chave);
    const dentro = meus.filter(c => {
      const d = diaDoCheckIn(c);
      if (!d) return false;
      if (recorte.de && d < recorte.de) return false;
      if (recorte.ate && d > recorte.ate) return false;
      return true;
    });

    const porDia = new Map<string, any[]>();
    dentro.forEach(c => {
      const d = diaDoCheckIn(c);
      if (!porDia.has(d)) porDia.set(d, []);
      porDia.get(d)!.push(c);
    });

    const ordenados = [...porDia.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dia, registros]) => ({
        dia,
        distancia: diasEntre(dia, hoje),
        registros: registros
          .slice()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .map(c => ({
            id: c.id,
            hora: horaDoCheckIn(c),
            titulo:
              c.operationTypeLabel ||
              operationTypes.find(t => t.id === c.operationTypeId)?.label ||
              c.name ||
              'Check-in',
            endereco: [c.rua, c.bairro].filter(Boolean).join(', '),
            nivel: priorityLevels.find(n => n.id === c.priority),
            grave: idsGraves.includes(c.priority || '')
          }))
      }));

    const todosOsDias = meus.map(diaDoCheckIn).filter(Boolean).sort();

    return {
      dias: ordenados,
      total: dentro.length,
      graves: dentro.filter(c => idsGraves.includes(c.priority || '')).length,
      ultimo: todosOsDias.length ? todosOsDias[todosOsDias.length - 1] : ''
    };
  }, [checkIns, chave, pessoaDoCheckIn, operationTypes, priorityLevels, de, ate]);

  const ligado = (calcular: () => { de: string; ate: string }) => {
    const v = calcular();
    return v.de === de && v.ate === ate;
  };

  return (
    <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
      {/* O relógio da ficha */}
      <div className="flex items-center justify-between gap-2 mt-2 mb-1.5">
        <h5 className="text-[9.5px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5 min-w-0">
          <CalendarDays className="w-3 h-3 shrink-0" />
          <span className="truncate">Atividades de {nome.split(' ')[0]}</span>
        </h5>
        <span className="text-[9.5px] font-black text-[#015FC9] shrink-0">
          {rotuloDoPeriodo}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {ATALHOS_DA_PESSOA.map(a => (
          <button
            key={a.rotulo}
            type="button"
            onClick={() => {
              const v = a.calcular();
              onPeriodo(v.de, v.ate);
            }}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all border ${
              ligado(a.calcular)
                ? 'bg-[#015FC9] border-[#015FC9] text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <label className="block">
          <span className="block text-[9px] uppercase tracking-wider font-black text-slate-400 mb-1">
            De
          </span>
          <input
            type="date"
            value={de}
            max={ate || undefined}
            onChange={e => onPeriodo(e.target.value, ate)}
            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          />
        </label>
        <label className="block">
          <span className="block text-[9px] uppercase tracking-wider font-black text-slate-400 mb-1">
            Até
          </span>
          <input
            type="date"
            value={ate}
            min={de || undefined}
            onChange={e => onPeriodo(de, e.target.value)}
            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10.5px] font-bold text-slate-500">
          <span className="text-[13px] font-black text-[#0D233A] tabular-nums mr-1">
            {total}
          </span>
          registro{total === 1 ? '' : 's'}
        </span>
        {graves > 0 && (
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded"
            style={{ color: SITUACAO.atrasada, backgroundColor: `${SITUACAO.atrasada}14` }}
          >
            {graves} grave{graves === 1 ? '' : 's'}
          </span>
        )}
        <span className="text-[10px] font-bold text-slate-400">
          {dias.length} dia{dias.length === 1 ? '' : 's'} com trabalho
        </span>
      </div>

      {/* A agenda: um bloco por dia, do mais recente para trás. */}
      {dias.length === 0 ? (
        <p className="text-[11px] font-semibold text-slate-400 py-3 text-center">
          Nada registrado neste recorte.
          {ultimo && (
            <span className="block text-[10px] font-bold text-slate-400 mt-1">
              O último registro desta pessoa foi em {curto(ultimo)}.
            </span>
          )}
        </p>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
          {dias.map(d => (
            <div key={d.dia}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {curto(d.dia)}
                  <span className="text-slate-300 font-bold ml-1.5 normal-case tracking-normal">
                    {desdeQuando(d.distancia)}
                  </span>
                </span>
                <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                  {d.registros.length}
                </span>
              </div>
              <div className="space-y-1">
                {d.registros.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onIrParaCheckIn(r.id)}
                    title="Levar o mapa até este registro"
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#015FC9]/40 hover:bg-blue-50/40 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span
                      className="w-1 h-7 rounded-full shrink-0"
                      style={{ backgroundColor: r.nivel?.color || '#cbd5e1' }}
                    />
                    <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                      {r.hora}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-slate-800 truncate">
                        {r.titulo}
                      </span>
                      <span className="block text-[9.5px] font-semibold text-slate-400 truncate">
                        {r.endereco || 'Sem endereço'}
                      </span>
                    </span>
                    {r.grave && (
                      <span
                        className="text-[8.5px] font-black uppercase tracking-wider px-1 py-0.5 rounded shrink-0"
                        style={{
                          color: SITUACAO.atrasada,
                          backgroundColor: `${SITUACAO.atrasada}14`
                        }}
                      >
                        grave
                      </span>
                    )}
                    <Crosshair className="w-3 h-3 text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] font-semibold text-slate-400 leading-snug mt-2">
        Este recorte é o mesmo da barra de cima: mexer aqui recorta o mapa e o
        painel inteiro, não só esta lista.
      </p>
    </div>
  );
}

/**
 * A sala de situação do mapa.
 *
 * O mapa responde "onde"; esta metade da tela responde o resto do que um
 * gestor precisa antes da reunião das oito: quanto entrou e se está subindo,
 * o que é grave e está parado há dias, qual bairro concentra o problema, o
 * que mais quebra na cidade, quem está em campo e quem sumiu, e quanto das
 * ordens que saíram virou trabalho feito.
 *
 * Tudo aqui é recorte do que já está no mapa — respeita o cliente em foco e o
 * período da barra de cima — e tudo é clicável: bairro, pessoa, prioridade e
 * tipo acendem o mesmo filtro do mapa, e a ocorrência leva o mapa até ela.
 * Um painel que só informa vira quadro na parede; este comanda a tela ao lado.
 */
export default function PainelDeCheckIns({
  aberto,
  telaCheia,
  onAlternarTelaCheia,
  onFechar,
  checkIns,
  pins,
  areas,
  equipe,
  operationTypes,
  priorityLevels,
  pessoaDoCheckIn,
  janelasDeTurno = TURNOS_PADRAO,
  metas = METAS_VAZIAS,
  de,
  ate,
  rotuloDoPeriodo,
  pessoasSelecionadas,
  onPessoa,
  niveisSelecionados,
  onNivel,
  tiposSelecionados,
  onTipo,
  onLimparFiltros,
  onIrParaCheckIn,
  onPeriodo
}: Props) {
  /** Só aparece com equipe grande: até oito pessoas a lista inteira é a busca. */
  const [buscaDePessoa, setBuscaDePessoa] = React.useState('');
  /**
   * A ficha aberta.
   *
   * Clicar no nome filtra o mapa; abrir a ficha é outra pergunta — o que essa
   * pessoa fez, dia a dia. Uma de cada vez: duas fichas abertas viram uma
   * rolagem sem fim e ninguém compara nada.
   */
  const [pessoaExpandida, setPessoaExpandida] = React.useState<string | null>(null);
  const dados = useMemo(() => {
    const hoje = diaISO(new Date());
    const diaDoRegistro = (c: any) => {
      const d = new Date(c.createdAt);
      return Number.isNaN(d.getTime()) ? '' : diaISO(d);
    };

    /* ----------------------------------------------------- o recorte ---
     * Sem datas na barra, o período é o que os registros cobrem. É o que
     * deixa a comparação com o período anterior existir sempre: um intervalo
     * do mesmo tamanho, colado antes deste.
     */
    /**
     * Comparar com o período anterior só faz sentido quando alguém escolheu
     * um. Em "todo o período" o intervalo já é tudo que existe, e o anterior
     * é, por definição, o vazio — dizer "+novo" em tudo é ruído.
     */
    const temRecorte = !!de || !!ate;
    const todosOsDias = checkIns.map(diaDoRegistro).filter(Boolean).sort();
    const inicio = de || todosOsDias[0] || hoje;
    const fim = ate || (todosOsDias.length ? todosOsDias[todosOsDias.length - 1] : hoje);
    const tamanho = Math.max(1, diasEntre(inicio, fim) + 1);
    const inicioAnterior = somarDias(inicio, -tamanho);
    const fimAnterior = somarDias(inicio, -1);

    const noPeriodo = checkIns.filter(c => {
      const d = diaDoRegistro(c);
      return d && d >= inicio && d <= fim;
    });
    const noAnterior = checkIns.filter(c => {
      const d = diaDoRegistro(c);
      return d && d >= inicioAnterior && d <= fimAnterior;
    });

    /* ------------------------------------------------------ gravidade ---
     * "Grave" é o que o administrador cadastrou como os dois níveis mais
     * altos. Não há lista fixa de prioridades no sistema: quem manda é o
     * cadastro do cliente, e a conta tem de seguir o cadastro dele.
     */
    const niveisOrdenados = [...priorityLevels].sort((a, b) => b.position - a.position);
    const idsGraves = niveisOrdenados.slice(0, 2).map(n => n.id);
    const nivelDe = (c: any) => priorityLevels.find(n => n.id === c.priority);
    const eGrave = (c: any) => idsGraves.includes(c.priority || '');

    const graves = noPeriodo.filter(eGrave);
    const gravesAntes = noAnterior.filter(eGrave);

    /* ---------------------------------------------------------- ritmo ---
     * Uma coluna por dia enquanto o período cabe em ~45 colunas; daí em
     * diante, uma por semana. Coluna de 1px não é gráfico, é textura.
     */
    const porSemana = tamanho > 45;
    const baldes: { chave: string; rotulo: string; total: number; graves: number }[] = [];
    const indicePorChave: Record<string, number> = {};
    for (let i = 0; i < tamanho; i += porSemana ? 7 : 1) {
      const d = somarDias(inicio, i);
      const chave = d;
      indicePorChave[chave] = baldes.length;
      baldes.push({
        chave,
        rotulo: porSemana ? `sem. de ${curto(d)}` : curto(d),
        total: 0,
        graves: 0
      });
      if (porSemana) {
        for (let j = 1; j < 7 && i + j < tamanho; j++) {
          indicePorChave[somarDias(inicio, i + j)] = baldes.length - 1;
        }
      }
    }
    noPeriodo.forEach(c => {
      const i = indicePorChave[diaDoRegistro(c)];
      if (i === undefined) return;
      baldes[i].total += 1;
      if (eGrave(c)) baldes[i].graves += 1;
    });
    const picoDoRitmo = Math.max(1, ...baldes.map(b => b.total));

    /* -------------------------------------------------------- bairros ---
     * O gestor pensa em bairro, não em coordenada. Junto do volume vai a
     * variação: o bairro que dobrou é notícia mesmo sem ser o maior.
     */
    const porBairro: Record<
      string,
      { nome: string; total: number; graves: number; antes: number; ultimo: string; idUltimo: string }
    > = {};
    const bairroDe = (c: any) => (c.bairro || '').trim() || 'Sem bairro';
    noPeriodo.forEach(c => {
      const nome = bairroDe(c);
      const d = diaDoRegistro(c);
      const atual = porBairro[nome] || {
        nome,
        total: 0,
        graves: 0,
        antes: 0,
        ultimo: '',
        idUltimo: ''
      };
      atual.total += 1;
      if (eGrave(c)) atual.graves += 1;
      if (d > atual.ultimo) {
        atual.ultimo = d;
        atual.idUltimo = c.id;
      }
      porBairro[nome] = atual;
    });
    noAnterior.forEach(c => {
      const nome = bairroDe(c);
      if (!porBairro[nome]) return;
      porBairro[nome].antes += 1;
    });
    // Ordenado pelo que a barra mede. Ordenar por gravidade poria uma barra
    // curta em cima de uma comprida, e um gráfico de barras fora de ordem
    // lê como gráfico quebrado — a gravidade aparece na fatia vermelha e no
    // selo, que é onde ela cabe.
    const bairros = Object.values(porBairro).sort(
      (a, b) => b.total - a.total || b.graves - a.graves
    );
    const picoDeBairro = Math.max(1, ...bairros.map(b => b.total));

    /* ---------------------------------------------------- pontos cegos ---
     * O bairro que já teve registro e parou de ter é a informação que um
     * mapa esconde: ele simplesmente deixa de desenhar o ponto, e ninguém
     * repara na ausência.
     */
    const ultimoPorBairro: Record<string, string> = {};
    checkIns.forEach(c => {
      const nome = bairroDe(c);
      const d = diaDoRegistro(c);
      if (d && d > (ultimoPorBairro[nome] || '')) ultimoPorBairro[nome] = d;
    });
    const pontosCegos = Object.entries(ultimoPorBairro)
      .filter(([nome]) => !porBairro[nome] && nome !== 'Sem bairro')
      .map(([nome, ultimo]) => ({ nome, ultimo, dias: diasEntre(ultimo, hoje) }))
      .sort((a, b) => b.dias - a.dias);

    /* ---------------------------------------------------------- tipos ---*/
    const rotuloDoTipo = (c: any) =>
      c.operationTypeLabel ||
      operationTypes.find(t => t.id === c.operationTypeId)?.label ||
      '';
    const porTipo: Record<string, { id: string; rotulo: string; cor: string; total: number }> = {};
    noPeriodo.forEach(c => {
      const rotulo = rotuloDoTipo(c);
      if (!rotulo) return;
      const tipo = operationTypes.find(t => t.label === rotulo || t.id === c.operationTypeId);
      const chave = tipo?.id || rotulo;
      const atual = porTipo[chave] || {
        id: tipo?.id || '',
        rotulo,
        cor: tipo?.color || '#94a3b8',
        total: 0
      };
      atual.total += 1;
      porTipo[chave] = atual;
    });
    const tipos = Object.values(porTipo).sort((a, b) => b.total - a.total);
    const picoDeTipo = Math.max(1, ...tipos.map(t => t.total));

    /* -------------------------------------------------------- pessoas ---*/
    const porPessoa: Record<
      string,
      {
        chave: string;
        nome: string;
        foto?: string;
        daEquipe: boolean;
        total: number;
        graves: number;
        antes: number;
        ultimo: string;
      }
    > = {};
    equipe.forEach((m: any) => {
      porPessoa[m.id] = {
        chave: m.id,
        nome: m.full_name || m.nome_completo || m.nome || 'Sem nome',
        foto: m.image || m.foto_url || m.photo,
        daEquipe: true,
        total: 0,
        graves: 0,
        antes: 0,
        ultimo: ''
      };
    });
    checkIns.forEach(c => {
      const p = pessoaDoCheckIn(c);
      const d = diaDoRegistro(c);
      const atual = porPessoa[p.chave] || {
        chave: p.chave,
        nome: p.nome,
        foto: p.foto,
        daEquipe: p.daEquipe,
        total: 0,
        graves: 0,
        antes: 0,
        ultimo: ''
      };
      if (d > atual.ultimo) atual.ultimo = d;
      if (d >= inicio && d <= fim) {
        atual.total += 1;
        if (eGrave(c)) atual.graves += 1;
      } else if (d >= inicioAnterior && d <= fimAnterior) {
        atual.antes += 1;
      }
      porPessoa[p.chave] = atual;
    });
    const pessoas = Object.values(porPessoa).sort(
      (a, b) => b.total - a.total || a.nome.localeCompare(b.nome)
    );
    const picoDePessoa = Math.max(1, ...pessoas.map(p => p.total));
    const emCampo = pessoas.filter(p => p.total > 0).length;

    /* -------------------------------------------------------- missões ---
     * Ordem que saiu não é trabalho feito. A conta que interessa é quanta
     * delas voltou com um check-in colado — e quantas passaram do prazo sem
     * voltar.
     */
    const comCheckIn = new Set(
      checkIns.filter(c => c.missionId).map(c => String(c.missionId))
    );
    const missoes = [
      ...pins.map(p => ({
        id: p.id,
        titulo: p.title,
        prazo: p.date,
        criada: p.createdAt,
        turno: p.position?.turno as TurnoId | undefined,
        prioridade: p.position?.priority
      })),
      ...areas.map(a => ({
        id: a.id,
        titulo: a.title,
        prazo: undefined as string | undefined,
        criada: a.createdAt,
        turno: a.center?.turno as TurnoId | undefined,
        prioridade: a.center?.priority
      }))
    ];
    const situacaoDaMissao = (prazo?: string) => {
      if (!prazo) return 'semPrazo' as const;
      if (prazo < hoje) return 'atrasada' as const;
      if (prazo === hoje) return 'hoje' as const;
      return 'emDia' as const;
    };
    const contagemDeMissoes = { atrasada: 0, hoje: 0, emDia: 0, semPrazo: 0 };
    const atrasadasSemVolta: { id: string; titulo: string; prazo: string; dias: number }[] = [];
    missoes.forEach(m => {
      const situacao = situacaoDaMissao(m.prazo);
      contagemDeMissoes[situacao] += 1;
      if (situacao === 'atrasada' && !comCheckIn.has(m.id)) {
        atrasadasSemVolta.push({
          id: m.id,
          titulo: m.titulo,
          prazo: m.prazo as string,
          dias: diasEntre(m.prazo as string, hoje)
        });
      }
    });
    atrasadasSemVolta.sort((a, b) => b.dias - a.dias);
    const cumpridas = missoes.filter(m => comCheckIn.has(m.id)).length;

    /* ------------------------------------------- a agenda do dia ---
     * Missão tem hora, e o gestor precisa ver o dia inteiro de uma vez: se
     * a manhã está carregada e a tarde vazia, isso é decisão a tomar hoje,
     * não relatório de fim de semana. A fatia que já voltou com check-in
     * aparece separada — turno cheio de missão cumprida é outro assunto.
     */
    const porTurno = TURNOS.map(id => {
      const doTurno = missoes.filter(m => m.turno === id);
      return {
        id,
        total: doTurno.length,
        cumpridas: doTurno.filter(m => comCheckIn.has(m.id)).length
      };
    });
    const semTurno = missoes.filter(m => !m.turno).length;
    const picoDoTurno = Math.max(1, ...porTurno.map(t => t.total));

    const porPrioridadeDaMissao = niveisOrdenados
      .map(n => ({
        ...n,
        total: missoes.filter(m => m.prioridade === n.id).length,
        cumpridas: missoes.filter(m => m.prioridade === n.id && comCheckIn.has(m.id)).length
      }))
      .filter(n => n.total > 0);
    const semPrioridadeNaMissao = missoes.filter(m => !m.prioridade).length;

    /* ---------------------------------------------- o que está pegando ---*/
    const urgentes = graves
      .map(c => ({
        ...c,
        dia: diaDoRegistro(c),
        dias: diasEntre(diaDoRegistro(c), hoje),
        nivel: nivelDe(c),
        peso: niveisOrdenados.findIndex(n => n.id === c.priority)
      }))
      .sort((a, b) => a.peso - b.peso || b.dias - a.dias)
      .slice(0, 6);

    /* ----------------------------------------------------- prioridades ---*/
    const porNivel = niveisOrdenados
      .map(n => ({
        ...n,
        total: noPeriodo.filter(c => c.priority === n.id).length
      }))
      .filter(n => n.total > 0);
    const semNivel = noPeriodo.filter(c => !nivelDe(c)).length;

    return {
      temRecorte,
      hoje,
      inicio,
      fim,
      tamanho,
      inicioAnterior,
      fimAnterior,
      noPeriodo,
      noAnterior,
      graves,
      gravesAntes,
      baldes,
      picoDoRitmo,
      porSemana,
      bairros,
      picoDeBairro,
      pontosCegos,
      tipos,
      picoDeTipo,
      pessoas,
      picoDePessoa,
      emCampo,
      missoes,
      contagemDeMissoes,
      atrasadasSemVolta,
      cumpridas,
      porTurno,
      semTurno,
      picoDoTurno,
      porPrioridadeDaMissao,
      semPrioridadeNaMissao,
      urgentes,
      porNivel,
      semNivel
    };
  }, [checkIns, pins, areas, equipe, operationTypes, priorityLevels, pessoaDoCheckIn, de, ate]);

  const {
    temRecorte,
    noPeriodo,
    noAnterior,
    graves,
    gravesAntes,
    baldes,
    picoDoRitmo,
    porSemana,
    bairros,
    picoDeBairro,
    pontosCegos,
    tipos,
    picoDeTipo,
    pessoas,
    picoDePessoa,
    emCampo,
    missoes,
    contagemDeMissoes,
    atrasadasSemVolta,
    cumpridas,
    porTurno,
    semTurno,
    picoDoTurno,
    porPrioridadeDaMissao,
    semPrioridadeNaMissao,
    urgentes,
    porNivel,
    semNivel,
    inicio,
    fim,
    inicioAnterior,
    fimAnterior
  } = dados;

  const filtrosLigados =
    pessoasSelecionadas.length + niveisSelecionados.length + tiposSelecionados.length;
  const descricaoDosFiltros = [
    pessoasSelecionadas.length &&
      `${pessoasSelecionadas.length} pessoa${pessoasSelecionadas.length === 1 ? '' : 's'}`,
    niveisSelecionados.length &&
      `${niveisSelecionados.length} gravidade${niveisSelecionados.length === 1 ? '' : 's'}`,
    tiposSelecionados.length &&
      `${tiposSelecionados.length} tipo${tiposSelecionados.length === 1 ? '' : 's'}`
  ]
    .filter(Boolean)
    .join(', ');

  const bairrosAlcancados = bairros.length;
  const bairrosAntes = new Set(
    noAnterior.map((c: any) => (c.bairro || '').trim()).filter(Boolean)
  ).size;

  return (
    <AnimatePresence>
      {aberto && (
        <motion.aside
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 60 }}
          transition={{ type: 'spring', damping: 28, stiffness: 250 }}
          className={
            telaCheia
              ? 'fixed inset-0 z-[3200] bg-white flex flex-col font-sans'
              : 'order-3 h-full w-1/2 min-w-[380px] shrink-0 bg-white border-l border-slate-200 shadow-2xl z-[1002] flex flex-col font-sans'
          }
        >
          <header className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#015FC9] border border-blue-500/60 flex items-center justify-center shrink-0">
                <Target className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm leading-tight truncate">
                  Sala de situação
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold leading-none mt-1 truncate">
                  {rotuloDoPeriodo} · {curto(inicio)} a {curto(fim)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onAlternarTelaCheia}
                title={telaCheia ? 'Voltar para meia tela' : 'Abrir em tela cheia'}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer"
              >
                {telaCheia ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onFechar}
                title="Fechar"
                className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 border border-rose-500/70 text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/*
            Filtro ligado é estado escondido: sem esta faixa, alguém clica num
            bairro, sai do painel e passa a tarde olhando um mapa cortado sem
            lembrar por quê.
          */}
          {filtrosLigados > 0 && (
            <div className="px-4 py-2.5 bg-blue-50 border-b border-[#015FC9]/20 flex items-center justify-between gap-3 shrink-0">
              <p className="text-[11px] font-bold text-[#0D233A] leading-snug min-w-0">
                O mapa está filtrado por{' '}
                <span className="text-[#015FC9]">{descricaoDosFiltros}</span>.
              </p>
              <button
                type="button"
                onClick={onLimparFiltros}
                className="h-7 px-2.5 shrink-0 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
              >
                Limpar
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto bg-white">
            {/* ---------------------------------------------- MANCHETE --- */}
            <div className="px-5 pt-5 pb-4 grid grid-cols-2 xl:grid-cols-4 gap-2.5">
              {[
                {
                  rotulo: 'Registros',
                  valor: noPeriodo.length,
                  antes: noAnterior.length,
                  detalhe: `${(noPeriodo.length / dados.tamanho).toFixed(1)}/dia`
                },
                {
                  rotulo: 'Graves',
                  valor: graves.length,
                  antes: gravesAntes.length,
                  detalhe:
                    noPeriodo.length > 0
                      ? `${Math.round((graves.length / noPeriodo.length) * 100)}% do total`
                      : '—',
                  alerta: graves.length > 0
                },
                {
                  rotulo: 'Bairros',
                  valor: bairrosAlcancados,
                  antes: bairrosAntes,
                  detalhe: pontosCegos.length > 0 ? `${pontosCegos.length} sem registro` : 'todos ativos'
                },
                {
                  rotulo: 'Em campo',
                  valor: emCampo,
                  antes: -1,
                  detalhe: `de ${pessoas.length} na equipe`
                }
              ].map(tile => (
                <div
                  key={tile.rotulo}
                  className={`rounded-2xl border p-3 ${
                    tile.alerta
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 leading-none">
                      {tile.rotulo}
                    </p>
                    {temRecorte && tile.antes >= 0 && (
                      <Variacao agora={tile.valor} antes={tile.antes} />
                    )}
                  </div>
                  <p
                    className={`text-[30px] font-black leading-none mt-2 tabular-nums ${
                      tile.alerta ? 'text-rose-700' : 'text-[#0D233A]'
                    }`}
                  >
                    {tile.valor}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 leading-none mt-1.5 truncate">
                    {tile.detalhe}
                  </p>
                </div>
              ))}
            </div>

            {/* ------------------------------------------------ EQUIPE ---
                Primeira seção do painel, antes dos números da cidade: a
                pergunta que abre o dia é quem está em campo e quem parou. */}
            <Secao
              titulo="Desempenho da equipe"
              Icone={Users}
              aviso={
                temMeta(metas)
                  ? `meta ${janelaDaMeta(metas).rotulo}`
                  : `${emCampo} de ${pessoas.length} em campo`
              }
            >
              {pessoas.length === 0 ? (
                <p className="text-[11.5px] font-semibold text-slate-400 py-3 text-center">
                  Nenhum integrante cadastrado.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {pessoas.length > 8 && (
                    <input
                      type="text"
                      value={buscaDePessoa}
                      onChange={e => setBuscaDePessoa(e.target.value)}
                      placeholder="Buscar integrante..."
                      className="w-full mb-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11.5px] font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  )}
                  {pessoas
                    .filter(p =>
                      p.nome.toLowerCase().includes(buscaDePessoa.trim().toLowerCase())
                    )
                    .map((p, i) => {
                    const marcado = pessoasSelecionadas.includes(p.chave);
                    const aberta = pessoaExpandida === p.chave;
                    const paradaHa = p.ultimo ? diasEntre(p.ultimo, dados.hoje) : -1;
                    const medalha = p.total > 0 && i < 3;
                    return (
                      <div
                        key={p.chave}
                        className={`rounded-xl border transition-all ${
                          marcado
                            ? 'bg-blue-50/70 border-[#015FC9]/40'
                            : aberta
                              ? 'bg-white border-[#015FC9]/30'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-stretch">
                          <button
                            type="button"
                            onClick={() => onPessoa(p.chave)}
                            title="Filtrar o mapa por esta pessoa"
                            className="flex-1 min-w-0 text-left px-2.5 py-2 cursor-pointer flex items-center gap-2.5"
                          >
                            <span className="relative shrink-0">
                              <span className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                                {p.foto ? (
                                  <img
                                    src={p.foto}
                                    alt={p.nome}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                    onError={e => {
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Users className="w-4 h-4 text-slate-400" />
                                )}
                              </span>
                              {medalha && (
                                <span
                                  className="absolute -top-1 -left-1 w-4.5 h-4.5 rounded-full text-[9px] font-black text-white flex items-center justify-center border-2 border-white"
                                  style={{
                                    backgroundColor:
                                      i === 0 ? '#eda100' : i === 1 ? '#94a3b8' : '#b45309'
                                  }}
                                >
                                  {i + 1}
                                </span>
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-[11.5px] font-bold text-slate-800 truncate">
                                  {p.nome}
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  {temRecorte && (
                                    <Variacao agora={p.total} antes={p.antes} />
                                  )}
                                  <span className="text-[12px] font-black text-[#0D233A] tabular-nums w-6 text-right">
                                    {p.total}
                                  </span>
                                </span>
                              </span>
                              <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                                <span
                                  className="block h-full rounded-full"
                                  style={{
                                    width: `${(p.total / picoDePessoa) * 100}%`,
                                    backgroundColor: p.total > 0 ? AZUL : 'transparent'
                                  }}
                                />
                              </span>
                              {/*
                                A meta ao lado do feito.

                                Número sem alvo é estatística: "12 check-ins"
                                só vira resultado quando se sabe que a meta
                                era 20. Missão cumprida entra na conta — quem
                                fez missão trabalhou.
                              */}
                              {temMeta(metas) && (() => {
                                const janelaDoAlvo = janelaDaMeta(metas);
                                const meus = checkIns.filter(
                                  c => pessoaDoCheckIn(c).chave === p.chave
                                );
                                const avanco = progressoDaPessoa(
                                  meus,
                                  janelasDeTurno,
                                  janelaDoAlvo.de,
                                  janelaDoAlvo.ate
                                );
                                const alvoTotal = alvoDoDia(metas, p.chave);
                                if (alvoTotal === 0) return null;
                                return (
                                  <span className="flex items-center gap-2 mt-1.5">
                                    <span
                                      className="text-[10px] font-black tabular-nums shrink-0"
                                      style={{
                                        color: corDoAvanco(avanco.total, alvoTotal)
                                      }}
                                    >
                                      {avanco.total}/{alvoTotal}
                                    </span>
                                    <span className="flex gap-1 flex-1 min-w-0">
                                      {TURNOS.map(t => {
                                        const alvo = alvoDe(metas, p.chave, t);
                                        if (alvo === 0) return null;
                                        const feito = avanco.porTurno[t];
                                        return (
                                          <span
                                            key={t}
                                            title={`${NOME_DO_TURNO[t]}: ${feito} de ${alvo}`}
                                            className="flex-1 min-w-0"
                                          >
                                            <span className="block h-1 rounded-full bg-slate-100 overflow-hidden">
                                              <span
                                                className="block h-full rounded-full"
                                                style={{
                                                  width: `${Math.min(100, (feito / alvo) * 100)}%`,
                                                  backgroundColor: COR_DO_TURNO[t]
                                                }}
                                              />
                                            </span>
                                          </span>
                                        );
                                      })}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-wider shrink-0 text-slate-400">
                                      {avanco.total >= alvoTotal ? 'meta batida' : janelaDoAlvo.rotulo}
                                    </span>
                                  </span>
                                );
                              })()}

                              <span className="flex items-center gap-2 mt-1">
                                {p.total === 0 ? (
                                  <span className="text-[9.5px] font-black uppercase tracking-wider text-rose-600">
                                    {p.ultimo
                                      ? `sem registro no período · último ${desdeQuando(paradaHa)}`
                                      : 'nunca registrou'}
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] font-bold text-slate-400">
                                    último {desdeQuando(paradaHa)}
                                    {p.graves > 0 && ` · ${p.graves} grave${p.graves === 1 ? '' : 's'}`}
                                  </span>
                                )}
                                {!p.daEquipe && (
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                                    fora da equipe
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>

                          {/* Abrir a ficha é outra ação que filtrar o mapa, e
                              por isso tem botão próprio. */}
                          <button
                            type="button"
                            onClick={() => {
                              const abrindo = pessoaExpandida !== p.chave;
                              setPessoaExpandida(abrindo ? p.chave : null);
                              // Pedir as atividades de alguém é pedir para ver
                              // o que essa pessoa fez — no mapa também.
                              if (abrindo && !marcado) onPessoa(p.chave);
                            }}
                            title={aberta ? 'Fechar as atividades' : 'Ver as atividades desta pessoa'}
                            className={`shrink-0 px-2 border-l flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                              aberta
                                ? 'border-[#015FC9]/20 text-[#015FC9] bg-blue-50/60'
                                : 'border-slate-100 text-slate-400 hover:text-[#015FC9] hover:bg-slate-50'
                            }`}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${aberta ? 'rotate-180' : ''}`}
                            />
                            <span className="text-[7.5px] font-black uppercase tracking-wider leading-none">
                              {aberta ? 'fechar' : 'ver'}
                            </span>
                          </button>
                        </div>

                        {aberta && (
                          <AtividadesDaPessoa
                            chave={p.chave}
                            nome={p.nome}
                            checkIns={checkIns}
                            pessoaDoCheckIn={pessoaDoCheckIn}
                            operationTypes={operationTypes}
                            priorityLevels={priorityLevels}
                            de={de}
                            ate={ate}
                            rotuloDoPeriodo={rotuloDoPeriodo}
                            onPeriodo={onPeriodo}
                            onIrParaCheckIn={onIrParaCheckIn}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Secao>

            {/* ------------------------------------------------- RITMO --- */}
            <Secao
              titulo="Ritmo do período"
              Icone={CalendarClock}
              aviso={
                noPeriodo.length > 0
                  ? `${porSemana ? 'por semana' : 'por dia'} · pico de ${picoDoRitmo}`
                  : porSemana
                    ? 'por semana'
                    : 'por dia'
              }
            >
              {noPeriodo.length === 0 ? (
                <p className="text-[11.5px] font-semibold text-slate-400 py-4 text-center">
                  Nenhum registro neste recorte.
                </p>
              ) : (
                <div className="flex items-end gap-[3px] h-[104px]">
                  {baldes.map(b => {
                    const altura = Math.round((b.total / picoDoRitmo) * 100);
                    const alturaGraves = b.total
                      ? Math.round((b.graves / picoDoRitmo) * 100)
                      : 0;
                    return (
                      <div
                        key={b.chave}
                        className="flex-1 min-w-[3px] h-full flex flex-col justify-end group relative"
                        title={`${b.rotulo}: ${b.total} registro${b.total === 1 ? '' : 's'}${
                          b.graves ? `, ${b.graves} grave${b.graves === 1 ? '' : 's'}` : ''
                        }`}
                      >
                        <div
                          className="w-full rounded-t-[4px] transition-all group-hover:brightness-110 relative"
                          style={{
                            height: `${Math.max(altura, b.total > 0 ? 3 : 1)}%`,
                            backgroundColor: b.total > 0 ? AZUL : '#e2e8f0'
                          }}
                        >
                          {/* A fatia grave sai por cima, na cor de alerta: é o
                              que muda a leitura de um dia cheio. */}
                          {b.graves > 0 && (
                            <div
                              className="absolute inset-x-0 top-0 rounded-t-[4px]"
                              style={{
                                height: `${Math.round((alturaGraves / Math.max(altura, 1)) * 100)}%`,
                                backgroundColor: SITUACAO.atrasada
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9.5px] font-bold text-slate-400">{curto(inicio)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[9.5px] font-bold text-slate-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: AZUL }} />
                    registros
                  </span>
                  <span className="text-[9.5px] font-bold text-slate-500 flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-[2px]"
                      style={{ backgroundColor: SITUACAO.atrasada }}
                    />
                    graves
                  </span>
                </div>
                <span className="text-[9.5px] font-bold text-slate-400">{curto(fim)}</span>
              </div>
              {temRecorte && (
                <p className="text-[9.5px] font-semibold text-slate-400 mt-2 leading-snug">
                  As setas comparam com {curto(inicioAnterior)} a {curto(fimAnterior)}: o
                  mesmo tanto de dias, imediatamente antes.
                </p>
              )}
            </Secao>

            {/* ------------------------------------- PEGANDO FOGO AGORA --- */}
            {urgentes.length > 0 && (
              <Secao
                titulo="Pegando fogo"
                Icone={AlertTriangle}
                aviso={`${graves.length} grave${graves.length === 1 ? '' : 's'} no período`}
              >
                <div className="space-y-1.5">
                  {urgentes.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onIrParaCheckIn(c.id)}
                      title="Levar o mapa até este registro"
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-3"
                    >
                      <span
                        className="w-1.5 h-9 rounded-full shrink-0"
                        style={{ backgroundColor: c.nivel?.color || SITUACAO.atrasada }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="text-[9px] font-black uppercase tracking-wider"
                            style={{ color: c.nivel?.color || SITUACAO.atrasada }}
                          >
                            {c.nivel?.label || 'Sem prioridade'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-300">•</span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {desdeQuando(c.dias)}
                          </span>
                        </span>
                        <span className="block text-[12px] font-bold text-slate-800 truncate mt-0.5">
                          {c.operationTypeLabel || c.name}
                        </span>
                        <span className="block text-[10px] font-semibold text-slate-400 truncate">
                          {[c.rua, c.bairro].filter(Boolean).join(', ') || 'Sem endereço'}
                        </span>
                      </span>
                      <Crosshair className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </Secao>
            )}

            {/* ----------------------------------------------- BAIRROS --- */}
            <Secao
              titulo="Onde dói mais"
              Icone={MapPin}
              aviso={`${bairros.length} bairro${bairros.length === 1 ? '' : 's'}`}
            >
              {bairros.length === 0 ? (
                <p className="text-[11.5px] font-semibold text-slate-400 py-3 text-center">
                  Nenhum bairro com registro no período.
                </p>
              ) : (
                <div className="space-y-2">
                  {bairros.slice(0, 8).map(b => (
                    <button
                      key={b.nome}
                      type="button"
                      onClick={() => onIrParaCheckIn(b.idUltimo)}
                      title={`Levar o mapa ao registro mais recente de ${b.nome}`}
                      className="w-full text-left group cursor-pointer"
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-[11.5px] font-bold text-slate-700 truncate group-hover:text-[#015FC9] transition-colors">
                          {b.nome}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {b.graves > 0 && (
                            <span
                              className="text-[9.5px] font-black px-1.5 py-0.5 rounded"
                              style={{
                                color: SITUACAO.atrasada,
                                backgroundColor: `${SITUACAO.atrasada}14`
                              }}
                            >
                              {b.graves} grave{b.graves === 1 ? '' : 's'}
                            </span>
                          )}
                          {temRecorte && <Variacao agora={b.total} antes={b.antes} />}
                          <span className="text-[12px] font-black text-[#0D233A] tabular-nums w-6 text-right">
                            {b.total}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex gap-[2px]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${((b.total - b.graves) / picoDeBairro) * 100}%`,
                            backgroundColor: AZUL
                          }}
                        />
                        {b.graves > 0 && (
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(b.graves / picoDeBairro) * 100}%`,
                              backgroundColor: SITUACAO.atrasada
                            }}
                          />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Secao>

            {/* ------------------------------------------ PONTOS CEGOS --- */}
            {pontosCegos.length > 0 && (
              <Secao
                titulo="Pontos cegos"
                Icone={EyeOff}
                aviso="já tiveram registro, sumiram"
              >
                <div className="flex flex-wrap gap-1.5">
                  {pontosCegos.slice(0, 10).map(p => (
                    <span
                      key={p.nome}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[10.5px] font-bold text-amber-800"
                      title={`Último registro em ${curto(p.ultimo)}`}
                    >
                      {p.nome}
                      <span className="font-black text-amber-600 ml-1.5">
                        {desdeQuando(p.dias)}
                      </span>
                    </span>
                  ))}
                </div>
                <p className="text-[9.5px] font-semibold text-slate-400 mt-2 leading-snug">
                  Bairro que o mapa parou de desenhar não vira buraco na tela — vira
                  ausência, e ausência ninguém repara.
                </p>
              </Secao>
            )}

            {/* ------------------------------------------------- TIPOS --- */}
            {tipos.length > 0 && (
              <Secao titulo="O que mais aparece" Icone={Flag} aviso="clique para filtrar o mapa">
                <div className="space-y-2">
                  {tipos.slice(0, 7).map(t => {
                    const marcado = tiposSelecionados.includes(t.id);
                    return (
                      <button
                        key={t.rotulo}
                        type="button"
                        onClick={() => t.id && onTipo(t.id)}
                        disabled={!t.id}
                        className={`w-full text-left group ${t.id ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span
                            className={`text-[11.5px] font-bold truncate flex items-center gap-1.5 transition-colors ${
                              marcado ? 'text-[#015FC9]' : 'text-slate-700 group-hover:text-[#015FC9]'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-2xs"
                              style={{ backgroundColor: t.cor }}
                            />
                            {t.rotulo}
                            {marcado && (
                              <span className="text-[8.5px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-[#015FC9] text-white">
                                filtrando
                              </span>
                            )}
                          </span>
                          <span className="text-[12px] font-black text-[#0D233A] tabular-nums shrink-0">
                            {t.total}
                            <span className="text-[9.5px] font-bold text-slate-400 ml-1">
                              {Math.round((t.total / noPeriodo.length) * 100)}%
                            </span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(t.total / picoDeTipo) * 100}%`,
                              backgroundColor: marcado ? AZUL : '#7FA9E4'
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Secao>
            )}

            {/* -------------------------------------------- PRIORIDADE --- */}
            {porNivel.length > 0 && (
              <Secao titulo="Gravidade" Icone={Flag} aviso="clique para filtrar o mapa">
                <div className="h-3 rounded-full overflow-hidden flex gap-[2px] mb-2.5">
                  {porNivel.map(n => (
                    <div
                      key={n.id}
                      style={{
                        width: `${(n.total / noPeriodo.length) * 100}%`,
                        backgroundColor: n.color
                      }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                    />
                  ))}
                  {semNivel > 0 && (
                    <div
                      style={{
                        width: `${(semNivel / noPeriodo.length) * 100}%`,
                        backgroundColor: '#cbd5e1'
                      }}
                      className="h-full last:rounded-r-full"
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {porNivel.map(n => {
                    const marcado = niveisSelecionados.includes(n.id);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onNivel(n.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                          marcado ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                        style={marcado ? { backgroundColor: n.color } : undefined}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: marcado ? '#ffffff' : n.color }}
                        />
                        {n.label}
                        <span className="font-black tabular-nums">{n.total}</span>
                      </button>
                    );
                  })}
                  {semNivel > 0 && (
                    <span className="px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold bg-slate-50 border border-slate-200 text-slate-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      Sem prioridade
                      <span className="font-black tabular-nums">{semNivel}</span>
                    </span>
                  )}
                </div>
              </Secao>
            )}

            {/* ----------------------------------------------- MISSÕES --- */}
            <Secao
              titulo="Missões enviadas"
              Icone={ClipboardList}
              aviso={`${missoes.length} no total`}
            >
              {missoes.length === 0 ? (
                <p className="text-[11.5px] font-semibold text-slate-400 py-3 text-center">
                  Nenhuma missão cadastrada para este cliente.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-2.5">
                    <span className="text-[30px] font-black text-[#0D233A] leading-none tabular-nums">
                      {Math.round((cumpridas / missoes.length) * 100)}%
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 leading-tight">
                      voltaram com check-in
                      <span className="block text-[9.5px] font-semibold text-slate-400">
                        {cumpridas} de {missoes.length} têm pelo menos um registro colado
                      </span>
                    </span>
                  </div>

                  <div className="h-3 rounded-full overflow-hidden flex gap-[2px] mb-2">
                    {(
                      [
                        ['atrasada', 'Atrasadas'],
                        ['hoje', 'Para hoje'],
                        ['emDia', 'Em dia'],
                        ['semPrazo', 'Sem prazo']
                      ] as const
                    ).map(([chave, rotulo]) => {
                      const total = contagemDeMissoes[chave];
                      if (total === 0) return null;
                      return (
                        <div
                          key={chave}
                          title={`${rotulo}: ${total}`}
                          style={{
                            width: `${(total / missoes.length) * 100}%`,
                            backgroundColor: SITUACAO[chave]
                          }}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                        />
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {(
                      [
                        ['atrasada', 'Atrasadas'],
                        ['hoje', 'Para hoje'],
                        ['emDia', 'Em dia'],
                        ['semPrazo', 'Sem prazo']
                      ] as const
                    ).map(([chave, rotulo]) =>
                      contagemDeMissoes[chave] > 0 ? (
                        <span
                          key={chave}
                          className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5"
                        >
                          <span
                            className="w-2 h-2 rounded-[2px]"
                            style={{ backgroundColor: SITUACAO[chave] }}
                          />
                          {rotulo}
                          <span className="font-black tabular-nums text-[#0D233A]">
                            {contagemDeMissoes[chave]}
                          </span>
                        </span>
                      ) : null
                    )}
                  </div>


                  {/* ------------------------------------ AGENDA DO DIA --- */}
                  {(porTurno.some(t => t.total > 0) ||
                    porPrioridadeDaMissao.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                      {porTurno.some(t => t.total > 0) && (
                        <div>
                          <div className="flex items-baseline justify-between gap-2 mb-2">
                            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                              Por turno
                            </p>
                            {turnoDeAgora(janelasDeTurno) && (
                              <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-600">
                                agora: {NOME_DO_TURNO[turnoDeAgora(janelasDeTurno)!]}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {porTurno.map(t => {
                              const eAgora = turnoDeAgora(janelasDeTurno) === t.id;
                              const janela = janelaDoTurno(janelasDeTurno, t.id);
                              const cor = COR_DO_TURNO[t.id];
                              return (
                                <div
                                  key={t.id}
                                  className={`rounded-xl border px-2.5 py-2 ${
                                    eAgora ? 'bg-white' : 'bg-slate-50/60 border-slate-200'
                                  }`}
                                  style={
                                    eAgora
                                      ? { borderColor: `${cor}66`, boxShadow: `0 0 0 1px ${cor}22` }
                                      : undefined
                                  }
                                  title={`${NOME_DO_TURNO[t.id]}: ${janela.inicio} às ${janela.fim}`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <IconeDoTurno
                                      turno={t.id}
                                      className="w-3 h-3 shrink-0"
                                    />
                                    <span
                                      className="text-[10px] font-black uppercase tracking-wider truncate"
                                      style={{ color: cor }}
                                    >
                                      {NOME_DO_TURNO[t.id]}
                                    </span>
                                  </span>
                                  <span className="flex items-baseline gap-1 mt-1">
                                    <span className="text-[18px] font-black text-[#0D233A] leading-none tabular-nums">
                                      {t.total}
                                    </span>
                                    <span className="text-[9.5px] font-bold text-slate-400 leading-none">
                                      {t.cumpridas > 0 ? `${t.cumpridas} com volta` : 'sem volta'}
                                    </span>
                                  </span>
                                  <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                                    <span
                                      className="block h-full rounded-full"
                                      style={{
                                        width: `${(t.total / picoDoTurno) * 100}%`,
                                        backgroundColor: t.total > 0 ? cor : 'transparent'
                                      }}
                                    />
                                  </span>
                                  <span className="block text-[9px] font-bold text-slate-400 tabular-nums mt-1 leading-none">
                                    {janela.inicio}–{janela.fim}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {semTurno > 0 && (
                            <p className="text-[9.5px] font-semibold text-slate-400 mt-2 leading-snug">
                              <span className="font-black text-slate-500">{semTurno}</span>{' '}
                              {semTurno === 1 ? 'missão vale' : 'missões valem'} para qualquer
                              horário — sem turno marcado, elas nunca sobem para o topo da
                              tela de quem está na rua.
                            </p>
                          )}
                        </div>
                      )}

                      {porPrioridadeDaMissao.length > 0 && (
                        <div>
                          <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                            Por prioridade
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {porPrioridadeDaMissao.map(n => (
                              <span
                                key={n.id}
                                className="px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 border bg-white border-slate-200 text-slate-600"
                                title={`${n.cumpridas} de ${n.total} voltaram com check-in`}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: n.color }}
                                />
                                {n.label}
                                <span className="font-black tabular-nums text-[#0D233A]">
                                  {n.total}
                                </span>
                                <span className="text-[9.5px] font-bold text-slate-400">
                                  · {n.cumpridas} com volta
                                </span>
                              </span>
                            ))}
                            {semPrioridadeNaMissao > 0 && (
                              <span className="px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold bg-slate-50 border border-slate-200 text-slate-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-300" />
                                Sem prioridade
                                <span className="font-black tabular-nums">
                                  {semPrioridadeNaMissao}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {atrasadasSemVolta.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[9.5px] font-black uppercase tracking-widest text-rose-600 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Passou do prazo e não voltou ({atrasadasSemVolta.length})
                      </p>
                      <div className="space-y-1">
                        {atrasadasSemVolta.slice(0, 5).map(m => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-rose-50/60 border border-rose-100"
                          >
                            <span className="text-[11px] font-bold text-slate-700 truncate">
                              {m.titulo}
                            </span>
                            <span className="text-[9.5px] font-black text-rose-600 shrink-0">
                              {desdeQuando(m.dias)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Secao>

            <p className="px-5 py-4 text-[9.5px] font-semibold text-slate-400 leading-snug">
              Tudo aqui segue o cliente em foco e o período da barra de cima. Bairro,
              pessoa, tipo e gravidade acendem o mesmo filtro do mapa ao lado.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
