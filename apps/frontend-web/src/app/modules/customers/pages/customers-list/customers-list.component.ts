import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersStore } from '../../services/customers.store';

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './customers-list.component.html',
  styleUrl: './customers-list.component.scss',
})
export class CustomersListComponent implements OnInit {
  private readonly store = inject(CustomersStore);

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

  reload(): void {
    this.store.load();
  }
}
