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
    isAuthenticated: !!this.cookies.get('JSESSIONID'),
    token: this.cookies.get('JSESSIONID') || null,
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
        this.cookies.set('vSessionId', res.result[0].vsessionid, 1, '/');
        this.cookies.set('authToken', res.result[0].authToken, 1, '/');
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
    this.cookies.delete('JSESSIONID', '/');
  }

  getToken(): string | null {
    // Always read from cookie to ensure latest value
    const token = this.cookies.get('JSESSIONID');
    this.state.update(s => ({ ...s, token, isAuthenticated: !!token }));
    return token || null;
  }
}
