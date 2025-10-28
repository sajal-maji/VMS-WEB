import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../environments/environment.development';
import { Router } from '@angular/router';

export interface LoginRequest {
  userid: string;
  password: string;
}

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly cookies = inject(CookieService);
  constructor(private readonly router: Router) {}
  private readonly state: WritableSignal<AuthState> = signal<AuthState>({
    isLoading: false,
    isAuthenticated: !!this.cookies.get('vSessionId'),
    token: this.cookies.get('vSessionId') || null,
    error: null
  });

  readonly isLoading: Signal<boolean> = computed(() => this.state().isLoading);
  readonly isAuthenticated: Signal<boolean> = computed(() => this.state().isAuthenticated);
  readonly error: Signal<string | null> = computed(() => this.state().error);
  readonly token: Signal<string | null> = computed(() => this.state().token);

  login(credentials: LoginRequest): void {
    if (this.state().isLoading) return;
    this.state.update(s => ({ ...s, isLoading: true, error: null }));

    const url = `${environment.apiBaseUrl}user/login/web`;
    this.http.post<{ token: string }>(url, credentials, { withCredentials: true }).subscribe({
      next: (res:any) => {
        this.state.set({
          isLoading: false,
          isAuthenticated: true,
          token: res.result[0].vsessionid,
          error: null
        });
        // Set JWT token in cookie, valid for 1 day
         if (res.result[0].vsessionId) {
        // ✅ Set cookie manually in browser
        document.cookie = `JSESSIONID=${res.result[0].vsessionId}; Path=/; Secure; SameSite=None`;
      }
       this.cookies.set('JSESSIONID', res.result[0].vsessionId, undefined, '/', '127.0.0.1', true, 'Strict');
        this.router.navigate(["ivmsweb/live_matrix"])
      },
      error: (err) => {
        const message = err?.error?.message || 'Login failed';
        this.state.set({
          isLoading: false,
          isAuthenticated: false,
          token: null,
          error: message
        });
      }
    });
  }

  logout(): void {
    this.state.set({
      isLoading: false,
      isAuthenticated: false,
      token: null,
      error: null
    });
    // Remove JWT token from cookie
    this.cookies.delete('vSessionId', '/');
    localStorage.removeItem('vSessionId');
  }

  getToken(): string | null {
    // Always read from cookie to ensure latest value
    let token = this.cookies.get('vSessionId');
    if (!token) {
      token = localStorage.getItem('vSessionId') || '';
    }
    this.state.update(s => ({ ...s, token, isAuthenticated: !!token }));
    return token || null;
  }
}
