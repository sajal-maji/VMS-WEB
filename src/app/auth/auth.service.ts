import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private cookies: CookieService) {}

  getToken(): string | null {
    return this.cookies.get('JSESSIONID') || null;
  }

  logout(): void {
    this.cookies.delete('JSESSIONID');
  }
}
