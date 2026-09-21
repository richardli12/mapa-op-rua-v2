import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RotateCcw, Save, Target, TrendingUp, Users } from 'lucide-react';
import { DatabaseService } from '../../databaseClient';
import { IconeDoTurno } from '../TurnoEPrioridade';
import {
  COR_DO_TURNO,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TURNOS,
  TurnoId
} from '../../turnos';
import {
  Cadencia,
  METAS_VAZIAS,
  MetasDoCliente,
  alvoDe,
  alvoDoDia,
  chaveDasMetas,
  corDoAvanco,
  gravarMetas,
  janelaDaMeta,
  lerMetas,
  porcentagem,
  progressoDaPessoa,
  temMetaPropria
} from '../../metas';

/**
 * Metas da equipe — onde o número vira cobrança.
 *
 * O painel sabia dizer quanto a equipe fez; não sabia dizer se foi o
 * bastante. Aqui o comitê escreve o alvo — "vinte de manhã, dez à tarde" —
 * e a mesma tela mostra, ao lado, quanto já entrou. Configuração e resultado
 * no mesmo lugar de propósito: meta que mora numa tela e resultado que mora
 * em outra é meta que ninguém confere.
 */

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

const curto = (iso: string) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '');

/** Campo de número que aceita vazio — vazio quer dizer "sem meta própria". */
function CampoDeAlvo({
  valor,
  placeholder,
  onMudar,
  cor
}: {
  valor?: number;
  placeholder?: string;
  onMudar: (n?: number) => void;
  cor: string;
}) {
  return (
    <input
      type="number"
      min={0}
      max={999}
      value={valor === undefined ? '' : valor}
      placeholder={placeholder}
      onChange={e => {
        const bruto = e.target.value.trim();
        if (bruto === '') return onMudar(undefined);
        const n = Math.max(0, Math.min(999, Math.floor(Number(bruto) || 0)));
        onMudar(n === 0 ? undefined : n);
      }}
      className="w-full h-9 px-2 bg-white border rounded-xl text-[12.5px] font-black text-center tabular-nums text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 placeholder:font-bold placeholder:text-slate-300"
      style={{ borderColor: valor === undefined ? '#e2e8f0' : `${cor}66` }}
    />
  );
}

/** A barra de avanço de um turno: feito sobre alvo, com a cor do quanto falta. */
function Avanco({
  feito,
  alvo,
  turno,
  compacto = false
}: {
  feito: number;
  alvo: number;
  turno: TurnoId;
  compacto?: boolean;
}) {
  const pct = porcentagem(feito, alvo);
  const cor = corDoAvanco(feito, alvo);
  const batida = alvo > 0 && feito >= alvo;
  return (
    <div title={`${NOME_DO_TURNO[turno]}: ${feito} de ${alvo || '—'}`}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-black tabular-nums" style={{ color: cor }}>
          {feito}
          <span className="text-slate-300 font-bold">/{alvo || '—'}</span>
        </span>
        {batida && !compacto && <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />}
      </div>
      <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: alvo > 0 ? cor : 'transparent' }}
        />
      </span>
    </div>
  );
}

