import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image as ImagemIcone,
  Loader2,
  Mic,
  Paperclip,
  Play,
  Square,
  Trash2,
  Video,
  X
} from 'lucide-react';
import { DatabaseService } from '../databaseClient';
import { MaterialDeApoio } from '../types';

/**
 * Material de apoio da missão: o que o comitê manda junto com a ordem.
 *
 * Existe porque missão sem material é adivinhação. "Panfletar no Centro" com
 * a arte do panfleto anexada, a planilha das ruas e um áudio de trinta
 * segundos do coordenador explicando o combinado é outra missão — quem está
 * na rua abre e sabe o que fazer, sem ligar para ninguém.
 *
 * Duas peças moram aqui, de propósito: o que o painel usa para subir e o que
 * o check-in usa para mostrar. Elas precisam concordar sobre o formato de
 * cada arquivo, e separá-las em dois arquivos só faria a conta divergir.
 */

/** Item enquanto está na tela do painel: já subiu, está subindo ou falhou. */
export interface ItemMaterial extends MaterialDeApoio {
  estado: 'enviando' | 'pronto' | 'erro';
  progresso: number;
  erro?: string;
  /** Prévia local, para a imagem aparecer antes de o envio terminar. */
  previa?: string;
  /**
   * Já pertence a uma missão gravada.
   *
   * Muda quem pode apagar o arquivo: o que subiu agora e não virou missão é
   * lixo e sai do Storage; o que já é de uma missão salva fica, mesmo que o
   * formulário seja cancelado — apagar deixaria a missão com link quebrado.
   */
  jaSalvo?: boolean;
}

/**
 * Teto do arquivo.
 *
 * Não é limite do servidor: é de quem vai abrir. Um vídeo de 200 MB no 3G do
 * bairro não é material de apoio, é uma barra de progresso que nunca acaba.
 */
const TETO_MB = 25;

const novoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'm_' + Math.random().toString(36).slice(2, 11);

/** Classifica pelo que o navegador informou, com o nome como segunda opinião. */
export const tipoDoArquivo = (file: File): MaterialDeApoio['tipo'] => {
  const t = file.type || '';
  if (t.startsWith('image/')) return 'imagem';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'documento';
};

const tamanhoCurto = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

