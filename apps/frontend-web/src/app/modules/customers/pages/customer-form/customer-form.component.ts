import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CustomersApiService } from '../../services/customers-api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import type { TimeOfDayBucket } from '../../model/customer';

const TIME_OF_DAY_KEYS: Record<TimeOfDayBucket, string> = {
  morning: 'timeOfDay.morning',
  afternoon: 'timeOfDay.afternoon',
  evening: 'timeOfDay.evening',
  night: 'timeOfDay.night',
};

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
})
export class CustomerFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CustomersApiService);
  private readonly router = inject(Router);
  readonly language = inject(LanguageService);

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly timeOfDayOptions: { value: TimeOfDayBucket; label: string }[] = (
    ['morning', 'afternoon', 'evening', 'night'] as const
  ).map((value) => ({ value, label: this.language.t(TIME_OF_DAY_KEYS[value]) }));

  readonly form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: [''],
      notes: [''],
      preferredTimeOfDay: [''],
      allergies: [''],
      tags: [''],
    });
  }

  get name() {
    return this.form.get('name');
  }

  get phone() {
    return this.form.get('phone');
  }

  /** Strips non-digits and caps at 10 as the user types — matches Israeli local mobile format. */
  onPhoneInput(value: string): void {
    this.form.get('phone')?.setValue(value.replace(/\D/g, '').slice(0, 10));
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const raw = this.form.getRawValue();
    const tags = raw.tags
      ? String(raw.tags)
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
      : [];

    const dto = {
      name: raw.name?.trim(),
      phone: raw.phone?.trim(),
      email: raw.email?.trim() || undefined,
      notes: raw.notes?.trim() || undefined,
      preferences: {
        preferredTimeOfDay: (raw.preferredTimeOfDay || undefined) as TimeOfDayBucket | undefined,
        allergies: raw.allergies?.trim() || undefined,
        tags,
      },
    };

    this.api.create(dto).subscribe({
      next: () => {
        this.router.navigate(['/customers']);
      },
      error: () => {
        this.loading.set(false);
        this.serverError.set(this.language.t('customers.createError'));
      },
    });
  }
}
