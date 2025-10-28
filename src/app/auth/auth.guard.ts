import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { CookieService } from 'ngx-cookie-service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private cookies = inject(CookieService);

  canActivate(): boolean {
    // Read token from cookie (sessiontoken)
    const token = this.cookies.get('vSessionId');

    // Update AuthStore state accordingly
    if (token) {
      this.authStore.getToken(); // sync AuthStore
      return true;
    }

    // No token → redirect to login
    this.router.navigate(['ivmsweb/login']);
    return false;
  }
}
