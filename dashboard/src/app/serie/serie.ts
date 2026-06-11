import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import Highcharts from 'highcharts';
import { Doenca, RadarService } from '../radar.service';
import { NIVEL_HEX } from '../nivel';

@Component({
  selector: 'app-serie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geocode()) {
      <div #host class="grafico"></div>
    } @else {
      <div class="vazio">Selecione um município no mapa para ver a série histórica.</div>
    }
  `,
  styles: [
    `
      .grafico {
        width: 100%;
        height: 320px;
      }
      .vazio {
        display: grid;
        place-items: center;
        height: 320px;
        color: var(--muted);
        text-align: center;
        padding: 0 24px;
      }
    `,
  ],
})
export class Serie implements AfterViewInit, OnDestroy {
  private readonly radar = inject(RadarService);
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  readonly geocode = input<number | null>(null);
  readonly nome = input<string>('');
  readonly doenca = input.required<Doenca>();

  private chart?: Highcharts.Chart;

  constructor() {
    effect(() => {
      const geocode = this.geocode();
      const doenca = this.doenca();
      if (geocode) this.carregar(geocode, doenca);
    });
  }

  ngAfterViewInit(): void {
    const geocode = this.geocode();
    if (geocode) this.carregar(geocode, this.doenca());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private carregar(geocode: number, doenca: Doenca): void {
    this.radar.serie(geocode, doenca).subscribe((res) => {
      const host = this.host()?.nativeElement;
      if (!host) return;

      const categorias = res.serie.map((p) => String(p.se).slice(4) + '/' + String(p.se).slice(0, 4));
      const casosEst = res.serie.map((p) => (p.casos_est != null ? Math.round(p.casos_est) : null));
      const casos = res.serie.map((p) => p.casos ?? null);
      const cores = res.serie.map((p) => NIVEL_HEX[p.nivel ?? 0]);

      this.chart?.destroy();
      this.chart = Highcharts.chart(host, {
        chart: { backgroundColor: 'transparent', style: { fontFamily: 'Inter, sans-serif' } },
        title: { text: undefined },
        credits: { enabled: false },
        legend: { itemStyle: { color: '#93a1bd' }, itemHoverStyle: { color: '#e6ecf7' } },
        xAxis: {
          categories: categorias,
          labels: { style: { color: '#93a1bd' } },
          tickInterval: Math.ceil(categorias.length / 12),
          lineColor: '#243150',
        },
        yAxis: {
          title: { text: 'Casos', style: { color: '#93a1bd' } },
          labels: { style: { color: '#93a1bd' } },
          gridLineColor: '#1c2841',
        },
        tooltip: { shared: true },
        plotOptions: { column: { borderWidth: 0 } },
        series: [
          {
            type: 'column',
            name: 'Casos estimados',
            data: casosEst.map((y, i) => ({ y, color: cores[i] })),
          },
          {
            type: 'line',
            name: 'Casos confirmados',
            color: '#38bdf8',
            marker: { enabled: false },
            data: casos,
          },
        ],
      });
    });
  }
}
