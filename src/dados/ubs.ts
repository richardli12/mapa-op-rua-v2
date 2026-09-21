/**
 * O formato de uma Unidade Básica de Saúde na camada do mapa.
 *
 * Só o tipo mora aqui: a lista vem da tabela `ubs` do banco (ver
 * `db/migrations/2026-09-21-ubs.sql`, que cria a tabela e carrega as unidades
 * de Parauapebas). Ela estava cravada neste arquivo e saiu: endereço, telefone
 * e responsável mudam sem aviso, e dado que muda não pode depender de um
 * deploy para ser corrigido.
 *
 * SOBRE AS COORDENADAS. A planilha de origem traz latitude e longitude sem uma
 * casa decimal ("-59.802, -499.234" no lugar de "-5.9802, -49.9234").
 * Longitude abaixo de -180 não existe no planeta: é erro de formato, não de
 * medição. A migração já grava os valores corrigidos; planilha nova precisa da
 * mesma conferência antes de virar INSERT.
 */
export interface UnidadeDeSaude {
  id: string;
  nome: string;
  endereco: string | null;
  celular: string | null;
  email: string | null;
  responsaveis: { nome: string | null; celular: string | null }[];
  /** `null` é unidade sem coordenada: ela existe, mas não vira pino. */
  lat: number | null;
  lng: number | null;
}
