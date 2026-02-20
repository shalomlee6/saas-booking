import { Routes } from '@angular/router';

export const CUSTOMER_LOGIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./customer-login.component').then((m) => m.CustomerLoginComponent),
  },
];
