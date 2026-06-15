/**
 * Constantes geográficas compartilhadas (regiões, UFs, nomes).
 * Fonte única de verdade — evita duplicação entre dashboard, relatórios e análise.
 */

export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'] as const;

export type Regiao = (typeof REGIOES)[number];

export const UFS_POR_REGIAO: Record<string, string[]> = {
  'Norte':        ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste':     ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
  'Sudeste':      ['ES', 'MG', 'RJ', 'SP'],
  'Sul':          ['PR', 'RS', 'SC'],
};

export const UF_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

/** UFs da região informada (vazio se nenhuma). */
export function ufsDaRegiao(regiao: string | null | undefined): string[] {
  return regiao ? (UFS_POR_REGIAO[regiao] ?? []) : [];
}
