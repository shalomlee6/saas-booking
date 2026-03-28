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
  getLocalParts,
  businessDayStartUtc,
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

/**
 * Returns a Date set to midnight of `d` in the BROWSER's local timezone.
 * Used only for signal initialisation and same-timezone comparisons — NOT for
 * business-timezone-aware calendar logic (use `businessDayStartUtc` for that).
 */
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Returns `from`/`to` ISO strings that bracket `dayCount` calendar days
 * starting from `visibleStart`, anchored to the BUSINESS timezone so the API
 * never misses appointments near day boundaries.
 */
function getListParamsForVisibleRange(
  visibleStart: Date,
  dayCount: number,
  timezone: string
): { from: string; to: string } {
  // Resolve which calendar date the visibleStart represents in the business tz.
  const startDateStr = toDateKey(visibleStart, timezone);
  // Convert that date's midnight back to a UTC timestamp.
  const from = businessDayStartUtc(startDateStr, timezone);
  // `to` is exactly `dayCount` × 24 h later (safe: calendar days are always 86400 s
  // for the purpose of bounding a server query even across DST boundaries).
  const to = new Date(from.getTime() + dayCount * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
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
  readonly isMobile = signal(false);
  readonly selectedAppointment = signal<Appointment | null>(null);

  readonly visibleStartDate = signal<Date>(startOfDay(new Date()));
  readonly visibleDaysCount = signal(7);

  /** Reactive: re-reads auth signal each time it changes. */
  private readonly workingHours = computed(
    () => this.auth.businessSettings()?.workingHours ?? null
  );

  /**
   * IANA timezone for the active business.
   * All calendar layout, grouping, and label functions read this signal so that
   * appointment blocks are positioned in the business's local clock, not the browser's.
   */
  private readonly timezone = computed(() => this.auth.businessTimezone());

  /**
   * "Today" expressed as a date-key in the business timezone.
   * Recomputed when auth loads (the timezone may not be known yet at construction).
   */
  private readonly todayKeyTz = computed(() => toDateKey(new Date(), this.timezone()));

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
    const tz = this.timezone();
    // Build the range from business-timezone midnight so grouping boundaries match display.
    const startDateStr = toDateKey(start, tz);
    const rangeStart = businessDayStartUtc(startDateStr, tz);
    const rangeEnd = new Date(rangeStart.getTime() + count * 24 * 60 * 60 * 1000);
    return groupAppointmentsByDay(list, rangeStart, rangeEnd, tz);
  });

  /** Full precomputed day view-models — used in both calendar header and body. */
  readonly visibleDays = computed<DayViewModel[]>(() => {
    const start = this.visibleStartDate();
    const count = this.visibleDaysCount();
    const tz = this.timezone();
    const todayKey = this.todayKeyTz();
    const wh = this.workingHours();
    const byDay = this.byDay();

    // Derive the first column's date string in the business timezone so that
    // advancing by whole days stays on the correct calendar boundary even when
    // the browser clock is in a different timezone.
    const startDateStr = toDateKey(start, tz);
    const [sy, sm, sd] = startDateStr.split('-').map(Number);

    const days: DayViewModel[] = [];
    for (let i = 0; i < count; i++) {
      // Build a UTC anchor for "noon of column i" — chosen to be safely within
      // the same calendar day for any timezone between UTC−11 and UTC+12.
      const anchorUtc = new Date(Date.UTC(sy ?? 0, (sm ?? 1) - 1, (sd ?? 1) + i, 12, 0, 0));
      const key = toDateKey(anchorUtc, tz);

      // Business-local midnight for this column (used as the day anchor for layout).
      const dayMidnightUtc = businessDayStartUtc(key, tz);

      const dayParts = getLocalParts(anchorUtc, tz);

      const dayBlockList = byDay.get(key) ?? [];
      const blocks: (AppointmentBlockLayout & { statusClass: string })[] = [];
      for (const apt of dayBlockList) {
        const layout = getAppointmentBlockLayout(apt, dayMidnightUtc, tz);
        if (layout) {
          blocks.push({ ...layout, statusClass: getStatusClass(layout.status) });
        }
      }
      blocks.sort((a, b) => a.topPx - b.topPx);

      days.push({
        date: dayMidnightUtc,
        key,
        dayName: DAY_NAMES[dayParts.dayOfWeek] ?? '',
        dateLabel: `${dayParts.month}/${dayParts.day}`,
        isToday: key === todayKey,
        workingTitle: wh
          ? getWorkingHoursSummary(dayParts.dayOfWeek, wh)
          : 'Working hours not set',
        disabledRanges: getDisabledRangesForDay(anchorUtc, wh, tz),
        slots: getSlotsForDay(anchorUtc, wh, tz).map((slot) => ({
          ...slot,
          ariaLabel: slot.disabled ? null : `Add appointment at ${slot.time}`,
        })),
        blocks,
      });
    }
    return days;
  });

  /** Toolbar date range label — dates shown in the business timezone. */
  readonly visibleDateRangeLabel = computed<string>(() => {
    const days = this.visibleDays();
    const tz = this.timezone();
    if (days.length === 0) return '';

    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }).format(d);

    if (days.length === 1) {
      return fmt(days[0].date, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const start = fmt(days[0].date, { month: 'short', day: 'numeric' });
    const end = fmt(days[days.length - 1].date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${start} – ${end}`;
  });

  /** True when the visible range starts at today in the business timezone. */
  readonly isAtToday = computed<boolean>(() => {
    const tz = this.timezone();
    return toDateKey(this.visibleStartDate(), tz) === toDateKey(new Date(), tz);
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
    const params = getListParamsForVisibleRange(
      this.visibleStartDate(),
      count,
      this.timezone()
    );
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
