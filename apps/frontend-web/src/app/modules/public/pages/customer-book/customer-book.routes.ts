import { Routes } from '@angular/router';

export const CUSTOMER_BOOK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./customer-book-page.component').then(
        (m) => m.CustomerBookPageComponent
      ),
  },
];
