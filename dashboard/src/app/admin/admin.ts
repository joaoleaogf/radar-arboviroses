import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../environments/environment';

interface Stats { usuarios: number; municipios: number; casos: number; assinaturas: number; }
interface UserRow { id: string; email: string; name: string; role: string; created_at: string; last_login: string | null; subscriptions: number; }
interface EtlRun { id: number; workflow: string; started: string; finished: string | null; status: string; registros: number | null; erro: string | null; }

@Component({
  selector: 'app-admin',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = environment.authBase;

  protected stats   = signal<Stats | null>(null);
  protected users   = signal<UserRow[]>([]);
  protected etl     = signal<EtlRun[]>([]);
  protected aba     = signal<'stats' | 'users' | 'etl'>('stats');

  ngOnInit(): void {
    this.carregarStats();
    this.carregarUsers();
    this.carregarEtl();
  }

  protected toggleRole(u: UserRow): void {
    const novaRole = u.role === 'admin' ? 'user' : 'admin';
    this.http.patch<UserRow>(`${this.base}/admin/users/${u.id}/role`, { role: novaRole }).subscribe(updated => {
      this.users.update(list => list.map(x => x.id === u.id ? updated : x));
    });
  }

  protected fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  }

  private carregarStats(): void {
    this.http.get<Stats>(`${this.base}/admin/stats`).subscribe(s => this.stats.set(s));
  }

  private carregarUsers(): void {
    this.http.get<UserRow[]>(`${this.base}/admin/users`).subscribe(u => this.users.set(u));
  }

  private carregarEtl(): void {
    this.http.get<EtlRun[]>(`${this.base}/admin/etl`).subscribe(e => this.etl.set(e));
  }
}
