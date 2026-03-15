import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiService } from '../../../../core/api/api.service';
import {
  SLOTS_PER_DAY,
  WORKING_HOURS_DAY_KEYS,
  normalizeDayToSlots,
  slotIndexToLabel,
  createEmptySlots,
  setSlotsRange,
  createDefaultSlots,
  minutesToSlotIndex,
  type WorkingHoursDayKey,
} from '../../../../core/working-hours/working-hours.util';
import type { WorkingHours } from '../../../../core/auth/auth.service';

const DISPLAY_START_INDEX = 12;
const DISPLAY_END_INDEX = 44;

const DAY_LABELS: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

@Component({
  selector: 'app-working-hours-edit',
  standalone: true,
  imports: [],
  templateUrl: './working-hours-edit.component.html',
  styleUrl: './working-hours-edit.component.scss',
})
export class WorkingHoursEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly slots = signal<boolean[]>(createEmptySlots());
  readonly enabled = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly dayKey = signal<WorkingHoursDayKey>('sun');
  readonly dayLabel = computed(() => DAY_LABELS[this.dayKey()] ?? this.dayKey());

  readonly displaySlots = computed(() => {
    const arr = this.slots();
    const list: { index: number; label: string; available: boolean }[] = [];
    for (let i = DISPLAY_START_INDEX; i <= DISPLAY_END_INDEX; i++) {
      list.push({
        index: i,
        label: slotIndexToLabel(i),
        available: arr[i] === true,
      });
    }
    return list;
  });

  readonly otherDaysWithLabels = computed(() =>
    WORKING_HOURS_DAY_KEYS
      .filter((k) => k !== this.dayKey())
      .map((k) => ({ key: k, label: DAY_LABELS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)) }))
  );

  ngOnInit(): void {
    const key = this.route.snapshot.paramMap.get('dayKey') as WorkingHoursDayKey | null;
    if (key && WORKING_HOURS_DAY_KEYS.includes(key)) {
      this.dayKey.set(key);
      this.loadDay(key);
    }
  }

  private loadDay(key: string): void {
    const wh = this.auth.businessSettings()?.workingHours ?? {};
    const day = normalizeDayToSlots(wh[key] as unknown as Record<string, unknown>, key);
    this.enabled.set(day.enabled);
    this.slots.set(day.slots.length === SLOTS_PER_DAY ? [...day.slots] : createDefaultSlots(key));
  }

  toggleSlot(index: number): void {
    this.slots.update((arr) => {
      const next = [...arr];
      next[index] = !next[index];
      return next;
    });
  }

  selectAll(): void {
    this.slots.update((arr) => {
      const next = [...arr];
      for (let i = DISPLAY_START_INDEX; i <= DISPLAY_END_INDEX; i++) next[i] = true;
      return next;
    });
  }

  clear(): void {
    this.slots.update((arr) => {
      const next = [...arr];
      for (let i = DISPLAY_START_INDEX; i <= DISPLAY_END_INDEX; i++) next[i] = false;
      return next;
    });
  }

  set0800to1800(): void {
    this.slots.update((arr) => {
      const next = [...arr];
      setSlotsRange(next, minutesToSlotIndex(8 * 60), minutesToSlotIndex(18 * 60), true);
      return next;
    });
  }

  copyFrom(sourceKey: string): void {
    const wh = this.auth.businessSettings()?.workingHours ?? {};
    const day = normalizeDayToSlots(wh[sourceKey] as unknown as Record<string, unknown>, sourceKey);
    this.slots.set(day.slots.length === SLOTS_PER_DAY ? [...day.slots] : createDefaultSlots(sourceKey));
    this.enabled.set(day.enabled);
  }

  save(): void {
    this.saving.set(true);
    this.error.set(null);
    const key = this.dayKey();
    const current = (this.auth.businessSettings()?.workingHours ?? {}) as Record<string, { enabled: boolean; slots: boolean[] }>;
    const updated: WorkingHours = {};
    const slots = [...this.slots()];
    const { start, end } = this.slotsToStartEnd(slots);
    
    for (const k of WORKING_HOURS_DAY_KEYS) {
      if (k === key) {
        updated[k] = { enabled: this.enabled(), slots: [...this.slots()], start: start ?? '', end: end ?? '' };
      } else {
        const existing = current[k];
        if (existing?.slots?.length === SLOTS_PER_DAY) {
          updated[k] = { enabled: existing.enabled, slots: existing.slots, start: start ?? '', end: end ?? ''};
        } else {
          const day = normalizeDayToSlots(current[k] as Record<string, unknown>, k);
          updated[k] = { enabled: day.enabled, slots: day.slots, start: start ?? '', end: end ?? ''};
        }
      }
    }
    this.api.patch<{ workingHours: WorkingHours }>('business/settings', { workingHours: updated }).subscribe({
      next: () => {
        this.auth.updateBusinessSettings({ workingHours: updated });
        this.saving.set(false);
        this.router.navigate(['/settings/working-hours']);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to save');
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/settings/working-hours']);
  }

  slotsToStartEnd(
    slots: boolean[],
    dayStartHour = 8,
    slotMinutes = 30
  ): { start: string | null; end: string | null } {
    const first = slots.findIndex(Boolean);
    const last = slots.lastIndexOf(true);
  
    if (first === -1 || last === -1) {
      return { start: '', end: '' };
    }
  
    const startMinutes = dayStartHour * 60 + first * slotMinutes;
    const endMinutes = dayStartHour * 60 + (last + 1) * slotMinutes;
  
    const toTime = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  
    return {
      start: toTime(startMinutes),
      end: toTime(endMinutes),
    };
  }

  
}
