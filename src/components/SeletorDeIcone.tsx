import React, { useState } from 'react';
import { PenTool } from 'lucide-react';
import { OPERATION_ICONS } from '../operationIcons';
import { ehIconeNeo } from '../iconeSvg';
import OperationIcon from './OperationIcon';
import GeradorDeIconeNeo from './GeradorDeIconeNeo';

/**
 * A escolha do ícone do tipo de operação: a biblioteca, e o NEO para quando
 * a biblioteca não tem o que se procura.
 *
 * O ícone desenhado pelo NEO entra como a primeira casa da grade, marcada com
 * a sigla NEO — é o ícone deste tipo, e fica à vista junto dos outros para dar
 * para trocar de ideia com um clique.
 */
export default function SeletorDeIcone({
  valor,
  onMudar,
  cor,
  nome,
  descricao,
  compacto = false
}: {
  valor: string;
  onMudar: (icone: string) => void;
  cor: string;
  /** O nome do tipo: é dele que o NEO parte. */
  nome: string;
  descricao?: string;
  /** Grade mais apertada (o gerenciador de tipos, que é mais estreito). */
  compacto?: boolean;
}) {
  const [estudioAberto, setEstudioAberto] = useState(false);
  const [iconeDoNeo, setIconeDoNeo] = useState<string | null>(ehIconeNeo(valor) ? valor : null);
  const neoAtual = ehIconeNeo(valor) ? valor : iconeDoNeo;
  const semNome = !nome.trim();

  const casa = (icone: string, rotulo: string, doNeo = false) => {
    const ativo = valor === icone;
    return (
      <button
        key={doNeo ? 'neo' : icone}
        type="button"
        title={rotulo}
        onClick={() => onMudar(icone)}
        className={`relative aspect-square rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
          ativo
            ? 'border-transparent text-white shadow-md scale-105'
            : doNeo
              ? 'border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100'
              : 'border-slate-200 bg-slate-50/60 text-slate-500 hover:bg-slate-100'
        }`}
        style={ativo ? { backgroundColor: cor } : undefined}
      >
        <OperationIcon icon={icone} size={compacto ? 15 : 18} />
        {doNeo && (
          <span className="absolute -top-1.5 -right-2 px-1 h-3.5 rounded-md bg-violet-600 border border-white text-[7px] font-black leading-none text-white flex items-center">
            NEO
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div
        className={`grid gap-1.5 max-h-44 overflow-y-auto p-2 -m-1.5 ${
          compacto ? 'grid-cols-7 sm:grid-cols-10' : 'grid-cols-8'
        }`}
      >
        {neoAtual && casa(neoAtual, 'Desenhado pelo NEO', true)}
        {OPERATION_ICONS.map((i) => casa(i.key, i.label))}
      </div>

      <button
        type="button"
        disabled={semNome}
        onClick={() => setEstudioAberto(true)}
        title={semNome ? 'Escreva o nome do tipo primeiro: é dele que o NEO parte.' : undefined}
        className="neo-botao group relative w-full h-11 rounded-xl overflow-hidden text-[12px] font-black flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        <PenTool className="w-4 h-4 transition-transform group-enabled:group-hover:-rotate-12" />
        Gerar ícone com NEO
      </button>
      {semNome && (
        <p className="text-[10.5px] font-semibold text-slate-400">
          Escreva o nome do tipo e o NEO desenha um ícone a partir dele.
        </p>
      )}

      {estudioAberto && (
        <GeradorDeIconeNeo
          nome={nome}
          descricao={descricao}
          cor={cor}
          iconeAtual={valor}
          onFechar={() => setEstudioAberto(false)}
          onConfirmar={(icone) => {
            if (ehIconeNeo(icone)) setIconeDoNeo(icone);
            onMudar(icone);
            setEstudioAberto(false);
          }}
        />
      )}
    </div>
  );
}
