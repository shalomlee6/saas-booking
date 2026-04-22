import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'theme',
    loadComponent: () =>
      import('./pages/business-theme-settings/business-theme-settings.component').then(
        (m) => m.BusinessThemeSettingsComponent
      ),
  },
  {
    path: 'landing',
    loadComponent: () =>
      import('./pages/business-landing-settings/business-landing-settings.component').then(
        (m) => m.BusinessLandingSettingsComponent
      ),
  },
  {
    path: 'working-hours',
    loadComponent: () =>
      import('./pages/working-hours-list/working-hours-list.component').then(
        (m) => m.WorkingHoursListComponent
      ),
  },
  {
    path: 'working-hours/:dayKey',
    loadComponent: () =>
      import('./pages/working-hours-edit/working-hours-edit.component').then(
        (m) => m.WorkingHoursEditComponent
      ),
  },
];
