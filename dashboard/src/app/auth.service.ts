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

  constructor() {
    const saved = localStorage.getItem('radar_token');
    if (saved) {
      this.token.set(saved);
      this.me().subscribe({ error: () => this.clear() });
    }
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
    return this.http.get<User>(`${this.base}/auth/me`)
      .pipe(tap(u => this.user.set(u)));
  }

  updateProfile(name: string): Observable<User> {
    return this.http.put<User>(`${this.base}/auth/me`, { name })
      .pipe(tap(u => this.user.set(u)));
  }

  loginWithGoogle(): void {
    window.location.href = `${this.base}/auth/google`;
  }

  handleOAuthCallback(token: string): void {
    this.token.set(token);
    localStorage.setItem('radar_token', token);
    this.me().subscribe(() => this.router.navigate(['/app/dashboard']));
  }

  logout(): void {
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
