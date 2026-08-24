# Module 03: Angular Fundamentals & Modern Standalone Architecture

---

## 1. WHAT
Angular Fundamentals in modern Angular (v17, v18, v19+) centers on the **Standalone Architecture**—a component-first paradigm that eliminates `NgModule` containers in favor of direct component imports, functional environment providers (`provideHttpClient`, `provideRouter`), strict template type-checking, fine-grained Signals reactivity, and native built-in control flow (`@if`, `@for`, `@switch`, `@let`, `@defer`).

---

## 2. WHY
- **Zero NgModule Overhead**: Standalone components make dependency boundaries explicit, drastically reducing mental overhead, eliminating circular module dependencies, and enabling fine-grained tree-shaking by modern bundlers (esbuild/Vite).
- **Sub-Second Compilation & Lazy Loading**: Standalone components can be lazy-loaded directly at the route level via `loadComponent: () => import('./...')` without needing wrapper module routing files.
- **Predictable Provider Scoping**: Replacing module-level providers with **Environment Injectors** (`provideRouter`, `provideHttpClient`) and **Element Injectors** makes service lifecycles and dependency resolution completely deterministic.

---

## 3. INTERNAL MENTAL MODEL

```
+----------------------------------------------------------------------------------------------------+
|                                  STANDALONE APPLICATION RUNTIME                                    |
|                                                                                                    |
|  [ index.html ]                                                                                    |
|         |                                                                                          |
|         v                                                                                          |
|  [ main.ts: bootstrapApplication(AppComponent, appConfig) ]                                       |
|         |                                                                                          |
|         +------------------------------------------------------------------+                       |
|         |                                                                  |                       |
|         v (Environment Injector Tree)                                      v (Root View Container) |
|  +--------------------------------------------+                  +------------------------------+  |
|  |             Root Environment               |                  |        <app-root>            |  |
|  |  - provideRouter(routes)                   |                  |  (AppComponent Instance)     |  |
|  |  - provideHttpClient(withInterceptors([])) |                  +--------------+---------------+  |
|  |  - provideAnimationsAsync()                |                                 |                  |
|  +---------------------+----------------------+                                 |                  |
|                        |                                                        v (Router Outlet)  |
|                        |                             +------------------------------------------+  |
|                        | (Scoped Route Injector)     |      Active Lazy Component View          |  |
|                        +---------------------------->|      (e.g., TransferDashboardComponent) |  |
|                                                      |  - imports: [TableComponent, Button]     |  |
|                                                      |  - signals: state = signal(...)          |  |
|                                                      +------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

### Standalone Component Isolation vs NgModule Coupling
```
LEGACY (NgModule Monolith):
[ SharedModule ] -----> Exports 50 Components (Bloated Chunk, All or Nothing Loading)
       |
       +---> [ FeatureModule A ] (Imports all 50 components even if it only needs 1 button)

MODERN (Standalone Explicit Graph):
[ DashboardComponent ]
       |---> imports: [ AccountTableComponent, CurrencyPipe ] (Only bundles exact dependencies)
