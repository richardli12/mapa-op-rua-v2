import { AlertTriangle, Info } from 'lucide-react';
import type { AnaliseDeArea } from '../../services/territorio';
import { Cartao, CartaoDeNumero, TituloDeCartao, numero, porcento } from './pecas';

/**
 * Quem mora dentro do círculo desenhado no mapa.
 *
 * A pergunta que abre esta tela não é "como é este município" — é "quanta
 * gente mora DENTRO do que acabei de desenhar". São coisas diferentes, e o
 * que responde a segunda é a rota de análise de área do CCO, que mede o
 * círculo contra a malha de setores censitários.
 *
 * DUAS CONTAS, E A TELA MOSTRA AS DUAS.
 *
 * Um círculo quase nunca cai em cima da malha: ele pega uns setores inteiros
 * e corta outros pela metade. O CCO devolve as duas leituras disso, e a
 * regra do manual é que elas não se misturam:
 *
 * - `exato` é o PISO CONTADO: só os setores inteiramente dentro do círculo.
 *   Ninguém aqui foi estimado — mas quem mora na borda ficou de fora.
 * - `estimativa` é a APROXIMAÇÃO: os setores cortados entram pela fração de
 *   área coberta. É o número mais próximo da realidade, e é um palpite.
 *
 * Mostrar só a estimativa seria vender palpite como contagem; mostrar só o
 * exato seria esconder metade da gente de um círculo pequeno. As duas ficam
 * na tela, com o nome de cada uma.
 *
 * E `foraDaCobertura` NÃO É ZERO. Círculo no meio do mar e círculo num
 * bairro vazio dão o mesmo "0" na soma, e são respostas opostas: uma é
 * "não há dado aqui", a outra é "o dado diz que não mora ninguém". A tela
 * separa as duas.
 */
