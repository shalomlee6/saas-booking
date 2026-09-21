import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ServicesStore } from '../../services/services.store';
import { ServicesApiService } from '../../services/services-api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss',
})
export class ServiceFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(ServicesStore);
  private readonly api = inject(ServicesApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly language = inject(LanguageService);

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly isEdit = signal(false);
  readonly form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      durationMinutes: [30, [Validators.required, Validators.min(5)]],
      price: [null as number | null],
      description: [''],
      isActive: [true],
    });
  }

  get name() {
    return this.form.get('name');
  }

  get durationMinutes() {
    return this.form.get('durationMinutes');
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.loading.set(true);
      this.api.getById(id).subscribe({
        next: (s) => {
          this.form.patchValue({
            name: s.name,
            durationMinutes: s.durationMinutes,
            price: s.price ?? null,
            description: s.description ?? '',
            isActive: s.isActive ?? true,
          });
          this.loading.set(false);
        },
        error: () => {
          this.serverError.set(this.language.t('services.loadServiceError'));
          this.loading.set(false);
        },
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const id = this.route.snapshot.paramMap.get('id');
    const value = this.form.getRawValue();

    if (id) {
      this.store
        .update(id, {
          name: value.name?.trim(),
          durationMinutes: value.durationMinutes,
          price: value.price ?? undefined,
          description: value.description?.trim() || undefined,
          isActive: value.isActive,
        })
        .subscribe({
          next: () => this.router.navigate(['/services']),
          error: () => {
            this.loading.set(false);
            this.serverError.set(this.language.t('services.updateErrorRetry'));
          },
        });
    } else {
      this.store
        .create({
          name: value.name?.trim(),
          durationMinutes: value.durationMinutes,
          price: value.price ?? undefined,
          description: value.description?.trim() || undefined,
          isActive: value.isActive,
        })
        .subscribe({
          next: () => this.router.navigate(['/services']),
          error: () => {
            this.loading.set(false);
            this.serverError.set(this.language.t('services.createErrorRetry'));
          },
        });
    }
  }
}
