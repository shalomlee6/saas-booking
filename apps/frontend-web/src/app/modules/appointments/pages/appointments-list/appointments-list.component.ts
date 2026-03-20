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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const STATUS_SEVERITY_MAP: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
  confirmed: 'success',
  pending: 'warn',
  completed: 'info',
  cancelled: 'danger',
  canceled: 'danger',
};

const STATUS_CLASS_MAP: Record<string, string> = {
  confirmed: 'calendar-block--confirmed',
  pending: 'calendar-block--pending',
  completed: 'calendar-block--completed',
  done: 'calendar-block--completed',
  cancelled: 'calendar-block--cancelled',
  canceled: 'calendar-block--cancelled',
};

export interface DayViewModel {
  date: Date;
  key: string;
  dayName: string;
  dateLabel: string;
  isToday: boolean;
  workingTitle: string;
  disabledRanges: { key: string; topPx: number; heightPx: number }[];
  slots: { time: string; minutesFromMidnight: number; disabled: boolean; ariaLabel: string | null }[];
  blocks: (AppointmentBlockLayout & { statusClass: string })[];
}

export interface AppointmentCardVm {
  apt: Appointment;
  customerDisplay: string;
  serviceDisplay: string;
  priceDisplay: string;
  severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
}

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
  return { from: start.toISOString(), to: end.toISOString() };
}

function getCustomerDisplay(apt: Appointment): string {
  if (apt.customerName) return apt.customerName;
  const c = apt.customerId;
  if (c && typeof c === 'object' && 'name' in c) return (c as { name: string }).name;
  return typeof c === 'string' ? c : '—';
}

function getServiceDisplay(apt: Appointment): string {
  if (apt.serviceName) return apt.serviceName;
  const s = apt.serviceId;
  if (s && typeof s === 'object' && 'name' in s) return (s as { name: string }).name;
  return typeof s === 'string' ? s : '—';
}

function getPriceDisplay(apt: Appointment): string {
  return apt.price != null ? `${apt.price} ₪` : '—';
}

function getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
  return STATUS_SEVERITY_MAP[(status || '').toLowerCase()] ?? 'secondary';
}

