import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { AppointmentsApiService } from '../../../appointments/services/appointments-api.service';
import type { Appointment } from '../../../appointments/model/appointment';
import { getLocalParts, toDateKey } from '../../../appointments/utils/calendar.utils';
import { AuthService } from '../../../../core/auth/auth.service';
import { WORKING_HOURS_DAY_KEYS } from '../../../../core/working-hours/working-hours.util';
import {
  GrowthBrainService,
  type InsightsPeriod,
} from '../../services/growth-brain.service';

const WEEKDAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const VIP_THRESHOLD = 500;
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

const PERIOD_LABELS: Record<InsightsPeriod, string> = {
  week: 'השבוע',
  month: 'החודש',
  year: 'השנה',
};

type StatusTone = 'success' | 'warn' | 'neutral' | 'danger';

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין לאישור',
  confirmed: 'מאושר',
  completed: 'הושלם',
  done: 'הושלם',
  cancelled: 'בוטל',
  canceled: 'בוטל',
};

const STATUS_TONES: Record<string, StatusTone> = {
  pending: 'warn',
  confirmed: 'neutral',
  completed: 'success',
  done: 'success',
  cancelled: 'danger',
  canceled: 'danger',
};

function statusLabel(status: string | undefined): string {
  const key = (status ?? '').toLowerCase();
  return STATUS_LABELS[key] ?? status ?? '—';
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
  imports: [ChartModule, AsyncPipe, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  readonly appointmentsApi = inject(AppointmentsApiService);
  readonly growthBrain = inject(GrowthBrainService);

  private readonly now = new Date();
  private readonly timezone = this.auth.businessTimezone;

  readonly appointments$ = this.appointmentsApi.appointments$;
  readonly insights$ = this.growthBrain.insights$;
  readonly selectedPeriod = this.growthBrain.selectedPeriod;
  readonly periodLabel = computed(() => PERIOD_LABELS[this.selectedPeriod()] ?? '');
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

  readonly todaySummaryText$ = this.todayAppointments$.pipe(
    map((list) => {
      if (list.length === 0) return 'אין תורים היום.';
      const pending = list.filter((a) => (a.status ?? '').toLowerCase() === 'pending').length;
      const base = `${list.length} תורים היום`;
      return pending > 0 ? `${base}, ${pending} מחכים לאישור שלך.` : `${base}.`;
    }),
    catchError(() => of('אין תורים היום.'))
  );

  readonly todayAgendaState$ = this.todayAppointments$.pipe(
    map((list): AgendaState => {
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
        label: statusLabel(a.status),
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
  readonly revenueByWeekdayChart$ = this.insights$.pipe(
    map((i) => {
      const totals = new Array(7).fill(0);
      (i.revenueByWeekday ?? []).forEach((r) => {
        const idx = r.weekday >= 1 && r.weekday <= 7 ? r.weekday - 1 : 0;
        totals[idx] = r.total;
      });
      const data = {
        labels: [...WEEKDAY_LABELS].reverse(),
        datasets: [
          {
            label: 'הכנסות',
            data: [...totals].reverse(),
            backgroundColor: '#ffd6df',
            hoverBackgroundColor: '#e8446a',
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

  readonly greeting = (() => {
    const hour = getLocalParts(this.now, this.timezone()).hour;
    if (hour < 5) return 'לילה טוב';
    if (hour < 12) return 'בוקר טוב';
    if (hour < 18) return 'צהריים טובים';
    return 'ערב טוב';
  })();

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
        this.messages.add({ severity: 'success', summary: 'התור אושר', life: 2500 });
      },
      error: () => {
        this.confirmingId.set(null);
        this.messages.add({ severity: 'error', summary: 'לא ניתן היה לאשר את התור', life: 3500 });
      },
    });
  }
}
