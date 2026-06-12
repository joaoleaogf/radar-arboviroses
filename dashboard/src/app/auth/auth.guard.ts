import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

export function authGuard(): boolean {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.loggedIn()) return true;
  router.navigate(['/auth/login']);
  return false;
}

export function adminGuard(): boolean {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin()) return true;
  router.navigate(['/app/dashboard']);
  return false;
}
