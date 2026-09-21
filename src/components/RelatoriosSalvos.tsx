import { useEffect, useState } from 'react';
import {
  Brain,
  Calendar,
  FileText,
  Loader2,
  Search,
  Trash2
} from 'lucide-react';
import { DatabaseService, isDatabaseConfigured } from '../databaseClient';
import type { RelatorioDoNeo } from '../neo';
import type { PecaDoDossie } from '../services/neo';
import RelatorioNeo from './RelatorioNeo';
import type { ConfirmRequest } from './ConfirmDialog';

/**
 * A estante dos relatórios do NEO.
 *
 * Um relatório guardado que só se alcança reabrindo a missão certa é um
 * relatório perdido: quem vai apresentar não lembra em que ponto do mapa ele
 * estava, e acaba mandando gerar outro -- que custa de novo e sai diferente.
 *
 * Aqui eles ficam todos, do mais novo para o mais velho, com a manchete à
 * mostra. A manchete é a linha que o NEO escreve como veredito, e é ela que
 * permite achar um relatório sem abrir nenhum.
 */

interface Guardado {
  missaoId: string;
  titulo: string;
  relatorio: RelatorioDoNeo;
  pecas: PecaDoDossie[];
  criadoEm: string;
}

const SEVERIDADE = {
  alta: { texto: 'Severidade alta', classe: 'bg-rose-100 text-rose-700 border-rose-200' },
  media: { texto: 'Severidade média', classe: 'bg-amber-100 text-amber-800 border-amber-200' },
  baixa: { texto: 'Severidade baixa', classe: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
};

/** Tira acento e caixa, para a busca achar "narrativa" digitando "narrativa". */
const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function RelatoriosSalvos({
  notify,
  askConfirmation
}: {
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
  askConfirmation: (pedido: ConfirmRequest) => void;
}) {
  const [lista, setLista] = useState<Guardado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<Guardado | null>(null);

  useEffect(() => {
    (async () => {
      const res = await DatabaseService.listarRelatoriosNeo();
      setLista(res.data as Guardado[]);
      // Falhar a consulta com o banco ligado quase sempre é a tabela que ainda
      // não existe -- e a tela diz qual arquivo rodar, em vez de "nenhum
      // relatório", que faria procurar o erro no lugar errado.
      setSemTabela(!res.success && isDatabaseConfigured);
      setCarregando(false);
    })();
  }, []);

  const apagar = (item: Guardado) =>
    askConfirmation({
      title: 'Apagar relatório',
      message: `"${item.titulo}" sai da estante.`,
      details:
        'A missão continua intacta, e um relatório novo pode ser gerado a qualquer momento — mas este texto, exatamente como está, não volta.',
      confirmLabel: 'Apagar',
      onConfirm: async () => {
        const res = await DatabaseService.apagarRelatorioNeo(item.missaoId);
        if (!res.success) {
          notify('Não foi possível apagar o relatório.', 'error');
          return;
        }
        setLista(atual => atual.filter(r => r.missaoId !== item.missaoId));
        notify('Relatório apagado.', 'success');
      }
    });

  const filtrados = busca.trim()
    ? lista.filter(r => {
        const agulha = semAcento(busca);
        return (
          semAcento(r.titulo || '').includes(agulha) ||
          semAcento(r.relatorio?.manchete || '').includes(agulha) ||
          semAcento(r.relatorio?.naturezaDaMissao || '').includes(agulha)
        );
      })
    : lista;

  if (carregando) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <span className="flex items-center gap-2.5 text-slate-400 font-bold text-xs uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" />
          Abrindo a estante...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho da estante */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-wider leading-tight">
              Relatórios do NEO
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {lista.length === 0
                ? 'Nenhum relatório guardado ainda.'
                : `${lista.length} relatório${lista.length > 1 ? 's' : ''} guardado${
                    lista.length > 1 ? 's' : ''
                  }.`}
            </p>
          </div>
        </div>

        {lista.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl flex items-center px-3.5 h-11 shadow-sm min-w-[240px]">
            <Search className="w-4 h-4 text-slate-300 mr-2.5 shrink-0" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por título ou veredito..."
              className="w-full bg-transparent border-none text-xs font-bold text-slate-700 placeholder-slate-300 focus:outline-hidden"
            />
          </div>
        )}
      </div>

      {semTabela && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-[12px] font-black text-amber-800">
            A estante ainda não existe no banco.
          </p>
          <p className="text-[11.5px] font-semibold text-amber-700 leading-relaxed mt-1">
            Rode{' '}
            <span className="font-mono text-[11px] bg-amber-100 px-1.5 py-0.5 rounded">
              db/migrations/2026-09-21-relatorios-neo.sql
            </span>{' '}
            no SQL Editor. Até lá, os relatórios continuam sendo gerados
            normalmente — só não ficam guardados.
          </p>
        </div>
      )}

      {!semTabela && lista.length === 0 && (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl px-6 py-16 text-center">
          <FileText className="w-8 h-8 text-slate-200 mx-auto" />
          <p className="text-[13px] font-black text-slate-500 mt-3">
            Nenhum relatório guardado
          </p>
          <p className="text-[11.5px] font-semibold text-slate-400 mt-1 max-w-sm mx-auto leading-snug">
            Abra uma missão no mapa, toque em "Gerar Relatório" e depois em
            "Salvar". Ele passa a aparecer aqui.
          </p>
        </div>
      )}

      {filtrados.length === 0 && lista.length > 0 && (
        <p className="text-[12px] font-bold text-slate-400 text-center py-10">
          Nada encontrado para "{busca}".
        </p>
      )}

      <div className="grid gap-3">
        {filtrados.map(item => {
          const sev =
            SEVERIDADE[item.relatorio?.severidade as keyof typeof SEVERIDADE] ||
            SEVERIDADE.media;
          return (
            <div
              key={item.missaoId}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-colors flex flex-col md:flex-row md:items-center gap-4"
            >
              <button
                type="button"
                onClick={() => setAberto(item)}
                className="min-w-0 flex-1 text-left cursor-pointer bg-transparent border-none p-0"
              >
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {item.relatorio?.naturezaDaMissao && (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white">
                      {item.relatorio.naturezaDaMissao}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${sev.classe}`}
                  >
                    {sev.texto}
                  </span>
                </div>
                <p className="font-black text-[14px] text-slate-800 leading-snug">
                  {item.titulo}
                </p>
                {item.relatorio?.manchete && (
                  <p className="text-[11.5px] font-semibold text-slate-500 leading-snug mt-1 line-clamp-2">
                    {item.relatorio.manchete}
                  </p>
                )}
                <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(item.criadoEm).toLocaleString('pt-BR')}
                </p>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAberto(item)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => apagar(item)}
                  title="Apagar relatório"
                  className="p-2.5 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/*
        O documento guardado abre na mesma tela de sempre.
        Sem "Gerar de novo": daqui não se tem em mãos a missão que o originou,
        e um botão que não tem o que fazer é pior do que botão nenhum.
      */}
      <RelatorioNeo
        aberto={!!aberto}
        carregando={false}
        erro={null}
        relatorio={aberto?.relatorio || null}
        pecas={aberto?.pecas || []}
        missaoTitulo={aberto?.titulo || ''}
        guardado
        salvando={false}
        onSalvar={() => {}}
        onFechar={() => setAberto(null)}
      />
    </div>
  );
}
