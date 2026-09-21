import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { AZUL } from './pecas';

/** 'a foto, o ponto e o áudio' — vírgula até o penúltimo, "e" no último. */
const emLista = (itens: string[]) =>
  itens.length <= 1
    ? itens.join('')
    : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;

/**
 * A pergunta antes de jogar o check-in fora.
 *
 * O "voltar" do cabeçalho apagava tudo na hora: o rascunho no banco e cada
 * foto que já tinha subido para o Storage. Um toque errado no canto da tela,
 * depois de dez minutos de rua, e não sobrava nada — sem aviso, sem desfazer.
 *
 * Então ele passa por aqui, e a pergunta diz em números o que está em jogo.
 * Quando não há nada juntado ainda, esta folha nem aparece: perguntar sobre
 * uma tela vazia é só um toque a mais.
 */
export default function FolhaDeSaida({
  aberto,
  perdas,
  onFicar,
  onSair
}: {
  aberto: boolean;
  /** O que some se ela sair: 'duas fotos', 'um áudio'... */
  perdas: string[];
  onFicar: () => void;
  onSair: () => void;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[3600] flex flex-col justify-end sm:justify-center sm:items-center">
      <button
        type="button"
        aria-label="Continuar o check-in"
        onClick={onFicar}
        className="absolute inset-0 bg-slate-900/55 ck-veu cursor-pointer"
      />

      <div
        className="relative ck-folha bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 w-full sm:max-w-sm"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <span className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
          <TriangleAlert className="w-6 h-6 text-rose-500" />
        </span>

        <h3 className="mt-3.5 text-[17px] font-black leading-tight" style={{ color: AZUL }}>
          Sair sem gravar o check-in?
        </h3>
        <p className="mt-2 text-[12.5px] font-semibold text-slate-500 leading-snug">
          {perdas.length > 0 ? (
            <>
              Você perde {emLista(perdas)}. Nada disso fica salvo: o comitê não
              vai ver este check-in.
            </>
          ) : (
            <>O que você preencheu até aqui não será gravado.</>
          )}
        </p>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onSair}
            className="flex-1 h-[50px] text-[12.5px] font-black uppercase tracking-wider rounded-2xl border border-rose-200 text-rose-600 cursor-pointer transition-all active:scale-[0.98]"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={onFicar}
            className="flex-[1.3] h-[50px] text-white text-[12.5px] font-black uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
            style={{ backgroundColor: AZUL }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
