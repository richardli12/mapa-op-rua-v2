import React, { useRef, useState } from 'react';
import { Camera, Video, Images, Trash2, RefreshCw, Play, Loader2, AlertCircle, X } from 'lucide-react';

const AZUL = '#0C3556';
const VERDE = '#08A47B';

export type MidiaTipo = 'image' | 'video';

export interface MidiaItem {
  id: string;
  tipo: MidiaTipo;
  /** Prévia local (objectURL) enquanto sobe; depois a URL pública do arquivo. */
  previa: string;
  url?: string;
  storagePath?: string;
  progresso: number;
  estado: 'enviando' | 'pronto' | 'erro';
  erro?: string;
}

interface CheckInMidiasProps {
  itens: MidiaItem[];
  /** Falso depois de "Confirmar mídias": vira a mensagem fixa da conversa. */
  editavel: boolean;
  avatar: React.ReactNode;
  hora: string;
  onAdicionar: (arquivos: FileList, tipo: MidiaTipo) => void;
  onRemover: (id: string) => void;
  onSubstituir: (id: string, arquivo: File) => void;
  onConfirmar: () => void;
}

/**
 * Fotos e vídeos do check-in, no formato de mensagem do integrante.
 *
 * Enquanto a etapa está aberta cada miniatura traz o progresso do envio e os
 * botões de excluir e substituir. Confirmada a etapa, o mesmo bloco continua
 * na conversa como mensagem azul, só que sem os botões.
 */
export default function CheckInMidias({
  itens,
  editavel,
  avatar,
  hora,
  onAdicionar,
  onRemover,
  onSubstituir,
  onConfirmar
}: CheckInMidiasProps) {
  const fotoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const trocaRef = useRef<HTMLInputElement>(null);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [previa, setPrevia] = useState<MidiaItem | null>(null);

  const enviando = itens.some(i => i.estado === 'enviando');
  const prontos = itens.filter(i => i.estado === 'pronto');
  const fotos = prontos.filter(i => i.tipo === 'image').length;
  const videos = prontos.filter(i => i.tipo === 'video').length;

  const pegar = (
    ref: React.RefObject<HTMLInputElement | null>,
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: MidiaTipo
  ) => {
    if (e.target.files?.length) onAdicionar(e.target.files, tipo);
    // Zera o campo: escolher o mesmo arquivo de novo precisa disparar o evento.
    if (ref.current) ref.current.value = '';
  };

  const resumo = [
    fotos ? `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}` : '',
    videos ? `${videos} ${videos === 1 ? 'vídeo' : 'vídeos'}` : ''
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <>
      {itens.length > 0 && (
        <div className="flex items-end gap-2 flex-row-reverse">
          {avatar}
          <div className="max-w-[80%] w-full">
            <div
              className="w-full rounded-2xl rounded-br-md overflow-hidden shadow-sm p-2"
              style={{ backgroundColor: AZUL }}
            >
              <div className="grid grid-cols-3 gap-1.5">
                {itens.map(item => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => item.estado === 'pronto' && setPrevia(item)}
                      className="absolute inset-0 w-full h-full cursor-pointer"
                      title="Ver em tamanho grande"
                    >
                      {item.tipo === 'image' ? (
                        <img src={item.previa} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={item.previa} className="w-full h-full object-cover" muted playsInline />
                      )}
                    </button>

                    {item.tipo === 'video' && item.estado === 'pronto' && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="w-7 h-7 rounded-full bg-black/45 flex items-center justify-center">
                          <Play className="w-3.5 h-3.5 text-white fill-white" />
                        </span>
                      </span>
                    )}

                    {item.estado === 'enviando' && (
                      <span className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1 px-1.5">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                        <span className="w-full h-1 rounded-full bg-white/30 overflow-hidden">
                          <span
                            className="block h-full rounded-full transition-[width] duration-200"
                            style={{ width: `${item.progresso}%`, backgroundColor: VERDE }}
                          />
                        </span>
                        <span className="text-[9px] font-black text-white">{item.progresso}%</span>
                      </span>
                    )}

                    {item.estado === 'erro' && (
                      <span className="absolute inset-0 bg-rose-900/70 flex flex-col items-center justify-center gap-1 px-1 text-center">
                        <AlertCircle className="w-4 h-4 text-white" />
                        <span className="text-[9px] font-bold text-white leading-tight">
                          {item.erro || 'falhou'}
                        </span>
                      </span>
                    )}

                    {editavel && (
                      <>
                        <button
                          type="button"
                          onClick={() => onRemover(item.id)}
                          title="Excluir"
                          aria-label="Excluir"
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTrocando(item.id);
                            trocaRef.current?.click();
                          }}
                          title="Substituir"
                          aria-label="Substituir"
                          className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 px-1 pt-2 pb-0.5">
                <span className="text-[11px] font-bold text-white/80">
                  {resumo || 'enviando...'}
                </span>
                <span className="text-[10px] text-white/50 font-semibold">{hora}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {editavel && (
        <div className="flex items-end gap-2 flex-row-reverse">
          <span className="w-7 shrink-0" />
          <div className="max-w-[80%] w-full flex flex-col items-end gap-2">
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
              <input
                ref={galeriaRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={e => {
                  const arquivos = e.target.files;
                  if (arquivos?.length) {
                    // A galeria mistura foto e vídeo: o tipo sai de cada arquivo.
                    onAdicionar(arquivos, 'image');
                  }
                  if (galeriaRef.current) galeriaRef.current.value = '';
                }}
              />
              <input
                ref={trocaRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={e => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo && trocando) onSubstituir(trocando, arquivo);
                  setTrocando(null);
                  if (trocaRef.current) trocaRef.current.value = '';
                }}
              />

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-[12px] font-bold rounded-full shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" style={{ color: AZUL }} />
                  Foto
                </button>
                <button
                  type="button"
                  onClick={() => videoRef.current?.click()}
                  className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-[12px] font-bold rounded-full shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Video className="w-3.5 h-3.5" style={{ color: AZUL }} />
                  Vídeo
                </button>
                <button
                  type="button"
                  onClick={() => galeriaRef.current?.click()}
                  className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-[12px] font-bold rounded-full shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Images className="w-3.5 h-3.5" style={{ color: AZUL }} />
                  Galeria
                </button>
              </div>

              <button
                type="button"
                onClick={onConfirmar}
                disabled={prontos.length === 0 || enviando}
                className="w-full py-2.5 text-white text-[12px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                style={{ backgroundColor: AZUL }}
              >
                {enviando ? 'Enviando arquivos...' : 'Confirmar mídias'}
              </button>
              <p className="text-[11px] text-slate-400 font-semibold text-right">
                {prontos.length === 0
                  ? 'Envie pelo menos uma foto ou vídeo.'
                  : 'Pode adicionar mais antes de confirmar.'}
              </p>
          </div>
        </div>
      )}

      {/* Pré-visualização em tela cheia */}
      {previa && (
        <div
          className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPrevia(null)}
        >
          <button
            type="button"
            onClick={() => setPrevia(null)}
            aria-label="Fechar"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          {previa.tipo === 'image' ? (
            <img src={previa.previa} alt="" className="max-w-full max-h-full object-contain" />
          ) : (
            <video
              src={previa.previa}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}
