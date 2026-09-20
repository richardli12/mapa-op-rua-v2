import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Flag, Loader2, Plus, Save, Trash2, Pencil, X } from 'lucide-react';
import { Cartao } from './pecas';
import { PriorityLevel } from '../../types';

/**
 * Os níveis de prioridade.
 *
 * A lista é do cliente, não do sistema: prefeitura fala em "risco imediato",
 * campanha fala em "hoje ainda". O que o administrador escreve aqui é o que
 * aparece no check-in da rua e no formulário da missão.
 *
 * A ordem importa e não é decoração: o resto do sistema lê os dois últimos
 * níveis desta lista como "o que é grave" — é assim que a Sala de situação
 * sabe o que contar em "Graves" e a lista da rua sabe o que pôr na frente.
 */
export default function SecaoPrioridades({
  niveis,
  onSalvar,
  onRemover,
  onReordenar,
  ligado
}: {
  niveis: PriorityLevel[];
  onSalvar: (nivel: PriorityLevel) => Promise<boolean>;
  onRemover: (nivel: PriorityLevel) => Promise<boolean>;
  onReordenar: (lista: PriorityLevel[]) => Promise<void>;
  ligado: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rotulo, setRotulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState('#f59e0b');
  const [salvando, setSalvando] = useState(false);
  /** Remover um nível deixa registros antigos órfãos: pede confirmação na linha. */
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<string | null>(null);

  const limpar = () => {
    setEditando(null);
    setRotulo('');
    setDescricao('');
    setCor('#f59e0b');
  };

  /** Id legível e estável, derivado do nome — é ele que fica no check-in. */
  const idDoRotulo = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);

  const salvar = async () => {
    const nome = rotulo.trim();
    if (!nome) return;
    const id = editando || idDoRotulo(nome) || `nivel_${Date.now()}`;
    setSalvando(true);
    const ok = await onSalvar({
      id,
      label: nome,
      description: descricao.trim(),
      color: cor,
      position: editando
        ? (niveis.find(n => n.id === editando)?.position ?? niveis.length)
        : niveis.length
    });
    setSalvando(false);
    if (ok) limpar();
  };

  const mover = async (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= niveis.length) return;
    const lista = [...niveis];
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    await onReordenar(lista);
  };

  /** Os dois de cima na régua de gravidade — o resto do sistema lê assim. */
  const idsGraves = [...niveis]
    .sort((a, b) => b.position - a.position)
    .slice(0, 2)
    .map(n => n.id);

  return (
    <Cartao
      id="prioridades"
      titulo="Níveis de prioridade"
      subtitulo="A lista é sua: crie, edite, ordene e remova."
      Icone={Flag}
      acessorio={
        niveis.length > 0 && (
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {niveis.length} {niveis.length === 1 ? 'nível' : 'níveis'}
          </span>
        )
      }
    >
      <div className="pt-4 space-y-2">
        {niveis.length === 0 ? (
          <p className="text-[11px] text-slate-400 font-semibold py-5 text-center border border-dashed border-slate-200 rounded-2xl">
            Nenhum nível criado ainda. Sem eles, missão e check-in ficam sem
            régua de urgência.
          </p>
        ) : (
          niveis.map((nivel, i) => {
            const grave = idsGraves.includes(nivel.id) && niveis.length > 2;
            const confirmando = confirmandoRemocao === nivel.id;
            return (
              <div
                key={nivel.id}
                className={`flex items-center gap-2.5 border rounded-2xl px-3 py-2.5 transition-colors ${
                  confirmando ? 'border-rose-300 bg-rose-50/60' : 'border-slate-200'
                }`}
              >
                <span className="flex flex-col text-slate-300 shrink-0">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label={`Subir ${nivel.label}`}
                    className="leading-none hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === niveis.length - 1}
                    aria-label={`Descer ${nivel.label}`}
                    className="leading-none hover:text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed mt-1"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </span>
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: nivel.color }}
                >
                  <Flag className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black text-slate-800 leading-tight flex items-center gap-1.5">
                    {nivel.label}
                    {grave && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600 text-[8.5px] font-black uppercase tracking-wider">
                        conta como grave
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 font-semibold truncate">
                    {nivel.description || 'Sem explicação cadastrada'}
                  </p>
                </div>

                {confirmando ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-rose-700 leading-tight max-w-[190px]">
                      Registros antigos deste nível ficam sem classificação. Remover?
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        setConfirmandoRemocao(null);
                        await onRemover(nivel);
                        if (editando === nivel.id) limpar();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Remover
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoRemocao(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(nivel.id);
                        setRotulo(nivel.label);
                        setDescricao(nivel.description || '');
                        setCor(nivel.color);
                      }}
                      aria-label={`Editar ${nivel.label}`}
                      className="p-1.5 h-8 w-8 rounded-lg text-slate-400 hover:text-[#015FC9] hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoRemocao(nivel.id)}
                      aria-label={`Remover ${nivel.label}`}
                      className="p-1.5 h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {niveis.length > 1 && (
        <p className="text-[10.5px] text-slate-400 font-semibold leading-snug mt-2">
          A ordem é a régua de gravidade: os dois de baixo são os que o sistema
          conta como <strong className="text-slate-500">graves</strong> na Sala de
          situação e põe na frente na tela de quem está na rua.
        </p>
      )}

      {/* Formulário */}
      <div className="mt-4 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
            {editando ? 'Editando nível' : 'Novo nível'}
          </p>
          {rotulo.trim() && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border"
              style={{ color: cor, borderColor: `${cor}40`, backgroundColor: `${cor}14` }}
            >
              <Flag className="w-3 h-3" />
              {rotulo.trim()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={cor}
            onChange={e => setCor(e.target.value)}
            aria-label="Cor do nível"
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={rotulo}
            onChange={e => setRotulo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && salvar()}
            placeholder="Nome do nível (ex.: Urgente)"
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <input
          type="text"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && salvar()}
          placeholder="Quando usar este nível (opcional)"
          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="flex gap-2 justify-end">
          {editando && (
            <button
              type="button"
              onClick={limpar}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !rotulo.trim() || !ligado}
            title={ligado ? undefined : 'Precisa do banco configurado neste ambiente.'}
            className="px-5 py-2.5 bg-[#015FC9] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editando ? (
              <Save className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {editando ? 'Salvar nível' : 'Criar nível'}
          </button>
        </div>
      </div>
    </Cartao>
  );
}
