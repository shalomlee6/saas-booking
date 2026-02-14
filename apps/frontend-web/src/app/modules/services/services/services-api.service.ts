import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Service } from '../model/service';
import type { CreateServiceDto } from '../dto/create-service.dto';
import type { UpdateServiceDto } from '../dto/update-service.dto';

@Injectable({ providedIn: 'root' })
export class ServicesApiService {
  private readonly api = inject(ApiService);

  list(search?: string): Observable<Service[]> {
    const path = search ? `services?search=${encodeURIComponent(search)}` : 'services';
    return this.api.get<Service[]>(path);
  }

  getById(id: string): Observable<Service> {
    return this.api.get<Service>(`services/${id}`);
  }

  create(dto: CreateServiceDto): Observable<Service> {
    return this.api.post<Service>('services', dto);
  }

  update(id: string, dto: UpdateServiceDto): Observable<Service> {
    return this.api.put<Service>(`services/${id}`, dto);
  }
}