function getStatusClass(status: string): string {
  return STATUS_CLASS_MAP[(status || '').toLowerCase()] ?? 'calendar-block--neutral';
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
  readonly isMobile = signal(false);
  readonly selectedAppointment = signal<Appointment | null>(null);

  readonly visibleStartDate = signal<Date>(startOfDay(new Date()));
  readonly visibleDaysCount = signal(7);

  /** Reactive: re-reads auth signal each time it changes. */
  private readonly workingHours = computed(
    () => this.auth.businessSettings()?.workingHours ?? null
  );

  readonly items = toSignal(this.store.select(selectItems), { initialValue: [] });
  readonly loading = toSignal(this.store.select(selectLoading), { initialValue: false });
  readonly error = toSignal(this.store.select(selectError), {
    initialValue: null as string | null,
  });

  readonly hourLabelsWithStyle = computed(() => getHourLabelsWithStyle());

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.items();
    if (!q) return list;
    return list.filter((apt) => {
      const cust = getCustomerDisplay(apt);
      const svc = getServiceDisplay(apt);
      return (
        cust.toLowerCase().includes(q) ||
        svc.toLowerCase().includes(q) ||
        (apt.status ?? '').toLowerCase().includes(q)
      );
    });
  });

  /** Precomputed card view-models for the list below the calendar. */
  readonly appointmentCards = computed<AppointmentCardVm[]>(() =>
    this.filteredItems().map((apt) => ({
      apt,
      customerDisplay: getCustomerDisplay(apt),
      serviceDisplay: getServiceDisplay(apt),
      priceDisplay: getPriceDisplay(apt),
      severity: getStatusSeverity(apt.status ?? ''),
    }))
  );

  private readonly byDay = computed(() => {
    const list = this.filteredItems();
    const start = this.visibleStartDate();
    const count = this.visibleDaysCount();
    const rangeStart = startOfDay(new Date(start));
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + count);
    return groupAppointmentsByDay(list, rangeStart, rangeEnd);
  });

  /** Full precomputed day view-models — used in both calendar header and body. */
  readonly visibleDays = computed<DayViewModel[]>(() => {
    const start = this.visibleStartDate();
    const count = this.visibleDaysCount();
    const todayKey = toDateKey(this.today);
    const wh = this.workingHours();
    const byDay = this.byDay();

    const days: DayViewModel[] = [];
    for (let i = 0; i < count; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const key = toDateKey(date);

      const dayBlockList = byDay.get(key) ?? [];
      const blocks: (AppointmentBlockLayout & { statusClass: string })[] = [];
      const dayStart = new Date(date);
      for (const apt of dayBlockList) {
        const layout = getAppointmentBlockLayout(apt, dayStart);
        if (layout) {
          blocks.push({ ...layout, statusClass: getStatusClass(layout.status) });
        }
      }
      blocks.sort((a, b) => a.topPx - b.topPx);

      days.push({
        date,
        key,
        dayName: DAY_NAMES[date.getDay()],
        dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        isToday: key === todayKey,
        workingTitle: wh ? getWorkingHoursSummary(date.getDay(), wh) : 'Working hours not set',
        disabledRanges: getDisabledRangesForDay(date, wh),
        slots: getSlotsForDay(date, wh).map((slot) => ({
          ...slot,
          ariaLabel: slot.disabled ? null : `Add appointment at ${slot.time}`,
        })),
        blocks,
      });
    }
    return days;
  });

  /** Toolbar date range label. */
  readonly visibleDateRangeLabel = computed<string>(() => {
    const days = this.visibleDays();
    if (days.length === 0) return '';
    if (days.length === 1) {
      return days[0].date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    const start = days[0].date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const end = days[days.length - 1].date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${start} – ${end}`;
  });

  /** True when the visible range starts at today (prev arrow disabled). */
  readonly isAtToday = computed<boolean>(() => {
    const a = startOfDay(this.visibleStartDate());
    const b = startOfDay(this.today);
    return a.getTime() === b.getTime();
  });

  /** Selected appointment detail view-model. */
  readonly selectedAptVm = computed<AppointmentCardVm | null>(() => {
    const apt = this.selectedAppointment();
    if (!apt) return null;
    return {
      apt,
      customerDisplay: getCustomerDisplay(apt),
      serviceDisplay: getServiceDisplay(apt),
      priceDisplay: getPriceDisplay(apt),
      severity: getStatusSeverity(apt.status ?? ''),
    };
  });

  readonly gridBodyHeightPx = GRID_BODY_HEIGHT_PX;
  readonly slotHeightPx = CALENDAR_SLOT_HEIGHT_PX;

  readonly overlayOpen = signal<{ date: string; time: string } | null>(null);

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
    const params = getListParamsForVisibleRange(this.visibleStartDate(), count);
    this.store.dispatch(AppointmentsActions.load({ params }));
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  reload(): void {
    this.loadForCurrentView();
  }

  openOverlay(date: string, time: string): void {
    this.overlayOpen.set({ date, time });
  }

  closeOverlay(): void {
    this.overlayOpen.set(null);
  }

  onSlotClick(
    day: DayViewModel,
    slot: { time: string; minutesFromMidnight: number; disabled: boolean }
  ): void {
    if (slot.disabled) return;
    this.openOverlay(day.key, slot.time);
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
      error: (err) => {
        // Surface the cancellation error — previously was silently swallowed.
        const msg: string =
          (err as { error?: { message?: string } })?.error?.message ??
          'Failed to cancel appointment. Please try again.';
        this.store.dispatch(AppointmentsActions.loadFailure({ error: msg }));
      },
    });
  }
}
