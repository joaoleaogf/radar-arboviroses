import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth-layout/auth-layout').then(m => m.AuthLayout),
    children: [
      { path: 'login',    loadComponent: () => import('./auth/login/login').then(m => m.Login) },
      { path: 'register', loadComponent: () => import('./auth/register/register').then(m => m.Register) },
      { path: 'callback', loadComponent: () => import('./auth/callback/callback').then(m => m.Callback) },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    // Layout público — sem authGuard no pai.
    // Perfil e Admin têm guards individuais.
    path: 'app',
    loadComponent: () => import('./layout/layout').then(m => m.Layout),
    children: [
      { path: 'dashboard',  loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'analise',    loadComponent: () => import('./analise/analise').then(m => m.Analise) },
      { path: 'relatorios', loadComponent: () => import('./relatorios/relatorios').then(m => m.Relatorios) },
      { path: 'alertas',    loadComponent: () => import('./alertas/alertas').then(m => m.Alertas) },
      { path: 'perfil',     canActivate: [authGuard], loadComponent: () => import('./perfil/perfil').then(m => m.Perfil) },
      { path: 'admin',      canActivate: [authGuard, adminGuard], loadComponent: () => import('./admin/admin').then(m => m.Admin) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/app/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/app/dashboard' },
];
