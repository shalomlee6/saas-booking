import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PublicApiService } from '../../services/public-api.service';
import { PublicSessionService } from '../../services/public-session.service';
import {
  isIsraeliMobile,
  isRealBirthday,
  type BirthdayField,
  type PublicClientProfile,
} from '../../services/public-identity.rules';

type IdentifyView = 'phone' | 'code' | 'profile' | 'birthday' | 'greeting' | 'blocked';

@Component({
  selector: 'app-public-identify',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './public-identify.component.html',
  styleUrl: './public-identify.component.scss',
})
export class PublicIdentifyComponent implements OnInit, OnDestroy {
  private readonly api = inject(PublicApiService);
  private readonly session = inject(PublicSessionService);
  readonly language = inject(LanguageService);

  readonly slug = input.required<string>();
  readonly entry = input<'phone' | 'birthday' | 'profile'>('phone');

  readonly completed = output<void>();

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly view = signal<IdentifyView>('phone');
  readonly phone = signal('');
  readonly code = signal('');
  readonly name = signal('');
  readonly day = signal<number | null>(null);
  readonly month = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly resendIn = signal(30);
  readonly attempts = signal(0);
  readonly firstName = signal('');

  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);

  readonly birthdayField = computed<BirthdayField>(() => this.session.birthdayField() ?? 'required');
  readonly showBirthday = computed(() => this.birthdayField() !== 'hidden');
  readonly birthdayRequired = computed(() => this.birthdayField() === 'required');
  readonly phoneValid = computed(() => isIsraeliMobile(this.phone()));
  readonly canResend = computed(() => this.resendIn() <= 0 && !this.busy());

  private resendTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      this.view();
      queueMicrotask(() => this.heading()?.nativeElement.focus());
    });
  }

  ngOnDestroy(): void {
    this.stopResendWait();
  }

  ngOnInit(): void {
    const entry = this.entry();
    if (entry === 'birthday') this.view.set('birthday');
    else if (entry === 'profile') this.view.set('profile');
  }

  onPhoneInput(value: string): void {
    this.error.set(null);
    this.phone.set(value.replace(/\D/g, '').slice(0, 10));
  }

  onDay(value: number | string | null): void {
    this.error.set(null);
    this.day.set(this.asNumber(value));
  }

  onMonth(value: number | string | null): void {
    this.error.set(null);
    this.month.set(this.asNumber(value));
  }

  onCodeInput(value: string): void {
    this.error.set(null);
    this.code.set(value.replace(/\D/g, '').slice(0, 6));
  }

  submitPhone(): void {
    if (!this.phoneValid() || this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    const slug = this.slug();
    this.api.identifyStart(slug, this.phone()).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.status === 'blocked') {
          this.view.set('blocked');
          return;
        }
        if (this.session.identityMode() === 'phone') {
          this.afterSession(res.status === 'new');
          return;
        }
        this.attempts.set(0);
        this.view.set('code');
        this.startResendWait();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(this.messageFor(err));
      },
    });
  }

  submitCode(): void {
    if (this.code().length < 6 || this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    this.api.identifyVerify(this.slug(), this.phone(), this.code()).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.stopResendWait();
        this.afterSession(res.status === 'new');
      },
      error: () => {
        this.busy.set(false);
        const next = this.attempts() + 1;
        this.attempts.set(next);
        this.code.set('');
        this.error.set(
          next >= 5 ? this.language.t('publicIdentity.codeDead') : this.language.t('publicIdentity.codeInvalid')
        );
      },
    });
  }

  resend(): void {
    if (!this.canResend()) return;
    this.error.set(null);
    this.busy.set(true);
    this.api.identifyStart(this.slug(), this.phone()).subscribe({
      next: () => {
        this.busy.set(false);
        this.attempts.set(0);
        this.code.set('');
        this.startResendWait();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(this.messageFor(err));
      },
    });
  }

  submitProfile(): void {
    const name = this.name().trim();
    if (!name || name.length > 200) {
      this.error.set(this.language.t('publicIdentity.nameRequired'));
      return;
    }
    const birthday = this.readBirthday(this.birthdayRequired());
    if (birthday === 'invalid') return;
    this.sendComplete({ name, ...(birthday ? { birthday } : {}) });
  }

  submitBirthday(): void {
    const birthday = this.readBirthday(true);
    if (birthday === 'invalid' || !birthday) return;
    this.sendComplete({ birthday });
  }

  continueFromGreeting(): void {
    this.completed.emit();
  }

  monthLabel(month: number): string {
    return new Date(2024, month - 1, 1).toLocaleString(this.language.intlLocale(), { month: 'long' });
  }

  private afterSession(isNew: boolean): void {
    const slug = this.slug();
    this.api.getSessionMe(slug).subscribe((result) => {
      if (result.kind !== 'ok') {
        this.error.set(this.language.t('publicIdentity.genericError'));
        return;
      }
      this.session.applyMe(slug, result.profile);
      const profile = result.profile;
      if (!profile.hasCustomer || isNew) {
        this.view.set('profile');
        return;
      }
      if (profile.needsBirthday) {
        this.view.set('birthday');
        return;
      }
      if (profile.verified && profile.firstName && this.session.identityMode() === 'otp') {
        this.firstName.set(profile.firstName);
        this.view.set('greeting');
        return;
      }
      this.completed.emit();
    });
  }

  private sendComplete(body: { name?: string; birthday?: { day: number; month: number } }): void {
    this.error.set(null);
    this.busy.set(true);
    const slug = this.slug();
    this.api.identifyComplete(slug, body).subscribe({
      next: (profile) => {
        this.busy.set(false);
        this.session.applyMe(slug, profile);
        this.finish(profile);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(this.messageFor(err));
      },
    });
  }

  private finish(profile: PublicClientProfile): void {
    if (profile.verified && profile.firstName && this.session.identityMode() === 'otp') {
      this.firstName.set(profile.firstName);
      this.view.set('greeting');
      return;
    }
    this.completed.emit();
  }

  private readBirthday(required: boolean): { day: number; month: number } | undefined | 'invalid' {
    const day = this.day();
    const month = this.month();
    if (day == null && month == null) {
      if (required) {
        this.error.set(this.language.t('publicIdentity.birthdayRequired'));
        return 'invalid';
      }
      return undefined;
    }
    if (day == null || month == null || !isRealBirthday(day, month)) {
      this.error.set(this.language.t('publicIdentity.birthdayInvalid'));
      return 'invalid';
    }
    return { day, month };
  }

  private startResendWait(): void {
    this.stopResendWait();
    this.resendIn.set(30);
    this.resendTimer = setInterval(() => {
      const next = this.resendIn() - 1;
      this.resendIn.set(next);
      if (next <= 0) this.stopResendWait();
    }, 1000);
  }

  private stopResendWait(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private asNumber(value: number | string | null): number | null {
    if (value == null || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  private messageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.status === 429) {
      return this.language.t('publicIdentity.pleaseWait');
    }
    return this.language.t('publicIdentity.genericError');
  }
}
