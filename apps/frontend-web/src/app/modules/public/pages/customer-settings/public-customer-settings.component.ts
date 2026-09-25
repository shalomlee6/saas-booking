import { Component, inject } from '@angular/core';
import { LanguageService, type AppLanguage } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-public-customer-settings',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './public-customer-settings.component.html',
  styleUrl: './public-customer-settings.component.scss',
})
export class PublicCustomerSettingsComponent {
  readonly language = inject(LanguageService);

  setLanguage(lang: AppLanguage): void {
    this.language.setLanguage(lang);
  }
}
