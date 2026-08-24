# Module 04: Angular Internals — How Angular Actually Works

---

## 1. WHAT
Angular Internals is the study of Angular's **Ivy runtime engine**—the concrete data structures (`LView`, `TView`, `TNode`), algorithms (change detection traversal, dirty-marking, DOM reconciliation), and compilation pipeline (AOT template compilation → template functions → runtime instructions) that transform your declarative component templates into efficient, incremental DOM mutations inside the browser.

---

## 2. WHY
- **Debugging Beyond the Surface**: When `ExpressionChangedAfterItHasBeenCheckedError` appears, you cannot diagnose it without understanding how Angular traverses the view tree twice in dev mode.
- **Performance Engineering**: You cannot optimize change detection without knowing *what* Angular checks, *when* it checks, and *how* `OnPush` and Signals short-circuit the traversal.
- **Architecture Decisions**: Choosing between Zone.js-based change detection, `OnPush` + Signals, or fully Zoneless Angular requires understanding the runtime scheduler and dirty-marking propagation.
- **Production Incident Diagnosis**: Memory leaks from detached views, hydration mismatches from server/client DOM divergence, and "UI not updating" bugs all trace back to internal view lifecycle events.
- **Interview & Staff-Level Mastery**: Principal engineers are expected to explain *how* the framework works, not just *how to use* it.

---

## 3. INTERNAL MENTAL MODEL

### The Ivy Runtime Architecture

```
+===========================================================================================+
|                          ANGULAR IVY RUNTIME ENGINE                                        |
|                                                                                            |
|  ┌─────────────────────────────────────────────────────────────────────────────────────┐   |
|  │                        APPLICATION BOOTSTRAP                                        │   |
|  │  main.ts → bootstrapApplication(AppComponent, appConfig)                           │   |
|  │         │                                                                           │   |
|  │         ├── 1. Create PlatformRef (singleton per browser tab)                      │   |
|  │         ├── 2. Create Root EnvironmentInjector (providers from appConfig)           │   |
|  │         ├── 3. Create ApplicationRef (the application instance)                    │   |
|  │         ├── 4. Zone.js: Create NgZone (or skip if provideExperimentalZonelessCD)   │   |
|  │         ├── 5. Locate <app-root> in index.html DOM                                 │   |
|  │         ├── 6. Instantiate AppComponent via Ivy component factory                  │   |
|  │         ├── 7. Create Root LView (the live view data array)                        │   |
|  │         ├── 8. Execute AppComponent's template function (ɵɵtemplate instructions)  │   |
|  │         ├── 9. Mount DOM nodes into <app-root>                                     │   |
|  │         └── 10. Queue first change detection tick via microtask                    │   |
|  └─────────────────────────────────────────────────────────────────────────────────────┘   |
|                                                                                            |
|  ┌─────────────────────────────────────────────────────────────────────────────────────┐   |
|  │                            VIEW TREE (Runtime)                                      │   |
|  │                                                                                     │   |
|  │   ApplicationRef                                                                    │   |
|  │       │                                                                             │   |
|  │       └── RootLView (AppComponent)                                                  │   |
|  │               │                                                                     │   |
|  │               ├── ChildLView (HeaderComponent)                                      │   |
|  │               │       └── ChildLView (NavMenuComponent)                             │   |
|  │               │                                                                     │   |
|  │               ├── ChildLView (RouterOutlet → DashboardComponent) ← lazy loaded      │   |
|  │               │       ├── ChildLView (AccountTableComponent)                        │   |
|  │               │       └── ChildLView (ChartComponent) ← @defer                     │   |
|  │               │                                                                     │   |
|  │               └── ChildLView (FooterComponent)                                      │   |
|  │                                                                                     │   |
|  │   Each LView is a flat array:                                                       │   |
|  │   [ TView, Flags, ParentLView, DOM_Element, Binding0, Binding1, ..., ChildLView ]  │   |
|  └─────────────────────────────────────────────────────────────────────────────────────┘   |
|                                                                                            |
|  ┌─────────────────────────────────────────────────────────────────────────────────────┐   |
|  │                     CHANGE DETECTION TRAVERSAL                                      │   |
|  │                                                                                     │   |
|  │   Trigger: Zone.js onMicrotaskEmpty / Signal markDirty / manual detectChanges()    │   |
|  │                                                                                     │   |
|  │   ApplicationRef.tick()                                                             │   |
|  │       │                                                                             │   |
|  │       └── refreshView(rootLView)  ← TOP-DOWN depth-first traversal                │   |
|  │               │                                                                     │   |
|  │               ├── Execute template function (creation or update mode)              │   |
|  │               ├── Compare binding slots: oldValue !== newValue?                    │   |
|  │               │       YES → Update DOM via renderer (textContent, attribute, etc.) │   |
|  │               │       NO  → Skip (no DOM mutation)                                 │   |
|  │               │                                                                     │   |
|  │               ├── Check child views:                                                │   |
|  │               │   Default CD  → ALWAYS check children                              │   |
|  │               │   OnPush      → ONLY check if view is marked dirty                 │   |
|  │               │   Signal      → ONLY check if signal dependency changed            │   |
|  │               │                                                                     │   |
|  │               └── Dev Mode ONLY: Run SECOND pass to detect                         │   |
|  │                   ExpressionChangedAfterItHasBeenCheckedError                       │   |
|  └─────────────────────────────────────────────────────────────────────────────────────┘   |
+===========================================================================================+
```

### Key Data Structures

