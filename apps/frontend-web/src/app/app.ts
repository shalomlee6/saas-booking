import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Injected (not just imported) so its constructor runs immediately at bootstrap,
  // applying the persisted/default <html lang/dir> before any route renders.
  private readonly language = inject(LanguageService);

  protected readonly title = signal('frontend-web');
}
