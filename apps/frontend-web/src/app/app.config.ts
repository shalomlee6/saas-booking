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
import { mockApiInterceptor } from './core/api/mock-api.interceptor';
import { publicCustomerAuthInterceptor } from './modules/public/interceptors/public-customer-auth.interceptor';
import { environment } from '../environments/environment';
import {
  appointmentsFeatureKey,
  appointmentsReducer,
} from './modules/appointments/state/appointments.reducer';
import {
  loadAppointments$,
  createAppointment$
} from './modules/appointments/state/appointments.effects';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
    provideStore(),
    provideState(appointmentsFeatureKey, appointmentsReducer),
    provideEffects({
      loadAppointments$,
      createAppointment$
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
    provideHttpClient(
      withInterceptors(
        environment.useMocks
          ? [mockApiInterceptor, publicCustomerAuthInterceptor, authInterceptor]
          : [publicCustomerAuthInterceptor, authInterceptor]
      )
    ),
    provideRouter(routes),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return lastValueFrom(auth.init());
    }),
    // Required by PrimeNG until it supports Angular's animate.enter/leave (v23). See: https://github.com/primefaces/primeng/issues/18863
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          // Tie PrimeNG dark mode to the app's own .theme-dark body class
          // (managed by ThemeService) instead of the default 'system' which
          // reads @media (prefers-color-scheme: dark) and ignores the app class.
          darkModeSelector: '.theme-dark'
        }
      }
    })
  ],
};