```
TView (Template View — STATIC, shared across instances)
├── Template function reference (the compiled component template)
├── Content queries, view queries
├── Directive defs array
├── Binding index layout (which slot stores which expression)
└── Static DOM shape (element tags, attribute names)

LView (Logical View — INSTANCE-specific, one per component instance)
├── [0]  TView reference (shared template blueprint)
├── [1]  Flags (CreationMode | CheckAlways | Dirty | Attached | Destroyed)
├── [2]  Parent LView reference
├── [3]  Host native DOM element
├── [4…N]  Binding values (current expression results)
├── [N+1…]  Child component LViews
└── [CONTEXT] Component class instance (your @Component class)

TNode (Template Node — STATIC, one per template element/directive)
├── Type: Element | Text | Container | Projection | ICU
├── Tag name, attribute names
├── Directive indices (which directives apply to this DOM node)
├── Injection token tree (for Element Injector resolution)
└── Input/Output property mapping
```

---

## 4. HOW IT WORKS: STEP-BY-STEP EXECUTION

### Phase A: AOT Compilation (Build Time)

1. **Template Parsing**: The Angular compiler (`ngc` / `ngtsc`) reads `@Component({ template: ... })` and parses the HTML template into an AST (Abstract Syntax Tree).
2. **Type-Check Block (TCB) Generation**: For each template, the compiler generates a synthetic TypeScript function (the "Type-Check Block") that mirrors the template expressions, allowing the TypeScript compiler (`tsc`) to type-check template bindings against component properties.
3. **Template Function Generation**: The AST is lowered into an **Ivy template function** — a JavaScript function containing runtime instructions:
   ```
   // Conceptual output of AOT compilation for a simple template
   // Template: <h1>{{ title() }}</h1>
   function AppComponent_Template(rf, ctx) {
     if (rf & RenderFlags.Create) {
       ɵɵelementStart(0, 'h1');   // Create <h1> element
       ɵɵtext(1);                  // Create text node placeholder
       ɵɵelementEnd();             // Close </h1>
     }
     if (rf & RenderFlags.Update) {
       ɵɵadvance(1);               // Move cursor to text node
       ɵɵtextInterpolate(ctx.title()); // Compare & update text
     }
   }
   ```
4. **Component Def Generation**: Each component gets a static `ɵcmp` definition containing the template function, change detection strategy, host bindings, and content/view query metadata.

### Phase B: Runtime Bootstrap

1. `bootstrapApplication()` creates the `PlatformRef` → `ApplicationRef` → Root `EnvironmentInjector`.
2. Angular finds `<app-root>` in the DOM.
3. The Ivy runtime allocates a new `LView` array for `AppComponent`, calling the template function in **Create mode** (`RenderFlags.Create`) to build the initial DOM tree.
4. The root `LView` is attached to `ApplicationRef._views`.
5. A microtask is scheduled to trigger the first `ApplicationRef.tick()`.

### Phase C: Change Detection Cycle

1. **Trigger**: Zone.js captures an async event (click, HTTP response, setTimeout) and emits `onMicrotaskEmpty`.
2. `ApplicationRef.tick()` is called.
3. For each attached root view, `refreshView()` is invoked.
4. `refreshView()` executes the template function in **Update mode** (`RenderFlags.Update`).
5. Each `ɵɵtextInterpolate()`, `ɵɵproperty()`, `ɵɵattribute()` instruction compares the new value against the stored binding in the `LView` array.
6. If changed: the DOM is updated via the `Renderer2` abstraction. The old value is replaced in the `LView` slot.
7. If unchanged: no DOM operation occurs.
8. Child views are checked recursively (depth-first).
9. **OnPush optimization**: If a child view's `ChangeDetectionStrategy` is `OnPush` and it is NOT marked dirty, the entire subtree is **skipped**.
10. **Dev mode second pass**: In development, Angular runs the entire traversal again. If any binding produces a different value on the second pass, `ExpressionChangedAfterItHasBeenCheckedError` is thrown—indicating the component mutated state during change detection.

### Phase D: View Lifecycle Hooks (Execution Order)

```
For a Parent → Child component hierarchy, hooks fire in this order:

CREATION (first render):
  Parent  ngOnChanges()     (if inputs bound)
  Parent  ngOnInit()
  Parent  ngDoCheck()
  Parent  ngAfterContentInit()
  Parent  ngAfterContentChecked()
    Child   ngOnChanges()
    Child   ngOnInit()
    Child   ngDoCheck()
    Child   ngAfterContentInit()
    Child   ngAfterContentChecked()
    Child   ngAfterViewInit()
    Child   ngAfterViewChecked()
  Parent  ngAfterViewInit()
  Parent  ngAfterViewChecked()

SUBSEQUENT CHANGE DETECTION:
  Parent  ngDoCheck()
  Parent  ngAfterContentChecked()
    Child   ngOnChanges()   (if inputs changed)
    Child   ngDoCheck()
    Child   ngAfterContentChecked()
    Child   ngAfterViewChecked()
  Parent  ngAfterViewChecked()
```

---

## 5. MODERN IMPLEMENTATION

### A. Zoneless Angular (Experimental in Angular 19+)

```typescript
// app.config.ts — Zoneless change detection (Angular 19+)
import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // NO Zone.js — Angular relies on Signals for dirty-marking
    provideExperimentalZonelessChangeDetection(),

    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([]))
  ]
};
```

