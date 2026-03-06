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
  on(AppointmentsActions.createSuccess, (state, { item }) => {
    const raw = item as { start?: string | Date; end?: string | Date };
    const normalized: Appointment = {
      ...item,
      start: new Date(raw.start as string | number | Date),
      end: new Date(raw.end as string | number | Date),
    };
    return {
      ...state,
      items: [normalized, ...state.items],
      creating: false,
      error: null,
    };
  }),
  on(AppointmentsActions.createFailure, (state, { error }) => ({
    ...state,
    creating: false,
    error,
  }))
);