```

---

## 4. HOW IT WORKS: STANDALONE BOOTSTRAP & EXECUTION

1. **Bootstrap Initialization (`bootstrapApplication`)**:
   - Angular loads `main.ts` and invokes `bootstrapApplication(AppComponent, appConfig)`.
   - It instantiates the **Root Environment Injector** using providers registered in `appConfig.providers` (`provideRouter`, `provideHttpClient`).
2. **Component Factory Compilation (Ivy Engine)**:
   - The compiler analyzes `AppComponent.imports` array.
   - It validates that every standalone directive, pipe, and component referenced in the template is explicitly declared in `imports`.
3. **Template Parsing & Control Flow Binding**:
   - Modern control flow blocks (`@if`, `@for`, `@let`) are compiled directly into optimized JavaScript branching opcodes without synthesizing artificial `<ng-template>` or `NgIf` directive wrapper instances.
4. **DOM Mounting**:
   - Angular locates the `<app-root>` element in `index.html`, instantiates `AppComponent`, attaches its ViewRef to the root `ApplicationRef`, and initiates the initial change detection microtask.

---

## 5. MODERN IMPLEMENTATION

### A. Application Configuration (`app.config.ts` & `main.ts`)

```typescript
// frontend/src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { requestIdInterceptor } from './core/interceptors/request-id.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless or Zone-coalescing change detection
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // Modern Standalone Router with View Transitions API & Component Input Binding
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions()
    ),

    // Modern Fetch-based HttpClient with functional interceptors
    provideHttpClient(
      withFetch(),
      withInterceptors([requestIdInterceptor, authInterceptor])
    )
  ]
};
```

```typescript
// frontend/src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error('Application Bootstrap Failed:', err));
```

### B. Modern Feature Component with Control Flow & `@let` Syntax (Angular 19+)

```typescript
// frontend/src/app/features/transfers/transfer-dashboard.component.ts
import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransferService } from './services/transfer.service';
import { AccountCardComponent } from './components/account-card.component';
import { FormatCurrencyPipe } from '../../shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-transfer-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AccountCardComponent,
    FormatCurrencyPipe
  ],
  template: `
    <section class="dashboard-container">
      <header class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Enterprise Transfers</h1>
        <a routerLink="/transfers/new" class="btn btn-primary">Initiate Transfer</a>
      </header>

      <!-- Angular 19+ @let declaration for local template expressions -->
      @let accounts = activeAccounts();
      @let totalBalance = totalPortfolioValue();

      <div class="summary-banner p-4 rounded bg-slate-100 dark:bg-slate-800 mb-6">
        <span class="text-sm text-gray-500">Total Portfolio Value:</span>
        <strong class="text-xl ml-2">{{ totalBalance | formatCurrency:'USD' }}</strong>
      </div>

      <!-- Modern Built-in Control Flow -->
      @if (isLoading()) {
        <div class="skeleton-loader p-8 text-center" aria-busy="true">
          <span>Loading secure accounts...</span>
        </div>
      } @else if (accounts.length === 0) {
        <div class="empty-state p-8 text-center text-gray-500">
          <p>No active accounts found for this enterprise profile.</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Built-in @for with mandatory identity tracking -->
          @for (account of accounts; track account.id) {
            <app-account-card [account]="account" />
          } @empty {
            <p>No accounts available.</p>
          }
        </div>
      }

      <!-- Deferred Loading Block for Heavy Visualization Sub-tree -->
      @defer (on viewport; prefetch on idle) {
        <div class="mt-8">
          <h2 class="text-lg font-semibold mb-4">Cashflow Analytics</h2>
          <app-cashflow-chart [accounts]="accounts" />
        </div>
      } @placeholder (minimum 300ms) {
        <div class="chart-placeholder h-64 bg-gray-100 animate-pulse rounded"></div>
      } @error {
        <div class="chart-error p-4 text-red-500">Failed to load analytics chart bundle.</div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransferDashboardComponent {
  private readonly transferService = inject(TransferService);

  readonly isLoading = signal<boolean>(false);
  readonly activeAccounts = this.transferService.accountsSignal;

  readonly totalPortfolioValue = computed(() => {
    return this.activeAccounts().reduce((sum, acc) => sum + acc.balance, 0);
  });
}
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Modern Standalone Paradigm (Angular 17-19+) | Legacy Enterprise Antipattern (Angular 2-15) | Migration & Upgrade Strategy |
|---|---|---|
| `bootstrapApplication(AppComponent, appConfig)` | `platformBrowserDynamic().bootstrapModule(AppModule)` | Run `ng g @angular/core:standalone` schematic to convert `AppModule` to `appConfig` |
| `standalone: true` (default in v19) | `standalone: false` with declarations in `SharedModule` | Migrate `SharedModule` into atomic standalone components/pipes |
| Built-in control flow (`@if`, `@for`, `@switch`) | Structural directives (`*ngIf`, `*ngFor="let item of list; trackBy: fn"`) | Run `ng g @angular/core:control-flow` to automatically rewrite all templates |
| Deferred views (`@defer (on viewport)`) | Complex manual dynamic component loading via `ViewContainerRef` + `ComponentFactoryResolver` | Replace manual dynamic imports with `@defer` blocks |
| `inject(Service)` functional injection | Constructor parameter injection (`constructor(private s: Service)`) | Constructor injection works, but `inject()` enables reusable composable functions |

---

## 7. PRACTICAL EXAMPLE: FEATURE-SLICED ENTERPRISE DIRECTORY STRUCTURE

In an enterprise full-stack system, files must be organized by **Domain Boundaries**, not technical file types:

```
src/app/
├── app.config.ts                 # Global providers (Router, HttpClient, ErrorHandler)
├── app.routes.ts                 # Top-level lazy route declarations
├── app.component.ts              # App shell root component
│
├── core/                         # Singleton infrastructure & cross-cutting concerns
│   ├── auth/                     # Auth services, tokens, interceptors
│   │   ├── auth.service.ts
│   │   ├── auth.interceptor.ts
│   │   └── auth.guard.ts
│   ├── interceptors/             # Request ID, global logging
│   └── models/                   # Core DTO envelopes (ApiResponse, Page)
│
├── shared/                       # Reusable UI primitives, pipes, directives
│   ├── ui/
│   │   ├── button/
│   │   └── modal/
│   ├── pipes/
│   └── directives/
│
└── features/                     # Business domain features (Lazy Loaded)
    ├── accounts/
    │   ├── accounts.routes.ts
    │   ├── components/
    │   └── services/
    └── transfers/
        ├── transfers.routes.ts   # Lazy route definitions
        ├── pages/                # Route view components
        ├── components/           # Domain sub-components
        ├── models/               # Domain TypeScript models
        └── services/             # Transfer API clients & state
