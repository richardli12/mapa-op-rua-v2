import React from 'react';
import { AlarmClock, AlertTriangle, Clock, RotateCcw } from 'lucide-react';
import { Cartao, EstadoDoCartao } from './pecas';
import { IconeDoTurno } from '../TurnoEPrioridade';
import {
  COR_DO_TURNO,
  JanelaDeTurno,
  LARGURA_DO_DIA,
  NOME_DO_TURNO,
  TURNOS_PADRAO,
  TurnoId,
  conferirTurnos,
  duracao,
  emHora,
  emMinutos,
  fatiasDoDia,
  minutosAgora,
  tempoCurto,
  turnoDeAgora,
  viraODia
} from '../../turnos';

/**
 * Os turnos de trabalho da campanha.
 *
 * O coração da seção não são os seis campos de hora: é a régua. Três pares de
 * horário digitados não se conferem de cabeça — ninguém percebe que deixou
 * das 12h às 13h30 fora de todos os turnos olhando para campos. Desenhado, o
 * buraco salta aos olhos, e o risco dele é concreto: missão marcada num
 * horário sem turno nunca é "a de agora" para quem está na rua.
 */
export default function SecaoTurnos({
  turnos,
  onMudar,
  estado
}: {
  turnos: JanelaDeTurno[];
  onMudar: (turnos: JanelaDeTurno[]) => void;
  estado: EstadoDoCartao;
}) {
  const conferencia = conferirTurnos(turnos);
  const agora = turnoDeAgora(turnos);
  const fatias = fatiasDoDia(turnos);

  const mudarHora = (id: TurnoId, campo: 'inicio' | 'fim', valor: string) =>
    onMudar(turnos.map(j => (j.id === id ? { ...j, [campo]: valor } : j)));

  return (
    <Cartao
      id="turnos"
      titulo="Turnos de trabalho"
      subtitulo="A que horas, nesta campanha, começa a manhã."
      Icone={AlarmClock}
      estado={estado}
      acessorio={
        agora && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Clock className="w-3 h-3" />
            agora: {NOME_DO_TURNO[agora]}
          </span>
        )
      }
    >
      {/* A régua de 24 horas */}
      <div className="pt-5">
        <div className="relative h-9 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex">
          {fatias.map((fatia, i) => {
            const largura = ((fatia.ate - fatia.de + 1) / LARGURA_DO_DIA) * 100;
            const vazia = fatia.id === 'vazio';
            return (
              <span
                key={`${fatia.id}-${fatia.de}-${i}`}
                title={
                  vazia
                    ? `Sem turno: ${emHora(fatia.de)} às ${emHora(fatia.ate)}`
                    : `${NOME_DO_TURNO[fatia.id as TurnoId]}: ${emHora(fatia.de)} às ${emHora(fatia.ate)}`
                }
                className={`h-full flex items-center justify-center overflow-hidden ${
                  vazia
                    ? 'bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_4px,#f1f5f9_4px,#f1f5f9_8px)]'
                    : ''
                }`}
                style={{
                  width: `${largura}%`,
                  backgroundColor: vazia ? undefined : COR_DO_TURNO[fatia.id as TurnoId]
                }}
              >
                {!vazia && largura > 11 && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/90 truncate px-1">
                    {NOME_DO_TURNO[fatia.id as TurnoId]}
                  </span>
                )}
              </span>
            );
          })}

          {/* Onde o relógio está agora, na régua. */}
          <span
            className="absolute top-0 bottom-0 w-0.5 bg-slate-900 pointer-events-none"
            style={{ left: `${(minutosAgora() / LARGURA_DO_DIA) * 100}%` }}
            title={`Agora: ${emHora(minutosAgora())}`}
          >
            <span className="absolute -top-0.5 -left-[3px] w-2 h-2 rounded-full bg-slate-900" />
          </span>
        </div>
        <div className="flex justify-between mt-1 text-[9px] font-black text-slate-400 tabular-nums">
          <span>00h</span>
          <span>06h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </div>
      </div>

      <div className="pt-4 space-y-2">
        {turnos.map(janela => {
          const minutos = duracao(janela);
          const quebrado = emMinutos(janela.inicio) < 0 || emMinutos(janela.fim) < 0;
          const eAgora = agora === janela.id;
          return (
            <div
              key={janela.id}
              className="flex flex-wrap items-center gap-2.5 border rounded-2xl px-3 py-2.5 transition-colors"
              style={{
                borderColor: eAgora ? `${COR_DO_TURNO[janela.id]}55` : '#e2e8f0',
                backgroundColor: eAgora ? `${COR_DO_TURNO[janela.id]}08` : undefined
              }}
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: COR_DO_TURNO[janela.id] }}
              >
                <IconeDoTurno turno={janela.id} className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-slate-800 leading-tight">
                  {NOME_DO_TURNO[janela.id]}
                </p>
                <p className="text-[10.5px] text-slate-400 font-bold">
                  {quebrado
                    ? 'horário incompleto'
                    : `${tempoCurto(minutos)} de janela${viraODia(janela) ? ' · vira o dia' : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="time"
                  value={janela.inicio}
                  onChange={e => mudarHora(janela.id, 'inicio', e.target.value)}
                  aria-label={`Início da ${NOME_DO_TURNO[janela.id].toLowerCase()}`}
                  className="w-[118px] bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer tabular-nums"
                />
                <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
                <input
                  type="time"
                  value={janela.fim}
                  onChange={e => mudarHora(janela.id, 'fim', e.target.value)}
                  aria-label={`Fim da ${NOME_DO_TURNO[janela.id].toLowerCase()}`}
                  className="w-[118px] bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer tabular-nums"
                />
              </div>
            </div>
          );
        })}
      </div>

      {(conferencia.erros.length > 0 || conferencia.avisos.length > 0) && (
        <div className="mt-3 space-y-1.5">
          {conferencia.erros.map(texto => (
            <p
              key={texto}
              className="flex items-start gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 max-w-[86ch]"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              {texto}
            </p>
          ))}
          {conferencia.avisos.map(texto => (
            <p
              key={texto}
              className="flex items-start gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 max-w-[86ch]"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              {texto}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400 font-semibold leading-snug min-w-0">
          O fim entra no turno: <strong className="text-slate-600">11:59</strong> ainda é
          manhã. Turno que termina antes de começar atravessa a meia-noite.
        </p>
        <button
          type="button"
          onClick={() => onMudar(TURNOS_PADRAO.map(j => ({ ...j })))}
          className="shrink-0 px-3 py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
          title="Voltar aos horários de fábrica"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Padrão
        </button>
      </div>
    </Cartao>
  );
}
