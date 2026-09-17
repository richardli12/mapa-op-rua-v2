import { useEffect, useState } from 'react';
import {
  Camera,
  ExternalLink,
  Flag,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Pencil,
  X
} from 'lucide-react';
import { DatabaseService } from '../databaseClient';
import { PriorityLevel } from '../types';

interface Props {
  /** Endereço de saída usado quando nada foi configurado. */
  padraoRedirecionamento: string;
  /** Domínios de acesso, só para a tela dizer a que a regra se aplica. */
  dominiosDeAcesso: string[];
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
}

/** Chave do ajuste no banco. Mesma lida pelo App na entrada sem link. */
export const CHAVE_REDIRECIONAMENTO = 'redirect_sem_link';
/** Liberar o envio de foto e vídeo da galeria no check-in. */
export const CHAVE_GALERIA = 'midia_galeria';

/**
 * Configurações do sistema — tela do administrador.
 *
 * Ajustes que valem para todo mundo, guardados no banco e não no navegador de
 * quem mexeu. É o lugar de tudo que muda o comportamento do sistema como um
 * todo; hoje, para onde vai quem abre um domínio de acesso sem link.
 */
export default function ConfiguracoesAdmin({
  padraoRedirecionamento,
  dominiosDeAcesso,
  notify
}: Props) {
  const [redirecionamento, setRedirecionamento] = useState('');
  const [galeria, setGaleria] = useState(false);
  const [niveis, setNiveis] = useState<PriorityLevel[]>([]);
  const [editandoNivel, setEditandoNivel] = useState<string | null>(null);
  const [rotuloNivel, setRotuloNivel] = useState('');
  const [descricaoNivel, setDescricaoNivel] = useState('');
  const [corNivel, setCorNivel] = useState('#f59e0b');
  const [salvandoNivel, setSalvandoNivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const [saida, midia] = await Promise.all([
        DatabaseService.lerConfiguracao(CHAVE_REDIRECIONAMENTO),
        DatabaseService.lerConfiguracao(CHAVE_GALERIA)
      ]);
      setRedirecionamento(saida.value || '');
      setGaleria(midia.value === 'sim');
      setCarregando(false);
      carregarNiveis();
    })();
  }, []);

  const carregarNiveis = async () => {
    const res = await DatabaseService.fetchPriorityLevels();
    setNiveis(res.data);
  };

  const limparFormularioNivel = () => {
    setEditandoNivel(null);
    setRotuloNivel('');
    setDescricaoNivel('');
    setCorNivel('#f59e0b');
  };

  /** Id legível e estável, derivado do nome — é ele que fica no check-in. */
  const idDoRotulo = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);

  const salvarNivel = async () => {
    const rotulo = rotuloNivel.trim();
    if (!rotulo) {
      notify('Dê um nome ao nível de prioridade.', 'error');
      return;
    }
    const id = editandoNivel || idDoRotulo(rotulo) || `nivel_${Date.now()}`;
    if (!editandoNivel && niveis.some(n => n.id === id)) {
      notify('Já existe um nível com esse nome.', 'error');
      return;
    }

    setSalvandoNivel(true);
    const res = await DatabaseService.upsertPriorityLevel({
      id,
      label: rotulo,
      description: descricaoNivel.trim(),
      color: corNivel,
      position: editandoNivel
        ? niveis.find(n => n.id === editandoNivel)?.position ?? niveis.length
        : niveis.length
    });
    setSalvandoNivel(false);

    if (!res.success) {
      notify('Não foi possível salvar o nível.', 'error');
      return;
    }
    limparFormularioNivel();
    carregarNiveis();
    notify(editandoNivel ? 'Nível atualizado!' : 'Nível criado!', 'success');
  };

  const removerNivel = async (nivel: PriorityLevel) => {
    const res = await DatabaseService.deletePriorityLevel(nivel.id);
    if (!res.success) {
      notify('Não foi possível remover o nível.', 'error');
      return;
    }
    if (editandoNivel === nivel.id) limparFormularioNivel();
    carregarNiveis();
    notify('Nível removido.', 'info');
  };

  /** Troca a posição com o vizinho, para o administrador ordenar a lista. */
  const moverNivel = async (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= niveis.length) return;
    const lista = [...niveis];
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    setNiveis(lista);
    await Promise.all(
      lista.map((n, i) => DatabaseService.upsertPriorityLevel({ ...n, position: i }))
    );
    carregarNiveis();
  };

  /** A chave é gravada na hora em que o botão muda: nada de "esqueci de salvar". */
  const alternarGaleria = async () => {
    const novo = !galeria;
    setGaleria(novo);
    const res = await DatabaseService.gravarConfiguracao(CHAVE_GALERIA, novo ? 'sim' : 'nao');
    if (!res.success) {
      setGaleria(!novo);
      notify('Não foi possível salvar a configuração.', 'error');
      return;
    }
    notify(novo ? 'Galeria liberada no check-in.' : 'Galeria bloqueada no check-in.', 'success');
  };

  const salvar = async () => {
    const destino = redirecionamento.trim();
    if (destino && !/^https?:\/\//i.test(destino)) {
      notify('O endereço precisa começar com http:// ou https://.', 'error');
      return;
    }
    setSalvando(true);
    const res = await DatabaseService.gravarConfiguracao(CHAVE_REDIRECIONAMENTO, destino);
    setSalvando(false);
    notify(
      res.success ? 'Configuração salva!' : 'Não foi possível salvar a configuração.',
      res.success ? 'success' : 'error'
    );
  };

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 max-w-2xl">
        <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider leading-tight">
              Acesso aos domínios
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Quem chega sem link não vê o sistema.
            </p>
          </div>
        </div>

        <div className="pt-4 space-y-2">
          <label className="block text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
            Quem abrir o domínio sem link vai para
          </label>

          <div className="flex gap-2">
            <div className="flex-1 bg-white border border-slate-200 rounded-xl flex items-center px-3.5 focus-within:ring-2 focus-within:ring-blue-500/20">
              <ExternalLink className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
              <input
                type="url"
                value={redirecionamento}
                disabled={carregando}
                onChange={e => setRedirecionamento(e.target.value)}
                placeholder={padraoRedirecionamento}
                className="w-full py-2.5 bg-transparent border-none text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
              />
            </div>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || carregando}
              className="px-5 bg-[#015FC9] hover:bg-blue-600 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar
            </button>
          </div>

          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
            Os domínios de acesso existem para receber quem veio de um QR Code ou do
            link da equipe. Quem digita o endereço na barra, sem link, é mandado para
            fora em vez de ver a porta de entrada do sistema. Em branco, vai para{' '}
            <span className="font-bold text-slate-600">{padraoRedirecionamento}</span>.
          </p>

          {dominiosDeAcesso.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1.5">
              {dominiosDeAcesso.map(dominio => (
                <span
                  key={dominio}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-500"
                >
                  {dominio}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 max-w-2xl">
        <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider leading-tight">
              Mídias do check-in
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              De onde pode vir a evidência de campo.
            </p>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-slate-700">
              Permitir enviar da galeria
            </p>
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-0.5">
              Desligado, o integrante só anexa o que ele fotografar ou filmar na
              hora, pela câmera — é o que garante que a evidência é daquele
              momento, e não uma imagem antiga do rolo do celular.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={galeria}
            disabled={carregando}
            onClick={alternarGaleria}
            className={`w-14 h-8 rounded-full shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
              galeria ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`block w-6 h-6 bg-white rounded-full shadow transition-transform ${
                galeria ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 max-w-2xl">
        <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider leading-tight">
              Níveis de prioridade
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              A lista é sua: crie, edite, ordene e remova.
            </p>
          </div>
        </div>

        {/* Lista */}
        <div className="pt-4 space-y-2">
          {niveis.length === 0 ? (
            <p className="text-[11px] text-slate-400 font-semibold py-4 text-center border border-dashed border-slate-200 rounded-2xl">
              Nenhum nível criado ainda.
            </p>
          ) : (
            niveis.map((nivel, i) => (
              <div
                key={nivel.id}
                className="flex items-center gap-2.5 border border-slate-200 rounded-2xl px-3 py-2.5"
              >
                <span className="flex flex-col text-slate-300">
                  <button
                    type="button"
                    onClick={() => moverNivel(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                    className="leading-none text-[9px] hover:text-slate-500 disabled:opacity-30 cursor-pointer"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moverNivel(i, 1)}
                    disabled={i === niveis.length - 1}
                    aria-label="Descer"
                    className="leading-none text-[9px] hover:text-slate-500 disabled:opacity-30 cursor-pointer"
                  >
                    ▼
                  </button>
                </span>
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: nivel.color }}
                >
                  <Flag className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black text-slate-800 leading-tight">
                    {nivel.label}
                  </p>
                  {nivel.description && (
                    <p className="text-[11px] text-slate-400 font-semibold truncate">
                      {nivel.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoNivel(nivel.id);
                    setRotuloNivel(nivel.label);
                    setDescricaoNivel(nivel.description || '');
                    setCorNivel(nivel.color);
                  }}
                  aria-label="Editar"
                  className="p-1.5 h-8 w-8 rounded-lg text-slate-400 hover:text-[#015FC9] hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removerNivel(nivel)}
                  aria-label="Remover"
                  className="p-1.5 h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Formulário */}
        <div className="mt-4 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={corNivel}
              onChange={e => setCorNivel(e.target.value)}
              aria-label="Cor do nível"
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white cursor-pointer shrink-0"
            />
            <input
              type="text"
              value={rotuloNivel}
              onChange={e => setRotuloNivel(e.target.value)}
              placeholder="Nome do nível (ex.: Urgente)"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <input
            type="text"
            value={descricaoNivel}
            onChange={e => setDescricaoNivel(e.target.value)}
            placeholder="Quando usar este nível (opcional)"
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
          <div className="flex gap-2 justify-end">
            {editandoNivel && (
              <button
                type="button"
                onClick={limparFormularioNivel}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={salvarNivel}
              disabled={salvandoNivel}
              className="px-5 py-2.5 bg-[#015FC9] hover:bg-blue-600 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {salvandoNivel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editandoNivel ? (
                <Save className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editandoNivel ? 'Salvar nível' : 'Criar nível'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
