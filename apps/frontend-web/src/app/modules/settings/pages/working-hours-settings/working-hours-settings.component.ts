import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { ApiService } from '../../../../core/api/api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import type { WorkingHours, WorkingHoursDay } from '../../../../core/auth/auth.service';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_LABELS: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday'
};

function timeValidator(control: AbstractControl): { time: boolean } | null {
  const v = control.value as string;
  if (!v) return null;
  const match = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.test(v.trim());
  return match ? null : { time: true };
}

@Component({
  selector: 'app-working-hours-settings',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './working-hours-settings.component.html',
  styleUrl: './working-hours-settings.component.scss',
})
export class WorkingHoursSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form: FormGroup;
  readonly dayKeys = DAY_KEYS;
  readonly dayLabels = DAY_LABELS;

  constructor() {
    const wh = this.auth.businessSettings()?.workingHours ?? {};
    const group: Record<string, FormGroup> = {};
    for (const key of DAY_KEYS) {
      const d = (wh[key] ?? { enabled: key !== 'sat' && key !== 'sun', start: '09:00', end: '18:00' }) as WorkingHoursDay;
      group[key] = this.fb.group({
        enabled: [d.enabled],
        start: [d.start, [Validators.required, timeValidator]],
        end: [d.end, [Validators.required, timeValidator]],
      });
    }
    this.form = this.fb.group(group);
    this.form.addValidators(() => this.startBeforeEndValidator());
  }

  private startBeforeEndValidator(): { startBeforeEnd: boolean } | null {
    for (const key of DAY_KEYS) {
      const g = this.form.get(key) as FormGroup;
      if (!g?.get('enabled')?.value) continue;
      const start = (g.get('start')?.value ?? '').trim();
      const end = (g.get('end')?.value ?? '').trim();
      if (!start || !end) continue;
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const startM = (sh ?? 0) * 60 + (sm ?? 0);
      const endM = (eh ?? 0) * 60 + (em ?? 0);
      if (startM >= endM) return { startBeforeEnd: true };
    }
    return null;
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue() as Record<string, { enabled: boolean; start: string; end: string }>;
    const workingHours: WorkingHours = {};
    for (const key of DAY_KEYS) {
      workingHours[key] = {
        slots: [],
        enabled: !!value[key]?.enabled,
        start: (value[key]?.start ?? '09:00').trim(),
        end: (value[key]?.end ?? '18:00').trim(),
      };
    }
    this.api.patch<{ workingHours: WorkingHours }>('business/settings', { workingHours }).subscribe({
      next: (res) => {
        this.auth.updateBusinessSettings({ workingHours: res.workingHours });
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to save');
        this.saving.set(false);
      },
    });
  }
}
