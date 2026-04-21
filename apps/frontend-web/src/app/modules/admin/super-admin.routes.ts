import { Routes } from '@angular/router';

export const SUPER_ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/super-admin-dashboard/super-admin-dashboard.component').then(
        (m) => m.SuperAdminDashboardComponent
      ),
  },
  {
    path: 'businesses',
    loadComponent: () =>
      import('./pages/business-customers/business-customers.component').then(
        (m) => m.BusinessCustomersComponent
      ),
  },
  {
    path: 'businesses/:id/ui',
    loadComponent: () =>
      import('./pages/business-ui-editor/business-ui-editor.component').then(
        (m) => m.BusinessUiEditorComponent
      ),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/admin-section-placeholder/admin-section-placeholder.component').then(
        (m) => m.AdminSectionPlaceholderComponent
      ),
    data: {
      adminTitle: 'Users',
      adminSubtitle: 'Platform accounts and roles (coming soon).',
    },
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/admin-section-placeholder/admin-section-placeholder.component').then(
        (m) => m.AdminSectionPlaceholderComponent
      ),
    data: {
      adminTitle: 'Analytics',
      adminSubtitle: 'Cross-tenant reports and KPIs (coming soon).',
    },
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./pages/admin-section-placeholder/admin-section-placeholder.component').then(
        (m) => m.AdminSectionPlaceholderComponent
      ),
    data: {
      adminTitle: 'Audit log',
      adminSubtitle: 'Security and impersonation events (coming soon).',
    },
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/admin-section-placeholder/admin-section-placeholder.component').then(
        (m) => m.AdminSectionPlaceholderComponent
      ),
    data: {
      adminTitle: 'System settings',
      adminSubtitle: 'Platform configuration (coming soon).',
    },
  },
];
