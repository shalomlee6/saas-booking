import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';
import { AppointmentsApiService } from '../services/appointments-api.service';
import * as AppointmentsActions from './appointments.actions';

export const loadAppointments$ = createEffect(
  (actions$ = inject(Actions), api = inject(AppointmentsApiService)) =>
    actions$.pipe(
      ofType(AppointmentsActions.load),
      mergeMap(({ params }) =>
        api.list(params).pipe(
          map((items) => AppointmentsActions.loadSuccess({ items })),
          catchError((err) =>
            of(
              AppointmentsActions.loadFailure({
                error: err?.error?.message || 'Failed to load appointments',
              })
            )
          )
        )
      )
    ),
  { functional: true }
);

export const createAppointment$ = createEffect(
  (actions$ = inject(Actions), api = inject(AppointmentsApiService)) =>
    actions$.pipe(
      ofType(AppointmentsActions.create),
      mergeMap(({ dto }) =>
        api.create(dto).pipe(
          map((item) => AppointmentsActions.createSuccess({ item })),
          catchError((err) =>
            of(
              AppointmentsActions.createFailure({
                error: err?.error?.message || 'Failed to create appointment',
              })
            )
          )
        )
      )
    ),
  { functional: true }
);

// createSuccessReload$ was removed: the component's onAppointmentCreated() already calls
// loadForCurrentView() with the correct date params. The old effect dispatched load({})
// with no params, causing a redundant second API call that could overwrite the ranged results.
