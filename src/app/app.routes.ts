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
    path: 'ivmsweb/live-matrix',
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
    canActivate: [AuthGuard],
  },
   {
    path: 'ivmsweb/event-search',
    loadComponent: () =>
      import('./page/event-search/event-search/event-search.component').then((m) => m.EventSearchComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'ivmsweb/not-found',
    loadComponent: () => 
      import('./page/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
  {
    path: 'ivmsweb/archive-matrix',
    loadComponent: () => 
      import('./page/archive/archive.component').then((m) => m.ArchiveComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'ivmsweb/change-password',
    loadComponent: () => 
      import('./page/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
    canActivate: [AuthGuard],
  },

  
];
