import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth      = inject(AuthService);
  const token     = auth.token();
  const isAuthApi = req.url.startsWith(environment.authBase);

  // withCredentials e Bearer header apenas para o auth-api.
  // Requisições ao n8n e outros serviços passam sem modificação
  // (n8n não aceita Access-Control-Allow-Credentials).
  if (!isAuthApi) return next(req);

  return next(req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  }));
};
