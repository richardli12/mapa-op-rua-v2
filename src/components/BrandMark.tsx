import { useState } from 'react';
import { BRAND_LOGO } from '../mediaUrls';

/**
 * Marca do Mapa Operacional.
 *
 * Aparece no topo do painel, nas telas de acesso e ao lado de cada mensagem do
 * check-in. O quadrado de fundo continua aqui para a logo não ficar solta nem
 * sobre fundo claro nem sobre fundo escuro.
 *
 * A logo vem de um endereço na internet, e endereço pode falhar — conexão
 * ruim, arquivo movido. Nesse caso o pino desenhado aqui entra no lugar, para
 * a marca nunca sumir da tela.
 */
export default function BrandMark({
  size = 32,
  rounded = 8,
  variant = 'padrao'
}: {
  size?: number;
  /** Raio dos cantos do quadrado. */
  rounded?: number;
  /** 'clara' desenha o quadrado branco, para uso sobre fundo claro. */
  variant?: 'padrao' | 'clara';
}) {
  const [falhou, setFalhou] = useState(false);
  const clara = variant === 'clara';

  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        backgroundColor: clara ? '#ffffff' : '#0C3556'
      }}
      aria-label="Mapa Operacional"
    >
      {falhou ? (
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2.5c-4.1 0-7.5 3.3-7.5 7.4 0 5.4 6.6 11.6 6.9 11.9a.9.9 0 0 0 1.2 0c.3-.3 6.9-6.5 6.9-11.9 0-4.1-3.4-7.4-7.5-7.4Z"
            fill={clara ? '#0C3556' : '#ffffff'}
          />
          <circle cx="12" cy="9.9" r="2.9" fill={clara ? '#F58220' : '#0C3556'} />
        </svg>
      ) : (
        <img
          src={BRAND_LOGO}
          alt=""
          className="w-full h-full object-contain"
          style={{ padding: Math.round(size * 0.1) }}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFalhou(true)}
        />
      )}
    </span>
  );
}
