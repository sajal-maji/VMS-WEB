import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root' // ensures the guard is available application-wide
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private auth: AuthService) {}

canActivate(): boolean {
  const isLoggedIn = !!localStorage.getItem('token'); // or your auth check
  if (!isLoggedIn) {
    this.router.navigate(['/login']);
    return false;
  }
  return true;
}
}