```typescript
// angular.json — Remove zone.js from polyfills for Zoneless
{
  "projects": {
    "enterprise-app": {
      "architect": {
        "build": {
          "options": {
            // Remove "zone.js" from polyfills array
            "polyfills": []
          }
        }
      }
    }
  }
}
```

### B. Signal-Driven Component (Optimal for Zoneless)

```typescript
// features/accounts/account-detail.component.ts
import {
  Component, ChangeDetectionStrategy, inject, input, computed, effect,
  signal, OnInit, DestroyRef
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AccountService } from './services/account.service';

@Component({
  selector: 'app-account-detail',
  standalone: true,
  template: `
    @let account = accountData();

    @if (account) {
      <div class="account-card p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold">{{ account.holderName }}</h2>
        <p class="text-3xl font-bold mt-2">{{ formattedBalance() }}</p>
        <span class="badge" [class]="statusClass()">
          {{ account.status }}
        </span>
      </div>
    } @else {
      <div class="skeleton-loader animate-pulse h-32 rounded-lg"></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountDetailComponent {
  private readonly accountService = inject(AccountService);

  // Signal Input — read-only, set by parent or router binding
  readonly accountId = input.required<string>();

  // Derive data reactively from the signal input
  readonly accountData = computed(() => {
    const id = this.accountId();
    return this.accountService.getAccountById(id);
  });

  readonly formattedBalance = computed(() => {
    const account = this.accountData();
    if (!account) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account.currency
    }).format(account.balance);
  });

  readonly statusClass = computed(() => {
    const status = this.accountData()?.status;
    return status === 'ACTIVE' ? 'badge-success' : 'badge-warning';
  });
}
```

### C. How Signals Integrate with Change Detection

```
ZONE.JS MODEL (Traditional):
  DOM Event → Zone.js intercepts → onMicrotaskEmpty → ApplicationRef.tick()
                                                       → Check ALL Default views
                                                       → Skip clean OnPush views

SIGNAL MODEL (Modern / Zoneless):
  Signal.set(newValue)
    → Mark component's LView as DIRTY
    → Mark all ancestor LViews as HAS_CHILD_VIEWS_TO_REFRESH
    → Schedule a single CD tick via requestAnimationFrame / microtask
    → ApplicationRef.tick()
      → Walk tree, but ONLY enter branches marked dirty
      → Refresh dirty LView, re-execute template function
      → Clear dirty flags

KEY INSIGHT: Signals provide FINE-GRAINED dirty-marking.
Zone.js provides COARSE-GRAINED "something happened" notification.
Signals tell Angular EXACTLY which view needs checking.
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Modern (Angular 17-19+) | Legacy (Angular 2-16) | Migration Path |
|---|---|---|
| `provideExperimentalZonelessChangeDetection()` | Zone.js always included in polyfills | Requires all state to use Signals; migrate incrementally |
| Signal inputs: `input<T>()`, `input.required<T>()` | `@Input() prop: T` decorator | Use `ng generate @angular/core:signal-input-migration` |
| Signal queries: `viewChild()`, `contentChildren()` | `@ViewChild()`, `@ContentChildren()` decorators | Use `ng generate @angular/core:signal-queries-migration` |
| `output()` function | `@Output() event = new EventEmitter<T>()` | Both work; `output()` is more composable |
| Functional lifecycle via `afterNextRender()`, `afterRender()` | `ngAfterViewInit`, `ngAfterViewChecked` | `afterNextRender` runs once after SSR-safe render |
| `ChangeDetectionStrategy.OnPush` + Signals | `ChangeDetectionStrategy.Default` everywhere | Enable OnPush per-component; profile before and after |

### Legacy Change Detection Debugging Pattern

```typescript
// LEGACY: Forcing change detection in NgModule-era code
// This was common but is an antipattern — it hides the real bug
@Component({ ... })
export class LegacyDashboardComponent {
  constructor(private cdr: ChangeDetectorRef) {}

  onWebSocketMessage(data: any) {
    this.items = data;
    this.cdr.detectChanges(); // Force CD — hides missing OnPush markDirty
  }
}
```

```typescript
// MODERN: Signal-driven state automatically marks views dirty
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  ...
})
export class ModernDashboardComponent {
  private readonly ws = inject(WebSocketService);
  readonly items = toSignal(this.ws.messages$, { initialValue: [] });
  // No manual CD needed — toSignal() marks the view dirty on emission
}
```

---

## 7. PRACTICAL EXAMPLE: TRACING A CLICK THROUGH THE IVY ENGINE

**Scenario**: User clicks "Approve Transfer" in the enterprise banking app.

