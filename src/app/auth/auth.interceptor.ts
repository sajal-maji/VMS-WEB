import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Get JWT token (you can read from cookies or storage inside AuthService)
  const token = auth.getToken();

  // Clone request if token is available
  const authorizedRequest = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  // Handle the request and catch any 401 Unauthorized responses
  return next(authorizedRequest).pipe(
    catchError((err) => {
      if (err.status === 401) {
        // Optionally clear session data or cookies
        auth.logout();

        // Redirect to login
        router.navigateByUrl('/login');
      }

      return throwError(() => err);
    })
  );
};
