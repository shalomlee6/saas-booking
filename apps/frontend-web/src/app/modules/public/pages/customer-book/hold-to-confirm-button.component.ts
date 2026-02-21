import {
  Component,
  input,
  output,
  signal,
  effect,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';

@Component({
  selector: 'app-hold-to-confirm-button',
  standalone: true,
  templateUrl: './hold-to-confirm-button.component.html',
  styleUrl: './hold-to-confirm-button.component.scss',
})
export class HoldToConfirmButtonComponent {
  private readonly el = inject(ElementRef<HTMLElement>);

  disabled = input<boolean>(false);
  durationMs = input<number>(2000);
  /** Set to true from parent when the appointment is confirmed by the server */
  successState = input<boolean>(false);

  confirm = output<void>();

  readonly progress = signal(0);
  readonly holding = signal(false);
  readonly confirmed = signal(false);
  readonly success = signal(false);

  private rafId: number | null = null;
  private startTime = 0;
  private duration = 0;

  constructor() {
    effect(() => {
      if (this.successState()) this.success.set(true);
    });
    effect(() => {
      if (this.success()) {
        this.holding.set(false);
        this.progress.set(0);
        if (this.rafId != null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      }
    });
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(e: PointerEvent): void {
    if (this.disabled() || this.confirmed() || this.success()) return;
    e.preventDefault();
    this.holding.set(true);
    this.startTime = performance.now();
    this.duration = this.durationMs();
    this.tick();
  }

  @HostListener('pointerup')
  @HostListener('pointerleave')
  @HostListener('pointercancel')
  onPointerUp(): void {
    if (!this.holding() || this.confirmed()) return;
    this.holding.set(false);
    this.progress.set(0);
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    this.rafId = requestAnimationFrame(() => {
      const elapsed = performance.now() - this.startTime;
      const p = Math.min(1, elapsed / this.duration);
      this.progress.set(p);
      if (p >= 1) {
        this.holding.set(false);
        this.confirmed.set(true);
        this.rafId = null;
        this.confirm.emit();
      } else {
        this.tick();
      }
    });
  };
}
