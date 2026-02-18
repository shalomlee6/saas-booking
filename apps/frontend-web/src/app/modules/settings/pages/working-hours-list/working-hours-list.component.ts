import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  WORKING_HOURS_DAY_KEYS,
  normalizeDayToSlots,
  getDaySummary,
} from '../../../../core/working-hours/working-hours.util';

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
  selector: 'app-working-hours-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './working-hours-list.component.html',
  styleUrl: './working-hours-list.component.scss',
})
export class WorkingHoursListComponent {
  private readonly auth = inject(AuthService);

  readonly dayKeys = WORKING_HOURS_DAY_KEYS;
  readonly dayLabels = DAY_LABELS;

  getSummary(dayKey: string): string {
    const wh = this.auth.businessSettings()?.workingHours ?? {};
    const day = normalizeDayToSlots(wh[dayKey] as unknown as Record<string, unknown>, dayKey);
    return getDaySummary(day);
  }
}
