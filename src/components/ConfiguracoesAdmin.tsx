import { useEffect, useState } from 'react';
import { Camera, ExternalLink, Loader2, Save, ShieldCheck } from 'lucide-react';
import { DatabaseService } from '../databaseClient';

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
    })();
  }, []);

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
    </div>
  );
}
