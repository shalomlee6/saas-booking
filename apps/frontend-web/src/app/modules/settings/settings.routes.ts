import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'theme',
    loadComponent: () =>
      import('./pages/business-theme-settings/business-theme-settings.component').then(
        (m) => m.BusinessThemeSettingsComponent
      ),
  },
];
