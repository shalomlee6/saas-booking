import { Component, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService, type AdminAuditRow } from '../../services/admin-api.service';

@Component({
  selector: 'app-super-admin-audit',
  standalone: true,
  imports: [FormsModule, TableModule, InputTextModule, ButtonModule, ToastModule, DatePipe, JsonPipe],
  templateUrl: './super-admin-audit.component.html',
  styleUrl: './super-admin-audit.component.scss',
})
export class SuperAdminAuditComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(false);
  readonly totalRecords = signal(0);
  readonly rows = signal<AdminAuditRow[]>([]);

  searchInput = '';
  readonly searchApplied = signal('');

  pageSize = 25;
  private page = 1;

  onSearchSubmit(): void {
    this.searchApplied.set(this.searchInput.trim());
    this.loadPage({ first: 0, rows: this.pageSize } as TableLazyLoadEvent);
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.loadPage(event);
  }

  private loadPage(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? 25;
    this.page = Math.floor(first / rows) + 1;
    this.pageSize = rows;
    this.loading.set(true);
    this.adminApi
      .listAudit({
        page: this.page,
        limit: rows,
        search: this.searchApplied() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.totalRecords.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Audit log',
            detail: err?.error?.message ?? 'Failed to load',
          });
        },
      });
  }
}