```
1. USER CLICKS <button (click)="approveTransfer()">

2. ZONE.JS INTERCEPTS
   - Zone.js has monkey-patched addEventListener
   - The click handler runs inside NgZone
   - Zone.js increments the pending microtask count

3. COMPONENT METHOD EXECUTES
   approveTransfer() {
     this.isProcessing.set(true);           // Signal.set() → marks LView dirty
     this.transferService.approve(this.transferId())
       .subscribe({
         next: (result) => {
           this.status.set('APPROVED');      // Signal.set() → marks LView dirty
           this.isProcessing.set(false);     // Signal.set() → marks LView dirty
         },
         error: (err) => {
           this.errorMessage.set(err.message);
           this.isProcessing.set(false);
         }
       });
   }

4. ZONE.JS DETECTS MICROTASK EMPTY
   - The synchronous click handler completed
   - No more pending microtasks in this turn
   - Zone.js emits onMicrotaskEmpty

5. ApplicationRef.tick() IS CALLED
   - Angular traverses the view tree top-down
   - Reaches TransferDetailComponent's LView

6. refreshView(transferDetailLView) EXECUTES
   - Runs template function in Update mode
   - ɵɵproperty('disabled', ctx.isProcessing())
     → isProcessing() returns true (changed from false)
     → LView binding slot updated: false → true
     → Renderer: button.disabled = true
   - ɵɵtextInterpolate(ctx.status())
     → status() still 'PENDING' (HTTP not returned yet)
     → No change → No DOM update

7. HTTP RESPONSE ARRIVES (later)
   - Zone.js intercepts XMLHttpRequest completion
   - subscribe callback fires: this.status.set('APPROVED')
   - Zone.js emits onMicrotaskEmpty again

8. ApplicationRef.tick() IS CALLED AGAIN
   - refreshView() re-runs template function
   - ɵɵtextInterpolate(ctx.status())
     → status() returns 'APPROVED' (changed from 'PENDING')
     → DOM text node updated to "APPROVED"
   - ɵɵclassProp('text-green-600', ctx.status() === 'APPROVED')
     → Condition now true → class added to DOM element
```

---

## 8. COMMON MISTAKES

1. **Modifying State in `ngAfterViewInit` or `ngAfterViewChecked`**: These hooks fire AFTER the view is checked. Modifying a bound property here triggers `ExpressionChangedAfterItHasBeenCheckedError` in dev mode and causes a second unnecessary CD cycle in production.

2. **Using `ChangeDetectorRef.detectChanges()` as a Fix Instead of Diagnosing the Root Cause**: Calling `detectChanges()` manually is almost always masking a deeper issue — usually that state is being mutated outside Angular's awareness (e.g., in a raw `setTimeout` without Zone.js, or a third-party library callback).

3. **Assuming OnPush Means "No Change Detection"**: `OnPush` does NOT skip change detection — it skips checking the view **only if it is not marked dirty**. Dirty-marking happens via: Signal changes, `@Input()` reference changes, DOM events within the template, `async` pipe emissions, or manual `markForCheck()`.

4. **Creating Memory Leaks by Not Detaching Dynamic Views**: When using `ViewContainerRef.createComponent()` or `createEmbeddedView()`, failing to call `destroy()` on the `ViewRef` leaves the LView attached to the view tree, preventing garbage collection.

5. **Expecting `ngOnInit` to Run on the Server AND Client in SSR**: In Angular SSR with hydration, `ngOnInit` runs on the server during SSR, and then runs AGAIN on the client during hydration bootstrap. If `ngOnInit` fires an HTTP request, you get duplicate API calls unless `TransferState` or `TransferCache` is used.

---

## 9. LOCAL ISSUES

- **Symptom**: `ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value: 'false'. Current value: 'true'.`
- **Root Cause**: A computed property or getter returns a different value on the second dev-mode verification pass. Common causes:
  - A getter that creates a new object/array reference on every call: `get items() { return this.data.filter(...); }` — each call returns a new array reference.
  - Setting state in `ngAfterViewInit()`.
- **Evidence Collection**: 
  - The error message includes the previous and current values.
  - Set a breakpoint in the getter/property and observe it being called twice per tick.
- **Fix**: Use `computed()` signals (memoized) or store the filtered result in a signal/variable instead of recomputing in a getter.

---

## 10. CI/CD ISSUES

- **Symptom**: `ERROR in NG1010: 'forwardRef' is not a known element` or `NG2009: Detected a cycle in the template compilation`.
- **Root Cause**: Circular component dependencies where Component A imports Component B and Component B imports Component A. AOT compilation in CI (with `--configuration=production` enabling full template type-checking) catches cycles that JIT or dev-mode lazy compilation may not surface.
- **Fix**: Break the cycle by extracting the shared template into a third standalone component, or use `@defer` to lazily load one of the components.

- **Symptom**: `NG8001: 'app-account-card' is not a known element` only in CI but not locally.
- **Root Cause**: Developer's IDE auto-imports added the component to the TypeScript file imports but forgot to add it to the `@Component({ imports: [...] })` array. Local `ng serve` with partial compilation may not catch this; production AOT in CI will.

---

## 11. PRODUCTION ISSUES

- **Symptom**: Users report UI freezing for 2-5 seconds on a data-heavy dashboard page. The page has 500+ rows rendered without virtual scrolling.
- **Root Cause**: Default change detection strategy on the parent component causes Angular to re-check ALL 500 child component `LView`s on every single user interaction (scroll, hover, click anywhere on the page). Each child has multiple binding slots. 500 × 8 bindings = 4000 comparisons per tick.
- **Production Evidence**: Chrome DevTools Performance tab shows repeated long `refreshView` calls in the flame chart during scroll events.
- **Why It Doesn't Surface Locally**: Developer machines have fast CPUs; production users may have low-end devices. Data sets are also typically smaller in development.

- **Symptom**: Memory grows continuously; users who keep the app open for hours report sluggishness and eventual tab crash.
- **Root Cause**: A router outlet creates component instances when navigating TO a route. If a component creates dynamic views via `ViewContainerRef` (e.g., dynamically added form fields or modals) and does not destroy them when navigating AWAY, the `LView` arrays are never detached, and the associated DOM nodes and component instances are never garbage collected.

---

## 12. FULL-STACK INTERACTION

### How Change Detection Connects to Spring Boot HTTP Responses

