import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { AdminApiService, type AdminUserRow } from '../../services/admin-api.service';
import {
  formatRelativeLogin,
  paginationPages,
  planLabel,
  roleLabel,
  statusLabel,
  tableAvatarInitial,
  tableAvatarKey,
} from './super-admin-users-table.util';

@Component({
  selector: 'app-super-admin-users',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    SkeletonModule,
  ],
  templateUrl: './super-admin-users.component.html',
  styleUrl: './super-admin-users.component.scss',
})
export class SuperAdminUsersComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly totalRecords = signal(0);
  readonly rows = signal<AdminUserRow[]>([]);
  readonly searchDebounce = signal('');
  readonly searchInput = signal('');

  readonly roleFilter = signal('');
  readonly statusFilter = signal('');
  readonly planFilter = signal('');

  readonly first = signal(0);
  readonly pageSize = signal(10);
  readonly pageNumber = signal(1);

  readonly sortField = signal<'createdAt' | 'name' | 'lastLoginAt'>('createdAt');
  readonly sortOrder = signal<1 | -1>(-1);

  readonly roleOptions = [
    { label: 'Role', value: '' },
    { label: 'Super admin', value: 'super_admin' },
    { label: 'Owner', value: 'owner' },
    { label: 'Staff', value: 'staff' },
    { label: 'Client', value: 'client' },
  ];

  readonly statusOptions = [
    { label: 'Status', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Suspended', value: 'disabled' },
  ];

  readonly planOptions = [
    { label: 'Plan', value: '' },
    { label: 'Free', value: 'free' },
    { label: 'Pro', value: 'pro' },
    { label: 'Premium', value: 'premium' },
  ];

  readonly hasRows = computed(() => this.rows().length > 0);
  readonly isEmpty = computed(() => !this.loading() && this.totalRecords() === 0);

  readonly rangeLabel = computed(() => {
    const total = this.totalRecords();
    if (total === 0) return 'מציג 0 מתוך 0 משתמשים';
    const start = this.first() + 1;
    const end = Math.min(this.first() + this.rows().length, total);
    return `מציג ${start}-${end} מתוך ${total} משתמשים`;
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize()))
  );

  readonly pageButtons = computed(() =>
    paginationPages(this.pageNumber(), this.totalPages())
  );

  readonly tableModel = computed(() => {
    const now = Date.now();
    return this.rows().map((row) => ({
      row,
      name: row.name,
      email: row.email,
      lastLoginAt: row.lastLoginAt,
      initial: tableAvatarInitial(row.name, row.email),
      avatarKey: tableAvatarKey(row.name, row.email),
      lastRelative: formatRelativeLogin(row.lastLoginAt, now),
      roleLbl: roleLabel(row.role),
      planLbl: planLabel(row.plan),
      statusLbl: statusLabel(row.status),
      statusActive: row.status === 'active',
    }));
  });

  readonly roleFilterActive = computed(() => this.roleFilter() !== '');
  readonly statusFilterActive = computed(() => this.statusFilter() !== '');
  readonly planFilterActive = computed(() => this.planFilter() !== '');

  clearSearch(): void {
    this.searchInput.set('');
    this.applySearch();
  }

  applySearch(): void {
    this.searchDebounce.set(this.searchInput().trim());
    this.first.set(0);
    this.loadPage({
      first: 0,
      rows: this.pageSize(),
      sortField: this.sortField(),
      sortOrder: this.sortOrder(),
    } as TableLazyLoadEvent);
  }

  onFilterChange(): void {
    this.first.set(0);
    this.loadPage({
      first: 0,
      rows: this.pageSize(),
      sortField: this.sortField(),
      sortOrder: this.sortOrder(),
    } as TableLazyLoadEvent);
  }

  goCreateUser(): void {
    void this.router.navigate(['/super-admin/users/new']);
  }

  openUser(row: AdminUserRow): void {
    void this.router.navigate(['/super-admin/users', row.id]);
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.loadPage(event);
  }

  goPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    const rows = this.pageSize();
    const first = (p - 1) * rows;
    this.first.set(first);
    this.pageNumber.set(p);
    this.loadPage({
      first,
      rows,
      sortField: this.sortField(),
      sortOrder: this.sortOrder(),
    } as TableLazyLoadEvent);
  }

  prevPage(): void {
    this.goPage(this.pageNumber() - 1);
  }

  nextPage(): void {
    this.goPage(this.pageNumber() + 1);
  }

  onRowsPerPageChange(n: number): void {
    this.pageSize.set(n);
    this.first.set(0);
    this.loadPage({
      first: 0,
      rows: n,
      sortField: this.sortField(),
      sortOrder: this.sortOrder(),
    } as TableLazyLoadEvent);
  }

  private loadPage(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.pageSize();
    const sf = event.sortField;
    if (sf === 'name' || sf === 'createdAt' || sf === 'lastLoginAt') {
      this.sortField.set(sf);
    }
    const so = event.sortOrder;
    if (so === 1 || so === -1) {
      this.sortOrder.set(so);
    }
    this.first.set(first);
    const page = Math.floor(first / rows) + 1;
    this.pageNumber.set(page);
    this.pageSize.set(rows);
    this.loading.set(true);
    this.loadError.set(null);
    this.adminApi
      .listUsers({
        page,
        limit: rows,
        search: this.searchDebounce() || undefined,
        role: this.roleFilter() || undefined,
        status: this.statusFilter() || undefined,
        plan: this.planFilter() || undefined,
        sortField: this.sortField(),
        sortOrder: this.sortOrder() === 1 ? 'asc' : 'desc',
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.totalRecords.set(res.total);
          this.loading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
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
      rows: this.pageSize(),
      sortField: this.sortField(),
      sortOrder: this.sortOrder(),
    } as TableLazyLoadEvent);
  }
}
