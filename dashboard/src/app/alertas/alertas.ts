import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { NIVEL_HEX, NIVEL_LABEL } from '../nivel';

interface AlertaItem {
  geocode: number;
  nome: string;
  uf: string;
  regiao: string;
  doenca: string;
  nivel: number;
  casos_est: number;
  rt: number;
  p_inc100k: number;
  se: number;
}

@Component({
  selector: 'app-alertas',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alertas.html',
  styleUrl: './alertas.css',
})
export class Alertas implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  protected alertas   = signal<AlertaItem[]>([]);
  protected carregando = signal(true);
  protected doencaSel = signal<'dengue' | 'chikungunya'>('dengue');
  protected readonly hex   = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;

  ngOnInit(): void { this.carregar(); }

  protected trocar(d: 'dengue' | 'chikungunya'): void {
    this.doencaSel.set(d);
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.http.get<any>(`${this.base}/municipios`, { params: { doenca: this.doencaSel() } })
      .subscribe(fc => {
        const lista: AlertaItem[] = (fc.features ?? [])
          .map((f: any) => f.properties)
          .filter((p: any) => p.nivel >= 3)
          .sort((a: any, b: any) => b.nivel - a.nivel || (b.casos_est ?? 0) - (a.casos_est ?? 0));
        this.alertas.set(lista);
        this.carregando.set(false);
      });
  }
}
