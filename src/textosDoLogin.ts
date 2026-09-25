/**
 * Os textos da tela de login, editáveis em Configurações.
 *
 * A tela de login é a primeira coisa que qualquer pessoa vê do sistema, e o
 * que ela diz é decisão de quem opera — o nome da operação, a frase do mapa,
 * o que o botão promete. Mudar uma palavra ali não deveria exigir deploy.
 *
 * Tudo mora numa chave só de `app_settings`, em JSON. A tabela é lida sem
 * login (é o que permite à tela de entrada ler os próprios textos antes de
 * alguém entrar); quem escreve é a tela de Configurações, que só existe
 * dentro do painel do administrador.
 *
 * REGRA DO CAMPO VAZIO.
 *
 * - Campo OBRIGATÓRIO vazio volta ao texto de fábrica: uma tela de login sem
 *   título ou com um botão em branco é uma tela quebrada, não uma escolha.
 * - Campo OPCIONAL vazio SOME da tela: apagar a frase de apoio é o jeito de
 *   dizer "não quero frase de apoio".
 */

export const CHAVE_TEXTOS_LOGIN = 'login_textos';

/** Onde a tela guarda a última leitura, para abrir já com os textos certos. */
export const CACHE_TEXTOS_LOGIN = 'login_textos_cache';

export interface TextosDoLogin {
  /** Nome pequeno ao lado da logo. */
  marca: string;
  /** O título grande do painel de acesso. Enter quebra a linha. */
  titulo: string;
  rotuloEmail: string;
  exemploEmail: string;
  rotuloSenha: string;
  botaoEntrar: string;
  botaoVerificando: string;
  avisoCapsLock: string;
  /** A frase grande do mapa: a primeira linha, e a segunda em laranja. */
  manchete: string;
  mancheteDestaque: string;
  descricao: string;
  legendaMissoes: string;
  legendaEquipe: string;
  legendaCheckins: string;
  legendaCenso: string;
  rotuloAoVivo: string;
  /** As frases que passam na faixa "ao vivo", uma por item. */
  registro: string[];
}

export const TEXTOS_LOGIN_PADRAO: TextosDoLogin = {
  marca: 'Mapa Operacional',
  titulo: 'Inteligência\nTerritorial',
  rotuloEmail: 'E-mail',
  exemploEmail: 'voce@coordenacao.com',
  rotuloSenha: 'Senha',
  botaoEntrar: 'Entrar na operação',
  botaoVerificando: 'Verificando credenciais',
  avisoCapsLock: 'Caps Lock está ligado',
  manchete: 'Toda a operação,',
  mancheteDestaque: 'num mapa só.',
  descricao:
    'Missões, equipe em campo, check-ins com foto e áudio e o Censo de cada setor — na mesma tela.',
  legendaMissoes: 'Missões',
  legendaEquipe: 'Equipe',
  legendaCheckins: 'Check-ins',
  legendaCenso: 'Censo',
  rotuloAoVivo: 'Ao vivo',
  registro: [
    'Missão despachada para a equipe Delta',
    'Check-in chegou com foto, áudio e localização',
    'Equipe em deslocamento pela avenida',
    'Setor fixado: o Censo inteiro de um quarteirão',
    'Relatório do NEO pronto para a coordenação'
  ]
};

/** Os campos que nunca ficam em branco na tela. */
export const OBRIGATORIOS: (keyof TextosDoLogin)[] = [
  'titulo',
  'rotuloEmail',
  'rotuloSenha',
  'botaoEntrar',
  'botaoVerificando'
];

type CampoDeTexto = Exclude<keyof TextosDoLogin, 'registro'>;

/**
 * Lê o JSON do banco por cima do texto de fábrica.
 *
 * Chave que não veio fica com o padrão — é o que deixa uma frase nova, criada
 * numa versão futura, aparecer sozinha em quem já tinha editado as outras.
 */
export function lerTextosDoLogin(json: string | null | undefined): TextosDoLogin {
  if (!json) return { ...TEXTOS_LOGIN_PADRAO, registro: [...TEXTOS_LOGIN_PADRAO.registro] };
  try {
    const bruto = JSON.parse(json) || {};
    const textos: TextosDoLogin = {
      ...TEXTOS_LOGIN_PADRAO,
      registro: [...TEXTOS_LOGIN_PADRAO.registro]
    };
    (Object.keys(TEXTOS_LOGIN_PADRAO) as (keyof TextosDoLogin)[]).forEach((chave) => {
      if (chave === 'registro') {
        if (Array.isArray(bruto.registro)) {
          textos.registro = bruto.registro
            .filter((l: unknown) => typeof l === 'string')
            .map((l: string) => l.trim())
            .filter(Boolean);
        }
        return;
      }
      if (typeof bruto[chave] === 'string') {
        textos[chave as CampoDeTexto] = bruto[chave];
      }
    });
    return textos;
  } catch {
    return { ...TEXTOS_LOGIN_PADRAO, registro: [...TEXTOS_LOGIN_PADRAO.registro] };
  }
}

/** Grava só o que foi editado de fato, já sem espaços sobrando. */
export function gravarTextosDoLogin(textos: TextosDoLogin): string {
  const limpo: Partial<Record<keyof TextosDoLogin, unknown>> = {};
  (Object.keys(textos) as (keyof TextosDoLogin)[]).forEach((chave) => {
    if (chave === 'registro') {
      limpo.registro = textos.registro.map((l) => l.trim()).filter(Boolean);
    } else {
      limpo[chave] = (textos[chave as CampoDeTexto] || '').trim();
    }
  });
  return JSON.stringify(limpo);
}

/**
 * O texto que vai para a tela, aplicada a regra do campo vazio.
 *
 * Obrigatório em branco volta ao padrão; opcional em branco some (vazio).
 */
export function textoNaTela(textos: TextosDoLogin, chave: CampoDeTexto): string {
  const valor = (textos[chave] || '').trim();
  if (!valor && OBRIGATORIOS.includes(chave)) return TEXTOS_LOGIN_PADRAO[chave];
  return valor;
}

export const iguaisTextosDoLogin = (a: TextosDoLogin, b: TextosDoLogin) =>
  gravarTextosDoLogin(a) === gravarTextosDoLogin(b);
