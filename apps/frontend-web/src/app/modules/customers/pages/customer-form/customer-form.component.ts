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

  readonly form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      email: [''],
      notes: [''],
    });
  }

  get name() {
    return this.form.get('name');
  }

  get phone() {
    return this.form.get('phone');
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const dto = {
      name: this.form.get('name')?.value?.trim(),
      phone: this.form.get('phone')?.value?.trim(),
      email: this.form.get('email')?.value?.trim() || undefined,
      notes: this.form.get('notes')?.value?.trim() || undefined,
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
