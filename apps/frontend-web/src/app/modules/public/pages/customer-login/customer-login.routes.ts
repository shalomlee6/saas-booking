import { Routes } from '@angular/router';
import { publicGuestGuard } from '../../guards/public-guest.guard';

export const CUSTOMER_LOGIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [publicGuestGuard],
    loadComponent: () =>
      import('./customer-login.component').then((m) => m.CustomerLoginComponent),
  },
];
