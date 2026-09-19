import React, { useMemo, useState } from 'react';
import { X, Search, Check, Users, CalendarDays, Flag, RotateCcw } from 'lucide-react';
import OperationIcon from './OperationIcon';
import { OperationType } from '../types';

/** Uma pessoa da equipe na lista do filtro, com o que ela já registrou. */
export interface PessoaDoFiltro {
  chave: string;
  nome: string;
  foto?: string;
  /** Check-ins dela dentro dos outros filtros ligados. Zero também aparece. */
  total: number;
  /** Já saiu da equipe, mas tem registros no histórico. */
  foraDaEquipe?: boolean;
}

export interface NivelDoFiltro {
  id: string;
  label: string;
  color: string;
}

interface FiltroCheckInsProps {
  aberto: boolean;
  onFechar: () => void;

  pessoas: PessoaDoFiltro[];
  pessoasSelecionadas: string[];
  onPessoas: (chaves: string[]) => void;

  /** Datas no formato do <input type="date">: aaaa-mm-dd. */
  de: string;
  ate: string;
  onPeriodo: (de: string, ate: string) => void;

  niveis: NivelDoFiltro[];
  niveisSelecionados: string[];
  onNiveis: (ids: string[]) => void;

  tipos: OperationType[];
  tiposSelecionados: string[];
  onTipos: (ids: string[]) => void;

  /** Quantos check-ins sobraram e quantos existem no total do cliente. */
  visiveis: number;
  total: number;
  onLimpar: () => void;
}

/** Liga ou desliga um item numa lista de selecionados. */
const alternar = (lista: string[], valor: string) =>
  lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor];

/** Data de hoje, ou de N dias atrás, no formato do input. */
const diaEm = (diasAtras: number) => {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toLocaleDateString('sv-SE');
};

/**
 * Filtro dos check-ins do mapa.
 *
 * O mapa cheio de pinos responde "onde a equipe esteve"; este painel responde
 * as perguntas que vêm depois — quem esteve, quando, com que urgência e
 * fazendo o quê. Os quatro cortes se combinam, e a contagem ao lado de cada
 * pessoa acompanha os outros filtros: com a semana passada marcada, o número
 * na foto é o da semana passada, não o de sempre.
 *
 * Quem tem zero continua na lista de propósito. Saber que alguém não
 * registrou nada é exatamente o tipo de coisa que um mapa esconde.
 */
