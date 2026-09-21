import React from 'react';
import { ChevronLeft, Loader2, Navigation, Target, WifiOff } from 'lucide-react';
import {
  COR_DO_TURNO,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TurnoId,
  janelaDoTurno,
  situacaoDoTurno
} from '../../turnos';
import { IconeDoTurno } from '../TurnoEPrioridade';
import { AZUL, AZUL_CLARO, Avatar, AnelDeProgresso, VERDE, vibrar } from './pecas';
import Trilha, { EtapaDaTrilha } from './Trilha';

/**
 * O cabeçalho vivo do check-in.
 *
 * Antes eram um "voltar" e o título "Check-in de campo" — três centímetros de
 * tela dizendo o que a pessoa já sabia. O que ela não sabia estava tudo
 * escondido: se o GPS já tinha pegado, se ainda havia sinal, em que turno da
 * campanha ela estava, e quanto faltava para a meta do dia.
 *
 * Agora é isso que o alto da tela diz, em três linhas: quem é e para quem
 * está trabalhando, como está o mundo em volta (turno, GPS, conexão) e em que
 * ponto da conversa ela está. O anel da meta é um botão: toca e abre o dia
 * inteiro.
 */
export default function Cabecalho({
  nome,
  foto,
  online,
  precisao,
  buscandoGps,
  turnoAgora,
  janelas,
  meta,
  etapas,
  etapaAtual,
  onIr,
  onSair,
  onAbrirDia
}: {
  nome: string;
  foto?: string;
  online: boolean;
  precisao: number | null;
  buscandoGps: boolean;
  turnoAgora: TurnoId | null;
  janelas: JanelaDeTurno[];
  /** Sem meta cadastrada o anel não aparece: não há o que cobrar. */
  meta: { feito: number; alvo: number; rotulo: string; cor: string } | null;
  etapas: EtapaDaTrilha[];
  etapaAtual: number;
  onIr: (numero: number) => void;
  onSair: () => void;
  onAbrirDia: () => void;
}) {
  const situacao = turnoAgora ? situacaoDoTurno(janelaDoTurno(janelas, turnoAgora)) : null;

  /**
   * O quanto o ponto é confiável, em palavras.
   *
   * "Precisão 8 m" é número de engenheiro. Na rua o que decide é se dá para
   * confiar no pino ou se é melhor arrastar ele um pouco.
   */
  const qualidadeDoGps =
    precisao === null
      ? null
      : precisao <= 15
        ? { texto: `Sinal ótimo · ${precisao} m`, cor: '#5EEAD4' }
        : precisao <= 40
          ? { texto: `Sinal bom · ${precisao} m`, cor: '#FDE68A' }
          : { texto: `Sinal fraco · ${precisao} m`, cor: '#FCA5A5' };

  return (
    <header
      className="text-white shrink-0"
      style={{
        background: `linear-gradient(180deg, ${AZUL} 0%, ${AZUL_CLARO} 100%)`,
        paddingTop: 'env(safe-area-inset-top)'
      }}
    >
      {/* Quem é, para quem, e quanto falta */}
      <div className="px-2.5 pt-2.5 flex items-center gap-2.5">
        <button
          onClick={onSair}
          className="w-10 h-10 -ml-0.5 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Sair do check-in"
          aria-label="Sair do check-in"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="shrink-0 rounded-full p-[2px]" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
          <Avatar nome={nome} foto={foto} tamanho={34} />
        </span>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[14.5px] font-black truncate">{nome}</p>
          {/* O nome do cliente não entra aqui: esta tela abre no aparelho de
              quem está na rua, muitas vezes à vista de terceiros, e a campanha
              a que o registro pertence não é informação dela. */}
          <p className="text-[11px] font-bold text-white/60 truncate">
            Check-in de campo
          </p>
        </div>

        {meta && meta.alvo > 0 && (
          <button
            type="button"
            onClick={() => {
              vibrar();
              onAbrirDia();
            }}
            title="Ver o seu dia"
            aria-label="Ver o seu dia"
            className="shrink-0 flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-2xl bg-white/10 hover:bg-white/15 cursor-pointer active:scale-95 transition-all"
          >
            <AnelDeProgresso
              feito={meta.feito}
              alvo={meta.alvo}
              tamanho={34}
              espessura={3.5}
              cor={meta.feito >= meta.alvo ? VERDE : meta.cor}
            >
              <Target className="w-3 h-3 text-white/85" />
            </AnelDeProgresso>
            <span className="text-left leading-none">
              <span className="block text-[13px] font-black tabular-nums">
                {meta.feito}
                <span className="text-white/45">/{meta.alvo}</span>
              </span>
              <span className="block text-[8.5px] font-black uppercase tracking-wider text-white/50 mt-0.5">
                {meta.rotulo}
              </span>
            </span>
          </button>
        )}
      </div>

      {/* O mundo em volta: turno, GPS, conexão */}
      <div className="px-3 pt-2 flex items-center gap-1.5 overflow-x-auto rolagem-invisivel">
        {situacao && turnoAgora ? (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[10.5px] font-black"
            style={{
              backgroundColor: `${COR_DO_TURNO[turnoAgora]}2E`,
              color: '#FFFFFF'
            }}
          >
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: COR_DO_TURNO[turnoAgora] }}
            >
              <IconeDoTurno turno={turnoAgora} className="w-2.5 h-2.5 text-white" />
            </span>
            {NOME_DO_TURNO[turnoAgora]} · {situacao.curto}
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10.5px] font-black text-white/70">
            Check-in fora de turno
          </span>
        )}

        {buscandoGps && precisao === null ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10.5px] font-black text-white/70">
            <Loader2 className="w-3 h-3 animate-spin" />
            Procurando o GPS
          </span>
        ) : qualidadeDoGps ? (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10.5px] font-black"
            style={{ color: qualidadeDoGps.cor }}
          >
            <Navigation className="w-3 h-3" />
            {qualidadeDoGps.texto}
          </span>
        ) : null}

        {!online && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400 text-[10.5px] font-black text-amber-950">
            <WifiOff className="w-3 h-3" />
            Sem conexão
          </span>
        )}
      </div>

      {/* Onde a conversa está */}
      <div className="px-2 pt-2 pb-1.5">
        <Trilha etapas={etapas} atual={etapaAtual} onIr={onIr} />
      </div>
    </header>
  );
}
