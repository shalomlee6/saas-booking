import { Component, signal, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ApiService } from '../../../../core/api/api.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ToastModule],
  templateUrl: './register.component.html',
  styleUrl: '../login/login.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  get email() {
    return this.form.get('email');
  }

  get password() {
    return this.form.get('password');
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const payload = {
      email: this.form.get('email')?.value,
      password: this.form.get('password')?.value,
    };

    this.api
      .post<{
        token?: string;
        user: { id: string; email: string; role: string; businessId?: string };
      }>('auth/register', payload)
      .subscribe({
        next: (res) => {
          this.auth.recordSessionExpiryFromJwt(res.token);
          this.auth.init().subscribe({
            next: () => {
              this.loading.set(false);
              void this.router.navigate(['/dashboard']);
            },
            error: () => {
              this.loading.set(false);
              const msg = 'Account created but session could not be loaded. Try logging in.';
              this.errorMessage.set(msg);
              this.messageService.add({ severity: 'error', summary: 'שגיאה', detail: msg });
            },
          });
        },
        error: (err) => {
          this.loading.set(false);
          const msg =
            err?.error?.message ||
            'Registration failed. Please check your details and try again.';
          this.errorMessage.set(msg);
          this.messageService.add({ severity: 'error', summary: 'הרשמה נכשלה', detail: msg });
        },
      });
  }
}
