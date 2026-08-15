import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  type AdminBusinessFeatures,
  type AdminPlanTier,
  type AdminUserDetail,
  type PatchAdminUserBody,
} from '../../services/admin-api.service';
import { planLabel } from '../super-admin-users/super-admin-users-table.util';

const DEFAULT_FEATURES: AdminBusinessFeatures = {
  bookingEnabled: true,
  marketingModule: false,
  waitlistEnabled: false,
  analyticsEnabled: false,
};

@Component({
  selector: 'app-super-admin-user-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    CardModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    TextareaModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './super-admin-user-detail.component.html',
  styleUrl: './super-admin-user-detail.component.scss',
})
export class SuperAdminUserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly serverUser = signal<AdminUserDetail | null>(null);

  readonly draftName = signal('');
  readonly draftEmail = signal('');
  readonly draftRole = signal<string>('');
  readonly draftPlan = signal<AdminPlanTier | null>(null);
  readonly draftStatusActive = signal(true);
  readonly draftSuspensionReason = signal('');
  readonly draftFeatures = signal<AdminBusinessFeatures>({ ...DEFAULT_FEATURES });

  readonly userId = signal<string | null>(null);

  readonly roleOptions = [
    { label: 'Super admin', value: 'super_admin' },
    { label: 'Owner', value: 'owner' },
    { label: 'Staff', value: 'staff' },
    { label: 'Client', value: 'client' },
  ];

  readonly planOptions: { label: string; value: AdminPlanTier }[] = [
    { label: 'Free', value: 'free' },
    { label: 'Pro', value: 'pro' },
    { label: 'Premium', value: 'premium' },
  ];

  readonly roleEditable = computed(() => {
    const r = this.serverUser()?.role;
    return r === 'staff' || r === 'client';
  });

  readonly planEditable = computed(() => !!this.serverUser()?.businessId);

  readonly featuresEditable = computed(() => !!this.serverUser()?.businessId);

  readonly canDelete = computed(() => {
    const r = this.serverUser()?.role;
    return r === 'staff' || r === 'client';
  });

  readonly statusLocked = computed(() => this.serverUser()?.role === 'super_admin');

  readonly displayName = computed(() => this.draftName().trim() || this.serverUser()?.name || 'User');
  readonly statusBadgeLabel = computed(() => (this.draftStatusActive() ? 'Active' : 'Suspended'));
  readonly planBadgeLabel = computed(() => planLabel(this.draftPlan()));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      void this.router.navigate(['/super-admin/users']);
      return;
    }
    this.userId.set(id);
    this.loadUser(id);
  }

  private loadUser(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.adminApi.getUser(id).subscribe({
      next: (u) => {
        this.applyServerUser(u);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.loadError.set(err?.error?.message ?? 'Failed to load user');
        this.messages.add({
          severity: 'error',
          summary: 'User',
          detail: err?.error?.message ?? 'Failed to load',
        });
      },
    });
  }

  private applyServerUser(u: AdminUserDetail): void {
    this.serverUser.set(u);
    this.draftName.set(u.name ?? '');
    this.draftEmail.set(u.email ?? '');
    this.draftRole.set(u.role);
    this.draftPlan.set(u.plan);
    this.draftStatusActive.set(u.status === 'active');
    this.draftSuspensionReason.set('');
    const bf = u.businessFeatures;
    this.draftFeatures.set(
      bf
        ? {
            bookingEnabled: bf.bookingEnabled !== false,
            marketingModule: !!bf.marketingModule,
            waitlistEnabled: !!bf.waitlistEnabled,
            analyticsEnabled: !!bf.analyticsEnabled,
          }
        : { ...DEFAULT_FEATURES }
    );
  }

  private collectPatchBody(): { body: PatchAdminUserBody; hasChanges: boolean } {
    const u = this.serverUser();
    if (!u) return { body: {}, hasChanges: false };
    const body: PatchAdminUserBody = {};
    let has = false;
    const name = this.draftName().trim();
    if (name !== (u.name ?? '').trim()) {
      body.name = name;
      has = true;
    }
    const email = this.draftEmail().trim().toLowerCase();
    if (email !== (u.email ?? '').toLowerCase()) {
      body.email = email;
      has = true;
    }
    if (this.roleEditable() && this.draftRole() !== u.role) {
      body.role = this.draftRole() as PatchAdminUserBody['role'];
      has = true;
    }
    const active = this.draftStatusActive();
    const status = active ? 'active' : 'disabled';
    if (status !== u.status) {
      body.status = status;
      has = true;
      if (!active) {
        const reason = this.draftSuspensionReason().trim();
        if (reason) body.suspensionReason = reason;
      }
    }
    if (this.featuresEditable()) {
      const orig = u.businessFeatures;
      const d = this.draftFeatures();
      const partial: Partial<AdminBusinessFeatures> = {};
      if (!orig || orig.bookingEnabled !== d.bookingEnabled) partial.bookingEnabled = d.bookingEnabled;
      if (!orig || orig.marketingModule !== d.marketingModule) partial.marketingModule = d.marketingModule;
      if (!orig || orig.waitlistEnabled !== d.waitlistEnabled) partial.waitlistEnabled = d.waitlistEnabled;
      if (!orig || orig.analyticsEnabled !== d.analyticsEnabled) partial.analyticsEnabled = d.analyticsEnabled;
      if (Object.keys(partial).length > 0) {
        body.businessFeatures = partial;
        has = true;
      }
    }
    return { body, hasChanges: has };
  }

  private planDirty(): boolean {
    const u = this.serverUser();
    if (!u?.businessId) return false;
    return this.draftPlan() !== u.plan;
  }

  save(): void {
    const id = this.userId();
    const u = this.serverUser();
    if (!id || !u) return;
    const name = this.draftName().trim();
    if (!name) {
      this.messages.add({ severity: 'warn', summary: 'Name', detail: 'Name is required.' });
      return;
    }
    const email = this.draftEmail().trim();
    if (!email) {
      this.messages.add({ severity: 'warn', summary: 'Email', detail: 'Email is required.' });
      return;
    }
    const { body, hasChanges } = this.collectPatchBody();
    const planChanged = this.planDirty();
    if (!hasChanges && !planChanged) {
      this.messages.add({ severity: 'info', summary: 'No changes', detail: 'Nothing to save.' });
      return;
    }
    void this.runSave(id, u, body, planChanged);
  }

  private async runSave(
    id: string,
    u: AdminUserDetail,
    body: PatchAdminUserBody,
    planChanged: boolean
  ): Promise<void> {
    this.saving.set(true);
    try {
      if (planChanged && this.draftPlan() && u.businessId) {
        await firstValueFrom(this.adminApi.patchUserPlan(id, { plan: this.draftPlan()! }));
      }
      if (Object.keys(body).length > 0) {
        await firstValueFrom(this.adminApi.patchUser(id, body));
      }
      this.messages.add({ severity: 'success', summary: 'Saved', detail: 'User updated successfully.' });
      this.loadUser(id);
    } catch (err: unknown) {
      const e = err as { error?: { message?: string } };
      this.messages.add({
        severity: 'error',
        summary: 'Save failed',
        detail: e?.error?.message ?? 'Request failed',
      });
    } finally {
      this.saving.set(false);
    }
  }

  setFeatureBooking(v: boolean): void {
    this.draftFeatures.update((f) => ({ ...f, bookingEnabled: v }));
  }

  setFeatureMarketing(v: boolean): void {
    this.draftFeatures.update((f) => ({ ...f, marketingModule: v }));
  }

  setFeatureWaitlist(v: boolean): void {
    this.draftFeatures.update((f) => ({ ...f, waitlistEnabled: v }));
  }

  setFeatureAnalytics(v: boolean): void {
    this.draftFeatures.update((f) => ({ ...f, analyticsEnabled: v }));
  }

  confirmResetPassword(): void {
    const id = this.userId();
    const u = this.serverUser();
    if (!id || !u) return;
    this.confirm.confirm({
      message: `Send a password reset link to ${u.email}? The link expires in 1 hour.`,
      header: 'Reset password',
      icon: 'pi pi-envelope',
      acceptLabel: 'Send link',
      rejectLabel: 'Cancel',
      accept: () => {
        this.adminApi.resetUserPassword(id).subscribe({
          next: (res) => {
            this.messages.add({
              severity: 'success',
              summary: 'Reset email sent',
              detail: res.message,
            });
          },
          error: (err: { error?: { message?: string } }) => {
            this.messages.add({
              severity: 'error',
              summary: 'Reset failed',
              detail: err?.error?.message ?? 'Could not send a reset email.',
            });
          },
        });
      },
    });
  }

  confirmDelete(): void {
    const u = this.serverUser();
    const id = this.userId();
    if (!u || !id || !this.canDelete()) return;
    this.confirm.confirm({
      message: `Delete ${u.email}? This cannot be undone.`,
      header: 'Delete user',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.adminApi.deleteUser(id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Deleted', detail: 'User removed.' });
            void this.router.navigate(['/super-admin/users']);
          },
          error: (err: { error?: { message?: string } }) => {
            this.messages.add({
              severity: 'error',
              summary: 'Delete failed',
              detail: err?.error?.message ?? 'Request failed',
            });
          },
        });
      },
    });
  }
}
