import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  afterNextRender,
} from '@angular/core';
import { DOCUMENT, DatePipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Appointment } from '../../model/appointment';
import * as AppointmentsActions from '../../state/appointments.actions';
import {
  selectItems,
  selectLoading,
  selectError,
} from '../../state/appointments.selectors';
import {
  GRID_BODY_HEIGHT_PX,
  CALENDAR_SLOT_HEIGHT_PX,
  getWeekStart,
  getWeekEnd,
  getWeekDays,
  getHourLabelsWithStyle,
  getSlotsForDay,
  groupAppointmentsByDay,
  getAppointmentBlockLayout,
  toDateKey,
  getDisabledRangesForDay,
  getWorkingHoursSummary,
} from '../../utils/calendar.utils';
import type { AppointmentBlockLayout } from '../../utils/calendar.utils';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppointmentCreateOverlayComponent } from '../../../../core/ui/overlay/appointment-create-overlay.component';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

type ViewMode = 'day' | 'week';

function getListParamsForWeek(anchor: Date): { from: string; to: string } {
  const start = getWeekStart(anchor);
  const end = getWeekEnd(anchor);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function getListParamsForDay(anchor: Date): { from: string; to: string } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

const DETAIL_BREAKPOINT_PX = 768;

@Component({
  selector: 'app-appointments-list',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    AppointmentCreateOverlayComponent,
    DialogModule,
    DrawerModule,
    TagModule,
    ButtonModule,
    DatePipe,
  ],
  templateUrl: './appointments-list.component.html',
  styleUrl: './appointments-list.component.scss',
})
export class AppointmentsListComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly doc = inject(DOCUMENT);

  readonly viewMode = signal<ViewMode>('week');
  readonly searchQuery = signal('');
  readonly today = new Date();
  toDateKey = toDateKey;
  readonly isMobile = signal(false);
  readonly selectedAppointment = signal<Appointment | null>(null);

  readonly workingHours = () =>
    this.auth.businessSettings()?.workingHours ?? null;

  readonly items = toSignal(this.store.select(selectItems), { initialValue: [] });
  readonly loading = toSignal(this.store.select(selectLoading), {
    initialValue: false,
  });
  readonly error = toSignal(this.store.select(selectError), {
    initialValue: null as string | null,
  });

  readonly weekDays = computed(() => {
    const mode = this.viewMode();
    const anchor = this.today;
    if (mode === 'day') {
      return [new Date(anchor)];
    }
    return getWeekDays(anchor);
  });

  readonly hourLabelsWithStyle = computed(() => getHourLabelsWithStyle());

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.items();
    if (!q) return list;
    return list.filter((apt) => {
      const cust = this.customerDisplay(apt);
      const svc = this.serviceDisplay(apt);
      return (
        cust.toLowerCase().includes(q) ||
        svc.toLowerCase().includes(q) ||
        (apt.status ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly byDay = computed(() => {
    const list = this.filteredItems();
    const days = this.weekDays();
    if (days.length === 0) return new Map<string, Appointment[]>();
    const weekStart = getWeekStart(this.today);
    const weekEnd = getWeekEnd(this.today);
    return groupAppointmentsByDay(list, weekStart, weekEnd);
  });

  readonly gridBodyHeightPx = GRID_BODY_HEIGHT_PX;
  readonly slotHeightPx = CALENDAR_SLOT_HEIGHT_PX;

  constructor() {
    afterNextRender(() => {
      const win = this.doc.defaultView;
      if (!win) return;
      const update = () => this.isMobile.set(win.innerWidth < DETAIL_BREAKPOINT_PX);
      update();
      win.addEventListener('resize', update);
    });
  }

  ngOnInit(): void {
    this.loadForCurrentView();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.loadForCurrentView();
  }

  private loadForCurrentView(): void {
    const mode = this.viewMode();
    const params =
      mode === 'day'
        ? getListParamsForDay(this.today)
        : getListParamsForWeek(this.today);
    this.store.dispatch(AppointmentsActions.load({ params }));
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  reload(): void {
    this.loadForCurrentView();
  }

  getBlocksForDay(day: Date): AppointmentBlockLayout[] {
    const key = toDateKey(day);
    const list = this.byDay().get(key) ?? [];
    const layouts: AppointmentBlockLayout[] = [];
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    for (const apt of list) {
      const layout = getAppointmentBlockLayout(apt, dayStart);
      if (layout) layouts.push(layout);
    }
    layouts.sort((a, b) => a.topPx - b.topPx);
    return layouts;
  }

  dayName(d: Date): string {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return names[d.getDay()];
  }

  dateStr(d: Date): string {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}/${day}`;
  }

  blockStatusClass(block: AppointmentBlockLayout): string {
    const s = (block.status || '').toLowerCase();
    if (s === 'confirmed') return 'calendar-block--confirmed';
    if (s === 'pending') return 'calendar-block--pending';
    if (s === 'completed' || s === 'done') return 'calendar-block--completed';
    if (s === 'cancelled' || s === 'canceled') return 'calendar-block--cancelled';
    return 'calendar-block--neutral';
  }

  getDisabledRanges(day: Date): { key: string; topPx: number; heightPx: number }[] {
    return getDisabledRangesForDay(day, this.workingHours());
  }

  getDayWorkingTitle(day: Date): string {
    const wh = this.workingHours();
    if (!wh) return 'Working hours not set';
    return getWorkingHoursSummary(day.getDay(), wh);
  }

  getSlotsForDay(day: Date): { time: string; minutesFromMidnight: number; disabled: boolean }[] {
    return getSlotsForDay(day, this.workingHours());
  }

  readonly overlayOpen = signal<{ date: string; time: string } | null>(null);

  openOverlay(date: string, time: string): void {
    this.overlayOpen.set({ date, time });
  }

  closeOverlay(): void {
    this.overlayOpen.set(null);
  }

  onSlotClick(day: Date, slot: { time: string; minutesFromMidnight: number; disabled: boolean }): void {
    if (slot.disabled) return;
    const date = toDateKey(day);
    this.openOverlay(date, slot.time);
  }

  onAppointmentCreated(): void {
    this.closeOverlay();
    this.loadForCurrentView();
    this.appointmentsApi.refresh();
  }

  openAppointment(apt: Appointment): void {
    this.selectedAppointment.set(apt);
  }

  closeDetail(): void {
    this.selectedAppointment.set(null);
  }

  onDetailVisibleChange(visible: boolean): void {
    if (!visible) this.closeDetail();
  }

  onDetailCancel(): void {
    const apt = this.selectedAppointment();
    if (!apt) return;
    this.appointmentsApi.cancel(apt._id).subscribe({
      next: () => {
        this.closeDetail();
        this.loadForCurrentView();
        this.appointmentsApi.refresh();
      },
      error: () => {},
    });
  }

  customerDisplay(apt: Appointment): string {
    if (apt.customerName) return apt.customerName;
    const c = apt.customerId;
    if (c && typeof c === 'object' && 'name' in c) return (c as { name: string }).name;
    return typeof c === 'string' ? c : '—';
  }

  serviceDisplay(apt: Appointment): string {
    if (apt.serviceName) return apt.serviceName;
    const s = apt.serviceId;
    if (s && typeof s === 'object' && 'name' in s) return (s as { name: string }).name;
    return typeof s === 'string' ? s : '—';
  }

  priceDisplay(apt: Appointment): string {
    if (apt.price != null) return `${apt.price} ₪`;
    return '—';
  }

  customerPhoneDisplay(apt: Appointment): string {
    if (apt.customerPhone != null && apt.customerPhone !== '') return apt.customerPhone;
    const c = apt.customerId;
    if (c && typeof c === 'object' && 'phone' in c) return (c as { phone?: string }).phone ?? '—';
    return '—';
  }

  statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return 'success';
    if (s === 'pending') return 'warn';
    if (s === 'completed') return 'info';
    if (s === 'cancelled' || s === 'canceled') return 'danger';
    return 'secondary';
  }
}
