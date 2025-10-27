import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const token = authStore.getToken();

  const authorizedRequest = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedRequest).pipe(
    catchError(err => {
      if (err.status === 401) {
        authStore.logout();
        router.navigateByUrl('ivmsweb/login');
      }
      return throwError(() => err);
    })
  );
};
