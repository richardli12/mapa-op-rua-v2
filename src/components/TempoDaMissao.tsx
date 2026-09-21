import { useEffect, useState } from 'react';
import { Clock, Flag, Hourglass, Send, Zap } from 'lucide-react';

/**
 * Quanto tempo a missão levou, do comitê até a rua.
 *
 * O card já dizia quando a ordem saiu e quando o retorno chegou, em dois
 * cantos diferentes, e a conta ficava por conta de quem lia — "14:21... 15:48...
 * então foi uma hora e meia". Ninguém faz essa conta olhando dez missões, e é
 * justamente na décima que ela interessa: quem atende rápido e quem não atende.
 *
 * Aqui os dois carimbos viram uma coisa só, e a missão sem retorno também tem
 * número — o relógio dela corre na tela, porque missão parada há dois dias é a
 * informação mais importante desta janela, não a ausência de informação.
 *
 * O QUE ESTE NÚMERO É, E O QUE ELE NÃO É.
 *
 * O sistema sabe quando a ordem foi criada e quando cada check-in foi gravado.
 * Não existe carimbo de "acabei o serviço": o que se mede é o tempo até o
 * retorno chegar, e é assim que os rótulos falam. Chamar isso de "tempo de
 * execução" seria vender precisão que o dado não tem.
 */

/** Um retorno de campo, do jeito que o card já tem em mãos. */
export interface RetornoDaMissao {
  createdAt: string;
  concluido: boolean;
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * Duração em português curto: "12 min", "1h 27min", "2d 4h".
 *
 * Duas casas no máximo. "1d 3h 12min 40s" é exato e ilegível; quem olha um
 * painel quer a ordem de grandeza, não a perícia.
 */
export function formatarDuracao(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < MINUTO) return 'menos de 1 min';

  const dias = Math.floor(ms / DIA);
  const horas = Math.floor((ms % DIA) / HORA);
  const minutos = Math.floor((ms % HORA) / MINUTO);

