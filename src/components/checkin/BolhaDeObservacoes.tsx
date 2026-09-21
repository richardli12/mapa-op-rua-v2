import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Mic, Pause, Pencil, Play, Trash2, X } from 'lucide-react';
import { AZUL, VERDE } from './pecas';
import { ObservacaoItem, mmss } from './tipos';

/**
 * Um áudio da conversa: tocar, pausar, ver a duração e apagar.
 *
 * As barrinhas de trás não são medição de som — o navegador não entrega isso
 * de graça — mas dão ao áudio a cara de áudio, e é por elas que o andamento
 * corre enquanto toca. Sem isso o áudio vira um retângulo azul mudo no meio
 * de uma conversa.
 */
function BolhaAudio({
  item,
  editavel,
  hora,
  onRemover,
  onRegravar
}: {
  item: ObservacaoItem;
  editavel: boolean;
  hora: string;
  onRemover: (id: string) => void;
  onRegravar: (id: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  const alternar = () => {
    // A prévia local toca na hora, sem depender da rede; a URL pública fica de
    // reserva para quando a página já não tiver o arquivo em mãos.
    const fonte = item.previa || item.url;
    if (!fonte) return;
    if (!audioRef.current) {
      const audio = new Audio(fonte);
      audio.onended = () => {
        setTocando(false);
        setPosicao(0);
      };
      audio.ontimeupdate = () => setPosicao(audio.currentTime);
      audioRef.current = audio;
    }
    if (tocando) {
      audioRef.current.pause();
      setTocando(false);
    } else {
      audioRef.current.play().catch(() => setTocando(false));
      setTocando(true);
    }
  };

  const total = item.duracao || 0;
  const andamento =
    item.estado === 'enviando' ? item.progresso : total ? Math.min(100, (posicao / total) * 100) : 0;

  /* Alturas fixas, sorteadas uma vez pelo id: a mesma observação desenha
     sempre as mesmas barras, em vez de tremer a cada render. */
  const barras = React.useMemo(() => {
    let semente = 0;
    for (const c of item.id) semente = (semente * 31 + c.charCodeAt(0)) % 9973;
    return Array.from({ length: 26 }, (_, i) => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return 28 + ((semente >> (i % 7)) % 72);
    });
  }, [item.id]);

  return (
    <div
      className="max-w-[86%] rounded-2xl rounded-br-md shadow-sm px-3 py-2.5"
      style={{ backgroundColor: AZUL }}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={alternar}
          disabled={item.estado === 'enviando'}
          aria-label={tocando ? 'Pausar' : 'Reproduzir'}
          className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
        >
          {item.estado === 'enviando' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : tocando ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <span className="flex items-end gap-[2px] h-6" aria-hidden="true">
            {barras.map((altura, i) => {
              const passou = (i / barras.length) * 100 <= andamento;
              return (
                <span
                  key={i}
                  className="flex-1 rounded-full transition-colors"
                  style={{
                    height: `${altura}%`,
                    backgroundColor: passou ? VERDE : 'rgba(255,255,255,0.28)'
                  }}
                />
              );
            })}
          </span>
          <span className="block text-[10.5px] font-bold text-white/70 mt-1">
            {item.estado === 'enviando'
              ? `enviando ${item.progresso}%`
              : item.estado === 'erro'
                ? item.erro || 'falha no envio'
                : `${mmss(posicao)} / ${mmss(total)}`}
          </span>
        </div>

        {editavel && (
          <span className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onRegravar(item.id)}
              title="Gravar de novo"
              aria-label="Gravar de novo"
              className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemover(item.id)}
              title="Excluir áudio"
              aria-label="Excluir áudio"
              className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
        )}
      </div>
      <p className="text-[10px] text-white/50 font-semibold mt-1.5 text-right">{hora}</p>
    </div>
  );
}

/** Uma observação digitada: pode ser corrigida ou apagada até a confirmação. */
function BolhaTexto({
  item,
  editavel,
  hora,
  onEditar,
  onRemover
}: {
  item: ObservacaoItem;
  editavel: boolean;
  hora: string;
  onEditar: (id: string, texto: string) => void;
  onRemover: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(item.texto || '');

  return (
    <div
      className="max-w-[86%] rounded-2xl rounded-br-md shadow-sm px-3.5 py-2.5"
      style={{ backgroundColor: AZUL }}
    >
      {editando ? (
        <>
          <textarea
            value={rascunho}
            onChange={e => setRascunho(e.target.value)}
            rows={3}
            autoFocus
            className="w-full bg-white/10 text-white text-[13.5px] rounded-lg p-2 outline-none resize-none placeholder:text-white/40"
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => {
                setRascunho(item.texto || '');
                setEditando(false);
              }}
              aria-label="Cancelar"
              className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const limpo = rascunho.trim();
                if (!limpo) return;
                onEditar(item.id, limpo);
                setEditando(false);
              }}
              aria-label="Salvar"
              className="w-8 h-8 rounded-full text-white flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: VERDE }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : (
        <p className="text-[13.5px] text-white leading-snug whitespace-pre-wrap break-words">
          {item.texto}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 mt-1.5">
        {editavel && !editando ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditando(true)}
              title="Editar"
              aria-label="Editar"
              className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemover(item.id)}
              title="Excluir"
              aria-label="Excluir"
              className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] text-white/50 font-semibold">{hora}</span>
      </div>
    </div>
  );
}

/**
 * As observações do check-in no fio: cada texto e cada áudio, uma mensagem.
 *
 * Quem escreve e quem grava é a doca, embaixo. Aqui só vive o que já foi
 * dito — e continua editável enquanto a etapa estiver aberta.
 */
export default function BolhaDeObservacoes({
  itens,
  editavel,
  avatar,
  hora,
  onEditarTexto,
  onRemover,
  onRegravar
}: {
  itens: ObservacaoItem[];
  editavel: boolean;
  avatar: React.ReactNode;
  hora: string;
  onEditarTexto: (id: string, texto: string) => void;
  onRemover: (id: string) => void;
  onRegravar: (id: string) => void;
}) {
  return (
    <>
      {itens.map(item => (
        <div key={item.id} className="ck-entra flex items-end gap-2 flex-row-reverse">
          {avatar}
          {item.tipo === 'texto' ? (
            <BolhaTexto
              item={item}
              editavel={editavel}
              hora={hora}
              onEditar={onEditarTexto}
              onRemover={onRemover}
            />
          ) : (
            <BolhaAudio
              item={item}
              editavel={editavel}
              hora={hora}
              onRemover={onRemover}
              onRegravar={onRegravar}
            />
          )}
        </div>
      ))}
    </>
  );
}
