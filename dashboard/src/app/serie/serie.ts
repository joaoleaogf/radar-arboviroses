import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import Highcharts from 'highcharts/highstock';
import { Doenca, RadarService } from '../radar.service';
import { NIVEL_HEX, NIVEL_LABEL, RT_LABEL, interpretarRt } from '../nivel';
import { fmtPtBr, tsFromIso } from '../core/se';
import { ThemeService } from '../core/theme';
import { Periodo } from '../dashboard/dashboard';

/** Ordem dos botões do range selector → índice usado por rangeSelector.selected. */
const PERIODO_INDEX: Record<Periodo, number> = { '3M': 0, '6M': 1, '1A': 2, 'tudo': 3 };

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
    @media (max-width: 600px) {
      .grafico { height: 300px; }
      .chart-hint { font-size: 0.64rem; }
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
  `],
})
export class Serie implements AfterViewInit, OnDestroy {
  private readonly radar = inject(RadarService);
  private readonly theme = inject(ThemeService);
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  readonly geocode = input<number | null>(null);
  readonly nome    = input<string>('');
  readonly doenca  = input.required<Doenca>();
  /** Métrica do eixo principal: contagem de casos ou incidência por 100k hab. */
  readonly metrica = input<'casos' | 'incidencia'>('casos');
  /** Período selecionado no range selector (compartilhado com o perfil de risco). */
  readonly periodo = input<Periodo>('1A');
  /** Emite quando o usuário troca o período pelos botões do gráfico. */
  readonly periodoChange = output<Periodo>();

  private chart?: Highcharts.Chart;

  constructor() {
    effect(() => {
      const geocode = this.geocode();
      const doenca  = this.doenca();
      this.metrica(); // recarrega ao alternar a métrica
      this.theme.theme(); // recolore o gráfico ao alternar o tema
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
      const pal = this.theme.palette();

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
              fill:            pal.btnFill,
              stroke:          pal.btnStroke,
              'stroke-width':  1,
              r:               6,
              style:           { color: pal.btnText, fontSize: '11px', fontWeight: '600' },
              states: { hover: { fill: pal.btnHoverFill, style: { color: pal.btnHoverText } } },
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
            { type: 'month', count: 3,  text: '3M',   title: 'Últimos 3 meses',  events: { click: () => { this.periodoChange.emit('3M'); } } },
            { type: 'month', count: 6,  text: '6M',   title: 'Últimos 6 meses',  events: { click: () => { this.periodoChange.emit('6M'); } } },
            { type: 'year',  count: 1,  text: '1 ano', title: 'Último ano',       events: { click: () => { this.periodoChange.emit('1A'); } } },
            { type: 'all',              text: 'Tudo',  title: 'Todo o histórico', events: { click: () => { this.periodoChange.emit('tudo'); } } },
          ],
          selected: PERIODO_INDEX[this.periodo()],
          buttonTheme: {
            fill:           pal.btnFill,
            stroke:         pal.btnStroke,
            'stroke-width': 1,
            r:              6,
            style:          { color: pal.btnText, fontWeight: '600', fontSize: '11px' },
            padding: 5,
            states: {
              hover:  { fill: pal.btnHoverFill, style: { color: pal.btnHoverText } },
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
          outlineColor: pal.navOutline,
          outlineWidth: 1,
          handles: {
            backgroundColor: pal.navOutline,
            borderColor:     '#38bdf8',
          },
          xAxis: {
            labels: { style: { color: pal.label, fontSize: '10px' } },
          },
          series: {
            type:      'column',
            color:     'rgba(56,189,248,0.5)',
            fillColor: 'rgba(56,189,248,0.05)',
            lineWidth: 0,
          },
        },

        scrollbar: { enabled: false },

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
          labels:       { style: { color: pal.axisText, fontSize: '11px' } },
          lineColor:    pal.axisLine,
          tickColor:    pal.axisLine,
          gridLineColor:'transparent',
        },

        // ── Eixos Y ──────────────────────────────────────────
        yAxis: [
          {
            // Esquerda: casos
            title:     { text: null },
            labels:    { style: { color: pal.axisText, fontSize: '11px' }, align: 'right', x: -4 },
            gridLineColor:     pal.gridStrong,
            gridLineDashStyle: 'Dot' as Highcharts.DashStyleValue,
            opposite:  false,
          },
          {
            // Direita: Rt
            title:  { text: null },
            labels: {
              style:     { color: pal.axisText, fontSize: '10px' },
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
          itemStyle:     { color: pal.axisText, fontSize: '11px', fontWeight: '600' },
          itemHoverStyle:{ color: pal.btnHoverText },
          margin: 12,
        },

        // ── Tooltip rico ─────────────────────────────────────
        tooltip: {
          shared:          true,
          useHTML:         true,
          backgroundColor: pal.tooltipBg,
          borderColor:     pal.tooltipBorder,
          borderWidth:     1,
          borderRadius:    10,
          padding:         0,
          shadow: { color: 'rgba(0,0,0,0.5)', offsetX: 0, offsetY: 4, opacity: 0.4, width: 14 },
          style: { color: pal.tooltipText, fontSize: '12px' },
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
                  <span style="flex:1;color:${pal.tooltipMuted}">${p.series.name}</span>
                  <strong style="color:${pal.tooltipText};font-variant-numeric:tabular-nums">${valFmt}</strong>
                </div>`;
            }).filter(Boolean).join('');

            const inc = (!porIncidencia && estPt?.p_inc100k != null)
              ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;color:${pal.tooltipMuted};font-size:11px">
                   <span>Incidência / 100k hab.</span>
                   <span style="color:${pal.tooltipText};font-variant-numeric:tabular-nums">${(estPt.p_inc100k as number).toFixed(1)}</span>
                 </div>` : '';

            const rtVal = estPt?.rt as number | null | undefined;
            const tend  = interpretarRt(rtVal);
            const rtCor = tend === 'crescimento' ? '#f97316' : tend === 'queda' ? '#10b981' : pal.tooltipMuted;
            const rtInterp = rtVal != null
              ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;font-size:11px">
                   <span style="color:${pal.tooltipMuted}">${RT_LABEL[tend]}</span>
                   <span style="color:${rtCor};font-weight:600">Rt ${rtVal.toFixed(2)}</span>
                 </div>` : '';

            return `
              <div style="min-width:220px;padding:12px 14px;font-family:Inter,sans-serif">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
                  <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:${hex}1a;color:${hex};letter-spacing:0.03em">${lvLabel}</span>
                  <span style="font-size:11px;color:${pal.tooltipMuted}">${seStr}${dateStr}</span>
                </div>
                <div style="border-top:1px solid ${pal.tooltipBorder};padding-top:8px">
                  ${linhas}
                  ${(inc || rtInterp) ? `<div style="border-top:1px solid ${pal.gridStrong};margin-top:6px;padding-top:6px">${inc}${rtInterp}</div>` : ''}
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
