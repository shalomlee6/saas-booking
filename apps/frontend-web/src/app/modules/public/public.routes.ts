import { Routes } from '@angular/router';
import { publicAuthHydrateResolver } from './resolvers/public-auth-hydrate.resolver';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    resolve: { publicAuthHydrated: publicAuthHydrateResolver },
    loadComponent: () =>
      import('./layout/public-layout.component').then((m) => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./booking/public-landing.component').then(
            (m) => m.PublicLandingComponent
          ),
      },
      {
        path: 'login',
        loadChildren: () =>
          import('./pages/customer-login/customer-login.routes').then(
            (m) => m.CUSTOMER_LOGIN_ROUTES
          ),
      },
      {
        path: 'book',
        loadChildren: () =>
          import('./pages/customer-book/customer-book.routes').then(
            (m) => m.CUSTOMER_BOOK_ROUTES
          ),
      },
    ],
  },
];
