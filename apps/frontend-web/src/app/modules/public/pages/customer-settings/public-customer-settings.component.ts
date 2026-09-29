import { Component, inject } from '@angular/core';
import { LanguageService, type AppLanguage } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PublicThemeService, type PublicThemeMode } from '../../services/public-theme.service';

@Component({
  selector: 'app-public-customer-settings',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './public-customer-settings.component.html',
  styleUrl: './public-customer-settings.component.scss',
})
export class PublicCustomerSettingsComponent {
  readonly language = inject(LanguageService);
  readonly theme = inject(PublicThemeService);

  setLanguage(lang: AppLanguage): void {
    this.language.setLanguage(lang);
  }

  setThemeMode(mode: PublicThemeMode): void {
    this.theme.setMode(mode);
  }
}
