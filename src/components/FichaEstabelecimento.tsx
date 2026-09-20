import {
  X,
  Store,
  Star,
  Phone,
  Globe,
  MapPin,
  Clock,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Navigation
} from 'lucide-react';
import { useState } from 'react';
import { Estabelecimento } from '../services/estabelecimentos';

interface FichaEstabelecimentoProps {
  lugar: Estabelecimento | null;
  onFechar: () => void;
  /** Vira um ponto estratégico do cliente, já com nome e endereço. */
  onVirarPonto?: (lugar: Estabelecimento) => void;
}

/** Ordem da semana como se lê num cartaz de porta, não a do JSON. */
const DIAS = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo'
];

/** Só os dígitos, no formato que o WhatsApp e o discador esperam. */
const sóNumeros = (texto: string) => texto.replace(/\D/g, '');

/**
 * Ficha do estabelecimento.
 *
 * O pino no mapa responde "tem alguma coisa aqui"; esta ficha responde tudo o
 * que a pesquisa sabe do lugar — endereço, contato, avaliação, faixa de preço,
 * se está aberto e o horário de cada dia.
 *
 * E responde o que vem depois, que é o que interessa a quem está operando:
 * ligar, abrir no WhatsApp, traçar rota, copiar o endereço para um relatório
 * ou transformar o lugar num ponto estratégico do cliente — com nome e
 * endereço já preenchidos, sem redigitar nada.
 */
export default function FichaEstabelecimento({
  lugar,
  onFechar,
  onVirarPonto
}: FichaEstabelecimentoProps) {
  const [copiado, setCopiado] = useState(false);

  if (!lugar) return null;

  const aberto = lugar.situacao ? /aberto/i.test(lugar.situacao) : null;
  const horarios = lugar.horarios || null;
  const diasConhecidos = horarios
    ? [
        ...DIAS.filter((d) => horarios[d] !== undefined),
        ...Object.keys(horarios).filter((d) => !DIAS.includes(d))
      ]
    : [];

  const copiarEndereco = async () => {
    const texto = [lugar.nome, lugar.endereco].filter(Boolean).join(' — ');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão da área de transferência: o botão só não confirma.
    }
  };

  const telefoneLimpo = lugar.telefone ? sóNumeros(lugar.telefone) : '';

  return (
    <div
      className="fixed inset-0 z-[2500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
      >
        {/* CAPA */}
        <div className="relative shrink-0">
          {lugar.imagem ? (
            <img
              src={lugar.imagem}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-36 object-cover"
            />
          ) : (
            <div className="w-full h-24 bg-gradient-to-br from-violet-600 to-indigo-700" />
          )}

          <button
            type="button"
            onClick={onFechar}
            title="Fechar"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>

          {lugar.situacao && (
            <span
              className={`absolute bottom-3 left-4 px-2.5 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider text-white ${
                aberto ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {lugar.situacao}
            </span>
          )}
        </div>

        {/* CORPO */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-black text-[#0D233A] leading-tight">
                  {lugar.nome}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {lugar.avaliacao !== null && (
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-black text-amber-600">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      {lugar.avaliacao.toFixed(1)}
                      {lugar.totalAvaliacoes !== null && (
                        <span className="text-slate-400 font-semibold">
                          ({lugar.totalAvaliacoes} avaliações)
                        </span>
                      )}
                    </span>
                  )}
                  {lugar.faixaDePreco && (
                    <span className="text-[11.5px] font-black text-slate-500">
                      {lugar.faixaDePreco}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CATEGORIAS */}
            {lugar.categorias.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {lugar.categorias.map((categoria) => (
                  <span
                    key={categoria}
                    className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-[10.5px] font-black"
                  >
                    {categoria}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ENDEREÇO E CONTATOS */}
          <div className="px-5 pb-1 space-y-2.5">
            {lugar.endereco && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[12.5px] font-semibold text-slate-600 leading-snug flex-1">
                  {lugar.endereco}
                </p>
                <button
                  type="button"
                  onClick={copiarEndereco}
                  title="Copiar nome e endereço"
                  className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-[#015FC9] hover:border-[#015FC9] flex items-center justify-center cursor-pointer transition-all shrink-0"
                >
                  {copiado ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {lugar.telefone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <a
                  href={`tel:${telefoneLimpo}`}
                  className="text-[12.5px] font-bold text-slate-700 hover:text-[#015FC9] flex-1"
                >
                  {lugar.telefone}
                </a>
                <a
                  href={`https://wa.me/55${telefoneLimpo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir no WhatsApp"
                  className="h-7 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10.5px] font-black flex items-center gap-1 cursor-pointer hover:bg-emerald-100 transition-all shrink-0"
                >
                  <MessageCircle className="w-3 h-3" />
                  WhatsApp
                </a>
              </div>
            )}

            {lugar.site && (
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <a
                  href={lugar.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] font-bold text-[#015FC9] hover:underline truncate flex-1"
                >
                  {lugar.site.replace(/^https?:\/\//, '')}
                </a>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <Navigation className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-[11.5px] font-semibold text-slate-400 flex-1">
                {lugar.latitude.toFixed(6)}, {lugar.longitude.toFixed(6)}
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${lugar.latitude},${lugar.longitude}${
                  lugar.placeId ? `&query_place_id=${lugar.placeId}` : ''
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-[#015FC9] hover:border-[#015FC9] text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-all shrink-0"
              >
                Traçar rota
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* HORÁRIOS */}
          {diasConhecidos.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5" />
                Horário de funcionamento
              </h4>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                {diasConhecidos.map((dia, i) => {
                  const fechado = /fechado/i.test(horarios![dia] || '');
                  return (
                    <div
                      key={dia}
                      className={`flex items-center justify-between gap-3 px-3 py-1.5 ${
                        i % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      <span className="text-[11.5px] font-bold text-slate-600 capitalize">
                        {dia}
                      </span>
                      <span
                        className={`text-[11.5px] font-semibold ${
                          fechado ? 'text-rose-500' : 'text-slate-500'
                        }`}
                      >
                        {horarios![dia]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* O que a pesquisa não sabe, ninguém inventa. */}
          {!lugar.endereco && !lugar.telefone && !lugar.site && (
            <p className="px-5 py-4 text-[11.5px] font-semibold text-slate-400 leading-snug">
              A pesquisa não trouxe endereço, telefone nem site deste lugar —
              é o que a fonte publica sobre ele.
            </p>
          )}
        </div>

        {/* AÇÃO PRINCIPAL */}
        {onVirarPonto && (
          <div className="px-5 py-3.5 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={() => onVirarPonto(lugar)}
              className="w-full h-11 bg-[#015FC9] hover:bg-[#0150ab] text-white text-[11.5px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Virar ponto estratégico
            </button>
            <p className="text-[10.5px] text-slate-400 font-semibold text-center mt-1.5">
              O ponto nasce aqui, com o nome e o endereço já preenchidos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
