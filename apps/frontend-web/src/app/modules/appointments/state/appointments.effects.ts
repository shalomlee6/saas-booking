import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, switchMap } from 'rxjs';
import { friendlyOwnerAppointmentError } from '../../../shared/utils/http-field-errors.util';
import { AppointmentsApiService } from '../services/appointments-api.service';
import * as AppointmentsActions from './appointments.actions';

export const loadAppointments$ = createEffect(
  (actions$ = inject(Actions), api = inject(AppointmentsApiService)) =>
    actions$.pipe(
      ofType(AppointmentsActions.load),
      // switchMap cancels any in-flight request when a new load action arrives,
      // preventing stale responses from overwriting fresher data.
      switchMap(({ params }) =>
        api.list(params).pipe(
          map((items) => AppointmentsActions.loadSuccess({ items })),
          catchError((err) =>
            of(
              AppointmentsActions.loadFailure({
                error: friendlyOwnerAppointmentError(err),
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
      // Ignore further create actions until the current request finishes (no parallel POSTs).
      exhaustMap(({ dto }) =>
        api.create(dto).pipe(
          map((item) => AppointmentsActions.createSuccess({ item })),
          catchError((err) =>
            of(
              AppointmentsActions.createFailure({
                error: friendlyOwnerAppointmentError(err),
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
