import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/api/api.service';
import { ThemeService } from '../../../../core/config/theme.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-business-theme-settings',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './business-theme-settings.component.html',
  styleUrl: './business-theme-settings.component.scss',
})
export class BusinessThemeSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);

  readonly form: FormGroup;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    const business = this.auth.business();
    this.form = this.fb.group({
      themeMode: [business?.ui?.themeMode ?? 'light'],
      primaryColor: [business?.ui?.primaryColor ?? '#3787F6'],
      sidebarColor: [business?.ui?.sidebarColor ?? '#0F172A'],
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.api.patch<{ ui: unknown }>('business/ui', value).subscribe({
      next: (res) => {
        this.theme.applyBusinessUi(res.ui as any);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to save');
        this.saving.set(false);
      },
    });
  }
}
