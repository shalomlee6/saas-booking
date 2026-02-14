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
    path: 'working-hours',
    loadComponent: () =>
      import('./pages/working-hours-settings/working-hours-settings.component').then(
        (m) => m.WorkingHoursSettingsComponent
      ),
  },
];
