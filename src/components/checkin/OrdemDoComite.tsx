import React from 'react';
import {
  BellRing,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Footprints,
  Lock,
  MapPin,
  Navigation,
  Siren,
  Target
} from 'lucide-react';
import { PriorityLevel } from '../../types';
import {
  COR_DO_TURNO,
  JanelaDeTurno,
  NOME_DO_TURNO,
  TurnoId,
  janelaDoTurno,
  situacaoDoTurno,
  tempoCurto
} from '../../turnos';
import { EtiquetaDePrioridade, EtiquetaDeTurno } from '../TurnoEPrioridade';
import { MaterialDaMissao } from '../MaterialDaMissao';
import { AZUL, VERDE, contar, vibrar } from './pecas';
import { MissaoDoCampo } from './tipos';
import {
  distanciaCurta,
  distanciaEmMetros,
  jaChegou,
  linkDeRota,
  tempoAPeCurto
} from './missoes';

const VERMELHO = '#E11D48';

/**
 * O que o comitê mandou, do jeito que a rua precisa ler.
 *
 * Antes isto era uma pilha de cartões brancos iguais entre a saudação e a
 * primeira pergunta do check-in. Uma ordem urgente — a que tem gente
 * esperando do outro lado — tinha exatamente o mesmo peso visual de uma
 * panfletagem de rotina: mudava uma etiqueta de nove pixels, e só.
 *
 * Agora a tela tem dois modos, e é a gravidade que escolhe qual:
 *
 * MODO ORDEM URGENTE. Existe missão no topo da régua e ainda não cumprida
 * hoje? Então não há o que escolher: a ordem toma a frente da conversa como
 * um briefing — distância, tempo a pé, janela do turno, material e o botão
 * que abre a rota —, ela entra sozinha no check-in, e o registro livre e as
 * outras missões ficam trancados, com a razão escrita na tela. É uma ordem,
 * não uma sugestão.
 *
 * MODO NORMAL. Sem ordem urgente aberta, é a lista de sempre: a escolhida
 * recolhe as outras, e cada cartão leva o caminho até o lugar.
 */
interface OrdemDoComiteProps {
  /** Todas as missões desta pessoa, já na ordem em que devem ser lidas. */
  missoes: MissaoDoCampo[];
  /** As do topo da régua que ainda não foram cumpridas hoje. */
  urgentes: MissaoDoCampo[];
  /** A rua está trancada por uma ordem urgente? */
  travado: boolean;
  missaoId: string | null;
  onEscolher: (id: string | null) => void;
  /** Ids que chegaram com a tela aberta e que a pessoa ainda não tocou. */
  novas: string[];
  /**
   * A frase que explica a ordem, dentro do painel.
   *
   * Ela já foi uma bolha de conversa acima do bloco. Ordem não é conversa: o
   * que manda vem antes do que cumprimenta, e a explicação pertence ao painel
   * que ela explica.
   */
  recado?: React.ReactNode;
  niveis: PriorityLevel[];
  janelas: JanelaDeTurno[];
  turnoAgora: TurnoId | null;
  coords: { lat: number; lng: number } | null;
  /**
   * A rota já está na doca, no rodapé.
   *
   * Na etapa de chegada é o rodapé que carrega o "como chegar", porque ele
   * fica fixo enquanto a conversa rola. Repetir o mesmo botão no cartão faz a
   * mesma ação aparecer duas vezes na mesma tela.
   */
  rotaNaDoca?: boolean;
}

/** O nível cadastrado com este id, se ele ainda existir. */
const nivelDe = (niveis: PriorityLevel[], id?: string) =>
  id ? niveis.find(n => n.id === id) : undefined;

/**
 * Os três números que decidem o próximo passo: onde fica, quanto anda e até
 * quando vale.
 *
 * Eles vêm em tijolos, e não numa linha de texto corrida, porque é assim que
 * se lê de relance com o celular na mão e o sol na tela.
 */
