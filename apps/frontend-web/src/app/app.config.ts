import { isDevMode, LOCALE_ID } from '@angular/core';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
import { provideRouter, Router, withDisabledInitialNavigation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, lastValueFrom, of } from 'rxjs';
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor, unauthorizedInterceptor } from './core/api/http.config';
import { mockApiInterceptor } from './core/api/mock-api.interceptor';
import { publicCustomerAuthInterceptor } from './modules/public/interceptors/public-customer-auth.interceptor';
import { sessionRefreshInterceptor } from './core/api/session-refresh.interceptor';
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
import { definePreset } from '@primeuix/themes';

registerLocaleData(localeHe);

/**
 * PrimeNG's own primary palette (used internally by many component states — button
 * hover/active, tag backgrounds, focus rings, etc.) is independent of the app's
 * `--color-primary` custom property. Without this, components that don't explicitly
 * reference `--color-primary` fall back to Aura's default primitive palette (emerald),
 * which is why some controls showed up green instead of Boki pink. This maps PrimeNG's
 * entire primary scale to the brand color (#F35271) so every PrimeNG component matches.
 */
const BokiPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fef1f4',
      100: '#fde3e9',
      200: '#fbc7d3',
      300: '#f79fb4',
      400: '#f37b98',
      500: '#F35271',
      600: '#de3b5c',
      700: '#b92e4a',
      800: '#96263d',
      900: '#7a2233',
      950: '#43101b',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'he' },
    MessageService,
    provideStore(),
    provideState(appointmentsFeatureKey, appointmentsReducer),
    // Customers and services use injectable signal-based stores (customers.store.ts,
    // services.store.ts), not NgRx — no effects to register there.
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
          ? [
              mockApiInterceptor,
              publicCustomerAuthInterceptor,
              authInterceptor,
              sessionRefreshInterceptor,
              unauthorizedInterceptor,
            ]
          : [
              publicCustomerAuthInterceptor,
              authInterceptor,
              sessionRefreshInterceptor,
              unauthorizedInterceptor,
            ]
      )
    ),
    provideRouter(routes, withDisabledInitialNavigation()),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      const router = inject(Router);
      return lastValueFrom(auth.init().pipe(catchError(() => of(undefined)))).then(() => {
        router.initialNavigation();
      });
    }),
    // Required by PrimeNG until it supports Angular's animate.enter/leave (v23). See: https://github.com/primefaces/primeng/issues/18863
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: BokiPreset,
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
