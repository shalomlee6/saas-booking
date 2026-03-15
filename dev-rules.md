# Saas-Booking development rules

## Angular: no component function calls in templates

**Rule:** Do not call component methods or non-signal functions directly from Angular templates without explicit justification.

### Why

Template expressions (interpolation, bindings, `@if` / `@for` conditions) run during change detection. Calling a method from the template can run that method many times (e.g. once per row in a list), which hurts performance.

### Bad patterns

- `{{ dayName(day) }}` — method in interpolation
- `[class.x]="isToday(day)"` — method in binding
- `@if (hasError()) { ... }` — method in control flow (when `hasError` is a method, not a signal)
- `@for (x of getItems(); track x.id)` — method returning array used as `@for` source

### Good patterns

- **Signals / computed:** `{{ label() }}`, `@for (x of items(); track x.id)` where `items` is a `signal()` or `computed()`.
- **Precomputed view-models:** Build an array of `{ day, dayName }` in the component and bind to `dayName` in the template.
- **Pure pipes:** Use a pipe for formatting only when the logic is pure and reused (e.g. `{{ value | myFormat }}`).
- **Event handlers:** `(click)="onSave()"` is fine; it runs only on user action.

### Example

```html
<!-- Bad -->
<span>{{ dayName(day) }}</span>
@for (a of getAppointments(); track a.id) { ... }

<!-- Good -->
<span>{{ dayLabel }}</span>   <!-- dayLabel from precomputed row -->
@for (a of appointments(); track a.id) { ... }   <!-- appointments is computed() -->
```

---

Other project rules live in [.cursor/rules/](.cursor/rules/).
