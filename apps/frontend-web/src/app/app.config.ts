import { isDevMode } from '@angular/core';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/api/http.config';
import {
  appointmentsFeatureKey,
  appointmentsReducer,
} from './modules/appointments/state/appointments.reducer';
import {
  loadAppointments$,
  createAppointment$,
  createSuccessReload$,
  createSuccessNavigate$,
} from './modules/appointments/state/appointments.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(),
    provideState(appointmentsFeatureKey, appointmentsReducer),
    provideEffects({
      loadAppointments$,
      createAppointment$,
      createSuccessReload$,
      createSuccessNavigate$,
    }),
    ...(isDevMode()
      ? [
          provideStoreDevtools({
            maxAge: 25,
            logOnly: false,
          }),
        ]
      : []),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return lastValueFrom(auth.init());
    }),
  ],
};
