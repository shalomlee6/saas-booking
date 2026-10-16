import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/business-settings/business-settings-shell.component').then(
        (m) => m.BusinessSettingsShellComponent
      ),
    children: [
      {
        path: 'design',
        loadComponent: () =>
          import('./pages/business-theme-settings/business-theme-settings.component').then(
            (m) => m.BusinessThemeSettingsComponent
          ),
      },
      {
        path: 'hours',
        loadComponent: () =>
          import('./pages/working-hours-list/working-hours-list.component').then(
            (m) => m.WorkingHoursListComponent
          ),
      },
      {
        path: 'booking',
        loadComponent: () =>
          import('./pages/business-settings/booking-rules-section.component').then(
            (m) => m.BookingRulesSectionComponent
          ),
      },
      {
        path: 'reliability',
        loadComponent: () =>
          import('./pages/business-settings/reliability-section.component').then(
            (m) => m.ReliabilitySectionComponent
          ),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./pages/business-settings/customers-section.component').then(
            (m) => m.CustomersSettingsSectionComponent
          ),
      },
      {
        path: 'policy',
        loadComponent: () =>
          import('./pages/business-settings/policy-section.component').then((m) => m.PolicySectionComponent),
      },
    ],
  },
  { path: 'theme', redirectTo: 'design', pathMatch: 'full' },
  { path: 'working-hours', redirectTo: 'hours', pathMatch: 'full' },
  {
    path: 'landing',
    loadComponent: () =>
      import('./pages/business-landing-settings/business-landing-settings.component').then(
        (m) => m.BusinessLandingSettingsComponent
      ),
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./pages/business-account-settings/business-account-settings.component').then(
        (m) => m.BusinessAccountSettingsComponent
      ),
  },
];
