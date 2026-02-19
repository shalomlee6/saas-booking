import { createFeatureSelector, createSelector } from '@ngrx/store';
import { appointmentsFeatureKey, type AppointmentsState } from './appointments.reducer';

export const selectAppointmentsState = createFeatureSelector<AppointmentsState>(appointmentsFeatureKey);

export const selectItems = createSelector(
  selectAppointmentsState,
  (state) => state.items
);

export const selectLoading = createSelector(
  selectAppointmentsState,
  (state) => state.loading
);

export const selectError = createSelector(
  selectAppointmentsState,
  (state) => state.error
);

export const selectCreating = createSelector(
  selectAppointmentsState,
  (state) => state.creating
);
