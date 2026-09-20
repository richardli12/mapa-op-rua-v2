/**
 * Os turnos de trabalho da campanha.
 *
 * Missão tem hora. "Panfletar na feira" é de manhã; "abordagem na saída do
 * trabalho" é fim de tarde; "carro de som no bairro" não pode ser às dez da
 * noite. O prazo diz o dia — o turno diz a parte do dia, e é o que decide o
 * que quem está na rua faz agora e o que pode esperar.
 *
 * As três faixas não são fixas no código de propósito: manhã em cidade de
 * interior começa às 5h30 e em capital, às 9h. Quem manda é o administrador,
 * e o que ele escreve fica em `app_settings` — uma configuração do sistema,
 * igual para todo mundo, e não do navegador de quem mexeu.
 */

export type TurnoId = 'manha' | 'tarde' | 'noite';

export interface JanelaDeTurno {
  id: TurnoId;
  /** 'HH:MM' — o minuto em que o turno abre. */
  inicio: string;
  /** 'HH:MM' — o último minuto do turno, ele próprio dentro da janela. */
  fim: string;
}

/** Chave do ajuste no banco. */
export const CHAVE_TURNOS = 'turnos_missao';

export const TURNOS: TurnoId[] = ['manha', 'tarde', 'noite'];

export const NOME_DO_TURNO: Record<TurnoId, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite'
};

/**
 * A cor de cada turno.
 *
 * Âmbar, azul e roxo: separadas o bastante para o olho distinguir de longe e
 * também para quem não enxerga cor — por isso nenhuma etiqueta de turno sai
 * só colorida, todas carregam o nome escrito.
 */
export const COR_DO_TURNO: Record<TurnoId, string> = {
  manha: '#B45309',
  tarde: '#015FC9',
  noite: '#6D28D9'
};

/**
 * O relógio de fábrica.
 *
 * Divide o dia em três e não deixa buraco: enquanto o administrador não
 * escrever o horário da campanha dele, o sistema já funciona.
 */
export const TURNOS_PADRAO: JanelaDeTurno[] = [
  { id: 'manha', inicio: '06:00', fim: '11:59' },
  { id: 'tarde', inicio: '12:00', fim: '17:59' },
  { id: 'noite', inicio: '18:00', fim: '23:59' }
];

const MINUTOS_DO_DIA = 24 * 60;

/** '08:30' vira 510. Hora inválida vira -1, e quem chama decide o que fazer. */
export const emMinutos = (hora: string) => {
  const bate = /^(\d{1,2}):(\d{2})$/.exec((hora || '').trim());
  if (!bate) return -1;
  const h = Number(bate[1]);
  const m = Number(bate[2]);
  if (h > 23 || m > 59) return -1;
  return h * 60 + m;
};

