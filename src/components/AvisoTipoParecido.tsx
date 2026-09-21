import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import OperationIcon from './OperationIcon';
import type { OperationType } from '../types';

/**
 * Aviso de Tipo de Operação repetido, no meio da tela.
 *
 * Não é uma confirmação comum, e por isso não usa o ConfirmDialog: ali as duas
 * saídas são "confirmar" e "cancelar", e aqui nenhuma das duas é cancelar. A
 * pessoa está decidindo entre dois caminhos bons — aproveitar o tipo que já
 * existe ou criar o dela assim mesmo — e a tela precisa mostrar o tipo achado
 * com a cara que ele tem na lista, senão a escolha é feita no escuro.
 *
 * O caminho recomendado vem primeiro e pintado: repetir tipo quebra relatório,
 * e desfazer isso depois custa uma mescla.
 */
export default function AvisoTipoParecido({
  novoNome,
  existente,
  motivo,
  onUsarExistente,
  onCriarAssimMesmo,
  onFechar
}: {
  /** O que a pessoa acabou de digitar. */
  novoNome: string;
  /** O tipo já cadastrado que significa a mesma coisa. */
  existente: OperationType | null;
  /** Explicação do modelo. Pode faltar — e a tela não depende dela. */
  motivo: string | null;
  onUsarExistente: () => void;
  onCriarAssimMesmo: () => void;
  onFechar: () => void;
}) {
  // Esc fecha sem decidir nada, como em qualquer caixa de diálogo.
  useEffect(() => {
    if (!existente) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [existente, onFechar]);

  return (
    <AnimatePresence>
      {existente && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onFechar}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[4000] font-sans"
        >
          <motion.div
            initial={{ scale: 0.92, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            onClick={e => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-4 text-slate-800 text-left"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 border border-amber-100">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0 grow">
                <h3 className="font-extrabold text-indigo-950 text-base leading-tight">
                  Já existe um tipo para isso
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-snug">
                  O que você registraria em{' '}
                  <span className="font-bold text-slate-700">"{novoNome}"</span>{' '}
                  já cabe num tipo que este cliente usa hoje.
                </p>
              </div>
              <button
                type="button"
                onClick={onFechar}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* O tipo achado, com a cara que ele tem na lista. */}
            <div
              className="flex items-center gap-3 p-3 rounded-2xl border bg-slate-50/80 border-slate-100"
              style={{ borderLeftWidth: '5px', borderLeftColor: existente.color }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                style={{ backgroundColor: existente.color }}
              >
                <OperationIcon icon={existente.icon} size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-sm text-indigo-950 leading-tight truncate">
                  {existente.label}
                </p>
                {existente.description && (
                  <p className="text-[11px] text-slate-500 leading-snug truncate">
                    {existente.description}
                  </p>
                )}
              </div>
            </div>

            {motivo && (
              <p className="text-[11px] leading-snug font-semibold text-amber-800 bg-amber-50/70 border border-amber-100 px-2.5 py-2 rounded-lg">
                {motivo}
              </p>
            )}

            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
              Dois tipos para a mesma coisa dividem o número ao meio: o painel
              mostra seis e oito onde deveria haver catorze.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
              <button
                type="button"
                onClick={onCriarAssimMesmo}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-3xs"
              >
                Criar mesmo assim
              </button>
              <button
                type="button"
                autoFocus
                onClick={onUsarExistente}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <span>Usar "{existente.label}"</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
