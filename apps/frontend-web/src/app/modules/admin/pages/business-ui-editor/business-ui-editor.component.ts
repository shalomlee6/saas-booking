import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService } from '../../services/admin-api.service';
import { ThemeService } from '../../../../core/config/theme.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-business-ui-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './business-ui-editor.component.html',
  styleUrl: './business-ui-editor.component.scss',
})
export class BusinessUiEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly adminApi = inject(AdminApiService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);

  readonly form: FormGroup;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly businessId = signal<string | null>(null);
  readonly businessName = signal<string>('');

  constructor() {
    this.form = this.fb.group({
      themeMode: ['light'],
      primaryColor: ['#3787F6'],
      sidebarColor: ['#0F172A'],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/business-customers']);
      return;
    }
    this.businessId.set(id);
    this.loading.set(true);
    this.adminApi.listBusinesses().subscribe({
      next: (list) => {
        const b = list.find((x) => x._id === id);
        if (b) {
          this.businessName.set(b.name);
          this.form.patchValue({
            themeMode: b.ui?.themeMode ?? 'light',
            primaryColor: b.ui?.primaryColor ?? '#3787F6',
            sidebarColor: b.ui?.sidebarColor ?? '#0F172A',
          });
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load business');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    const id = this.businessId();
    if (!id || this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.adminApi.updateBusinessUi(id, value).subscribe({
      next: (res) => {
        this.saving.set(false);
        const currentBusinessId = this.auth.user()?.businessId;
        if (currentBusinessId === id) {
          this.theme.applyBusinessUi(res.ui);
        }
        this.router.navigate(['/admin/business-customers']);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to save');
        this.saving.set(false);
      },
    });
  }
}
