import React, { useRef, useState } from 'react';
import { AlertCircle, Loader2, Play, RefreshCw, Trash2, X } from 'lucide-react';
import { AZUL, VERDE, contar } from './pecas';
import { MidiaItem } from './tipos';

interface BolhaDeMidiasProps {
  itens: MidiaItem[];
  /** Falso depois de confirmada a etapa: a grade vira mensagem sem botões. */
  editavel: boolean;
  avatar: React.ReactNode;
  hora: string;
  /** Sem galeria liberada, substituir também só vale pela câmera. */
  permitirGaleria: boolean;
  onRemover: (id: string) => void;
  onSubstituir: (id: string, arquivo: File) => void;
}

/**
 * As fotos e vídeos do check-in, como mensagem do integrante.
 *
 * Só a grade mora aqui. Os botões que abrem a câmera saíram para a doca, no
 * rodapé da tela: na rua o polegar não sobe atrás de um botão perdido no meio
 * do fio, ele procura embaixo — é lá que todo aplicativo de conversa põe a
 * câmera, e é lá que ela tem de estar.
 */
export default function BolhaDeMidias({
  itens,
  editavel,
  avatar,
  hora,
  permitirGaleria,
  onRemover,
  onSubstituir
}: BolhaDeMidiasProps) {
  const [previa, setPrevia] = useState<MidiaItem | null>(null);
  /*
   * O campo de substituição mora aqui, colado no botão que o abre.
   *
   * Navegador só deixa um seletor de arquivo abrir dentro do toque da pessoa:
   * mandar o pedido para a doca e abrir de lá, num efeito, faz o toque já ter
   * passado e o iPhone simplesmente ignora.
   */
  const trocaRef = useRef<HTMLInputElement>(null);
  const [trocando, setTrocando] = useState<string | null>(null);

  if (itens.length === 0) return null;

  const prontos = itens.filter(i => i.estado === 'pronto');
  const fotos = prontos.filter(i => i.tipo === 'image').length;
  const videos = prontos.filter(i => i.tipo === 'video').length;
  const subindo = itens.filter(i => i.estado === 'enviando').length;

  const resumo =
    [fotos ? contar(fotos, 'foto', 'fotos') : '', videos ? contar(videos, 'vídeo', 'vídeos') : '']
      .filter(Boolean)
      .join(' · ') || 'enviando...';

  /* Duas colunas com pouca coisa, três a partir de cinco: quatro fotos em três
     colunas deixam a última sozinha numa fileira, e a grade fica torta. */
  const colunas = itens.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <>
      <div className="ck-entra flex items-end gap-2 flex-row-reverse">
        {avatar}
        <div className="max-w-[86%] w-full">
          <div
            className="w-full rounded-2xl rounded-br-md overflow-hidden shadow-sm p-2"
            style={{ backgroundColor: AZUL }}
          >
            <div className={`grid ${colunas} gap-1.5`}>
              {itens.map(item => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-xl overflow-hidden bg-white/10"
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
                      <video
                        src={item.previa}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    )}
                  </button>

                  {item.tipo === 'video' && item.estado === 'pronto' && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </span>
                    </span>
                  )}

                  {item.estado === 'enviando' && (
                    <span className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1 px-2">
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
                    <span className="absolute inset-0 bg-rose-900/75 flex flex-col items-center justify-center gap-1 px-1 text-center">
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
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrocando(item.id);
                          trocaRef.current?.click();
                        }}
                        title="Substituir"
                        aria-label="Substituir"
                        className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 px-1 pt-2 pb-0.5">
              <span className="text-[11.5px] font-bold text-white/85">
                {resumo}
                {subindo > 0 && (
                  <span className="text-white/55"> · {subindo} subindo</span>
                )}
              </span>
              <span className="text-[10px] text-white/50 font-semibold">{hora}</span>
            </div>
          </div>
        </div>

        <input
          ref={trocaRef}
          type="file"
          accept="image/*,video/*"
          {...(permitirGaleria ? {} : { capture: 'environment' as const })}
          className="hidden"
          onChange={e => {
            const arquivo = e.target.files?.[0];
            if (arquivo && trocando) onSubstituir(trocando, arquivo);
            setTrocando(null);
            // Zera o campo: escolher o mesmo arquivo de novo precisa disparar.
            if (trocaRef.current) trocaRef.current.value = '';
          }}
        />
      </div>

      {/* Tamanho grande: conferir o enquadramento antes de confirmar a etapa */}
      {previa && (
        <div
          className="fixed inset-0 z-[3200] bg-black/92 flex items-center justify-center p-4 ck-veu"
          onClick={() => setPrevia(null)}
        >
          <button
            type="button"
            onClick={() => setPrevia(null)}
            aria-label="Fechar"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
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
