import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import type { UpcomingAppointment } from '../../services/public-api.service';

const EDITABLE_STATUSES = new Set(['confirmed', 'pending']);

const STATUS_SEVERITY: Record<
  string,
  'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
> = {
  confirmed: 'success',
  pending: 'warn',
  completed: 'secondary',
  cancelled: 'danger',
};

@Component({
  selector: 'app-public-appointment-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TagModule, TranslatePipe],
  templateUrl: './public-appointment-card.component.html',
  styleUrl: './public-appointment-card.component.scss',
})
export class PublicAppointmentCardComponent {
  private readonly language = inject(LanguageService);

  readonly apt = input.required<UpcomingAppointment>();
  readonly staffLine = input('');
  readonly clickable = input(false);

  readonly open = output<void>();
  readonly edit = output<void>();

  readonly canEdit = computed(() => EDITABLE_STATUSES.has(this.apt().status));

  readonly statusLabel = computed(() => {
    this.language.language();
    return this.language.t(`status.${this.apt().status}`);
  });

  readonly statusSeverity = computed(
    () => STATUS_SEVERITY[this.apt().status] ?? 'secondary'
  );

  readonly formattedDate = computed(() => {
    const locale = this.language.intlLocale();
    const parts = this.apt().date.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return this.apt().date;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  readonly daysUntil = computed(() => {
    const parts = this.apt().date.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  });

  readonly countdownLabel = computed(() => {
    this.language.language();
    const n = this.daysUntil();
    if (n === null) return '';
    if (n === 0) return this.language.t('appointments.countdownToday');
    if (n === 1) return this.language.t('appointments.countdownInOneDay');
    if (n > 1) return this.language.t('appointments.countdownInDays', { n });
    if (n === -1) return this.language.t('appointments.countdownOneDayAgo');
    return this.language.t('appointments.countdownDaysAgo', { n: Math.abs(n) });
  });

  onCardClick(): void {
    if (this.clickable()) this.open.emit();
  }

  onCardKeydown(event: KeyboardEvent): void {
    if (!this.clickable()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open.emit();
    }
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    this.edit.emit();
  }
}
