import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ApiService } from '../../../../core/api/api.service';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

interface MeSettingsLandingFields {
  landingTagline?: string;
  coverImageUrl?: string;
  businessPhonePublic?: string;
  publicRating?: number;
  landingProducts?: Array<{
    name: string;
    description?: string;
    price: number;
  }>;
}

interface BusinessReviewDto {
  id: string;
  customerName: string;
  text: string;
  rating: number;
  createdAt: string;
}

interface BusinessReviewRow extends BusinessReviewDto {
  starDisplay: string;
}

function reviewStarDisplay(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(n);
}

@Component({
  selector: 'app-business-landing-settings',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule],
  templateUrl: './business-landing-settings.component.html',
  styleUrl: './business-landing-settings.component.scss',
})
export class BusinessLandingSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly reviewsLoading = signal(true);
  readonly reviews = signal<BusinessReviewRow[]>([]);
  readonly reviewSaving = signal(false);

  readonly form: FormGroup = this.fb.group({
    landingTagline: ['', [Validators.maxLength(300)]],
    coverImageUrl: ['', [Validators.maxLength(2000)]],
    businessPhonePublic: ['', [Validators.maxLength(40)]],
    publicRating: [
      5,
      [Validators.required, Validators.min(1), Validators.max(5)],
    ],
    products: this.fb.array<FormGroup>([]),
  });

  readonly newReviewForm: FormGroup = this.fb.group({
    customerName: ['', [Validators.required, Validators.maxLength(120)]],
    text: ['', [Validators.required, Validators.maxLength(2000)]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
  });

  get products(): FormArray<FormGroup> {
    return this.form.get('products') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.api.get<MeSettingsLandingFields>('settings/me/settings').subscribe({
      next: (s) => {
        this.form.patchValue({
          landingTagline: s.landingTagline ?? '',
          coverImageUrl: s.coverImageUrl ?? '',
          businessPhonePublic: s.businessPhonePublic ?? '',
          publicRating: s.publicRating ?? 5,
        });
        this.products.clear();
        const list = s.landingProducts ?? [];
        for (const p of list) {
          this.products.push(this.productGroup(p.name, p.description ?? '', p.price));
        }
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'שגיאה',
          detail: err?.error?.message ?? 'לא ניתן לטעון הגדרות',
        });
      },
    });

    this.reloadReviews();
  }

  private productGroup(name: string, description: string, price: number): FormGroup {
    return this.fb.group({
      name: [name, [Validators.required, Validators.maxLength(200)]],
      description: [description, [Validators.maxLength(500)]],
      price: [price, [Validators.required, Validators.min(0)]],
    });
  }

  addProductRow(): void {
    this.products.push(this.productGroup('', '', 0));
  }

  removeProductRow(index: number): void {
    this.products.removeAt(index);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue() as {
      landingTagline: string;
      coverImageUrl: string;
      businessPhonePublic: string;
      publicRating: number;
      products: Array<{ name: string; description: string; price: number }>;
    };
    const landingProducts = v.products
      .filter((p) => p.name?.trim())
      .map((p) => ({
        name: p.name.trim(),
        description: (p.description ?? '').trim(),
        price: Number(p.price),
      }));
    this.api
      .put<unknown>('settings/me/settings', {
        landingTagline: v.landingTagline?.trim() ?? '',
        coverImageUrl: v.coverImageUrl?.trim() ?? '',
        businessPhonePublic: v.businessPhonePublic?.trim() ?? '',
        publicRating: Number(v.publicRating),
        landingProducts,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.messages.add({
            severity: 'success',
            summary: 'נשמר',
            detail: 'הדף הציבורי עודכן',
          });
        },
        error: (err: { error?: { message?: string } }) => {
          this.saving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: err?.error?.message ?? 'שמירה נכשלה',
          });
        },
      });
  }

  private reloadReviews(): void {
    this.reviewsLoading.set(true);
    this.api.get<{ items: BusinessReviewDto[] }>('business/reviews').subscribe({
      next: (res) => {
        const rows = (res.items ?? []).map((r) => ({
          ...r,
          starDisplay: reviewStarDisplay(r.rating),
        }));
        this.reviews.set(rows);
        this.reviewsLoading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.reviewsLoading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'שגיאה',
          detail: err?.error?.message ?? 'לא ניתן לטעון המלצות',
        });
      },
    });
  }

  addReview(): void {
    if (this.newReviewForm.invalid || this.reviewSaving()) return;
    this.reviewSaving.set(true);
    const r = this.newReviewForm.getRawValue() as {
      customerName: string;
      text: string;
      rating: number;
    };
    this.api
      .post<unknown>('business/reviews', {
        customerName: r.customerName.trim(),
        text: r.text.trim(),
        rating: Number(r.rating),
      })
      .subscribe({
        next: () => {
          this.reviewSaving.set(false);
          this.newReviewForm.reset({ customerName: '', text: '', rating: 5 });
          this.messages.add({
            severity: 'success',
            summary: 'נוסף',
            detail: 'ההמלצה פורסמה באתר',
          });
          this.reloadReviews();
        },
        error: (err: { error?: { message?: string } }) => {
          this.reviewSaving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: err?.error?.message ?? 'לא ניתן לשמור',
          });
        },
      });
  }

  deleteReview(id: string): void {
    this.api.delete(`business/reviews/${encodeURIComponent(id)}`).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: 'נמחק',
          detail: 'ההמלצה הוסרה',
        });
        this.reloadReviews();
      },
      error: (err: { error?: { message?: string } }) => {
        this.messages.add({
          severity: 'error',
          summary: 'שגיאה',
          detail: err?.error?.message ?? 'מחיקה נכשלה',
        });
      },
    });
  }
}
