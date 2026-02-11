import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Appointment } from '../../model/appointment';
import type {
  AppointmentCustomer,
  AppointmentService,
} from '../../model/appointment';
import * as AppointmentsActions from '../../state/appointments.actions';
import {
  selectItems,
  selectLoading,
  selectError,
} from '../../state/appointments.selectors';

type DateRangeFilter = 'today' | 'week' | 'all';

function toISO(date: Date): string {
  return date.toISOString();
}

function getListParams(filter: DateRangeFilter): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  switch (filter) {
    case 'today':
      end.setDate(start.getDate() + 1);
      return { from: toISO(start), to: toISO(end) };
    case 'week':
      end.setDate(start.getDate() + 7);
      return { from: toISO(start), to: toISO(end) };
    case 'all':
    default:
      const yearStart = new Date(start.getFullYear(), 0, 1);
      const yearEnd = new Date(start.getFullYear() + 1, 0, 1);
      return { from: toISO(yearStart), to: toISO(yearEnd) };
  }
}

function customerDisplay(apt: Appointment): string {
  const c = apt.customerId;
  if (c && typeof c === 'object' && 'name' in c)
    return (c as AppointmentCustomer).name;
  return typeof c === 'string' ? c : '—';
}

function serviceDisplay(apt: Appointment): string {
  const s = apt.serviceId;
  if (s && typeof s === 'object' && 'name' in s)
    return (s as AppointmentService).name;
  return typeof s === 'string' ? s : '—';
}

@Component({
  selector: 'app-appointments-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './appointments-list.component.html',
  styleUrl: './appointments-list.component.scss',
})
export class AppointmentsListComponent implements OnInit {
  private readonly store = inject(Store);

  readonly searchQuery = signal('');
  readonly dateRangeFilter = signal<DateRangeFilter>('week');

  readonly items = toSignal(this.store.select(selectItems), { initialValue: [] });
  readonly loading = toSignal(this.store.select(selectLoading), {
    initialValue: false,
  });
  readonly error = toSignal(this.store.select(selectError), {
    initialValue: null as string | null,
  });

  readonly filteredList = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.items();
    if (!q) return list;
    return list.filter((apt) => {
      const cust = customerDisplay(apt);
      const svc = serviceDisplay(apt);
      return (
        cust.toLowerCase().includes(q) ||
        svc.toLowerCase().includes(q) ||
        (apt.status && apt.status.toLowerCase().includes(q))
      );
    });
  });

  ngOnInit(): void {
    this.store.dispatch(
      AppointmentsActions.load({ params: getListParams(this.dateRangeFilter()) })
    );
  }

  setFilter(filter: DateRangeFilter): void {
    this.dateRangeFilter.set(filter);
    this.store.dispatch(
      AppointmentsActions.load({ params: getListParams(filter) })
    );
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  reload(): void {
    this.store.dispatch(
      AppointmentsActions.load({
        params: getListParams(this.dateRangeFilter()),
      })
    );
  }

  customerDisplay(apt: Appointment): string {
    return customerDisplay(apt);
  }

  serviceDisplay(apt: Appointment): string {
    return serviceDisplay(apt);
  }
}
