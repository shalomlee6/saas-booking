import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
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
  CALENDAR_HOUR_START,
  CALENDAR_HOUR_END,
  asDate,
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
import { DatePickerModule } from 'primeng/datepicker';

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

export interface DayChip {
  date: Date;
  key: string;
  dayLabel: string;
  dateNum: number;
  isToday: boolean;
  isSelected: boolean;
}

export interface AgendaGroup {
  hour: number;
  label: string;
  blocks: (AppointmentBlockLayout & { statusClass: string })[];
}

/** One day section in the mobile 3-day stacked view. */
export interface MobileDayGroup {
  dayKey: string;
  /** "Today", "Tomorrow", or "Monday" */
  heading: string;
  /** "Fri, Mar 28" */
  subLabel: string;
  isToday: boolean;
  blocks: (AppointmentBlockLayout & { statusClass: string })[];
}

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

/** Below this width → mobile agenda view + drawer for detail panel. */
const MOBILE_BREAKPOINT_PX = 768;
/** Below this width → 5-day week grid instead of 7-day. */
const TABLET_BREAKPOINT_PX = 1024;

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
    DatePickerModule,
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

  /** True when the visible start date IS today (business-timezone-aware). */
  readonly isAtToday = computed<boolean>(() =>
    toDateKey(this.visibleStartDate(), this.timezone()) === this.todayKeyTz()
  );

  /** Human-readable label for the selected mobile day (e.g. "Wednesday, Mar 28" or "Today, Mar 28"). */
  readonly mobileSelectedDayLabel = computed<string>(() => {
    const tz = this.timezone();
    const day = this.visibleStartDate();
    const isToday = toDateKey(day, tz) === this.todayKeyTz();
    const datePart = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
    }).format(day);
    if (isToday) return `Today, ${datePart}`;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(day);
  });

  /**
   * 7-day chip strip for the mobile view.
   * Shows Sunday–Saturday of the week that contains `visibleStartDate`.
   */
  readonly weekDayChips = computed<DayChip[]>(() => {
    const selected = this.visibleStartDate();
    const tz = this.timezone();
    const todayKey = this.todayKeyTz();
    const selectedKey = toDateKey(selected, tz);

    const startDateStr = toDateKey(selected, tz);
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const selectedParts = getLocalParts(selected, tz);
    const dow = selectedParts.dayOfWeek; // 0=Sun … 6=Sat

    const chips: DayChip[] = [];
    for (let i = 0; i < 7; i++) {
      const dayOffset = i - dow;
      const anchorUtc = new Date(
        Date.UTC(sy ?? 0, (sm ?? 1) - 1, (sd ?? 1) + dayOffset, 12, 0, 0)
      );
      const key = toDateKey(anchorUtc, tz);
      const parts = getLocalParts(anchorUtc, tz);
      chips.push({
        date: businessDayStartUtc(key, tz),
        key,
        dayLabel: (['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const)[parts.dayOfWeek] ?? '',
        dateNum: parts.day,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
      });
    }
    return chips;
  });

  /**
   * Agenda groups for the mobile day view.
   * Groups the visible day's appointment blocks by their START hour.
   */
  readonly agendaGroups = computed<AgendaGroup[]>(() => {
    const days = this.visibleDays();
    const day = days[0];
    if (!day) return [];
    const tz = this.timezone();

    const hourMap = new Map<number, (AppointmentBlockLayout & { statusClass: string })[]>();
    for (const block of day.blocks) {
      const start = asDate(block.appointment.start);
      if (!start) continue;
      const { hour } = getLocalParts(start, tz);
      const list = hourMap.get(hour) ?? [];
      list.push(block);
      hourMap.set(hour, list);
    }

    const groups: AgendaGroup[] = [];
    for (let h = CALENDAR_HOUR_START; h < CALENDAR_HOUR_END; h++) {
      groups.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        blocks: hourMap.get(h) ?? [],
      });
    }
    return groups;
  });

  /**
   * 3-day stacked sections for the mobile view.
   * Each section represents one of the 3 visible days with its appointments.
   * Blocks are already sorted by topPx (= chronological order).
   */
  readonly mobileDayGroups = computed<MobileDayGroup[]>(() => {
    const days = this.visibleDays();
    const tz = this.timezone();
    const todayKey = this.todayKeyTz();

    // Derive tomorrow's date-key in the business timezone.
    const [ty, tm, td] = todayKey.split('-').map(Number);
    const tomorrowAnchorUtc = new Date(
      Date.UTC(ty ?? 0, (tm ?? 1) - 1, (td ?? 1) + 1, 12, 0, 0)
    );
    const tomorrowKey = toDateKey(tomorrowAnchorUtc, tz);

    return days.map((day) => {
      let heading: string;
      let subLabel: string;

      if (day.key === todayKey) {
        heading = 'Today';
        subLabel = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(day.date);
      } else if (day.key === tomorrowKey) {
        heading = 'Tomorrow';
        subLabel = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(day.date);
      } else {
        heading = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'long',
        }).format(day.date);
        subLabel = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          month: 'short',
          day: 'numeric',
        }).format(day.date);
      }

      return {
        dayKey: day.key,
        heading,
        subLabel,
        isToday: day.key === todayKey,
        blocks: day.blocks, // already sorted by topPx = chronological
      };
    });
  });

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

  /** Desktop/template VM to minimize repeated signal reads in bindings. */
  readonly desktopVm = computed(() => {
    const loading = this.loading();
    const overlay = this.overlayOpen();
    const cards = this.appointmentCards();
    return {
      dateRangeLabel: this.visibleDateRangeLabel(),
      searchQuery: this.searchQuery(),
      isDayMode: this.viewMode() === 'day',
      isWeekMode: this.viewMode() === 'week',
      isAtToday: this.isAtToday(),
      error: this.error(),
      loading,
      overlay,
      visibleDaysCount: this.visibleDaysCount(),
      visibleDays: this.visibleDays(),
      hourLabels: this.hourLabelsWithStyle(),
      cards,
      showCards: !loading && cards.length > 0,
    };
  });

  /** Mobile/template VM to minimize repeated signal reads in bindings. */
  readonly mobileVm = computed(() => ({
    isAtToday: this.isAtToday(),
    dateRangeLabel: this.visibleDateRangeLabel(),
    datePickerOpen: this.datePickerOpen(),
    error: this.error(),
    overlay: this.overlayOpen(),
    loading: this.loading(),
    dayGroups: this.mobileDayGroups(),
    firstUpcomingKey: this.firstUpcomingKey(),
  }));

  /** Shared details panel VM for desktop dialog / mobile drawer. */
  readonly detailPanelVm = computed(() => ({
    isMobile: this.isMobile(),
    selected: this.selectedAptVm(),
  }));

  // ─── Mobile date picker ──────────────────────────────────────────────────
  /** Controls the bottom-sheet date picker drawer on mobile. */
  readonly datePickerOpen = signal(false);
  /** Current value shown in the inline date picker (plain property for two-way binding). */
  datePickerDate: Date = new Date();

  openDatePicker(): void {
    this.datePickerDate = this.visibleStartDate();
    this.datePickerOpen.set(true);
  }

  onDatePickerSelect(date: Date): void {
    this.visibleStartDate.set(startOfDay(date));
    this.updateVisibleDaysCount();
    this.loadForCurrentView();
    this.datePickerOpen.set(false);
  }

  // ─── Auto-scroll to first upcoming appointment ────────────────────────────
  /**
   * Returns the `_id` of the first appointment in today's blocks whose
   * start time is >= now. Used to mark the element for auto-scroll.
   */
  readonly firstUpcomingKey = computed<string | null>(() => {
    if (!this.isMobile() || !this.isAtToday()) return null;
    const groups = this.mobileDayGroups();
    const nowMs = Date.now();
    const todayGroup = groups.find((g) => g.isToday);
    if (!todayGroup) return null;
    for (const block of todayGroup.blocks) {
      const start = asDate(block.appointment.start);
      if (start && start.getTime() >= nowMs) return block.appointment._id;
    }
    return null;
  });

  /** Prevents repeated auto-scroll for the same load cycle. */
  private _hasAutoScrolled = false;

  private scrollToCurrentTime(): void {
    const container = this.doc.querySelector('.apt-3day-view') as HTMLElement | null;
    if (!container) return;

    const target = this.doc.querySelector('[data-upcoming-apt]') as HTMLElement | null;
    if (target) {
      const offset =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        56; // leave room for sticky day header
      container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    }
    // If no upcoming appointment found, stay at top (Today section is first).
  }

  constructor() {
    // Auto-scroll to first upcoming appointment when mobile today-view loads.
    effect(() => {
      const loaded = !this.loading();
      const mobile = this.isMobile();
      const atToday = this.isAtToday();

      if (!loaded || !mobile || !atToday) {
        this._hasAutoScrolled = false; // reset when conditions change
        return;
      }
      if (this._hasAutoScrolled) return;
      this._hasAutoScrolled = true;
      // Delay to let Angular finish rendering the new DOM.
      setTimeout(() => this.scrollToCurrentTime(), 160);
    });

    afterNextRender(() => {
      const win = this.doc.defaultView;
      if (!win) return;
      const update = () => {
        const wasMobile = this.isMobile();
        const nowMobile = win.innerWidth < MOBILE_BREAKPOINT_PX;
        this.isMobile.set(nowMobile);
        this.updateVisibleDaysCount();
        // Reload only when crossing the mobile boundary to fix day count.
        if (wasMobile !== nowMobile) this.loadForCurrentView();
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
    // Mobile shows a 3-day stacked agenda view.
    if (this.isMobile()) {
      this.visibleDaysCount.set(3);
      return;
    }
    if (this.viewMode() === 'day') {
      this.visibleDaysCount.set(1);
      return;
    }
    // Tablet (768–1023px): 5-day grid; desktop (≥1024px): 7-day grid.
    const width = this.doc.defaultView?.innerWidth ?? 1200;
    this.visibleDaysCount.set(width < TABLET_BREAKPOINT_PX ? 5 : 7);
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

  /** Navigate mobile view to a specific day (from chip tap). */
  selectMobileDay(date: Date): void {
    this.visibleStartDate.set(startOfDay(date));
    this.loadForCurrentView();
  }

  /** Jump to today in any view. */
  goToToday(): void {
    this.visibleStartDate.set(startOfDay(new Date()));
    this.loadForCurrentView();
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
