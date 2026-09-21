import React, { useEffect } from 'react';
import {
  Camera,
  Check,
  Clock,
  Flag,
  LogOut,
  MapPin,
  MessageSquare,
  Plus,
  Target
} from 'lucide-react';
import { CheckIn } from '../../types';
import MiniMapa from '../MiniMapa';
import { AZUL, AnelDeProgresso, VERDE, contar, vibrar } from './pecas';

/**
 * O fim do check-in.
 *
 * Antes o fio terminava e a pessoa caía numa tela antiga do painel, montada
 * com campos de um formulário que esta conversa não preenche mais: aparecia
 * "Localização: ," e "Check-in por missão" mesmo num registro livre. Depois de
 * cinco etapas de trabalho, o fecho era um recibo errado.
 *
 * Agora quem fecha é quem tem os dados: o mapa do ponto que foi gravado, as
 * fotos que subiram, o que foi marcado — e, o que mais importa na rua, o
 * número da meta já contando este check-in. É daqui que sai o próximo, em um
 * toque, sem passar por login nem recarregar nada.
 */
export default function Concluido({
  registro,
  metaDepois,
  onNovo,
  onSair
}: {
  registro: CheckIn;
  /** Sem meta cadastrada, não há anel: o fecho é só o recibo. */
  metaDepois: { feito: number; alvo: number; rotulo: string; cor: string } | null;
  onNovo: () => void;
  onSair: () => void;
}) {
  useEffect(() => {
    // Três toques curtos: o "pronto" que a pessoa sente sem olhar a tela.
    vibrar([18, 60, 18]);
  }, []);

  const fotos = (registro.media || []).filter(m => m.type === 'image');
  const videos = (registro.media || []).filter(m => m.type === 'video');
  const textos = (registro.notes || []).filter(n => n.kind === 'texto');
  const audios = (registro.notes || []).filter(n => n.kind === 'audio');
  const batida = !!metaDepois && metaDepois.alvo > 0 && metaDepois.feito >= metaDepois.alvo;
  const faltam = metaDepois ? Math.max(0, metaDepois.alvo - metaDepois.feito) : 0;

  const hora = new Date(registro.createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const Linha = ({
    icone,
    rotulo,
    valor
  }: {
    icone: React.ReactNode;
    rotulo: string;
    valor: string;
  }) => (
    <li className="flex items-center gap-2.5 py-2.5">
      <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400">
          {rotulo}
        </span>
        <span className="block text-[13px] font-bold leading-snug" style={{ color: AZUL }}>
          {valor}
        </span>
      </span>
    </li>
  );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: '#F3F6FA' }}>
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 pt-8 pb-6"
        style={{ paddingTop: 'max(2rem, calc(env(safe-area-inset-top) + 1.5rem))' }}
      >
        <div className="max-w-[440px] mx-auto">
          {/* O selo */}
          <div className="flex flex-col items-center text-center">
            <span className="relative flex items-center justify-center">
              <span
                className="ck-onda absolute w-16 h-16 rounded-full"
                style={{ backgroundColor: VERDE }}
              />
              <span
                className="ck-selo relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: VERDE }}
              >
                <Check className="w-8 h-8 text-white stroke-[3]" />
              </span>
            </span>
            <h1 className="mt-4 text-[24px] font-black leading-tight" style={{ color: AZUL }}>
              Check-in gravado
            </h1>
            <p className="mt-1 text-[12.5px] font-bold text-slate-400">
              {registro.mode === 'missao' && registro.missionTitle
                ? `Missão "${registro.missionTitle}" cumprida às ${hora}`
                : `Registro livre feito às ${hora}`}
            </p>
          </div>

          {/* A meta, já contando este */}
          {metaDepois && metaDepois.alvo > 0 && (
            <div
              className="ck-entra mt-6 rounded-3xl border p-4 flex items-center gap-4"
              style={{
                backgroundColor: batida ? '#F0FDF7' : '#FFFFFF',
                borderColor: batida ? '#A7F3D0' : '#E8EEF4'
              }}
            >
              <AnelDeProgresso
                feito={metaDepois.feito}
                alvo={metaDepois.alvo}
                tamanho={66}
                espessura={6.5}
                cor={batida ? VERDE : metaDepois.cor}
                corDoTrilho="#E8EEF4"
                risca
              >
                <span className="text-[19px] font-black tabular-nums" style={{ color: AZUL }}>
                  {metaDepois.feito}
                </span>
              </AnelDeProgresso>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[15px] font-black leading-tight"
                  style={{ color: batida ? '#05603F' : AZUL }}
                >
                  {batida
                    ? 'Meta batida!'
                    : faltam === 1
                      ? 'Falta 1 para a meta.'
                      : `Faltam ${faltam} para a meta.`}
                </p>
                <p className="text-[11.5px] font-bold text-slate-400 mt-0.5">
                  {metaDepois.feito} de {metaDepois.alvo} {metaDepois.rotulo}
                </p>
              </div>
            </div>
          )}

          {/* O recibo */}
          <div className="ck-entra mt-3 rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            {registro.coordinates?.lat !== 0 && (
              <MiniMapa
                lat={registro.coordinates.lat}
                lng={registro.coordinates.lng}
                height={132}
              />
            )}

            {fotos.length + videos.length > 0 && (
              <div className="flex gap-1.5 p-2.5 pb-0 overflow-x-auto rolagem-invisivel">
                {(registro.media || []).slice(0, 8).map((m, i) => (
                  <span
                    key={i}
                    className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100"
                  >
                    {m.type === 'image' ? (
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                    )}
                  </span>
                ))}
              </div>
            )}

            <ul className="px-4 py-1 divide-y divide-slate-100">
              <Linha
                icone={<MapPin className="w-3.5 h-3.5" />}
                rotulo="Onde"
                valor={
                  [registro.rua, registro.bairro, registro.municipio]
                    .filter(Boolean)
                    .join(', ') || 'Ponto capturado por GPS'
                }
              />
              <Linha
                icone={<Flag className="w-3.5 h-3.5" />}
                rotulo="O que"
                valor={
                  (registro.operations || []).map(o => o.operationTypeLabel).join(', ') ||
                  'Sem operação marcada'
                }
              />
              <Linha
                icone={<Camera className="w-3.5 h-3.5" />}
                rotulo="Provas"
                valor={`${contar(fotos.length, 'foto', 'fotos')} · ${contar(
                  videos.length,
                  'vídeo',
                  'vídeos'
                )}`}
              />
              <Linha
                icone={<MessageSquare className="w-3.5 h-3.5" />}
                rotulo="Observações"
                valor={
                  textos.length + audios.length === 0
                    ? 'Nenhuma'
                    : `${contar(textos.length, 'texto', 'textos')} · ${contar(
                        audios.length,
                        'áudio',
                        'áudios'
                      )}`
                }
              />
              <Linha
                icone={
                  registro.mode === 'missao' ? (
                    <Target className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )
                }
                rotulo="Modalidade"
                valor={
                  registro.mode === 'missao'
                    ? `Missão: ${registro.missionTitle || 'do comitê'}`
                    : 'Registro livre'
                }
              />
            </ul>
          </div>
        </div>
      </div>

      {/* A saída: o próximo check-in é o caminho largo */}
      <div
        className="shrink-0 bg-white border-t border-slate-150 px-4 pt-3"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 30px -22px rgba(12,53,86,.55)'
        }}
      >
        <div className="max-w-[440px] mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSair}
            className="h-[52px] px-4 rounded-2xl border border-slate-200 text-slate-500 text-[12px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
          <button
            type="button"
            onClick={() => {
              vibrar();
              onNovo();
            }}
            className="flex-1 h-[52px] rounded-2xl text-white text-[13px] font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.985] shadow-lg"
            style={{ backgroundColor: AZUL, boxShadow: `0 10px 22px -12px ${AZUL}` }}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Fazer outro check-in
          </button>
        </div>
      </div>
    </div>
  );
}