  if (dias > 0) return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`;
  if (horas > 0) return minutos > 0 ? `${horas}h ${minutos}min` : `${horas}h`;
  return `${minutos} min`;
}

const hora = (d: Date) =>
  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const diaEHora = (d: Date) =>
  `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora(d)}`;

/**
 * A leitura do número, em uma palavra.
 *
 * Os cortes são de bom senso operacional — uma equipe na rua responde em
 * minutos, não em dias — e servem para dar cor e ordem de urgência, nunca para
 * cobrar alguém: a janela não sabe se a missão era para agora ou para a semana
 * que vem.
 */
function lerORelogio(ms: number, pendente: boolean) {
  if (pendente) {
    if (ms < 2 * HORA)
      return { texto: 'Aguardando retorno', cor: 'amber' as const };
    if (ms < DIA) return { texto: 'Sem retorno hoje', cor: 'amber' as const };
    return { texto: 'Parada há mais de um dia', cor: 'rose' as const };
  }
  if (ms < HORA) return { texto: 'Resposta rápida', cor: 'emerald' as const };
  if (ms < 6 * HORA) return { texto: 'No mesmo turno', cor: 'emerald' as const };
  if (ms < DIA) return { texto: 'No mesmo dia', cor: 'sky' as const };
  return { texto: 'Levou mais de um dia', cor: 'slate' as const };
}

const PALETA = {
  emerald: {
    caixa: 'bg-emerald-50/70 border-emerald-100',
    numero: 'text-emerald-700',
    selo: 'bg-emerald-100 text-emerald-800',
    trilho: 'bg-emerald-500'
  },
  sky: {
    caixa: 'bg-sky-50/70 border-sky-100',
    numero: 'text-sky-700',
    selo: 'bg-sky-100 text-sky-800',
    trilho: 'bg-sky-500'
  },
  amber: {
    caixa: 'bg-amber-50/70 border-amber-100',
    numero: 'text-amber-700',
    selo: 'bg-amber-100 text-amber-800',
    trilho: 'bg-amber-500'
  },
  rose: {
    caixa: 'bg-rose-50/70 border-rose-100',
    numero: 'text-rose-700',
    selo: 'bg-rose-100 text-rose-800',
    trilho: 'bg-rose-500'
  },
  slate: {
    caixa: 'bg-slate-50/70 border-slate-200',
    numero: 'text-slate-700',
    selo: 'bg-slate-200 text-slate-700',
    trilho: 'bg-slate-400'
  }
};

export default function TempoDaMissao({
  criadaEm,
  retornos
}: {
  /** Quando a ordem saiu do comitê. Sem isso não há o que medir. */
  criadaEm?: string | null;
  /** Check-ins vinculados a esta missão, em qualquer ordem. */
  retornos: RetornoDaMissao[];
}) {
  /*
   * O relógio da missão pendente anda na tela.
   *
   * De minuto em minuto, e só enquanto não há retorno: um card parado dizendo
   * "há 3h" que na verdade já são 5h mente para quem está decidindo o dia.
   */
  const [agora, setAgora] = useState(() => Date.now());

  const ordem = criadaEm ? new Date(criadaEm) : null;
  const ordemValida = ordem && !Number.isNaN(ordem.getTime()) ? ordem : null;

  const marcos = retornos
    .map(r => ({ quando: new Date(r.createdAt), concluido: r.concluido }))
    .filter(r => !Number.isNaN(r.quando.getTime()))
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());

  const primeiro = marcos[0] || null;
  const pendente = !primeiro;

  useEffect(() => {
    if (!pendente) return;
    const id = setInterval(() => setAgora(Date.now()), MINUTO);
    return () => clearInterval(id);
  }, [pendente]);

  // Missão sem data de criação não tem de onde contar: some, em vez de
  // mostrar um traço que ninguém sabe interpretar.
  if (!ordemValida) return null;

  const fim = primeiro ? primeiro.quando.getTime() : agora;
  const decorrido = fim - ordemValida.getTime();

  /*
   * Relógio adiantado nao vira numero negativo.
   *
   * O check-in é gravado no celular de quem está na rua, e o horário de lá
   * pode estar minutos atrás do servidor. "-3 min de resposta" destruiria a
   * confiança no card inteiro por causa de um relógio errado.
   */
  const duracao = Math.max(0, decorrido);

  const leitura = lerORelogio(duracao, pendente);
  const cores = PALETA[leitura.cor];

  // Só há "tempo em campo" com mais de um retorno: do primeiro ao último.
  const ultimo = primeiro && marcos.length > 1 ? marcos[marcos.length - 1] : null;
  const emCampo =
    ultimo && primeiro
      ? Math.max(0, ultimo.quando.getTime() - primeiro.quando.getTime())
      : 0;
  const concluida = marcos.some(m => m.concluido);

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
        Tempo da missão
      </p>

      <div className={`border rounded-xl p-3.5 space-y-3 ${cores.caixa}`}>
        {/* O NÚMERO, do tamanho da pergunta que ele responde. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
              {pendente ? 'Na rua há' : 'Da ordem ao retorno'}
            </p>
            <p
              className={`text-[26px] leading-none font-black mt-1 tabular-nums ${cores.numero}`}
            >
              {formatarDuracao(duracao)}
            </p>
          </div>
          <span
            className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 ${cores.selo}`}
          >
            {pendente ? (
              <Hourglass className="w-3 h-3" />
            ) : leitura.cor === 'emerald' ? (
              <Zap className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {leitura.texto}
          </span>
        </div>

        {/*
          A LINHA DO TEMPO.

          Dois carimbos e o trecho entre eles. O traço pontilhado à direita é a
          missão que ainda não voltou: a linha fica aberta de propósito, porque
          é isso que ela é.
        */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="shrink-0 w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
            <Send className="w-3 h-3 text-slate-400" />
          </span>
          {pendente ? (
            <span className="grow h-[3px] rounded-full border-t-[3px] border-dashed border-slate-300" />
          ) : (
            <span className={`grow h-[3px] rounded-full ${cores.trilho}`} />
          )}
          <span
            className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border ${
              pendente
                ? 'bg-white border-dashed border-slate-300'
                : 'bg-white border-slate-200'
            }`}
          >
            <Flag
              className={`w-3 h-3 ${pendente ? 'text-slate-300' : 'text-slate-500'}`}
            />
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 text-[10px] font-bold">
          <span className="text-slate-500">
            Ordem
            <span className="block text-slate-400 font-semibold tabular-nums">
              {diaEHora(ordemValida)}
            </span>
          </span>
          <span className="text-right text-slate-500">
            {pendente ? 'Retorno' : 'Primeiro retorno'}
            <span className="block text-slate-400 font-semibold tabular-nums">
              {primeiro ? diaEHora(primeiro.quando) : 'ainda não chegou'}
            </span>
          </span>
        </div>

        {/*
          Missão com vários check-ins tem uma segunda duração: o tempo que a
          equipe seguiu registrando depois de chegar. Só aparece quando existe
          — uma linha dizendo "0 min em campo" é ruído.
        */}
        {ultimo && (
          <p className="text-[10.5px] font-semibold text-slate-500 leading-snug border-t border-slate-200/70 pt-2.5">
            <span className="font-black text-slate-700">{marcos.length} retornos</span>
            {' ao longo de '}
            <span className="font-black text-slate-700 tabular-nums">
              {formatarDuracao(emCampo)}
            </span>
            {' em campo — o último às '}
            <span className="tabular-nums">{hora(ultimo.quando)}</span>.
          </p>
        )}

        {!pendente && !concluida && (
          <p className="text-[10px] font-semibold text-slate-400 leading-snug">
            O retorno chegou, mas nenhum check-in foi marcado como concluído: o
            tempo acima é até o primeiro registro, não até o fim do serviço.
          </p>
        )}
      </div>
    </div>
  );
}
