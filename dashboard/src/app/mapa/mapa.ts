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
import * as L from 'leaflet';
import { Doenca, FilterParams, MunicipiosGeoJson, MunicipioProps, RadarService } from '../radar.service';
import { corDoNivel, NIVEL_HEX, NIVEL_LABEL } from '../nivel';
import { TipoMapa } from '../dashboard/dashboard';

const INC_BREAKS: [number, string][] = [
  [  10, '#1d4ed8'],
  [  50, '#7c3aed'],
  [ 100, '#c2410c'],
  [ 300, '#dc2626'],
  [Infinity, '#7f1d1d'],
];

const INC_LABELS: [string, string][] = [
  ['< 10',    '#1d4ed8'],
  ['10–50',   '#7c3aed'],
  ['50–100',  '#c2410c'],
  ['100–300', '#dc2626'],
  ['> 300',   '#7f1d1d'],
];

function corDaIncidencia(inc: number | null | undefined): string {
  if (inc == null || inc <= 0) return '#111827';
  for (const [lim, cor] of INC_BREAKS) if (inc < lim) return cor;
  return '#7f1d1d';
}

@Component({
  selector: 'app-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mapa-wrap">
      <div #host class="mapa"></div>
      <div class="legenda">
        @if (tipoMapa() === 'alerta') {
          @for (n of niveis; track n) {
            <span class="item">
              <i [style.background]="hex[n]"></i>{{ label[n] }}
            </span>
          }
        } @else {
          <span class="legenda-titulo">Inc./100k hab.</span>
          @for (faixa of incFaixas; track faixa[0]) {
            <span class="item">
              <i [style.background]="faixa[1]"></i>{{ faixa[0] }}
            </span>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .mapa-wrap {
        position: relative;
        height: 100%;
      }
      .mapa {
        height: 100%;
        min-height: 460px;
        border-radius: var(--radius);
      }
      .legenda {
        position: absolute;
        bottom: 14px;
        left: 14px;
        z-index: 500;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(7, 13, 26, 0.88);
        backdrop-filter: blur(8px);
        border: 1px solid var(--border);
        border-radius: 10px;
        font-size: 11px;
        font-weight: 500;
        color: var(--muted);
      }
      .legenda-titulo {
        color: var(--muted-2);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        width: 100%;
        margin-bottom: -2px;
      }
      .legenda .item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .legenda i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: inline-block;
        flex-shrink: 0;
      }
    `,
  ],
})
export class Mapa implements AfterViewInit, OnDestroy {
  private readonly radar = inject(RadarService);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly doenca    = input.required<Doenca>();
  readonly uf        = input<string | null>(null);
  readonly regiao    = input<string | null>(null);
  readonly tipoMapa  = input<TipoMapa>('alerta');
  readonly selecionar = output<MunicipioProps>();

  protected readonly niveis    = [1, 2, 3, 4, 0];
  protected readonly hex       = NIVEL_HEX;
  protected readonly label     = NIVEL_LABEL;
  protected readonly incFaixas = INC_LABELS;

  private map?: L.Map;
  private layer?: L.GeoJSON;
  private lastFc: MunicipiosGeoJson | null = null;

  constructor() {
    effect(() => {
      const doenca = this.doenca();
      const uf     = this.uf();
      const regiao = this.regiao();
      if (this.map) this.carregar(doenca, uf, regiao);
    });

    effect(() => {
      // Re-render only (no re-fetch) when map type switches
      void this.tipoMapa();
      if (this.map && this.lastFc) this.render(this.lastFc);
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.host().nativeElement, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-15.8, -47.9], 4);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.carregar(this.doenca(), this.uf(), this.regiao());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private carregar(doenca: Doenca, uf: string | null, regiao: string | null): void {
    const filter: FilterParams = {};
    if (uf) filter.uf = uf;
    else if (regiao) filter.regiao = regiao;
    this.radar.municipios(doenca, filter).subscribe((fc) => this.render(fc));
  }

  private render(fc: MunicipiosGeoJson): void {
    if (!this.map) return;
    this.lastFc = fc;
    this.layer?.remove();

    const tipo = this.tipoMapa();

    this.layer = L.geoJSON(fc, {
      style: (feature) => ({
        fillColor: tipo === 'incidencia'
          ? corDaIncidencia(feature?.properties?.p_inc100k)
          : corDoNivel(feature?.properties?.nivel),
        weight: 1,
        color: '#0b1120',
        fillOpacity: 0.78,
      }),
      onEachFeature: (feature, lyr) => {
        const p = feature.properties as MunicipioProps;
        const casos = p.casos_est != null ? Math.round(p.casos_est) : '—';
        const rt    = p.rt != null ? p.rt.toFixed(2) : '—';
        const inc   = p.p_inc100k != null ? p.p_inc100k.toFixed(1) : '—';
        lyr.bindTooltip(
          `<strong>${p.nome}</strong> <span style="opacity:.6">${p.uf ?? ''}</span>` +
          `<br>Nível ${NIVEL_LABEL[p.nivel ?? 0]} · ${casos} casos est.` +
          `<br>Inc. ${inc}/100k · Rt ${rt}`,
        );
        lyr.on({
          mouseover: (e) => (e.target as L.Path).setStyle({ weight: 2.5, color: '#e6ecf7' }),
          mouseout:  (e) => this.layer?.resetStyle(e.target as L.Path),
          click:     () => this.selecionar.emit(p),
        });
      },
    }).addTo(this.map);

    const bounds = this.layer.getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [20, 20] });
  }
}
