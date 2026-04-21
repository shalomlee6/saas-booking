import { Routes } from '@angular/router';

export const APPOINTMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/appointments-list/appointments-list.component').then(
        (m) => m.AppointmentsListComponent
      )
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/appointment-form/appointment-form.component').then(
        (m) => m.AppointmentFormComponent
      )
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/edit-appointment/edit-appointment.component').then(
        (m) => m.EditAppointmentComponent
      )
  },
];