/** 510 vira '08:30'. */
export const emHora = (minutos: number) => {
  const total = ((minutos % MINUTOS_DO_DIA) + MINUTOS_DO_DIA) % MINUTOS_DO_DIA;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** O minuto em que a pessoa está, no relógio do aparelho dela. */
export const minutosAgora = (quando: Date = new Date()) =>
  quando.getHours() * 60 + quando.getMinutes();

/**
 * A janela vira o dia?
 *
 * "Noite: 18:00 às 02:00" é um turno legítimo — véspera de eleição não acaba
 * à meia-noite. Quando o fim é menor que o início, a janela atravessa para o
 * dia seguinte, e toda conta daqui para baixo precisa saber disso.
 */
export const viraODia = (janela: JanelaDeTurno) =>
  emMinutos(janela.fim) < emMinutos(janela.inicio);

/** Quantos minutos a janela dura, já contando a virada do dia. */
export const duracao = (janela: JanelaDeTurno) => {
  const i = emMinutos(janela.inicio);
  const f = emMinutos(janela.fim);
  if (i < 0 || f < 0) return 0;
  return (f >= i ? f - i : MINUTOS_DO_DIA - i + f) + 1;
};

/** O minuto cai dentro da janela? O fim conta: 11:59 ainda é manhã. */
export const dentroDaJanela = (janela: JanelaDeTurno, minuto: number) => {
  const i = emMinutos(janela.inicio);
  const f = emMinutos(janela.fim);
  if (i < 0 || f < 0) return false;
  return f >= i ? minuto >= i && minuto <= f : minuto >= i || minuto <= f;
};

/** Quantos minutos faltam de agora até o minuto alvo, andando para a frente. */
const ateFrente = (de: number, ate: number) =>
  (((ate - de) % MINUTOS_DO_DIA) + MINUTOS_DO_DIA) % MINUTOS_DO_DIA;

/** A janela de um turno, com o padrão como rede de segurança. */
export const janelaDoTurno = (janelas: JanelaDeTurno[], id: TurnoId): JanelaDeTurno =>
  janelas.find(j => j.id === id) ||
  TURNOS_PADRAO.find(j => j.id === id) ||
  TURNOS_PADRAO[0];

/** Qual turno está acontecendo agora. Nenhum, se a hora caiu num buraco. */
export const turnoDeAgora = (
  janelas: JanelaDeTurno[],
  quando: Date = new Date()
): TurnoId | null => {
  const agora = minutosAgora(quando);
  const achado = janelas.find(j => dentroDaJanela(j, agora));
  return achado ? achado.id : null;
};

/** '08:30 às 11:59' — do jeito que se fala. */
export const faixaDoTurno = (janela: JanelaDeTurno) =>
  `${janela.inicio} às ${janela.fim}`;

/** '40 min', '2h10', '3 h' — tempo curto para caber numa etiqueta. */
export const tempoCurto = (minutos: number) => {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, '0')}`;
};

export type EstadoDoTurno = 'agora' | 'fechando' | 'ainda_vem' | 'passou';

/**
 * Onde o turno está em relação a agora — e o que dizer sobre isso.
 *
 * É a peça que faz o turno valer alguma coisa na rua. Saber que a missão é
 * "de manhã" não ajuda ninguém às 11h40; saber que a janela fecha em 19
 * minutos, ajuda.
 *
 * "Fechando" é a última meia hora: tempo de ainda dar conta se sair agora.
 */
export const situacaoDoTurno = (
  janela: JanelaDeTurno,
  quando: Date = new Date()
): { estado: EstadoDoTurno; minutos: number; texto: string; curto: string } => {
  const agora = minutosAgora(quando);
  const i = emMinutos(janela.inicio);
  const f = emMinutos(janela.fim);
  if (i < 0 || f < 0) {
    return { estado: 'ainda_vem', minutos: 0, texto: 'Horário não configurado', curto: '' };
  }

  if (dentroDaJanela(janela, agora)) {
    const faltam = ateFrente(agora, f) + 1;
    if (faltam <= 30) {
      return {
        estado: 'fechando',
        minutos: faltam,
        texto: `Fecha em ${tempoCurto(faltam)} — às ${janela.fim}`,
        curto: `fecha em ${tempoCurto(faltam)}`
      };
    }
    return {
      estado: 'agora',
      minutos: faltam,
      texto: `É agora — até às ${janela.fim}`,
      curto: `até ${janela.fim}`
    };
  }

  const ateAbrir = ateFrente(agora, i);
  // Mais de doze horas à frente é, na prática, um turno que já passou hoje:
  // quem olha às 20h uma missão da manhã quer ler "passou", não "faltam 12h".
  if (ateAbrir > 12 * 60) {
    return {
      estado: 'passou',
      minutos: MINUTOS_DO_DIA - ateAbrir,
      texto: `A janela fechou às ${janela.fim}`,
      curto: 'janela fechada'
    };
  }
  return {
    estado: 'ainda_vem',
    minutos: ateAbrir,
    texto: `Começa às ${janela.inicio} — em ${tempoCurto(ateAbrir)}`,
    curto: `a partir de ${janela.inicio}`
  };
};

/**
 * A ordem em que os turnos aparecem numa lista.
 *
 * Pelo relógio, começando pela manhã — e não pela ordem em que alguém
 * cadastrou. Turno que vira o dia entra no fim, que é onde ele acontece.
 */
export const ordemDoTurno = (janelas: JanelaDeTurno[], id?: TurnoId | null) => {
  if (!id) return 99999;
  const j = janelaDoTurno(janelas, id);
  const i = emMinutos(j.inicio);
  return i < 0 ? 99998 : i;
};

/**
 * Lê o que está gravado em `app_settings`.
 *
 * Configuração guardada em texto sempre volta um dia como texto estranho:
 * chave que sumiu, hora escrita à mão, JSON de uma versão antiga. Nada disso
 * pode derrubar a tela — o que não for entendido volta ao padrão, campo a
 * campo, e o sistema segue funcionando.
 */
export const lerTurnos = (bruto?: string | null): JanelaDeTurno[] => {
  if (!bruto) return TURNOS_PADRAO.map(j => ({ ...j }));
  try {
    const dados = JSON.parse(bruto);
    if (!Array.isArray(dados)) return TURNOS_PADRAO.map(j => ({ ...j }));
    return TURNOS.map(id => {
      const padrao = TURNOS_PADRAO.find(j => j.id === id)!;
      const achado = dados.find((d: any) => d && d.id === id);
      if (!achado) return { ...padrao };
      const inicio = emMinutos(String(achado.inicio)) >= 0 ? String(achado.inicio) : padrao.inicio;
      const fim = emMinutos(String(achado.fim)) >= 0 ? String(achado.fim) : padrao.fim;
      return { id, inicio, fim };
    });
  } catch {
    return TURNOS_PADRAO.map(j => ({ ...j }));
  }
};

export const gravarTurnos = (janelas: JanelaDeTurno[]) => JSON.stringify(janelas);

/**
 * O que está errado no relógio que o administrador montou.
 *
 * Não impede de salvar: a campanha pode mesmo querer um vão entre o fim da
 * tarde e o começo da noite, ou não trabalhar de madrugada. Mas ninguém
 * descobre um buraco de três horas no relógio por acaso, às seis da tarde,
 * quando uma missão não aparece para a equipe — então a tela diz na hora.
 */
export const conferirTurnos = (janelas: JanelaDeTurno[]) => {
  const avisos: string[] = [];
  const erros: string[] = [];

  janelas.forEach(j => {
    if (emMinutos(j.inicio) < 0 || emMinutos(j.fim) < 0) {
      erros.push(`${NOME_DO_TURNO[j.id]}: horário incompleto.`);
      return;
    }
    if (duracao(j) < 15) {
      erros.push(`${NOME_DO_TURNO[j.id]}: a janela ficou com menos de 15 minutos.`);
    }
  });
  if (erros.length > 0) return { erros, avisos, cobertura: 0 };

  // Sobreposição: dois turnos valendo no mesmo minuto fazem "o que é agora?"
  // ter duas respostas, e a lista da rua deixa de ter uma ordem única.
  for (let a = 0; a < janelas.length; a++) {
    for (let b = a + 1; b < janelas.length; b++) {
      const choque = minutosDaJanela(janelas[a]).some(m => dentroDaJanela(janelas[b], m));
      if (choque) {
        avisos.push(
          `${NOME_DO_TURNO[janelas[a].id]} e ${NOME_DO_TURNO[janelas[b].id]} se sobrepõem: o mesmo horário cai nos dois.`
        );
      }
    }
  }

  const cobertos = new Set<number>();
  janelas.forEach(j => minutosDaJanela(j).forEach(m => cobertos.add(m)));
  const cobertura = cobertos.size / MINUTOS_DO_DIA;

  const buracos = faixasDescobertas(janelas);
  buracos
    .filter(b => b.minutos >= 30)
    .forEach(b =>
      avisos.push(
        `Das ${emHora(b.de)} às ${emHora(b.ate)} não há turno nenhum: missão marcada nesse horário não é "de agora" para ninguém.`
      )
    );

  return { erros, avisos, cobertura };
};

/** Todos os minutos que uma janela cobre. */
const minutosDaJanela = (janela: JanelaDeTurno) => {
  const i = emMinutos(janela.inicio);
  const total = duracao(janela);
  if (i < 0 || total === 0) return [] as number[];
  return Array.from({ length: total }, (_, k) => (i + k) % MINUTOS_DO_DIA);
};

/** Os pedaços do dia que nenhum turno cobre. */
export const faixasDescobertas = (janelas: JanelaDeTurno[]) => {
  const cobertos = new Array(MINUTOS_DO_DIA).fill(false);
  janelas.forEach(j => minutosDaJanela(j).forEach(m => (cobertos[m] = true)));

  const faixas: { de: number; ate: number; minutos: number }[] = [];
  let inicio: number | null = null;
  for (let m = 0; m < MINUTOS_DO_DIA; m++) {
    if (!cobertos[m] && inicio === null) inicio = m;
    if ((cobertos[m] || m === MINUTOS_DO_DIA - 1) && inicio !== null) {
      const fim = cobertos[m] ? m - 1 : m;
      faixas.push({ de: inicio, ate: fim, minutos: fim - inicio + 1 });
      inicio = null;
    }
  }
  return faixas;
};

/**
 * As fatias do dia para a barra de 24 horas da tela de configuração.
 *
 * Uma janela que vira o dia sai em dois pedaços — o que ela ocupa hoje e o
 * que ela ocupa depois da meia-noite —, porque é assim que ela se desenha
 * numa régua que começa às 00:00.
 */
export const fatiasDoDia = (janelas: JanelaDeTurno[]) => {
  const fatias: { id: TurnoId | 'vazio'; de: number; ate: number }[] = [];
  janelas.forEach(j => {
    const i = emMinutos(j.inicio);
    const f = emMinutos(j.fim);
    if (i < 0 || f < 0) return;
    if (f >= i) fatias.push({ id: j.id, de: i, ate: f });
    else {
      fatias.push({ id: j.id, de: i, ate: MINUTOS_DO_DIA - 1 });
      fatias.push({ id: j.id, de: 0, ate: f });
    }
  });
  faixasDescobertas(janelas).forEach(b =>
    fatias.push({ id: 'vazio', de: b.de, ate: b.ate })
  );
  return fatias.sort((a, b) => a.de - b.de);
};

export const LARGURA_DO_DIA = MINUTOS_DO_DIA;
