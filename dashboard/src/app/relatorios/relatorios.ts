import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { NIVEL_HEX, NIVEL_LABEL } from '../nivel';

interface Row {
  geocode: number; nome: string; uf: string; regiao: string; pop: number | null;
  nivel: number | null; casos_est: number | null; p_inc100k: number | null; rt: number | null; se: number | null;
}

type SortKey = 'nome' | 'uf' | 'nivel' | 'casos_est' | 'p_inc100k' | 'rt';

@Component({
  selector: 'app-relatorios',
  imports: [FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './relatorios.html',
  styleUrl: './relatorios.css',
})
export class Relatorios implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  protected todas       = signal<Row[]>([]);
  protected carregando  = signal(true);
  protected doenca      = signal<'dengue' | 'chikungunya'>('dengue');
  protected busca       = signal('');
  protected nivelFiltro = signal(0);
  protected sortKey     = signal<SortKey>('nivel');
  protected sortAsc     = signal(false);

  protected readonly hex   = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;

  protected readonly filtradas = computed(() => {
    const q  = this.busca().toLowerCase();
    const nf = this.nivelFiltro();
    const sk = this.sortKey();
    const asc = this.sortAsc();

    return [...this.todas()]
      .filter(r => (!q || r.nome.toLowerCase().includes(q) || r.uf.toLowerCase().includes(q)))
      .filter(r => !nf || r.nivel === nf)
      .sort((a, b) => {
        const va = (a as any)[sk] ?? -1;
        const vb = (b as any)[sk] ?? -1;
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return asc ? cmp : -cmp;
      });
  });

  ngOnInit(): void { this.carregar(); }

  protected trocar(d: 'dengue' | 'chikungunya'): void { this.doenca.set(d); this.carregar(); }

  protected setSort(k: SortKey): void {
    if (this.sortKey() === k) this.sortAsc.update(v => !v);
    else { this.sortKey.set(k); this.sortAsc.set(false); }
  }

  protected exportCsv(): void {
    const rows = this.filtradas();
    const header = ['Geocode','Município','UF','Região','Pop.','Nível','Casos Est.','Inc/100k','Rt','SE'];
    const lines = rows.map(r => [
      r.geocode, r.nome, r.uf, r.regiao, r.pop ?? '',
      this.label[r.nivel ?? 0], r.casos_est?.toFixed(0) ?? '',
      r.p_inc100k?.toFixed(1) ?? '', r.rt?.toFixed(2) ?? '',
      r.se ?? '',
    ].join(','));
    const blob = new Blob([header.join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `radar_${this.doenca()}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.http.get<any>(`${this.base}/municipios`, { params: { doenca: this.doenca() } })
      .subscribe(fc => {
        this.todas.set((fc.features ?? []).map((f: any) => f.properties));
        this.carregando.set(false);
      });
  }
}
