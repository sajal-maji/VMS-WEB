import { HttpInterceptorFn, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LoadingService } from './loading.service';
import { PostInterceptorConfig, DEFAULT_POST_CONFIG } from './interceptor.config';
import { catchError, tap, finalize, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const postInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const loadingService = inject(LoadingService);
  
  // Merge with default configuration
  const config: PostInterceptorConfig = { ...DEFAULT_POST_CONFIG };

  // Only intercept POST requests
  if (req.method !== 'POST') {
    return next(req);
  }

  // Check if URL should be excluded
  const shouldExclude = config.excludedUrls?.some(url => req.url.includes(url));
  
  if (shouldExclude) {
    return next(req);
  }

  // Get token for authorization
  const token = auth.getToken();
  let authorizedRequest: HttpRequest<unknown> = req;

  // Add authorization header and custom headers
  const headers: Record<string, string> = { ...config.customHeaders };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  authorizedRequest = req.clone({
    setHeaders: headers
  });

  // Log request (in development mode)
  if (config.enableLogging && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`POST Request: ${req.url}`, {
      method: req.method,
      headers: authorizedRequest.headers.keys(),
      body: req.body
    });
  }

  // Show loading indicator
  if (config.enableLoadingIndicator) {
    loadingService.show();
  }

  return next(authorizedRequest).pipe(
    timeout(config.timeout || 30000),
    tap((event) => {
      if (event instanceof HttpResponse) {
        // Log successful response
        if (config.enableLogging && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.log(`POST Response: ${req.url}`, {
            status: event.status,
            statusText: event.statusText,
            body: event.body
          });
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      // Log error
      if (config.enableLogging && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.error(`POST Error: ${req.url}`, {
          status: error.status,
          statusText: error.statusText,
          error: error.error,
          message: error.message
        });
      }

      // Handle different error scenarios
      switch (error.status) {
        case 401:
          // Unauthorized - redirect to login
          auth.logout();
          router.navigateByUrl('/login');
          break;
        case 403:
          // Forbidden - show access denied message
          console.warn('Access denied for this resource');
          break;
        case 404:
          // Not found
          console.warn('Resource not found');
          break;
        case 500:
          // Server error
          console.error('Internal server error occurred');
          break;
        case 0:
          // Network error
          console.error('Network error - please check your connection');
          break;
        default:
          console.error(`HTTP Error ${error.status}: ${error.statusText}`);
      }

      return throwError(() => error);
    }),
    finalize(() => {
      // Hide loading indicator
      if (config.enableLoadingIndicator) {
        loadingService.hide();
      }
    })
  );
};
