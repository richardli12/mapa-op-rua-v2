import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Mic, Send, Trash2 } from 'lucide-react';
import { AZUL, VERDE, vibrar } from './pecas';
import { mmss } from './tipos';

/**
 * O campo de escrever da doca — e o microfone ao lado dele.
 *
 * É aqui que a "pegada de chat" deixa de ser enfeite: a pessoa escreve onde
 * ela escreveria em qualquer conversa, no rodapé, e o que ela mandou sobe
 * para o fio. Enquanto grava, o campo inteiro vira a barra de gravação, com
 * o tempo correndo e duas saídas claras — jogar fora ou mandar.
 *
 * Só o áudio precisa de rede. O texto vale mesmo sem sinal: ele viaja junto
 * com o check-in no fim, e não como arquivo à parte.
 */
export default function CompositorDeObservacao({
  online,
  onTexto,
  onAudio
}: {
  online: boolean;
  onTexto: (texto: string) => void;
  onAudio: (blob: Blob, duracao: number) => void;
}) {
  const [texto, setTexto] = useState('');
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erroMic, setErroMic] = useState<string | null>(null);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const relogioRef = useRef<number | null>(null);
  const inicioRef = useRef(0);
  /** Gravação descartada: o `onstop` chega igual, mas o áudio não vai subir. */
  const descartarRef = useRef(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const pararRelogio = () => {
    if (relogioRef.current !== null) {
      window.clearInterval(relogioRef.current);
      relogioRef.current = null;
    }
  };

  useEffect(
    () => () => {
      pararRelogio();
      gravadorRef.current?.stream.getTracks().forEach(t => t.stop());
    },
    []
  );

  /* O campo cresce com o texto até um teto: observação de rua às vezes é um
     parágrafo, e digitar dentro de uma linha só é digitar no escuro. */
  useEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = 'auto';
    campo.style.height = `${Math.min(112, campo.scrollHeight)}px`;
  }, [texto]);

  const gravar = async () => {
    setErroMic(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErroMic('Este aparelho não permite gravar áudio.');
      return;
    }
    if (!online) {
      setErroMic('Sem sinal: o áudio não sobe agora. Escreva a observação.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // O formato varia por navegador: deixa o próprio aparelho escolher.
      const gravador = new MediaRecorder(stream);
      pedacosRef.current = [];
      descartarRef.current = false;
      gravador.ondataavailable = e => e.data.size > 0 && pedacosRef.current.push(e.data);
      gravador.onstop = () => {
        pararRelogio();
        stream.getTracks().forEach(t => t.stop());
        const duracao = Math.max(1, Math.round((Date.now() - inicioRef.current) / 1000));
        const blob = new Blob(pedacosRef.current, { type: gravador.mimeType || 'audio/webm' });
        setGravando(false);
        setSegundos(0);
        if (descartarRef.current) return;
        if (blob.size > 0) onAudio(blob, duracao);
      };
      gravadorRef.current = gravador;
      inicioRef.current = Date.now();
      gravador.start();
      vibrar(18);
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

  const enviarGravacao = () => {
    vibrar();
    descartarRef.current = false;
    gravadorRef.current?.stop();
  };

  const descartarGravacao = () => {
    descartarRef.current = true;
    gravadorRef.current?.stop();
  };

  const enviarTexto = () => {
    const limpo = texto.trim();
    if (!limpo) return;
    vibrar();
    onTexto(limpo);
    setTexto('');
  };

  if (gravando) {
    return (
      <div
        className="w-full h-[54px] rounded-2xl flex items-center gap-3 px-3 border"
        style={{ backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }}
      >
        <button
          type="button"
          onClick={descartarGravacao}
          aria-label="Jogar fora a gravação"
          className="w-10 h-10 rounded-full bg-white border border-rose-200 text-rose-500 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <span className="flex-1 min-w-0 flex items-center gap-2">
          <span className="ck-gravando w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <span className="text-[14px] font-black text-rose-600 tabular-nums">
            {mmss(segundos)}
          </span>
          <span className="text-[11.5px] font-bold text-rose-400 truncate">gravando...</span>
        </span>

        <button
          type="button"
          onClick={enviarGravacao}
          aria-label="Mandar o áudio"
          className="w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
          style={{ backgroundColor: VERDE }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 flex items-end gap-2 p-1.5">
        <textarea
          ref={campoRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={1}
          placeholder="Escreva uma observação..."
          className="flex-1 min-w-0 bg-transparent text-[13.5px] text-slate-700 px-2.5 py-2.5 outline-none resize-none placeholder:text-slate-400 leading-snug"
        />

        {texto.trim() ? (
          <button
            type="button"
            onClick={enviarTexto}
            aria-label="Adicionar observação"
            className="w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
            style={{ backgroundColor: AZUL }}
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={gravar}
            aria-label="Gravar áudio"
            className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
          >
            <Mic className="w-4 h-4" style={{ color: AZUL }} />
          </button>
        )}
      </div>

      {erroMic && (
        <p className="mt-1.5 text-[11.5px] font-bold text-rose-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {erroMic}
        </p>
      )}
    </div>
  );
}
