import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of, tap } from 'rxjs';
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

export const createSuccessReload$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AppointmentsActions.createSuccess),
      map(() => AppointmentsActions.load({}))
    ),
  { functional: true }
);

export const createSuccessNavigate$ = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(AppointmentsActions.createSuccess),
      tap(() => router.navigate(['/appointments']))
    ),
  { functional: true, dispatch: false }
);
