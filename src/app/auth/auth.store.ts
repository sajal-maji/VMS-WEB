import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

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

  private readonly state: WritableSignal<AuthState> = signal<AuthState>({
    isLoading: false,
    isAuthenticated: false,
    token: null,
    error: null
  });

  readonly isLoading: Signal<boolean> = computed(() => this.state().isLoading);
  readonly isAuthenticated: Signal<boolean> = computed(() => this.state().isAuthenticated);
  readonly error: Signal<string | null> = computed(() => this.state().error);

  login(credentials: LoginRequest): void {
    if (this.state().isLoading) return;
    this.state.update(s => ({ ...s, isLoading: true, error: null }));

    const url = `${environment.apiBaseUrl}user/login/web `; // adjust endpoint as needed
    this.http.post<{ token: string }>(url, credentials).subscribe({
      next: (res) => {
        this.state.set({ isLoading: false, isAuthenticated: true, token: res.token, error: null });
      },
      error: (err) => {
        const message = err?.error?.message || 'Login failed';
        this.state.set({ isLoading: false, isAuthenticated: false, token: null, error: message });
      }
    });
  }

  logout(): void {
    this.state.set({ isLoading: false, isAuthenticated: false, token: null, error: null });
  }
}


