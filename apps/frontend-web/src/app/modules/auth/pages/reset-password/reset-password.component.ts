import { Component, signal, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ApiService } from '../../../../core/api/api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ToastModule],
  templateUrl: './reset-password.component.html',
  styleUrl: '../login/login.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly tokenMissing = signal(false);

  readonly form: FormGroup = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  private token = '';

  get password() {
    return this.form.get('password');
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    this.tokenMissing.set(this.token.length < 16);
  }

  onSubmit(): void {
    if (this.tokenMissing() || this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.api
      .post<{ message: string }>('auth/reset-password', {
        token: this.token,
        password: this.form.get('password')?.value,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Password updated',
            detail: 'You can sign in with your new password.',
          });
          void this.router.navigate(['/auth/login']);
        },
        error: (err) => {
          this.loading.set(false);
          const msg =
            err?.error?.message ||
            'This reset link is invalid or has expired.';
          this.errorMessage.set(msg);
          this.messageService.add({ severity: 'error', summary: 'שגיאה', detail: msg });
        },
      });
  }
}
