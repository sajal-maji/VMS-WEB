import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private cookies: CookieService,
    private router: Router,
  ) {}

  getToken(): string | null {
    return this.cookies.get('JSESSIONID') || null;
  }

  logout(): void {
    this.cookies.delete('vSessionId', '/');
    this.cookies.delete('authToken', '/');

    this.router.navigate(['/ivmsweb/login']);
  }
}
