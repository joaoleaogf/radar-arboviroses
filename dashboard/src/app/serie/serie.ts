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
import Highcharts from 'highcharts/highstock';
import { Doenca, RadarService } from '../radar.service';
import { NIVEL_HEX, NIVEL_LABEL, RT_LABEL, interpretarRt } from '../nivel';
import { fmtPtBr, tsFromIso } from '../core/se';

@Component({
  selector: 'app-serie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geocode()) {
      <div class="chart-wrap">
        <div class="chart-hint">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          Arraste para zoom · Shift+arraste para navegar · Scroll para zoom fino
        </div>
        <div #host class="grafico"></div>
      </div>
    } @else {
      <div class="vazio">
        <div class="vazio-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <p>Selecione um município no mapa<br>para ver a série histórica.</p>
      </div>
    }
  `,
  styles: [`
    .chart-wrap {
      padding: 10px 4px 0;
    }
    .chart-hint {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.68rem;
      color: var(--muted-2);
      padding: 0 12px 6px;
      letter-spacing: 0.01em;
    }
    .grafico {
      width: 100%;
      height: 370px;
    }
    .vazio {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      height: 340px;
      color: var(--muted);
      text-align: center;
      padding: 0 24px;
    }
    .vazio-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 16px;
      color: var(--muted-2);
    }
    .vazio p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.6;
    }

    @media (max-width: 700px) {
      .chart-wrap { padding: 8px 0 0; }
      .grafico { height: 300px; }
      .vazio { height: 220px; gap: 10px; padding: 0 16px; }
      .vazio-icon { width: 46px; height: 46px; border-radius: 13px; }
      .vazio p { font-size: 0.82rem; }
    }

    /* Dica de zoom por arraste/scroll só faz sentido com mouse */
    @media (hover: none), (max-width: 700px) {
      .chart-hint { display: none; }
    }
  `],
})
export class Serie implements AfterViewInit, OnDestroy {
  private readonly radar = inject(RadarService);
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  readonly geocode = input<number | null>(null);
  readonly nome    = input<string>('');
  readonly doenca  = input.required<Doenca>();
  /** Métrica do eixo principal: contagem de casos ou incidência por 100k hab. */
  readonly metrica = input<'casos' | 'incidencia'>('casos');

  private chart?: Highcharts.Chart;

  constructor() {
    effect(() => {
      const geocode = this.geocode();
      const doenca  = this.doenca();
      this.metrica(); // recarrega ao alternar a métrica
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

      const pts = res.serie;
      const porIncidencia = this.metrica() === 'incidencia';

      // Série de barras principal, colorida por nível de alerta.
      // Em modo incidência mostra casos/100k hab (comparável entre municípios).
      const casosEstData = pts.map(p => ({
        x:         tsFromIso(p.data),
        y:         porIncidencia
                     ? (p.p_inc100k != null ? Math.round(p.p_inc100k * 10) / 10 : null)
                     : (p.casos_est != null ? Math.round(p.casos_est) : null),
        color:     NIVEL_HEX[p.nivel ?? 0],
        nivel:     p.nivel ?? 0,
        se:        p.se,
        rt:        p.rt,
        p_inc100k: p.p_inc100k,
      }));

      // Série de linha: casos confirmados (oculta no modo incidência, escala incompatível).
      const casosData: [number, number | null][] = pts.map(p => [
        tsFromIso(p.data), p.casos,
      ]);

      // Série Rt (eixo direito)
      const rtData: [number, number][] = pts
        .filter(p => p.rt != null)
        .map(p => [tsFromIso(p.data), p.rt!]);

      const rtMax = rtData.length
        ? Math.max(3, ...rtData.map(p => p[1])) * 1.15
        : 3;

      this.chart?.destroy();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.chart = (Highcharts as any).stockChart(host, {
        chart: {
          backgroundColor: 'transparent',
          style: { fontFamily: 'Inter, sans-serif' },
          zooming: {
            type: 'x',
            mouseWheel: { enabled: true },
          },
          panning:  { enabled: true, type: 'x' },
          panKey:   'shift',
          resetZoomButton: {
            theme: {
              fill:            '#111d33',
              stroke:          '#1c2b46',
              'stroke-width':  1,
              r:               6,
              style:           { color: '#7080a0', fontSize: '11px', fontWeight: '600' },
              states: { hover: { fill: '#162039', style: { color: '#e4eaf6' } } },
            },
            position: { align: 'right', verticalAlign: 'top', x: -4, y: 4 },
          },
          marginTop: 4,
          spacing: [4, 8, 4, 8],
        },

        title:    { text: undefined },
        subtitle: { text: undefined },
        credits:  { enabled: false },

        // ── Range selector ──────────────────────────────────
        rangeSelector: {
          enabled:      true,
          inputEnabled: false,
          buttonSpacing: 4,
          buttons: [
            { type: 'month', count: 3,  text: '3M',   title: 'Últimos 3 meses' },
            { type: 'month', count: 6,  text: '6M',   title: 'Últimos 6 meses' },
            { type: 'year',  count: 1,  text: '1 ano', title: 'Último ano' },
            { type: 'all',              text: 'Tudo',  title: 'Todo o histórico' },
          ],
          selected: 2, // "1 ano" como padrão — contexto epidemiológico relevante
          buttonTheme: {
            fill:           '#111d33',
            stroke:         '#1c2b46',
            'stroke-width': 1,
            r:              6,
            style:          { color: '#7080a0', fontWeight: '600', fontSize: '11px' },
            padding: 5,
            states: {
              hover:  { fill: '#162039', style: { color: '#e4eaf6' } },
              select: {
                fill:   '#38bdf8',
                stroke: '#38bdf8',
                style:  { color: '#03090f', fontWeight: '700' },
              },
            },
          },
          labelStyle: { display: 'none' },
        },

        // ── Navigator (mini-mapa temporal) ──────────────────
        navigator: {
          enabled: true,
          height:  34,
          margin:  10,
          maskFill:     'rgba(56,189,248,0.07)',
          outlineColor: '#1c2b46',
          outlineWidth: 1,
          handles: {
            backgroundColor: '#1c2b46',
            borderColor:     '#38bdf8',
          },
          xAxis: {
            labels: { style: { color: '#3d5070', fontSize: '10px' } },
          },
          series: {
            type:      'column',
            color:     'rgba(56,189,248,0.5)',
            fillColor: 'rgba(56,189,248,0.05)',
            lineWidth: 0,
          },
        },

        scrollbar: { enabled: false },

        // ── Telas estreitas: menos cromo, mais gráfico ───────
        responsive: {
          rules: [{
            condition: { maxWidth: 480 },
            chartOptions: {
              // Navegador temporal come ~45px de altura e é difícil de
              // manipular no toque — o rangeSelector já cobre o caso de uso.
              navigator: { enabled: false },
              legend: {
                itemStyle: { fontSize: '10px' },
                itemDistance: 12,
                margin: 8,
              },
              xAxis: { labels: { style: { fontSize: '10px' } } },
              yAxis: [
                { labels: { style: { fontSize: '10px' } } },
                { labels: { style: { fontSize: '9px' } } },
              ],
            },
          }],
        },

        // ── Eixo X — datas naturais ──────────────────────────
        xAxis: {
          type: 'datetime',
          dateTimeLabelFormats: {
            day:   '%e %b',
            week:  '%e %b',
            month: '%b %Y',
            year:  '%Y',
          },
          crosshair: {
            color:     'rgba(56,189,248,0.2)',
            dashStyle: 'Dash' as Highcharts.DashStyleValue,
            width:     1,
          },
          labels:       { style: { color: '#7080a0', fontSize: '11px' } },
          lineColor:    '#1c2b46',
          tickColor:    '#1c2b46',
          gridLineColor:'transparent',
        },

        // ── Eixos Y ──────────────────────────────────────────
        yAxis: [
          {
            // Esquerda: casos
            title:     { text: null },
            labels:    { style: { color: '#7080a0', fontSize: '11px' }, align: 'right', x: -4 },
            gridLineColor:     '#131e34',
            gridLineDashStyle: 'Dot' as Highcharts.DashStyleValue,
            opposite:  false,
          },
          {
            // Direita: Rt
            title:  { text: null },
            labels: {
              style:     { color: '#7080a0', fontSize: '10px' },
              formatter: function(this: Highcharts.AxisLabelsFormatterContextObject) {
                return (this.value as number).toFixed(1);
              },
            },
            gridLineColor: 'transparent',
            opposite:      true,
            min: 0,
            max: rtMax,
            plotLines: [{
              value:     1,
              color:     'rgba(234,179,8,0.4)',
              dashStyle: 'Dot' as Highcharts.DashStyleValue,
              width:     1.5,
              label: {
                text:  'Rt = 1',
                align: 'right',
                style: { color: '#eab308', fontSize: '10px', fontWeight: '600' },
                x: -4,
                y: -4,
              },
              zIndex: 4,
            }],
          },
        ],

        // ── Legenda ──────────────────────────────────────────
        legend: {
          enabled:       true,
          align:         'left',
          verticalAlign: 'top',
          floating:      false,
          symbolRadius:  3,
          itemStyle:     { color: '#7080a0', fontSize: '11px', fontWeight: '600' },
          itemHoverStyle:{ color: '#e4eaf6' },
          margin: 12,
        },

        // ── Tooltip rico ─────────────────────────────────────
        tooltip: {
          shared:          true,
          useHTML:         true,
          backgroundColor: 'rgba(7,13,26,0.97)',
          borderColor:     '#1c2b46',
          borderWidth:     1,
          borderRadius:    10,
          padding:         0,
          shadow: { color: 'rgba(0,0,0,0.5)', offsetX: 0, offsetY: 4, opacity: 0.4, width: 14 },
          style: { color: '#e4eaf6', fontSize: '12px' },
          formatter: function(this: Highcharts.TooltipFormatterContextObject): string {
            const points  = (this as any).points as Highcharts.TooltipFormatterContextObject[];
            if (!points?.length) return '';

            const estPt   = points.find(p => (p.series as any).type === 'column')?.point as any;
            const nivel   = estPt?.nivel  ?? 0;
            const hex     = NIVEL_HEX[nivel]   ?? '#475569';
            const lvLabel = NIVEL_LABEL[nivel]  ?? 'Sem dados';
            const se      = estPt?.se ?? '';
            const seStr   = se ? `SE&nbsp;${String(se).slice(4)}&nbsp;·&nbsp;` : '';
            const dateStr = fmtPtBr((this as any).x as number);

            const linhas = points.map(p => {
              if (p.y == null) return '';
              const isRt    = p.series.name === 'Rt';
              const valFmt  = isRt
                ? p.y.toFixed(2)
                : p.y.toLocaleString('pt-BR');
              const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${p.color};flex-shrink:0"></span>`;
              return `
                <div style="display:flex;align-items:center;gap:8px;padding:2px 0">
                  ${dot}
                  <span style="flex:1;color:#9aa8c0">${p.series.name}</span>
                  <strong style="color:#e4eaf6;font-variant-numeric:tabular-nums">${valFmt}</strong>
                </div>`;
            }).filter(Boolean).join('');

            const inc = (!porIncidencia && estPt?.p_inc100k != null)
              ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;color:#7080a0;font-size:11px">
                   <span>Incidência / 100k hab.</span>
                   <span style="color:#9aa8c0;font-variant-numeric:tabular-nums">${(estPt.p_inc100k as number).toFixed(1)}</span>
                 </div>` : '';

            const rtVal = estPt?.rt as number | null | undefined;
            const tend  = interpretarRt(rtVal);
            const rtCor = tend === 'crescimento' ? '#f97316' : tend === 'queda' ? '#10b981' : '#7080a0';
            const rtInterp = rtVal != null
              ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;font-size:11px">
                   <span style="color:#7080a0">${RT_LABEL[tend]}</span>
                   <span style="color:${rtCor};font-weight:600">Rt ${rtVal.toFixed(2)}</span>
                 </div>` : '';

            return `
              <div style="min-width:220px;padding:12px 14px;font-family:Inter,sans-serif">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
                  <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:${hex}1a;color:${hex};letter-spacing:0.03em">${lvLabel}</span>
                  <span style="font-size:11px;color:#7080a0">${seStr}${dateStr}</span>
                </div>
                <div style="border-top:1px solid #1c2b46;padding-top:8px">
                  ${linhas}
                  ${(inc || rtInterp) ? `<div style="border-top:1px solid #131e34;margin-top:6px;padding-top:6px">${inc}${rtInterp}</div>` : ''}
                </div>
              </div>`;
          },
        },

        // ── Opções de série ──────────────────────────────────
        plotOptions: {
          column: {
            borderWidth: 0,
            borderRadius: 2,
            maxPointWidth: 14,
            groupPadding: 0.05,
          },
          line: {
            marker: {
              enabled: false,
              states: { hover: { enabled: true, radius: 4, lineWidth: 0 } },
            },
          },
          series: {
            animation: { duration: 350 },
            states: { inactive: { opacity: 0.6 } },
          },
        },

        // ── Séries ───────────────────────────────────────────
        series: [
          {
            type:  'column',
            name:  porIncidencia ? 'Incidência / 100k' : 'Casos est.',
            data:  casosEstData,
            yAxis: 0,
            zIndex: 2,
          },
          {
            type:      'line',
            name:      'Confirmados',
            data:      casosData,
            color:     '#38bdf8',
            lineWidth: 1.5,
            opacity:   0.75,
            yAxis:     0,
            zIndex:    3,
            visible:   !porIncidencia,
            showInLegend: !porIncidencia,
          },
          {
            type:      'line',
            name:      'Rt',
            data:      rtData,
            color:     '#eab308',
            lineWidth: 1.5,
            dashStyle: 'ShortDash' as Highcharts.DashStyleValue,
            yAxis:     1,
            zIndex:    4,
          },
        ],
      } as unknown as Highcharts.Options);
    });
  }
}
