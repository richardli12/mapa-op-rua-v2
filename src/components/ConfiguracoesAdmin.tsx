import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  Camera,
  Check,
  DatabaseZap,
  Flag,
  Loader2,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import { DatabaseService, isDatabaseConfigured } from '../databaseClient';
import { PriorityLevel } from '../types';
import {
  CHAVE_TURNOS,
  JanelaDeTurno,
  TURNOS_PADRAO,
  conferirTurnos,
  gravarTurnos,
  lerTurnos
} from '../turnos';
import SecaoAcesso from './configuracoes/SecaoAcesso';
import SecaoMidias from './configuracoes/SecaoMidias';
import SecaoTurnos from './configuracoes/SecaoTurnos';
import SecaoPrioridades from './configuracoes/SecaoPrioridades';
import { EstadoDoCartao } from './configuracoes/pecas';

interface Props {
  /** Endereço de saída usado quando nada foi configurado. */
  padraoRedirecionamento: string;
  /** Domínios de acesso, só para a tela dizer a que a regra se aplica. */
  dominiosDeAcesso: string[];
  notify: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
  /**
   * O relógio mudou.
   *
   * O App guarda os turnos para o formulário de missão e para a conversa do
   * check-in; sem este aviso, quem acabou de mudar a manhã continuaria vendo
   * o horário velho até recarregar a página.
   */
  onTurnosMudarem?: (janelas: JanelaDeTurno[]) => void;
}

/** Chave do ajuste no banco. Mesma lida pelo App na entrada sem link. */
export const CHAVE_REDIRECIONAMENTO = 'redirect_sem_link';
/** Liberar o envio de foto e vídeo da galeria no check-in. */
export const CHAVE_GALERIA = 'midia_galeria';

/** As seções da página, na ordem em que aparecem e são buscadas. */
const SECOES = [
  {
    id: 'acesso',
    titulo: 'Acesso aos domínios',
    Icone: ShieldCheck,
    termos: 'acesso dominio dominios link redirecionamento saida endereco url porta entrada qr code'
  },
  {
    id: 'midias',
    titulo: 'Mídias do check-in',
    Icone: Camera,
    termos: 'midia midias foto video galeria camera evidencia check-in anexo rolo celular'
  },
  {
    id: 'turnos',
    titulo: 'Turnos de trabalho',
    Icone: AlarmClock,
    termos: 'turno turnos horario hora manha tarde noite janela relogio missao agenda periodo'
  },
  {
    id: 'prioridades',
    titulo: 'Níveis de prioridade',
    Icone: Flag,
    termos: 'prioridade prioridades nivel niveis grave urgente gravidade cor classificacao missao'
  }
];

/** Tira acento e caixa, para a busca achar "prioridade" digitando "prioridade". */
const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Configurações do sistema — a mesa de controle do administrador.
 *
 * Ajustes que valem para todo mundo e ficam no banco, não no navegador de
 * quem mexeu. A página é feita para crescer: seção nova entra na lista
 * `SECOES`, ganha âncora na navegação lateral e entra na busca sem que nada
 * mais precise saber dela.
 *
 * Três decisões sustentam a estrutura:
 *
 * 1. CHAVE GRAVA SOZINHA, CAMPO PRECISA DE SALVAR. Botão de salvar para um
 *    liga-desliga é cerimônia que ninguém cumpre; texto e horário, ao
 *    contrário, precisam de um momento de confirmar. Cada cartão diz em que
 *    regime está, e o que está pendente aparece numa barra só, no rodapé.
 *
 * 2. NADA SE PERDE SEM AVISO. Sair da página, fechar a aba ou recarregar com
 *    alteração pendente dispara aviso; Ctrl+S salva tudo de uma vez.
 *
 * 3. O AMBIENTE SE DECLARA. Banco desligado é dito na cara, e não descoberto
 *    depois de salvar no vazio.
 */
