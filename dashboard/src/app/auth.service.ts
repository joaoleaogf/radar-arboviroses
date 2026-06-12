import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../environments/environment';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  email_verified: boolean;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  last_login: string | null;
}

interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base   = environment.authBase;

  readonly user     = signal<User | null>(null);
  readonly token    = signal<string | null>(null);
  readonly isAdmin  = computed(() => this.user()?.role === 'admin');
  readonly loggedIn = computed(() => !!this.user());

  // Verdadeiro quando a verificação inicial (cookie / localStorage) terminou.
  // Evita redirect para /login no F5 enquanto o /auth/me ainda está em voo.
  private readonly _initialized = signal(false);
  readonly initialized = this._initialized.asReadonly();

  constructor() {
    const saved = localStorage.getItem('radar_token');
    if (saved) this.token.set(saved);
    this.me().subscribe({
      next: () => this._initialized.set(true),
      error: () => { this.clear(); this._initialized.set(true); },
    });
  }

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, { name, email, password })
      .pipe(tap(r => this.save(r)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, { email, password })
      .pipe(tap(r => this.save(r)));
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.base}/auth/me`, { withCredentials: true })
      .pipe(tap(u => this.user.set(u)));
  }

  updateProfile(data: { name?: string; phone?: string }): Observable<User> {
    return this.http.put<User>(`${this.base}/auth/me`, data)
      .pipe(tap(u => this.user.set(u)));
  }

  handleOAuthCallback(token: string): void {
    this.token.set(token);
    localStorage.setItem('radar_token', token);
    this.me().subscribe(() => this.router.navigate(['/app/dashboard']));
  }

  logout(): void {
    this.http.post(`${this.base}/auth/logout`, {}).subscribe();
    this.clear();
    this.router.navigate(['/auth/login']);
  }

  private save(r: AuthResponse): void {
    this.token.set(r.token);
    this.user.set(r.user);
    localStorage.setItem('radar_token', r.token);
  }

  private clear(): void {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem('radar_token');
  }
}