```

---

## 8. COMMON MISTAKES

1. **Forgetting to Import Dependencies in Standalone Components**: Using `<a routerLink="/login">` or `{{ date | date:'short' }}` without importing `RouterLink` or `DatePipe` in the component's `imports: [...]` array.
2. **Missing `track` in Modern `@for` Blocks**: Unlike legacy `*ngFor` where `trackBy` was optional (defaulting to object identity), modern `@for (item of items; track item.id)` **mandates** a tracking key. Using `track $index` for dynamic lists causes DOM state corruption when items are filtered or sorted.
3. **Over-importing Monolithic Modules in Standalone Components**: Importing an entire legacy `SharedModule` inside a standalone component defeats the tree-shaking benefits of the standalone architecture.
4. **Mutating Inputs with Signals**: Expecting `input()` signals to be writable. Angular 17+ Signal Inputs are `InputSignal<T>` and are strictly **read-only**. Use `model()` if two-way binding is required.

---

## 9. LOCAL ISSUES
- **Symptom**: `NG0201: No provider for HttpClient!` at application startup.
- **Root Cause**: `provideHttpClient()` was omitted from `appConfig.providers` in `app.config.ts`.

---

## 10. CI/CD ISSUES
- **Symptom**: `NG8002: Can't bind to 'account' since it isn't a known property of 'app-account-card'`.
- **Root Cause**: `AccountCardComponent` was omitted from the `imports: [...]` array of `TransferDashboardComponent`. Local fast builds without strict checks may overlook this, but production AOT compilation in CI fails immediately.

---

## 11. PRODUCTION ISSUES
- **Symptom**: Clicking on a deferred `@defer` section in production throws `ChunkLoadError: Loading chunk failed`.
- **Root Cause**: A new version was deployed, deleting old hashed chunks from the server while a user still had an older `index.html` cached in their browser.

---

## 12. FULL-STACK INTERACTION: ROUTE GUARDS & SPRING SECURITY

Route guards in Angular do NOT secure data—they only secure the UI navigation flow:

```
[ User navigates to /transfers/admin ]
  |
  +---> Angular `adminGuard`: Checks local JWT claim `role === 'ADMIN'`
  |     - TRUE -> Renders AdminDashboardComponent
  |
  +---> Component dispatches `GET /api/v1/admin/transfers`
  |
  +---> Spring Boot Security Filter Chain:
        - Evaluates Bearer JWT on backend: `@PreAuthorize("hasRole('ADMIN')")`
        - If compromised user tampered with client state, Spring returns HTTP 403 Forbidden!