```
Angular HttpClient.get('/api/v1/accounts')
  │
  ├── HttpClient creates an Observable (cold)
  ├── .subscribe() triggers XHR via fetch/XMLHttpRequest
  │     Zone.js patches the XHR → enters NgZone
  │
  ├── Request travels: Browser → Nginx → Spring Security → Controller → DB
  │
  ├── Spring Boot returns JSON: { "accounts": [...], "totalCount": 150 }
  │
  ├── Browser receives response
  │     Zone.js intercepts XHR completion callback
  │     Observable.next(response) fires inside NgZone
  │
  ├── Component's subscribe callback runs:
  │     this.accounts.set(response.accounts);  // Signal.set()
  │     this.totalCount.set(response.totalCount);
  │
  ├── Signal.set() marks the component's LView as DIRTY
  │
  ├── Zone.js emits onMicrotaskEmpty (after microtask queue drains)
  │
  └── ApplicationRef.tick() → refreshView() → DOM updated
```

**Critical Contract Point**: If Spring Boot changes the response shape (e.g., renames `totalCount` to `total`), Angular's TypeScript interface won't enforce this at runtime. The signal will be set to `undefined`, and the template will render nothing or "NaN" — a **silent contract failure** that only surfaces in production.

---

## 13. DEBUGGING PROCESS

### Scenario: "UI Not Updating After HTTP Response"

**Step 1: Verify the HTTP response arrived**
- Open Chrome DevTools → Network tab
- Confirm the response status is 200 and the body contains expected data
- If no request appears: the Observable was never subscribed to (cold Observable issue)

**Step 2: Check if code runs inside NgZone**
```typescript
// Temporary debug: Is this running inside Angular's zone?
console.log('In Angular Zone?', NgZone.isInAngularZone());
```
- If `false`: the callback is running outside NgZone. Common when using third-party libraries, raw `WebSocket`, or `setTimeout` without Zone.js patching.

**Step 3: Inspect Change Detection Strategy**
- Open Angular DevTools → Components tab
- Select the component → check `ChangeDetectionStrategy`
- If `OnPush`: verify the view is being marked dirty
  - Is the data assigned to a Signal? (auto dirty-marking ✓)
  - Is it assigned to a plain property? (`OnPush` won't detect it without `markForCheck()`)

**Step 4: Profile Change Detection Runs**
- Angular DevTools → Profiler tab → Start recording
- Trigger the action → Stop recording
- Inspect which components were checked and which were skipped
- Look for the component in question — if it shows as "skipped", it's an OnPush dirty-marking issue

**Step 5: Check for `ExpressionChangedAfterItHasBeenChecked` in Console**
- If present: state is being mutated during the CD cycle itself
- Trace the call stack in the error to find the mutation source

---

## 14. ROOT CAUSE ANALYSIS

### Why `ExpressionChangedAfterItHasBeenCheckedError` Exists

Angular's change detection is designed as a **single-pass, unidirectional data flow** algorithm. Data flows from parent to child. The template function runs once, and the resulting DOM state must be stable.

In development mode, Angular runs a **verification pass** immediately after the first pass. If any binding value changes between pass 1 and pass 2, it proves that:
- State was mutated DURING the CD cycle (violating unidirectional flow), OR
- A binding expression is non-deterministic (returns different values on each call)

This error is intentionally suppressed in production for performance, but the **underlying bug still exists** — it just manifests as subtle UI inconsistencies instead of an error.

### Why OnPush Components Sometimes Don't Update

```
The developer assigns new data to a plain object property:

  this.userData = { name: 'Alice', role: 'ADMIN' };  // Step 1: works fine

Later, the developer MUTATES the same reference:

  this.userData.role = 'SUPERADMIN';  // Step 2: FAILS with OnPush

WHY:
  OnPush checks if @Input() reference changed: oldRef === newRef?
  Object.is(this.userData, this.userData) → true → "No change"
  Angular SKIPS the view.

FIX:
  Use immutable updates: this.userData = { ...this.userData, role: 'SUPERADMIN' };
  OR use Signals:        this.userData.update(u => ({ ...u, role: 'SUPERADMIN' }));
```

---

## 15. FIX

### Fix 1: ExpressionChangedAfterItHasBeenCheckedError from Getter
```typescript
// ❌ BROKEN: Getter creates new reference every call
get filteredItems() {
  return this.items.filter(i => i.active);
}

// ✅ FIXED: Use computed signal (memoized, only recalculates when dependencies change)
readonly filteredItems = computed(() =>
  this.items().filter(i => i.active)
);
```

### Fix 2: UI Not Updating with OnPush
```typescript
// ❌ BROKEN: Mutating object in-place with OnPush
this.account.balance = newBalance;

// ✅ FIXED: Signal with immutable update
this.account.update(acc => ({ ...acc, balance: newBalance }));
```

### Fix 3: Code Running Outside NgZone
```typescript
// ❌ BROKEN: Third-party library callback runs outside Zone
thirdPartyMap.on('click', (coords) => {
  this.selectedLocation = coords; // Zone doesn't see this
});

// ✅ FIXED: Re-enter NgZone explicitly
private readonly ngZone = inject(NgZone);

thirdPartyMap.on('click', (coords) => {
  this.ngZone.run(() => {
    this.selectedLocation.set(coords); // Signal + NgZone = CD triggered
  });
});
```

---

## 16. PREVENTION

1. **Enable Strict Template Type-Checking**:
   ```json
   // tsconfig.json
   {
     "angularCompilerOptions": {
       "strictTemplates": true,
       "strictInjectionParameters": true
     }
   }
   ```
   This catches template binding type mismatches at compile time.

2. **Default to `OnPush` Change Detection**: Create new components with `ChangeDetectionStrategy.OnPush` and use Signals for all mutable state. This prevents accidental performance regressions from Default CD on large component trees.

3. **Lint Against Manual `detectChanges()`**:
   ```typescript
   // Custom ESLint rule: warn on ChangeDetectorRef.detectChanges() usage
   // This forces developers to find the root cause instead of band-aiding
   ```

4. **Use `computed()` Instead of Getters for Derived State**: Computed signals are memoized and only recalculate when their signal dependencies change. Getters run on every CD cycle.

5. **Use `DestroyRef` or `takeUntilDestroyed()` for All Subscriptions**:
   ```typescript
   private readonly destroyRef = inject(DestroyRef);

   ngOnInit() {
     this.data$.pipe(
       takeUntilDestroyed(this.destroyRef)
     ).subscribe(data => this.items.set(data));
   }
   ```

---

## 17. MONITORING / OBSERVABILITY

### Change Detection Performance Monitoring

```typescript
// Custom performance observer for change detection cycles
// Add to app.config.ts providers in development
import { APP_INITIALIZER, ApplicationRef, inject } from '@angular/core';

export function cdPerformanceMonitor(): () => void {
  return () => {
    const appRef = inject(ApplicationRef);
    let tickCount = 0;

    const originalTick = appRef.tick.bind(appRef);
    appRef.tick = () => {
      tickCount++;
      const start = performance.now();
      originalTick();
      const duration = performance.now() - start;

      if (duration > 16) { // Longer than one frame (60fps)
        console.warn(
          `[CD Monitor] Tick #${tickCount} took ${duration.toFixed(1)}ms — ` +
          `exceeds 16ms frame budget. Profile with Angular DevTools.`
        );
      }
    };
  };
}
```

### Production Metrics to Track

| Metric | Tool | Alert Threshold |
|---|---|---|
| Long Task Duration (>50ms) | `PerformanceObserver('longtask')` | Alert if >3 long tasks per page load |
| INP (Interaction to Next Paint) | `web-vitals` library | Alert if P75 > 200ms |
| Memory Growth Rate | `performance.memory` (Chrome) | Alert if `usedJSHeapSize` grows >10MB/min |
| Component Render Count | Angular DevTools Profiler | Profile if any component renders >50 times in 10s |

---

## 18. PERFORMANCE CONSIDERATIONS

### Change Detection Cost Analysis

```
Component Count    CD Strategy    Bindings/Component    Comparisons/Tick
──────────────────────────────────────────────────────────────────────────
50 components      Default        10 bindings           500 comparisons
500 components     Default        10 bindings           5,000 comparisons  ← noticeable lag
50 components      OnPush         10 bindings           50–500 (only dirty)
500 components     OnPush+Signal  10 bindings           10–100 (only changed signal paths)
```

### When to Use What

| Strategy | Use When | Avoid When |
|---|---|---|
| Default CD | Prototyping, small apps, learning | Lists >100 items, high-frequency updates |
| OnPush | Most production components | You can't guarantee immutable inputs |
| OnPush + Signals | New production code, performance-critical paths | Legacy codebase not yet migrated |
| Zoneless | New apps willing to use Signals exclusively | Apps with many Zone-dependent libraries |

### `@defer` Impact on Initial Bundle

```
WITHOUT @defer:
  main.js  →  450 KB (includes ChartComponent, PdfViewer, RichTextEditor)

