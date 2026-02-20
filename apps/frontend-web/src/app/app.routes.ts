import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { superAdminGuard } from './core/auth/guards/super-admin.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'b/:slug',
    loadChildren: () =>
      import('./modules/public/public.routes').then((m) => m.PUBLIC_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./modules/dashboard/dashboard.routes').then(
            (m) => m.DASHBOARD_ROUTES
          ),
      },
      {
        path: 'appointments',
        loadChildren: () =>
          import('./modules/appointments/appointments.routes').then(
            (m) => m.APPOINTMENTS_ROUTES
          ),
      },
      {
        path: 'services',
        loadChildren: () =>
          import('./modules/services/services.routes').then(
            (m) => m.SERVICES_ROUTES
          ),
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('./modules/customers/customers.routes').then(
            (m) => m.CUSTOMERS_ROUTES
          ),
      },
      {
        path: 'admin',
        canActivate: [superAdminGuard],
        loadChildren: () =>
          import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./modules/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'preview/customer-site',
        loadComponent: () =>
          import('./modules/public/pages/customer-site-preview/customer-site-preview.component').then(
            (m) => m.CustomerSitePreviewComponent
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
