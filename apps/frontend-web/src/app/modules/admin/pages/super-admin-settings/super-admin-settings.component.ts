import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService, type PlatformSettingsDto } from '../../services/admin-api.service';

@Component({
  selector: 'app-super-admin-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    ToggleSwitchModule,
    CardModule,
    ToastModule,
  ],
  templateUrl: './super-admin-settings.component.html',
  styleUrl: './super-admin-settings.component.scss',
})
export class SuperAdminSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  private lastSaved: PlatformSettingsDto | null = null;

  readonly form = this.fb.nonNullable.group({
    platformDisplayName: ['', [Validators.required, Validators.maxLength(120)]],
    defaultTrialDurationDays: [14, [Validators.required, Validators.min(0), Validators.max(3650)]],
    maintenanceMode: [false],
    flagBooking: [true],
    flagMarketing: [false],
    flagWaitlist: [false],
  });

  emailNote = '';

  ngOnInit(): void {
    this.adminApi.getSettings().subscribe({
      next: (s) => this.applyServer(s),
      error: (err) => {
        this.loading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Settings',
          detail: err?.error?.message ?? 'Failed to load',
        });
      },
    });
  }

  private applyServer(s: PlatformSettingsDto): void {
    this.lastSaved = { ...s };
    const flags = s.featureFlags ?? {};
    this.form.patchValue({
      platformDisplayName: s.platformDisplayName,
      defaultTrialDurationDays: s.defaultTrialDurationDays,
      maintenanceMode: s.maintenanceMode,
      flagBooking: flags['booking'] !== false,
      flagMarketing: flags['marketing'] === true,
      flagWaitlist: flags['waitlist'] === true,
    });
    this.emailNote = s.emailConfigurationNote;
    this.loading.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      platformDisplayName: v.platformDisplayName.trim(),
      defaultTrialDurationDays: v.defaultTrialDurationDays,
      maintenanceMode: v.maintenanceMode,
      featureFlags: {
        booking: v.flagBooking,
        marketing: v.flagMarketing,
        waitlist: v.flagWaitlist,
      },
    };
    this.saving.set(true);

    this.adminApi.patchSettings(body).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.lastSaved = { ...s };
        this.messages.add({ severity: 'success', summary: 'Saved', detail: 'Platform settings updated.' });
        this.applyServer(s);
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Save failed',
          detail: err?.error?.message ?? 'Request failed',
        });
      },
    });
  }
}
