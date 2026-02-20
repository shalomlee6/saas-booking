import { Routes } from '@angular/router';

export const CUSTOMER_BOOK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./customer-book.component').then((m) => m.CustomerBookComponent),
  },
];
