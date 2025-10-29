import { CanActivate, Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

@Injectable({ providedIn: 'root' })
export class LoginGuard implements CanActivate {
  constructor(private router: Router, private cookie: CookieService) {}

  canActivate(): boolean {
    const isLoggedIn = !!this.cookie.get("vSessionId");
    if (isLoggedIn) {
      this.router.navigate(['ivmsweb/live_matrix']);
      return false;
    }
    return true;
  }
}
