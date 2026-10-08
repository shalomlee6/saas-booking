import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LanguageService } from '../../../../core/i18n/language.service';
import { DataManagementTableComponent } from '../../../../shared/data-management/data-management-table.component';
import type { DataListQuery } from '../../../../shared/data-management/entity-data-management-config';
import { AdminApiService, type AdminAuditRow } from '../../services/admin-api.service';
import {
  auditActionLabel,
  buildAuditLogConfig,
  formatAuditTimestamp,
  isSystemActor,
} from './audit-log.config';

@Component({
  selector: 'app-super-admin-audit',
  standalone: true,
  imports: [DataManagementTableComponent, TranslatePipe],
  templateUrl: './super-admin-audit.component.html',
  styleUrl: './super-admin-audit.component.scss',
  host: {
    '(document:keydown.escape)': 'closeDetail()',
  },
})
export class SuperAdminAuditComponent {
  private readonly adminApi = inject(AdminApiService);
  readonly language = inject(LanguageService);

  readonly detail = signal<AdminAuditRow | null>(null);
  readonly copied = signal(false);

  readonly loadPage = (query: DataListQuery) =>
    this.adminApi.listAudit({
      page: query.page,
      limit: query.limit,
      search: query.search || undefined,
      sort: query.sort || undefined,
      order: query.order,
      ...query.filters,
    });

  readonly tableConfig = computed(() => {
    this.language.language();
    return buildAuditLogConfig({
      t: (key, params) => this.language.t(key, params),
      onView: (row) => this.openDetail(row),
    });
  });

  readonly detailDir = computed(() => (this.language.language() === 'he' ? 'rtl' : 'ltr'));

  openDetail(row: AdminAuditRow): void {
    this.copied.set(false);
    this.detail.set(row);
  }

  closeDetail(): void {
    this.detail.set(null);
    this.copied.set(false);
  }

  isSystem(actor: string): boolean {
    return isSystemActor(actor);
  }

  actionLabel(code: string): string {
    return auditActionLabel((key) => this.language.t(key), code);
  }

  when(value: string): string {
    return formatAuditTimestamp(value);
  }

  metadataText(row: AdminAuditRow): string {
    return JSON.stringify(row.metadata ?? {}, null, 2);
  }

  copyMetadata(row: AdminAuditRow): void {
    const write = navigator.clipboard?.writeText(this.metadataText(row));
    if (!write) return;
    void write.then(() => this.copied.set(true)).catch(() => undefined);
  }

  copyEntityId(row: AdminAuditRow): void {
    if (!row.entityId || row.entityId === '—') return;
    void navigator.clipboard?.writeText(row.entityId);
  }
}
