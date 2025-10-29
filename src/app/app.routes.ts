import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { LoginGuard } from './auth/login.guard';

export const routes: Routes = [
  
  // login page (lazy-loaded)
  {
    path: 'ivmsweb/login',
    loadComponent: () =>
      import('./page/login/login.component').then((m) => m.LoginComponent),
    canActivate: [LoginGuard],
  },

  // dashboard page (lazy-loaded)
  {
  path: 'ivmsweb/live_matrix',
  loadComponent: () =>
    import('./page/dashboard/dashboard.component').then(m => m.DashboardComponent),
  canActivate: [AuthGuard],
},
  {
    path: 'ivmsweb/forgot-password',
    loadComponent: () =>
      import('./page/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'ivmsweb/set-password',
    loadComponent: () =>
      import('./page/set-password/set-password.component').then((m) => m.SetPasswordComponent),
  },
  {
    path: 'ivmsweb/user-details',
    loadComponent: () =>
      import('./page/user-details/user-details.component').then((m) => m.UserDetailsComponent),
  },
  
];
