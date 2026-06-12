import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { NIVEL_HEX, NIVEL_LABEL } from '../nivel';

interface Resumo {
  doenca: string; municipios: number; em_alerta: number;
  casos_est_ultima_semana: number; ultima_se: number | null;
  top_alertas: { geocode: number; nome: string; nivel: number; casos_est: number; rt: number }[];
}

interface RegiaoStats {
  regiao: string;
  municipios: number;
  em_alerta: number;
  pct_alerta: number;
  casos_total: number;
}

const REGIOES = ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];

@Component({
  selector: 'app-analise',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analise.html',
  styleUrl: './analise.css',
})
export class Analise implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  protected dengue    = signal<Resumo | null>(null);
  protected chikun    = signal<Resumo | null>(null);
  protected regioes   = signal<RegiaoStats[]>([]);
  protected carregando = signal(true);
  protected readonly hex   = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;

  protected readonly comparacao = computed(() => {
    const d = this.dengue();
    const c = this.chikun();
    if (!d || !c) return null;
    return [
      { label: 'Municípios com dados', dengue: d.municipios, chikun: c.municipios },
      { label: 'Em alerta (≥ laranja)', dengue: d.em_alerta, chikun: c.em_alerta },
      { label: 'Casos est. (últ. semana)', dengue: d.casos_est_ultima_semana, chikun: c.casos_est_ultima_semana },
    ];
  });

  ngOnInit(): void {
    Promise.all([
      this.carregarResumo('dengue'),
      this.carregarResumo('chikungunya'),
      this.carregarRegional(),
    ]);
  }

  private carregarResumo(doenca: 'dengue' | 'chikungunya'): void {
    this.http.get<Resumo>(`${this.base}/resumo`, { params: { doenca } }).subscribe(r => {
      if (doenca === 'dengue') this.dengue.set(r);
      else this.chikun.set(r);
      if (this.dengue() && this.chikun()) this.carregando.set(false);
    });
  }

  private carregarRegional(): void {
    const reqs = REGIOES.map(r =>
      this.http.get<Resumo>(`${this.base}/resumo`, { params: { doenca: 'dengue', regiao: r } })
        .toPromise().then(res => ({
          regiao:     r,
          municipios: res?.municipios ?? 0,
          em_alerta:  res?.em_alerta  ?? 0,
          pct_alerta: res?.municipios ? ((res?.em_alerta ?? 0) / res.municipios) * 100 : 0,
          casos_total: res?.casos_est_ultima_semana ?? 0,
        }))
    );
    Promise.all(reqs).then(rows => this.regioes.set(rows.sort((a,b) => b.em_alerta - a.em_alerta)));
  }
}