WITH @defer:
  main.js  →  180 KB
  chunk-chart.js      →  120 KB (loaded on viewport)
  chunk-pdf.js        →  100 KB (loaded on interaction)
  chunk-editor.js     →   50 KB (loaded on idle)

  LCP improves by ~40% because initial JavaScript parsing is reduced.
```

---

## 19. SECURITY CONSIDERATIONS

1. **Template Injection**: Angular's AOT compilation prevents runtime template injection by default. However, using `innerHTML` binding (`[innerHTML]="userContent"`) passes through Angular's `DomSanitizer`. If you bypass sanitization with `bypassSecurityTrustHtml()`, you open XSS attack vectors. **Never bypass sanitization on user-supplied content.**

2. **Component State in Memory**: Component class instances stored in `LView[CONTEXT]` remain in JavaScript heap memory. Sensitive data (tokens, PII) stored in component properties persists until the LView is destroyed. Navigating away from a route destroys the component, but memory forensic tools can still access unreferenced heap data before GC runs.

3. **Angular DevTools in Production**: Angular DevTools can inspect component state, inputs, and injected services in any Angular application running in development mode. Production builds with `--configuration=production` disable the DevTools hook (`ng.getComponent()` / `ng.applyChanges()` are stripped). Ensure production builds are truly production-configured.

---

## 20. TESTING STRATEGY

### Unit Testing Change Detection Behavior

```typescript
// Test: Verify OnPush component updates when Signal changes
describe('AccountDetailComponent (OnPush + Signal)', () => {
  let fixture: ComponentFixture<AccountDetailComponent>;
  let component: AccountDetailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountDetailComponent],
      providers: [
        {
          provide: AccountService,
          useValue: {
            getAccountById: jasmine.createSpy().and.returnValue({
              id: '1', holderName: 'Alice', balance: 5000, currency: 'USD', status: 'ACTIVE'
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountDetailComponent);
    component = fixture.componentInstance;

    // Set required signal input via ComponentFixture
    fixture.componentRef.setInput('accountId', '1');
    fixture.detectChanges();
  });

  it('should render account holder name', () => {
    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toContain('Alice');
  });

  it('should update DOM when signal input changes', () => {
    // Simulate router param change
    fixture.componentRef.setInput('accountId', '2');
    fixture.detectChanges();

    // Verify the computed signal recomputed and the view refreshed
    expect(component.accountId()).toBe('2');
  });
});
```

### Integration Testing: Verifying CD Does Not Over-fire

```typescript
it('should not re-render child components when unrelated parent state changes', () => {
  const childSpy = spyOn(childComponent, 'ngDoCheck');

  // Trigger a state change that is NOT an input to the child
  parentComponent.unrelatedCounter.set(42);
  fixture.detectChanges();

  // With OnPush, child's ngDoCheck should NOT have been called
  // because none of the child's inputs or signals changed
  expect(childSpy).not.toHaveBeenCalled();
});
```

---

## 21. EXERCISES & SOLUTIONS

### Exercise 1: Trace the LView Binding Update

**Question**: Given this component template:
```html
<p>Hello, {{ userName() }}! You have {{ notifications().length }} notifications.</p>
<button [disabled]="isLoading()">Refresh</button>
```

Describe the exact `LView` slot layout and what happens during a change detection tick when `userName` signal changes from `'Alice'` to `'Bob'` but `notifications` and `isLoading` remain the same.

**Solution**:
```
LView Layout (simplified):
  [0] TView reference
  [1] Flags (DIRTY after Signal.set)
  [2] Parent LView
  [3] Host <app-user-panel> element
  [4] Binding: userName interpolation → stored value: 'Alice'
  [5] Binding: notifications().length → stored value: 3
  [6] Binding: isLoading() → stored value: false

Change Detection Tick:
  1. Template function runs in Update mode
  2. ɵɵtextInterpolate2('Hello, ', ctx.userName(), '! You have ', ...)
     → ctx.userName() returns 'Bob'
     → Compare LView[4] ('Alice') !== 'Bob' → CHANGED
     → Update DOM text node: "Hello, Bob! You have 3 notifications."
     → Store 'Bob' in LView[4]
  3. ɵɵtextInterpolate continues with notifications().length
     → ctx.notifications().length returns 3
     → Compare LView[5] (3) === 3 → UNCHANGED → No DOM operation
  4. ɵɵproperty('disabled', ctx.isLoading())
     → ctx.isLoading() returns false
     → Compare LView[6] (false) === false → UNCHANGED → No DOM operation
  5. Total DOM mutations: 1 (only the text node)
```

---

### Exercise 2: Diagnose the OnPush Bug

**Question**: This component uses `OnPush` but the UI never updates after the HTTP response. Explain why and provide the fix.

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Users: {{ users.length }}</p>`
})
export class UserListComponent implements OnInit {
  users: User[] = [];

