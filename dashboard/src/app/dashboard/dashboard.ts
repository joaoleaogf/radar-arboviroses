import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Doenca, FilterParams, MunicipioProps, RadarService, Resumo, TopAlerta } from '../radar.service';
import { Mapa } from '../mapa/mapa';
import { Serie } from '../serie/serie';
import { NIVEL_HEX, NIVEL_LABEL } from '../nivel';
import { REGIOES, UFS_POR_REGIAO, UF_NOME } from '../core/geo';
import { dataDaSeFormatada, formatarSEBadge } from '../core/se';
import { KpiCard } from '../ui/kpi-card';
import { NivelBadge } from '../ui/nivel-badge';
import { Skeleton, EmptyState, ErrorState } from '../ui/states';

export type TipoMapa = 'alerta' | 'incidencia';

@Component({
  selector: 'app-dashboard',
  imports: [Mapa, Serie, DecimalPipe, RouterLink, KpiCard, NivelBadge, Skeleton, EmptyState, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly radar = inject(RadarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly doenca    = signal<Doenca>('dengue');
  protected readonly resumo    = signal<Resumo | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro      = signal(false);
  protected readonly selecionado = signal<MunicipioProps | null>(null);
  protected readonly regiaoSel = signal<string | null>(null);
  protected readonly ufSel     = signal<string | null>(null);
  protected readonly tipoMapa  = signal<TipoMapa>('alerta');
  protected readonly metricaSerie = signal<'casos' | 'incidencia'>('casos');

  protected readonly regioes   = REGIOES;
  protected readonly hex       = NIVEL_HEX;
  protected readonly label     = NIVEL_LABEL;

  protected readonly ufsDaRegiao = computed(() => {
    const r = this.regiaoSel();
    return r ? (UFS_POR_REGIAO[r] ?? []) : [];
  });

  /** Série de totais semanais recentes (para sparkline). */
  protected readonly sparkCasos = computed<number[]>(() =>
    (this.resumo()?.serie_recente ?? []).map(p => p.casos_est ?? 0),
  );

  /** Variação % de casos est. na última semana vs. a anterior. */
  protected readonly deltaCasos = computed<number | null>(() => {
    const s = this.resumo()?.serie_recente;
    if (!s || s.length < 2) return null;
    const atual = s[s.length - 1]?.casos_est ?? 0;
    const ant   = s[s.length - 2]?.casos_est ?? 0;
    if (ant === 0) return null;
    return ((atual - ant) / ant) * 100;
  });

  /** Dados são considerados desatualizados se a última carga tem mais de 8 dias. */
  protected readonly dadosDesatualizados = computed<boolean>(() => {
    const iso = this.resumo()?.ultima_carga;
    if (!iso) return false;
    const dias = (Date.now() - new Date(iso).getTime()) / 86_400_000;
    return dias > 8;
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
    // Hidrata o estado a partir dos query params (visões compartilháveis).
    const q = this.route.snapshot.queryParamMap;
    const d = q.get('doenca');
    if (d === 'dengue' || d === 'chikungunya') this.doenca.set(d);
    const reg = q.get('regiao');
    if (reg && (REGIOES as readonly string[]).includes(reg)) this.regiaoSel.set(reg);
    const uf = q.get('uf');
    if (uf && this.regiaoSel() && (UFS_POR_REGIAO[this.regiaoSel()!] ?? []).includes(uf)) this.ufSel.set(uf);
    const tm = q.get('mapa');
    if (tm === 'alerta' || tm === 'incidencia') this.tipoMapa.set(tm);

    // Reflete o estado atual na URL para que a visão seja compartilhável.
    effect(() => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          doenca: this.doenca(),
          regiao: this.regiaoSel() ?? null,
          uf: this.ufSel() ?? null,
          mapa: this.tipoMapa() === 'alerta' ? null : this.tipoMapa(),
        },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

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
    return formatarSEBadge(this.resumo()?.ultima_se);
  }

  protected semana(): string {
    return dataDaSeFormatada(this.resumo()?.ultima_se);
  }

  protected recarregar(): void {
    this.carregarResumo();
  }

  private carregarResumo(): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.radar.resumo(this.doenca(), this.filtro()).subscribe({
      next: (r: Resumo) => {
        this.resumo.set(r);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }
}
