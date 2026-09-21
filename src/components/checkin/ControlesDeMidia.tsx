import React, { useRef, useState } from 'react';
import { Camera, Images, ShieldCheck, Video, WifiOff } from 'lucide-react';
import { AZUL, vibrar } from './pecas';
import { MidiaTipo } from './tipos';
import { AtalhoDaDoca } from './Doca';

/**
 * Lembrete do "sim" dado nesta tela, por aparelho.
 *
 * Quem já autorizou uma vez não precisa responder a cada foto: a partir daí o
 * botão abre a câmera direto.
 */
const CHAVE_CAMERA = 'checkin_camera_autorizada';

const cameraJaAutorizada = () => {
  try {
    return localStorage.getItem(CHAVE_CAMERA) === '1';
  } catch {
    return false;
  }
};

/**
 * Os botões que abrem a câmera, dentro da doca.
 *
 * Eles saíram do meio do fio de propósito: capturar é a ação da etapa, e ação
 * de etapa mora no rodapé. Sem sinal, os três apagam — mandar o aparelho abrir
 * a câmera para depois falhar no envio é perder a foto e o tempo de quem está
 * na rua.
 */
export default function ControlesDeMidia({
  permitirGaleria,
  online,
  onArquivos
}: {
  permitirGaleria: boolean;
  online: boolean;
  onArquivos: (arquivos: FileList, padrao: MidiaTipo) => void;
}) {
  const fotoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  /** Qual captura está esperando o "sim" da pessoa. */
  const [pedindo, setPedindo] = useState<MidiaTipo | null>(null);

  const pegar = (
    ref: React.RefObject<HTMLInputElement | null>,
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: MidiaTipo
  ) => {
    if (e.target.files?.length) onArquivos(e.target.files, tipo);
    // Zera o campo: escolher o mesmo arquivo de novo precisa disparar o evento.
    if (ref.current) ref.current.value = '';
  };

  const abrirCamera = (tipo: MidiaTipo) =>
    (tipo === 'image' ? fotoRef : videoRef).current?.click();

  /** Botão de foto/vídeo: primeiro o nosso pedido, depois a câmera. */
  const pedirCamera = (tipo: MidiaTipo) => {
    vibrar();
    if (cameraJaAutorizada()) {
      abrirCamera(tipo);
      return;
    }
    setPedindo(tipo);
  };

  const autorizar = () => {
    const tipo = pedindo;
    setPedindo(null);
    if (!tipo) return;
    try {
      localStorage.setItem(CHAVE_CAMERA, '1');
    } catch {
      // Sem localStorage a pergunta volta na próxima; nada mais quebra.
    }
    // Ainda dentro do toque da pessoa, então o aparelho aceita abrir a câmera.
    abrirCamera(tipo);
  };

  return (
    <>
      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={e => pegar(fotoRef, e, 'image')}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={e => pegar(videoRef, e, 'video')}
      />
      {permitirGaleria && (
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={e => {
            // A galeria mistura foto e vídeo: o tipo sai de cada arquivo.
            if (e.target.files?.length) onArquivos(e.target.files, 'image');
            if (galeriaRef.current) galeriaRef.current.value = '';
          }}
        />
      )}

      <div className="flex items-center gap-2">
        <AtalhoDaDoca
          icone={<Camera className="w-4 h-4" style={{ color: online ? AZUL : undefined }} />}
          rotulo="Foto"
          disabled={!online}
          onClick={() => pedirCamera('image')}
        />
        <AtalhoDaDoca
          icone={<Video className="w-4 h-4" style={{ color: online ? AZUL : undefined }} />}
          rotulo="Vídeo"
          disabled={!online}
          onClick={() => pedirCamera('video')}
        />
        {permitirGaleria && (
          <AtalhoDaDoca
            icone={<Images className="w-4 h-4" style={{ color: online ? AZUL : undefined }} />}
            rotulo="Galeria"
            disabled={!online}
            onClick={() => {
              vibrar();
              galeriaRef.current?.click();
            }}
          />
        )}
      </div>

      {!online && (
        <p className="flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-amber-600">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Sem sinal — espere a conexão voltar para fotografar.
        </p>
      )}

      {/* Pedido de câmera: quem pergunta é o sistema, não o navegador */}
      {pedindo && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/60 flex items-end sm:items-center justify-center p-3 ck-veu">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 ck-folha">
            <span
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
              style={{ backgroundColor: AZUL }}
            >
              <ShieldCheck className="w-6 h-6" />
            </span>

            <h3 className="mt-3.5 text-[16px] font-black text-slate-800 leading-tight">
              Podemos usar a câmera do seu aparelho?
            </h3>
            <p className="mt-2 text-[12px] font-semibold text-slate-400 leading-snug">
              É com ela que você registra a prova do check-in. Ao liberar, o seu
              aparelho ainda pode pedir a confirmação dele uma primeira vez.
            </p>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPedindo(null)}
                className="flex-1 h-[48px] text-[12.5px] font-black uppercase tracking-wider rounded-2xl border border-slate-200 text-slate-500 cursor-pointer transition-all active:scale-[0.98]"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={autorizar}
                className="flex-[1.4] h-[48px] text-white text-[12.5px] font-black uppercase tracking-wider rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                style={{ backgroundColor: AZUL }}
              >
                Liberar câmera
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
