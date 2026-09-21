import React from 'react';
import { Check, Users } from 'lucide-react';

/**
 * Para quem a missão vai — cliente e equipe.
 *
 * Este bloco existia duas vezes, palavra por palavra: uma no formulário da
 * área e outra no do ponto. Cento e setenta e cinco linhas iguais, que
 * precisavam ser corrigidas em dois lugares e, invariavelmente, um dia
 * deixariam de ser iguais. É o mesmo passo da mesma missão — área e ponto só
 * diferem em onde a coisa acontece, nunca em para quem ela vai.
 */

interface Props {
  /** Cliente dono da missão. Vazio quer dizer "geral". */
  clienteId: string;
  onClienteId: (id: string) => void;
  clientes: { id: string; name: string; office?: string }[];
  /**
   * Mostrar o seletor de cliente.
   *
   * Com o mapa já filtrado por um cliente, perguntar de quem é a missão é
   * repetir uma escolha que a pessoa acabou de fazer.
   */
  mostrarSeletor: boolean;
  /** O cliente que o mapa impõe, quando o seletor não aparece. */
  clienteDoMapa: string;

  equipe: any[];
  selecionados: string[];
  onSelecionados: (ids: string[]) => void;
}

const nomeDoIntegrante = (m: any) =>
  m.full_name || m.nome_completo || m.nome || m.name || 'Integrante';

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();

export default function DestinoDaMissao({
  clienteId,
  onClienteId,
  clientes,
  mostrarSeletor,
  clienteDoMapa,
  equipe,
  selecionados,
  onSelecionados
}: Props) {
  /*
   * Com o mapa filtrado por um cliente o seletor acima nem aparece: sem esta
   * volta, a edição de uma missão desse cliente ficava sem equipe nenhuma
   * para marcar.
   */
  const clienteAtivo = clienteId || clienteDoMapa || '';
  const daEquipe = equipe.filter(
    s => s.candidate_id === clienteAtivo || s.candidateId === clienteAtivo
  );

  const alternar = (id: string) =>
    onSelecionados(
      selecionados.includes(id)
        ? selecionados.filter(x => x !== id)
        : [...selecionados, id]
    );

  const todosMarcados = daEquipe.length > 0 && selecionados.length === daEquipe.length;

  return (
    <div className="space-y-4">
      {mostrarSeletor && (
        <div>
          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
            Cliente Associado à Missão
          </label>
          <select
            value={clienteId}
            onChange={e => onClienteId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-2xs cursor-pointer"
          >
            <option value="">Geral / Sem Cliente</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.office || 'Cliente'})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">
            Direcionar à equipe
          </label>
          {daEquipe.length > 1 && (
            <button
              type="button"
              onClick={() => onSelecionados(todosMarcados ? [] : daEquipe.map(d => d.id))}
              className="text-[10px] uppercase font-black tracking-wider text-indigo-600 hover:text-indigo-700 cursor-pointer shrink-0"
            >
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          )}
        </div>

        <p className="text-[10.5px] text-slate-500 font-medium leading-snug">
          {selecionados.length === 0
            ? 'Ninguém marcado: a missão aparece para todo o time do cliente.'
            : `${selecionados.length} ${
                selecionados.length === 1 ? 'pessoa recebe' : 'pessoas recebem'
              } esta missão no check-in.`}
        </p>

        {!clienteAtivo ? (
          <div className="text-[10.5px] text-slate-400 italic bg-white p-2.5 rounded-xl border border-slate-200 text-center">
            Selecione um cliente acima para carregar a sua equipe.
          </div>
        ) : daEquipe.length === 0 ? (
          <div className="text-[10.5px] text-amber-700 bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl font-semibold text-center">
            Nenhum integrante cadastrado na equipe deste cliente.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 border border-slate-200 rounded-xl p-2 max-h-[180px] overflow-y-auto bg-white shadow-xs">
            {daEquipe.map(pessoa => {
              const marcado = selecionados.includes(pessoa.id);
              const nome = nomeDoIntegrante(pessoa);
              const foto = pessoa.image || pessoa.foto_url || pessoa.photo || '';
              return (
                <button
                  type="button"
                  key={pessoa.id}
                  onClick={() => alternar(pessoa.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    marcado
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 text-slate-600'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                      marcado ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                    }`}
                  >
                    {marcado && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                  </span>
                  <span
                    className={`w-7 h-7 rounded-full overflow-hidden shrink-0 border flex items-center justify-center ${
                      marcado ? 'border-indigo-300 bg-indigo-100' : 'border-slate-200 bg-slate-100'
                    }`}
                  >
                    {foto ? (
                      <img
                        src={foto}
                        alt={nome}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={e => {
                          // Foto quebrada volta para as iniciais.
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase">
                        {iniciais(nome)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] leading-tight font-bold truncate">
                      {nome}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono leading-none truncate">
                      {pessoa.whatsapp || '—'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {daEquipe.length > 0 && selecionados.length === 0 && (
          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 pt-0.5">
            <Users className="w-3 h-3 shrink-0" />
            {daEquipe.length} {daEquipe.length === 1 ? 'pessoa vai ver' : 'pessoas vão ver'} esta
            missão.
          </p>
        )}
      </div>
    </div>
  );
}
