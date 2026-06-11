import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Doenca, MunicipioProps, RadarService, Resumo } from './radar.service';
import { Mapa } from './mapa/mapa';
import { Serie } from './serie/serie';
import { NIVEL_HEX, NIVEL_LABEL } from './nivel';

@Component({
  selector: 'app-root',
  imports: [Mapa, Serie, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly radar = inject(RadarService);

  protected readonly doenca = signal<Doenca>('dengue');
  protected readonly resumo = signal<Resumo | null>(null);
  protected readonly selecionado = signal<MunicipioProps | null>(null);

  protected readonly hex = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;

  constructor() {
    this.carregarResumo();
  }

  protected trocarDoenca(d: Doenca): void {
    if (d === this.doenca()) return;
    this.doenca.set(d);
    this.selecionado.set(null);
    this.carregarResumo();
  }

  protected onSelecionar(m: MunicipioProps): void {
    this.selecionado.set(m);
  }

  protected dataCarga(): string {
    const iso = this.resumo()?.ultima_carga;
    return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
  }

  protected semana(): string {
    const se = this.resumo()?.ultima_se;
    return se ? `${String(se).slice(4)}/${String(se).slice(0, 4)}` : '—';
  }

  private carregarResumo(): void {
    this.radar.resumo(this.doenca()).subscribe((r) => this.resumo.set(r));
  }
}
