import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Brain, Loader2, Maximize2, Minimize2, X } from 'lucide-react';

export const MIND_MAP_URL = 'https://mapamental.prospectai.chat/';

interface MindMapPanelProps {
  open: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
}

/**
 * Mapa Mental embutido.
 *
 * Encostado no lado direito ele ocupa metade da tela e o sistema continua
 * inteiro na outra metade; em tela cheia cobre tudo. O iframe é montado uma
 * vez só e fica vivo enquanto o painel estiver aberto — trocar de metade da
 * tela para tela cheia não recarrega o que a pessoa estava fazendo lá dentro.
 */
export default function MindMapPanel({
  open,
  fullscreen,
  onToggleFullscreen,
  onClose
}: MindMapPanelProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Cada abertura mostra o "carregando" de novo, já que o iframe é remontado.
  useEffect(() => {
    if (open) setIsLoading(true);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 60 }}
          transition={{ type: 'spring', damping: 28, stiffness: 250 }}
          className={
            fullscreen
              ? 'fixed inset-0 z-[3200] bg-white flex flex-col font-sans'
              : 'order-3 h-full w-1/2 min-w-[300px] shrink-0 bg-white border-l border-slate-200 shadow-2xl z-[1002] flex flex-col font-sans'
          }
        >
          <header className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/90 border border-indigo-500/60 flex items-center justify-center shrink-0">
                <Brain className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm leading-tight truncate">
                  Mapa Mental
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold leading-none mt-1 truncate">
                  mapamental.prospectai.chat
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={fullscreen ? 'Voltar para meia tela' : 'Abrir em tela cheia'}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer"
              >
                {fullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Fechar Mapa Mental"
                className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 border border-rose-500/70 text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          <div className="relative flex-grow bg-slate-50">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 z-10 pointer-events-none">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Carregando o Mapa Mental...
                </p>
              </div>
            )}
            <iframe
              src={MIND_MAP_URL}
              title="Mapa Mental"
              onLoad={() => setIsLoading(false)}
              allow="clipboard-read; clipboard-write; fullscreen"
              className="w-full h-full border-0 block"
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
