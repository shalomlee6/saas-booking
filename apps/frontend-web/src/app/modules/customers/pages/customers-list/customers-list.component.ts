import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { CustomersStore } from '../../services/customers.store';
import { CustomersApiService } from '../../services/customers-api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

type StatusFilter = 'all' | 'active' | 'inactive';
type PresenceFilter = 'any' | 'yes' | 'no';
type CustomerSort = 'createdDesc' | 'createdAsc' | 'name' | 'status';

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, DatePickerModule],
  templateUrl: './customers-list.component.html',
  styleUrl: './customers-list.component.scss',
})
export class CustomersListComponent implements OnInit {
  private readonly store = inject(CustomersStore);
  private readonly api = inject(CustomersApiService);
  private readonly messages = inject(MessageService);
  readonly language = inject(LanguageService);

  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly createdFrom = signal<Date | null>(null);
  readonly createdTo = signal<Date | null>(null);
  readonly emailFilter = signal<PresenceFilter>('any');
  readonly phoneFilter = signal<PresenceFilter>('any');
  readonly newCustomersOnly = signal(false);
  readonly sortBy = signal<CustomerSort>('createdDesc');
  readonly list = this.store.list;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);
  readonly updatingStatus = signal(false);

  readonly filteredList = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const from = this.createdFrom();
    const to = this.createdTo();
    const email = this.emailFilter();
    const phone = this.phoneFilter();
    const recentOnly = this.newCustomersOnly();
    const recentCutoff = this.newCustomerCutoff();
    const locale = this.language.intlLocale();

    const matched = this.list().filter((c) => {
      if (status === 'active' && c.isActive === false) return false;
      if (status === 'inactive' && c.isActive !== false) return false;
      if (!this.matchesPresence(c.email, email)) return false;
      if (!this.matchesPresence(c.phone, phone)) return false;
      const created = new Date(c.createdAt).getTime();
      if (from && created < this.startOfDay(from)) return false;
      if (to && created > this.endOfDay(to)) return false;
      if (recentOnly && created < recentCutoff) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    });

    const sort = this.sortBy();
    return [...matched].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, locale);
      if (sort === 'createdAsc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sort === 'status') {
        const rank = (active: boolean | undefined) => (active === false ? 1 : 0);
        const byStatus = rank(a.isActive) - rank(b.isActive);
        return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name, locale);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  readonly hasActiveFilters = computed(
    () =>
      this.statusFilter() !== 'all' ||
      this.createdFrom() !== null ||
      this.createdTo() !== null ||
      this.emailFilter() !== 'any' ||
      this.phoneFilter() !== 'any' ||
      this.newCustomersOnly() ||
      this.sortBy() !== 'createdDesc' ||
      this.searchQuery().trim() !== ''
  );

  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allSelected = computed(() => {
    const items = this.filteredList();
    return items.length > 0 && items.every((c) => this.selectedIds().has(c._id));
  });

  ngOnInit(): void {
    this.store.load();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  onStatusFilter(value: string): void {
    if (value === 'active' || value === 'inactive' || value === 'all') {
      this.statusFilter.set(value);
    }
  }

  onPresenceFilter(target: 'email' | 'phone', value: string): void {
    if (value !== 'any' && value !== 'yes' && value !== 'no') return;
    if (target === 'email') this.emailFilter.set(value);
    else this.phoneFilter.set(value);
  }

  onSort(value: string): void {
    if (value === 'createdDesc' || value === 'createdAsc' || value === 'name' || value === 'status') {
      this.sortBy.set(value);
    }
  }

  onDateChange(target: 'from' | 'to', value: Date | null): void {
    const next = value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
    if (target === 'from') this.createdFrom.set(next);
    else this.createdTo.set(next);
  }

  toggleNewCustomers(): void {
    this.newCustomersOnly.update((on) => !on);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.createdFrom.set(null);
    this.createdTo.set(null);
    this.emailFilter.set('any');
    this.phoneFilter.set('any');
    this.newCustomersOnly.set(false);
    this.sortBy.set('createdDesc');
  }

  isCustomerActive(isActive: boolean | undefined): boolean {
    return isActive !== false;
  }

  private matchesPresence(value: string | undefined, filter: PresenceFilter): boolean {
    const present = !!value?.trim();
    if (filter === 'yes') return present;
    if (filter === 'no') return !present;
    return true;
  }

  private startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  private endOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
  }

  /** Start of the day 30 days ago — “new customers” includes that whole day. */
  private newCustomerCutoff(): number {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 30);
    return date.getTime();
  }

  formatCreatedAt(date: string | Date): string {
    return new Intl.DateTimeFormat(this.language.intlLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  }

  reload(): void {
    this.store.load();
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedIds.set(new Set());
      return;
    }
    this.selectedIds.set(new Set(this.filteredList().map((c) => c._id)));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  requestDeleteSelected(): void {
    if (this.selectedCount() === 0) return;
    this.confirmingDelete.set(true);
  }

  cancelDeleteSelected(): void {
    this.confirmingDelete.set(false);
  }

  setSelectedStatus(isActive: boolean): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0 || this.updatingStatus()) return;

    this.updatingStatus.set(true);
    this.api.bulkSetStatus(ids, isActive).subscribe({
      next: () => {
        this.updatingStatus.set(false);
        this.selectedIds.set(new Set());
        this.store.load();
      },
      error: () => {
        this.updatingStatus.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.language.t('common.error'),
          detail: this.language.t('customers.statusUpdateError'),
          life: 5000,
        });
      },
    });
  }

  confirmDeleteSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.deleting.set(true);
    this.api.bulkDelete(ids).subscribe({
      next: ({ deleted, blocked }) => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.selectedIds.set(new Set());
        this.store.load();

        if (deleted.length > 0) {
          this.messages.add({
            severity: 'success',
            summary: this.language.t('customers.bulkDeleteSuccessSummary'),
            detail: this.language.t('customers.bulkDeleteSuccessDetail', { count: deleted.length }),
            life: 4000,
          });
        }
        if (blocked.length > 0) {
          this.messages.add({
            severity: 'warn',
            summary: this.language.t('customers.bulkDeleteBlockedSummary'),
            detail: this.language.t('customers.bulkDeleteBlockedDetail', {
              names: blocked.map((b) => b.name).join(', '),
            }),
            life: 8000,
          });
        }
      },
      error: () => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.language.t('common.error'),
          detail: this.language.t('customers.bulkDeleteError'),
          life: 5000,
        });
      },
    });
  }
}
