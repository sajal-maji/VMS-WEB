import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'auth_token';
  readonly isAuthenticated = signal<boolean>(this.hasToken());

  constructor() {}

  private get localStorage(): Storage | null {
    return typeof window !== 'undefined' ? window.localStorage : null;
  }

  login(token: string): void {
    this.localStorage?.setItem(this.tokenKey, token);
    this.isAuthenticated.set(true);
  }

  logout(): void {
    this.localStorage?.removeItem(this.tokenKey);
    this.isAuthenticated.set(false);
  }

  getToken(): string | null {
    return this.localStorage?.getItem(this.tokenKey) ?? null;
  }

  hasToken(): boolean {
    return !!this.localStorage?.getItem(this.tokenKey);
  }
}
