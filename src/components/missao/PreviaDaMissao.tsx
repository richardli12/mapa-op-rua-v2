import React from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardList,
  MapPin,
  Paperclip,
  Smartphone,
  Target,
  Users
} from 'lucide-react';
import { PriorityLevel } from '../../types';
import { EtiquetaDePrioridade, EtiquetaDeTurno } from '../TurnoEPrioridade';
import { JanelaDeTurno, TurnoId } from '../../turnos';

/**
 * A missão como ela vai chegar no celular de quem está na rua.
 *
 * O comitê escreve a missão numa tela de 1400px, com mapa ao lado e todos os
 * campos à mostra — e ela é lida num celular, no meio da rua, entre uma
 * abordagem e outra. Essas duas telas não se parecem em nada, e é daí que
 * saem as missões que ninguém entende: "Ponto 3" sem instrução nenhuma faz
 * sentido para quem acabou de criar e para mais ninguém.
 *
 * Por isso a prévia não é enfeite: ela mostra o cartão do jeito que a pessoa
 * vai ver, enquanto o texto está sendo escrito, e lista o que ainda falta
 * para a missão fazer sentido sozinha — que é como ela vai ser lida.
 */

export interface PendenciaDaMissao {
  /** `true` trava o envio; `false` é só um alerta que vale dizer. */
  trava: boolean;
  texto: string;
}

export default function PreviaDaMissao({
  tipo,
  titulo,
  descricao,
  cor,
  tipoLabel,
  bairro,
  raio,
  prazo,
  turno,
  janelas,
  nivel,
  totalDeMaterial,
  designados,
  totalDaEquipe
}: {
  tipo: 'area' | 'pin' | 'sem';
  titulo: string;
  descricao: string;
  cor: string;
  tipoLabel?: string;
  bairro?: string;
  raio?: number;
  prazo?: string;
  turno?: TurnoId | '';
  janelas: JanelaDeTurno[];
  nivel?: PriorityLevel;
  totalDeMaterial: number;
  /** Nomes de quem foi marcado. Vazio quer dizer "todo o time". */
  designados: string[];
  totalDaEquipe: number;
}) {
  const semTitulo = !titulo.trim();
  const semInstrucao = !descricao.trim();

  const pendencias: PendenciaDaMissao[] = [];
  if (semTitulo) {
    pendencias.push({ trava: true, texto: 'Falta o título: é o que aparece na lista da rua.' });
  }
  if (semInstrucao) {
    pendencias.push({
      trava: false,
      texto: 'Sem instrução escrita, quem recebe só tem o título para se virar.'
    });
  }
  if (!turno) {
    pendencias.push({
      trava: false,
      texto: 'Sem turno, a missão nunca sobe para o topo como "a de agora".'
    });
  }
  if (!nivel) {
    pendencias.push({
      trava: false,
      texto: 'Sem prioridade, ela entra depois de qualquer missão classificada.'
    });
  }
  if (designados.length === 0) {
    pendencias.push({
      trava: false,
      texto:
        totalDaEquipe > 0
          ? `Ninguém marcado: vai para as ${totalDaEquipe} pessoas do time.`
          : 'Ninguém marcado: vai para todo o time do cliente.'
    });
  }

  const pronta = pendencias.length === 0;

  const detalhes = [
    tipo === 'sem'
      ? 'Sem local marcado · check-in onde a pessoa estiver'
      : tipo === 'area'
        ? 'Área de trabalho'
        : 'Ponto no mapa',
    bairro?.trim() || null,
    tipoLabel || null,
    raio ? `raio de ${raio >= 1000 ? `${(raio / 1000).toFixed(1)} km` : `${raio} m`}` : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">
          Como a equipe vai ver
        </p>
      </div>

      {/* O cartão, com a mesma anatomia da conversa do check-in. */}
      <div className="rounded-2xl border border-slate-200 bg-[#F3F6FA] p-2.5">
        <div className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span
              className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `${cor}1A`, color: cor }}
            >
              {tipo === 'sem' ? (
                <ClipboardList className="w-4 h-4" />
              ) : tipo === 'area' ? (
                <Target className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[13px] font-black leading-tight ${
                  semTitulo ? 'text-slate-300 italic' : 'text-[#0C3556]'
                }`}
              >
                {titulo.trim() || 'Título da missão'}
              </p>

              {(turno || nivel) && (
                <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {turno && (
                    <EtiquetaDeTurno
                      turno={turno}
                      janelas={janelas}
                      mostrarHoras={false}
                      aoVivo
                      tamanho="mini"
                    />
                  )}
                  {nivel && <EtiquetaDePrioridade nivel={nivel} tamanho="mini" />}
                </span>
              )}

              <p
                className={`text-[11.5px] leading-snug mt-1 whitespace-pre-line ${
                  semInstrucao ? 'text-slate-300 italic' : 'text-slate-500'
                }`}
              >
                {descricao.trim() || 'Nenhuma instrução escrita.'}
              </p>

              <p className="text-[10.5px] text-slate-400 font-bold mt-1.5">{detalhes}</p>

              {prazo && (
                <p className="text-[10.5px] text-slate-400 font-bold mt-0.5">
                  Prazo {prazo.split('-').reverse().join('/')}
                </p>
              )}

              {totalDeMaterial > 0 && (
                <p className="text-[10.5px] font-bold text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3 shrink-0" />
                  {totalDeMaterial} {totalDeMaterial === 1 ? 'arquivo' : 'arquivos'} da missão
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quem recebe */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <p className="text-[9.5px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          Quem recebe
        </p>
        <p className="text-[11px] font-bold text-slate-600 mt-1 leading-snug">
          {designados.length === 0
            ? 'Todo o time do cliente'
            : designados.slice(0, 4).join(', ') +
              (designados.length > 4 ? ` e mais ${designados.length - 4}` : '')}
        </p>
      </div>

      {/* O que falta */}
      <div
        className={`rounded-xl border px-3 py-2.5 ${
          pronta ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'
        }`}
      >
        <p
          className={`text-[9.5px] uppercase font-black tracking-widest flex items-center gap-1.5 ${
            pronta ? 'text-emerald-700' : 'text-slate-400'
          }`}
        >
          {pronta ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {pronta ? 'Missão completa' : 'Dá para melhorar'}
        </p>
        {pronta ? (
          <p className="text-[11px] font-bold text-emerald-800 mt-1 leading-snug">
            Título, instrução, turno, prioridade e destinatários preenchidos.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {pendencias.map(p => (
              <li
                key={p.texto}
                className={`text-[10.5px] font-semibold leading-snug flex items-start gap-1.5 ${
                  p.trava ? 'text-rose-700' : 'text-slate-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                    p.trava ? 'bg-rose-500' : 'bg-slate-300'
                  }`}
                />
                {p.texto}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
