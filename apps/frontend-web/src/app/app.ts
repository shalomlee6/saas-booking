import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { dir: 'rtl' },
})
export class App {
  protected readonly title = signal('frontend-web');
}
