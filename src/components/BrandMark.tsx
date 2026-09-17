/**
 * Logo quadrada do Mapa Operacional.
 *
 * Desenhada aqui em SVG, e nao carregada de um endereco, para aparecer na hora
 * em qualquer lugar do app - inclusive dentro de cada mensagem do fio, onde uma
 * imagem remota piscaria a cada carga.
 */
export default function BrandMark({
  size = 32,
  rounded = 8
}: {
  size?: number;
  /** Raio dos cantos do quadrado. */
  rounded?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Mapa Operacional"
    >
      <rect width="48" height="48" rx={rounded} fill="#0C3556" />
      {/* malha do mapa */}
      <path
        d="M6 14.5 17.5 10l13 4.5L42 10v23.5L30.5 38l-13-4.5L6 38V14.5Z"
        fill="#ffffff"
        fillOpacity="0.12"
      />
      <path
        d="M17.5 10v23.5M30.5 14.5V38"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* pino */}
      <path
        d="M24 13c-4.1 0-7.5 3.3-7.5 7.4 0 5.4 6.6 12.1 6.9 12.4a.9.9 0 0 0 1.2 0c.3-.3 6.9-7 6.9-12.4 0-4.1-3.4-7.4-7.5-7.4Z"
        fill="#ffffff"
      />
      <circle cx="24" cy="20.4" r="2.9" fill="#0C3556" />
    </svg>
  );
}
