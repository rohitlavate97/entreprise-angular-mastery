import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './core/services/auth.service';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'users'
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users/user-list.component').then((m) => m.UserListComponent)
  },
  {
    path: 'transfers',
    loadComponent: () =>
      import('./features/transfers/transfer-form.component').then((m) => m.TransferFormComponent)
  }
];