export default function PainelDeMetas({
  candidateId,
  equipe,
  checkIns,
  janelas,
  notificar,
  bancoLigado
}: {
  candidateId: string;
  equipe: any[];
  /** Check-ins do cliente, sem corte de período: a janela da meta é quem corta. */
  checkIns: any[];
  janelas: JanelaDeTurno[];
  notificar: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
  bancoLigado: boolean;
}) {
  const [metas, setMetas] = useState<MetasDoCliente>(METAS_VAZIAS);
  const [salvas, setSalvas] = useState<MetasDoCliente>(METAS_VAZIAS);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    (async () => {
      const res = await DatabaseService.lerConfiguracao(chaveDasMetas(candidateId));
      if (!vivo) return;
      const lidas = lerMetas(res.value);
      setMetas(lidas);
      setSalvas(lidas);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [candidateId]);

  const pendente = JSON.stringify(metas) !== JSON.stringify(salvas);
  const janela = janelaDaMeta(metas);

  const salvar = async () => {
    if (!bancoLigado) {
      notificar('Sem banco configurado neste ambiente, a meta não é guardada.', 'error');
      return;
    }
    setSalvando(true);
    const res = await DatabaseService.gravarConfiguracao(
      chaveDasMetas(candidateId),
      gravarMetas(metas)
    );
    setSalvando(false);
    if (!res.success) {
      notificar('Não foi possível salvar as metas.', 'error');
      return;
    }
    setSalvas(metas);
    notificar('Metas da equipe salvas!', 'success');
  };

  const mudarPadrao = (turno: TurnoId, valor?: number) =>
    setMetas(m => {
      const padrao = { ...m.padrao };
      if (valor === undefined) delete padrao[turno];
      else padrao[turno] = valor;
      return { ...m, padrao };
    });

  const mudarPessoa = (pessoaId: string, turno: TurnoId, valor?: number) =>
    setMetas(m => {
      const daPessoa = { ...(m.porPessoa[pessoaId] || {}) };
      if (valor === undefined) delete daPessoa[turno];
      else daPessoa[turno] = valor;
      const porPessoa = { ...m.porPessoa };
      if (Object.keys(daPessoa).length === 0) delete porPessoa[pessoaId];
      else porPessoa[pessoaId] = daPessoa;
      return { ...m, porPessoa };
    });

  const mudarCadencia = (cadencia: Cadencia) =>
    setMetas(m => {
      if (cadencia !== 'periodo') return { ...m, cadencia, de: undefined, ate: undefined };
      const hoje = new Date().toLocaleDateString('sv-SE');
      return { ...m, cadencia, de: m.de || hoje, ate: m.ate || hoje };
    });

  /** Cada integrante com o que já fez dentro da janela da meta. */
  const linhas = useMemo(
    () =>
      equipe.map(pessoa => {
        const meus = checkIns.filter(
          (c: any) => c.memberId === pessoa.id || c.name === nomeDoIntegrante(pessoa)
        );
        return {
          pessoa,
          nome: nomeDoIntegrante(pessoa),
          progresso: progressoDaPessoa(meus, janelas, janela.de, janela.ate)
        };
      }),
    [equipe, checkIns, janelas, janela.de, janela.ate]
  );

  const totalAlvo = equipe.reduce((soma, p) => soma + alvoDoDia(metas, p.id), 0);
  const totalFeito = linhas.reduce((soma, l) => soma + l.progresso.total, 0);
  const totalDeMissao = linhas.reduce((soma, l) => soma + l.progresso.deMissao, 0);
  const baterem = linhas.filter(
    l => alvoDoDia(metas, l.pessoa.id) > 0 && l.progresso.total >= alvoDoDia(metas, l.pessoa.id)
  ).length;

  if (carregando) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-10 flex items-center justify-center">
        <span className="flex items-center gap-2.5 text-slate-400 font-bold text-xs uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lendo as metas da equipe
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ CABEÇALHO --- */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider leading-tight">
                Metas da equipe
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                Quantos check-ins cada pessoa precisa fazer em cada turno.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pendente && (
              <button
                type="button"
                onClick={() => setMetas(salvas)}
                className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 text-[11px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Descartar
              </button>
            )}
            <button
              type="button"
              onClick={salvar}
              disabled={!pendente || salvando}
              className="h-10 px-5 rounded-xl bg-[#015FC9] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {pendente ? 'Salvar metas' : 'Salvo'}
            </button>
          </div>
        </div>

        {/* A cadência: por quanto tempo a meta vale. */}
        <div className="pt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#8492A6] mr-1">
            A meta vale
          </span>
          {(
            [
              ['dia', 'Por dia'],
              ['semana', 'Por semana'],
              ['periodo', 'No período']
            ] as [Cadencia, string][]
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => mudarCadencia(id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all border ${
                metas.cadencia === id
                  ? 'bg-[#015FC9] border-[#015FC9] text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {rotulo}
            </button>
          ))}

          {metas.cadencia === 'periodo' && (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                value={metas.de || ''}
                max={metas.ate || undefined}
                onChange={e => setMetas(m => ({ ...m, de: e.target.value }))}
                aria-label="Início do período da meta"
                className="h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[11.5px] font-bold text-slate-700 cursor-pointer tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
              <input
                type="date"
                value={metas.ate || ''}
                min={metas.de || undefined}
                onChange={e => setMetas(m => ({ ...m, ate: e.target.value }))}
                aria-label="Fim do período da meta"
                className="h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-[11.5px] font-bold text-slate-700 cursor-pointer tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </span>
          )}

          <span className="text-[11px] font-bold text-slate-400 ml-auto">
            Comparando com {janela.rotulo}
            {metas.cadencia !== 'dia' && ` · ${curto(janela.de)} a ${curto(janela.ate)}`}
          </span>
        </div>

        {/* O placar da equipe */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              rotulo: 'Meta da equipe',
              valor: totalAlvo || '—',
              detalhe: `${equipe.length} ${equipe.length === 1 ? 'pessoa' : 'pessoas'}`,
              cor: '#0D233A'
            },
            {
              rotulo: 'Já entrou',
              valor: totalFeito,
              detalhe: totalAlvo
                ? `${porcentagem(totalFeito, totalAlvo)}% da meta`
                : 'sem meta cadastrada',
              cor: corDoAvanco(totalFeito, totalAlvo)
            },
            {
              rotulo: 'De missão',
              valor: totalDeMissao,
              detalhe: 'contam na meta',
              cor: '#015FC9'
            },
            {
              rotulo: 'Bateram a meta',
              valor: `${baterem}`,
              detalhe: `de ${equipe.length}`,
              cor: baterem > 0 ? '#1baf7a' : '#94a3b8'
            }
          ].map(t => (
            <div key={t.rotulo} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 leading-none">
                {t.rotulo}
              </p>
              <p
                className="text-[26px] font-black leading-none mt-2 tabular-nums"
                style={{ color: t.cor }}
              >
                {t.valor}
              </p>
              <p className="text-[10px] font-bold text-slate-400 leading-none mt-1.5 truncate">
                {t.detalhe}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------------------------- META PADRÃO --- */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
        <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-black text-slate-800 leading-tight">
              Meta padrão — vale para todo mundo
            </h4>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Cadastrar trinta pessoas uma a uma é trabalho que ninguém faz duas
              vezes. Escreva aqui e ajuste só quem precisa de número diferente.
            </p>
          </div>
        </div>

        <div className="pt-4 grid grid-cols-3 gap-3 max-w-md">
          {TURNOS.map(turno => (
            <label key={turno} className="block">
              <span
                className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider mb-1.5"
                style={{ color: COR_DO_TURNO[turno] }}
              >
                <IconeDoTurno turno={turno} className="w-3 h-3" />
                {NOME_DO_TURNO[turno]}
              </span>
              <CampoDeAlvo
                valor={metas.padrao[turno]}
                placeholder="—"
                onMudar={n => mudarPadrao(turno, n)}
                cor={COR_DO_TURNO[turno]}
              />
            </label>
          ))}
        </div>
        <p className="text-[10.5px] font-bold text-slate-400 mt-2.5">
          Dá {TURNOS.reduce((a, t) => a + (metas.padrao[t] || 0), 0) || 0} check-in
          {TURNOS.reduce((a, t) => a + (metas.padrao[t] || 0), 0) === 1 ? '' : 's'} por
          pessoa, {janela.rotulo === 'hoje' ? 'por dia' : janela.rotulo}.
        </p>
      </div>

      {/* ------------------------------------------- POR INTEGRANTE --- */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
        <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0C3556] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-black text-slate-800 leading-tight">
              Pessoa por pessoa
            </h4>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Em branco segue a meta padrão. O número ao lado é o que já entrou{' '}
              {janela.rotulo}.
            </p>
          </div>
        </div>

        {equipe.length === 0 ? (
          <p className="text-[12px] font-semibold text-slate-400 py-8 text-center">
            Nenhum integrante cadastrado neste cliente.
          </p>
        ) : (
          <div className="pt-4 space-y-2">
            {/* Cabeçalho da tabela */}
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_repeat(3,150px)_90px] gap-3 px-3">
              <span className="text-[9.5px] uppercase font-black tracking-widest text-slate-400">
                Integrante
              </span>
              {TURNOS.map(t => (
                <span
                  key={t}
                  className="text-[9.5px] uppercase font-black tracking-widest text-center"
                  style={{ color: COR_DO_TURNO[t] }}
                >
                  {NOME_DO_TURNO[t]}
                </span>
              ))}
              <span className="text-[9.5px] uppercase font-black tracking-widest text-slate-400 text-center">
                Total
              </span>
            </div>

            {linhas.map(({ pessoa, nome, progresso }) => {
              const alvoTotal = alvoDoDia(metas, pessoa.id);
              const proprio = temMetaPropria(metas, pessoa.id);
              const foto = pessoa.image || pessoa.foto_url || pessoa.photo || '';
              return (
                <div
                  key={pessoa.id}
                  className="grid md:grid-cols-[minmax(0,1fr)_repeat(3,150px)_90px] gap-3 items-center border border-slate-200 rounded-2xl px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      {foto ? (
                        <img
                          src={foto}
                          alt={nome}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-[10px] font-black text-slate-500">
                          {iniciais(nome)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-black text-slate-800 truncate">
                        {nome}
                      </span>
                      <span className="block text-[10px] font-bold text-slate-400 truncate">
                        {proprio ? 'meta própria' : 'segue a meta padrão'}
                      </span>
                    </span>
                  </div>

                  {TURNOS.map(turno => {
                    const alvo = alvoDe(metas, pessoa.id, turno);
                    return (
                      <div key={turno} className="flex items-center gap-2">
                        <span className="w-[62px] shrink-0">
                          <CampoDeAlvo
                            valor={metas.porPessoa[pessoa.id]?.[turno]}
                            placeholder={
                              metas.padrao[turno] !== undefined
                                ? String(metas.padrao[turno])
                                : '—'
                            }
                            onMudar={n => mudarPessoa(pessoa.id, turno, n)}
                            cor={COR_DO_TURNO[turno]}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <Avanco
                            feito={progresso.porTurno[turno]}
                            alvo={alvo}
                            turno={turno}
                            compacto
                          />
                        </span>
                      </div>
                    );
                  })}

                  <div className="text-center">
                    <p
                      className="text-[15px] font-black leading-none tabular-nums"
                      style={{ color: corDoAvanco(progresso.total, alvoTotal) }}
                    >
                      {progresso.total}
                      <span className="text-slate-300 text-[11px]">/{alvoTotal || '—'}</span>
                    </p>
                    <p className="text-[9.5px] font-bold text-slate-400 leading-none mt-1">
                      {progresso.deMissao > 0
                        ? `${progresso.deMissao} de missão`
                        : progresso.foraDeTurno > 0
                          ? `${progresso.foraDeTurno} fora de turno`
                          : '—'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10.5px] font-semibold text-slate-400 leading-snug mt-3">
          Missão cumprida conta como check-in: quem fez missão trabalhou. O que
          veio de missão aparece em separado só para dizer de onde veio o
          número. Registro feito num horário que nenhum turno cobre entra no
          total, mas em nenhum turno — o relógio dos turnos fica em
          Configurações.
        </p>
      </div>
    </div>
  );
}