function FatosDaMissao({
  missao,
  coords,
  janelas
}: {
  missao: MissaoDoCampo;
  coords: { lat: number; lng: number } | null;
  janelas: JanelaDeTurno[];
}) {
  const chegou = jaChegou(missao, coords);
  const longe = coords && !missao.semLocal ? distanciaEmMetros(coords, missao) : null;
  const situacao = missao.turno ? situacaoDoTurno(janelaDoTurno(janelas, missao.turno)) : null;

  const Tijolo = ({
    icone,
    valor,
    rotulo,
    cor
  }: {
    icone: React.ReactNode;
    valor: string;
    rotulo: string;
    cor?: string;
  }) => (
    <div className="flex-1 min-w-0 rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
      <span
        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400"
        style={cor ? { color: cor } : undefined}
      >
        {icone}
        {rotulo}
      </span>
      <span
        className="block text-[13px] font-black leading-tight mt-0.5 truncate"
        style={{ color: cor || AZUL }}
      >
        {valor}
      </span>
    </div>
  );

  return (
    <div className="flex items-stretch gap-1.5 px-3.5 pb-3">
      {missao.semLocal ? (
        <Tijolo
          icone={<ClipboardList className="w-2.5 h-2.5" />}
          rotulo="Onde"
          valor="Onde você estiver"
        />
      ) : chegou ? (
        <Tijolo
          icone={<Check className="w-2.5 h-2.5 stroke-[3]" />}
          rotulo="Posição"
          valor="Você chegou"
          cor={VERDE}
        />
      ) : longe !== null ? (
        <>
          <Tijolo
            icone={<MapPin className="w-2.5 h-2.5" />}
            rotulo="Daqui"
            valor={distanciaCurta(longe)}
          />
          <Tijolo
            icone={<Footprints className="w-2.5 h-2.5" />}
            rotulo="A pé"
            valor={tempoAPeCurto(longe)}
          />
        </>
      ) : (
        <Tijolo
          icone={<MapPin className="w-2.5 h-2.5" />}
          rotulo="Onde"
          valor={missao.bairro || (missao.tipo === 'area' ? 'Área no mapa' : 'Ponto no mapa')}
        />
      )}

      {situacao && missao.turno && (() => {
        /*
         * O relógio da janela em duas palavras.
         *
         * `curto` do sistema de turnos é escrito para etiqueta larga ("a
         * partir de 06:00") e num tijolo de um terço de tela ele vira
         * "a partir...". Aqui a qualificação sobe para o rótulo pequeno e
         * embaixo fica só o número — que é o que se lê de relance.
         */
        const janela = janelaDoTurno(janelas, missao.turno!);
        const relogio =
          situacao.estado === 'fechando'
            ? { rotulo: 'Fecha em', valor: tempoCurto(situacao.minutos) }
            : situacao.estado === 'agora'
              ? { rotulo: 'Vai até', valor: janela.fim }
              : situacao.estado === 'ainda_vem'
                ? { rotulo: 'Abre às', valor: janela.inicio }
                : { rotulo: 'Janela', valor: 'fechou' };
        return (
          <Tijolo
            icone={<Clock className="w-2.5 h-2.5" />}
            rotulo={relogio.rotulo}
            valor={relogio.valor}
            cor={situacao.estado === 'passou' ? '#B45309' : COR_DO_TURNO[missao.turno!]}
          />
        );
      })()}
    </div>
  );
}

/**
 * O botão que tira a pessoa da dúvida sobre o caminho.
 *
 * O sistema sabia a coordenada desde sempre e não fazia nada com ela: quem
 * estava na rua lia "a 1,2 km de você" e abria o mapa na mão, no outro
 * aplicativo, para digitar um endereço que ele já tinha. Agora é um toque —
 * e a pé, porque é assim que o trabalho é feito.
 */
function ComoChegar({ missao, forte }: { missao: MissaoDoCampo; forte?: boolean }) {
  if (missao.semLocal) return null;
  return (
    <a
      href={linkDeRota(missao)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => vibrar()}
      className={`flex-1 h-[44px] rounded-xl flex items-center justify-center gap-1.5 text-[12.5px] font-black cursor-pointer transition-all active:scale-[0.97] ${
        forte ? 'text-white' : 'border border-slate-200 bg-white text-slate-700'
      }`}
      style={forte ? { backgroundColor: AZUL } : undefined}
    >
      <Navigation className="w-4 h-4" style={forte ? undefined : { color: AZUL }} />
      Como chegar
    </a>
  );
}

/**
 * Os mesmos fatos numa linha só, para o cartão que ainda não foi escolhido.
 *
 * A lista serve para escolher, não para executar: ali o que decide é a
 * distância e a janela, e cabe numa linha. Os tijolos grandes e o botão de
 * rota são da missão escolhida — quem já sabe para onde vai.
 */
