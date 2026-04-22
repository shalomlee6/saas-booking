import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { DrawerModule } from 'primeng/drawer';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  AdminApiService,
  type AdminUserRow,
  type AdminUserDetail,
  type AdminPlanTier,
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
    DrawerModule,
    PaginatorModule,
    ConfirmDialogModule,
    DatePipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './super-admin-users.component.html',
  styleUrl: './super-admin-users.component.scss',
})
export class SuperAdminUsersComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly totalRecords = signal(0);
  readonly rows = signal<AdminUserRow[]>([]);
  readonly searchDebounce = signal('');
  searchInput = '';

  roleFilter = '';
  statusFilter = '';

  readonly first = signal(0);
  pageSize = 20;
  private page = 1;

  sortField: 'createdAt' | 'name' | 'email' = 'createdAt';
  sortOrder: 1 | -1 = -1;

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
    { label: 'Suspended', value: 'disabled' },
  ];

  readonly planOptions = [
    { label: 'Free', value: 'free' as const },
    { label: 'Pro', value: 'pro' as const },
    { label: 'Premium', value: 'premium' as const },
  ];

  readonly timezoneOptions = [
    { label: 'Asia/Jerusalem', value: 'Asia/Jerusalem' },
    { label: 'UTC', value: 'UTC' },
    { label: 'Europe/London', value: 'Europe/London' },
    { label: 'America/New_York', value: 'America/New_York' },
  ];

  createSidebarVisible = false;
  createSubmitting = signal(false);
  createBusinessName = '';
  createOwnerName = '';
  createEmail = '';
  createPhone = '';
  createPlan: AdminPlanTier = 'free';
  createTimezone = 'Asia/Jerusalem';

  detailVisible = false;
  detailLoading = signal(false);
  detailUser = signal<AdminUserDetail | null>(null);

  readonly hasRows = computed(() => this.rows().length > 0);
  readonly isEmpty = computed(() => !this.loading() && this.totalRecords() === 0);

  onSearchSubmit(): void {
    this.searchDebounce.set(this.searchInput.trim());
    this.first.set(0);
    this.loadPage({
      first: 0,
      rows: this.pageSize,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
    } as TableLazyLoadEvent);
  }

  onRoleChange(): void {
    this.first.set(0);
    this.loadPage({
      first: 0,
      rows: this.pageSize,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
    } as TableLazyLoadEvent);
  }

  onStatusChange(): void {
    this.first.set(0);
    this.loadPage({
      first: 0,
      rows: this.pageSize,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
    } as TableLazyLoadEvent);
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.loadPage(event);
  }

  onPaginatorChange(event: PaginatorState): void {
    const rows = event.rows ?? this.pageSize;
    const first = event.first ?? 0;
    this.first.set(first);
    this.pageSize = rows;
    this.loadPage({
      first,
      rows,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
    } as TableLazyLoadEvent);
  }

  private loadPage(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.pageSize;
    const sf = event.sortField;
    if (sf === 'name' || sf === 'email' || sf === 'createdAt') {
      this.sortField = sf;
    }
    const so = event.sortOrder;
    if (so === 1 || so === -1) {
      this.sortOrder = so;
    }
    this.first.set(first);
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
        sortField: this.sortField,
        sortOrder: this.sortOrder === 1 ? 'asc' : 'desc',
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
      first: this.first(),
      rows: this.pageSize,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
    } as TableLazyLoadEvent);
  }

  openCreateSidebar(): void {
    this.createBusinessName = '';
    this.createOwnerName = '';
    this.createEmail = '';
    this.createPhone = '';
    this.createPlan = 'free';
    this.createTimezone = 'Asia/Jerusalem';
    this.createSidebarVisible = true;
  }

  submitCreate(): void {
    const businessName = this.createBusinessName.trim();
    const ownerFullName = this.createOwnerName.trim();
    const ownerEmail = this.createEmail.trim().toLowerCase();
    if (!businessName || !ownerFullName || !ownerEmail) {
      this.messages.add({
        severity: 'warn',
        summary: 'Missing fields',
        detail: 'Business name, owner name, and email are required.',
      });
      return;
    }
    this.createSubmitting.set(true);
    this.adminApi
      .createBusiness({
        businessName,
        ownerFullName,
        ownerEmail,
        ownerPhone: this.createPhone.trim() || undefined,
        plan: this.createPlan,
        timezone: this.createTimezone,
      })
      .subscribe({
        next: () => {
          this.createSubmitting.set(false);
          this.createSidebarVisible = false;
          this.messages.add({
            severity: 'success',
            summary: 'Business created',
            detail: 'Tenant provisioned. Credentials were written to the API log.',
          });
          this.loadPage({
            first: this.first(),
            rows: this.pageSize,
            sortField: this.sortField,
            sortOrder: this.sortOrder,
          } as TableLazyLoadEvent);
        },
        error: (err) => {
          this.createSubmitting.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Create failed',
            detail: err?.error?.message ?? 'Request failed',
          });
        },
      });
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
      this.messages.add({
        severity: 'warn',
        summary: 'Not allowed',
        detail: 'Cannot disable super admin.',
      });
      return;
    }
    this.adminApi.patchUser(row.id, { status }).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: 'Updated',
          detail: `User ${status === 'disabled' ? 'suspended' : 'activated'}.`,
        });
        this.loadPage({
          first: this.first(),
          rows: this.pageSize,
          sortField: this.sortField,
          sortOrder: this.sortOrder,
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

  confirmDelete(row: AdminUserRow): void {
    if (row.role === 'super_admin' || row.role === 'owner') {
      this.messages.add({
        severity: 'warn',
        summary: 'Not allowed',
        detail: 'Only staff or client accounts can be deleted from this list.',
      });
      return;
    }
    this.confirm.confirm({
      message: `Delete ${row.email}? This cannot be undone.`,
      header: 'Delete user',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.adminApi.deleteUser(row.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Deleted', detail: 'User removed.' });
            this.loadPage({
              first: this.first(),
              rows: this.pageSize,
              sortField: this.sortField,
              sortOrder: this.sortOrder,
            } as TableLazyLoadEvent);
            if (this.detailUser()?.id === row.id) {
              this.detailVisible = false;
            }
          },
          error: (err) => {
            this.messages.add({
              severity: 'error',
              summary: 'Delete failed',
              detail: err?.error?.message ?? 'Request failed',
            });
          },
        });
      },
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
