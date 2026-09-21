import { JanelaDeTurno, TURNOS, TurnoId, dentroDaJanela, emMinutos } from './turnos';

/**
 * Metas da equipe.
 *
 * "Vinte check-ins de manhã, dez à tarde." É assim que se cobra campo, e sem
 * isso o painel só sabe dizer quanto foi feito — nunca se foi o bastante. Um
 * número sem alvo não é resultado, é estatística.
 *
 * Três decisões seguram o modelo:
 *
 * 1. META É POR TURNO. A régua do dia já existe no sistema (`turnos.ts`), e é
 *    nela que a campanha fala: manhã de feira rende diferente de noite de
 *    reunião. Uma meta só de total diário esconderia justamente isso.
 *
 * 2. TEM UMA META PADRÃO. Cadastrar pessoa por pessoa numa equipe de trinta é
 *    trabalho que ninguém faz duas vezes. A meta padrão vale para todo mundo,
 *    e quem precisa de número diferente ganha o seu por cima.
 *
 * 3. MISSÃO CONTA COMO CHECK-IN. Quem cumpriu missão trabalhou, e o registro
 *    dela é um check-in como qualquer outro — a conta soma os dois e mostra
 *    separado, para o gestor saber de onde veio o número.
 */

/** Por quanto tempo a meta vale. */
export type Cadencia = 'dia' | 'semana' | 'periodo';

export interface MetasDoCliente {
  cadencia: Cadencia;
  /** Só na cadência "periodo": o intervalo em que a meta vale, em ISO. */
  de?: string;
  ate?: string;
  /** Vale para quem não tem meta própria. */
  padrao: Partial<Record<TurnoId, number>>;
  /** Meta própria de cada integrante, por id. */
  porPessoa: Record<string, Partial<Record<TurnoId, number>>>;
}

export const METAS_VAZIAS: MetasDoCliente = {
  cadencia: 'dia',
  padrao: {},
  porPessoa: {}
};

/** A chave no `app_settings`. Uma por cliente: campanha não empresta meta. */
export const chaveDasMetas = (candidateId: string) => `metas_${candidateId}`;

/** Lê o que está gravado, tolerando formato antigo, vazio ou estragado. */
export const lerMetas = (bruto?: string | null): MetasDoCliente => {
  if (!bruto) return { ...METAS_VAZIAS, padrao: {}, porPessoa: {} };
  try {
    const dados = JSON.parse(bruto);
    if (!dados || typeof dados !== 'object') throw new Error('formato');
    const limpar = (obj: any): Partial<Record<TurnoId, number>> => {
      const saida: Partial<Record<TurnoId, number>> = {};
      TURNOS.forEach(t => {
        const n = Number(obj?.[t]);
        if (Number.isFinite(n) && n > 0) saida[t] = Math.floor(n);
      });
      return saida;
    };
    const porPessoa: Record<string, Partial<Record<TurnoId, number>>> = {};
    Object.entries(dados.porPessoa || {}).forEach(([id, valor]) => {
      const limpo = limpar(valor);
      if (Object.keys(limpo).length > 0) porPessoa[id] = limpo;
    });
    const cadencia: Cadencia = ['dia', 'semana', 'periodo'].includes(dados.cadencia)
      ? dados.cadencia
      : 'dia';
    return {
      cadencia,
      de: typeof dados.de === 'string' ? dados.de : undefined,
      ate: typeof dados.ate === 'string' ? dados.ate : undefined,
      padrao: limpar(dados.padrao),
      porPessoa
    };
  } catch {
    return { ...METAS_VAZIAS, padrao: {}, porPessoa: {} };
  }
};

export const gravarMetas = (metas: MetasDoCliente) => JSON.stringify(metas);

/** Existe meta cadastrada? Sem isso a tela não tem o que cobrar. */
export const temMeta = (metas: MetasDoCliente) =>
  Object.keys(metas.padrao).length > 0 || Object.keys(metas.porPessoa).length > 0;

/** O alvo de uma pessoa num turno: o dela, ou o padrão da equipe. */
export const alvoDe = (metas: MetasDoCliente, pessoaId: string, turno: TurnoId) => {
  const proprio = metas.porPessoa[pessoaId];
  if (proprio && proprio[turno] !== undefined) return proprio[turno] as number;
  return metas.padrao[turno] ?? 0;
};

/** O alvo do dia inteiro de uma pessoa: a soma dos turnos. */
export const alvoDoDia = (metas: MetasDoCliente, pessoaId: string) =>
  TURNOS.reduce((soma, t) => soma + alvoDe(metas, pessoaId, t), 0);

