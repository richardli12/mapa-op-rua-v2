import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  LocateFixed,
  MapPin,
  Pencil,
  Target,
  Trash2
} from 'lucide-react';
import { PriorityLevel } from '../../types';
import { COR_DO_TURNO, NOME_DO_TURNO, TurnoId } from '../../turnos';
import {
  AlvoDaOperacao,
  Operacao,
  STATUS_DA_OPERACAO,
  StatusDaOperacao,
  formatarDistancia
} from '../../services/deltaOperacional';

const ORDEM_DOS_STATUS: StatusDaOperacao[] = ['planejada', 'em_andamento', 'concluida', 'cancelada'];

export const dataCurta = (iso?: string | null) => {
  if (!iso) return '';
  // Data pura ("2026-09-30") é do calendário, não do relógio: sem isto o fuso
  // a empurraria um dia para trás.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

/** O anel do progresso do plano: etapas feitas sobre etapas totais. */
export function AnelDeProgresso({ feitas, total, tamanho = 52 }: { feitas: number; total: number; tamanho?: number }) {
  const r = tamanho / 2 - 5;
  const volta = 2 * Math.PI * r;
  const fracao = total ? feitas / total : 0;
  return (
    <svg width={tamanho} height={tamanho} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={r}
        fill="none"
        stroke={fracao === 1 ? '#34D399' : '#F58220'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={volta}
        strokeDashoffset={volta * (1 - fracao)}
        style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}

/**
 * A ficha de uma operação.
 *
 * O que muda com a operação em andamento — o status e as etapas cumpridas —
 * muda aqui mesmo, com um clique, porque é o que se atualiza de pé, no meio
 * da rua. O que muda o desenho da operação (raio, pontos, título) é "Editar",
 * e só para quem a criou.
 */
export default function DetalheDaOperacao({
  op,
  niveis,
  podeEditar,
  podeMudarAndamento = true,
  onVoltar,
  onStatus,
  onEtapa,
  onEditar,
  onExcluir,
  onFocarAlvo,
  onFocarOperacao
}: {
  op: Operacao;
  niveis: PriorityLevel[];
  podeEditar: boolean;
  podeMudarAndamento?: boolean;
  onVoltar: () => void;
  onStatus: (s: StatusDaOperacao) => void;
  onEtapa: (etapaId: string) => void;
  onEditar?: () => void;
  onExcluir?: () => void;
  onFocarAlvo: (a: AlvoDaOperacao) => void;
  onFocarOperacao: () => void;
}) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const nivel = niveis.find((n) => n.id === op.priority);
  const cor = nivel?.color || '#64748B';
  const feitas = op.action_plan.filter((e) => e.feita).length;
  const total = op.action_plan.length;
  const status = STATUS_DA_OPERACAO[op.status] || STATUS_DA_OPERACAO.planejada;
  const turno = op.turno as TurnoId | undefined;

  return (
    <div className="flex flex-col h-full op-nasce">
      <div className="px-5 pt-4 pb-4 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Operações
        </button>

        <div className="mt-4 flex items-start gap-3">
          <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: cor }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {nivel && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider"
                  style={{ background: `${cor}26`, color: '#fff' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                  {nivel.label}
                </span>
              )}
              {turno && NOME_DO_TURNO[turno] && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider text-white"
                  style={{ background: `${COR_DO_TURNO[turno]}40` }}
                >
                  <Clock className="w-3 h-3" />
                  {NOME_DO_TURNO[turno]}
                </span>
              )}
              {op.due_date && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider bg-white/[0.07] text-slate-200">
                  <CalendarDays className="w-3 h-3" />
                  até {dataCurta(op.due_date)}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-[21px] font-black tracking-tight leading-tight break-words">{op.title}</h2>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {op.created_by_name ? `Criada por ${op.created_by_name}` : 'Criada'} em {dataCurta(op.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
        {/* STATUS */}
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Situação</p>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {ORDEM_DOS_STATUS.map((s) => {
              const ativo = op.status === s;
              const info = STATUS_DA_OPERACAO[s];
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!podeMudarAndamento}
                  onClick={() => !ativo && onStatus(s)}
                  className={`h-9 px-1 rounded-lg text-[10px] leading-tight font-black transition-all cursor-pointer disabled:cursor-default ${
                    ativo ? 'text-white shadow' : 'text-slate-500 hover:text-slate-200'
                  }`}
                  style={ativo ? { background: info.cor } : undefined}
                >
                  {info.rotulo}
                </button>
              );
            })}
          </div>
          {!podeMudarAndamento && (
            <p className="mt-1.5 text-[10.5px] text-slate-600">Status: {status.rotulo}</p>
          )}
        </div>

        {/* OBJETIVO */}
        {op.objective && (
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Objetivo</p>
            <p className="text-[13px] leading-relaxed text-slate-200 whitespace-pre-line">{op.objective}</p>
          </div>
        )}

        {/* PLANO */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <AnelDeProgresso feitas={feitas} total={total} tamanho={46} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Plano de ação</p>
              <p className="text-[14px] font-black text-white">
                {total === 0 ? 'Sem etapas' : `${feitas} de ${total} etapas feitas`}
              </p>
            </div>
          </div>
          {total > 0 && (
            <ol className="space-y-1.5">
              {op.action_plan.map((e, i) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={!podeMudarAndamento}
                    onClick={() => onEtapa(e.id)}
                    className={`w-full text-left flex items-start gap-3 rounded-xl px-3 py-2.5 border transition-colors cursor-pointer disabled:cursor-default ${
                      e.feita
                        ? 'bg-emerald-500/[0.07] border-emerald-400/20'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span
                      className={`mt-px w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        e.feita ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                      }`}
                    >
                      {e.feita ? (
                        <Check className="w-3 h-3 text-white stroke-[3.5]" />
                      ) : (
                        <span className="text-[9px] font-black text-slate-500">{i + 1}</span>
                      )}
                    </span>
                    <span
                      className={`text-[12.5px] font-semibold leading-snug ${
                        e.feita ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-100'
                      }`}
                    >
                      {e.texto}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ALVOS */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {op.targets.length} {op.targets.length === 1 ? 'ponto' : 'pontos'} · raio de {formatarDistancia(op.radius)}
            </p>
            <button
              type="button"
              onClick={onFocarOperacao}
              className="flex items-center gap-1 text-[10.5px] font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              <Target className="w-3.5 h-3.5" />
              Ver no mapa
            </button>
          </div>
          <ul className="space-y-1">
            {op.targets.map((a) => (
              <li key={`${a.tipo}:${a.id}`}>
                <button
                  type="button"
                  onClick={() => onFocarAlvo(a)}
                  className="group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/[0.05] text-left cursor-pointer"
                >
                  {a.tipo === 'pin' ? (
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: a.cor || '#F58220' }} />
                  ) : (
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0 text-[12px] font-semibold text-slate-200 truncate">{a.titulo}</span>
                  <LocateFixed className="w-3.5 h-3.5 text-slate-600 group-hover:text-white shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {podeEditar && (onEditar || onExcluir) && (
        <div className="px-5 py-4 border-t border-white/[0.06] flex items-center gap-2">
          {onExcluir &&
            (confirmandoExclusao ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(false)}
                  className="h-11 px-4 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Manter
                </button>
                <button
                  type="button"
                  onClick={onExcluir}
                  className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[12px] font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir de vez
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(true)}
                title="Excluir operação"
                className="w-11 h-11 rounded-xl border border-white/[0.08] text-slate-400 hover:text-rose-300 hover:border-rose-400/40 flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ))}
          {onEditar && !confirmandoExclusao && (
            <button
              type="button"
              onClick={onEditar}
              className="flex-1 h-11 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white text-[12px] font-black flex items-center justify-center gap-2 cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              Editar operação
            </button>
          )}
        </div>
      )}
    </div>
  );
}
