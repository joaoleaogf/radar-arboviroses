import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth.service';

export function authGuard(): boolean | UrlTree | Observable<boolean | UrlTree> {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const check = (): boolean | UrlTree =>
    auth.loggedIn() ? true : router.createUrlTree(['/auth/login']);

  if (auth.initialized()) return check();

  // Aguarda a verificação inicial (cookie/token) antes de decidir
  return toObservable(auth.initialized).pipe(
    filter(v => v),
    take(1),
    map(() => check()),
  );
}

export function adminGuard(): boolean | UrlTree | Observable<boolean | UrlTree> {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const check = (): boolean | UrlTree => {
    if (!auth.loggedIn()) return router.createUrlTree(['/auth/login']);
    return auth.isAdmin() ? true : router.createUrlTree(['/app/dashboard']);
  };

  if (auth.initialized()) return check();

  return toObservable(auth.initialized).pipe(
    filter(v => v),
    take(1),
    map(() => check()),
  );
}
