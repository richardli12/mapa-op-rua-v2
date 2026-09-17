import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import OperationIcon from './OperationIcon';
import { OperationType } from '../types';

interface OperationTypeSelectProps {
  /** Tipos do cliente em foco. */
  types: OperationType[];
  /** Id do tipo escolhido. Vazio quando o ponto ainda não tem tipo. */
  value: string;
  onChange: (id: string) => void;
  /** Cor do anel de foco, para combinar com o formulário onde está. */
  accent?: 'orange' | 'indigo';
}

/**
 * Escolha do Tipo de Operação mostrando o ícone de cada tipo.
 *
 * Um <select> nativo só aceita texto nas opções, então a lista é desenhada à
 * mão: é o único jeito de cada tipo aparecer com o ícone e a cor que quem
 * cadastrou escolheu.
 */
export default function OperationTypeSelect({
  types,
  value,
  onChange,
  accent = 'indigo'
}: OperationTypeSelectProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const selected = types.find(t => t.id === value);

  // Fecha ao clicar fora ou no Esc, como um dropdown nativo faria.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ring = accent === 'orange' ? 'focus:ring-orange-500' : 'focus:ring-indigo-500';
  const marca = accent === 'orange' ? 'bg-orange-50' : 'bg-indigo-50';

  return (
    <div className="relative w-full min-w-0" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 ${ring}`}
      >
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: selected?.color || '#94a3b8' }}
        >
          <OperationIcon icon={selected?.icon} size={15} />
        </span>
        <span className={`flex-1 text-left truncate ${selected ? '' : 'text-slate-400'}`}>
          {selected ? selected.label : 'Sem tipo definido'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-[2000] mt-1.5 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-1">
          {types.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic px-2.5 py-2">
              Nenhum tipo cadastrado para este cliente.
            </p>
          ) : (
            types.map(type => {
              const ativo = type.id === value;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    onChange(type.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                    ativo ? marca : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: type.color }}
                  >
                    <OperationIcon icon={type.icon} size={15} />
                  </span>
                  <span className="flex-1 truncate text-slate-800">{type.label}</span>
                  {ativo && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
