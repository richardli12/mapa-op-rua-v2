import { buildOperationIconSvg } from '../operationIcons';

interface OperationIconProps {
  /** Chave do ícone do tipo de operação. */
  icon?: string;
  /** Classe aplicada ao contêiner; use-a para definir tamanho e cor. */
  className?: string;
  /** Tamanho do SVG em pixels. */
  size?: number;
}

/**
 * Desenha um ícone de Tipo de Operação dentro do React.
 *
 * O SVG vem da mesma lista usada pelo marcador do Leaflet (operationIcons.ts),
 * que é conteúdo estático nosso — nada digitado pelo usuário chega aqui.
 */
export default function OperationIcon({
  icon,
  className = '',
  size = 16
}: OperationIconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: buildOperationIconSvg(icon, size) }}
    />
  );
}
