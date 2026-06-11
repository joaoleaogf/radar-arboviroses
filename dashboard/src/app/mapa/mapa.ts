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
import { Doenca, MunicipiosGeoJson, MunicipioProps, RadarService } from '../radar.service';
import { corDoNivel, NIVEL_HEX, NIVEL_LABEL } from '../nivel';

@Component({
  selector: 'app-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mapa-wrap">
      <div #host class="mapa"></div>
      <div class="legenda">
        @for (n of niveis; track n) {
          <span class="item">
            <i [style.background]="hex[n]"></i>{{ label[n] }}
          </span>
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
        bottom: 12px;
        left: 12px;
        z-index: 500;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 8px 12px;
        background: rgba(17, 26, 46, 0.9);
        border: 1px solid var(--border);
        border-radius: 10px;
        font-size: 12px;
        color: var(--muted);
      }
      .legenda .item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legenda i {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        display: inline-block;
      }
    `,
  ],
})
export class Mapa implements AfterViewInit, OnDestroy {
  private readonly radar = inject(RadarService);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly doenca = input.required<Doenca>();
  readonly selecionar = output<MunicipioProps>();

  protected readonly niveis = [1, 2, 3, 4, 0];
  protected readonly hex = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;

  private map?: L.Map;
  private layer?: L.GeoJSON;

  constructor() {
    // Recarrega a camada sempre que a doença selecionada muda.
    effect(() => {
      const doenca = this.doenca();
      if (this.map) this.carregar(doenca);
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.host().nativeElement, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-22.1, -45.5], 8);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.carregar(this.doenca());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private carregar(doenca: Doenca): void {
    this.radar.municipios(doenca).subscribe((fc) => this.render(fc));
  }

  private render(fc: MunicipiosGeoJson): void {
    if (!this.map) return;
    this.layer?.remove();

    this.layer = L.geoJSON(fc, {
      style: (feature) => ({
        fillColor: corDoNivel(feature?.properties?.nivel),
        weight: 1,
        color: '#0b1120',
        fillOpacity: 0.75,
      }),
      onEachFeature: (feature, lyr) => {
        const p = feature.properties as MunicipioProps;
        const casos = p.casos_est != null ? Math.round(p.casos_est) : '—';
        const rt = p.rt != null ? p.rt.toFixed(2) : '—';
        lyr.bindTooltip(
          `<strong>${p.nome}</strong><br>Nível ${NIVEL_LABEL[p.nivel ?? 0]} · ${casos} casos est. · Rt ${rt}`,
        );
        lyr.on({
          mouseover: (e) => (e.target as L.Path).setStyle({ weight: 2.5, color: '#e6ecf7' }),
          mouseout: (e) => this.layer?.resetStyle(e.target as L.Path),
          click: () => this.selecionar.emit(p),
        });
      },
    }).addTo(this.map);

    const bounds = this.layer.getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [20, 20] });
  }
}