function LinhaDeFatos({
  missao,
  coords,
  janelas
}: {
  missao: MissaoDoCampo;
  coords: { lat: number; lng: number } | null;
  janelas: JanelaDeTurno[];
}) {
  const chegou = jaChegou(missao, coords);
  const longe = coords && !missao.semLocal ? distanciaEmMetros(coords, missao) : null;
  const situacao = missao.turno ? situacaoDoTurno(janelaDoTurno(janelas, missao.turno)) : null;

  const partes = [
    missao.semLocal
      ? 'onde você estiver'
      : chegou
        ? null
        : longe !== null
          ? `${distanciaCurta(longe)} · ${tempoAPeCurto(longe)} a pé`
          : missao.bairro || null,
    situacao?.curto || null
  ].filter(Boolean);

  if (chegou && !missao.semLocal) {
    return (
      <p className="flex items-center gap-1.5 text-[10.5px] font-black mt-1.5" style={{ color: VERDE }}>
        <Check className="w-3 h-3 stroke-[3] shrink-0" />
        Você já está no lugar
        {situacao && <span className="text-slate-400">· {situacao.curto}</span>}
      </p>
    );
  }

  if (partes.length === 0) return null;
  return (
    <p className="text-[10.5px] text-slate-400 font-bold mt-1.5">{partes.join(' · ')}</p>
  );
}

/** O corpo de um cartão de missão: título, descrição e etiquetas. */
function CorpoDaMissao({
  missao,
  niveis,
  janelas,
  escolhida,
  nova,
  urgente
}: {
  missao: MissaoDoCampo;
  niveis: PriorityLevel[];
  janelas: JanelaDeTurno[];
  escolhida: boolean;
  nova: boolean;
  urgente: boolean;
}) {
  const cor = missao.color || AZUL;
  const nivel = nivelDe(niveis, missao.priority);

  return (
    <div className="flex items-start gap-2.5">
      <span
        className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
        style={{
          backgroundColor: urgente ? `${VERMELHO}14` : `${cor}1A`,
          color: urgente ? VERMELHO : cor
        }}
      >
        {missao.semLocal ? (
          <ClipboardList className="w-4 h-4" />
        ) : missao.tipo === 'area' ? (
          <Target className="w-4 h-4" />
        ) : (
          <MapPin className="w-4 h-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`font-black leading-tight ${urgente ? 'text-[15px]' : 'text-[13.5px]'}`}
          style={{ color: AZUL }}
        >
          {missao.title}
        </p>

        {nova && (
          <span
            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider text-white"
            style={{ backgroundColor: VERDE }}
          >
            <BellRing className="w-2.5 h-2.5" />
            Chegou agora
          </span>
        )}

        {missao.description && (
          <p className="text-[12px] text-slate-500 leading-snug mt-1 whitespace-pre-line">
            {missao.description}
          </p>
        )}

        {(missao.turno || nivel || missao.tipoLabel) && (
          <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {missao.turno && (
              <EtiquetaDeTurno
                turno={missao.turno}
                janelas={janelas}
                mostrarHoras={false}
                aoVivo
                tamanho="mini"
              />
            )}
            {nivel && <EtiquetaDePrioridade nivel={nivel} tamanho="mini" />}
            {missao.tipoLabel && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[9.5px] font-black uppercase tracking-wider text-slate-500">
                {missao.tipoLabel}
              </span>
            )}
          </span>
        )}
      </div>

      {escolhida && (
        <span
          className="ck-selo w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
          style={{ backgroundColor: urgente ? VERMELHO : VERDE }}
        >
          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
        </span>
      )}
    </div>
  );
}

/**
 * A MOLDURA DA ORDEM — a mesma para a urgente e para a de rotina.
 *
 * Antes eram duas apresentações. A urgente vinha num painel com borda,
 * cabeçalho e rodapé; a comum era um rótulo cinza de dez pixels sobre cartões
 * brancos soltos no meio da conversa. Só que uma missão de rotina também é
 * uma ordem: alguém decidiu que aquela pessoa tem de estar naquele lugar. Ela
 * não pode ter o peso visual de um recado.
 *
 * Então a forma passa a ser uma só — cabeçalho com ícone e contagem, o recado,
 * os cartões, o rodapé — e quem carrega a gravidade é a COR: vermelho com
 * sirene pulsando para a ordem urgente, azul para a missão do dia. Mesmo
 * corpo, temperatura diferente: é o que deixa a urgente continuar urgente.
 */
function PainelDaOrdem({
  cor,
  icone,
  pulsando,
  titulo,
  contador,
  recado,
  rodape,
  children
}: {
  cor: string;
  icone: React.ReactNode;
  pulsando?: boolean;
  titulo: string;
  contador?: React.ReactNode;
  recado?: React.ReactNode;
  rodape?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="ck-entra rounded-3xl overflow-hidden bg-white border-2"
      style={{ borderColor: cor, boxShadow: `0 20px 44px -24px ${cor}` }}
    >
      <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ backgroundColor: cor }}>
        <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
          {pulsando && <span className="ck-bate absolute inset-0 rounded-full bg-white/40" />}
          <span className="relative text-white flex items-center justify-center">{icone}</span>
        </span>
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
          {titulo}
        </span>
        {contador && (
          <>
            <span className="flex-1" />
            <span className="text-[10px] font-black uppercase tracking-wider text-white/70 text-right">
              {contador}
            </span>
          </>
        )}
      </div>

      {recado && (
        <p className="px-3.5 pt-3 text-[12px] font-bold text-slate-500 leading-snug">
          {recado}
        </p>
      )}

      <div className="p-2.5 space-y-2">{children}</div>

      {rodape}
    </div>
  );
}

