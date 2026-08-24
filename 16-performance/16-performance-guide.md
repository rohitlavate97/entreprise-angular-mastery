# Module 16: Performance Engineering — Measurement-First Approach

---

## 1. WHAT
Performance Engineering in Angular is the systematic, measurement-driven practice of ensuring an application loads quickly (LCP), remains visually stable (CLS), and responds immediately to user interactions (INP) by optimizing bundle sizes, runtime change detection, asset delivery, and rendering strategies.

---

## 2. WHY
- **User Retention and Conversion**: Slow applications frustrate users. In enterprise environments, sluggish internal tools directly reduce employee productivity and increase operational costs.
- **Resource Constraints**: Enterprise applications often load massive datasets (e.g., thousands of rows). The browser's main thread and memory are finite; unoptimized Angular code will easily block the thread, causing UI freezes.
- **Complexity Management**: As features grow, JavaScript bundles grow. Without deliberate code splitting, lazy loading, and bundle budgets, the initial load time degrades linearly with app size.
- **The "Measure First" Imperative**: Blindly applying "best practices" (like adding `OnPush` everywhere) without measuring first often leads to architectural complexity and insidious bugs without solving the actual bottleneck.

---

## 3. INTERNAL MENTAL MODEL

### The Web Performance Pipeline

```text
+===========================================================================================+
|                          WEB PERFORMANCE PIPELINE                                         |
|                                                                                           |
|  [ 1. Network Delivery ] ───► [ 2. Parse & Compile ] ───► [ 3. Render & Execute ]         |
|                                                                                           |
|  ┌───────────────────┐        ┌────────────────────┐      ┌─────────────────────────┐     |
|  │ - DNS Resolution  │        │ - HTML Parsing     │      │ - Layout & Paint        │     |
|  │ - TCP/TLS         │        │ - Script Fetching  │      │ - Change Detection      │     |
|  │ - TTFB (Spring)   │        │ - JS Compilation   │      │ - DOM Updates (Ivy)     │     |
|  └────────┬──────────┘        └─────────┬──────────┘      └───────────┬─────────────┘     |
|           │                             │                             │                   |
|           ▼                             ▼                             ▼                   |
|     Bottleneck:                   Bottleneck:                   Bottleneck:               |
|  Network Latency,              Large Main Bundle,            Heavy Default CD,            |
|  Backend Slow Queries          Unused JS, No Caching         Main Thread Blocking         |
|                                                                                           |
|  Metric: TTFB                  Metric: LCP, FCP              Metric: INP, CLS             |
+===========================================================================================+
```

### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: < 2.5s (Measures loading speed of the largest hero element).
- **INP (Interaction to Next Paint)**: < 200ms (Measures responsiveness to user inputs).
- **CLS (Cumulative Layout Shift)**: < 0.1 (Measures visual stability).

---

## 4. HOW IT WORKS

### The Measurement-First Methodology
1. **Measure**: Use Chrome DevTools (Performance tab, Lighthouse) and Angular DevTools (Profiler). Establish baselines for Core Web Vitals and component change detection cycles.
2. **Identify**: Pinpoint the exact bottleneck. Is it a slow API (TTFB)? A massive `main.js` bundle (Parse/Compile)? A heavy `ApplicationRef.tick()` taking 150ms (Execute)?
3. **Hypothesize**: Propose a specific fix (e.g., "Replacing Default CD with OnPush on the DataGrid will reduce CD time by 80%").
4. **Fix**: Implement the optimization.
5. **Verify**: Measure again against the baseline to confirm the impact and ensure no regressions occurred.

---

## 5. MODERN IMPLEMENTATION

### `@defer` Blocks for Non-Critical UI
Angular 17+ introduced declarative control flow with `@defer`, allowing precise chunking without manual routing setups.

```html
<!-- The chart is only loaded when it scrolls into the viewport -->
@defer (on viewport) {
  <app-heavy-chart [data]="metrics()"></app-heavy-chart>
} @placeholder {
  <div class="skeleton-chart">Loading chart...</div>
}

<!-- The rich text editor is loaded only when interacted with -->
@defer (on interaction(editorTrigger)) {
  <app-rich-text-editor></app-rich-text-editor>
} @placeholder {
  <button #editorTrigger>Edit Description</button>
}
```

