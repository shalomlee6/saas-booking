import { Component, Input, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService, type AppLanguage } from '../../../core/i18n/language.service';

/**
 * Self-service "change password" form — used in both the super-admin panel and
 * the business owner settings page. Deliberately unstyled beyond structural
 * layout (relies on the app's shared CSS custom properties for color/spacing),
 * so each page can drop it into its own card/section without visual clash.
 */
@Component({
  selector: 'app-change-password-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './change-password-form.component.html',
  styleUrl: './change-password-form.component.scss',
})
export class ChangePasswordFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);

  /** Pins this instance's language, independent of the app-wide Hebrew/English
   *  toggle — the super-admin panel is always English regardless of what a
   *  business owner elsewhere has chosen. Leave unset on the owner-facing
   *  Account page so it keeps following the global toggle as before. */
  @Input() locale: AppLanguage | null = null;

  t(key: string): string {
    return this.locale ? this.language.tIn(this.locale, key) : this.language.t(key);
  }

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  submit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.newPassword.errors?.['minlength']) {
        this.errorMessage.set(this.t('settings.changePasswordErrorWeak'));
      }
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if (newPassword !== confirmPassword) {
      this.errorMessage.set(this.t('settings.changePasswordErrorMismatch'));
      return;
    }
    if (newPassword === currentPassword) {
      this.errorMessage.set(this.t('settings.changePasswordErrorSame'));
      return;
    }

    this.saving.set(true);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set(this.t('settings.changePasswordSuccess'));
        this.form.reset();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 400 && /current password/i.test(err.error?.message ?? '')) {
          this.errorMessage.set(this.t('settings.changePasswordErrorWrongCurrent'));
        } else {
          this.errorMessage.set(err.error?.message ?? this.t('settings.changePasswordErrorGeneric'));
        }
      },
    });
  }
}
