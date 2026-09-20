import React from 'react';
import { AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import { Cartao, Campo, EstadoDoCartao } from './pecas';

/**
 * Para onde vai quem abre um domínio de acesso sem link.
 *
 * Os domínios existem para receber quem veio de um QR Code ou do link da
 * equipe. Quem digita o endereço na barra, sem link, não pode cair na porta
 * de entrada do sistema — é mandado para fora.
 */
export default function SecaoAcesso({
  valor,
  onMudar,
  padrao,
  dominios,
  estado
}: {
  valor: string;
  onMudar: (valor: string) => void;
  padrao: string;
  dominios: string[];
  estado: EstadoDoCartao;
}) {
  const limpo = valor.trim();
  const invalido = limpo.length > 0 && !/^https?:\/\//i.test(limpo);
  const destino = limpo || padrao;

  return (
    <Cartao
      id="acesso"
      titulo="Acesso aos domínios"
      subtitulo="Quem chega sem link não vê o sistema."
      Icone={ShieldCheck}
      estado={estado}
    >
      <div className="pt-4 space-y-3">
        <Campo rotulo="Quem abrir o domínio sem link vai para">
          <div
            className={`bg-white border rounded-xl flex items-center px-3.5 transition-colors ${
              invalido
                ? 'border-rose-300 focus-within:ring-2 focus-within:ring-rose-500/20'
                : 'border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20'
            }`}
          >
            <ExternalLink className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
            <input
              type="url"
              value={valor}
              onChange={e => onMudar(e.target.value)}
              placeholder={padrao}
              className="w-full py-2.5 bg-transparent border-none text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
            />
            <a
              href={destino}
              target="_blank"
              rel="noreferrer noopener"
              title="Abrir este endereço numa aba nova"
              className="shrink-0 ml-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-[#015FC9] hover:bg-slate-50 cursor-pointer"
            >
              Testar
            </a>
          </div>
        </Campo>

        {invalido && (
          <p className="flex items-start gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            O endereço precisa começar com http:// ou https://.
          </p>
        )}

        <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
          Em branco, vai para{' '}
          <span className="font-bold text-slate-600">{padrao}</span>.
        </p>

        {dominios.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-black tracking-widest text-[#8492A6] mb-1.5">
              A regra vale para
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dominios.map(dominio => (
                <span
                  key={dominio}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-500"
                >
                  {dominio}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Cartao>
  );
}
