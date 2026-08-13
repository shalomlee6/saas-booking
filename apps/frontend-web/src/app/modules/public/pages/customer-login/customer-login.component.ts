import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { PublicBusiness } from '../../services/public-api.service';
import { PublicApiService } from '../../services/public-api.service';
import { PublicSessionService } from '../../services/public-session.service';
import {
  formatParsedErrorForUi,
  parseHttpClientError,
} from '../../../../shared/utils/http-field-errors.util';
import { readBusinessSlugFromPathFromRoot } from '../../utils/public-route-snapshot.util';

@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './customer-login.component.html',
  styleUrl: './customer-login.component.scss',
})
export class CustomerLoginComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly publicApi = inject(PublicApiService);
  private readonly session = inject(PublicSessionService);

  readonly step = signal<1 | 2>(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly business = signal<PublicBusiness | null>(null);

  slug = computed(() => readBusinessSlugFromPathFromRoot(this.route));

  formStep1: FormGroup;
  formStep2: FormGroup;

  constructor() {
    this.formStep1 = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\s+\-()]+$/)]],
    });
    this.formStep2 = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(8)]],
    });
  }

  ngOnInit(): void {
    // const slug = this.slug();
    // if (slug) {
    //   this.publicApi.getBusiness(slug).subscribe({
    //     next: (b) => this.business.set(b),
    //     error: () => {},
    //   });
    // }
  }

  get name() {
    return this.formStep1.get('name');
  }
  get phone() {
    return this.formStep1.get('phone');
  }
  get code() {
    return this.formStep2.get('code');
  }

  /** Normalize phone to digits only for API. */
  private normalizePhone(value: string): string {
    return value.replace(/\D/g, '');
  }

  /** Split name into first/last (first word = firstName, rest = lastName). */
  private splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
    return {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
    };
  }

  continue(): void {
    if (this.loading()) return;
    this.formStep1.markAllAsTouched();
    if (this.formStep1.invalid) {
      this.error.set(null);
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const slug = this.slug();
    const nameVal = this.formStep1.get('name')?.value?.trim() ?? '';
    const phoneVal = this.normalizePhone(this.formStep1.get('phone')?.value ?? '');
    const { firstName, lastName } = this.splitName(nameVal);

    this.publicApi.requestOtp(slug, { phone: phoneVal, firstName, lastName }).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set(2);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          formatParsedErrorForUi(parseHttpClientError(err)) ??
            'Something went wrong. Try again.'
        );
      },
    });
  }

  verify(): void {
    if (this.loading()) return;
    this.formStep2.markAllAsTouched();
    if (this.formStep2.invalid) {
      this.error.set(null);
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const slug = this.slug();
    const phoneVal = this.normalizePhone(this.formStep1.get('phone')?.value ?? '');
    const codeVal = this.formStep2.get('code')?.value?.trim() ?? '';

    this.publicApi.verifyOtp(slug, { phone: phoneVal, code: codeVal }).subscribe({
      next: (res) => {
        // Prefer the name returned by the server (registered name); fall back to
        // what the user typed in the form if the backend did not echo it back.
        const nameFromForm = this.formStep1.get('name')?.value?.trim() ?? '';
        const displayName = (res.customerName ?? nameFromForm) || undefined;
        this.session.setSession(res.token, slug, res.customerId, displayName);
        this.loading.set(false);
        this.router.navigate(['/b', slug]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          formatParsedErrorForUi(parseHttpClientError(err)) ??
            'Invalid code. Try again.'
        );
      },
    });
  }

  back(): void {
    this.step.set(1);
    this.error.set(null);
    this.formStep2.reset();
  }
}
