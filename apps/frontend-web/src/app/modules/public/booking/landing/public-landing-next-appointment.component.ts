import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import type { UpcomingAppointment } from '../../services/public-api.service';

@Component({
  selector: 'app-public-landing-next-appointment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, SkeletonModule, TagModule],
  templateUrl: './public-landing-next-appointment.component.html',
  styleUrl: './public-landing-next-appointment.component.scss',
})
export class PublicLandingNextAppointmentComponent {
  readonly loading = input(false);
  readonly apt = input<UpcomingAppointment | null>(null);
  readonly error = input(false);
  readonly statusLabel = input('');
  readonly statusSeverity = input<
    'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
  >('secondary');
  readonly formattedDate = input('');
  /** When empty, staff row is omitted (no staff on appointment API yet). */
  readonly staffLine = input('');
  readonly canCancel = input(false);

  readonly book = output<void>();
  readonly cancel = output<void>();

  readonly daysUntil = computed(() => {
    const a = this.apt();
    if (!a?.date) return null;
    const parts = a.date.split('-').map((x) => Number(x));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  });

  readonly countdownLabel = computed(() => {
    const n = this.daysUntil();
    if (n === null) return '';
    if (n === 0) return 'היום';
    if (n === 1) return 'בעוד יום';
    if (n > 1) return `בעוד ${n} ימים`;
    if (n === -1) return 'לפני יום';
    return `לפני ${Math.abs(n)} ימים`;
  });
}
