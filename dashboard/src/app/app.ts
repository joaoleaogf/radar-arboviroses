import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Doenca, FilterParams, MunicipioProps, RadarService, Resumo, TopAlerta } from './radar.service';
import { Mapa } from './mapa/mapa';
import { Serie } from './serie/serie';
import { NIVEL_HEX, NIVEL_LABEL } from './nivel';

export type TipoMapa = 'alerta' | 'incidencia';

const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'] as const;

const UFS_POR_REGIAO: Record<string, string[]> = {
  'Norte':        ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste':     ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
  'Sudeste':      ['ES', 'MG', 'RJ', 'SP'],
  'Sul':          ['PR', 'RS', 'SC'],
};

const UF_NOME: Record<string, string> = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia',
  CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
  MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais',
  PA:'Pará', PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí',
  RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul',
  RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo',
  SE:'Sergipe', TO:'Tocantins',
};

@Component({
  selector: 'app-root',
  imports: [Mapa, Serie, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly radar = inject(RadarService);

  protected readonly doenca    = signal<Doenca>('dengue');
  protected readonly resumo    = signal<Resumo | null>(null);
  protected readonly selecionado = signal<MunicipioProps | null>(null);
  protected readonly regiaoSel = signal<string | null>(null);
  protected readonly ufSel     = signal<string | null>(null);
  protected readonly tipoMapa  = signal<TipoMapa>('alerta');

  protected readonly regioes   = REGIOES;
  protected readonly hex       = NIVEL_HEX;
  protected readonly label     = NIVEL_LABEL;

  protected readonly ufsDaRegiao = computed(() => {
    const r = this.regiaoSel();
    return r ? (UFS_POR_REGIAO[r] ?? []) : [];
  });

  protected readonly filtro = computed<FilterParams>(() => ({
    uf:     this.ufSel()     ?? undefined,
    regiao: this.ufSel()     ? undefined : (this.regiaoSel() ?? undefined),
  }));

  protected readonly contexto = computed(() => {
    const uf = this.ufSel();
    if (uf) return UF_NOME[uf] ?? uf;
    const r = this.regiaoSel();
    return r ?? 'Brasil';
  });

  constructor() {
    this.carregarResumo();
  }

  protected trocarDoenca(d: Doenca): void {
    if (d === this.doenca()) return;
    this.doenca.set(d);
    this.selecionado.set(null);
    this.carregarResumo();
  }

  protected selecionarRegiao(r: string | null): void {
    if (r !== null && r === this.regiaoSel()) {
      this.regiaoSel.set(null);
      this.ufSel.set(null);
    } else {
      this.regiaoSel.set(r);
      this.ufSel.set(null);
    }
    this.carregarResumo();
  }

  protected selecionarUf(uf: string): void {
    this.ufSel.set(uf === this.ufSel() ? null : uf);
    this.carregarResumo();
  }

  protected onSelecionar(m: MunicipioProps): void {
    this.selecionado.set(m);
  }

  protected onSelecionarAlerta(t: TopAlerta): void {
    this.selecionado.set({
      geocode: t.geocode, nome: t.nome, nivel: t.nivel,
      casos_est: t.casos_est, rt: t.rt,
      uf: null, regiao: null, casos: null, pop: null, se: null, p_inc100k: null,
    });
  }

  protected dataCarga(): string {
    const iso = this.resumo()?.ultima_carga;
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected semanaNum(): string {
    const se = this.resumo()?.ultima_se;
    return se ? `SE ${String(se).slice(4)} · ${String(se).slice(0, 4)}` : '—';
  }

  protected semana(): string {
    const se = this.resumo()?.ultima_se;
    if (!se) return '—';
    const d = this.seParaData(se);
    if (!d) return '—';
    const m = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    return `${d.getUTCDate()} ${m[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  private seParaData(se: number): Date | null {
    if (!se) return null;
    const ano  = Math.floor(se / 100);
    const sem  = se % 100;
    const jan4 = new Date(Date.UTC(ano, 0, 4));
    const inicioSem1 = new Date(jan4);
    inicioSem1.setUTCDate(jan4.getUTCDate() - jan4.getUTCDay());
    const inicio = new Date(inicioSem1);
    inicio.setUTCDate(inicioSem1.getUTCDate() + (sem - 1) * 7);
    return inicio;
  }

  private carregarResumo(): void {
    this.radar.resumo(this.doenca(), this.filtro()).subscribe((r) => this.resumo.set(r));
  }
}