export default function ConfiguracoesAdmin({
  padraoRedirecionamento,
  dominiosDeAcesso,
  notify,
  onTurnosMudarem
}: Props) {
  /* ------------------------------------------------------------ estado --- */
  const [redirecionamento, setRedirecionamento] = useState('');
  const [redirecionamentoSalvo, setRedirecionamentoSalvo] = useState('');
  const [galeria, setGaleria] = useState(false);
  const [galeriaOcupada, setGaleriaOcupada] = useState(false);
  const [turnos, setTurnos] = useState<JanelaDeTurno[]>(TURNOS_PADRAO);
  const [turnosSalvos, setTurnosSalvos] = useState<JanelaDeTurno[]>(TURNOS_PADRAO);
  const [niveis, setNiveis] = useState<PriorityLevel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [secaoAtiva, setSecaoAtiva] = useState('acesso');
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [saida, midia, janelas, listaDeNiveis] = await Promise.all([
        DatabaseService.lerConfiguracao(CHAVE_REDIRECIONAMENTO),
        DatabaseService.lerConfiguracao(CHAVE_GALERIA),
        DatabaseService.lerConfiguracao(CHAVE_TURNOS),
        DatabaseService.fetchPriorityLevels()
      ]);
      setRedirecionamento(saida.value || '');
      setRedirecionamentoSalvo(saida.value || '');
      setGaleria(midia.value === 'sim');
      const lidos = lerTurnos(janelas.value);
      setTurnos(lidos);
      setTurnosSalvos(lidos);
      setNiveis(listaDeNiveis.data);
      setCarregando(false);
    })();
  }, []);

  /* --------------------------------------------------------- pendências --- */
  const redirecionamentoInvalido =
    redirecionamento.trim().length > 0 && !/^https?:\/\//i.test(redirecionamento.trim());
  const conferenciaDeTurnos = conferirTurnos(turnos);

  const redirecionamentoPendente = redirecionamento.trim() !== redirecionamentoSalvo.trim();
  const turnosPendentes = JSON.stringify(turnos) !== JSON.stringify(turnosSalvos);

  const pendencias = useMemo(() => {
    const lista: { id: string; rotulo: string; impedido?: string }[] = [];
    if (redirecionamentoPendente) {
      lista.push({
        id: 'acesso',
        rotulo: 'Saída de quem chega sem link',
        impedido: redirecionamentoInvalido
          ? 'O endereço precisa começar com http:// ou https://.'
          : undefined
      });
    }
    if (turnosPendentes) {
      lista.push({
        id: 'turnos',
        rotulo: 'Horários dos turnos',
        impedido: conferenciaDeTurnos.erros[0]
      });
    }
    return lista;
  }, [
    redirecionamentoPendente,
    redirecionamentoInvalido,
    turnosPendentes,
    conferenciaDeTurnos.erros
  ]);

  const impedimento = pendencias.find(p => p.impedido)?.impedido;

  /* ------------------------------------------------------------ gravar --- */
  const salvarTudo = useCallback(async () => {
    if (pendencias.length === 0 || salvando) return;
    const travado = pendencias.find(p => p.impedido);
    if (travado) {
      notify(travado.impedido!, 'error');
      document.getElementById(travado.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!isDatabaseConfigured) {
      notify('Sem banco configurado neste ambiente, nada é guardado.', 'error');
      return;
    }

    setSalvando(true);
    const tarefas: Promise<boolean>[] = [];
    const destino = redirecionamento.trim();
    if (redirecionamentoPendente) {
      tarefas.push(
        DatabaseService.gravarConfiguracao(CHAVE_REDIRECIONAMENTO, destino).then(r => !!r.success)
      );
    }
    if (turnosPendentes) {
      tarefas.push(
        DatabaseService.gravarConfiguracao(CHAVE_TURNOS, gravarTurnos(turnos)).then(
          r => !!r.success
        )
      );
    }
    const resultados = await Promise.all(tarefas);
    setSalvando(false);

    if (resultados.some(ok => !ok)) {
      notify('Nem tudo foi salvo. Confira a conexão com o banco.', 'error');
      return;
    }
    if (redirecionamentoPendente) setRedirecionamentoSalvo(destino);
    if (turnosPendentes) {
      setTurnosSalvos(turnos);
      onTurnosMudarem?.(turnos);
    }
    notify(
      pendencias.length === 1
        ? `${pendencias[0].rotulo}: salvo!`
        : `${pendencias.length} alterações salvas!`,
      'success'
    );
  }, [
    pendencias,
    salvando,
    redirecionamento,
    redirecionamentoPendente,
    turnos,
    turnosPendentes,
    notify,
    onTurnosMudarem
  ]);

  const descartar = () => {
    setRedirecionamento(redirecionamentoSalvo);
    setTurnos(turnosSalvos.map(j => ({ ...j })));
    notify('Alterações descartadas.', 'info');
  };

  /* -------------------------------------------------------- o teclado --- */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarTudo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        buscaRef.current?.focus();
        return;
      }
      if (e.key === 'Escape' && document.activeElement === buscaRef.current) {
        setBusca('');
        buscaRef.current?.blur();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [salvarTudo]);

  /** Fechar a aba com alteração pendente é perder trabalho em silêncio. */
  useEffect(() => {
    if (pendencias.length === 0) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [pendencias.length]);

  /* ------------------------------------------------------- a navegação --- */
  const termoDaBusca = semAcento(busca.trim());
  const secoesVisiveis = SECOES.filter(
    s => !termoDaBusca || semAcento(`${s.titulo} ${s.termos}`).includes(termoDaBusca)
  );
  const visivel = (id: string) => secoesVisiveis.some(s => s.id === id);

  /**
   * Qual seção está sob os olhos — para a navegação acender sozinha.
   *
   * A regra é a do sumário de livro: vale a última seção cujo topo já passou
   * pela linha de leitura. Com uma exceção que todo sumário precisa ter — no
   * fim da rolagem vale sempre a última seção, porque ela nunca chega a
   * encostar no topo da tela e, sem isso, ficaria para sempre apagada.
   */
  useEffect(() => {
    const rolagemDe = (el: HTMLElement | null): HTMLElement | null => {
      let n = el?.parentElement || null;
      while (n) {
        const estilo = window.getComputedStyle(n);
        if (/(auto|scroll)/.test(estilo.overflowY) && n.scrollHeight > n.clientHeight + 4) {
          return n;
        }
        n = n.parentElement;
      }
      return null;
    };

    const calcular = () => {
      const alvos = secoesVisiveis
        .map(s => document.getElementById(s.id))
        .filter((e): e is HTMLElement => !!e);
      if (alvos.length === 0) return;

      const caixa = rolagemDe(alvos[0]);
      const noFim = caixa
        ? caixa.scrollTop + caixa.clientHeight >= caixa.scrollHeight - 4
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (noFim) {
        setSecaoAtiva(alvos[alvos.length - 1].id);
        return;
      }

      let ativa = alvos[0].id;
      alvos.forEach(el => {
        if (el.getBoundingClientRect().top <= 140) ativa = el.id;
      });
      setSecaoAtiva(ativa);
    };

    calcular();
    // Captura na fase de descida: a rolagem acontece num contêiner interno,
    // e um ouvinte na janela não receberia esse evento.
    document.addEventListener('scroll', calcular, true);
    window.addEventListener('resize', calcular);
    return () => {
      document.removeEventListener('scroll', calcular, true);
      window.removeEventListener('resize', calcular);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secoesVisiveis.map(s => s.id).join(','), carregando]);

  const irPara = (id: string) => {
    setSecaoAtiva(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* -------------------------------------------- ações dos níveis (CRUD) --- */
  const recarregarNiveis = async () => {
    const res = await DatabaseService.fetchPriorityLevels();
    setNiveis(res.data);
  };

  const salvarNivel = async (nivel: PriorityLevel) => {
    const novo = !niveis.some(n => n.id === nivel.id);
    /*
     * O id sai do nome, então dois níveis com o mesmo nome viram o mesmo id —
     * e salvar o segundo sobrescreveria o primeiro sem avisar, junto com todo
     * check-in que já aponta para ele.
     */
    if (novo && niveis.some(n => n.id === nivel.id)) {
      notify('Já existe um nível com esse nome.', 'error');
      return false;
    }
    const res = await DatabaseService.upsertPriorityLevel(nivel);
    if (!res.success) {
      notify('Não foi possível salvar o nível.', 'error');
      return false;
    }
    await recarregarNiveis();
    notify(novo ? 'Nível criado!' : 'Nível atualizado!', 'success');
    return true;
  };

  const removerNivel = async (nivel: PriorityLevel) => {
    const res = await DatabaseService.deletePriorityLevel(nivel.id);
    if (!res.success) {
      notify('Não foi possível remover o nível.', 'error');
      return false;
    }
    await recarregarNiveis();
    notify(`Nível "${nivel.label}" removido.`, 'info');
    return true;
  };

  const reordenarNiveis = async (lista: PriorityLevel[]) => {
    setNiveis(lista.map((n, i) => ({ ...n, position: i })));
    await Promise.all(
      lista.map((n, i) => DatabaseService.upsertPriorityLevel({ ...n, position: i }))
    );
    await recarregarNiveis();
  };

  const alternarGaleria = async () => {
    const novo = !galeria;
    setGaleria(novo);
    setGaleriaOcupada(true);
    const res = await DatabaseService.gravarConfiguracao(CHAVE_GALERIA, novo ? 'sim' : 'nao');
    setGaleriaOcupada(false);
    if (!res.success) {
      setGaleria(!novo);
      notify('Não foi possível salvar a configuração.', 'error');
      return;
    }
    notify(novo ? 'Galeria liberada no check-in.' : 'Galeria bloqueada no check-in.', 'success');
  };

  const estadoDo = (pendente: boolean): EstadoDoCartao =>
    salvando && pendente ? 'salvando' : pendente ? 'pendente' : 'salvo';

  /* ------------------------------------------------------------- tela --- */
  if (carregando) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <span className="flex items-center gap-2.5 text-slate-400 font-bold text-xs uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lendo as configurações do sistema
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0 pb-24">
      {!isDatabaseConfigured && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <DatabaseZap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11.5px] font-bold text-amber-800 leading-snug">
            Este ambiente está sem as credenciais do banco. A tela funciona, mas
            nada do que você mudar aqui é guardado — e os valores mostrados são
            os de fábrica, não os da campanha.
          </p>
        </div>
      )}

      {/* ---------------------------------------- NAVEGAÇÃO + SEÇÕES --- */}
      <div className="grid lg:grid-cols-[232px_minmax(0,1fr)] gap-5 items-start">
        <nav className="lg:sticky lg:top-6 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl flex items-center px-3.5 h-11 focus-within:ring-2 focus-within:ring-blue-500/20">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              ref={buscaRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar ajuste..."
              className="w-full bg-transparent border-none text-[11.5px] font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
            />
            {busca ? (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[8.5px] font-black text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-1 leading-none shrink-0 select-none">
                Ctrl F
              </span>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-2 space-y-0.5">
            {secoesVisiveis.length === 0 ? (
              <p className="text-[11px] font-semibold text-slate-400 px-2 py-3 leading-snug">
                Nenhum ajuste com esse nome.
              </p>
            ) : (
              secoesVisiveis.map(secao => {
                const ativa = secaoAtiva === secao.id;
                const pendente = pendencias.some(p => p.id === secao.id);
                return (
                  <button
                    key={secao.id}
                    type="button"
                    onClick={() => irPara(secao.id)}
                    aria-current={ativa ? 'true' : undefined}
                    className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-colors ${
                      ativa
                        ? 'bg-[#015FC9] text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <secao.Icone
                      className={`w-3.5 h-3.5 shrink-0 ${ativa ? 'text-white' : 'text-slate-400'}`}
                    />
                    <span className="text-[11.5px] font-bold truncate flex-1">
                      {secao.titulo}
                    </span>
                    {pendente && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          ativa ? 'bg-white' : 'bg-amber-500'
                        }`}
                        title="Alteração não salva nesta seção"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <p className="text-[10px] font-semibold text-slate-400 leading-snug px-1">
            As chaves gravam sozinhas. O que se digita fica pendente até você
            salvar — <strong className="text-slate-500">Ctrl S</strong> salva tudo.
          </p>
        </nav>

        <div className="space-y-5 min-w-0">
          {visivel('acesso') && (
            <SecaoAcesso
              valor={redirecionamento}
              onMudar={setRedirecionamento}
              padrao={padraoRedirecionamento}
              dominios={dominiosDeAcesso}
              estado={estadoDo(redirecionamentoPendente)}
            />
          )}

          {visivel('midias') && (
            <SecaoMidias
              galeria={galeria}
              onAlternar={alternarGaleria}
              ocupado={galeriaOcupada}
              ligado={isDatabaseConfigured}
            />
          )}

          {visivel('turnos') && (
            <SecaoTurnos
              turnos={turnos}
              onMudar={setTurnos}
              estado={estadoDo(turnosPendentes)}
            />
          )}

          {visivel('prioridades') && (
            <SecaoPrioridades
              niveis={niveis}
              onSalvar={salvarNivel}
              onRemover={removerNivel}
              onReordenar={reordenarNiveis}
              ligado={isDatabaseConfigured}
            />
          )}

          {secoesVisiveis.length === 0 && (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl px-6 py-12 text-center">
              <p className="text-[13px] font-black text-slate-500">
                Nada encontrado para "{busca}".
              </p>
              <button
                type="button"
                onClick={() => setBusca('')}
                className="mt-3 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider cursor-pointer"
              >
                Ver todos os ajustes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------- BARRA DE PENDÊNCIAS ---
          Uma barra só, para a página inteira. Botão de salvar por cartão
          multiplica a chance de sair da tela com metade das mudanças pelo
          caminho — e ninguém confere cartão por cartão antes de sair. */}
      {pendencias.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[3000] w-[min(680px,calc(100vw-2.5rem))] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/60 px-4 py-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Save className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black leading-tight">
                {pendencias.length === 1
                  ? '1 alteração não salva'
                  : `${pendencias.length} alterações não salvas`}
              </p>
              {impedimento ? (
                <p className="text-[10.5px] font-bold text-amber-400 leading-tight mt-0.5 truncate">
                  {impedimento}
                </p>
              ) : (
                <p className="text-[10.5px] font-semibold text-slate-400 leading-tight mt-0.5 truncate">
                  {pendencias.map((p, i) => (
                    <React.Fragment key={p.id}>
                      {i > 0 && ' · '}
                      <button
                        type="button"
                        onClick={() => {
                          // Busca ligada pode ter escondido justamente a seção
                          // que está pendente: mostrar de volta é parte de levar.
                          setBusca('');
                          window.setTimeout(() => irPara(p.id), 0);
                        }}
                        className="underline decoration-slate-600 underline-offset-2 hover:text-white cursor-pointer"
                      >
                        {p.rotulo}
                      </button>
                    </React.Fragment>
                  ))}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={descartar}
              disabled={salvando}
              className="shrink-0 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10.5px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              Descartar
            </button>
            <button
              type="button"
              onClick={salvarTudo}
              disabled={salvando || !!impedimento}
              title={impedimento || 'Ctrl S'}
              className="shrink-0 px-4 py-2 rounded-xl bg-[#015FC9] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10.5px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
            >
              {salvando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Salvar tudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
