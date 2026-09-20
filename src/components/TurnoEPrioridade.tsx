import React from 'react';
import { AlarmClock, Check, Flag, Moon, Sun, Sunrise, Timer } from 'lucide-react';
import { PriorityLevel } from '../types';
import {
  COR_DO_TURNO,
  EstadoDoTurno,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TURNOS,
  TurnoId,
  faixaDoTurno,
  janelaDoTurno,
  situacaoDoTurno,
  turnoDeAgora
} from '../turnos';

/**
 * Turno e prioridade — as duas perguntas que faltavam na missão.
 *
 * O comitê já dizia onde e o quê. Faltava quando, dentro do dia, e o quanto
 * importa perto do resto. Sem as duas, quem recebe cinco missões de manhã
 * escolhe pela ordem em que chegaram, que é a ordem errada.
 *
 * As peças moram juntas porque são lidas juntas: onde aparece o turno aparece
 * a prioridade, no formulário, no cartão do painel, na ficha do mapa e na
 * conversa do check-in. Uma só definição impede que cada tela invente a sua.
 */

export const IconeDoTurno = ({
  turno,
  className
}: {
  turno: TurnoId;
  className?: string;
}) =>
  turno === 'manha' ? (
    <Sunrise className={className} />
  ) : turno === 'tarde' ? (
    <Sun className={className} />
  ) : (
    <Moon className={className} />
  );

/**
 * A etiqueta do turno.
 *
 * Com `janelas`, ela deixa de ser um rótulo e vira um relógio: diz que é
 * agora, que fecha em vinte minutos, que só começa às treze ou que a janela
 * já fechou. É o que muda a decisão de quem está na rua.
 */
export function EtiquetaDeTurno({
  turno,
  janelas,
  mostrarHoras = true,
  aoVivo = false,
  tamanho = 'normal'
}: {
  turno: TurnoId;
  janelas: JanelaDeTurno[];
  mostrarHoras?: boolean;
  /** Acrescenta o estado de agora: "é agora", "fecha em 20 min", "passou". */
  aoVivo?: boolean;
  tamanho?: 'normal' | 'mini';
}) {
  const janela = janelaDoTurno(janelas, turno);
  const cor = COR_DO_TURNO[turno];
  const situacao = aoVivo ? situacaoDoTurno(janela) : null;
  const apagada = situacao?.estado === 'passou';

  const corDoEstado: Record<EstadoDoTurno, string> = {
    agora: '#1baf7a',
    fechando: '#b45309',
    ainda_vem: '#64748b',
    passou: '#94a3b8'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-extrabold uppercase tracking-wider ${
        tamanho === 'mini' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      }`}
      style={{
        color: apagada ? '#94a3b8' : cor,
        borderColor: apagada ? '#e2e8f0' : `${cor}40`,
        backgroundColor: apagada ? '#f8fafc' : `${cor}14`
      }}
      title={situacao ? situacao.texto : faixaDoTurno(janela)}
    >
      <IconeDoTurno turno={turno} className={tamanho === 'mini' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {NOME_DO_TURNO[turno]}
      {mostrarHoras && (
        <span className="font-bold normal-case tracking-normal opacity-70">
          {janela.inicio}–{janela.fim}
        </span>
      )}
      {situacao && situacao.curto && (
        <span
          className="font-black normal-case tracking-normal"
          style={{ color: corDoEstado[situacao.estado] }}
        >
          · {situacao.estado === 'agora' ? 'agora' : situacao.curto}
        </span>
      )}
    </span>
  );
}

/** A etiqueta da prioridade, na cor que o administrador cadastrou. */
export function EtiquetaDePrioridade({
  nivel,
  tamanho = 'normal'
}: {
  nivel: PriorityLevel;
  tamanho?: 'normal' | 'mini';
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-extrabold uppercase tracking-wider ${
        tamanho === 'mini' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      }`}
      style={{
        color: nivel.color,
        borderColor: `${nivel.color}40`,
        backgroundColor: `${nivel.color}14`
      }}
      title={nivel.description || `Prioridade ${nivel.label}`}
    >
      <Flag className={tamanho === 'mini' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {nivel.label}
    </span>
  );
}