/**
 * Um cartão de missão.
 *
 * `fixa` é a ordem urgente única: não há escolha a fazer, então o cartão não
 * finge ser um botão. Toque que não muda nada só ensina a pessoa a não
 * confiar na tela.
 */
function CartaoDeMissao({
  missao,
  escolhida,
  nova,
  urgente,
  fixa,
  aberto,
  niveis,
  janelas,
  coords,
  semRota,
  onTocar
}: {
  missao: MissaoDoCampo;
  escolhida: boolean;
  nova: boolean;
  urgente: boolean;
  fixa: boolean;
  /** Briefing aberto mesmo sem ser urgente nem escolhida. */
  aberto?: boolean;
  niveis: PriorityLevel[];
  janelas: JanelaDeTurno[];
  coords: { lat: number; lng: number } | null;
  semRota?: boolean;
  onTocar: () => void;
}) {
  const realce = urgente ? VERMELHO : VERDE;
  /*
   * Briefing completo só para a ordem urgente e para a missão escolhida.
   *
   * Três cartões abertos com tijolos, rota e material viram três telas de
   * rolagem entre a pergunta e a resposta. A lista mostra o que decide; a
   * escolhida mostra o que executa.
   */
  const detalhado = urgente || escolhida || fixa || !!aberto;

  return (
    /*
     * Cartão é div, não botão: o material traz link e tocador de áudio, e o
     * "como chegar" é um link de verdade. Botão dentro de botão não é HTML
     * válido — tocar no play escolheria a missão junto.
     */
    <div
      className="w-full rounded-2xl border bg-white shadow-sm transition-all overflow-hidden"
      style={{
        borderColor: escolhida || nova ? realce : '#E2E8F0',
        boxShadow: escolhida || nova ? `0 0 0 2px ${realce}2E` : undefined
      }}
    >
      {fixa ? (
        <div className="px-3.5 pt-3.5 pb-2.5">
          <CorpoDaMissao
            missao={missao}
            niveis={niveis}
            janelas={janelas}
            escolhida={false}
            nova={nova}
            urgente={urgente}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onTocar}
          className={`w-full text-left px-3.5 pt-3.5 cursor-pointer active:scale-[0.99] transition-transform ${
            detalhado ? 'pb-2.5' : 'pb-1'
          }`}
        >
          <CorpoDaMissao
            missao={missao}
            niveis={niveis}
            janelas={janelas}
            escolhida={escolhida}
            nova={nova}
            urgente={urgente}
          />
        </button>
      )}

      {detalhado && <FatosDaMissao missao={missao} coords={coords} janelas={janelas} />}

      {/* Chegando, o caminho deixa de ser pergunta: o botão sai da frente. */}
      {detalhado && !missao.semLocal && !semRota && !jaChegou(missao, coords) && (
        <div className="flex items-center gap-2 px-3.5 pb-3">
          <ComoChegar missao={missao} forte={urgente} />
        </div>
      )}

      {detalhado && missao.material && missao.material.length > 0 && (
        <div className="px-3.5 pb-3">
          <MaterialDaMissao itens={missao.material} />
        </div>
      )}

      {!detalhado && (
        <div className="px-3.5 pb-3 -mt-1">
          <LinhaDeFatos missao={missao} coords={coords} janelas={janelas} />
        </div>
      )}
    </div>
  );
}