### Optimized Image Loading
The `NgOptimizedImage` directive enforces best practices to improve LCP and prevent CLS.

```html
<img 
  ngSrc="https://cdn.enterprise.com/hero-image.jpg" 
  width="800" 
  height="600" 
  priority <!-- Instructs browser to preload for LCP -->
  alt="Dashboard Hero">
```

### Signals and Zoneless Readiness
Signals provide granular tracking, reducing the need for Zone.js to aggressively check the entire tree.

```typescript
// With provideExperimentalZonelessChangeDetection(), this updates DOM efficiently
@Component({
  selector: 'app-metric-card',
  standalone: true,
  template: `<div>{{ value() }}</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricCardComponent {
  value = signal(0);
  
  updateValue() {
    // In zoneless, setting a signal explicitly schedules a CD tick
    this.value.set(Math.random());
  }
}
```

---

## 6. LEGACY / ENTERPRISE REALITY

### Legacy Bundle Analysis and Tooling
In older Angular setups (Webpack-based, pre-esbuild), bundle analysis relied heavily on `webpack-bundle-analyzer`.
**Modern Shift**: Angular 17+ uses the `esbuild` builder. You now use `source-map-explorer` for analysis.

```bash
# Legacy (Webpack)
ng build --stats-json
npx webpack-bundle-analyzer dist/stats.json

