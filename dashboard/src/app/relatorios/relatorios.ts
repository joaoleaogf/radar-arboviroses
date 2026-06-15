import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { environment } from '../../environments/environment';
import { NIVEL_HEX, NIVEL_LABEL } from '../nivel';
import { REGIOES, UFS_POR_REGIAO } from '../core/geo';

interface Row {
  geocode: number; nome: string; uf: string; regiao: string; pop: number | null;
  nivel: number | null; casos_est: number | null; p_inc100k: number | null;
  rt: number | null; se: number | null;
}

type SortKey = 'nome' | 'uf' | 'regiao' | 'nivel' | 'casos_est' | 'p_inc100k' | 'rt';

@Component({
  selector: 'app-relatorios',
  imports: [FormsModule, DecimalPipe, NgTemplateOutlet],
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
  protected regiaoFiltro = signal('');
  protected ufFiltro    = signal('');
  protected sortKey     = signal<SortKey>('nivel');
  protected sortAsc     = signal(false);

  protected readonly hex   = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;
  protected readonly regioes = REGIOES;
  protected readonly ufsPorRegiao = UFS_POR_REGIAO;

  protected readonly ufsDaRegiao = computed(() => {
    const r = this.regiaoFiltro();
    return r ? (UFS_POR_REGIAO[r] ?? []) : [];
  });

  protected readonly filtradas = computed(() => {
    const q   = this.busca().toLowerCase().trim();
    const nf  = this.nivelFiltro();
    const rf  = this.regiaoFiltro();
    const uf  = this.ufFiltro();
    const sk  = this.sortKey();
    const asc = this.sortAsc();

    return [...this.todas()]
      .filter(r => !q || r.nome.toLowerCase().includes(q) || r.uf?.toLowerCase().includes(q))
      .filter(r => !nf || r.nivel === nf)
      .filter(r => !rf || r.regiao === rf)
      .filter(r => !uf || r.uf === uf)
      .sort((a, b) => {
        const va = (a as any)[sk] ?? (typeof (a as any)[sk] === 'string' ? '' : -1);
        const vb = (b as any)[sk] ?? (typeof (b as any)[sk] === 'string' ? '' : -1);
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : (va as number) - (vb as number);
        return asc ? cmp : -cmp;
      });
  });

  protected readonly stats = computed(() => {
    const rows = this.filtradas();
    const emAlerta   = rows.filter(r => (r.nivel ?? 0) >= 3).length;
    const totalCasos = rows.reduce((s, r) => s + (r.casos_est ?? 0), 0);
    const incValidos = rows.filter(r => r.p_inc100k != null && r.p_inc100k > 0);
    const avgInc     = incValidos.length
      ? incValidos.reduce((s, r) => s + r.p_inc100k!, 0) / incValidos.length
      : 0;
    return { total: rows.length, emAlerta, totalCasos, avgInc };
  });

  ngOnInit(): void { this.carregar(); }

  protected trocar(d: 'dengue' | 'chikungunya'): void { this.doenca.set(d); this.carregar(); }

  protected setRegiaoFiltro(r: string): void {
    this.regiaoFiltro.set(r);
    this.ufFiltro.set('');
  }

  protected setSort(k: SortKey): void {
    if (this.sortKey() === k) this.sortAsc.update(v => !v);
    else { this.sortKey.set(k); this.sortAsc.set(false); }
  }

  protected sortIcon(k: SortKey): string {
    if (this.sortKey() !== k) return 'updown';
    return this.sortAsc() ? 'up' : 'down';
  }

  protected exportCsv(): void {
    const rows = this.filtradas();
    const seMax = rows.reduce((m, r) => Math.max(m, r.se ?? 0), 0);

    // Metadados de cabeçalho — rastreabilidade da extração.
    const meta = [
      `# Radar de Arboviroses — extração de dados`,
      `# Doença: ${this.doenca()}`,
      `# Filtro região: ${this.regiaoFiltro() || 'todas'} · UF: ${this.ufFiltro() || 'todas'} · nível: ${this.nivelFiltro() || 'todos'}`,
      `# Última SE no recorte: ${seMax ? `${String(seMax).slice(4)}/${String(seMax).slice(0, 4)}` : '—'}`,
      `# Exportado em: ${new Date().toLocaleString('pt-BR')}`,
      `# Fonte: InfoDengue (Fiocruz/FGV) e IBGE`,
      '',
    ];
    const header = ['Geocode', 'Município', 'UF', 'Região', 'Pop.', 'Nível', 'Casos Est.', 'Inc/100k', 'Rt', 'SE'];
    const lines = rows.map(r => [
      r.geocode, r.nome, r.uf, r.regiao, r.pop ?? '',
      this.label[r.nivel ?? 0], r.casos_est?.toFixed(0) ?? '',
      r.p_inc100k?.toFixed(1) ?? '', r.rt?.toFixed(2) ?? '', r.se ?? '',
    ].join(','));
    const bom  = '﻿';
    const blob = new Blob([bom + meta.join('\n') + header.join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `radar_${this.doenca()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
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