```

---

## 13. DEBUGGING PROCESS

1. **Inspect Angular Component Tree in DevTools**:
   - Open **Angular DevTools** -> Components tab.
   - Inspect the selected node's `inputs`, `outputs`, and `providedIn` injectors.
2. **Verify Change Detection Strategy**:
   - Confirm the component has `ChangeDetectionStrategy.OnPush` enabled.
3. **Trace `@defer` Lifecycle**:
   - In Chrome DevTools Network tab, set network throttling to "Slow 3G" and observe the separate lazy `.js` chunk requested when the deferred element scrolls into the viewport.

---

## 14. ROOT CAUSE ANALYSIS: Why Standalone Eliminates Module Scoping Bugs
In legacy Angular, an `NgModule` created an artificial compilation context. If two modules imported the same directive with conflicting selectors or declared the same component twice, Angular threw runtime errors (`NG0600: Type X is part of the declarations of 2 modules`). Standalone components eliminate this indirection: each component defines its own isolated **Compilation Scope** via its `imports` array.

---

## 15. FIX
- Convert all components to `standalone: true`.
- Use `appConfig` with functional providers (`provideRouter`, `provideHttpClient`).
- Adopt `@if`, `@for (track id)`, and `@defer` built-in blocks.

---

## 16. PREVENTION
- Enable ESLint rules:
  - `@angular-eslint/prefer-standalone`
  - `@angular-eslint/template/prefer-control-flow`
  - `@angular-eslint/template/no-negated-async`

---

## 17. MONITORING / OBSERVABILITY
- Capture failed `@defer` chunk loads by attaching an `@error` handler to every deferred block and routing telemetry to Sentry/Datadog.

---

## 18. PERFORMANCE CONSIDERATIONS
- `@defer` blocks defer the download and compilation of non-critical UI subtrees (such as charts, comment sections, and modals) until triggered by viewport entry, user interaction, or browser idle time, directly optimizing the **Largest Contentful Paint (LCP)** and **Total Blocking Time (TBT)**.

---

## 19. SECURITY CONSIDERATIONS
- Never rely on Angular template `@if (isAdmin())` to hide sensitive data. Data returned from Spring Boot in the HTTP response body is visible in the Network tab regardless of whether an `@if` block renders it to the DOM.

---

## 20. TESTING STRATEGY
- **Component TestBed Test**: Verify that standalone components can be tested in isolation by directly passing required mock components in `TestBed.configureTestingModule({ imports: [MyStandaloneComponent] })`.

---

## 21. EXERCISES & SOLUTIONS

### Exercise 1: Standalone Route Definition
**Question:** Write a type-safe `app.routes.ts` file demonstrating standalone lazy component loading, functional guards, and resolver bindings.
**Solution:**
```typescript
// frontend/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { accountResolver } from './features/accounts/resolvers/account.resolver';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/transfers/transfer-dashboard.component').then(
        (m) => m.TransferDashboardComponent
      ),
    canActivate: [authGuard]
  },
  {
    path: 'accounts/:id',
    loadComponent: () =>
      import('./features/accounts/account-detail.component').then(
        (m) => m.AccountDetailComponent
      ),
    canActivate: [authGuard],
    resolve: {
      accountData: accountResolver
    }
  },
  {
    path: '**',
    loadComponent: () =>
      import('./core/pages/not-found.component').then((m) => m.NotFoundComponent)
  }
];
```

---

### Exercise 2: Refactoring `*ngFor` to Modern `@for` with `@defer`
**Question:** Refactor a legacy `*ngFor` table with a heavy modal component into modern `@for` and `@defer (on interaction)` syntax.
**Solution:**
```html
<!-- Modern Standalone Template -->
<div class="transaction-table">
  @for (tx of transactions(); track tx.id) {
    <div class="row flex justify-between p-2 border-b">
      <span>{{ tx.reference }}</span>
      <span>{{ tx.amount }}</span>
      <button (click)="openDetails(tx.id)" #detailBtn class="btn">View Details</button>
      
      <!-- Modal chunk is only downloaded when the user interacts with the detail button -->
      @defer (on interaction(detailBtn)) {
        <app-transaction-modal [transactionId]="tx.id" (close)="closeDetails()" />
      } @placeholder {
        <!-- Zero bytes transferred until button click -->
      }
    </div>
  } @empty {
    <p class="text-gray-500">No transactions recorded.</p>
  }
