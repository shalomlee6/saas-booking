import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  booleanAttribute,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * One-shot scroll reveal for public landing sections below the hero.
 * Adds `.pl-reveal` immediately and `.pl-reveal-in` the first time the host
 * intersects the viewport, then disconnects the observer so the section
 * never re-hides. No existing IntersectionObserver pattern existed in the
 * frontend — this is the landing-only implementation.
 */
@Directive({
  selector: '[plReveal]',
  standalone: true,
  host: {
    class: 'pl-reveal',
    '[class.pl-reveal-in]': 'revealed()',
    '[class.pl-reveal-stagger]': 'stagger()',
  },
})
export class PlRevealDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;

  /** When true, CSS staggers descendant cards instead of fading the whole block. */
  readonly stagger = input(false, { alias: 'plRevealStagger', transform: booleanAttribute });

  readonly revealed = signal(false);

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    if (typeof IntersectionObserver === 'undefined') {
      this.revealed.set(true);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          this.revealed.set(true);
          this.observer?.unobserve(el);
          this.observer?.disconnect();
          this.observer = null;
          break;
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
