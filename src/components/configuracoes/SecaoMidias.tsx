import React from 'react';
import { Camera } from 'lucide-react';
import { Cartao, Interruptor } from './pecas';

/**
 * De onde pode vir a evidência de campo.
 *
 * Desligado, o integrante só anexa o que fotografar na hora. É o que separa
 * prova de campo de imagem antiga do rolo do celular — e por isso o texto
 * explica a consequência, em vez de só nomear a chave.
 */
export default function SecaoMidias({
  galeria,
  onAlternar,
  ocupado,
  ligado
}: {
  galeria: boolean;
  onAlternar: () => void;
  ocupado: boolean;
  ligado: boolean;
}) {
  return (
    <Cartao
      id="midias"
      titulo="Mídias do check-in"
      subtitulo="De onde pode vir a evidência de campo."
      Icone={Camera}
      estado={ocupado ? 'salvando' : 'instantaneo'}
    >
      <div className="pt-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-slate-700">
            Permitir enviar da galeria
          </p>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-0.5 max-w-[72ch]">
            Desligado, o integrante só anexa o que ele fotografar ou filmar na
            hora, pela câmera — é o que garante que a evidência é daquele
            momento, e não uma imagem antiga do rolo do celular.
          </p>
        </div>
        <Interruptor
          ligado={galeria}
          onMudar={onAlternar}
          ocupado={ocupado}
          desabilitado={!ligado}
          rotulo="Permitir enviar da galeria"
        />
      </div>

      <div
        className={`mt-3 rounded-xl px-3 py-2 border text-[11px] font-bold ${
          galeria
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}
      >
        {galeria
          ? 'Hoje o integrante pode escolher uma imagem já existente no celular.'
          : 'Hoje só entra foto e vídeo feitos na hora, pela câmera.'}
      </div>
    </Cartao>
  );
}
