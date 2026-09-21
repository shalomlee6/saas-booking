import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, shareReplay, startWith } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { AppointmentsApiService } from '../../../appointments/services/appointments-api.service';
import type { Appointment } from '../../../appointments/model/appointment';
import { getLocalParts, toDateKey } from '../../../appointments/utils/calendar.utils';
import { AuthService } from '../../../../core/auth/auth.service';
import { WORKING_HOURS_DAY_KEYS } from '../../../../core/working-hours/working-hours.util';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  GrowthBrainService,
  type InsightsPeriod,
} from '../../services/growth-brain.service';

const VIP_THRESHOLD = 500;
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

const PERIOD_LABEL_KEYS: Record<InsightsPeriod, string> = {
  week: 'dashboard.periodLabelWeek',
  month: 'dashboard.periodLabelMonth',
  year: 'dashboard.periodLabelYear',
};

type StatusTone = 'success' | 'warn' | 'neutral' | 'danger';

/** 'done' is a legacy status value some records still carry — treated the same as 'completed'. */
const STATUS_KEYS: Record<string, string> = {
  pending: 'status.pending',
  confirmed: 'status.confirmed',
  completed: 'status.completed',
  done: 'status.completed',
  cancelled: 'status.cancelled',
  canceled: 'status.cancelled',
};

const STATUS_TONES: Record<string, StatusTone> = {
  pending: 'warn',
  confirmed: 'neutral',
  completed: 'success',
  done: 'success',
  cancelled: 'danger',
  canceled: 'danger',
};

function statusLabel(status: string | undefined, language: LanguageService): string {
  const key = (status ?? '').toLowerCase();
  const translationKey = STATUS_KEYS[key];
  return translationKey ? language.t(translationKey) : status ?? '—';
}

function statusTone(status: string | undefined): StatusTone {
  return STATUS_TONES[(status ?? '').toLowerCase()] ?? 'neutral';
}

/** Best-effort wa.me link from an Israeli local/international phone string. No message is sent — this only opens WhatsApp's own compose screen. */
function whatsappHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

