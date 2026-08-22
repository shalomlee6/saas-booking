import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../../core/api/api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import {
  PublicApiService,
  type PublicLandingGalleryItem,
  type PublicLandingProductItem,
  type PublicService,
} from '../../../public/services/public-api.service';
import { compressImageFile, compressImageErrorMessage } from '../../../../shared/utils/compress-image';
import { resolvePublicAssetUrl } from '../../../../shared/utils/public-asset-url';
import {
  PublicLandingHeroComponent,
  PUBLIC_LANDING_DEFAULT_HERO_PHOTOS,
} from '../../../public/booking/landing/components/hero/public-landing-hero.component';
import { PublicLandingServicesComponent } from '../../../public/booking/landing/components/services/public-landing-services.component';
import { PublicLandingGalleryComponent } from '../../../public/booking/landing/components/gallery/public-landing-gallery.component';
import { PublicLandingProductsComponent } from '../../../public/booking/landing/components/products/public-landing-products.component';
import { PublicLandingReviewsComponent } from '../../../public/booking/landing/components/reviews/public-landing-reviews.component';
import { PublicLandingBookingCtaComponent } from '../../../public/booking/landing/components/booking-cta/public-landing-booking-cta.component';
import type { PublicLandingReviewItem } from '../../../public/services/public-api.service';
import {
  collectProductRowIssues,
  isBlankProductRow,
  productRowIssue,
  toLandingProductsPayload,
  type LandingProductRowValue,
} from './landing-product-rows.util';

interface MeSettingsLanding {
  landingTagline?: string;
  coverImageUrl?: string;
  landingSecondaryHeroImageUrl?: string;
  landingHeroDescription?: string;
  businessPhonePublic?: string;
  publicRating?: number;
  landingGalleryItems?: PublicLandingGalleryItem[];
  portfolioImages?: string[];
  landingContact?: { whatsapp?: string; email?: string; location?: string };
  landingServiceOrder?: string[];
  landingSectionVisibility?: {
    hero?: boolean;
    services?: boolean;
    gallery?: boolean;
    products?: boolean;
    reviews?: boolean;
    cta?: boolean;
  };
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

function newGalleryId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function galleryFromSettings(s: MeSettingsLanding): PublicLandingGalleryItem[] {
  if (s.landingGalleryItems && s.landingGalleryItems.length > 0) {
    return s.landingGalleryItems.map((g) => ({
      id: g.id,
      imageUrl: resolvePublicAssetUrl(g.imageUrl),
      title: g.title ?? '',
      type: g.type === 'product' ? 'product' : 'service',
    }));
  }
  return (s.portfolioImages ?? []).map((url, i) => ({
    id: `legacy-${i}`,
    imageUrl: resolvePublicAssetUrl(url),
    title: '',
    type: 'service' as const,
  }));
}

/** Original camera files before compression (hint used to say 5MB, which rejected typical phone photos). */
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
/** Must stay at or under the API multer limit after compression. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-business-landing-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToggleSwitchModule,
    SelectModule,
    PublicLandingHeroComponent,
    PublicLandingServicesComponent,
    PublicLandingGalleryComponent,
    PublicLandingProductsComponent,
    PublicLandingReviewsComponent,
    PublicLandingBookingCtaComponent,
  ],
  templateUrl: './business-landing-settings.component.html',
  styleUrl: './business-landing-settings.component.scss',
})
export class BusinessLandingSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly publicApi = inject(PublicApiService);
  private readonly messages = inject(MessageService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly reviewsLoading = signal(true);
  readonly reviews = signal<BusinessReviewRow[]>([]);
  readonly reviewSaving = signal(false);

  readonly businessSlug = signal('');
  readonly businessName = signal('');

  readonly landingTagline = signal('');
  readonly heroDescription = signal('');
  readonly coverImageUrl = signal('');
  readonly secondaryHeroImageUrl = signal('');
  readonly businessPhonePublic = signal('');
  readonly publicRating = signal(5);
  readonly contactWhatsapp = signal('');
  readonly contactEmail = signal('');
  readonly contactLocation = signal('');

  readonly galleryItems = signal<PublicLandingGalleryItem[]>([]);
  readonly servicesCatalog = signal<PublicService[]>([]);
  readonly serviceOrderIds = signal<string[]>([]);

  readonly secHero = signal(true);
  readonly secServices = signal(true);
  readonly secGallery = signal(true);
  readonly secProducts = signal(true);
  readonly secReviews = signal(true);
  readonly secCta = signal(true);

  readonly galleryTypeOptions = [
    { label: 'שירות', value: 'service' as const },
    { label: 'מוצר', value: 'product' as const },
  ];

  /** Template helper so editor thumbs work with legacy `/uploads` URLs. */
  protected readonly resolvePublicAssetUrl = resolvePublicAssetUrl;

