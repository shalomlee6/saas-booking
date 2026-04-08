import { createAction, props } from '@ngrx/store';
import type { Appointment } from '../model/appointment';
import type { CreateAppointmentDto } from '../dto/create-appointment.dto';
import type { AppointmentsListParams } from '../services/appointments-api.service';

export const load = createAction(
  '[Appointments] Load',
  props<{ params?: AppointmentsListParams }>()
);

export const loadSuccess = createAction(
  '[Appointments] Load Success',
  props<{ items: Appointment[] }>()
);

export const loadFailure = createAction(
  '[Appointments] Load Failure',
  props<{ error: string }>()
);

export const create = createAction(
  '[Appointments] Create',
  props<{ dto: CreateAppointmentDto }>()
);

export const createSuccess = createAction(
  '[Appointments] Create Success',
  props<{ item: Appointment }>()
);

export const createFailure = createAction(
  '[Appointments] Create Failure',
  props<{ error: string }>()
);

/** Clears create-time error so reopening the create overlay does not show a stale message. */
export const clearCreateError = createAction('[Appointments] Clear Create Error');
