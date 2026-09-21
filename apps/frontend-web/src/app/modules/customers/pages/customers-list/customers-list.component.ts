import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CustomersStore } from '../../services/customers.store';
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
  readonly language = inject(LanguageService);

  readonly searchQuery = signal('');
  readonly list = this.store.list;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

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
}
