import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  effect,
  afterNextRender,
} from '@angular/core';
import { DOCUMENT, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/api/api.service';
import { AppointmentsApiService } from '../../../appointments/services/appointments-api.service';
import {
  OpeningHours,
  OpeningHoursRange,
  Override,
  DEFAULT_OPENING_HOURS,
  DAY_NAMES_HE,
} from './working-hours.types';
import { TabsModule } from 'primeng/tabs';
import { DrawerModule } from 'primeng/drawer';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';

export interface SelectOption {
  label: string;
  value: number;
}

export interface EditableRangeVm {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

@Component({
  selector: 'app-working-hours-list',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    NgClass,
    TabsModule,
    DrawerModule,
    DialogModule,
    ButtonModule,
    DatePickerModule,
    ToggleSwitchModule,
    RadioButtonModule,
    InputTextModule,
    SkeletonModule,
    SelectModule,
  ],
  templateUrl: './working-hours-list.component.html',
  styleUrl: './working-hours-list.component.scss',
})
export class WorkingHoursListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly messageService = inject(MessageService);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly doc = inject(DOCUMENT);

  readonly activeTab = signal<number>(0);
  readonly loadingOpeningHours = signal(true);
  readonly openingHours = signal<OpeningHours>({
    ...DEFAULT_OPENING_HOURS,
    days: DEFAULT_OPENING_HOURS.days.map(d => ({
      ...d,
      ranges: d.ranges.map(r => ({ start: to24h(r.start), end: to24h(r.end) })),
    })),
  });
  readonly savingHours = signal(false);
  readonly isMobile = signal(false);

  readonly dayDrawerVisible = signal(false);
  readonly dayDialogVisible = signal(false);
  readonly editingDayIndex = signal<number | null>(null);
  readonly editDayIsOpen = signal(true);
  readonly editDayRangeVms = signal<EditableRangeVm[]>([
    rangeToVm({ start: '08:00', end: '18:00' }, 30),
  ]);

  readonly overrides = signal<Override[]>([]);
  readonly loadingOverrides = signal(false);
  readonly calendarMonth = signal<Date>(new Date());
  readonly overrideDrawerVisible = signal(false);
  readonly overrideDialogVisible = signal(false);
  readonly overrideDate = signal<Date | null>(null);
  readonly overrideType = signal<'closed' | 'custom'>('closed');
  readonly overrideRangeVms = signal<EditableRangeVm[]>([
    rangeToVm({ start: '08:00', end: '18:00' }, 30),
  ]);
  readonly overrideNote = signal('');
  readonly selectedOverrideId = signal<string | null>(null);
  readonly savingOverride = signal(false);
  readonly deletingOverride = signal(false);
  readonly overrideConflictWarning = signal<string | null>(null);
  readonly loadingOverrideConflicts = signal(false);

  readonly dayNamesHe = DAY_NAMES_HE;

  /**
   * Stable style object for the day-editor bottom drawer.
   * Uses dvh (dynamic viewport height) so the drawer never exceeds the actual
   * visible area on mobile browsers where the address bar changes the viewport.
   * Falls back to vh for browsers that don't support dvh yet.
   */
  readonly dayDrawerStyle = {
    height: 'min(85dvh, 85vh, 600px)',
    maxHeight: '90dvh',
  };

  /** 00–23 for p-select. */
  readonly hourOptions: SelectOption[] = Array.from({ length: 24 }, (_, i) => ({
    label: String(i).padStart(2, '0'),
    value: i,
  }));

  /** Minute options from slotStepMinutes (30 → 00/30, 15 → 00/15/30/45). */
  readonly minuteOptionsList = computed<SelectOption[]>(() => {
    const step = this.openingHours().slotStepMinutes ?? 30;
    return minuteOptionsFromStep(step).map(m => ({
      label: String(m).padStart(2, '0'),
      value: m,
    }));
  });

  readonly editDayRangesFromVm = computed<OpeningHoursRange[]>(() =>
    this.editDayRangeVms().map(vmToRange),
  );
  readonly overrideRangesFromVm = computed<OpeningHoursRange[]>(() =>
    this.overrideRangeVms().map(vmToRange),
  );

  readonly editDayErrors = computed(() =>
    getRangesValidationErrors(this.editDayRangesFromVm()),
  );
  readonly editDayErrorsByIndex = computed(() => this.editDayErrors().byIndex);
  readonly editDayGeneralError = computed(() => this.editDayErrors().general ?? null);
  readonly hasEditDayErrorsSignal = computed(
    () => Object.keys(this.editDayErrorsByIndex()).length > 0,
  );

  readonly overrideErrors = computed(() =>
    getRangesValidationErrors(this.overrideRangesFromVm()),
  );
  readonly overrideErrorsByIndex = computed(() => this.overrideErrors().byIndex);
  readonly overrideGeneralError = computed(() => this.overrideErrors().general ?? null);
  readonly hasOverrideErrorsSignal = computed(
    () => Object.keys(this.overrideErrorsByIndex()).length > 0,
  );

  readonly overrideConflictWarningText = computed(() => this.overrideConflictWarning());

  /**
   * Returns a CSS modifier class for the date-template dot, or null when no override exists.
   * PrimeNG passes { day, month (0-based), year } to the date template.
   */
  getDateOverrideDot(date: { day: number; month: number; year: number }): string | null {
    const d = new Date(date.year, date.month, date.day);
    const key = formatDateForApi(d);
    const ov = this.overridesByDate().get(key);
    if (!ov) return null;
    return ov.type === 'closed' ? 'wh-cal-day-dot--closed' : 'wh-cal-day-dot--custom';
  }

  readonly editDayHeader = computed(() => {
    const idx = this.editingDayIndex();
    if (idx == null) return 'עריכת יום';
    return `עריכת ${this.dayNamesHe[idx] ?? ''}`;
  });

  readonly overrideHeader = computed(() => {
    const d = this.overrideDate();
    if (!d) return 'חריג';
    return d.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  readonly daysWithSummary = computed(() => {
    const oh = this.openingHours();
    return (oh.days ?? []).map((d, i) => {
      const name = DAY_NAMES_HE[i] ?? '';
      const isOpen = d.isOpen ?? false;
      if (!isOpen || !d.ranges?.length) return { day: d.day, name, isOpen, summary: 'סגור' };
      const s = d.ranges.map(r => `${to24h(r.start)}–${to24h(r.end)}`).join(', ');
      return { day: d.day, name, isOpen, summary: `פתוח: ${s}` };
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
    afterNextRender(() => {
      const win = this.doc.defaultView;
      if (!win) return;
      const update = () => this.isMobile.set(win.innerWidth < 768);
      update();
      win.addEventListener('resize', update);
    });
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

  /** Refresh validation after VM mutation (objects are mutated in place). */
  touchEditDayVms(): void {
    this.editDayRangeVms.update(v => [...v]);
  }

  touchOverrideVms(): void {
    this.overrideRangeVms.update(v => [...v]);
    this.checkOverrideConflicts();
  }

  loadOpeningHours(): void {
    this.loadingOpeningHours.set(true);
    this.api.get<{ openingHours?: OpeningHours }>('settings/me/settings').subscribe({
      next: res => {
        if (res?.openingHours?.days?.length === 7) {
          const oh = res.openingHours;
          const days = oh.days.map(d => ({
            ...d,
            ranges: (d.ranges ?? []).map(r => ({
              start: to24h(r.start),
              end: to24h(r.end),
            })),
          }));
          this.openingHours.set({ ...oh, days });
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
    this.api
      .get<Override[]>(
        `business/overrides?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      .subscribe({
        next: list => this.overrides.set(Array.isArray(list) ? list : []),
        error: () => this.overrides.set([]),
        complete: () => this.loadingOverrides.set(false),
      });
  }

  openDayDrawer(dayIndex: number): void {
    const oh = this.openingHours();
    const day = oh.days?.[dayIndex];
    const step = oh.slotStepMinutes ?? 30;
    this.editingDayIndex.set(dayIndex);
    this.editDayIsOpen.set(day?.isOpen ?? true);
    const sourceRanges =
      day?.ranges?.length
        ? day.ranges.map(r => ({
            start: snapTimeToStep(to24h(r.start), step),
            end: snapTimeToStep(to24h(r.end), step),
          }))
        : [{ start: '08:00', end: '18:00' }];
    this.editDayRangeVms.set(sourceRanges.map(r => rangeToVm(r, step)));
    this.dayDrawerVisible.set(this.isMobile());
    this.dayDialogVisible.set(!this.isMobile());
  }

  closeDayDrawer(): void {
    this.dayDrawerVisible.set(false);
    this.dayDialogVisible.set(false);
    this.editingDayIndex.set(null);
  }

  setDayOpen(dayIndex: number, isOpen: boolean): void {
    const oh = this.openingHours();
    const days = (oh.days ?? []).map((d, i) => (i === dayIndex ? { ...d, isOpen } : d));
    this.savingHours.set(true);
    const payload: OpeningHours = { slotStepMinutes: oh.slotStepMinutes ?? 30, days };
    this.api
      .patch<{ openingHours: OpeningHours }>('business/settings/opening-hours', {
        openingHours: payload,
      })
      .subscribe({
        next: res => {
          if (res?.openingHours) this.openingHours.set(res.openingHours);
          this.savingHours.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'נשמר',
            detail: 'העדכון נשמר',
            life: 3000,
          });
        },
        error: err => {
          this.savingHours.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: err?.error?.message ?? 'שגיאה בשמירה',
            life: 5000,
          });
        },
      });
  }

  addEditRange(): void {
    const step = this.openingHours().slotStepMinutes ?? 30;
    const defVm = rangeToVm(
      { start: snapTimeToStep('08:00', step), end: snapTimeToStep('18:00', step) },
      step,
    );
    this.editDayRangeVms.update(v => [...v, defVm]);
  }

  removeEditRange(index: number): void {
    this.editDayRangeVms.update(v => v.filter((_, i) => i !== index));
  }

  saveDay(): void {
    const idx = this.editingDayIndex();
    if (idx === null) return;
    if (this.hasEditDayErrorsSignal()) return;
    this.savingHours.set(true);
    const oh = this.openingHours();
    const ranges = this.editDayIsOpen()
      ? this.editDayRangesFromVm()
          .filter(r => r.start?.trim() && r.end?.trim())
          .map(r => ({ start: to24h(r.start), end: to24h(r.end) }))
      : [];
    const days = (oh.days ?? []).map((d, i) =>
      i === idx ? { day: idx, isOpen: this.editDayIsOpen(), ranges } : d,
    );
    const payload: OpeningHours = { slotStepMinutes: oh.slotStepMinutes ?? 30, days };
    this.api
      .patch<{ openingHours: OpeningHours }>('business/settings/opening-hours', {
        openingHours: payload,
      })
      .subscribe({
        next: res => {
          if (res?.openingHours) this.openingHours.set(res.openingHours);
          this.savingHours.set(false);
          this.closeDayDrawer();
          this.messageService.add({
            severity: 'success',
            summary: 'נשמר',
            detail: 'שעות קבועות עודכנו',
            life: 3000,
          });
        },
        error: err => {
          this.savingHours.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: err?.error?.message ?? 'שגיאה בשמירה',
            life: 5000,
          });
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
    const step = this.openingHours().slotStepMinutes ?? 30;
    this.overrideDate.set(date);
    this.overrideType.set(existing?.type ?? 'custom');
    const sourceRanges =
      existing?.type === 'custom' && existing.ranges?.length
        ? existing.ranges.map(r => ({
            start: snapTimeToStep(to24h(r.start), step),
            end: snapTimeToStep(to24h(r.end), step),
          }))
        : [{ start: '08:00', end: '18:00' }];
    this.overrideRangeVms.set(sourceRanges.map(r => rangeToVm(r, step)));
    this.overrideNote.set(existing?.note ?? '');
    this.selectedOverrideId.set(existing?.id ?? null);
    this.overrideConflictWarning.set(null);
    const mobile = this.isMobile();
    this.overrideDrawerVisible.set(mobile);
    this.overrideDialogVisible.set(!mobile);
    this.checkOverrideConflicts();
  }

  closeOverrideDrawer(): void {
    this.overrideDrawerVisible.set(false);
    this.overrideDialogVisible.set(false);
    this.overrideDate.set(null);
    this.selectedOverrideId.set(null);
    this.overrideConflictWarning.set(null);
  }

  checkOverrideConflicts(): void {
    const date = this.overrideDate();
    if (!date) return;
    const type = this.overrideType();
    const ranges =
      type === 'custom' ? this.overrideRangesFromVm().filter(r => r.start?.trim() && r.end?.trim()) : [];
    if (type === 'closed' && ranges.length === 0) {
      this.loadingOverrideConflicts.set(true);
      const dateStr = formatDateForApi(date);
      this.appointmentsApi.list({ from: dateStr, to: dateStr }).subscribe({
        next: list => {
          this.loadingOverrideConflicts.set(false);
          if (list.length > 0) {
            this.overrideConflictWarning.set(
              'יש כבר תורים ביום הזה. סגירת היום תשאיר אותם בתור.',
            );
          } else {
            this.overrideConflictWarning.set(null);
          }
        },
        error: () => this.loadingOverrideConflicts.set(false),
      });
      return;
    }
    if (type !== 'custom' || ranges.length === 0) {
      this.overrideConflictWarning.set(null);
      return;
    }
    const dateStr = formatDateForApi(date);
    this.loadingOverrideConflicts.set(true);
    this.appointmentsApi.list({ from: dateStr, to: dateStr }).subscribe({
      next: list => {
        this.loadingOverrideConflicts.set(false);
        const toTimeStr = (d: Date) =>
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const conflictCount = list.filter(apt => {
          const aptStart =
            apt.start instanceof Date ? toTimeStr(apt.start) : to24h(String(apt.start));
          const aptEnd = apt.end instanceof Date ? toTimeStr(apt.end) : to24h(String(apt.end));
          const overlapsAny = ranges.some(
            r => compareTime(aptStart, r.end) < 0 && compareTime(aptEnd, r.start) > 0,
          );
          return !overlapsAny;
        }).length;
        if (conflictCount > 0) {
          this.overrideConflictWarning.set(
            conflictCount === 1
              ? 'תור אחד חורג מהטווחים החדשים או מתנגש עם השעות'
              : `יש ${conflictCount} תורים שמחוץ לטווחים או בהתנגשות`,
          );
        } else {
          this.overrideConflictWarning.set(null);
        }
      },
      error: () => this.loadingOverrideConflicts.set(false),
    });
  }

  addOverrideRange(): void {
    const step = this.openingHours().slotStepMinutes ?? 30;
    const defVm = rangeToVm(
      { start: snapTimeToStep('08:00', step), end: snapTimeToStep('18:00', step) },
      step,
    );
    this.overrideRangeVms.update(v => [...v, defVm]);
    this.checkOverrideConflicts();
  }

  removeOverrideRange(index: number): void {
    this.overrideRangeVms.update(v => v.filter((_, i) => i !== index));
    this.checkOverrideConflicts();
  }

  saveOverride(): void {
    const date = this.overrideDate();
    if (!date) return;
    const type = this.overrideType();
    if (type === 'custom' && this.hasOverrideErrorsSignal()) return;
    const ranges =
      type === 'custom'
        ? this.overrideRangesFromVm()
            .filter(r => r.start?.trim() && r.end?.trim())
            .map(r => ({ start: to24h(r.start), end: to24h(r.end) }))
        : [];
    if (type === 'custom' && !ranges.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'חסר',
        detail: 'הוסף טווח שעות',
        life: 3000,
      });
      return;
    }
    const dateStr = formatDateForApi(date);
    this.savingOverride.set(true);
    this.api
      .post<Override>('business/overrides', {
        date: dateStr,
        type,
        ranges,
        note: this.overrideNote() || undefined,
      })
      .subscribe({
        next: saved => {
          this.overrides.update(list => {
            const out = list.filter(o => o.date !== dateStr);
            out.push(saved);
            return out.sort((a, b) => a.date.localeCompare(b.date));
          });
          this.savingOverride.set(false);
          this.selectedOverrideId.set(saved.id);
          this.closeOverrideDrawer();
          this.messageService.add({
            severity: 'success',
            summary: 'נשמר',
            detail: 'חריג עודכן',
            life: 3000,
          });
        },
        error: err => {
          this.savingOverride.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: err?.error?.message ?? 'שגיאה בשמירה',
            life: 5000,
          });
        },
      });
  }

  deleteOverride(): void {
    const id = this.selectedOverrideId();
    if (!id) return;
    this.deletingOverride.set(true);
    this.api.delete<{ ok?: boolean }>(`business/overrides/${id}`).subscribe({
      next: () => {
        this.overrideDate();
        this.overrides.update(list => list.filter(o => o.id !== id));
        this.deletingOverride.set(false);
        this.closeOverrideDrawer();
        this.messageService.add({
          severity: 'success',
          summary: 'נמחק',
          detail: 'חריג הוסר',
          life: 3000,
        });
      },
      error: err => {
        this.deletingOverride.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'שגיאה',
          detail: err?.error?.message ?? 'שגיאה במחיקה',
          life: 5000,
        });
      },
    });
  }

}

function formatDateForApi(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function compareTime(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah !== bh ? ah - bh : am - bm;
}

function getRangesValidationErrors(
  ranges: OpeningHoursRange[],
): { byIndex: Record<number, string>; general?: string } {
  const byIndex: Record<number, string> = {};
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!r.start?.trim() || !r.end?.trim()) {
      byIndex[i] = 'חסרים שעות התחלה או סיום';
      continue;
    }
    if (compareTime(r.start, r.end) >= 0) {
      byIndex[i] = 'שעת סיום חייבת להיות אחרי שעת התחלה';
    }
  }
  const sorted = ranges
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => r.start?.trim() && r.end?.trim() && !byIndex[r.index])
    .sort((a, b) => compareTime(a.start, b.start));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (compareTime(curr.start, prev.end) < 0) {
      byIndex[curr.index] = 'טווחים חופפים';
      if (!byIndex[prev.index]) byIndex[prev.index] = 'טווחים חופפים';
    }
  }
  const hasInvalid = Object.keys(byIndex).length > 0;
  const hasEmpty = ranges.some(r => !r.start?.trim() || !r.end?.trim());
  const general =
    hasInvalid && hasEmpty ? 'תקן את השדות הריקים והטווחים החופפים' : undefined;
  return { byIndex, general };
}

function getMonthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  return { from: formatDateForApi(from), to: formatDateForApi(to) };
}

function to24h(time: string): string {
  if (!time?.trim()) return '08:00';
  const parts = time.trim().split(/[:\s]+/);
  let h = parseInt(parts[0], 10);
  const m = parts[1] != null ? parseInt(parts[1], 10) : 0;
  const isPm =
    /pm|PM|p\.m|P\.M|במקביל|אחה''צ|ערב/i.test(time) ||
    (parts[2] != null && /pm|PM/i.test(parts[2]));
  if (isPm && h < 12) h += 12;
  if (!isPm && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(Math.min(59, Math.max(0, m))).padStart(2, '0')}`;
}

function parseTime24(s: string): { hour: number; minute: number } {
  const t = to24h(s ?? '08:00');
  const [h, m] = t.split(':').map(Number);
  return { hour: Math.min(23, Math.max(0, h)), minute: Math.min(59, Math.max(0, m)) };
}

function formatTime24(hour: number, minute: number): string {
  return `${String(Math.min(23, Math.max(0, hour))).padStart(2, '0')}:${String(
    Math.min(59, Math.max(0, minute)),
  ).padStart(2, '0')}`;
}

function snapMinuteToStep(minute: number, stepMinutes: number): number {
  if (stepMinutes <= 0 || stepMinutes > 60) return Math.min(59, Math.max(0, minute));
  const steps = Math.round(minute / stepMinutes) * stepMinutes;
  return Math.min(59, Math.max(0, steps));
}

function snapTimeToStep(timeStr: string, stepMinutes: number): string {
  const { hour, minute } = parseTime24(timeStr ?? '08:00');
  const m = snapMinuteToStep(minute, stepMinutes);
  return formatTime24(hour, m);
}

function minuteOptionsFromStep(stepMinutes: number): number[] {
  if (stepMinutes <= 0 || stepMinutes > 60) return [0, 15, 30, 45];
  const opts: number[] = [];
  for (let m = 0; m < 60; m += stepMinutes) opts.push(m);
  return opts;
}

function rangeToVm(range: OpeningHoursRange, stepMinutes: number): EditableRangeVm {
  const start = snapTimeToStep(to24h(range.start), stepMinutes);
  const end = snapTimeToStep(to24h(range.end), stepMinutes);
  const sh = parseTime24(start).hour;
  const sm = snapMinuteToStep(parseTime24(start).minute, stepMinutes);
  const eh = parseTime24(end).hour;
  const em = snapMinuteToStep(parseTime24(end).minute, stepMinutes);
  return { startHour: sh, startMinute: sm, endHour: eh, endMinute: em };
}

function vmToRange(vm: EditableRangeVm): OpeningHoursRange {
  return {
    start: formatTime24(vm.startHour, vm.startMinute),
    end: formatTime24(vm.endHour, vm.endMinute),
  };
}