</div>
```

---

## 22. BREAK-AND-FIX LAB: `ANG-STANDALONE-001`
- **Injected Bug**: In a standalone component, use `@for (user of users; track $index)` while implementing a filterable search bar.
- **Observation**: When a user filters the search input, temporary checkbox selections and input focus stay stuck on the wrong rows because `$index` tracking binds DOM elements by index rather than entity identity.
- **Diagnostic Action**: Inspect the DOM nodes in Elements panel while filtering: note that table rows are reused incorrectly without destroying/recreating matching elements.
- **Fix**: Change `track $index` to `track user.id`.

---

## 23. EXPERT QUESTIONS & ANSWERS (Principal / Staff Level)

### Question 1
*How does Angular's modern `@defer` block work under the hood with the esbuild/Vite compilation pipeline, and what triggers are available for deferred loading?*
> **Answer:**
> When the Angular compiler encounters a `@defer` block, it automatically splits the contents inside the `@defer` block into a **separate asynchronous JavaScript chunk** (dynamic `import()`), completely removing its bytes from the parent component's bundle.
> 
> **Available Triggers:**
> 1. `on idle`: Loads when the browser reaches an idle state (`requestIdleCallback`).
> 2. `on viewport(elementRef)`: Uses native `IntersectionObserver` to trigger loading when the element scrolls into view.
> 3. `on interaction(elementRef)`: Triggers on `click`, `focus`, or `keydown`.
> 4. `on hover(elementRef)`: Triggers on `mouseenter` or `focusin`.
> 5. `on timer(time)`: Triggers after a specific delay.
> 6. `when condition`: Triggers when an explicit boolean signal/expression becomes true.
> 7. `prefetch`: Allows prefetching the bundle ahead of time (e.g., `@defer (on interaction; prefetch on idle)`).

---

### Question 2
*What is the difference between an Environment Injector and an Element Injector in a Standalone Angular application, and how does service resolution travel through them?*
> **Answer:**
> - **Environment Injector**: Created at bootstrap (`ApplicationRef` / `bootstrapApplication`) and at each lazy-loaded route boundary (`provideRouter`, route `providers: [...]`). It holds application-wide singletons, interceptors, and environment configurations.
> - **Element Injector**: Created implicitly for every DOM element and Component/Directive instance that declares `providers: [...]` or `viewProviders: [...]`.
> 
> **Resolution Flow:**
> When a component requests a dependency via `inject(MyService)`:
> 1. Angular starts searching at the component's own **Element Injector**.
> 2. It walks UP the DOM Element Injector parent hierarchy.
> 3. If not found in the DOM hierarchy, it jumps to the route's **Environment Injector**.
> 4. Finally, it searches the **Root Environment Injector** (`providedIn: 'root'`) and Platform Injector.
> 5. If unresolved, it throws `NullInjectorError: No provider for MyService!`.

---

### Question 3
*Why is `provideZoneChangeDetection({ eventCoalescing: true })` recommended for high-frequency event applications, and what internal optimization does it perform?*
> **Answer:**
> In standard Zone.js execution, every individual DOM event (e.g., multiple bubbling events or rapid `mousemove` / `input` events) triggers a distinct change detection tick (`ApplicationRef.tick()`).
> 
> When `eventCoalescing: true` is enabled, Zone.js schedules only **one single Change Detection tick** for multiple microtasks or events occurring within the same browser turn, coalescing them together. This drastically cuts redundant change detection sweeps, preventing UI thrashing and boosting CPU efficiency.
