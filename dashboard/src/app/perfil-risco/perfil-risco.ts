import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Doenca, PontoSerie, RadarService } from '../radar.service';
import { NIVEL_COR, NIVEL_LABEL } from '../nivel';
import { Periodo } from '../dashboard/dashboard';

interface Fatia {
  nivel: number;
  semanas: number;
  pct: number;
}

/** Nº de semanas consideradas por período (espelha o range selector da série). */
const PERIODO_SEMANAS: Record<Periodo, number> = { '3M': 13, '6M': 26, '1A': 52, 'tudo': Infinity };
const PERIODO_LABEL:   Record<Periodo, string> = { '3M': '3 meses', '6M': '6 meses', '1A': '1 ano', 'tudo': 'Histórico' };

/**
 * Perfil de risco do município selecionado: distribuição das últimas ~52
 * semanas pelos níveis de alerta do InfoDengue, com estatísticas-chave.
 * Complementa a série histórica com uma visão agregada do recorte.
 */
@Component({
  selector: 'app-perfil-risco',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bloco-header">
      <h3>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="0.6"/><rect x="12" y="7" width="3" height="11" rx="0.6"/><rect x="17" y="13" width="3" height="5" rx="0.6"/>
        </svg>
        Perfil de risco
      </h3>
      <span class="bloco-sub">{{ periodoLabel() }} · {{ totalComDados() }} sem.</span>
    </div>

    @if (totalComDados() > 0) {
      <div class="perfil">
        <div class="barra" role="img" aria-label="Distribuição de semanas por nível de alerta">
          @for (f of fatias(); track f.nivel) {
            @if (f.semanas > 0) {
              <span class="seg" [style.width.%]="f.pct" [style.background]="cor(f.nivel)"
                    [title]="label(f.nivel) + ': ' + f.semanas + ' semanas (' + (f.pct | number:'1.0-0') + '%)'"></span>
            }
          }
        </div>

        <ul class="legenda">
          @for (f of fatias(); track f.nivel) {
            <li>
              <span class="dot" [style.background]="cor(f.nivel)"></span>
              <span class="lg-label">{{ label(f.nivel) }}</span>
              <span class="lg-val">{{ f.semanas }}<small>sem</small></span>
              <span class="lg-pct">{{ f.pct | number:'1.0-0' }}%</span>
            </li>
          }
        </ul>

        <div class="stats">
          <div class="stat">
            <span class="st-rotulo">Semanas em alerta</span>
            <strong class="st-valor" [class.destaque]="semanasAlerta() > 0">{{ semanasAlerta() }}</strong>
            <small class="st-hint">laranja + vermelho</small>
          </div>
          <div class="stat">
            <span class="st-rotulo">{{ porIncidencia() ? 'Pico de inc./100k' : 'Pico de casos est.' }}</span>
            <strong class="st-valor">{{ pico() | number: (porIncidencia() ? '1.1-1' : '1.0-0') }}</strong>
            <small class="st-hint">em uma semana</small>
          </div>
          <div class="stat">
            <span class="st-rotulo">Nível atual</span>
            <strong class="st-valor" [style.color]="cor(nivelAtual())">{{ label(nivelAtual()) }}</strong>
            <small class="st-hint">semana mais recente</small>
          </div>
        </div>
      </div>
    } @else {
      <p class="sem-dados">Sem histórico de níveis para este município.</p>
    }
  `,
  styles: [`
    .bloco-header {
      display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
      padding: 14px 20px 8px; border-top: 1px solid var(--border-subtle);
    }
    .bloco-header h3 {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.72rem; font-weight: 700; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .bloco-sub { font-size: 0.7rem; color: var(--muted-2); white-space: nowrap; }

    .perfil { padding: 4px 20px 18px; }

    .barra {
      display: flex; width: 100%; height: 14px; border-radius: 999px;
      overflow: hidden; background: var(--surface-3); gap: 2px;
    }
    .seg { height: 100%; transition: width var(--t-slow); min-width: 3px; }

    .legenda {
      list-style: none; margin: 12px 0 0; padding: 0;
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px;
    }
    .legenda li { display: flex; align-items: center; gap: 7px; font-size: 0.8rem; }
    .dot { width: 8px; height: 8px; border-radius: 3px; flex-shrink: 0; }
    .lg-label { color: var(--muted); flex: 1; }
    .lg-val { font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
    .lg-val small { font-weight: 400; color: var(--muted-2); margin-left: 2px; font-size: 0.72em; }
    .lg-pct { color: var(--muted-2); font-size: 0.72rem; min-width: 30px; text-align: right; }

    .stats {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-subtle);
    }
    .stat { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .st-rotulo { font-size: 0.68rem; color: var(--muted-2); letter-spacing: 0.01em; }
    .st-valor { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em; color: var(--text); }
    .st-valor.destaque { color: var(--n3); }
    .st-hint { font-size: 0.66rem; color: var(--muted-2); }

    .sem-dados {
      padding: 18px 20px; margin: 0; color: var(--muted); font-size: 0.85rem;
    }

    @media (max-width: 420px) {
      .legenda { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr; gap: 8px; }
    }
  `],
})
export class PerfilRisco {
  private readonly radar = inject(RadarService);

  readonly geocode = input<number | null>(null);
  readonly doenca  = input.required<Doenca>();
  /** Métrica do pico, sincronizada com o toggle da série histórica. */
  readonly metrica = input<'casos' | 'incidencia'>('casos');
  /** Período, sincronizado com o range selector da série histórica. */
  readonly periodo = input<Periodo>('1A');

  protected readonly porIncidencia = computed(() => this.metrica() === 'incidencia');
  protected readonly periodoLabel  = computed(() => PERIODO_LABEL[this.periodo()]);

  private readonly serie = signal<PontoSerie[]>([]);

  constructor() {
    effect(() => {
      const g = this.geocode();
      const d = this.doenca();
      if (!g) { this.serie.set([]); return; }
      this.radar.serie(g, d).subscribe({
        next: res => this.serie.set(res.serie ?? []),
        error: () => this.serie.set([]),
      });
    });
  }

  /** Semanas do período selecionado com nível de alerta válido (1–4). */
  private readonly recente = computed(() => {
    const n = PERIODO_SEMANAS[this.periodo()];
    const janela = n === Infinity ? this.serie() : this.serie().slice(-n);
    return janela.filter(p => (p.nivel ?? 0) >= 1);
  });

  protected readonly totalComDados = computed(() => this.recente().length);

  protected readonly fatias = computed<Fatia[]>(() => {
    const total = this.totalComDados();
    return [1, 2, 3, 4].map(nivel => {
      const semanas = this.recente().filter(p => p.nivel === nivel).length;
      return { nivel, semanas, pct: total ? (semanas / total) * 100 : 0 };
    });
  });

  protected readonly semanasAlerta = computed(() =>
    this.recente().filter(p => (p.nivel ?? 0) >= 3).length,
  );

  protected readonly pico = computed(() => {
    const inc = this.porIncidencia();
    return this.recente().reduce(
      (max, p) => Math.max(max, (inc ? p.p_inc100k : p.casos_est) ?? 0),
      0,
    );
  });

  protected readonly nivelAtual = computed(() => {
    const ult = this.serie().at(-1);
    return ult?.nivel ?? 0;
  });

  protected cor(n: number): string { return NIVEL_COR[n] ?? NIVEL_COR[0]; }
  protected label(n: number): string { return NIVEL_LABEL[n] ?? NIVEL_LABEL[0]; }
}
