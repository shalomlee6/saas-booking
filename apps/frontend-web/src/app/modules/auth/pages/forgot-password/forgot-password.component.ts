import { Component, signal, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ApiService } from '../../../../core/api/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ToastModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: '../login/login.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get email() {
    return this.form.get('email');
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.api
      .post<{ message: string }>('auth/forgot-password', {
        email: this.form.get('email')?.value,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.submitted.set(true);
        },
        error: (err) => {
          this.loading.set(false);
          const msg =
            err?.error?.message ||
            'Could not send a reset email. Please try again.';
          this.errorMessage.set(msg);
          this.messageService.add({ severity: 'error', summary: 'שגיאה', detail: msg });
        },
      });
  }
}
