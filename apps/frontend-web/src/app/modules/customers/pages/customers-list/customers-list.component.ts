import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { CustomersStore } from '../../services/customers.store';
import { CustomersApiService } from '../../services/customers-api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe],
  templateUrl: './customers-list.component.html',
  styleUrl: './customers-list.component.scss',
})
export class CustomersListComponent implements OnInit {
  private readonly store = inject(CustomersStore);
  private readonly api = inject(CustomersApiService);
  private readonly messages = inject(MessageService);
  readonly language = inject(LanguageService);

  readonly searchQuery = signal('');
  readonly list = this.store.list;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);

  readonly filteredList = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const items = this.list();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  });

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
