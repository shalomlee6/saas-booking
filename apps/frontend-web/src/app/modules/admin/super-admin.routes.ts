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
      import('./pages/super-admin-users/super-admin-users.component').then(
        (m) => m.SuperAdminUsersComponent
      ),
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/super-admin-analytics/super-admin-analytics.component').then(
        (m) => m.SuperAdminAnalyticsComponent
      ),
  },
  {
    path: 'alerts',
    loadComponent: () =>
      import('./pages/super-admin-alerts/super-admin-alerts.component').then(
        (m) => m.SuperAdminAlertsComponent
      ),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./pages/super-admin-audit/super-admin-audit.component').then(
        (m) => m.SuperAdminAuditComponent
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/super-admin-settings/super-admin-settings.component').then(
        (m) => m.SuperAdminSettingsComponent
      ),
  },
];
