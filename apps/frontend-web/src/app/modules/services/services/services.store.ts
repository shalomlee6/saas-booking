import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type { Service } from '../model/service';
import type { CreateServiceDto } from '../dto/create-service.dto';
import type { UpdateServiceDto } from '../dto/update-service.dto';
import { ServicesApiService } from './services-api.service';

@Injectable({ providedIn: 'root' })
export class ServicesStore {
  private readonly api = inject(ServicesApiService);

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
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load services');
        this.loading.set(false);
      },
    });
  }

  create(dto: CreateServiceDto): Observable<Service> {
    this.error.set(null);
    return this.api.create(dto).pipe(
      tap({
        next: (created) => this.items.update((prev) => [created, ...prev]),
        error: (err) =>
          this.error.set(err?.error?.message || 'Failed to create service'),
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
        error: (err) =>
          this.error.set(err?.error?.message || 'Failed to update service'),
      })
    );
  }
}