function initialsOf(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`;
}

interface AgendaRow {
  apt: Appointment;
  isPast: boolean;
  isNext: boolean;
  tone: StatusTone;
  label: string;
  whatsapp: string | null;
}

interface AgendaState {
  loading: boolean;
  error: boolean;
  rows: AgendaRow[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ChartModule, AsyncPipe, CurrencyPipe, DatePipe, RouterLink, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  readonly appointmentsApi = inject(AppointmentsApiService);
  readonly growthBrain = inject(GrowthBrainService);
  readonly language = inject(LanguageService);
  private readonly language$ = toObservable(this.language.language);

  private readonly now = new Date();
  private readonly timezone = this.auth.businessTimezone;

  readonly appointments$ = this.appointmentsApi.appointments$;
  readonly insights$ = this.growthBrain.insights$;
  readonly selectedPeriod = this.growthBrain.selectedPeriod;
  readonly periodLabel = computed(() => this.language.t(PERIOD_LABEL_KEYS[this.selectedPeriod()] ?? ''));
  readonly vipThreshold = VIP_THRESHOLD;

  readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  private readonly todayKey = computed(() => toDateKey(this.now, this.timezone()));

  private readonly todayAppointments$ = this.appointments$.pipe(
    map((list) =>
      list
        .filter((a) => toDateKey(a.start, this.timezone()) === this.todayKey())
        .sort((a, b) => a.start.getTime() - b.start.getTime())
    ),
    shareReplay(1)
  );

  readonly todaySummaryText$ = combineLatest([this.todayAppointments$, this.language$]).pipe(
    map(([list]) => {
      if (list.length === 0) return this.language.t('dashboard.noAppointmentsToday');
      const pending = list.filter((a) => (a.status ?? '').toLowerCase() === 'pending').length;
      return pending > 0
        ? this.language.t('dashboard.todaySummaryPending', { count: list.length, pending })
        : this.language.t('dashboard.todaySummaryPlain', { count: list.length });
    }),
    catchError(() => of(this.language.t('dashboard.noAppointmentsToday')))
  );

  readonly todayAgendaState$ = combineLatest([this.todayAppointments$, this.language$]).pipe(
    map(([list]): AgendaState => {
      const nextId =
        list.find(
          (a) =>
            a.end.getTime() > this.now.getTime() &&
            !CANCELLED_STATUSES.has((a.status ?? '').toLowerCase())
        )?._id ?? null;

      const rows: AgendaRow[] = list.map((a) => ({
        apt: a,
        isPast: a.end.getTime() <= this.now.getTime(),
        isNext: a._id === nextId,
        tone: statusTone(a.status),
        label: statusLabel(a.status, this.language),
        whatsapp: whatsappHref(a.customerPhone),
      }));

      return { loading: false, error: false, rows };
    }),
    startWith({ loading: true, error: false, rows: [] as AgendaRow[] }),
    catchError(() => of({ loading: false, error: true, rows: [] as AgendaRow[] }))
  );

  readonly insightsState$ = this.insights$.pipe(
    map((insights) => ({ loading: false, error: false, insights })),
    startWith({ loading: true, error: false, insights: null }),
    catchError(() => of({ loading: false, error: true, insights: null }))
  );

  readonly avgPerAppointment$ = this.insights$.pipe(
    map((i) => (i.appointmentsCount > 0 ? i.totalRevenue / i.appointmentsCount : 0)),
    catchError(() => of(0))
  );

  readonly topServiceName$ = this.insights$.pipe(
    map((i) => {
      const list = i.revenueByService ?? [];
      if (!list.length) return null;
      return list.reduce((max, r) => (r.total > max.total ? r : max), list[0]).serviceName || null;
    }),
    catchError(() => of(null))
  );

  /**
   * Chart data: revenue by weekday (Mongo $dayOfWeek 1=Sun .. 7=Sat).
   * Chart.js always draws its canvas left-to-right regardless of page `dir` — it has no
   * concept of RTL. So the label/value arrays are built already reversed (Sat..Sun) here,
   * which is what makes the rendered bars read right-to-left (Sun on the right) like the
   * rest of the RTL page.
   */
  readonly revenueByWeekdayChart$ = combineLatest([this.insights$, this.language$]).pipe(
    map(([i]) => {
      const totals = new Array(7).fill(0);
      (i.revenueByWeekday ?? []).forEach((r) => {
        const idx = r.weekday >= 1 && r.weekday <= 7 ? r.weekday - 1 : 0;
        totals[idx] = r.total;
      });
      const weekdayLabels = this.language.t('dashboard.weekdaysShort').split(',');
      const data = {
        labels: [...weekdayLabels].reverse(),
        datasets: [
          {
            label: this.language.t('dashboard.revenueChartLabel'),
            data: [...totals].reverse(),
            backgroundColor: '#ffd6df',
            hoverBackgroundColor: '#F35271',
            borderRadius: 4,
            maxBarThickness: 32,
          },
        ],
      };
      return { loading: false, error: false, data };
    }),
    startWith({ loading: true, error: false, data: null }),
    catchError(() => of({ loading: false, error: true, data: null }))
  );

  /** Decorative mini sparkline (0-100 scale) for the revenue KPI tile, Sat..Sun left-to-right (see revenueByWeekdayChart$). */
  readonly revenueSparkline$ = this.insights$.pipe(
    map((i) => {
      const totals = new Array(7).fill(0);
      (i.revenueByWeekday ?? []).forEach((r) => {
        const idx = r.weekday >= 1 && r.weekday <= 7 ? r.weekday - 1 : 0;
        totals[idx] = r.total;
      });
      const max = Math.max(1, ...totals);
      return totals.reverse().map((t) => Math.round((t / max) * 100));
    }),
    catchError(() => of([0, 0, 0, 0, 0, 0, 0]))
  );

  readonly topServicesBreakdown$ = this.insights$.pipe(
    map((i) => {
      const list = [...(i.revenueByService ?? [])].sort((a, b) => b.total - a.total).slice(0, 3);
      const max = Math.max(1, ...list.map((r) => r.total));
      return list.map((r) => ({ ...r, pct: Math.round((r.total / max) * 100) }));
    }),
    catchError(() => of([]))
  );

  readonly topCustomersView$ = this.insights$.pipe(
    map((i) =>
      (i.topCustomers ?? []).slice(0, 4).map((c) => ({
        ...c,
        initials: initialsOf(c.name),
        vip: c.total >= VIP_THRESHOLD,
      }))
    ),
    catchError(() => of([]))
  );

  readonly workingHoursClosedToday = computed(() => {
    const wh = this.auth.businessSettings()?.workingHours;
    if (!wh) return false;
    const dayIdx = getLocalParts(this.now, this.timezone()).dayOfWeek;
    const key = WORKING_HOURS_DAY_KEYS[dayIdx];
    return key ? wh[key]?.enabled === false : false;
  });

  private readonly greetingHour = getLocalParts(this.now, this.timezone()).hour;
  readonly greeting = computed(() => {
    const hour = this.greetingHour;
    if (hour < 5) return this.language.t('dashboard.greetingNight');
    if (hour < 12) return this.language.t('dashboard.greetingMorning');
    if (hour < 18) return this.language.t('dashboard.greetingAfternoon');
    return this.language.t('dashboard.greetingEvening');
  });

  readonly confirmingId = signal<string | null>(null);

  setPeriod(p: InsightsPeriod): void {
    this.growthBrain.setPeriod(p);
  }

  retryInsights(): void {
    this.growthBrain.refresh();
  }

  retryAppointments(): void {
    this.appointmentsApi.refresh();
  }

  confirmAppointment(id: string): void {
    if (this.confirmingId()) return;
    this.confirmingId.set(id);
    this.appointmentsApi.patchAppointment(id, { status: 'confirmed' }).subscribe({
      next: () => {
        this.confirmingId.set(null);
        this.appointmentsApi.refresh();
        this.messages.add({ severity: 'success', summary: this.language.t('dashboard.appointmentConfirmed'), life: 2500 });
      },
      error: () => {
        this.confirmingId.set(null);
        this.messages.add({ severity: 'error', summary: this.language.t('dashboard.appointmentConfirmError'), life: 3500 });
      },
    });
  }
}
