/** Cores e rótulos dos níveis de alerta do InfoDengue (1–4). */
export const NIVEL_COR: Record<number, string> = {
  0: 'var(--n0)',
  1: 'var(--n1)',
  2: 'var(--n2)',
  3: 'var(--n3)',
  4: 'var(--n4)',
};

/** Versão em hex (para Leaflet/Highcharts, que não leem variáveis CSS). */
export const NIVEL_HEX: Record<number, string> = {
  0: '#475569',
  1: '#22c55e',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
};

export const NIVEL_LABEL: Record<number, string> = {
  0: 'Sem dados',
  1: 'Verde',
  2: 'Amarelo',
  3: 'Laranja',
  4: 'Vermelho',
};

export function corDoNivel(nivel: number | null | undefined): string {
  return NIVEL_HEX[nivel ?? 0] ?? NIVEL_HEX[0];
}