const relogio = (segundos?: number) => {
  if (!segundos && segundos !== 0) return '';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const IconeDoTipo = ({ tipo, className }: { tipo: MaterialDeApoio['tipo']; className?: string }) =>
  tipo === 'imagem' ? (
    <ImagemIcone className={className} />
  ) : tipo === 'video' ? (
    <Video className={className} />
  ) : tipo === 'audio' ? (
    <Mic className={className} />
  ) : (
    <FileText className={className} />
  );

// ---------------------------------------------------------------- painel

interface EditorProps {
  itens: ItemMaterial[];
  onMudar: (itens: ItemMaterial[]) => void;
  notificar: (texto: string, tipo?: 'success' | 'error' | 'info') => void;
  /** Sem banco não há Storage: o botão some em vez de prometer o que não faz. */
  ligado: boolean;
}

/** O bloco que o painel mostra dentro do formulário da missão. */
export function EditorDeMaterial({ itens, onMudar, notificar, ligado }: EditorProps) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);

  const arquivoRef = useRef<HTMLInputElement>(null);
  const documentoRef = useRef<HTMLInputElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const relogioRef = useRef<number | null>(null);
  const inicioRef = useRef(0);
  /**
   * Espelho da lista, para o envio assíncrono não ler estado velho.
   *
   * O espelho avança na hora em que a lista muda, não só no render seguinte:
   * a barra de progresso volta dentro da mesma chamada do envio, antes de o
   * React redesenhar, e ler a lista do render anterior fazia o arquivo
   * recém-anexado desaparecer da tela.
   */
  const itensRef = useRef<ItemMaterial[]>(itens);
  itensRef.current = itens;

  const aplicar = (proximos: ItemMaterial[]) => {
    itensRef.current = proximos;
    onMudar(proximos);
  };

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

  const trocar = (id: string, mudanca: Partial<ItemMaterial>) =>
    aplicar(itensRef.current.map(i => (i.id === id ? { ...i, ...mudanca } : i)));

  /** Sobe um arquivo e o deixa na lista, com a barra andando enquanto vai. */
  const enviar = async (
    file: File,
    tipo: MaterialDeApoio['tipo'],
    duracao?: number,
    nomeVisivel?: string
  ) => {
    if (file.size > TETO_MB * 1024 * 1024) {
      notificar(
        `"${file.name}" tem ${tamanhoCurto(file.size)}. O limite é ${TETO_MB} MB — acima disso, quem está na rua não consegue abrir.`,
        'error'
      );
      return;
    }

    const id = novoId();
    const previa = tipo === 'imagem' || tipo === 'video' ? URL.createObjectURL(file) : undefined;
    const item: ItemMaterial = {
      id,
      tipo,
      url: '',
      // O gravador batiza o arquivo com um carimbo de tempo; quem lê na rua
      // merece um nome, não um número.
      nome: nomeVisivel || file.name || 'Arquivo',
      tamanho: file.size,
      duracao,
      previa,
      progresso: 0,
      estado: 'enviando'
    };
    aplicar([...itensRef.current, item]);

    const res = await DatabaseService.uploadArquivoMissao(file, pct =>
      trocar(id, { progresso: pct })
    );

    if (!res.success || !res.url) {
      trocar(id, { estado: 'erro', erro: res.error });
      notificar(res.error || 'Não foi possível subir o arquivo.', 'error');
      return;
    }
    trocar(id, {
      estado: 'pronto',
      progresso: 100,
      url: res.url,
      storagePath: res.path || undefined
    });
  };

  const escolher = (lista: FileList | null, forcarDocumento = false) => {
    if (!lista) return;
    Array.from(lista).forEach(file =>
      enviar(file, forcarDocumento ? 'documento' : tipoDoArquivo(file))
    );
  };

  const remover = (id: string) => {
    const alvo = itensRef.current.find(i => i.id === id);
    aplicar(itensRef.current.filter(i => i.id !== id));
    if (alvo?.previa) URL.revokeObjectURL(alvo.previa);
    // Tirou da lista, tira do Storage -- menos o que já é de uma missão
    // gravada: enquanto o formulário não for salvo, ela ainda aponta para lá.
    if (alvo?.storagePath && !alvo.jaSalvo) {
      DatabaseService.removerArquivosStorage([alvo.storagePath]);
    }
  };

  const gravar = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      notificar('Este aparelho não permite gravar áudio.', 'error');
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
        const blob = new Blob(pedacosRef.current, { type: gravador.mimeType || 'audio/webm' });
        setGravando(false);
        setSegundos(0);
        if (blob.size > 0) {
          const arquivo = new File([blob], `recado-${Date.now()}.webm`, { type: blob.type });
          enviar(arquivo, 'audio', duracao, 'Recado gravado');
        }
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
      notificar('Permita o acesso ao microfone para gravar o recado.', 'error');
    }
  };

  const prontos = itens.filter(i => i.estado === 'pronto').length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">
          Material de apoio{' '}
          <span className="normal-case tracking-normal font-semibold text-slate-300">
            (opcional)
          </span>
        </label>
        {prontos > 0 && (
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
            {prontos} {prontos === 1 ? 'arquivo' : 'arquivos'}
          </span>
        )}
      </div>

      {!ligado ? (
        <p className="text-xs text-slate-400 leading-snug">
          O envio de arquivos precisa do banco configurado neste ambiente.
        </p>
      ) : gravando ? (
        <button
          type="button"
          onClick={() => gravadorRef.current?.stop()}
          className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-rose-50 border border-rose-200 cursor-pointer transition-all active:scale-[0.99]"
        >
          <span className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center shrink-0 animate-pulse">
            <Square className="w-3 h-3 text-white fill-white" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[12px] font-black text-rose-700 leading-tight">
              Gravando o recado… {relogio(segundos)}
            </span>
            <span className="block text-[10.5px] font-semibold text-rose-500">
              Toque para parar e anexar
            </span>
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => arquivoRef.current?.click()}
            className="flex flex-col items-center gap-1 px-2 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/40 transition-all cursor-pointer"
          >
            <ImagemIcone className="w-4 h-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Foto/vídeo
            </span>
          </button>
          <button
            type="button"
            onClick={() => documentoRef.current?.click()}
            className="flex flex-col items-center gap-1 px-2 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/40 transition-all cursor-pointer"
          >
            <Paperclip className="w-4 h-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Documento
            </span>
          </button>
          <button
            type="button"
            onClick={gravar}
            className="flex flex-col items-center gap-1 px-2 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-rose-400 hover:bg-rose-50/40 transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4 text-rose-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Gravar áudio
            </span>
          </button>
        </div>
      )}

      <input
        ref={arquivoRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={e => {
          escolher(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={documentoRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,application/pdf"
        multiple
        className="hidden"
        onChange={e => {
          escolher(e.target.files, true);
          e.target.value = '';
        }}
      />

      {itens.length > 0 && (
        <ul className="space-y-1.5">
          {itens.map(item => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 px-2.5 py-2 bg-white border border-slate-200 rounded-xl"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                {item.tipo === 'imagem' && (item.previa || item.url) ? (
                  <img
                    src={item.previa || item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <IconeDoTipo tipo={item.tipo} className="w-3.5 h-3.5 text-slate-400" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-bold text-slate-700 truncate">
                  {item.nome}
                </span>
                <span className="block text-[10px] font-semibold text-slate-400">
                  {item.estado === 'enviando'
                    ? `Enviando… ${item.progresso}%`
                    : item.estado === 'erro'
                      ? item.erro || 'Falhou no envio'
                      : [
                          item.tipo === 'audio' ? relogio(item.duracao) : '',
                          tamanhoCurto(item.tamanho)
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                </span>
              </span>
              {item.estado === 'enviando' && (
                <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" />
              )}
              <button
                type="button"
                onClick={() => remover(item.id)}
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                title="Tirar da missão"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ligado && itens.length === 0 && (
        <p className="text-[11px] text-slate-400 leading-snug">
          Arte do panfleto, lista de ruas, um recado gravado — vai junto na
          conversa do check-in de quem receber a missão.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ campo

/** PDF o próprio navegador abre embutido; o resto do Office, não. */
const ePdf = (item: MaterialDeApoio) =>
  /\.pdf($|[?#])/i.test(item.url) || /\.pdf$/i.test(item.nome || '');

/**
 * O material aberto sem sair do sistema.
 *
 * Abrir em outra aba tirava quem está na rua de dentro do check-in no meio
 * do preenchimento -- em celular, voltar nem sempre devolve o formulário do
 * jeito que estava. Aqui a imagem, o vídeo, o áudio e o PDF abrem por cima
 * da própria conversa, e fechar devolve exatamente a tela de antes.
 *
 * Serve ao check-in e à ficha da missão no mapa: é um visor só, para o
 * arquivo abrir do mesmo jeito em qualquer lugar do sistema.
 */
export function VisorDoMaterial({
  item,
  aoFechar,
  aoAnterior,
  aoProximo,
  posicao
}: {
  item: MaterialDeApoio;
  aoFechar: () => void;
  /**
   * Andar pelo material sem fechar e reabrir.
   *
   * Opcional: onde o material é um arquivo só, como no chip do check-in, as
   * setas não aparecem. Onde é uma pasta — a missão com a arte, a planilha e
   * o recado gravado — fechar a cada arquivo seria trabalho à toa.
   */
  aoAnterior?: () => void;
  aoProximo?: () => void;
  posicao?: { atual: number; total: number };
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      if (e.key === 'ArrowLeft') aoAnterior?.();
      if (e.key === 'ArrowRight') aoProximo?.();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar, aoAnterior, aoProximo]);

  const corpo =
    item.tipo === 'imagem' ? (
      <img
        src={item.url}
        alt={item.nome}
        className="max-w-full max-h-full object-contain"
        onClick={e => e.stopPropagation()}
      />
    ) : item.tipo === 'video' ? (
      <video
        src={item.url}
        controls
        autoPlay
        playsInline
        className="max-w-full max-h-full"
        onClick={e => e.stopPropagation()}
      />
    ) : item.tipo === 'audio' ? (
      <div
        className="w-full max-w-md bg-white rounded-2xl px-4 py-5 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[12px] font-black text-slate-700 text-center">
          {item.nome}
          {item.duracao ? ` · ${relogio(item.duracao)}` : ''}
        </p>
        <audio src={item.url} controls autoPlay className="w-full" />
      </div>
    ) : ePdf(item) ? (
      <iframe
        src={item.url}
        title={item.nome}
        className="w-full h-full bg-white rounded-xl"
        onClick={e => e.stopPropagation()}
      />
    ) : (
      /*
       * Planilha e documento do Office o navegador não desenha. Em vez de
       * jogar a pessoa para fora, o arquivo desce para o aparelho e ela
       * continua exatamente onde estava.
       */
      <div
        className="w-full max-w-sm bg-white rounded-2xl px-5 py-6 text-center space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <FileText className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-[12.5px] font-black text-slate-700 break-words">{item.nome}</p>
        <p className="text-[11px] text-slate-400 leading-snug">
          Este formato não abre aqui dentro. Baixe para ver no aplicativo do
          seu aparelho — a tela continua aberta atrás.
        </p>
        <a
          href={item.url}
          download={item.nome}
          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar arquivo
        </a>
      </div>
    );

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] bg-black/90 flex flex-col p-3 pt-14 font-sans"
      onClick={aoFechar}
    >
      <div className="absolute top-0 inset-x-0 h-12 flex items-center gap-2 px-3">
        <span className="min-w-0 flex-1 text-[11.5px] font-bold text-white/90 truncate">
          {item.nome}
        </span>
        {posicao && posicao.total > 1 && (
          <span className="text-[11px] font-black text-white/70 tabular-nums shrink-0">
            {posicao.atual}/{posicao.total}
          </span>
        )}
        <a
          href={item.url}
          download={item.nome}
          onClick={e => e.stopPropagation()}
          aria-label="Baixar"
          title="Baixar"
          className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0"
        >
          <Download className="w-4 h-4" />
        </a>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">{corpo}</div>

      {aoAnterior && posicao && posicao.total > 1 && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            aoAnterior();
          }}
          aria-label="Arquivo anterior"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {aoProximo && posicao && posicao.total > 1 && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            aoProximo();
          }}
          aria-label="Próximo arquivo"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>,
    document.body
  );
}

/**
 * O material como quem está na rua vê.
 *
 * Nada toca sozinho e nada carrega sem pedido: é o aparelho dela e o pacote
 * de dados dela. Imagem e vídeo viram miniatura, o áudio ganha um tocador
 * parado e o documento é um chip -- e tudo abre dentro do sistema, por cima
 * da conversa do check-in, sem mandar ninguém para outra aba.
 */
export function MaterialDaMissao({ itens }: { itens: MaterialDeApoio[] }) {
  const [aberto, setAberto] = useState<MaterialDeApoio | null>(null);
  const prontos = itens.filter(i => i.url);
  if (prontos.length === 0) return null;

  const visuais = prontos.filter(i => i.tipo === 'imagem' || i.tipo === 'video');
  const audios = prontos.filter(i => i.tipo === 'audio');
  const documentos = prontos.filter(i => i.tipo === 'documento');

  const abrir = (e: React.MouseEvent, item: MaterialDeApoio) => {
    // O cartão da missão escuta o clique: abrir o material não pode
    // escolher ou desmarcar a missão por tabela.
    e.preventDefault();
    e.stopPropagation();
    setAberto(item);
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
      <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
        Material do comitê
      </p>

      {visuais.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visuais.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={e => abrir(e, item)}
              title={item.nome}
              className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 block cursor-pointer"
            >
              {item.tipo === 'imagem' ? (
                <img src={item.url} alt={item.nome} className="w-full h-full object-cover" />
              ) : (
                <video src={item.url} preload="metadata" className="w-full h-full object-cover" />
              )}
              {item.tipo === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Play className="w-4 h-4 text-white fill-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {audios.map(item => (
        <div key={item.id} onClick={e => e.stopPropagation()}>
          <p className="text-[10px] font-bold text-slate-500 mb-1">
            Recado gravado{item.duracao ? ` · ${relogio(item.duracao)}` : ''}
          </p>
          <audio src={item.url} controls preload="none" className="w-full h-8" />
        </div>
      ))}

      {documentos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {documentos.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={e => abrir(e, item)}
              title={item.nome}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 max-w-full cursor-pointer"
            >
              <FileText className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="text-[10.5px] font-bold text-slate-600 truncate max-w-[150px]">
                {item.nome}
              </span>
            </button>
          ))}
        </div>
      )}

      {aberto && <VisorDoMaterial item={aberto} aoFechar={() => setAberto(null)} />}
    </div>
  );
}
