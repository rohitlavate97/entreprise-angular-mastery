import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'users'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Sign In — Enterprise Mastery'
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
    title: 'User Profile & Security Context'
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users/user-list.component').then((m) => m.UserListComponent),
    canActivate: [authGuard],
    title: 'User Directory — Paginated Data Table'
  },
  {
    path: 'users/new',
    loadComponent: () =>
      import('./features/users/user-form.component').then((m) => m.UserFormComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_ADMIN'] },
    title: 'Create User — Async Validation'
  },
  {
    path: 'users/edit/:id',
    loadComponent: () =>
      import('./features/users/user-form.component').then((m) => m.UserFormComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_ADMIN'] },
    title: 'Edit User'
  },
  {
    path: 'transfers',
    loadComponent: () =>
      import('./features/transfers/transfer-form.component').then((m) => m.TransferFormComponent),
    canActivate: [authGuard],
    title: 'Wire Transfers — Idempotent Transactions'
  },
  {
    path: 'health',
    loadComponent: () =>
      import('./features/health/health-dashboard.component').then((m) => m.HealthDashboardComponent),
    title: 'System Telemetry'
  },
  {
    path: '**',
    redirectTo: 'users'
  }
];
