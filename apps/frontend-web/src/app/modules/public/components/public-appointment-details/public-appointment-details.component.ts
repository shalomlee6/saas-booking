import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { TextareaModule } from 'primeng/textarea';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PublicApiService, type UpcomingAppointment } from '../../services/public-api.service';

const MOBILE_BREAKPOINT_PX = 768;
const CANCELLABLE_STATUSES = new Set(['confirmed', 'pending']);

/**
 * Shared public appointment details.
 * Reuses the landing cancellation form and `PublicApiService.cancelAppointment`.
 * Drawer on mobile, dialog on desktop — same split as the staff appointment list.
 */
@Component({
  selector: 'app-public-appointment-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonModule, DialogModule, DrawerModule, TextareaModule, TranslatePipe, NgTemplateOutlet],
  templateUrl: './public-appointment-details.component.html',
  styleUrl: './public-appointment-details.component.scss',
})
export class PublicAppointmentDetailsComponent implements OnInit {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly publicApi = inject(PublicApiService);
  private readonly messages = inject(MessageService);
  readonly language = inject(LanguageService);

  readonly appointment = input<UpcomingAppointment | null>(null);

  readonly closed = output<void>();
  readonly cancelled = output<void>();
  readonly edit = output<UpcomingAppointment>();

  readonly isMobile = signal(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT_PX : true
  );
  readonly reason = signal('');
  readonly reasonTouched = signal(false);
  readonly cancelling = signal(false);
  readonly cancelError = signal<string | null>(null);

  readonly canCancel = computed(() => {
    const apt = this.appointment();
    return !!apt && CANCELLABLE_STATUSES.has(apt.status);
  });

  readonly reasonInvalid = computed(
    () => this.reasonTouched() && this.reason().trim().length === 0
  );

  readonly cancelDisabled = computed(
    () => this.cancelling() || this.reason().trim().length === 0
  );

  readonly formattedDate = computed(() => {
    const apt = this.appointment();
    if (!apt?.date) return '';
    const parts = apt.date.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return apt.date;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString(this.language.intlLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  constructor() {
    let previousId: string | null = null;
    effect(() => {
      const id = this.appointment()?.id ?? null;
      if (id === previousId) return;
      previousId = id;
      this.reason.set('');
      this.reasonTouched.set(false);
      this.cancelError.set(null);
    });
  }

  ngOnInit(): void {
    const onResize = (): void => {
      const width = this.doc.defaultView?.innerWidth ?? 0;
      this.isMobile.set(width < MOBILE_BREAKPOINT_PX);
    };
    onResize();
    this.doc.defaultView?.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => {
      this.doc.defaultView?.removeEventListener('resize', onResize);
    });
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.requestClose();
  }

  requestClose(): void {
    if (this.cancelling()) return;
    this.closed.emit();
  }

  onEdit(): void {
    const apt = this.appointment();
    if (!apt || this.cancelling()) return;
    this.edit.emit(apt);
  }

  confirmCancel(): void {
    this.reasonTouched.set(true);
    const reason = this.reason().trim();
    const apt = this.appointment();
    if (!reason || !apt || this.cancelling()) return;

    this.cancelling.set(true);
    this.cancelError.set(null);
    this.publicApi.cancelAppointment(apt.id, reason).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.messages.add({
          severity: 'success',
          summary: this.language.t('appointments.cancelledToast'),
          detail: this.language.t('appointments.cancelledDetail'),
          life: 5000,
        });
        this.cancelled.emit();
        this.closed.emit();
      },
      error: (err: { error?: { message?: string }; status?: number }) => {
        this.cancelling.set(false);
        const serverMsg = err?.error?.message;
        if (err?.status === 409) {
          this.cancelError.set(serverMsg ?? this.language.t('appointments.cancelAlreadyCancelled'));
        } else if (err?.status === 404) {
          this.cancelError.set(this.language.t('appointments.cancelNotFound'));
        } else {
          this.cancelError.set(this.language.t('appointments.cancelGenericError'));
        }
      },
    });
  }
}
