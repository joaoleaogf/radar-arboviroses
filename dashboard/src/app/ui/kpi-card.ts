import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InfoTooltip } from './info-tooltip';

/**
 * Cartão de KPI com valor, ícone (projetado), variação semanal (Δ%) opcional,
 * sparkline SVG opcional e tooltip explicativo. Substitui os cards inline do
 * dashboard e padroniza a apresentação de indicadores.
 */
@Component({
  selector: 'app-kpi-card',
  imports: [InfoTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="kpi" [class.destaque]="destaque()">
      <header>
        <span class="ico" aria-hidden="true"><ng-content select="[icon]"></ng-content></span>
        <span class="rotulo">{{ rotulo() }}</span>
        @if (info()) { <app-info-tooltip [texto]="info()!" /> }
      </header>

      <div class="corpo">
        <div class="valor" [attr.aria-label]="rotulo() + ': ' + valor()">
          {{ valor() }}@if (unidade()) {<span class="unidade">{{ unidade() }}</span>}
        </div>
        @if (sparkPath()) {
          <svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
            <path [attr.d]="sparkPath()" fill="none" [attr.stroke]="sparkCor()" stroke-width="2"
                  vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
        }
      </div>

      @if (delta() !== null) {
        <footer class="delta" [class]="deltaClasse()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @if (deltaSubindo()) { <polyline points="6 15 12 9 18 15"/> }
            @else { <polyline points="6 9 12 15 18 9"/> }
          </svg>
          {{ deltaTexto() }}
          <span class="delta-ctx">vs. semana anterior</span>
        </footer>
      }
    </article>
  `,
  styles: [`
    :host { display: block; }
    .kpi {
      display: flex; flex-direction: column; gap: 10px; height: 100%;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px 18px; min-height: 112px;
    }
    .kpi.destaque { border-color: var(--n3); background: linear-gradient(180deg, var(--n3-dim), var(--surface)); }
    header { display: flex; align-items: center; gap: 7px; color: var(--muted); }
    .ico { display: inline-flex; color: var(--brand); }
    .kpi.destaque .ico { color: var(--n3); }
    .rotulo { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.01em; }
    .corpo { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex: 1; }
    .valor { font-size: 1.7rem; font-weight: 800; color: var(--text); line-height: 1;
      font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .unidade { font-size: 0.85rem; font-weight: 600; color: var(--muted); margin-left: 4px; }
    .spark { width: 84px; height: 26px; flex-shrink: 0; opacity: 0.85; }
    .delta { display: flex; align-items: center; gap: 4px; font-size: 0.74rem; font-weight: 700;
      font-variant-numeric: tabular-nums; }
    .delta-ctx { color: var(--muted-2); font-weight: 500; margin-left: 2px; }
    .delta.subiu-ruim { color: var(--n4); }
    .delta.subiu-bom  { color: var(--n1); }
    .delta.neutro     { color: var(--muted); }
  `],
})
export class KpiCard {
  readonly rotulo = input.required<string>();
  readonly valor = input.required<string>();
  readonly unidade = input<string | null>(null);
  readonly info = input<string | null>(null);
  readonly destaque = input<boolean>(false);

  /** Variação percentual vs. semana anterior (null = oculta). */
  readonly delta = input<number | null>(null);
  /** Se true, aumento é ruim (casos, alertas). Se false, aumento é bom. */
  readonly aumentoRuim = input<boolean>(true);
  /** Série para a sparkline (mais antigo → mais recente). */
  readonly sparkline = input<number[] | null>(null);

  protected readonly deltaSubindo = computed(() => (this.delta() ?? 0) > 0);

  protected readonly deltaClasse = computed(() => {
    const d = this.delta();
    if (d == null || Math.abs(d) < 0.5) return 'neutro';
    const subindo = d > 0;
    const ruim = this.aumentoRuim() ? subindo : !subindo;
    return ruim ? 'subiu-ruim' : 'subiu-bom';
  });

  protected readonly deltaTexto = computed(() => {
    const d = this.delta();
    if (d == null) return '';
    const s = d > 0 ? '+' : '';
    return `${s}${d.toFixed(1)}%`;
  });

  protected readonly sparkCor = computed(() => {
    const cls = this.deltaClasse();
    if (cls === 'subiu-ruim') return 'var(--n4)';
    if (cls === 'subiu-bom') return 'var(--n1)';
    return 'var(--muted)';
  });

  protected readonly sparkPath = computed(() => {
    const d = this.sparkline();
    if (!d || d.length < 2) return null;
    const min = Math.min(...d), max = Math.max(...d);
    const span = max - min || 1;
    const step = 100 / (d.length - 1);
    return d.map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (26 - ((v - min) / span) * 24).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    }).join(' ');
  });
}