export default function FiltroCheckIns({
  aberto,
  onFechar,
  pessoas,
  pessoasSelecionadas,
  onPessoas,
  de,
  ate,
  onPeriodo,
  niveis,
  niveisSelecionados,
  onNiveis,
  tipos,
  tiposSelecionados,
  onTipos,
  visiveis,
  total,
  onLimpar
}: FiltroCheckInsProps) {
  const [busca, setBusca] = useState('');
  /** Fotos que o navegador não conseguiu carregar caem para as iniciais. */
  const [fotosQuebradas, setFotosQuebradas] = useState<string[]>([]);

  const encontradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo
      ? pessoas.filter(p => p.nome.toLowerCase().includes(termo))
      : pessoas;
    // Quem mais registrou primeiro; empate resolve pelo nome.
    return [...lista].sort(
      (a, b) => b.total - a.total || a.nome.localeCompare(b.nome)
    );
  }, [pessoas, busca]);

  const semRegistro = pessoas.filter(p => p.total === 0).length;
  const filtrosLigados =
    pessoasSelecionadas.length +
    niveisSelecionados.length +
    tiposSelecionados.length +
    (de ? 1 : 0) +
    (ate ? 1 : 0);

  if (!aberto) return null;

  const atalho = (dias: number | null) => {
    if (dias === null) {
      onPeriodo('', '');
      return;
    }
    onPeriodo(diaEm(dias), diaEm(0));
  };

  const periodoAtivo = (dias: number | null) =>
    dias === null ? !de && !ate : de === diaEm(dias) && ate === diaEm(0);

  return (
    <div className="absolute left-[5.5rem] top-1/2 -translate-y-1/2 z-[1200] w-[340px] max-h-[86vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col font-sans animate-in fade-in slide-in-from-left-2 duration-150">
      {/* CABEÇALHO */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-black text-[#0D233A] leading-tight flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#015FC9]" />
              Filtrar check-ins
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              <span className="text-slate-700 font-black">{visiveis}</span> de{' '}
              {total} no mapa
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {filtrosLigados > 0 && (
              <button
                type="button"
                onClick={onLimpar}
                title="Limpar todos os filtros"
                className="h-8 px-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
              title="Fechar"
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-4">
        {/* PERÍODO */}
        <section>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5 mb-2">
            <CalendarDays className="w-3.5 h-3.5" />
            Período
          </h4>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { rotulo: 'Tudo', dias: null as number | null },
              { rotulo: 'Hoje', dias: 0 },
              { rotulo: '7 dias', dias: 6 },
              { rotulo: '30 dias', dias: 29 }
            ].map(op => (
              <button
                key={op.rotulo}
                type="button"
                onClick={() => atalho(op.dias)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                  periodoAtivo(op.dias)
                    ? 'bg-[#015FC9] border-[#015FC9] text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {op.rotulo}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[9.5px] uppercase tracking-wider font-black text-slate-400 mb-1">
                De
              </span>
              <input
                type="date"
                value={de}
                max={ate || undefined}
                onChange={e => onPeriodo(e.target.value, ate)}
                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11.5px] font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              />
            </label>
            <label className="block">
              <span className="block text-[9.5px] uppercase tracking-wider font-black text-slate-400 mb-1">
                Até
              </span>
              <input
                type="date"
                value={ate}
                min={de || undefined}
                onChange={e => onPeriodo(de, e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11.5px] font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* PRIORIDADE */}
        {niveis.length > 0 && (
          <section>
            <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5 mb-2">
              <Flag className="w-3.5 h-3.5" />
              Prioridade
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {niveis.map(nivel => {
                const marcado = niveisSelecionados.includes(nivel.id);
                return (
                  <button
                    key={nivel.id}
                    type="button"
                    onClick={() => onNiveis(alternar(niveisSelecionados, nivel.id))}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                      marcado
                        ? 'text-white border-transparent'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    style={marcado ? { backgroundColor: nivel.color } : undefined}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: marcado ? '#ffffff' : nivel.color }}
                    />
                    {nivel.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* TIPO DE AÇÃO */}
        {tipos.length > 0 && (
          <section>
            <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">
              Tipo de ação
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {tipos.map(tipo => {
                const marcado = tiposSelecionados.includes(tipo.id);
                return (
                  <button
                    key={tipo.id}
                    type="button"
                    onClick={() => onTipos(alternar(tiposSelecionados, tipo.id))}
                    className={`pl-1 pr-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border max-w-full ${
                      marcado
                        ? 'text-white border-transparent'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    style={marcado ? { backgroundColor: tipo.color } : undefined}
                  >
                    <span
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: marcado ? 'rgba(255,255,255,.25)' : tipo.color }}
                    >
                      <OperationIcon icon={tipo.icon} size={11} />
                    </span>
                    <span className="truncate">{tipo.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* EQUIPE */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400">
              Equipe ({pessoas.length})
            </h4>
            <div className="flex items-center gap-2">
              {pessoasSelecionadas.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPessoas([])}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Todos
                </button>
              )}
              {/* Atalho para o caso mais pedido: quem esteve em campo. */}
              {semRegistro > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onPessoas(pessoas.filter(p => p.total > 0).map(p => p.chave))
                  }
                  className="text-[10px] font-black uppercase tracking-wider text-[#015FC9] hover:underline cursor-pointer"
                >
                  Só com registro
                </button>
              )}
            </div>
          </div>

          <div className="relative flex items-center bg-white border border-slate-200 rounded-xl h-9 px-2.5 mb-2 focus-within:ring-2 focus-within:ring-blue-500/20">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar integrante..."
              className="bg-transparent border-none w-full text-[11.5px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1">
            {encontradas.length === 0 ? (
              <p className="py-6 text-center text-[10.5px] font-bold uppercase tracking-widest text-slate-300">
                Ninguém encontrado
              </p>
            ) : (
              encontradas.map(pessoa => {
                const marcado = pessoasSelecionadas.includes(pessoa.chave);
                const zerado = pessoa.total === 0;
                return (
                  <button
                    key={pessoa.chave}
                    type="button"
                    onClick={() => onPessoas(alternar(pessoasSelecionadas, pessoa.chave))}
                    className={`w-full flex items-center gap-2.5 p-1.5 rounded-xl border cursor-pointer transition-all text-left ${
                      marcado
                        ? 'bg-[#EFF4FB] border-[#015FC9]/40'
                        : 'bg-white border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-black uppercase border ${
                        zerado
                          ? 'bg-slate-100 border-slate-200 text-slate-400'
                          : 'bg-slate-100 border-slate-200 text-[#015FC9]'
                      }`}
                    >
                      {pessoa.foto && !fotosQuebradas.includes(pessoa.chave) ? (
                        <img
                          src={pessoa.foto}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFotosQuebradas(f =>
                              f.includes(pessoa.chave) ? f : [...f, pessoa.chave]
                            )
                          }
                          className={`w-full h-full object-cover ${zerado ? 'grayscale opacity-70' : ''}`}
                        />
                      ) : (
                        (pessoa.nome || '??').substring(0, 2)
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-black text-slate-800 truncate leading-tight">
                        {pessoa.nome}
                      </span>
                      <span
                        className={`block text-[10px] font-bold ${
                          zerado ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {pessoa.foraDaEquipe
                          ? 'fora da equipe'
                          : zerado
                            ? 'sem registro no período'
                            : `${pessoa.total} ${pessoa.total === 1 ? 'check-in' : 'check-ins'}`}
                      </span>
                    </span>

                    <span
                      className={`shrink-0 min-w-[26px] h-6 px-1.5 rounded-lg text-[11px] font-black flex items-center justify-center ${
                        zerado
                          ? 'bg-slate-50 text-slate-300'
                          : 'bg-[#EFF4FB] text-[#015FC9]'
                      }`}
                    >
                      {pessoa.total}
                    </span>

                    {marcado && (
                      <Check className="w-3.5 h-3.5 text-[#015FC9] stroke-[3] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* RODAPÉ */}
      <div className="px-4 py-3 border-t border-slate-100 shrink-0 flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-bold text-slate-400">
          {filtrosLigados === 0
            ? 'Nenhum filtro ligado'
            : `${filtrosLigados} ${filtrosLigados === 1 ? 'filtro' : 'filtros'} ligado${filtrosLigados === 1 ? '' : 's'}`}
        </p>
        <button
          type="button"
          onClick={onFechar}
          className="h-8 px-4 bg-[#015FC9] hover:bg-[#0150ab] text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95"
        >
          Ver no mapa
        </button>
      </div>
    </div>
  );
}
