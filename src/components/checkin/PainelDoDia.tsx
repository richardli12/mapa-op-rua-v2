import React from 'react';
import { Clock, Flag, MapPin, Target, X } from 'lucide-react';
import {
  COR_DO_TURNO,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TURNOS,
  TurnoId,
  janelaDoTurno,
  situacaoDoTurno
} from '../../turnos';
import {
  MetasDoCliente,
  alvoDe,
  alvoDoDia,
  corDoAvanco,
  janelaDaMeta,
  progressoDaPessoa
} from '../../metas';
import { IconeDoTurno } from '../TurnoEPrioridade';
import { AZUL, AnelDeProgresso, VERDE, contar } from './pecas';

/**
 * O dia da pessoa, numa folha que sobe de baixo.
 *
 * Antes a meta era um cartão no meio do fio: ficava entre o comitê e a
 * primeira pergunta do check-in, empurrava tudo para baixo e, depois da
 * primeira rolagem, nunca mais era vista. Meta não é mensagem — é painel, e
 * painel se consulta quando se quer.
 *
 * Então ela saiu do fio e virou isto: o anel no cabeçalho diz o número o
 * tempo todo, e um toque abre o dia inteiro — quanto falta em cada turno,
 * quanto tempo cada janela ainda tem, e o que já foi registrado hoje, com
 * hora e rua.
 */
