import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { ApiService } from '../../../../../core/api/api.service';
import { AuthService } from '../../../../../core/auth/auth.service';

export type ResetScope = 'all' | 'design' | 'booking' | 'reliability' | 'customers';

export interface ResetStatus {
  available: boolean;
  scope?: ResetScope;
}

interface ResetResponse {
  scope: ResetScope;
  changed: boolean;
  restoreAvailable: boolean;
  status: ResetStatus;
}

/**
 * Factory reset and "restore previous settings". Settings only — the API never touches customers,
 * appointments, services, working hours, landing content or the account.
 */
@Injectable({ providedIn: 'root' })
export class SettingsResetService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Whether a snapshot can be restored right now, and which section it covers. */
  readonly status = signal<ResetStatus>({ available: false });
  /** Bumps after every reset or restore; section pages reload their values when it changes. */
  readonly version = signal(0);

  refresh(): void {
    this.api
      .get<ResetStatus>('settings/me/reset/status')
      .pipe(catchError(() => of<ResetStatus>({ available: false })))
      .subscribe((status) => this.status.set(status));
  }

  reset(scope: ResetScope, confirm?: string): Observable<ResetResponse> {
    return this.api
      .post<ResetResponse>('settings/me/reset', confirm === undefined ? { scope } : { scope, confirm })
      .pipe(tap((res) => this.afterChange(res.status)));
  }

  restore(): Observable<void> {
    return this.api
      .post<{ status: ResetStatus }>('settings/me/reset/restore', {})
      .pipe(
        tap((res) => this.afterChange(res.status)),
        map(() => undefined)
      );
  }

  private afterChange(status: ResetStatus): void {
    this.status.set(status);
    // The admin theme comes from /auth/me; reload it so the reset (or restore) shows everywhere.
    this.auth.init().subscribe(() => this.version.update((value) => value + 1));
  }
}
