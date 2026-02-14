import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminApiService,
  type AdminBusiness,
  setImpersonationToken,
} from '../../services/admin-api.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-business-customers',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './business-customers.component.html',
  styleUrl: './business-customers.component.scss',
})
export class BusinessCustomersComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly list = signal<AdminBusiness[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly impersonating = signal(false);

  readonly filteredList = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const items = this.list();
    if (!q) return items;
    return items.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.ownerEmail && b.ownerEmail.toLowerCase().includes(q)) ||
        (b.slug && b.slug.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminApi.listBusinesses().subscribe({
      next: (items) => {
        this.list.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load businesses');
        this.loading.set(false);
      },
    });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  impersonate(business: AdminBusiness): void {
    this.impersonating.set(true);
    this.adminApi.impersonateBusiness(business._id).subscribe({
      next: (res) => {
        setImpersonationToken(res.token);
        this.auth.init().subscribe(() => {
          this.impersonating.set(false);
          this.router.navigate(['/dashboard']);
        });
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Impersonation failed');
        this.impersonating.set(false);
      },
    });
  }
}