export default function PainelDoRaio({
  analise,
  raio,
  instituto = 'IBGE'
}: {
  analise: AnaliseDeArea;
  /** O raio desenhado, em metros — é o que dá escala ao resto. */
  raio: number;
  instituto?: string;
}) {
  const area = analise.areaKm2;
  const { tocados, inteiros, parciais } = analise.setores;

  const DICA_ESTIMATIVA =
    'Estimativa: os setores que o círculo corta entram pela fração de área coberta. É aproximação, não contagem.';

  const distancia =
    raio >= 1000
      ? `${(raio / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
      : `${numero(raio)} m`;

  /*
   * Fora da cobertura: a tela para aqui.
   *
   * Desenhar cartões com zero em cima de "não existe dado neste lugar" é
   * fabricar uma resposta. O resto da tela não tem o que dizer, e dizer
   * isso é a resposta certa.
   */
  if (analise.foraDaCobertura) {
    return (
      <div className="px-3.5 py-3 space-y-2.5">
        <Cartao className="p-4">
          <p className="flex items-start gap-2 text-[12.5px] text-[#45556C] leading-snug">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
            <span>
              Este círculo não toca nenhum setor censitário com dado publicado.
              <span className="block mt-1 text-[11.5px] text-slate-400">
                Não é o mesmo que "não mora ninguém aqui": é a malha do Censo que
                não cobre este ponto. Desenhe o raio sobre a área urbana ou
                aumente o alcance.
              </span>
            </span>
          </p>
        </Cartao>
        <p className="px-0.5 text-[11px] text-slate-400">
          Raio de {distancia} · {area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km².
        </p>
      </div>
    );
  }

  return (
    <div className="px-3.5 py-3 space-y-2.5">
      {/* ----------------------------------------------------- cartões --- */}
      <div className="grid grid-cols-3 gap-1">
        <CartaoDeNumero
          rotulo="Moradores"
          valor={numero(analise.estimativa.populacao)}
          origem="derivado"
          instituto={instituto}
          seloRotulo="estimativa"
          seloDica={DICA_ESTIMATIVA}
        />
        <CartaoDeNumero
          rotulo="Domicílios"
          valor={numero(analise.estimativa.domicilios)}
          origem="derivado"
          instituto={instituto}
          seloRotulo="estimativa"
          seloDica={DICA_ESTIMATIVA}
        />
        <CartaoDeNumero
          rotulo="Densidade (hab/km²)"
          valor={numero(analise.estimativa.densidade)}
          origem="derivado"
          instituto={instituto}
          seloRotulo="estimativa"
          seloDica="Moradores estimados divididos pela área do círculo."
        />
      </div>

      {/* -------------------------------------------- contado x estimado --- */}
      <Cartao className="p-4">
        <TituloDeCartao>O que foi contado, e o que foi estimado</TituloDeCartao>
        <div className="mt-3.5 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#45556C]">
                Piso contado
                <span className="block text-[11px] text-slate-400 leading-snug">
                  só os setores inteiramente dentro do círculo
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[13px] font-bold text-[#0F172B] tabular-nums">
                  {numero(analise.exato.populacao)} moradores
                </span>
                <span className="block text-[11px] text-slate-400 tabular-nums">
                  {numero(analise.exato.domicilios)} domicílios
                </span>
              </span>
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-[#45556C]">
              Com os setores da borda
              <span className="block text-[11px] text-slate-400 leading-snug">
                os cortados entram pela fração de área coberta
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[13px] font-bold text-[#0F172B] tabular-nums">
                {numero(analise.estimativa.populacao)} moradores
              </span>
              <span className="block text-[11px] text-slate-400 tabular-nums">
                {numero(analise.estimativa.domicilios)} domicílios
              </span>
            </span>
          </div>
        </div>

        {/*
          A distância entre as duas contas é a margem de dúvida desta medida,
          e é ela que diz se a estimativa pode ser tratada como número firme.
        */}
        {analise.exato.populacao > 0 && analise.estimativa.populacao > 0 && (
          <p className="mt-3 text-[11px] text-slate-400 leading-snug">
            O piso contado é{' '}
            {porcento(analise.exato.populacao / analise.estimativa.populacao, 0)} da
            estimativa — o resto mora nos setores que o círculo corta.
          </p>
        )}
      </Cartao>

      {/* ------------------------------------------------ setores e área --- */}
      <Cartao className="p-4">
        <TituloDeCartao>A área medida</TituloDeCartao>
        <div className="mt-3.5 space-y-2.5">
          <Linha rotulo="Raio desenhado" valor={distancia} />
          <Linha
            rotulo="Área do círculo"
            valor={`${area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km²`}
          />
          <Linha rotulo="Setores tocados" valor={`${numero(tocados)}`} />
        </div>

        {/* A proporção entre inteiro e cortado, que é a qualidade da medida. */}
        {tocados > 0 && (
          <>
            <div className="mt-3.5 h-2 rounded-full overflow-hidden flex bg-[#F1F5F9]">
              <div
                className="bg-[#2563EB]"
                style={{ width: `${(inteiros / tocados) * 100}%` }}
                title={`${numero(inteiros)} setores inteiros dentro do círculo`}
              />
              <div
                className="bg-[#BEDBFF]"
                style={{ width: `${(parciais / tocados) * 100}%` }}
                title={`${numero(parciais)} setores cortados pela borda`}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
              <span className="flex items-center gap-1.5 text-[#45556C]">
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                {numero(inteiros)} inteiros
              </span>
              <span className="flex items-center gap-1.5 text-[#45556C]">
                <span className="w-2 h-2 rounded-full bg-[#BEDBFF]" />
                {numero(parciais)} cortados pela borda
              </span>
            </div>
          </>
        )}
      </Cartao>

      {/* ------------------------------------------------------- avisos --- */}
      {analise.parcialmenteForaDaCobertura && (
        <Cartao className="p-3.5">
          <p className="flex items-start gap-2 text-[11.5px] text-[#C05A13] leading-snug">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            Parte deste círculo cai fora da malha do Censo. O que está fora não
            entrou em nenhuma das duas contas — nem como zero.
          </p>
        </Cartao>
      )}

      {analise.temSetoresParciais && !analise.parcialmenteForaDaCobertura && (
        <p className="px-0.5 flex items-start gap-1.5 text-[11px] text-slate-400 leading-snug">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          Medida de área desenhada: o círculo corta {numero(parciais)}{' '}
          {parciais === 1 ? 'setor' : 'setores'}, e a estimativa reparte cada um
          pela fração de área que ficou dentro.
        </p>
      )}
    </div>
  );
}

/** Uma linha de "rótulo à esquerda, número à direita". */
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-[#45556C]">{rotulo}</span>
      <span className="shrink-0 text-[12.5px] font-bold text-[#0F172B] tabular-nums">
        {valor}
      </span>
    </div>
  );
}
