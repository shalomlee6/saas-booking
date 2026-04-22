import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  AdminApiService,
  type AdminUserRow,
  type AdminUserDetail,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-super-admin-users',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    DialogModule,
    TooltipModule,
    ToastModule,
    DatePipe,
  ],
  templateUrl: './super-admin-users.component.html',
  styleUrl: './super-admin-users.component.scss',
})
export class SuperAdminUsersComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly totalRecords = signal(0);
  readonly rows = signal<AdminUserRow[]>([]);
  readonly searchDebounce = signal('');
  searchInput = '';

  roleFilter = '';
  statusFilter = '';

  readonly roleOptions = [
    { label: 'All roles', value: '' },
    { label: 'Super admin', value: 'super_admin' },
    { label: 'Owner', value: 'owner' },
    { label: 'Staff', value: 'staff' },
    { label: 'Client', value: 'client' },
  ];

  readonly statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Disabled', value: 'disabled' },
  ];

  pageSize = 20;
  private page = 1;

  detailVisible = false;
  detailLoading = signal(false);
  detailUser = signal<AdminUserDetail | null>(null);

  onSearchSubmit(): void {
    this.searchDebounce.set(this.searchInput.trim());
    this.loadPage({ first: 0, rows: this.pageSize } as TableLazyLoadEvent);
  }

  onRoleChange(): void {
    this.loadPage({ first: 0, rows: this.pageSize } as TableLazyLoadEvent);
  }

  onStatusChange(): void {
    this.loadPage({ first: 0, rows: this.pageSize } as TableLazyLoadEvent);
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.loadPage(event);
  }

  private loadPage(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? 20;
    this.page = Math.floor(first / rows) + 1;
    this.pageSize = rows;
    this.loading.set(true);
    this.loadError.set(null);
    this.adminApi
      .listUsers({
        page: this.page,
        limit: rows,
        search: this.searchDebounce() || undefined,
        role: this.roleFilter || undefined,
        status: this.statusFilter || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.totalRecords.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.loadError.set(err?.error?.message ?? 'Request failed');
          this.messages.add({
            severity: 'error',
            summary: 'Failed to load users',
            detail: err?.error?.message ?? 'Request failed',
          });
        },
      });
  }

  retryLoad(): void {
    this.loadPage({
      first: (this.page - 1) * this.pageSize,
      rows: this.pageSize,
    } as TableLazyLoadEvent);
  }

  openDetail(row: AdminUserRow): void {
    this.detailVisible = true;
    this.detailLoading.set(true);
    this.detailUser.set(null);
    this.adminApi.getUser(row.id).subscribe({
      next: (u) => {
        this.detailUser.set(u);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'User details',
          detail: err?.error?.message ?? 'Failed to load',
        });
      },
    });
  }

  setStatus(row: AdminUserRow, status: 'active' | 'disabled'): void {
    if (row.role === 'super_admin' && status === 'disabled') {
      this.messages.add({ severity: 'warn', summary: 'Not allowed', detail: 'Cannot disable super admin.' });
      return;
    }
    this.adminApi.patchUser(row.id, { status }).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Updated', detail: `User ${status}.` });
        this.loadPage({
          first: (this.page - 1) * this.pageSize,
          rows: this.pageSize,
        } as TableLazyLoadEvent);
        if (this.detailUser()?.id === row.id) {
          this.detailUser.update((u) => (u ? { ...u, status } : u));
        }
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Update failed',
          detail: err?.error?.message ?? 'Request failed',
        });
      },
    });
  }

  impersonateUserFuture(_row: AdminUserRow): void {
    this.messages.add({
      severity: 'info',
      summary: 'Coming soon',
      detail: 'User-level impersonation will be available in a future release.',
    });
  }

  resetPasswordFuture(): void {
    this.messages.add({
      severity: 'info',
      summary: 'Coming soon',
      detail: 'Password reset from admin console is not enabled yet.',
    });
  }
}
