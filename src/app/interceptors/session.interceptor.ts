import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const cookieService = inject(CookieService);

  // Get token from cookie or localStorage
  const vSessionId = cookieService.get('vSessionId') || localStorage.getItem('vSessionId');

  // Only attach if available
  if (vSessionId) {
    const cloned = req.clone({
      setHeaders: { vSessionId: vSessionId }
    });
    return next(cloned);
  }

  // Otherwise, forward the request as-is
  return next(req);
};
