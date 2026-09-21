import React from 'react';
import { Check } from 'lucide-react';
import { VERDE, vibrar } from './pecas';

export interface EtapaDaTrilha {
  numero: number;
  rotulo: string;
  icone: React.ReactNode;
  /** Já confirmada: o selo fica verde e a etapa volta a ser tocável. */
  feita: boolean;
}

/**
 * A trilha das etapas, no alto da tela.
 *
 * Os cinco pontinhos de antes diziam "etapa 3 de 5" e mais nada: não davam
 * nome ao que já tinha sido feito, não diziam o que vinha depois e não
 * levavam a lugar nenhum. Para corrigir uma foto era preciso chegar até a
 * revisão, lá embaixo, e achar o "corrigir" certo.
 *
 * Aqui cada etapa tem nome, ícone e estado — e etapa já confirmada é um botão:
 * um toque volta para ela. Etapa que ainda não chegou fica apagada, porque
 * pular para a frente sem confirmar a de agora só produziria check-in pela
 * metade.
 */
export default function Trilha({
  etapas,
  atual,
  onIr
}: {
  etapas: EtapaDaTrilha[];
  atual: number;
  onIr: (numero: number) => void;
}) {
  return (
    <div className="flex items-start gap-0.5 px-1">
      {etapas.map((etapa, i) => {
        const eAtual = etapa.numero === atual;
        const acessivel = etapa.feita && !eAtual;
        const anterior = etapas[i - 1];

        return (
          <React.Fragment key={etapa.numero}>
            {i > 0 && (
              <span
                className="flex-1 h-0.5 rounded-full mt-[17px] transition-colors"
                style={{
                  backgroundColor: anterior?.feita ? VERDE : 'rgba(255,255,255,0.18)'
                }}
              />
            )}
            <button
              type="button"
              disabled={!acessivel}
              onClick={() => {
                if (!acessivel) return;
                vibrar();
                onIr(etapa.numero);
              }}
              title={acessivel ? `Voltar para ${etapa.rotulo}` : etapa.rotulo}
              className={`shrink-0 w-[60px] flex flex-col items-center gap-1 pt-1 pb-0.5 rounded-xl transition-all ${
                acessivel ? 'cursor-pointer active:scale-95' : 'cursor-default'
              }`}
            >
              <span
                className={`w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all ${
                  etapa.feita && !eAtual ? 'ck-selo' : ''
                }`}
                style={{
                  backgroundColor: etapa.feita
                    ? VERDE
                    : eAtual
                      ? '#FFFFFF'
                      : 'rgba(255,255,255,0.14)',
                  color: etapa.feita ? '#FFFFFF' : eAtual ? '#0C3556' : 'rgba(255,255,255,0.55)',
                  boxShadow: eAtual ? '0 0 0 3px rgba(255,255,255,0.22)' : undefined
                }}
              >
                {etapa.feita && !eAtual ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : etapa.icone}
              </span>
              <span
                className="text-[9.5px] font-black uppercase tracking-wide leading-none truncate max-w-full"
                style={{
                  color: eAtual
                    ? '#FFFFFF'
                    : etapa.feita
                      ? 'rgba(255,255,255,0.78)'
                      : 'rgba(255,255,255,0.4)'
                }}
              >
                {etapa.rotulo}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