export default function OrdemDoComite({
  missoes,
  urgentes,
  travado,
  missaoId,
  onEscolher,
  novas,
  recado,
  niveis,
  janelas,
  turnoAgora,
  coords,
  rotaNaDoca
}: OrdemDoComiteProps) {
  const [verTodas, setVerTodas] = React.useState(false);

  const missaoEscolhida = missoes.find(m => m.id === missaoId) || null;
  const idsUrgentes = urgentes.map(m => m.id);

  // ------------------------------------------------------ modo ordem urgente
  if (travado && urgentes.length > 0) {
    const outras = missoes.filter(m => !idsUrgentes.includes(m.id));
    const varias = urgentes.length > 1;

    return (
      <div className="space-y-2">
        <PainelDaOrdem
          cor={VERMELHO}
          icone={<Siren className="w-3.5 h-3.5" />}
          pulsando
          titulo={varias ? `${urgentes.length} ordens urgentes` : 'Ordem urgente'}
          recado={recado}
          rodape={
            <div
              className="px-3.5 py-3 flex items-start gap-2.5 border-t"
              style={{ backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }}
            >
              <Lock className="w-4 h-4 shrink-0 mt-px" style={{ color: VERMELHO }} />
              <p className="text-[11.5px] font-bold leading-snug" style={{ color: '#9F1239' }}>
                Enquanto esta ordem estiver aberta, você não pode fazer registro
                livre nem começar outra missão. Cumpra, grave o check-in e tudo
                destrava na hora.
              </p>
            </div>
          }
        >
          {urgentes.map(missao => (
            <React.Fragment key={missao.id}>
            <CartaoDeMissao
              missao={missao}
              escolhida={missao.id === missaoId}
              nova={novas.includes(missao.id)}
              urgente
              fixa={!varias}
              niveis={niveis}
              janelas={janelas}
              coords={coords}
              semRota={rotaNaDoca}
              onTocar={() => {
                vibrar();
                // Trancado, largar a ordem não é opção: só trocar entre elas.
                onEscolher(missao.id);
              }}
            />
            </React.Fragment>
          ))}
        </PainelDaOrdem>

        {outras.length > 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-3.5 py-3 flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <p className="flex-1 text-[11.5px] font-bold text-slate-400 leading-snug">
              {outras.length === 1
                ? 'Outra missão espera a sua vez. Ela volta'
                : `${outras.length} outras missões esperam a sua vez. Elas voltam`}{' '}
              assim que a ordem urgente for gravada.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------- modo normal
  const visiveis = missaoEscolhida
    ? [missaoEscolhida]
    : verTodas
      ? missoes
      : missoes.slice(0, 3);

  /** Quantas missões são para a hora de agora. */
  const quantasAgora = missoes.filter(m => m.turno && m.turno === turnoAgora).length;

  const so = missoes.length === 1;

  return (
    <div className="space-y-2">
      <PainelDaOrdem
        cor={AZUL}
        icone={so ? <ClipboardList className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
        titulo={
          missaoEscolhida
            ? 'Missão escolhida'
            : so
              ? 'Sua missão'
              : contar(missoes.length, 'missão', 'missões')
        }
        contador={
          !missaoEscolhida && quantasAgora > 0 && turnoAgora
            ? `${quantasAgora} para ${NOME_DO_TURNO[turnoAgora].toLowerCase()}`
            : undefined
        }
        recado={recado}
        rodape={
          <div className="px-3.5 pb-3 -mt-1 space-y-2">
            {/* A lista longa fica cortada: as três do topo são as que importam */}
            {!missaoEscolhida && !verTodas && missoes.length > 3 && (
              <button
                type="button"
                onClick={() => setVerTodas(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-[12px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Ver as outras {missoes.length - 3}
              </button>
            )}

            {missaoEscolhida ? (
              <button
                type="button"
                onClick={() => onEscolher(null)}
                className="ml-auto block px-2 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400 cursor-pointer"
              >
                Trocar de missão
              </button>
            ) : (
              <p className="text-[11px] text-slate-400 font-semibold leading-snug">
                {so
                  ? 'Toque na missão para assumi-la. Se você está fazendo outra coisa, siga sem escolher — entra como registro livre.'
                  : 'Toque na missão que você está fazendo. Se for outra coisa, siga sem escolher — entra como registro livre.'}
              </p>
            )}
          </div>
        }
      >
        {visiveis.map(missao => (
          <React.Fragment key={missao.id}>
          <CartaoDeMissao
            missao={missao}
            escolhida={missao.id === missaoId}
            nova={novas.includes(missao.id)}
            urgente={idsUrgentes.includes(missao.id)}
            fixa={false}
            /*
             * Missão de rotina também abre o briefing: distância, tempo a pé,
             * janela, rota e material. Era esse o conteúdo que separava a
             * ordem urgente das outras, e não havia razão para separar.
             */
            aberto
            niveis={niveis}
            janelas={janelas}
            coords={coords}
            semRota={rotaNaDoca}
            onTocar={() => {
              vibrar();
              onEscolher(missao.id === missaoId ? null : missao.id);
            }}
          />
          </React.Fragment>
        ))}
      </PainelDaOrdem>

    </div>
  );
}