export default function PainelDoDia({
  aberto,
  onFechar,
  metas,
  pessoaId,
  meusCheckIns,
  janelas,
  turnoAgora
}: {
  aberto: boolean;
  onFechar: () => void;
  metas: MetasDoCliente;
  pessoaId: string;
  meusCheckIns: any[];
  janelas: JanelaDeTurno[];
  turnoAgora: TurnoId | null;
}) {
  if (!aberto) return null;

  const janelaDoAlvo = janelaDaMeta(metas);
  const avanco = progressoDaPessoa(meusCheckIns, janelas, janelaDoAlvo.de, janelaDoAlvo.ate);
  const alvoTotal = alvoDoDia(metas, pessoaId);
  const cor = corDoAvanco(avanco.total, alvoTotal);
  const batida = alvoTotal > 0 && avanco.total >= alvoTotal;
  const faltam = Math.max(0, alvoTotal - avanco.total);

  /* Os registros da janela da meta, do mais novo para o mais velho: é a prova
     do que o anel está dizendo, e a resposta para "será que aquele entrou?". */
  const registros = [...meusCheckIns]
    .filter(c => {
      const d = new Date(c.createdAt);
      if (Number.isNaN(d.getTime())) return false;
      const dia = d.toLocaleDateString('sv-SE');
      return dia >= janelaDoAlvo.de && dia <= janelaDoAlvo.ate;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <div className="fixed inset-0 z-[3400] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-slate-900/55 ck-veu cursor-pointer"
      />

      <div
        className="relative ck-folha bg-white rounded-t-3xl shadow-2xl max-h-[86vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="shrink-0 pt-2.5 pb-1 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="shrink-0 px-5 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-black leading-tight" style={{ color: AZUL }}>
              O seu dia
            </h2>
            <p className="text-[11.5px] font-bold text-slate-400 mt-0.5">
              Meta {janelaDoAlvo.rotulo}
              {janelaDoAlvo.de !== janelaDoAlvo.ate && (
                <span>
                  {' '}
                  ·{' '}
                  {new Date(`${janelaDoAlvo.de}T12:00:00`).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit'
                  })}
                  {' a '}
                  {new Date(`${janelaDoAlvo.ate}T12:00:00`).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit'
                  })}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4">
          {/* O número grande, com o anel do lado */}
          <div
            className="rounded-3xl border p-4 flex items-center gap-4"
            style={{
              backgroundColor: batida ? '#F0FDF7' : '#F8FAFC',
              borderColor: batida ? '#A7F3D0' : '#E8EEF4'
            }}
          >
            <AnelDeProgresso
              feito={avanco.total}
              alvo={alvoTotal}
              tamanho={76}
              espessura={7}
              cor={batida ? VERDE : cor}
              corDoTrilho="#E2E8F0"
            >
              <span className="flex flex-col items-center leading-none">
                <span className="text-[22px] font-black tabular-nums" style={{ color: AZUL }}>
                  {avanco.total}
                </span>
                <span className="text-[10px] font-black text-slate-300">de {alvoTotal}</span>
              </span>
            </AnelDeProgresso>

            <div className="min-w-0 flex-1">
              <p
                className="text-[15px] font-black leading-tight"
                style={{ color: batida ? '#05603F' : AZUL }}
              >
                {batida
                  ? 'Meta batida. O resto é lucro.'
                  : faltam === 1
                    ? 'Falta 1 check-in.'
                    : `Faltam ${faltam} check-ins.`}
              </p>
              <p className="text-[11.5px] font-bold text-slate-400 leading-snug mt-1">
                {avanco.deMissao > 0
                  ? `${contar(avanco.deMissao, 'veio', 'vieram')} de missão do comitê.`
                  : 'Nenhum deles veio de missão ainda.'}
                {avanco.foraDeTurno > 0 &&
                  ` ${contar(avanco.foraDeTurno, 'caiu', 'caíram')} fora dos turnos.`}
              </p>
            </div>
          </div>

          {/* Turno a turno: onde está a folga e onde está o aperto */}
          <div className="space-y-2.5">
            {TURNOS.map(t => {
              const alvo = alvoDe(metas, pessoaId, t);
              if (alvo === 0) return null;
              const feito = avanco.porTurno[t];
              const janela = janelaDoTurno(janelas, t);
              const situacao = situacaoDoTurno(janela);
              const eAgora = turnoAgora === t;
              const completo = feito >= alvo;

              return (
                <div
                  key={t}
                  className="rounded-2xl border px-3.5 py-3"
                  style={{
                    borderColor: eAgora ? `${COR_DO_TURNO[t]}55` : '#E8EEF4',
                    backgroundColor: eAgora ? `${COR_DO_TURNO[t]}0A` : '#FFFFFF'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: COR_DO_TURNO[t] }}
                    >
                      <IconeDoTurno turno={t} className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[12.5px] font-black" style={{ color: AZUL }}>
                        {NOME_DO_TURNO[t]}
                        {eAgora && (
                          <span className="ml-1.5 text-[9.5px] font-black uppercase tracking-wider text-emerald-600">
                            agora
                          </span>
                        )}
                      </span>
                      <span className="block text-[10.5px] font-bold text-slate-400">
                        {janela.inicio}–{janela.fim} · {situacao.curto}
                      </span>
                    </span>
                    <span
                      className="text-[14px] font-black tabular-nums shrink-0"
                      style={{ color: completo ? VERDE : AZUL }}
                    >
                      {feito}
                      <span className="text-slate-300">/{alvo}</span>
                    </span>
                  </div>
                  <span className="block h-2 rounded-full bg-slate-100 overflow-hidden mt-2.5">
                    <span
                      className="block h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (feito / alvo) * 100)}%`,
                        backgroundColor: completo ? VERDE : COR_DO_TURNO[t]
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>

          {/* A prova: o que já entrou */}
          <div>
            <p className="text-[10.5px] font-black uppercase tracking-widest text-slate-400 mb-2">
              {registros.length === 0
                ? 'Nada registrado ainda'
                : contar(registros.length, 'check-in feito', 'check-ins feitos')}
            </p>

            {registros.length === 0 ? (
              <p className="text-[12.5px] font-semibold text-slate-400 leading-snug">
                O primeiro da janela é este que você está fazendo agora.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {registros.slice(0, 20).map((c, i) => (
                  <li
                    key={c.id || i}
                    className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-3 py-2.5"
                  >
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: c.missionId ? VERDE : '#94A3B8' }}
                    >
                      {c.missionId ? (
                        <Target className="w-3.5 h-3.5" />
                      ) : (
                        <Flag className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span
                        className="block text-[12.5px] font-bold truncate"
                        style={{ color: AZUL }}
                      >
                        {c.missionTitle || c.rua || 'Check-in livre'}
                      </span>
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-slate-400 truncate">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {[c.rua, c.bairro].filter(Boolean).join(', ') || 'sem endereço'}
                      </span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-[10.5px] font-black text-slate-400 tabular-nums">
                      <Clock className="w-3 h-3" />
                      {new Date(c.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