/**
 * O bloco do formulário: quando, dentro do dia, e o quanto importa.
 *
 * Os dois campos são opcionais de propósito. Missão de rua não tem sempre
 * hora marcada, e obrigar um turno faria todo mundo escolher "manhã" por
 * reflexo — um dado errado é pior que um dado ausente. O que a tela faz é
 * deixar a escolha barata: os horários de cada turno estão escritos no
 * próprio botão, e o turno que está acontecendo agora vem marcado.
 */
export function TurnoEPrioridadeDaMissao({
  janelas,
  turno,
  onTurno,
  prioridade,
  onPrioridade,
  niveis
}: {
  janelas: JanelaDeTurno[];
  turno: TurnoId | '';
  onTurno: (turno: TurnoId | '') => void;
  prioridade: string;
  onPrioridade: (id: string) => void;
  niveis: PriorityLevel[];
}) {
  const agora = turnoDeAgora(janelas);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">
            Turno da missão
          </label>
          {agora && (
            <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
              <AlarmClock className="w-3 h-3" />
              agora é {NOME_DO_TURNO[agora].toLowerCase()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          {TURNOS.map(id => {
            const janela = janelaDoTurno(janelas, id);
            const marcado = turno === id;
            const cor = COR_DO_TURNO[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTurno(marcado ? '' : id)}
                title={`${NOME_DO_TURNO[id]}: ${faixaDoTurno(janela)}`}
                className={`relative px-2 py-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  marcado ? 'text-white shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
                style={
                  marcado ? { backgroundColor: cor, borderColor: cor } : undefined
                }
              >
                <span className="flex items-center gap-1.5">
                  <IconeDoTurno
                    turno={id}
                    className="w-3.5 h-3.5 shrink-0"
                    // A cor do ícone acompanha o fundo escolhido.
                  />
                  <span
                    className={`text-[11.5px] font-black leading-none ${
                      marcado ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {NOME_DO_TURNO[id]}
                  </span>
                </span>
                <span
                  className={`block text-[9.5px] font-bold mt-1 leading-none tabular-nums ${
                    marcado ? 'text-white/80' : 'text-slate-400'
                  }`}
                >
                  {janela.inicio}–{janela.fim}
                </span>
                {agora === id && !marcado && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase tracking-wider shadow-sm">
                    agora
                  </span>
                )}
                {marcado && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white stroke-[4]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onTurno('')}
          className={`mt-1.5 w-full px-2.5 py-1.5 rounded-xl border text-[10.5px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            turno === ''
              ? 'bg-slate-100 border-slate-300 text-slate-600'
              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
          }`}
        >
          <Timer className="w-3 h-3" />
          Qualquer horário
        </button>
        <p className="text-[10px] text-slate-400 font-semibold leading-snug mt-1.5">
          O turno não tranca a missão: ela continua aparecendo no check-in o dia
          todo. O que ele faz é pôr na frente, na tela de quem está na rua, o
          que é para a hora de agora.
        </p>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
          Prioridade
        </label>
        {niveis.length === 0 ? (
          <p className="text-[10.5px] text-slate-400 font-semibold leading-snug border border-dashed border-slate-200 rounded-xl px-3 py-2.5">
            Nenhum nível de prioridade cadastrado. Crie os níveis em
            Configurações para poder classificar as missões.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {niveis.map(nivel => {
              const marcado = prioridade === nivel.id;
              return (
                <button
                  key={nivel.id}
                  type="button"
                  onClick={() => onPrioridade(marcado ? '' : nivel.id)}
                  title={nivel.description || undefined}
                  className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                    marcado
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                  style={marcado ? { backgroundColor: nivel.color } : undefined}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: marcado ? '#ffffff' : nivel.color }}
                  />
                  {nivel.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onPrioridade('')}
              className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all border ${
                prioridade === ''
                  ? 'bg-slate-100 border-slate-300 text-slate-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              Sem prioridade
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
