import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { ApiService } from '../api/api.service';

export interface User {
  id: string;
  email: string;
  role: string;
  businessId?: string;
  businessSlug?: string;
}

export interface AuthMeResponse {
  user: User;
  business?: { _id: string; name: string; slug: string } | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  readonly user = signal<User | null>(null);
  readonly initialized = signal<boolean>(false);

  init(): Observable<void> {
    return this.api.get<AuthMeResponse>('auth/me').pipe(
      tap((res) => {
        this.user.set(res.user);
        this.initialized.set(true);
      }),
      map(() => undefined),
      catchError(() => {
        this.user.set(null);
        this.initialized.set(true);
        return of(undefined);
      })
    );
  }

  isLoggedIn(): boolean {
    return this.user() !== null;
  }

  isSuperAdmin(): boolean {
    return this.user()?.role === 'super_admin';
  }
}
