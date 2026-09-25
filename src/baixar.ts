/**
 * Baixar de verdade.
 *
 * `<a href download>` parece resolver, mas o navegador ignora o `download`
 * quando o arquivo mora em outro domínio — e as fotos, vídeos e documentos
 * moram no armazenamento, que é outro domínio. Resultado: o clique em
 * "Baixar" abria o arquivo, e às vezes numa aba nova, tirando a pessoa de
 * dentro do sistema.
 *
 * Aqui o arquivo é trazido como dado (blob), com o progresso contado, e só
 * então entregue ao navegador como download local — que ele sempre respeita.
 *
 * Se o armazenamento não deixar ler o arquivo daqui (CORS), vem o plano B: o
 * armazenamento aceita `?download=<nome>` e responde "salve isto" — o
 * download acontece e a tela não sai do lugar.
 */

export type ProgressoDoDownload = (fracao: number | null) => void;

/** Nome de arquivo sem os caracteres que os sistemas de arquivo recusam. */
export const nomeSeguro = (nome: string) =>
  (nome || 'arquivo').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'arquivo';

/** Completa a extensão pelo tipo do arquivo quando o nome veio sem. */
const comExtensao = (nome: string, tipo: string, url: string) => {
  if (/\.[a-z0-9]{2,5}$/i.test(nome)) return nome;
  const daUrl = url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const doTipo: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'application/pdf': 'pdf'
  };
  const ext = daUrl || doTipo[tipo.split(';')[0]];
  return ext ? `${nome}.${ext}` : nome;
};

const entregar = (blob: Blob, nome: string) => {
  const endereco = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = endereco;
  a.download = nome;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Tempo de sobra para o navegador copiar o arquivo antes de soltar a memória.
  window.setTimeout(() => URL.revokeObjectURL(endereco), 60000);
};

/**
 * Plano B, para quando o arquivo não pode ser lido daqui.
 *
 * O armazenamento de arquivos entende `?download=<nome>` e responde "salve
 * isto" em vez de mostrar: o navegador baixa e a página fica onde está. Um
 * iframe escondido seria mais discreto, mas o Chrome bloqueia download
 * iniciado dentro de iframe de outro domínio — o pedido tem de sair da
 * própria página.
 *
 * Endereço que não é do armazenamento não sabe o que é `?download`, e
 * pedi-lo aqui trocaria a página pelo arquivo: esse abre numa aba à parte,
 * e o sistema continua aberto na de origem.
 */
const pedirAoArmazenamento = (url: string, nome: string) => {
  const destino = new URL(url, window.location.href);
  const a = document.createElement('a');
  a.rel = 'noopener';
  a.style.display = 'none';
  if (/\/storage\/v1\/object\//.test(destino.pathname)) {
    destino.searchParams.set('download', nome);
    a.href = destino.toString();
  } else {
    a.href = destino.toString();
    a.target = '_blank';
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/**
 * Baixa o arquivo sem sair da tela.
 *
 * `aoProgredir` recebe de 0 a 1 enquanto o arquivo chega — ou `null` quando
 * o servidor não diz o tamanho, e a barra só pode dizer "está vindo".
 */
export async function baixarArquivo(
  url: string,
  nome: string,
  aoProgredir?: ProgressoDoDownload
): Promise<'baixado' | 'pelo-armazenamento'> {
  const base = nomeSeguro(nome);
  try {
    const resposta = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const tipo = resposta.headers.get('content-type') || '';
    const total = Number(resposta.headers.get('content-length')) || 0;

    let blob: Blob;
    if (resposta.body && aoProgredir) {
      const leitor = resposta.body.getReader();
      const pedacos: Uint8Array[] = [];
      let recebido = 0;
      aoProgredir(total ? 0 : null);
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        if (value) {
          pedacos.push(value);
          recebido += value.length;
          aoProgredir(total ? Math.min(1, recebido / total) : null);
        }
      }
      blob = new Blob(pedacos as BlobPart[], { type: tipo });
    } else {
      blob = await resposta.blob();
    }
    aoProgredir?.(1);
    entregar(blob, comExtensao(base, blob.type || tipo, url));
    return 'baixado';
  } catch {
    pedirAoArmazenamento(url, comExtensao(base, '', url));
    aoProgredir?.(1);
    return 'pelo-armazenamento';
  }
}