/** A pessoa tem meta própria, diferente do padrão da equipe? */
export const temMetaPropria = (metas: MetasDoCliente, pessoaId: string) =>
  !!metas.porPessoa[pessoaId] && Object.keys(metas.porPessoa[pessoaId]).length > 0;

const diaISO = (data: Date) => data.toLocaleDateString('sv-SE');

/**
 * O intervalo em que a meta está valendo agora.
 *
 * Por dia, é hoje. Por semana, é a semana corrente começando na segunda —
 * semana de campanha começa quando a reunião de segunda define o que fazer,
 * não no domingo. No período, são as datas que o administrador escreveu.
 */
export const janelaDaMeta = (
  metas: MetasDoCliente,
  agora: Date = new Date()
): { de: string; ate: string; rotulo: string } => {
  if (metas.cadencia === 'periodo') {
    const de = metas.de || diaISO(agora);
    const ate = metas.ate || diaISO(agora);
    return { de, ate, rotulo: 'no período' };
  }
  if (metas.cadencia === 'semana') {
    const d = new Date(agora);
    // getDay(): domingo é 0. A semana da campanha abre na segunda.
    const passosAteSegunda = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - passosAteSegunda);
    const fim = new Date(d);
    fim.setDate(fim.getDate() + 6);
    return { de: diaISO(d), ate: diaISO(fim), rotulo: 'nesta semana' };
  }
  const hoje = diaISO(agora);
  return { de: hoje, ate: hoje, rotulo: 'hoje' };
};

/** Em que turno um registro caiu, pelo relógio de quando ele foi feito. */
export const turnoDoRegistro = (
  janelas: JanelaDeTurno[],
  quando: string
): TurnoId | null => {
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return null;
  const minuto = d.getHours() * 60 + d.getMinutes();
  const achado = janelas.find(j => emMinutos(j.inicio) >= 0 && dentroDaJanela(j, minuto));
  return achado ? achado.id : null;
};

export interface ProgressoDaPessoa {
  /** Quantos registros por turno, dentro da janela da meta. */
  porTurno: Record<TurnoId, number>;
  /** Quantos vieram de missão — trabalho encomendado, não avulso. */
  deMissaoPorTurno: Record<TurnoId, number>;
  total: number;
  deMissao: number;
  /** Registros que caíram fora de qualquer turno configurado. */
  foraDeTurno: number;
}

const zerado = (): Record<TurnoId, number> => ({ manha: 0, tarde: 0, noite: 0 });

/**
 * Quanto uma pessoa já fez dentro da janela da meta.
 *
 * Conta todo check-in dela, de missão ou avulso: quem cumpriu missão
 * trabalhou. O que veio de missão fica separado para o gestor saber de onde
 * veio o número — não para descontar.
 */
export const progressoDaPessoa = (
  checkIns: any[],
  janelas: JanelaDeTurno[],
  de: string,
  ate: string
): ProgressoDaPessoa => {
  const progresso: ProgressoDaPessoa = {
    porTurno: zerado(),
    deMissaoPorTurno: zerado(),
    total: 0,
    deMissao: 0,
    foraDeTurno: 0
  };

  checkIns.forEach(c => {
    const d = new Date(c.createdAt);
    if (Number.isNaN(d.getTime())) return;
    const dia = diaISO(d);
    if (dia < de || dia > ate) return;

    progresso.total += 1;
    const daMissao = !!c.missionId;
    if (daMissao) progresso.deMissao += 1;

    const turno = turnoDoRegistro(janelas, c.createdAt);
    if (!turno) {
      progresso.foraDeTurno += 1;
      return;
    }
    progresso.porTurno[turno] += 1;
    if (daMissao) progresso.deMissaoPorTurno[turno] += 1;
  });

  return progresso;
};

/** A cor do quanto já foi feito: vermelho longe, âmbar perto, verde batido. */
export const corDoAvanco = (feito: number, alvo: number) => {
  if (alvo <= 0) return '#94a3b8';
  const parte = feito / alvo;
  if (parte >= 1) return '#1baf7a';
  if (parte >= 0.6) return '#eda100';
  return '#dc2626';
};

/** "14 de 20" vira 70. Sem alvo, não há porcentagem que signifique algo. */
export const porcentagem = (feito: number, alvo: number) =>
  alvo <= 0 ? 0 : Math.min(999, Math.round((feito / alvo) * 100));
