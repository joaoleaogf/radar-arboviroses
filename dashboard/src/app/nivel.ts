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
  0: '#4b5e77',
  1: '#10b981',
  2: '#f59e0b',
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

/** Descrição acionável de cada nível (metodologia InfoDengue). */
export const NIVEL_DESCRICAO: Record<number, string> = {
  0: 'Sem dados disponíveis para o período.',
  1: 'Transmissão baixa. Situação de controle.',
  2: 'Atenção: condições favoráveis à transmissão (clima e/ou incidência).',
  3: 'Alerta: transmissão sustentada (Rt acima de 1 por semanas consecutivas).',
  4: 'Risco de epidemia: incidência alta e transmissão acelerada.',
};

export function corDoNivel(nivel: number | null | undefined): string {
  return NIVEL_HEX[nivel ?? 0] ?? NIVEL_HEX[0];
}

export type TendenciaRt = 'crescimento' | 'estavel' | 'queda' | 'indefinido';

/**
 * Interpreta o número reprodutivo efetivo (Rt) em tendência de transmissão.
 * Rt > 1 ⇒ casos crescendo; Rt ≈ 1 ⇒ estável; Rt < 1 ⇒ casos diminuindo.
 */
export function interpretarRt(rt: number | null | undefined): TendenciaRt {
  if (rt == null) return 'indefinido';
  if (rt > 1.1) return 'crescimento';
  if (rt < 0.9) return 'queda';
  return 'estavel';
}

export const RT_LABEL: Record<TendenciaRt, string> = {
  crescimento: 'Transmissão em crescimento',
  estavel: 'Transmissão estável',
  queda: 'Transmissão em queda',
  indefinido: 'Transmissão indefinida',
};