# Modern (esbuild)
ng build --source-map
npx source-map-explorer dist/**/*.js
```

### Legacy Change Detection Nightmares
Enterprise codebases often feature massive component trees where everything is `ChangeDetectionStrategy.Default`. Any asynchronous event (a `setInterval`, a WebSocket message) triggers a top-down check of the entire application.
**Do not blanket-apply `OnPush`**. Measure first. Profile the `ApplicationRef.tick()` using Angular DevTools.

---

## 7. PRACTICAL EXAMPLE

### Enterprise Dashboard Optimization
**Scenario**: A dashboard loading a 1000-row table freezes the browser for 300ms on every keystroke in a global search box.

**Measurement**:
- Angular DevTools Profiler shows `refreshView` taking 250ms total.
- The 1000-row `TableRowComponent` is being checked 1000 times per keystroke.

**Fix**:
1. Implement CDK Virtual Scrolling to render only visible rows.
2. Switch `TableRowComponent` to `ChangeDetectionStrategy.OnPush`.

```typescript
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-transaction-table',
  standalone: true,
  imports: [ScrollingModule, TableRowComponent],
  template: `
    <cdk-virtual-scroll-viewport itemSize="48" class="viewport">
      <app-table-row 
        *cdkVirtualFor="let tx of transactions()" 
        [transaction]="tx">
      </app-table-row>
    </cdk-virtual-scroll-viewport>
  `
})
export class TransactionTableComponent {
  transactions = input<Transaction[]>([]);
}
```

**Verification**:
- DOM nodes reduced from 15,000 to 300.
- `refreshView` time dropped from 250ms to 8ms. INP is now < 50ms.

---

## 8. COMMON MISTAKES

1. **Pre-optimizing without Profiling**: Throwing `OnPush`, `ChangeDetectorRef.detach()`, or custom pure pipes at a problem before measuring if change detection is actually the bottleneck.
2. **Ignoring Bundle Budgets**: Allowing third-party libraries (e.g., importing the entirety of Lodash or Moment.js) to bloat the main bundle, ruining LCP.
3. **Heavy Computation in Templates**: Calling functions directly in template bindings (`{{ calculateTotal(items) }}`). These execute on every change detection cycle. Use computed signals or pure pipes instead.
4. **Missing TrackBy (or `track` in `@for`)**: Re-rendering entire lists instead of just modified items when an array reference changes.
5. **Memory Leaks in Subscriptions**: Leaving `Observable` subscriptions open, causing detached views to accumulate in memory and degrading performance over time.

---

## 9. LOCAL ISSUES

- **Symptom**: Development build feels extremely sluggish compared to production.
- **Root Cause**: Dev mode executes `ApplicationRef.tick()` twice per cycle to check for `ExpressionChangedAfterItHasBeenCheckedError`. It also avoids minification and tree-shaking.
- **Fix**: Never profile performance in dev mode. Always run `ng build --configuration=production` and profile the compiled output via a local HTTP server (`npx http-server dist/app`).

---

## 10. CI/CD ISSUES

- **Symptom**: Build fails in CI with `Error: Budget exceeded. Maximum allowed is 2 MB, but bundle is 2.4 MB.`
- **Root Cause**: A developer introduced a heavy dependency, violating the `angular.json` bundle budgets.
- **Fix**: Analyze the bundle size increase. Lazy load the feature containing the dependency, or find a lighter alternative (e.g., `date-fns` instead of `moment`).

---

## 11. PRODUCTION ISSUES

- **Symptom**: Users report poor INP (Interaction to Next Paint) on low-end mobile devices, despite fast LCP.
- **Root Cause**: The main thread is continuously blocked by long-running synchronous JavaScript tasks (e.g., parsing massive JSON payloads or heavy Default CD traversals), delaying the browser's ability to paint the frame after a user taps a button.
- **Fix**: Profile the Performance tab. Break up long tasks using `setTimeout`, Web Workers, or by optimizing the change detection tree.

---

## 12. FULL-STACK INTERACTION

### Spring Boot Response Time Impact
Angular's perceived performance is heavily coupled with the backend API.
- If Spring Boot's TTFB (Time to First Byte) is 1500ms, the frontend's LCP will be at least 1500ms + network latency, regardless of frontend optimizations.
- **Server-Side Pagination vs Client-Side Filtering**: Loading 50,000 rows into Angular and filtering them on the client crushes the JS heap and DOM. The Spring Boot backend must provide pagination, filtering, and sorting endpoints to keep frontend memory footprints small.

---

## 13. DEBUGGING PROCESS

1. **Network Waterfall**: Open Chrome DevTools Network tab. Check for long TTFB or stalled connections. Are assets downloading sequentially when they could be parallel?
2. **Main Thread Profiling**: Open the Performance tab. Record an interaction. Look for "Long Tasks" (red flags on tasks > 50ms). Drill down into the Call Tree to see if the time is spent in "Scripting" (JS execution) or "Rendering" (DOM updates).
3. **Change Detection Profiling**: Open Angular DevTools. Record a profiling session. Check which components trigger CD, how long they take, and what event caused the cycle.
4. **Bundle Analysis**: Run `source-map-explorer` to identify fat dependencies causing slow script parsing.

---

## 14. ROOT CAUSE ANALYSIS

### Why Template Functions Destroy Performance
```html
<!-- ❌ DANGEROUS -->
<div>{{ calculateHeavyTax(user) }}</div>
```
Angular has no way to know if `calculateHeavyTax` will return a different value unless it executes it. In Default CD, if the user moves the mouse and triggers 50 CD cycles per second, `calculateHeavyTax` executes 50 times a second, locking up the main thread and causing terrible INP.

---

## 15. FIX

**Fixing the Template Function Issue**:
Migrate to a Pure Pipe (which memoizes based on inputs) or a Computed Signal (which only recalculates when its dependencies change).

```typescript
// ✅ SECURE & PERFORMANT: Computed Signal
readonly user = signal<User>(initialData);
readonly tax = computed(() => {
  // Only runs when `user` changes
  return calculateHeavyTax(this.user());
});
```
```html
<!-- Template just reads the cached value -->
<div>{{ tax() }}</div>
```

---

## 16. PREVENTION

1. **Strict Bundle Budgets**: Enforce strict budgets in `angular.json` to fail builds if bundle size regressions occur.
2. **Linting Rules**: Use ESLint rules like `no-template-call-expression` to ban function calls in template bindings.
3. **Architectural Guidelines**: Mandate that all features are lazy-loaded by default, and global dependencies are kept to an absolute minimum.

---

## 17. MONITORING / OBSERVABILITY

- **Real User Monitoring (RUM)**: Integrate tools like Datadog RUM, New Relic, or Sentry to track LCP, CLS, and INP metrics in the wild, aggregated by device type and connection speed.
- **Lighthouse CI**: Run Lighthouse in the CI/CD pipeline to catch performance regressions before they hit production.

---

## 18. PERFORMANCE CONSIDERATIONS

### The Cost of Abstractions
While Angular provides excellent abstractions, they come with overhead.
- `NgFor` (legacy) vs `@for` (modern): The new `@for` block uses a more optimal reconciliation algorithm, yielding up to 90% faster runtime performance for large lists compared to `*ngFor`.
- **Zone.js Overhead**: Zone.js monkey-patches almost every browser API. While it abstracts CD triggers, it causes CD cycles for events that don't need them (like `requestAnimationFrame`). Moving toward Zoneless is the ultimate performance goal.

---

## 19. SECURITY CONSIDERATIONS

- **Third-Party Script Performance & Security**: Embedding external marketing/analytics scripts can severely impact performance and introduce XSS vulnerabilities. Always load third-party scripts asynchronously or defer them until after the application becomes interactive.
- **Dependency Bloat**: Larger bundles mean larger attack surfaces. Bundle analysis helps identify unnecessary dependencies that could contain vulnerabilities.

---

## 20. TESTING STRATEGY

- **Performance Regression Tests**: Write Playwright/Cypress tests that measure interaction time. Assert that critical flows complete within specific millisecond thresholds.
- **Lighthouse CLI**: Use Lighthouse CLI to programmatically generate performance reports and assert that scores remain above a baseline (e.g., `performance > 90`).

---

## 21. EXERCISES

1. **Profile and Fix**: Take a component with a heavy template function and a 500ms `refreshView` time. Measure it in Angular DevTools. Refactor it using computed signals and measure the improvement.
2. **Bundle Surgery**: Analyze a massive `main.js` bundle using `source-map-explorer`. Identify a heavy library (like Moment.js), remove it or replace it with a lighter alternative, and document the bundle size reduction.
3. **Implement `@defer`**: Take a page with a heavy charting library. Use `@defer (on viewport)` to delay loading the chunk until the user scrolls to it. Observe the Network tab.

---

## 22. BREAK-AND-FIX LAB

**Issue**: `ANG-PERF-001` - Dashboard Freezes on 500-Row Table
**Scenario**: The user reports that typing in the search box on the Dashboard causes the UI to stutter and freeze.
**Diagnosis**:
1. Open Chrome Performance tab, record typing. Note long tasks > 100ms.
2. Open Angular DevTools Profiler, record typing. Notice the 500-row table component re-renders completely on every keystroke because it uses `ChangeDetectionStrategy.Default` and lacks a `track` function in the loop.
**Fix**:
1. Change the table component to `ChangeDetectionStrategy.OnPush`.
2. Implement `@for (item of items; track item.id)` to prevent DOM destruction.
3. Verify via Angular DevTools that the CD cycle time dropped dramatically.

---

## 23. EXPERT QUESTIONS

1. **Staff/Principal Question**: "We have a performance issue where the UI is unresponsive. A junior engineer suggests adding `ChangeDetectionStrategy.OnPush` to every component immediately. As a Staff engineer, how do you respond?"
   *Answer Hint*: Explain the Measurement-First approach. Blindly adding `OnPush` can introduce bugs (UI not updating) and hide the true bottleneck. We must profile first using DevTools to identify *which* component is blocking the main thread, and *why* (is it CD traversal, or just synchronous JS execution?).

2. **Staff/Principal Question**: "How does Time to First Byte (TTFB) from our Spring Boot API impact our Core Web Vitals, and what can we do on the Angular side to mitigate it?"
   *Answer Hint*: High TTFB directly degrades Largest Contentful Paint (LCP) because the frontend often waits for data to render the hero element. Mitigation includes App Shell architecture, SSR/SSG (Angular Universal/hydration), eager loading critical API calls via `APP_INITIALIZER`, or implementing stale-while-revalidate caching.

3. **Staff/Principal Question**: "Explain how Angular's `@defer` blocks change the mechanics of application bundle delivery compared to traditional lazy-loaded routes."
   *Answer Hint*: Traditional lazy loading operates at the Route boundary via the Router. `@defer` operates at the Component/Template level, creating localized micro-chunks. It uses sophisticated triggers (viewport, hover, idle) without requiring router configurations, allowing aggressive code-splitting of non-critical UI elements within a single view.
