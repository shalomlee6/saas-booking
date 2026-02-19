import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'business-customers',
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
];
