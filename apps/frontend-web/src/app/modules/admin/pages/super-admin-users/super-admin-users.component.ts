import {
  Component,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Popover, PopoverModule } from 'primeng/popover';
import { Menu, MenuModule } from 'primeng/menu';
import { SkeletonModule } from 'primeng/skeleton';
import {
  AdminApiService,
  type AdminUserRow,
  type AdminUserDetail,
  type AdminPlanTier,
} from '../../services/admin-api.service';
import {
  formatRelativeLogin,
  paginationPages,
  planBadgeClass,
  planLabel,
  roleBadgeClass,
  roleLabel,
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
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    DatePipe,
    PopoverModule,
    MenuModule,
    SkeletonModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './super-admin-users.component.html',
  styleUrl: './super-admin-users.component.scss',
})
export class SuperAdminUsersComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly router = inject(Router);

  @ViewChild('planPanel') planPanel?: Popover;
  @ViewChild('rowMenu') rowMenu?: Menu;

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

  readonly selectedRowId = signal<string | null>(null);
  readonly planTargetRow = signal<AdminUserRow | null>(null);
  readonly planSavingUserId = signal<string | null>(null);
  readonly actionsContext = signal<AdminUserRow | null>(null);
  private lastActionAnchor: HTMLElement | null = null;

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

  readonly detailVisible = signal(false);
  readonly detailLoading = signal(false);
  readonly detailUser = signal<AdminUserDetail | null>(null);

  readonly editVisible = signal(false);
  readonly editLoading = signal(false);
  readonly editName = signal('');
  readonly editTarget = signal<AdminUserRow | null>(null);

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
      createdAt: row.createdAt,
      lastLoginAt: row.lastLoginAt,
      initial: tableAvatarInitial(row.name, row.email),
      avatarKey: tableAvatarKey(row.name, row.email),
      lastRelative: formatRelativeLogin(row.lastLoginAt, now),
      roleClass: roleBadgeClass(row.role),
      roleLbl: roleLabel(row.role),
      planClass: planBadgeClass(row.plan),
      planLbl: planLabel(row.plan),
    }));
  });

  readonly actionsMenuModel = computed<MenuItem[]>(() => {
    const row = this.actionsContext();
    if (!row) return [];
    const items: MenuItem[] = [
      {
        label: '👁 View Profile',
        command: () => {
          this.openDetail(row);
        },
      },
      {
        label: '✏️ Edit Details',
        command: () => {
          this.openEdit(row);
        },
      },
      {
        label: '💳 Change Plan',
        disabled: !row.businessId,
        command: () => {
          this.openPlanFromMenu(row);
        },
      },
      {
        label: '🔄 Reset Password',
        command: () => {
          this.resetPasswordFuture();
        },
      },
    ];
    if (row.status === 'active') {
      items.push({
        label: '⏸ Suspend Account',
        styleClass: 'sa-users__menu-warn',
        disabled: row.role === 'super_admin',
        command: () => {
          this.setStatus(row, 'disabled');
        },
      });
    } else {
      items.push({
        label: '✅ Activate Account',
        command: () => {
          this.setStatus(row, 'active');
        },
      });
    }
    if (row.role !== 'super_admin' && row.role !== 'owner') {
      items.push({
        label: '🗑 Delete User',
        styleClass: 'sa-users__menu-danger',
        command: () => {
          this.confirmDelete(row);
        },
      });
    }
    return items;
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

  selectRow(rowId: string): void {
    this.selectedRowId.set(rowId);
  }

  openPlanPanel(event: Event, row: AdminUserRow): void {
    if (!row.businessId) {
      this.messages.add({
        severity: 'warn',
        summary: 'No business',
        detail: 'This user is not linked to a business plan.',
      });
      return;
    }
    this.planTargetRow.set(row);
    const t = event.currentTarget;
    this.planPanel?.toggle(event, t);
  }

  openPlanFromMenu(row: AdminUserRow): void {
    if (!row.businessId) return;
    this.planTargetRow.set(row);
    const anchor = this.lastActionAnchor;
    if (anchor) {
      this.planPanel?.show(new Event('click'), anchor);
    }
  }

  openActionsMenu(event: Event, row: AdminUserRow): void {
    this.lastActionAnchor = event.currentTarget as HTMLElement;
    this.actionsContext.set(row);
    this.rowMenu?.toggle(event);
  }

  closePlanPanel(): void {
    this.planPanel?.hide();
  }

  applyPlanTier(tier: AdminPlanTier): void {
    const row = this.planTargetRow();
    if (!row?.businessId) return;
    const rowId = row.id;
    const prev = row.plan;
    this.planSavingUserId.set(rowId);
    this.rows.update((list) =>
      list.map((r) => (r.id === rowId ? { ...r, plan: tier } : r))
    );
    this.adminApi.patchUserPlan(rowId, { plan: tier }).subscribe({
      next: (u) => {
        this.planSavingUserId.set(null);
        this.rows.update((list) => list.map((r) => (r.id === u.id ? u : r)));
        this.closePlanPanel();
        this.messages.add({ severity: 'success', summary: 'Plan updated', detail: '' });
      },
      error: (err: { error?: { message?: string } }) => {
        this.planSavingUserId.set(null);
        this.rows.update((list) =>
          list.map((r) => (r.id === rowId ? { ...r, plan: prev } : r))
        );
        this.messages.add({
          severity: 'error',
          summary: 'Update failed',
          detail: err?.error?.message ?? 'Request failed',
        });
      },
    });
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

  openDetail(row: AdminUserRow): void {
    this.detailVisible.set(true);
    this.detailLoading.set(true);
    this.detailUser.set(null);
    this.adminApi.getUser(row.id).subscribe({
      next: (u) => {
        this.detailUser.set(u);
        this.detailLoading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.detailLoading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'User details',
          detail: err?.error?.message ?? 'Failed to load',
        });
      },
    });
  }

  openEdit(row: AdminUserRow): void {
    this.editTarget.set(row);
    this.editName.set(row.name);
    this.editVisible.set(true);
  }

  saveEdit(): void {
    const row = this.editTarget();
    if (!row) return;
    const name = this.editName().trim();
    if (!name) {
      this.messages.add({ severity: 'warn', summary: 'Name required', detail: 'Enter a name.' });
      return;
    }
    this.editLoading.set(true);
    this.adminApi.patchUser(row.id, { name }).subscribe({
      next: (u) => {
        this.editLoading.set(false);
        this.editVisible.set(false);
        this.rows.update((list) => list.map((r) => (r.id === u.id ? u : r)));
        this.messages.add({ severity: 'success', summary: 'Saved', detail: 'User updated.' });
      },
      error: (err: { error?: { message?: string } }) => {
        this.editLoading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Update failed',
          detail: err?.error?.message ?? 'Request failed',
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
          rows: this.pageSize(),
          sortField: this.sortField(),
          sortOrder: this.sortOrder(),
        } as TableLazyLoadEvent);
        if (this.detailUser()?.id === row.id) {
          this.detailUser.update((u) => (u ? { ...u, status } : u));
        }
      },
      error: (err: { error?: { message?: string } }) => {
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
              rows: this.pageSize(),
              sortField: this.sortField(),
              sortOrder: this.sortOrder(),
            } as TableLazyLoadEvent);
            if (this.detailUser()?.id === row.id) {
              this.detailVisible.set(false);
            }
          },
          error: (err: { error?: { message?: string } }) => {
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
