import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ChangePasswordFormComponent } from '../../../../shared/ui/change-password-form/change-password-form.component';

@Component({
  selector: 'app-business-account-settings',
  standalone: true,
  imports: [TranslatePipe, ChangePasswordFormComponent],
  templateUrl: './business-account-settings.component.html',
  styleUrl: './business-account-settings.component.scss',
})
export class BusinessAccountSettingsComponent {}
