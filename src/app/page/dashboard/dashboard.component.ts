import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="max-width:720px;margin:2rem auto;">
      <h2>Dashboard</h2>
      <p>You are logged in. This route is protected by an auth guard.</p>
      <button (click)="logout()" style="padding:0.5rem 1rem;">Logout</button>
    </div>
  `
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}