  private readonly http = inject(HttpClient);

  ngOnInit() {
    this.http.get<User[]>('/api/v1/users').subscribe(data => {
      this.users = data;
    });
  }
}
```

**Solution**:
```
ROOT CAUSE:
  With OnPush, Angular only checks this view if it is marked dirty.
  Dirty-marking happens when:
    a) A Signal dependency changes (not used here)
    b) An @Input() reference changes (no parent input here)
    c) A DOM event fires FROM this component's template
    d) The async pipe emits (not used here)
    e) markForCheck() is called manually (not called here)

  The HTTP subscribe callback mutates `this.users` (a plain array property).
  OnPush does NOT detect plain property mutations.
  The view is never marked dirty → template never re-evaluated.

FIX (Signal approach — recommended):
  readonly users = signal<User[]>([]);

  ngOnInit() {
    this.http.get<User[]>('/api/v1/users').subscribe(data => {
      this.users.set(data);  // Signal.set() marks LView dirty automatically
    });
  }

  Template: <p>Users: {{ users().length }}</p>

FIX (toSignal approach — most concise):
  private readonly http = inject(HttpClient);
  readonly users = toSignal(
    this.http.get<User[]>('/api/v1/users'),
    { initialValue: [] }
  );

  Template: <p>Users: {{ users().length }}</p>