  readonly form: FormGroup = this.fb.group({
    products: this.fb.array<FormGroup>([]),
  });

  readonly newReviewForm: FormGroup = this.fb.group({
    customerName: ['', [Validators.required, Validators.maxLength(120)]],
    text: ['', [Validators.required, Validators.maxLength(2000)]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
  });

  private dragGalFrom: number | null = null;
  private dragSvcFrom: number | null = null;

  /** Bumped when product rows change so preview computed refreshes. */
  private readonly previewProductsTick = signal(0);

  readonly previewProducts = computed((): PublicLandingProductItem[] => {
    this.previewProductsTick();
    return this.buildPreviewProducts();
  });

  readonly productRowIssues = computed((): Array<string | null> => {
    this.previewProductsTick();
    const rows = this.products.getRawValue() as LandingProductRowValue[];
    return rows.map((row, i) => productRowIssue(row, i));
  });

  readonly productSaveIssues = computed((): string[] =>
    this.productRowIssues().filter((msg): msg is string => msg != null)
  );

  readonly firstProductIssueIndex = computed((): number =>
    this.productRowIssues().findIndex((msg) => msg != null)
  );

  readonly previewReviews = computed((): PublicLandingReviewItem[] =>
    this.reviews().map((r) => ({
      customerName: r.customerName,
      text: r.text,
      rating: r.rating,
      date: r.createdAt.slice(0, 10),
    }))
  );

  readonly orderedPreviewServices = computed((): PublicService[] => {
    const order = this.serviceOrderIds();
    const list = this.servicesCatalog();
    if (!order.length) return list;
    const mapById = new Map(list.map((s) => [s.id, s]));
    const out: PublicService[] = [];
    const seen = new Set<string>();
    for (const id of order) {
      const s = mapById.get(id);
      if (s) {
        out.push(s);
        seen.add(id);
      }
    }
    for (const s of list) {
      if (!seen.has(s.id)) out.push(s);
    }
    return out;
  });

  readonly previewHeroLeft = computed(() => {
    const u = resolvePublicAssetUrl(this.coverImageUrl());
    if (u) return u;
    return PUBLIC_LANDING_DEFAULT_HERO_PHOTOS[0];
  });

  readonly previewHeroRight = computed(() => {
    const u = resolvePublicAssetUrl(this.secondaryHeroImageUrl());
    if (u) return u;
    return PUBLIC_LANDING_DEFAULT_HERO_PHOTOS[1];
  });

  readonly previewSectionVisibility = computed(() => ({
    hero: this.secHero(),
    services: this.secServices(),
    gallery: this.secGallery(),
    products: this.secProducts(),
    reviews: this.secReviews(),
    cta: this.secCta(),
  }));

  readonly customerPreviewUrl = computed(() => {
    const slug = this.businessSlug();
    return slug ? `/b/${encodeURIComponent(slug)}` : '';
  });

  get products(): FormArray<FormGroup> {
    return this.form.get('products') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.auth.init().subscribe({
      next: () => {
        const slug = this.auth.business()?.slug ?? '';
        if (!slug) {
          this.loading.set(false);
          this.loadError.set('לא נמצא עסק משויך למשתמש');
          return;
        }
        this.businessSlug.set(slug);
        this.loadAll(slug);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('לא ניתן לטעון פרופיל');
      },
    });
    this.reloadReviews();
  }

  private loadAll(slug: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      settings: this.api.get<MeSettingsLanding>('settings/me/settings'),
      landing: this.publicApi.getBusinessLanding(slug),
      services: this.publicApi.getServices(slug),
    }).subscribe({
      next: ({ settings, landing, services }) => {
        this.businessName.set(landing.businessName);
        this.landingTagline.set(settings.landingTagline ?? landing.heroSection.tagline ?? '');
        this.heroDescription.set(
          settings.landingHeroDescription ?? landing.heroSection.description ?? ''
        );
        this.coverImageUrl.set(
          resolvePublicAssetUrl(settings.coverImageUrl ?? landing.heroSection.heroImage ?? '')
        );
        this.secondaryHeroImageUrl.set(
          resolvePublicAssetUrl(
            settings.landingSecondaryHeroImageUrl ?? landing.heroSection.heroImageSecondary ?? ''
          )
        );
        this.businessPhonePublic.set(settings.businessPhonePublic ?? landing.contact.phone ?? '');
        this.publicRating.set(settings.publicRating ?? landing.stats.rating ?? 5);
        this.contactWhatsapp.set(
          settings.landingContact?.whatsapp ?? landing.contact.whatsapp ?? ''
        );
        this.contactEmail.set(settings.landingContact?.email ?? landing.contact.email ?? '');
        this.contactLocation.set(
          settings.landingContact?.location ?? landing.contact.location ?? ''
        );

        this.galleryItems.set(galleryFromSettings(settings));

        this.servicesCatalog.set(services);
        const order =
          settings.landingServiceOrder && settings.landingServiceOrder.length > 0
            ? [...settings.landingServiceOrder]
            : services.map((s) => s.id);
        this.serviceOrderIds.set(order);

        const vis = settings.landingSectionVisibility ?? landing.sections;
        this.secHero.set(vis?.hero !== false);
        this.secServices.set(vis?.services !== false);
        this.secGallery.set(vis?.gallery !== false);
        this.secProducts.set(vis?.products !== false);
        this.secReviews.set(vis?.reviews !== false);
        this.secCta.set(vis?.cta !== false);

        this.products.clear();
        for (const p of settings.landingProducts ?? []) {
          this.products.push(this.productGroup(p.name, p.description ?? '', p.price));
        }
        this.previewProductsTick.update((n) => n + 1);

        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.loadError.set(err?.error?.message ?? 'טעינה נכשלה');
      },
    });
  }

  private buildPreviewProducts(): PublicLandingProductItem[] {
    return toLandingProductsPayload(this.products.getRawValue() as LandingProductRowValue[]);
  }

  private productGroup(name: string, description: string, price: number): FormGroup {
    return this.fb.group({
      name: [name, [Validators.maxLength(200)]],
      description: [description, [Validators.maxLength(500)]],
      price: [price, [Validators.min(0)]],
    });
  }

  addProductRow(): void {
    this.products.push(this.productGroup('', '', 0));
    this.previewProductsTick.update((n) => n + 1);
  }

  removeProductRow(index: number): void {
    this.products.removeAt(index);
    this.previewProductsTick.update((n) => n + 1);
  }

  onProductFieldChange(): void {
    this.previewProductsTick.update((n) => n + 1);
  }

  openCustomerPreview(): void {
    const path = this.customerPreviewUrl();
    if (path && typeof window !== 'undefined') {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
  }

  previewBook(): void {
    this.messages.add({
      severity: 'info',
      summary: 'תצוגה מקדימה',
      detail: 'בדף הציבורי הכפתור מוביל לזימון תור.',
      life: 2500,
    });
  }

  serviceNameById(id: string): string {
    return this.servicesCatalog().find((s) => s.id === id)?.nameHe ?? id;
  }

  async onHeroFile(ev: Event, which: 'cover' | 'secondary'): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== '' && file.type !== 'application/octet-stream') {
      this.messages.add({ severity: 'warn', summary: 'קובץ לא תקין', detail: 'נא לבחור תמונה' });
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      this.messages.add({
        severity: 'warn',
        summary: 'קובץ גדול מדי',
        detail: 'מקסימום 25MB לקובץ מקורי (נדחס אוטומטית לפני ההעלאה)',
      });
      return;
    }
    this.uploading.set(true);
    try {
      const blob = await compressImageFile(file, { maxBytes: 2_000_000 });
      if (blob.size > MAX_UPLOAD_BYTES) {
        this.uploading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'שגיאה',
          detail: 'התמונה גדולה מדי גם אחרי דחיסה — נסי קובץ ברזולוציה נמוכה יותר',
        });
        return;
      }
      const fd = new FormData();
      fd.append('file', blob, 'hero.jpg');
      this.api.postFormData<{ url: string }>('settings/me/landing/upload', fd).subscribe({
        next: (res) => {
          this.uploading.set(false);
          const url = resolvePublicAssetUrl(res.url);
          if (which === 'cover') this.coverImageUrl.set(url);
          else this.secondaryHeroImageUrl.set(url);
          this.messages.add({ severity: 'success', summary: 'הועלה', detail: 'התמונה עודכנה' });
        },
        error: (err: { error?: { message?: string } }) => {
          this.uploading.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: err?.error?.message ?? 'העלאה נכשלה',
          });
        },
      });
    } catch (err: unknown) {
      this.uploading.set(false);
      this.messages.add({
        severity: 'error',
        summary: 'שגיאה',
        detail: compressImageErrorMessage(err),
      });
    }
  }

  async onGalleryFiles(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const files = input.files;
    input.value = '';
    if (!files?.length) return;
    this.uploading.set(true);
    let added = 0;
    try {
      for (const file of Array.from(files)) {
        const typeOk =
          file.type.startsWith('image/') || file.type === '' || file.type === 'application/octet-stream';
        if (!typeOk) {
          this.messages.add({
            severity: 'warn',
            summary: 'דילוג',
            detail: `${file.name}: לא קובץ תמונה`,
          });
          continue;
        }
        if (file.size > MAX_ORIGINAL_BYTES) {
          this.messages.add({
            severity: 'warn',
            summary: 'דילוג',
            detail: `${file.name}: מקסימום 25MB לקובץ מקורי`,
          });
          continue;
        }
        const blob = await compressImageFile(file, { maxBytes: 2_000_000 });
        if (blob.size > MAX_UPLOAD_BYTES) {
          this.messages.add({
            severity: 'warn',
            summary: 'דילוג',
            detail: `${file.name}: גדולה מדי גם אחרי דחיסה`,
          });
          continue;
        }
        const fd = new FormData();
        fd.append('file', blob, 'gallery.jpg');
        const res = await new Promise<{ url: string }>((resolve, reject) => {
          this.api.postFormData<{ url: string }>('settings/me/landing/upload', fd).subscribe({
            next: resolve,
            error: reject,
          });
        });
        this.galleryItems.update((items) => [
          ...items,
          {
            id: newGalleryId(),
            imageUrl: resolvePublicAssetUrl(res.url),
            title: '',
            type: 'service',
          },
        ]);
        added += 1;
      }
      if (added === 0) {
        this.messages.add({
          severity: 'warn',
          summary: 'לא הועלו תמונות',
          detail: 'אף קובץ לא הועלה. בדקי סוג הקובץ והגודל, או נסי שוב.',
        });
      } else {
        this.messages.add({
          severity: 'success',
          summary: 'הועלה',
          detail: added === 1 ? 'התמונה נוספה לגלריה — לחצי שמירה כדי לפרסם' : `${added} תמונות נוספו לגלריה — לחצי שמירה כדי לפרסם`,
        });
      }
    } catch (err: unknown) {
      const httpMsg =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : undefined;
      this.messages.add({
        severity: 'error',
        summary: 'שגיאה',
        detail: httpMsg || compressImageErrorMessage(err),
      });
    } finally {
      this.uploading.set(false);
    }
  }

  removeGalleryItem(index: number): void {
    this.galleryItems.update((items) => items.filter((_, i) => i !== index));
  }

  updateGalleryTitle(index: number, title: string): void {
    this.galleryItems.update((items) =>
      items.map((g, i) => (i === index ? { ...g, title } : g))
    );
  }

  updateGalleryType(index: number, type: unknown): void {
    const t: 'product' | 'service' = type === 'product' ? 'product' : 'service';
    this.galleryItems.update((items) =>
      items.map((g, i) => (i === index ? { ...g, type: t } : g))
    );
  }

  onGalDragStart(index: number): void {
    this.dragGalFrom = index;
  }

  onGalDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  onGalDrop(index: number): void {
    const from = this.dragGalFrom;
    this.dragGalFrom = null;
    if (from == null || from === index) return;
    this.galleryItems.update((items) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }

  onSvcDragStart(index: number): void {
    this.dragSvcFrom = index;
  }

  onSvcDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  onSvcDrop(index: number): void {
    const from = this.dragSvcFrom;
    this.dragSvcFrom = null;
    if (from == null || from === index) return;
    this.serviceOrderIds.update((ids) => {
      const next = [...ids];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }

  save(): void {
    console.log('[DEBUG] save() called');
    if (this.saving()) return;
    const issues = collectProductRowIssues(
      this.products.getRawValue() as LandingProductRowValue[]
    );
    if (issues.length) {
      this.products.markAllAsTouched();
      this.previewProductsTick.update((n) => n + 1);
      this.scrollToFirstProductIssue();
      this.messages.add({
        severity: 'warn',
        summary: 'יש לתקן את המוצרים',
        detail: issues[0],
      });
      return;
    }
    this.saving.set(true);
    const landingProducts = this.buildPreviewProducts();
    this.api
      .put<unknown>('settings/me/settings', {
        landingTagline: this.landingTagline().trim(),
        coverImageUrl: resolvePublicAssetUrl(this.coverImageUrl()),
        landingSecondaryHeroImageUrl: resolvePublicAssetUrl(this.secondaryHeroImageUrl()),
        landingHeroDescription: this.heroDescription().trim(),
        businessPhonePublic: this.businessPhonePublic().trim(),
        publicRating: Number(this.publicRating()),
        landingGalleryItems: this.galleryItems().map((g) => ({
          id: g.id,
          imageUrl: resolvePublicAssetUrl(g.imageUrl),
          title: (g.title ?? '').trim(),
          type: g.type,
        })),
        landingContact: {
          whatsapp: this.contactWhatsapp().trim(),
          email: this.contactEmail().trim(),
          location: this.contactLocation().trim(),
        },
        landingSectionVisibility: {
          hero: this.secHero(),
          services: this.secServices(),
          gallery: this.secGallery(),
          products: this.secProducts(),
          reviews: this.secReviews(),
          cta: this.secCta(),
        },
        landingServiceOrder: this.serviceOrderIds(),
        landingProducts,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.stripBlankProductRows();
          this.messages.add({
            severity: 'success',
            summary: 'נשמר',
            detail: 'דף הנחיתה עודכן ומסתנכרן לכתובת הציבורית',
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

  scrollToFirstProductIssue(): void {
    const index = this.firstProductIssueIndex();
    if (index < 0 || typeof document === 'undefined') return;
    document.getElementById(`bls-product-row-${index}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  private stripBlankProductRows(): void {
    const rows = this.products.getRawValue() as LandingProductRowValue[];
    for (let i = rows.length - 1; i >= 0; i--) {
      if (isBlankProductRow(rows[i])) {
        this.products.removeAt(i);
      }
    }
    this.previewProductsTick.update((n) => n + 1);
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
