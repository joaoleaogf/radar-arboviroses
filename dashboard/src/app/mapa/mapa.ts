import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { Doenca, FilterParams, MunicipiosGeoJson, MunicipioProps, RadarService } from '../radar.service';
import { corDoNivel, NIVEL_HEX, NIVEL_LABEL } from '../nivel';
import { TipoMapa } from '../dashboard/dashboard';

const INC_BREAKS: [number, string][] = [
  [  10, '#2563eb'],
  [  50, '#7c3aed'],
  [ 100, '#c2410c'],
  [ 300, '#dc2626'],
  [Infinity, '#7f1d1d'],
];

const INC_LABELS: [string, string][] = [
  ['< 10',    '#2563eb'],
  ['10–50',   '#7c3aed'],
  ['50–100',  '#c2410c'],
  ['100–300', '#dc2626'],
  ['> 300',   '#7f1d1d'],
];

function corDaIncidencia(inc: number | null | undefined): string {
  if (inc == null || inc <= 0) return '#0d1a2e';
  for (const [lim, cor] of INC_BREAKS) if (inc < lim) return cor;
  return '#7f1d1d';
}

@Component({
  selector: 'app-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mapa-wrap">
      <div #host class="mapa"></div>

      @if (carregando()) {
        <div class="mapa-loading">
          <div class="spinner-ring"></div>
        </div>
      }

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
  styles: [`
    .mapa-wrap {
      position: relative;
      height: 100%;
    }
    .mapa {
      height: 100%;
      min-height: 460px;
      border-radius: var(--radius);
    }
    .mapa-loading {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(5, 12, 24, 0.55);
      border-radius: var(--radius);
      z-index: 500;
      backdrop-filter: blur(3px);
    }
    .spinner-ring {
      width: 36px; height: 36px;
      border: 3px solid rgba(34, 211, 238, 0.2);
      border-top-color: var(--brand);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .legenda {
      position: absolute;
      bottom: 14px; left: 14px;
      z-index: 500;
      display: flex; flex-wrap: wrap; gap: 7px;
      padding: 8px 12px;
      background: rgba(5, 12, 24, 0.90);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 11px; font-weight: 500;
      color: var(--muted);
    }
    .legenda-titulo {
      color: var(--muted-2); font-size: 10px; font-weight: 700;
      letter-spacing: 0.05em; text-transform: uppercase;
      width: 100%; margin-bottom: -2px;
    }
    .legenda .item {
      display: inline-flex; align-items: center; gap: 5px;
    }
    .legenda i {
      width: 10px; height: 10px; border-radius: 3px;
      display: inline-block; flex-shrink: 0;
    }

    @media (max-width: 700px) {
      .mapa { min-height: 340px; border-radius: 0; }
      .legenda {
        bottom: 8px; left: 8px; right: 8px;
        gap: 5px 10px;
        padding: 7px 10px;
        font-size: 10px;
        justify-content: center;
      }
      .legenda .item { gap: 4px; }
      .legenda i { width: 8px; height: 8px; }
      /* Controles de zoom maiores para o toque */
      :host ::ng-deep .leaflet-touch .leaflet-control-zoom a {
        width: 34px; height: 34px; line-height: 34px;
      }
    }
  `],
})
export class Mapa implements AfterViewInit, OnDestroy {
  private readonly radar = inject(RadarService);
  private readonly cdr   = inject(ChangeDetectorRef);
  private readonly host  = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly doenca    = input.required<Doenca>();
  readonly uf        = input<string | null>(null);
  readonly regiao    = input<string | null>(null);
  readonly tipoMapa  = input<TipoMapa>('alerta');
  readonly selecionar = output<MunicipioProps>();

  protected readonly niveis    = [1, 2, 3, 4, 0];
  protected readonly hex       = NIVEL_HEX;
  protected readonly label     = NIVEL_LABEL;
  protected readonly incFaixas = INC_LABELS;
  protected readonly carregando = signal(false);

  private map?: L.Map;
  private layer?: L.GeoJSON;
  private lastFc: MunicipiosGeoJson | null = null;
  private readonly canvasRenderer = L.canvas({ padding: 0.5, tolerance: 4 });

  constructor() {
    effect(() => {
      const doenca = this.doenca();
      const uf     = this.uf();
      const regiao = this.regiao();
      if (this.map) this.carregar(doenca, uf, regiao);
    });

    effect(() => {
      void this.tipoMapa();
      if (this.map && this.lastFc) this.render(this.lastFc);
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.host().nativeElement, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
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
    this.carregando.set(true);
    this.cdr.markForCheck();
    const filter: FilterParams = {};
    if (uf) filter.uf = uf;
    else if (regiao) filter.regiao = regiao;
    this.radar.municipios(doenca, filter).subscribe((fc) => {
      this.carregando.set(false);
      this.cdr.markForCheck();
      this.render(fc);
    });
  }

  private render(fc: MunicipiosGeoJson): void {
    if (!this.map) return;
    this.lastFc = fc;
    this.layer?.remove();

    const tipo = this.tipoMapa();

    this.layer = (L.geoJSON as any)(fc, {
      renderer: this.canvasRenderer,
      style: (feature: any) => ({
        fillColor: tipo === 'incidencia'
          ? corDaIncidencia(feature?.properties?.p_inc100k)
          : corDoNivel(feature?.properties?.nivel),
        weight:      0.4,
        color:       '#0a1830',
        fillOpacity: 0.82,
      }),
      onEachFeature: (feature: any, lyr: L.Layer) => {
        const p = (feature as any).properties as MunicipioProps;
        const casos = p.casos_est != null ? Math.round(p.casos_est).toLocaleString('pt-BR') : '—';
        const rt    = p.rt != null ? p.rt.toFixed(2) : '—';
        const inc   = p.p_inc100k != null ? p.p_inc100k.toFixed(1) : '—';
        const nivelLabel = NIVEL_LABEL[p.nivel ?? 0];
        const nivelCor   = NIVEL_HEX[p.nivel ?? 0];
        lyr.bindTooltip(
          `<strong style="font-size:0.9rem">${p.nome}</strong> <span style="color:#6b7f9e">${p.uf ?? ''}</span>` +
          `<br><span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;background:${nivelCor}20;color:${nivelCor};font-size:0.75rem;font-weight:700">${nivelLabel}</span>` +
          `<br><span style="color:#6b7f9e;font-size:0.78rem">Casos est.: </span>${casos}` +
          `<br><span style="color:#6b7f9e;font-size:0.78rem">Inc./100k: </span>${inc} · <span style="color:#6b7f9e;font-size:0.78rem">Rt: </span>${rt}`,
          { sticky: true },
        );
        lyr.on({
          mouseover: (e) => (e.target as L.Path).setStyle({ weight: 1.5, color: '#22d3ee', fillOpacity: 0.95 }),
          mouseout:  (e) => this.layer?.resetStyle(e.target as L.Path),
          click:     () => this.selecionar.emit(p),
        });
      },
    }).addTo(this.map);

    const bounds = this.layer?.getBounds();
    if (bounds?.isValid()) this.map.fitBounds(bounds, { padding: [20, 20] });
  }
}
