import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { DataManagementTableComponent } from '../../../../shared/data-management/data-management-table.component';
import type { DataListQuery } from '../../../../shared/data-management/entity-data-management-config';
import { ServicesApiService } from '../../services/services-api.service';
import { buildServiceTableConfig } from './service-list.config';

@Component({
  selector: 'app-services-list',
  standalone: true,
  imports: [DataManagementTableComponent],
  templateUrl: './services-list.component.html',
  styleUrl: './services-list.component.scss',
})
export class ServicesListComponent {
  private readonly api = inject(ServicesApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);

  readonly reloadNonce = signal(0);
  readonly loadPage = (query: DataListQuery) => this.api.listPage(query);

  readonly owner = computed(() => {
    const role = this.auth.user()?.role;
    if (role === 'owner') return true;
    return role === 'super_admin' && this.auth.isImpersonating();
  });

  readonly tableConfig = computed(() => {
    this.language.language();
    return buildServiceTableConfig({
      t: (key, params) => this.language.t(key, params),
      locale: this.language.intlLocale(),
      owner: this.owner(),
      onView: (row) => void this.router.navigate(['/services', row._id]),
      onEdit: (row) => void this.router.navigate(['/services', row._id, 'edit']),
      onSetActive: (row, isActive) => this.setOneActive(row._id, isActive),
      onCreate: () => void this.router.navigate(['/services', 'new']),
      onBulkSetActive: (rows, isActive) => this.setManyActive(rows.map((row) => row._id), isActive),
    });
  });

  onExport(query: DataListQuery): void {
    this.api.exportCsv(query).subscribe({
      next: (csv) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'services.csv';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: this.language.t('common.error'),
          detail: this.language.t('services.exportFailed'),
        });
      },
    });
  }

  private setOneActive(id: string, isActive: boolean): void {
    this.api.update(id, { isActive }).subscribe({
      next: () => this.reloadNonce.update((value) => value + 1),
      error: () => this.statusError(),
    });
  }

  private setManyActive(ids: string[], isActive: boolean): void {
    this.api.bulkSetStatus(ids, isActive).subscribe({
      next: () => this.reloadNonce.update((value) => value + 1),
      error: () => this.statusError(),
    });
  }

  private statusError(): void {
    this.messages.add({
      severity: 'error',
      summary: this.language.t('common.error'),
      detail: this.language.t('services.statusUpdateError'),
    });
  }
}
