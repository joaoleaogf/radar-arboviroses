import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { NIVEL_HEX, NIVEL_LABEL } from '../nivel';

interface Resumo {
  doenca: string; municipios: number; em_alerta: number;
  casos_est_ultima_semana: number; ultima_se: number | null;
  top_alertas: { geocode: number; nome: string; nivel: number; casos_est: number; rt: number }[];
}

interface RegiaoStats {
  regiao: string;
  municipios_dengue: number;
  em_alerta_dengue: number;
  pct_dengue: number;
  casos_dengue: number;
  municipios_chik: number;
  em_alerta_chik: number;
  pct_chik: number;
  casos_chik: number;
}

const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

@Component({
  selector: 'app-analise',
  imports: [DecimalPipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analise.html',
  styleUrl: './analise.css',
})
export class Analise implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  protected dengue     = signal<Resumo | null>(null);
  protected chikun     = signal<Resumo | null>(null);
  protected regioes    = signal<RegiaoStats[]>([]);
  protected carregando = signal(true);
  protected regiaoSort = signal<'dengue' | 'chikun'>('dengue');

  protected readonly hex   = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;

  protected readonly seLabel = computed(() => {
    const se = this.dengue()?.ultima_se;
    if (!se) return '—';
    return `SE ${String(se).slice(4)}/${String(se).slice(0, 4)}`;
  });

  protected readonly comparacao = computed(() => {
    const d = this.dengue();
    const c = this.chikun();
    if (!d || !c) return null;
    const totalD = d.municipios || 1;
    const totalC = c.municipios || 1;
    return [
      { label: 'Municípios com dados', dengue: d.municipios, chikun: c.municipios, unit: '' },
      { label: 'Em alerta (≥ laranja)', dengue: d.em_alerta, chikun: c.em_alerta, unit: '' },
      { label: 'Casos est. (últ. semana)', dengue: d.casos_est_ultima_semana, chikun: c.casos_est_ultima_semana, unit: '' },
      { label: '% municípios em alerta', dengue: Math.round(d.em_alerta / totalD * 100), chikun: Math.round(c.em_alerta / totalC * 100), unit: '%' },
    ];
  });

  protected readonly regioesSorted = computed(() => {
    const r = this.regioes();
    const by = this.regiaoSort();
    return [...r].sort((a, b) =>
      by === 'dengue' ? b.em_alerta_dengue - a.em_alerta_dengue : b.em_alerta_chik - a.em_alerta_chik
    );
  });

  ngOnInit(): void {
    this.carregarResumo('dengue');
    this.carregarResumo('chikungunya');
    this.carregarRegional();
  }

  private carregarResumo(doenca: 'dengue' | 'chikungunya'): void {
    this.http.get<Resumo>(`${this.base}/resumo`, { params: { doenca } }).subscribe(r => {
      if (doenca === 'dengue') this.dengue.set(r);
      else this.chikun.set(r);
      if (this.dengue() && this.chikun() && this.regioes().length) this.carregando.set(false);
    });
  }

  private carregarRegional(): void {
    let pending = REGIOES.length * 2;
    const map: Record<string, Partial<RegiaoStats>> = {};
    REGIOES.forEach(r => (map[r] = { regiao: r }));

    const done = () => {
      if (--pending === 0) {
        this.regioes.set(REGIOES.map(r => map[r] as RegiaoStats));
        if (this.dengue() && this.chikun()) this.carregando.set(false);
      }
    };

    REGIOES.forEach(r => {
      this.http.get<Resumo>(`${this.base}/resumo`, { params: { doenca: 'dengue', regiao: r } })
        .subscribe(res => {
          map[r].municipios_dengue = res.municipios;
          map[r].em_alerta_dengue  = res.em_alerta;
          map[r].pct_dengue        = res.municipios ? (res.em_alerta / res.municipios) * 100 : 0;
          map[r].casos_dengue      = res.casos_est_ultima_semana;
          done();
        });

      this.http.get<Resumo>(`${this.base}/resumo`, { params: { doenca: 'chikungunya', regiao: r } })
        .subscribe(res => {
          map[r].municipios_chik = res.municipios;
          map[r].em_alerta_chik  = res.em_alerta;
          map[r].pct_chik        = res.municipios ? (res.em_alerta / res.municipios) * 100 : 0;
          map[r].casos_chik      = res.casos_est_ultima_semana;
          done();
        });
    });
  }
}
