import { createReducer, on } from '@ngrx/store';
import type { Appointment } from '../model/appointment';
import * as AppointmentsActions from './appointments.actions';

export const appointmentsFeatureKey = 'appointments';

export interface AppointmentsState {
  items: Appointment[];
  loading: boolean;
  creating: boolean;
  error: string | null;
}

export const initialState: AppointmentsState = {
  items: [],
  loading: false,
  creating: false,
  error: null,
};

export const appointmentsReducer = createReducer(
  initialState,
  on(AppointmentsActions.load, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(AppointmentsActions.loadSuccess, (state, { items }) => ({
    ...state,
    items,
    loading: false,
    error: null,
  })),
  on(AppointmentsActions.loadFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(AppointmentsActions.create, (state) => ({
    ...state,
    creating: true,
    error: null,
  })),
  // createSuccess intentionally does NOT add the raw backend document to state.items.
  // The backend returns a Mongoose doc without populated service/customer names, so
  // adding it would cause a flash of incomplete data in the calendar. Instead we
  // just clear the creating flag; the component's onAppointmentCreated() fires
  // immediately after and calls loadForCurrentView(), which reloads the list with
  // fully-populated appointments.
  on(AppointmentsActions.createSuccess, (state) => ({
    ...state,
    creating: false,
    error: null,
  })),
  on(AppointmentsActions.createFailure, (state, { error }) => ({
    ...state,
    creating: false,
    error,
  }))
);
