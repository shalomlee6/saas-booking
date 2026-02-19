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
  on(AppointmentsActions.createSuccess, (state, { item }) => ({
    ...state,
    items: [item, ...state.items],
    creating: false,
    error: null,
  })),
  on(AppointmentsActions.createFailure, (state, { error }) => ({
    ...state,
    creating: false,
    error,
  }))
);
