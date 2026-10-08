import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { DataManagementTableComponent } from '../../../../shared/data-management/data-management-table.component';
import type { DataListQuery } from '../../../../shared/data-management/entity-data-management-config';
import type { CustomerListRow } from '../../model/customer-list-row';
import { CustomersApiService } from '../../services/customers-api.service';
import { ServicesApiService } from '../../../services/services/services-api.service';
import { buildCustomerTableConfig } from './customer-list.config';

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [TranslatePipe, FormsModule, DialogModule, DataManagementTableComponent],
  templateUrl: './customers-list.component.html',
  styleUrl: './customers-list.component.scss',
})
export class CustomersListComponent implements OnInit {
  private readonly api = inject(CustomersApiService);
  private readonly servicesApi = inject(ServicesApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);

  readonly reloadNonce = signal(0);
  readonly policyOpen = signal(false);
  readonly policyEnabled = signal(true);
  readonly policyThreshold = signal(3);
  readonly policySaving = signal(false);
  private readonly services = signal<{ id: string; name: string }[]>([]);

  readonly loadPage = (query: DataListQuery) => this.api.listPage(query);

  readonly owner = computed(() => {
    const role = this.auth.user()?.role;
    if (role === 'owner') return true;
    return role === 'super_admin' && this.auth.isImpersonating();
  });

  readonly tableConfig = computed(() => {
    this.language.language();
    return buildCustomerTableConfig({
      t: (key) => this.language.t(key),
      locale: this.language.intlLocale(),
      owner: this.owner(),
      services: this.services(),
      onView: (row) => void this.router.navigate(['/customers', row._id]),
      onEdit: (row) => void this.router.navigate(['/customers', row._id], { queryParams: { edit: '1' } }),
      onBook: (row) => void this.router.navigate(['/appointments', 'new'], { queryParams: { customerId: row._id } }),
      onSetActive: (row, isActive) => this.setOneActive(row._id, isActive),
      onExcuseAllNoShows: (row, reason) => this.excuseAllNoShows(row, reason),
      onCreate: () => void this.router.navigate(['/customers', 'new']),
      onBulkSetActive: (rows, isActive) => this.setManyActive(rows.map((row) => row._id), isActive),
      onOpenSettings: () => this.openNoShowSettings(),
    });
  });

  ngOnInit(): void {
    this.servicesApi.list().subscribe({
      next: (services) => {
        this.services.set(services.map((service) => ({ id: service._id, name: service.name })));
      },
      error: () => this.services.set([]),
    });
  }

  onExport(query: DataListQuery): void {
    this.api.exportCsv(query).subscribe({
      next: (csv) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'customers.csv';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: this.language.t('common.error'),
          detail: this.language.t('customers.exportFailed'),
        });
      },
    });
  }

  openNoShowSettings(): void {
    this.api.getNoShowPolicy().subscribe({
      next: (policy) => {
        this.policyEnabled.set(policy.enabled);
        this.policyThreshold.set(policy.threshold);
        this.policyOpen.set(true);
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: this.language.t('common.error'),
          detail: this.language.t('customers.noShowPolicyFailed'),
        });
      },
    });
  }

  onPolicyThreshold(value: number | string | null): void {
    const next = Number(value);
    this.policyThreshold.set(Number.isFinite(next) ? next : 0);
  }

  saveNoShowSettings(): void {
    const threshold = Number(this.policyThreshold());
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 20) {
      this.messages.add({
        severity: 'error',
        summary: this.language.t('common.error'),
        detail: this.language.t('customers.noShowPolicyFailed'),
      });
      return;
    }
    this.policySaving.set(true);
    this.api.updateNoShowPolicy({ enabled: this.policyEnabled(), threshold }).subscribe({
      next: (policy) => {
        this.policySaving.set(false);
        this.policyEnabled.set(policy.enabled);
        this.policyThreshold.set(policy.threshold);
        this.policyOpen.set(false);
        this.reloadNonce.update((value) => value + 1);
        this.messages.add({
          severity: 'success',
          summary: this.language.t('customers.noShowPolicySaved'),
        });
      },
      error: () => {
        this.policySaving.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.language.t('common.error'),
          detail: this.language.t('customers.noShowPolicyFailed'),
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
      detail: this.language.t('customers.statusUpdateError'),
    });
  }

  private excuseAllNoShows(row: CustomerListRow, reason?: string): void {
    this.api.excuseAllNoShows(row._id, reason).subscribe({
      next: () => this.reloadNonce.update((value) => value + 1),
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: this.language.t('common.error'),
          detail: this.language.t('customers.excuseAllFailed'),
        });
      },
    });
  }
}
