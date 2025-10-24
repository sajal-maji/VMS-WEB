import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();
  let authorizedRequest: HttpRequest<unknown> = req;

  if (token) {
    authorizedRequest = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authorizedRequest).pipe(
    catchError(err => {
      if (err?.status === 401) {
        auth.logout();
        router.navigateByUrl('ivmsweb/login');
      }
      return throwError(() => err);
    })
  );
};


