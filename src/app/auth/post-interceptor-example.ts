/**
 * Example usage of the POST HTTP Interceptor
 * 
 * This file demonstrates how the POST interceptor works and how to use it
 * in your Angular application.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

// Example service that uses POST requests
@Injectable({
  providedIn: 'root'
})
export class ExampleApiService {
  constructor(private http: HttpClient) {}

  // Example POST request - will be intercepted by postInterceptor
  createUser(userData: any): Observable<any> {
    return this.http.post('/api/users', userData);
  }

  // Example POST request with custom headers - will be intercepted
  updateUser(userId: string, userData: any): Observable<any> {
    return this.http.post(`/api/users/${userId}`, userData, {
      headers: {
        'Custom-Header': 'custom-value'
      }
    });
  }

  // Example POST request that will be excluded from interceptor
  login(credentials: any): Observable<any> {
    return this.http.post('/login', credentials);
  }

  // Example GET request - will NOT be intercepted by postInterceptor
  getUser(userId: string): Observable<any> {
    return this.http.get(`/api/users/${userId}`);
  }
}

/**
 * How the POST Interceptor Works:
 * 
 * 1. AUTOMATIC INTERCEPTION:
 *    - All POST requests are automatically intercepted
 *    - GET, PUT, DELETE requests are ignored
 * 
 * 2. EXCLUDED URLs:
 *    - /login, /register, /forgot-password are automatically excluded
 *    - You can customize excluded URLs in interceptor.config.ts
 * 
 * 3. AUTOMATIC FEATURES:
 *    - Authorization headers are added automatically if user is logged in
 *    - Content-Type: application/json is set automatically
 *    - Loading indicators are shown/hidden automatically
 *    - Request/response logging in development mode
 *    - Error handling with automatic redirect on 401 errors
 * 
 * 4. CONFIGURATION:
 *    - Modify DEFAULT_POST_CONFIG in interceptor.config.ts
 *    - Enable/disable logging, loading indicators, timeouts
 *    - Add custom headers, excluded URLs, retry attempts
 * 
 * 5. LOADING SERVICE:
 *    - Automatically tracks multiple concurrent requests
 *    - Shows loading indicator when requests are active
 *    - Hides loading indicator when all requests complete
 * 
 * Example of using the loading service in components:
 * 
 * ```typescript
 * import { LoadingService } from './auth/loading.service';
 * 
 * @Component({...})
 * export class MyComponent {
 *   isLoading$ = this.loadingService.loading$;
 *   
 *   constructor(private loadingService: LoadingService) {}
 * }
 * ```
 * 
 * ```html
 * <div *ngIf="isLoading$ | async" class="loading-spinner">
 *   Loading...
 * </div>
 * ```
 */
