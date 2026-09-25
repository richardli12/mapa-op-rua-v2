import React, { useEffect, useRef, useState } from 'react';
import { Eye, LogIn, Plus, RotateCcw, X } from 'lucide-react';
import { Cartao, Campo, EstadoDoCartao } from './pecas';
import TelaDeLogin from '../TelaDeLogin';
import {
  TEXTOS_LOGIN_PADRAO,
  TextosDoLogin,
  iguaisTextosDoLogin
} from '../../textosDoLogin';

/** Tamanho da tela desenhada na prévia, antes de encolher para caber. */
const TELA = { largura: 1440, altura: 900 };
const MAX_FRASES = 10;

type CampoDeTexto = Exclude<keyof TextosDoLogin, 'registro'>;

/**
 * Os textos da tela de login.
 *
 * Em cima, a própria tela de login, encolhida e viva, com o que está sendo
 * digitado: escrever uma manchete sem ver onde ela cai é adivinhar se cabe em
 * duas linhas ou se vai empurrar a legenda para fora. Embaixo, os campos, na
 * ordem em que o olho percorre a tela — primeiro o painel de acesso, depois
 * o mapa.
 *
 * Nada vai para a tela de verdade antes de "Salvar tudo", como todo campo
 * desta página.
 */
export default function SecaoLogin({
  valor,
  onMudar,
  estado
}: {
  valor: TextosDoLogin;
  onMudar: (valor: TextosDoLogin) => void;
  estado: EstadoDoCartao;
}) {
  const noPadrao = iguaisTextosDoLogin(valor, TEXTOS_LOGIN_PADRAO);
  const mexer = (chave: CampoDeTexto, texto: string) => onMudar({ ...valor, [chave]: texto });

  /* A prévia encolhe a tela inteira para a largura do cartão. */
  const moldura = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(0.5);
  useEffect(() => {
    const el = moldura.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / TELA.largura);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const campo = (
    chave: CampoDeTexto,
    rotulo: string,
    opcoes: { multilinha?: boolean; dica?: string } = {}
  ) => {
    const classe =
      'w-full px-3.5 bg-white border border-slate-200 rounded-xl text-[12.5px] font-semibold text-slate-800 placeholder-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400';
    return (
      <Campo rotulo={rotulo} dica={opcoes.dica}>
        {opcoes.multilinha ? (
          <textarea
            value={valor[chave]}
            onChange={(e) => mexer(chave, e.target.value)}
            placeholder={TEXTOS_LOGIN_PADRAO[chave]}
            rows={2}
            className={`${classe} py-2.5 leading-snug resize-y`}
          />
        ) : (
          <input
            type="text"
            value={valor[chave]}
            onChange={(e) => mexer(chave, e.target.value)}
            placeholder={TEXTOS_LOGIN_PADRAO[chave]}
            className={`${classe} h-10`}
          />
        )}
      </Campo>
    );
  };

  const frases = valor.registro;
  const mudarFrase = (i: number, texto: string) =>
    onMudar({ ...valor, registro: frases.map((f, j) => (j === i ? texto : f)) });

  return (
    <Cartao
      id="login"
      titulo="Tela de login"
      subtitulo="Os textos que aparecem para quem vai entrar no sistema."
      Icone={LogIn}
      estado={estado}
      acessorio={
        !noPadrao && (
          <button
            type="button"
            onClick={() =>
              onMudar({ ...TEXTOS_LOGIN_PADRAO, registro: [...TEXTOS_LOGIN_PADRAO.registro] })
            }
            title="Voltar todos os textos de fábrica"
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-[#015FC9] hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Restaurar
          </button>
        )
      }
    >
      <div className="pt-4 space-y-6">
        {/* ------------------------------------------------ PRÉVIA ---- */}
        <div>
          <div
            ref={moldura}
            className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#040C16] shadow-inner"
            style={{ height: TELA.altura * escala }}
          >
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                width: TELA.largura,
                height: TELA.altura,
                transform: `scale(${escala})`
              }}
            >
              <TelaDeLogin
                email=""
                onEmail={() => {}}
                senha=""
                onSenha={() => {}}
                verificando={false}
                onEntrar={(e) => e.preventDefault()}
                bancoConfigurado
                onDemonstracao={() => {}}
                aviso={null}
                previa={{ textos: valor }}
              />
            </div>
            <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur text-[9.5px] font-black uppercase tracking-wider text-slate-600 shadow-sm">
              <Eye className="w-3 h-3 text-[#015FC9]" />
              Prévia ao vivo
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 font-semibold leading-relaxed">
            A prévia muda enquanto você digita. A tela de login de verdade só
            muda depois de salvar.
          </p>
        </div>

        {/* ------------------------------------------ PAINEL DE ACESSO ---- */}
        <Grupo
          titulo="Painel de acesso"
          dica="Título, rótulos e botões nunca ficam em branco: apagados, voltam ao texto de fábrica."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            {campo('marca', 'Nome ao lado da logo', { dica: 'Em branco, fica só a logo.' })}
            {campo('titulo', 'Título', {
              multilinha: true,
              dica: 'Enter quebra a linha na tela.'
            })}
            {campo('rotuloEmail', 'Rótulo do e-mail')}
            {campo('exemploEmail', 'Exemplo dentro do campo de e-mail')}
            {campo('rotuloSenha', 'Rótulo da senha')}
            {campo('avisoCapsLock', 'Aviso de Caps Lock ligado')}
            {campo('botaoEntrar', 'Botão de entrar')}
            {campo('botaoVerificando', 'Botão enquanto confere a senha')}
          </div>
        </Grupo>

        {/* ------------------------------------------------------ MAPA ---- */}
        <Grupo
          titulo="O mapa"
          dica="Aqui, campo apagado some da tela — é o jeito de tirar uma frase."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            {campo('manchete', 'Manchete — primeira linha')}
            {campo('mancheteDestaque', 'Manchete — linha em laranja')}
          </div>
          <div className="mt-4">{campo('descricao', 'Frase de apoio', { multilinha: true })}</div>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {campo('legendaMissoes', 'Legenda: missões')}
            {campo('legendaEquipe', 'Legenda: equipe')}
            {campo('legendaCheckins', 'Legenda: check-ins')}
            {campo('legendaCenso', 'Legenda: Censo')}
          </div>
        </Grupo>

        {/* --------------------------------------------- A FAIXA AO VIVO ---- */}
        <Grupo
          titulo="Faixa ao vivo"
          dica="As frases passam uma de cada vez, a cada 3 segundos. Sem nenhuma frase, a faixa some."
        >
          <div className="max-w-xs">{campo('rotuloAoVivo', 'Rótulo da faixa')}</div>
          <div className="mt-4 space-y-2">
            <span className="block text-[10px] uppercase font-black tracking-widest text-[#8492A6]">
              Frases ({frases.filter((f) => f.trim()).length})
            </span>
            {frases.map((frase, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-right text-[10.5px] font-black text-slate-300 tabular-nums shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={frase}
                  onChange={(e) => mudarFrase(i, e.target.value)}
                  placeholder="Escreva a frase"
                  className="flex-1 min-w-0 h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-[12.5px] font-semibold text-slate-800 placeholder-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => onMudar({ ...valor, registro: frases.filter((_, j) => j !== i) })}
                  title="Tirar esta frase"
                  aria-label={`Tirar a frase ${i + 1}`}
                  className="w-9 h-9 shrink-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {frases.length < MAX_FRASES && (
              <button
                type="button"
                onClick={() => onMudar({ ...valor, registro: [...frases, ''] })}
                className="ml-8 h-9 px-3.5 rounded-xl border border-dashed border-slate-300 hover:border-[#015FC9] hover:text-[#015FC9] text-slate-500 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar frase
              </button>
            )}
          </div>
        </Grupo>
      </div>
    </Cartao>
  );
}

function Grupo({
  titulo,
  dica,
  children
}: {
  titulo: string;
  dica: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-5 border-t border-slate-100">
      <p className="text-[11.5px] font-black uppercase tracking-wider text-slate-700">{titulo}</p>
      <p className="text-[11px] text-slate-400 font-semibold mt-0.5 mb-4">{dica}</p>
      {children}
    </div>
  );
}
