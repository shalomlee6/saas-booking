import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { DataListPage, DataListQuery } from '../../../shared/data-management/entity-data-management-config';
import type { Service } from '../model/service';
import type { ServiceListRow } from '../model/service-list-row';
import type { CreateServiceDto } from '../dto/create-service.dto';
import type { UpdateServiceDto } from '../dto/update-service.dto';

@Injectable({ providedIn: 'root' })
export class ServicesApiService {
  private readonly api = inject(ApiService);

  listPage(query: DataListQuery): Observable<DataListPage<ServiceListRow>> {
    return this.api.get<DataListPage<ServiceListRow>>('services', {
      page: query.page,
      limit: query.limit,
      search: query.search,
      sort: query.sort,
      order: query.order,
      ...query.filters,
    });
  }

  exportCsv(query: DataListQuery): Observable<string> {
    return this.api.getText('services/export', {
      page: query.page,
      limit: query.limit,
      search: query.search,
      sort: query.sort,
      order: query.order,
      ...query.filters,
    });
  }

  bulkSetStatus(ids: string[], isActive: boolean): Observable<{ updated: number }> {
    return this.api.post<{ updated: number }>('services/bulk-status', { ids, isActive });
  }

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
