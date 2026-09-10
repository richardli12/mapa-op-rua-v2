import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, X } from 'lucide-react';

/**
 * Pedido de confirmação exibido no meio da tela do sistema.
 *
 * Substitui o `confirm()` do navegador: aquele balão cinza aparecia colado no
 * topo da janela, com a cara do Chrome, e não do sistema.
 */
export interface ConfirmRequest {
  title: string;
  message: string;
  /** Segunda linha, para o aviso do que a ação leva junto. */
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' pinta o botão de vermelho (exclusões). */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
}

interface ConfirmDialogProps {
  request: ConfirmRequest | null;
  onClose: () => void;
}

export default function ConfirmDialog({ request, onClose }: ConfirmDialogProps) {
  // Esc fecha, como em qualquer caixa de diálogo.
  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, onClose]);

  const isDanger = request?.tone !== 'default';

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[4000] font-sans"
        >
          <motion.div
            initial={{ scale: 0.92, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-4 text-slate-800 text-left"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  isDanger
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-grow">
                <h3 className="font-extrabold text-indigo-950 text-base leading-tight">
                  {request.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-snug">
                  {request.message}
                </p>
                {request.details && (
                  <p
                    className={`text-[11px] mt-2 leading-snug font-semibold px-2.5 py-1.5 rounded-lg border ${
                      isDanger
                        ? 'text-amber-700 bg-amber-50/70 border-amber-100'
                        : 'text-slate-600 bg-slate-50 border-slate-100'
                    }`}
                  >
                    {request.details}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-3xs"
              >
                {request.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  request.onConfirm();
                  onClose();
                }}
                className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 ${
                  isDanger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{request.confirmLabel || 'Confirmar'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
