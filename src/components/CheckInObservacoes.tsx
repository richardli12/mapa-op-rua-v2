import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Pause, Trash2, Pencil, Check, X, Plus, Loader2, AlertCircle } from 'lucide-react';

const AZUL = '#0C3556';
const VERDE = '#08A47B';

export interface ObservacaoItem {
  id: string;
  tipo: 'texto' | 'audio';
  texto?: string;
  /** Áudio: prévia local enquanto sobe, depois a URL pública. */
  previa?: string;
  url?: string;
  storagePath?: string;
  duracao?: number;
  progresso: number;
  estado: 'enviando' | 'pronto' | 'erro';
  erro?: string;
}

interface CheckInObservacoesProps {
  itens: ObservacaoItem[];
  editavel: boolean;
  avatar: React.ReactNode;
  hora: string;
  onAdicionarTexto: (texto: string) => void;
  onEditarTexto: (id: string, texto: string) => void;
  onRemover: (id: string) => void;
  onGravou: (blob: Blob, duracao: number) => void;
  onRegravar: (id: string) => void;
  onConfirmar: () => void;
}

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Um áudio da conversa: tocar, pausar, ver a duração e apagar. */
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

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

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
  const andamento = total ? Math.min(100, (posicao / total) * 100) : 0;

  return (
    <div
      className="max-w-[80%] rounded-2xl rounded-br-md shadow-sm px-3 py-2.5"
      style={{ backgroundColor: AZUL }}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={alternar}
          disabled={item.estado === 'enviando'}
          aria-label={tocando ? 'Pausar' : 'Reproduzir'}
          className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
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
          <span className="block h-1.5 rounded-full bg-white/25 overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${item.estado === 'enviando' ? item.progresso : andamento}%`,
                backgroundColor: VERDE
              }}
            />
          </span>
          <span className="block text-[10px] font-bold text-white/70 mt-1">
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
              className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemover(item.id)}
              title="Excluir áudio"
              aria-label="Excluir áudio"
              className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
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
      className="max-w-[80%] rounded-2xl rounded-br-md shadow-sm px-3.5 py-2.5"
      style={{ backgroundColor: AZUL }}
    >
      {editando ? (
        <>
          <textarea
            value={rascunho}
            onChange={e => setRascunho(e.target.value)}
            rows={3}
            autoFocus
            className="w-full bg-white/10 text-white text-[13px] rounded-lg p-2 outline-none resize-none placeholder:text-white/40"
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => {
                setRascunho(item.texto || '');
                setEditando(false);
              }}
              aria-label="Cancelar"
              className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
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
              className="w-7 h-7 rounded-full text-white flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: VERDE }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-white leading-snug whitespace-pre-wrap break-words">
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
              className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemover(item.id)}
              title="Excluir"
              aria-label="Excluir"
              className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer active:scale-95"
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
 * Observações do check-in: textos digitados e áudios gravados na hora.
 *
 * A etapa é opcional — dá para confirmar sem nada —, mas cada observação
 * adicionada vira uma mensagem do integrante, igual às demais da conversa.
 */
export default function CheckInObservacoes({
  itens,
  editavel,
  avatar,
  hora,
  onAdicionarTexto,
  onEditarTexto,
  onRemover,
  onGravou,
  onRegravar,
  onConfirmar
}: CheckInObservacoesProps) {
  const [texto, setTexto] = useState('');
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erroMic, setErroMic] = useState<string | null>(null);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const relogioRef = useRef<number | null>(null);
  const inicioRef = useRef(0);

  const pararRelogio = () => {
    if (relogioRef.current !== null) {
      window.clearInterval(relogioRef.current);
      relogioRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      pararRelogio();
      gravadorRef.current?.stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const gravar = async () => {
    setErroMic(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErroMic('Este aparelho não permite gravar áudio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // O formato varia por navegador: deixa o próprio aparelho escolher.
      const gravador = new MediaRecorder(stream);
      pedacosRef.current = [];
      gravador.ondataavailable = e => e.data.size > 0 && pedacosRef.current.push(e.data);
      gravador.onstop = () => {
        pararRelogio();
        stream.getTracks().forEach(t => t.stop());
        const duracao = Math.max(1, Math.round((Date.now() - inicioRef.current) / 1000));
        const blob = new Blob(pedacosRef.current, {
          type: gravador.mimeType || 'audio/webm'
        });
        setGravando(false);
        setSegundos(0);
        if (blob.size > 0) onGravou(blob, duracao);
      };
      gravadorRef.current = gravador;
      inicioRef.current = Date.now();
      gravador.start();
      setGravando(true);
      setSegundos(0);
      relogioRef.current = window.setInterval(
        () => setSegundos(Math.round((Date.now() - inicioRef.current) / 1000)),
        250
      );
    } catch {
      setErroMic('Permita o acesso ao microfone para gravar.');
    }
  };

  const parar = () => gravadorRef.current?.stop();

  const textos = itens.filter(i => i.tipo === 'texto').length;
  const audios = itens.filter(i => i.tipo === 'audio').length;
  const enviando = itens.some(i => i.estado === 'enviando');

  return (
    <>
      {itens.map(item => (
        <div key={item.id} className="flex items-end gap-2 flex-row-reverse">
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

      {editavel && (
        <div className="flex items-end gap-2 flex-row-reverse">
          <span className="w-7 shrink-0" />
          <div className="max-w-[80%] w-full flex flex-col items-end gap-2">
            <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-2.5">
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                rows={2}
                placeholder="Escreva uma observação..."
                className="w-full text-[13px] text-slate-700 outline-none resize-none placeholder:text-slate-400"
              />
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={gravando ? parar : gravar}
                  className={`px-3 py-2 text-[12px] font-bold rounded-full flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    gravando ? 'text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                  style={gravando ? { backgroundColor: '#E11D48' } : undefined}
                >
                  {gravando ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-white" />
                      Parar {mmss(segundos)}
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" style={{ color: AZUL }} />
                      Gravar áudio
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const limpo = texto.trim();
                    if (!limpo) return;
                    onAdicionarTexto(limpo);
                    setTexto('');
                  }}
                  disabled={!texto.trim()}
                  className="px-3 py-2 text-white text-[12px] font-bold rounded-full flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: AZUL }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>

              {erroMic && (
                <p className="mt-1.5 text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {erroMic}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onConfirmar}
              disabled={gravando || enviando}
              className="w-full py-2.5 text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
              style={{ backgroundColor: AZUL }}
            >
              {enviando ? 'Enviando áudio...' : 'Confirmar observações'}
            </button>
            <p className="text-[11px] text-slate-400 font-semibold text-right">
              {itens.length === 0
                ? 'A observação é opcional: dá para seguir sem nenhuma.'
                : `${textos} ${textos === 1 ? 'texto' : 'textos'} • ${audios} ${
                    audios === 1 ? 'áudio' : 'áudios'
                  }`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