```

---

## 22. BREAK-AND-FIX LAB: `ANG-INTERNALS-001`

### Injected Bug: Change Detection Creates Infinite Loop

**Setup**:
```typescript
@Component({
  selector: 'app-live-clock',
  standalone: true,
  template: `<span>{{ currentTime }}</span>`,
  changeDetection: ChangeDetectionStrategy.Default
})
export class LiveClockComponent {
  get currentTime(): string {
    return new Date().toLocaleTimeString(); // Returns different value EVERY call
  }
}
```

**Observation**:
- In development mode: the console floods with `ExpressionChangedAfterItHasBeenCheckedError` on every change detection tick.
- In production mode: no error, but `currentTime` getter is called hundreds of times per second if any interaction triggers CD (mouse move, scroll, click).

**Diagnostic Steps**:
1. Open Chrome DevTools → Console → observe the `ExpressionChanged` error
2. Read the error message: `Previous value: '3:45:12 PM'. Current value: '3:45:12 PM'.` (times differ by milliseconds)
3. Set a breakpoint in the getter → observe it's called twice per CD tick (verification pass)
4. Open Performance tab → record → observe continuous `refreshView` calls for this component

**Root Cause**: The getter is **non-deterministic** — it returns a different value on every call because `new Date()` is called each time. Angular's second verification pass sees a different value, proving the template expression is unstable.

**Fix**:
```typescript
@Component({
  selector: 'app-live-clock',
  standalone: true,
  template: `<span>{{ currentTime() }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiveClockComponent {
  readonly currentTime = signal(new Date().toLocaleTimeString());

  constructor() {
    // Update once per second via a controlled interval
    const destroyRef = inject(DestroyRef);
    const intervalId = setInterval(() => {
      this.currentTime.set(new Date().toLocaleTimeString());
    }, 1000);

    destroyRef.onDestroy(() => clearInterval(intervalId));
  }
}
```

**Regression Test**:
```typescript
it('should not throw ExpressionChangedAfterItHasBeenCheckedError', () => {
  const fixture = TestBed.createComponent(LiveClockComponent);
  // First detection
  expect(() => fixture.detectChanges()).not.toThrow();
  // Second detection (simulates dev-mode verification)
  expect(() => fixture.detectChanges()).not.toThrow();
});
```

---

## 23. EXPERT QUESTIONS & ANSWERS (Principal / Staff Level)

### Question 1
*Explain the difference between `LView`, `TView`, and `TNode` in Angular's Ivy runtime. Why does Angular separate static template information from instance-specific data?*

> **Answer:**
> Angular's Ivy runtime uses a **flyweight pattern** to separate static and dynamic data:
>
> - **`TView` (Template View)**: A static, shared blueprint created ONCE per component class. It contains the compiled template function, binding layout indices, directive definitions, and the static DOM shape. If you create 100 instances of `AccountCardComponent`, they all share ONE `TView`.
>
> - **`LView` (Logical View)**: An instance-specific flat array created for EACH component instance. It stores the current binding values, the host DOM element reference, component class instance (`CONTEXT`), flags (dirty, attached, destroyed), and references to child `LView`s. 100 `AccountCardComponent` instances = 100 `LView` arrays.
>
> - **`TNode` (Template Node)**: A static node descriptor within a `TView`, one per template element or directive. It stores the tag name, static attributes, directive indices, and injection token resolution data for the Element Injector.
>
> **Why separate them?** Performance and memory. Creating 100 list items only allocates 100 `LView` arrays (each a flat `Array<any>`), not 100 copies of the template function, directive metadata, and binding layout. The `TView` is allocated once and reused, reducing memory pressure significantly in list-heavy enterprise UIs.

---

### Question 2
*In a Zoneless Angular application, what exactly triggers change detection, and how does Angular know WHICH component needs checking? Walk through the dirty-marking propagation algorithm.*

> **Answer:**
> In Zoneless Angular, there is NO global "something happened" trigger. Instead, Angular uses **Signal-based dirty marking**:
>
> 1. When a Signal's value is set (via `.set()`, `.update()`, or `.mutate()`), the Signal runtime walks its **consumer graph** — the list of reactive contexts (computed signals, effects, template bindings) that read this signal.
>
> 2. If a template binding consumed this signal, Angular marks the component's `LView` with the `Dirty` flag.
>
> 3. Angular then walks UP the view tree from the dirty `LView` to the root, marking each ancestor with `HasChildViewsToRefresh`. This is the **bubble-up marking** phase.
>
> 4. Angular schedules a single change detection tick (via `requestAnimationFrame` or a microtask, depending on the scheduler).
>
> 5. During `ApplicationRef.tick()`, the tree traversal starts from the root. At each node:
>    - If the node has `HasChildViewsToRefresh` → descend into children (but don't re-check this node's own bindings unless it's also `Dirty`)
>    - If the node is `Dirty` → execute its template function in Update mode, compare bindings, update DOM
>    - If the node has neither flag → SKIP the entire subtree
>
> 6. After processing, the `Dirty` and `HasChildViewsToRefresh` flags are cleared.
>
> **Key insight**: This means if Signal A is only consumed by ComponentX deep in the tree, only the path from root → ComponentX is traversed, and only ComponentX's template is re-evaluated. All sibling subtrees are completely skipped. This is fundamentally more efficient than Zone.js's "check everything" approach.

---

### Question 3
*What is the "Type-Check Block" (TCB) that Angular's AOT compiler generates, and why is it critical for template type safety? How does it interact with `strictTemplates`?*

> **Answer:**
> The TCB is a **synthetic TypeScript function** generated by the Angular compiler (`ngtsc`) for each component template. It does NOT run at runtime — its sole purpose is to be type-checked by the TypeScript compiler (`tsc`).
>
> Example — given this template:
> ```html
> <p>{{ user.name | uppercase }}</p>
> <button [disabled]="isLoading">Save</button>
> ```
>
> The compiler generates a TCB approximately like:
> ```typescript
> function _tcb_AppComponent(ctx: AppComponent) {
>   const _pipe = null! as UpperCasePipe;
>   '' + _pipe.transform(ctx.user.name);  // Type-checks: user.name → string
>   const _button = null! as HTMLButtonElement;
>   _button.disabled = ctx.isLoading;     // Type-checks: isLoading → boolean
> }
> ```
>
> With `strictTemplates: true`, the TypeScript compiler applies full strict type checking to this generated function. This catches:
> - Accessing properties that don't exist on the component class
> - Passing the wrong type to a pipe
> - Binding a `string` to a `boolean` DOM property
> - Using undeclared template variables
> - Calling methods with wrong argument counts
>
> Without `strictTemplates`, the TCB uses `any` casts, effectively disabling template type safety. This is why **`strictTemplates: true` is a non-negotiable production configuration** — it is the template equivalent of TypeScript's `strict: true`.
