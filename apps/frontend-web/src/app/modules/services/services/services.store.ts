import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type { Service } from '../model/service';
import type { CreateServiceDto } from '../dto/create-service.dto';
import type { UpdateServiceDto } from '../dto/update-service.dto';
import { ServicesApiService } from './services-api.service';
import { LanguageService } from '../../../core/i18n/language.service';

@Injectable({ providedIn: 'root' })
export class ServicesStore {
  private readonly api = inject(ServicesApiService);
  private readonly language = inject(LanguageService);

  readonly items = signal<Service[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(search?: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(search).subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.language.t('services.loadError'));
        this.loading.set(false);
      },
    });
  }

  create(dto: CreateServiceDto): Observable<Service> {
    this.error.set(null);
    return this.api.create(dto).pipe(
      tap({
        next: (created) => this.items.update((prev) => [created, ...prev]),
        error: () => this.error.set(this.language.t('services.createError')),
      })
    );
  }

  update(id: string, dto: UpdateServiceDto): Observable<Service> {
    this.error.set(null);
    return this.api.update(id, dto).pipe(
      tap({
        next: (updated) =>
          this.items.update((prev) =>
            prev.map((s) => (s._id === id ? updated : s))
          ),
        error: () => this.error.set(this.language.t('services.updateError')),
      })
    );
  }
}
