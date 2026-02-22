import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/api/api.service';
import {
  OpeningHours,
  OpeningHoursDay,
  OpeningHoursRange,
  Override,
  DEFAULT_OPENING_HOURS,
  DAY_NAMES_HE,
} from './working-hours.types';
import { TabsModule } from 'primeng/tabs';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';

function formatDateForApi(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  return { from: formatDateForApi(from), to: formatDateForApi(to) };
}

@Component({
  selector: 'app-working-hours-list',
  standalone: true,
  imports: [
    FormsModule,
    TabsModule,
    DrawerModule,
    ButtonModule,
    DatePickerModule,
    ToggleSwitchModule,
    RadioButtonModule,
    InputTextModule,
    SkeletonModule,
  ],
  templateUrl: './working-hours-list.component.html',
  styleUrl: './working-hours-list.component.scss',
})
export class WorkingHoursListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly messageService = inject(MessageService);

  readonly activeTab = signal<number>(0);
  readonly loadingOpeningHours = signal(true);
  readonly openingHours = signal<OpeningHours>({ ...DEFAULT_OPENING_HOURS, days: DEFAULT_OPENING_HOURS.days.map(d => ({ ...d, ranges: d.ranges.map(r => ({ ...r })) })) });
  readonly savingHours = signal(false);

  readonly dayDrawerVisible = signal(false);
  readonly editingDayIndex = signal<number | null>(null);
  readonly editDayIsOpen = signal(true);
  readonly editDayRanges = signal<OpeningHoursRange[]>([{ start: '08:00', end: '18:00' }]);

  readonly overrides = signal<Override[]>([]);
  readonly loadingOverrides = signal(false);
  readonly calendarMonth = signal<Date>(new Date());
  readonly overrideDrawerVisible = signal(false);
  readonly overrideDate = signal<Date | null>(null);
  readonly overrideType = signal<'closed' | 'custom'>('closed');
  readonly overrideRanges = signal<OpeningHoursRange[]>([{ start: '08:00', end: '18:00' }]);
  readonly overrideNote = signal('');
  readonly selectedOverrideId = signal<string | null>(null);
  readonly savingOverride = signal(false);
  readonly deletingOverride = signal(false);

  readonly dayNamesHe = DAY_NAMES_HE;

  readonly daysWithSummary = computed(() => {
    const oh = this.openingHours();
    return (oh.days ?? []).map((d, i) => {
      const name = DAY_NAMES_HE[i] ?? '';
      if (!d.isOpen || !d.ranges?.length) return { day: d.day, name, summary: 'סגור' };
      const s = d.ranges.map(r => `${r.start}–${r.end}`).join(', ');
      return { day: d.day, name, summary: `פתוח: ${s}` };
    });
  });

  readonly overridesByDate = computed(() => {
    const list = this.overrides();
    const map = new Map<string, Override>();
    list.forEach(o => map.set(o.date, o));
    return map;
  });

  readonly calendarMonthRange = computed(() => getMonthRange(this.calendarMonth()));

  constructor() {
    effect(() => {
      if (this.activeTab() !== 1) return;
      const { from, to } = this.calendarMonthRange();
      if (from && to) this.loadOverrides(from, to);
    });
  }

  ngOnInit(): void {
    this.loadOpeningHours();
  }

  onTabChange(value: number | string | undefined): void {
    this.activeTab.set(typeof value === 'number' ? value : 0);
  }

  loadOpeningHours(): void {
    this.loadingOpeningHours.set(true);
    this.api.get<{ openingHours?: OpeningHours }>('settings/me/settings').subscribe({
      next: (res) => {
        if (res?.openingHours?.days?.length === 7) {
          this.openingHours.set(res.openingHours);
        }
        this.loadingOpeningHours.set(false);
      },
      error: () => {
        this.openingHours.set(DEFAULT_OPENING_HOURS);
        this.loadingOpeningHours.set(false);
      },
    });
  }

  loadOverrides(from: string, to: string): void {
    this.loadingOverrides.set(true);
    this.api.get<Override[]>(`business/overrides?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).subscribe({
      next: (list) => this.overrides.set(Array.isArray(list) ? list : []),
      error: () => this.overrides.set([]),
      complete: () => this.loadingOverrides.set(false),
    });
  }

  openDayDrawer(dayIndex: number): void {
    const oh = this.openingHours();
    const day = oh.days?.[dayIndex];
    this.editingDayIndex.set(dayIndex);
    this.editDayIsOpen.set(day?.isOpen ?? true);
    this.editDayRanges.set(
      day?.ranges?.length ? day.ranges.map(r => ({ ...r })) : [{ start: '08:00', end: '18:00' }]
    );
    this.dayDrawerVisible.set(true);
  }

  closeDayDrawer(): void {
    this.dayDrawerVisible.set(false);
    this.editingDayIndex.set(null);
  }

  addEditRange(): void {
    this.editDayRanges.update(r => [...r, { start: '08:00', end: '18:00' }]);
  }

  removeEditRange(index: number): void {
    this.editDayRanges.update(r => r.filter((_, i) => i !== index));
  }

  saveDay(): void {
    const idx = this.editingDayIndex();
    if (idx === null) return;
    this.savingHours.set(true);
    const oh = this.openingHours();
    const days = (oh.days ?? []).map((d, i) => {
      if (i !== idx) return d;
      const ranges = this.editDayRanges().filter(r => r.start && r.end);
      return {
        day: idx,
        isOpen: this.editDayIsOpen(),
        ranges: this.editDayIsOpen() ? ranges : [],
      };
    });
    const payload: OpeningHours = { slotStepMinutes: oh.slotStepMinutes ?? 30, days };
    this.api.patch<{ openingHours: OpeningHours }>('business/settings/opening-hours', { openingHours: payload }).subscribe({
      next: (res) => {
        if (res?.openingHours) this.openingHours.set(res.openingHours);
        this.savingHours.set(false);
        this.closeDayDrawer();
        this.messageService.add({ severity: 'success', summary: 'נשמר', detail: 'שעות קבועות עודכנו', life: 3000 });
      },
      error: (err) => {
        this.savingHours.set(false);
        this.messageService.add({ severity: 'error', summary: 'שגיאה', detail: err?.error?.message ?? 'שגיאה בשמירה', life: 5000 });
      },
    });
  }

  onCalendarDateChange(date: Date | null): void {
    if (date) this.calendarMonth.set(date);
  }

  onCalendarMonthChange(event: { month?: number; year?: number }): void {
    if (event?.year != null && event?.month != null) {
      this.calendarMonth.set(new Date(event.year, event.month, 1));
    }
  }

  openOverrideDrawer(date: Date): void {
    const dateStr = formatDateForApi(date);
    const existing = this.overridesByDate().get(dateStr);
    this.overrideDate.set(date);
    this.overrideType.set(existing?.type ?? 'closed');
    this.overrideRanges.set(existing?.type === 'custom' && existing.ranges?.length ? existing.ranges.map(r => ({ ...r })) : [{ start: '08:00', end: '18:00' }]);
    this.overrideNote.set(existing?.note ?? '');
    this.selectedOverrideId.set(existing?.id ?? null);
    this.overrideDrawerVisible.set(true);
  }

  closeOverrideDrawer(): void {
    this.overrideDrawerVisible.set(false);
    this.overrideDate.set(null);
    this.selectedOverrideId.set(null);
  }

  addOverrideRange(): void {
    this.overrideRanges.update(r => [...r, { start: '08:00', end: '18:00' }]);
  }

  removeOverrideRange(index: number): void {
    this.overrideRanges.update(r => r.filter((_, i) => i !== index));
  }

  saveOverride(): void {
    const date = this.overrideDate();
    if (!date) return;
    const dateStr = formatDateForApi(date);
    const type = this.overrideType();
    const ranges = type === 'custom' ? this.overrideRanges().filter(r => r.start && r.end) : [];
    if (type === 'custom' && !ranges.length) {
      this.messageService.add({ severity: 'warn', summary: 'חסר', detail: 'הוסף טווח שעות', life: 3000 });
      return;
    }
    this.savingOverride.set(true);
    this.api.post<Override>('business/overrides', { date: dateStr, type, ranges, note: this.overrideNote() || undefined }).subscribe({
      next: (saved) => {
        this.overrides.update(list => {
          const out = list.filter(o => o.date !== dateStr);
          out.push(saved);
          return out.sort((a, b) => a.date.localeCompare(b.date));
        });
        this.savingOverride.set(false);
        this.selectedOverrideId.set(saved.id);
        this.closeOverrideDrawer();
        this.messageService.add({ severity: 'success', summary: 'נשמר', detail: 'חריג עודכן', life: 3000 });
      },
      error: (err) => {
        this.savingOverride.set(false);
        this.messageService.add({ severity: 'error', summary: 'שגיאה', detail: err?.error?.message ?? 'שגיאה בשמירה', life: 5000 });
      },
    });
  }

  deleteOverride(): void {
    const id = this.selectedOverrideId();
    if (!id) return;
    this.deletingOverride.set(true);
    this.api.delete<{ ok?: boolean }>(`business/overrides/${id}`).subscribe({
      next: () => {
        const date = this.overrideDate();
        if (date) {
          const dateStr = formatDateForApi(date);
          this.overrides.update(list => list.filter(o => o.id !== id));
        }
        this.deletingOverride.set(false);
        this.closeOverrideDrawer();
        this.messageService.add({ severity: 'success', summary: 'נמחק', detail: 'חריג הוסר', life: 3000 });
      },
      error: (err) => {
        this.deletingOverride.set(false);
        this.messageService.add({ severity: 'error', summary: 'שגיאה', detail: err?.error?.message ?? 'שגיאה במחיקה', life: 5000 });
      },
    });
  }

  getOverrideForDate(dateStr: string): Override | undefined {
    return this.overridesByDate().get(dateStr);
  }

  formatDateHe(d: Date): string {
    return d.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
}
