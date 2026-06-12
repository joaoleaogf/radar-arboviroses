import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

interface Subscription {
  id: number;
  geocode: number | null;
  uf: string | null;
  regiao: string | null;
  doenca: string;
  nivel_minimo: number;
  canal: string;
  frequencia: string;
  rt_minimo: number | null;
  ativo: boolean;
  municipio_nome: string | null;
}

const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const UFS_POR_REGIAO: Record<string, string[]> = {
  'Norte':        ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste':     ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
  'Sudeste':      ['ES', 'MG', 'RJ', 'SP'],
  'Sul':          ['PR', 'RS', 'SC'],
};
const NIVEL_LABEL: Record<number, string> = { 1: 'Verde', 2: 'Amarelo', 3: 'Laranja', 4: 'Vermelho' };
const FREQ_LABEL: Record<string, string>  = { imediato: 'Imediato', diario: 'Diário', semanal: 'Semanal' };

@Component({
  selector: 'app-perfil',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  protected readonly auth = inject(AuthService);
  private  readonly http  = inject(HttpClient);
  private  readonly base  = environment.authBase;

  protected subs     = signal<Subscription[]>([]);
  protected editName = signal('');
  protected saving   = signal(false);
  protected savedOk  = signal(false);

  // Nova assinatura
  protected newRegiao    = '';
  protected newUf        = '';
  protected newGeocode   = '';
  protected newDoenca    = 'dengue';
  protected newNivel     = 3;
  protected newFreq      = 'imediato';
  protected newRtMinimo  = '';
  protected addingNova   = signal(false);
  protected showAdvanced = signal(false);

  protected readonly regioes      = REGIOES;
  protected readonly ufsPorRegiao = UFS_POR_REGIAO;
  protected readonly nivelLabel   = NIVEL_LABEL;
  protected readonly freqLabel    = FREQ_LABEL;

  protected get ufsDaRegiao(): string[] {
    return this.newRegiao ? (UFS_POR_REGIAO[this.newRegiao] ?? []) : [];
  }

  ngOnInit(): void {
    this.editName.set(this.auth.user()?.name ?? '');
    this.carregarSubs();
  }

  protected salvarPerfil(): void {
    if (!this.editName().trim()) return;
    this.saving.set(true);
    this.auth.updateProfile(this.editName()).subscribe({
      next: () => { this.saving.set(false); this.savedOk.set(true); setTimeout(() => this.savedOk.set(false), 2500); },
      error: () => this.saving.set(false),
    });
  }

  protected adicionarSub(): void {
    this.addingNova.set(true);
    const geocode = this.newGeocode ? parseInt(this.newGeocode) : undefined;
    const body = {
      geocode,
      uf:          !geocode && this.newUf ? this.newUf : undefined,
      regiao:      !geocode && !this.newUf && this.newRegiao ? this.newRegiao : undefined,
      doenca:      this.newDoenca,
      nivel_minimo: this.newNivel,
      canal:        'email',
      frequencia:   this.newFreq,
      rt_minimo:    this.newRtMinimo ? parseFloat(this.newRtMinimo) : undefined,
    };
    this.http.post<Subscription>(`${this.base}/subscriptions`, body).subscribe({
      next: (s) => {
        this.subs.update(arr => [s, ...arr]);
        this.newRegiao = ''; this.newUf = ''; this.newGeocode = '';
        this.newDoenca = 'dengue'; this.newNivel = 3;
        this.newFreq = 'imediato'; this.newRtMinimo = '';
        this.showAdvanced.set(false);
        this.addingNova.set(false);
      },
      error: () => this.addingNova.set(false),
    });
  }

  protected toggleSub(s: Subscription): void {
    this.http.patch<Subscription>(`${this.base}/subscriptions/${s.id}/toggle`, {}).subscribe(updated => {
      this.subs.update(arr => arr.map(x => x.id === s.id ? updated : x));
    });
  }

  protected removerSub(id: number): void {
    this.http.delete(`${this.base}/subscriptions/${id}`).subscribe(() => {
      this.subs.update(arr => arr.filter(x => x.id !== id));
    });
  }

  protected scopeLabel(s: Subscription): string {
    if (s.municipio_nome) return `${s.municipio_nome}/${s.uf ?? ''}`;
    if (s.uf) return `UF: ${s.uf}`;
    if (s.regiao) return s.regiao;
    return 'Todo o Brasil';
  }

  private carregarSubs(): void {
    this.http.get<Subscription[]>(`${this.base}/subscriptions`).subscribe(s => this.subs.set(s));
  }
}
