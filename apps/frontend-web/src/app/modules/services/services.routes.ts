import { Routes } from '@angular/router';

export const SERVICES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/services-list/services-list.component').then(
        (m) => m.ServicesListComponent
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/service-form/service-form.component').then(
        (m) => m.ServiceFormComponent
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/service-form/service-form.component').then(
        (m) => m.ServiceFormComponent
      ),
  },
];
