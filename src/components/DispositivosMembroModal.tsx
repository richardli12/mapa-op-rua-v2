import { useEffect, useState } from 'react';
import { Loader2, Smartphone, Tablet, Monitor, Trash2, X, ShieldCheck } from 'lucide-react';
import { DatabaseService } from '../databaseClient';

interface Props {
  membro: { id: string; full_name?: string; whatsapp?: string } | null;
  onClose: () => void;
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
  askConfirmation: (opcoes: any) => void;
}

const ICONE: Record<string, any> = {
  celular: Smartphone,
  tablet: Tablet,
  computador: Monitor
};

const dataHora = (valor?: string) =>
  valor ? new Date(valor).toLocaleString('pt-BR') : '—';

/**
 * Ficha dos aparelhos de um integrante — tela do administrador.
 *
 * Mostra de que aparelho a pessoa se cadastrou e por onde ela entra, e permite
 * soltar o vínculo quando ela troca de celular: sem isso, quem perde o aparelho
 * ficaria para sempre do lado de fora do próprio painel.
 *
 * Nenhum dado aqui aparece para o integrante. Vale dizer, porém, que o app
 * inteiro fala com o banco pela chave anônima, que vai no pacote do navegador:
 * esconder estes dados de quem sabe usar essa chave depende de mudar o acesso
 * ao banco, não desta tela.
 */
export default function DispositivosMembroModal({
  membro,
  onClose,
  notify,
  askConfirmation
}: Props) {
  const [carregando, setCarregando] = useState(true);
  const [aparelhos, setAparelhos] = useState<any[]>([]);

  const carregar = async (id: string) => {
    setCarregando(true);
    const res = await DatabaseService.listarDispositivosMembro(id);
    setAparelhos(res.data || []);
    setCarregando(false);
  };

  useEffect(() => {
    if (membro?.id) carregar(membro.id);
  }, [membro?.id]);

  if (!membro) return null;

  const liberar = (aparelho: any) =>
    askConfirmation({
      title: 'Liberar novo aparelho',
      message: `${membro.full_name || 'O integrante'} poderá entrar de um aparelho diferente no próximo acesso, e esse novo aparelho passa a ser o dele.`,
      confirmLabel: 'Liberar',
      onConfirm: async () => {
        const res = await DatabaseService.removerDispositivoMembro(aparelho.id);
        if (!res.success) {
          notify('Não foi possível soltar este aparelho.', 'error');
          return;
        }
        notify('Aparelho liberado.', 'success');
        carregar(membro.id);
      }
    });

  return (
    <div className="fixed inset-0 z-2000 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#0C3556]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              Aparelhos de acesso
            </h3>
            <p className="text-[11px] text-slate-400 font-bold truncate">
              {membro.full_name} • {membro.whatsapp}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          {carregando ? (
            <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando...
            </div>
          ) : aparelhos.length === 0 ? (
            <div className="py-10 text-center text-slate-400 font-bold text-[11px] uppercase tracking-widest bg-slate-50/40 rounded-2xl border border-dashed border-slate-200">
              Nenhum aparelho vinculado ainda
            </div>
          ) : (
            aparelhos.map(ap => {
              const Icone = ICONE[ap.device_type] || Monitor;
              return (
                <div
                  key={ap.id}
                  className="border border-slate-200 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
                      <Icone className="w-4.5 h-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-slate-800 capitalize leading-tight">
                        {ap.device_type || 'aparelho'} • {ap.browser || '—'}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {ap.os || '—'}
                        {ap.origin === 'cadastro' ? ' • vinculado no cadastro' : ' • vinculado no acesso'}
                      </p>
                    </div>
                    <button
                      onClick={() => liberar(ap)}
                      title="Liberar novo aparelho"
                      className="p-1.5 h-8 w-8 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-rose-100 flex items-center justify-center transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    {[
                      ['Plataforma', ap.platform],
                      ['Resolução', ap.screen_resolution],
                      ['Fuso horário', ap.timezone],
                      ['Idioma', ap.language],
                      ['Idiomas', (ap.languages || []).join(', ')],
                      ['Pontos de toque', String(ap.touch_points ?? '—')],
                      ['Primeiro acesso', dataHora(ap.created_at)],
                      ['Último acesso', dataHora(ap.last_seen_at)],
                      ['Identificador (hash)', (ap.device_id_hash || '').slice(0, 16) || '—'],
                      ['IP (HMAC)', (ap.ip_hash || '').slice(0, 16) || 'não configurado']
                    ].map(([rotulo, valor]) => (
                      <div key={rotulo as string} className="min-w-0">
                        <dt className="font-bold text-slate-400 uppercase tracking-wider text-[9.5px]">
                          {rotulo}
                        </dt>
                        <dd className="font-semibold text-slate-700 truncate" title={String(valor || '')}>
                          {valor || '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div>
                    <p className="font-bold text-slate-400 uppercase tracking-wider text-[9.5px]">
                      User-Agent
                    </p>
                    <p className="text-[10.5px] font-mono text-slate-600 break-all leading-snug">
                      {ap.user_agent || '—'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
