/**
 * Utilitários de Semana Epidemiológica (SE no formato AAAASS) e datas.
 * Fonte única — antes duplicado em dashboard.ts e serie.ts.
 */

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Data de início (domingo) da semana epidemiológica AAAASS, em UTC. */
export function seParaData(se: number | null | undefined): Date | null {
  if (!se) return null;
  const ano = Math.floor(se / 100);
  const sem = se % 100;
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const inicioSem1 = new Date(jan4);
  inicioSem1.setUTCDate(jan4.getUTCDate() - jan4.getUTCDay());
  const inicio = new Date(inicioSem1);
  inicio.setUTCDate(inicioSem1.getUTCDate() + (sem - 1) * 7);
  return inicio;
}

/** Ano de uma SE AAAASS. */
export function anoDaSe(se: number | null | undefined): number | null {
  return se ? Math.floor(se / 100) : null;
}

/** Número da semana (1–53) de uma SE AAAASS. */
export function semanaDaSe(se: number | null | undefined): number | null {
  return se ? se % 100 : null;
}

/** "SE 23/2026" */
export function formatarSE(se: number | null | undefined): string {
  if (!se) return '—';
  return `SE ${String(se).slice(4)}/${String(se).slice(0, 4)}`;
}

/** "SE 23 · 2026" — variante usada no badge do dashboard. */
export function formatarSEBadge(se: number | null | undefined): string {
  if (!se) return '—';
  return `SE ${String(se).slice(4)} · ${String(se).slice(0, 4)}`;
}

/** "12 jun 2026" a partir da SE. */
export function dataDaSeFormatada(se: number | null | undefined): string {
  const d = seParaData(se);
  if (!d) return '—';
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Timestamp UTC ao meio-dia a partir de "AAAA-MM-DD" (evita erros de fuso). */
export function tsFromIso(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 12, 0, 0);
}

/** "12 jun 2026" a partir de um timestamp. */
export function fmtPtBr(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
