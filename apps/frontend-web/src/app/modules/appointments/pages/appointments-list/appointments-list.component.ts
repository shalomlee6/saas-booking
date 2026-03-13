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
import { GrowthBrainService } from '../../../dashboard/services/growth-brain.service';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

type ViewMode = 'day' | 'week';

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function getListParamsForVisibleRange(
  visibleStart: Date,
  dayCount: number
): { from: string; to: string } {
  const start = startOfDay(new Date(visibleStart));
  const end = new Date(start);
  end.setDate(end.getDate() + dayCount);
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
  private readonly growthBrain = inject(GrowthBrainService);
  private readonly doc = inject(DOCUMENT);

  readonly viewMode = signal<ViewMode>('week');
  readonly searchQuery = signal('');
  readonly today = new Date();
  toDateKey = toDateKey;
  readonly isMobile = signal(false);
  readonly selectedAppointment = signal<Appointment | null>(null);

  /** First day of the visible range (normalized to 00:00). Initial load = today. */
  readonly visibleStartDate = signal<Date>(startOfDay(new Date()));
  /** Number of days to show: desktop 7, mobile 3, day view 1. */
  readonly visibleDaysCount = signal(7);

  readonly workingHours = () =>
    this.auth.businessSettings()?.workingHours ?? null;

  readonly items = toSignal(this.store.select(selectItems), { initialValue: [] });
  readonly loading = toSignal(this.store.select(selectLoading), {
    initialValue: false,
  });
  readonly error = toSignal(this.store.select(selectError), {
    initialValue: null as string | null,
  });

  /** Visible days for the calendar (used for header and columns). */
  getVisibleDays(): Date[] {
    const start = this.visibleStartDate();
    const count = this.visibleDaysCount();
    const days: Date[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }

  /** True when the visible range starts at today (disable prev arrow). */
  isAtToday(): boolean {
    const a = startOfDay(this.visibleStartDate());
    const b = startOfDay(this.today);
    return a.getTime() === b.getTime();
  }

  /** True when the given day is today (for highlighting column). */
  isToday(day: Date): boolean {
    return toDateKey(day) === toDateKey(this.today);
  }

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
    const start = this.visibleStartDate();
    const count = this.visibleDaysCount();
    const rangeStart = startOfDay(new Date(start));
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + count);
    return groupAppointmentsByDay(list, rangeStart, rangeEnd);
  });

  readonly gridBodyHeightPx = GRID_BODY_HEIGHT_PX;
  readonly slotHeightPx = CALENDAR_SLOT_HEIGHT_PX;

  constructor() {
    afterNextRender(() => {
      const win = this.doc.defaultView;
      if (!win) return;
      const update = () => {
        this.isMobile.set(win.innerWidth < DETAIL_BREAKPOINT_PX);
        this.updateVisibleDaysCount();
      };
      update();
      win.addEventListener('resize', update);
    });
  }

  ngOnInit(): void {
    this.updateVisibleDaysCount();
    this.loadForCurrentView();
  }

  private updateVisibleDaysCount(): void {
    const mode = this.viewMode();
    if (mode === 'day') {
      this.visibleDaysCount.set(1);
      return;
    }
    this.visibleDaysCount.set(this.isMobile() ? 3 : 7);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.updateVisibleDaysCount();
    this.loadForCurrentView();
  }

  nextRange(): void {
    const start = new Date(this.visibleStartDate());
    start.setDate(start.getDate() + this.visibleDaysCount());
    this.visibleStartDate.set(startOfDay(start));
    this.loadForCurrentView();
  }

  prevRange(): void {
    const start = new Date(this.visibleStartDate());
    start.setDate(start.getDate() - this.visibleDaysCount());
    this.visibleStartDate.set(startOfDay(start));
    this.loadForCurrentView();
  }

  private loadForCurrentView(): void {
    const count = this.visibleDaysCount();
    const params = getListParamsForVisibleRange(
      this.visibleStartDate(),
      count
    );
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

  /** Visible date range label for toolbar (e.g. "Mar 3 – Mar 9"). */
  visibleDateRangeLabel(): string {
    const days = this.getVisibleDays();
    if (days.length === 0) return '';
    if (days.length === 1) {
      return days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const start = days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const end = days[days.length - 1].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} – ${end}`;
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
    this.growthBrain.refresh();
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
        this.growthBrain.refresh();
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
