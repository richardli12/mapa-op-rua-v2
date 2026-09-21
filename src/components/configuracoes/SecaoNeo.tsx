import { Brain, RotateCcw } from 'lucide-react';
import { Cartao, Campo, EstadoDoCartao } from './pecas';
import { PROMPT_NEO_PADRAO } from '../../neo';

/**
 * O prompt do NEO, editável por quem opera.
 *
 * O NEO lê a missão inteira e escreve o relatório. O que ele procura, o que
 * ele nunca afirma sem prova e o tom com que fala saem daqui — e não do código
 * — porque quem sabe o que importa numa missão desta operação é quem está
 * nela. Mudar a pergunta que o analista faz não deveria exigir um deploy.
 *
 * O campo é grande de propósito: um prompt bom tem parágrafos, e editá-lo numa
 * fresta de três linhas é como escrever uma carta pelo visor de um relógio.
 */
export default function SecaoNeo({
  valor,
  onMudar,
  estado
}: {
  valor: string;
  onMudar: (valor: string) => void;
  estado: EstadoDoCartao;
}) {
  const vazio = valor.trim().length === 0;
  const noPadrao = valor.trim() === PROMPT_NEO_PADRAO.trim();

  return (
    <Cartao
      id="neo"
      titulo="NEO — relatório de missão"
      subtitulo="As instruções que regem a análise."
      Icone={Brain}
      estado={estado}
      acessorio={
        !noPadrao && (
          <button
            type="button"
            onClick={() => onMudar(PROMPT_NEO_PADRAO)}
            title="Voltar ao texto de fábrica"
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-[#015FC9] hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Restaurar
          </button>
        )
      }
    >
      <div className="pt-4 space-y-3">
        <Campo
          rotulo="Instruções do NEO"
          dica="Vale para todo relatório gerado a partir de agora. O formato do documento (seções, campos) é fixo e não se edita aqui — o que se edita é como o NEO pensa e o que ele procura."
        >
          <textarea
            value={valor}
            onChange={e => onMudar(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder={PROMPT_NEO_PADRAO}
            className={`w-full px-3.5 py-3 bg-white border rounded-xl text-[11.5px] leading-relaxed font-medium text-slate-800 placeholder-slate-300 focus:outline-hidden focus:ring-2 resize-y ${
              vazio
                ? 'border-rose-300 focus:ring-rose-500/20'
                : 'border-slate-200 focus:ring-blue-500/20'
            }`}
          />
        </Campo>

        {vazio && (
          <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-snug">
            Sem instruções o NEO não roda. Escreva algo ou use "Restaurar" para
            voltar ao texto de fábrica.
          </p>
        )}

        <div className="text-[11px] text-slate-400 font-semibold leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 space-y-1.5">
          <p>
            <span className="font-black text-slate-600">O que o NEO recebe:</span>{' '}
            a ordem da missão, quem recebeu, onde e quando, o material de apoio,
            as narrativas, o feedback orgânico e tudo que voltou da rua — fotos,
            observações escritas e áudios transcritos.
          </p>
          <p>
            <span className="font-black text-slate-600">O que ele não recebe:</span>{' '}
            vídeos, que não são assistidos nesta versão, e o que passar dos
            limites de 20 imagens e 6 áudios por missão. O relatório declara no
            rodapé o que ficou de fora.
          </p>
        </div>
      </div>
    </Cartao>
  );
}
