import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  AdminApiService,
  type AdminPlanTier,
} from '../../services/admin-api.service';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

function normalizeCreateUserSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function autoSlugFromBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@%';
  let s = '';
  const buf = new Uint32Array(14);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 14; i += 1) {
    s += chars[buf[i]! % chars.length];
  }
  return s;
}

@Component({
  selector: 'app-super-admin-create-user',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './super-admin-create-user.component.html',
  styleUrl: './super-admin-create-user.component.scss',
})
export class SuperAdminCreateUserComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly bookingPreviewBase = computed(
    () => this.document.defaultView?.location?.origin ?? ''
  );

  readonly businessName = signal('');
  readonly slugInput = signal('');
  readonly slugManual = signal(false);
  readonly timezone = signal('Asia/Jerusalem');
  readonly selectedPlan = signal<AdminPlanTier>('free');
  readonly ownerName = signal('');
  readonly ownerEmail = signal('');
  readonly ownerPhone = signal('');
  readonly ownerPassword = signal('');
  readonly passwordVisible = signal(false);

  readonly slugCheck = signal<'idle' | 'checking' | 'ok' | 'bad' | 'invalid'>('idle');
  readonly submitting = signal(false);
  readonly submitAttempted = signal(false);
  readonly fieldError = signal<{
    businessName?: string;
    ownerName?: string;
    ownerEmail?: string;
    slug?: string;
    password?: string;
  }>({});

  readonly timezoneOptions = [
    { label: 'Asia/Jerusalem', value: 'Asia/Jerusalem' },
    { label: 'UTC', value: 'UTC' },
    { label: 'Europe/London', value: 'Europe/London' },
    { label: 'America/New_York', value: 'America/New_York' },
  ];

  readonly previewSlug = computed(() => normalizeCreateUserSlug(this.slugInput()));

  constructor() {
    toObservable(this.slugInput)
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((raw) => {
          const norm = normalizeCreateUserSlug(raw);
          if (norm.length < 2) {
            this.slugCheck.set(norm.length === 0 ? 'idle' : 'invalid');
            return of(null);
          }
          this.slugCheck.set('checking');
          return this.adminApi.checkSlug(norm).pipe(
            catchError(() => of({ available: false as boolean }))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        if (res === null) return;
        this.slugCheck.set(res.available ? 'ok' : 'bad');
      });

    this.ownerPassword.set(randomPassword());
  }

  onBusinessNameInput(value: string): void {
    this.businessName.set(value);
    if (!this.slugManual()) {
      this.slugInput.set(autoSlugFromBusinessName(value.trim()));
    }
  }

  onSlugInput(value: string): void {
    this.slugManual.set(true);
    this.slugInput.set(value);
  }

  regenerateSlugFromName(): void {
    this.slugManual.set(false);
    this.slugInput.set(autoSlugFromBusinessName(this.businessName().trim()));
  }

  togglePasswordVisible(): void {
    this.passwordVisible.update((v) => !v);
  }

  regeneratePassword(): void {
    this.ownerPassword.set(randomPassword());
  }

  selectPlan(plan: AdminPlanTier): void {
    this.selectedPlan.set(plan);
  }

  onSubmit(): void {
    this.submitAttempted.set(true);
    const biz = this.businessName().trim();
    const owner = this.ownerName().trim();
    const email = this.ownerEmail().trim().toLowerCase();
    const slugNorm = normalizeCreateUserSlug(this.slugInput());
    const pw = this.ownerPassword().trim();
    const err: {
      businessName?: string;
      ownerName?: string;
      ownerEmail?: string;
      slug?: string;
      password?: string;
    } = {};
    if (!biz) err.businessName = 'נדרש שם עסק';
    if (!owner) err.ownerName = 'נדרש שם מלא';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.ownerEmail = 'אימייל לא תקין';
    }
    if (slugNorm.length < 2) err.slug = 'נדרש slug באורך 2 תווים לפחות';
    if (this.slugCheck() === 'bad') err.slug = 'ה־slug תפוס';
    if (this.slugCheck() === 'checking') err.slug = 'ממתין לאימות slug…';
    if (pw.length < 8) err.password = 'סיסמה קצרה מדי (מינ׳ 8 תווים)';
    if (Object.keys(err).length > 0) {
      this.fieldError.set(err);
      return;
    }
    this.fieldError.set({});
    this.submitting.set(true);
    this.adminApi
      .createBusiness({
        businessName: biz,
        ownerFullName: owner,
        ownerEmail: email,
        ownerPhone: this.ownerPhone().trim() || undefined,
        plan: this.selectedPlan(),
        timezone: this.timezone(),
        businessSlug: slugNorm,
        ownerPassword: pw.length >= 8 ? pw : undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.messages.add({
            severity: 'success',
            summary: 'נוצר בהצלחה',
            detail: 'העסק נוצר בהצלחה! פרטי הכניסה נשלחו למייל',
          });
          void this.router.navigate(['/super-admin/users']);
        },
        error: (e: { error?: { message?: string } }) => {
          this.submitting.set(false);
          const msg = e?.error?.message ?? 'שגיאה ביצירה';
          this.messages.add({ severity: 'error', summary: 'שגיאה', detail: msg });
        },
      });
  }
}
