# Module 07: Signals and Reactivity — The Angular Reactive Primitives

---

## 1. WHAT
Angular Signals provide a synchronous, fine-grained, reactive primitive for state management, offering a topological dependency graph that precisely tracks producer-consumer relationships to optimize dirty-marking and eliminate the need for global change detection traversal.

## 2. WHY
- **Fine-Grained Reactivity**: Zone.js relies on coarse-grained dirty marking (triggering tree-wide traversals for every microtask). Signals tell Angular exactly which views changed.
- **Zoneless Future**: Signals enable a fully Zoneless architecture, eliminating the Zone.js monkey-patching overhead and memory leaks.
- **Glitch-Free Execution**: Unlike RxJS `BehaviorSubject` chains which can evaluate intermediate states (glitches), Signals guarantee predictable, glitch-free propagation.
- **Simplified State**: For synchronous state, Signals drastically reduce the cognitive load compared to RxJS streams, while still allowing seamless RxJS interop for async orchestrations.

## 3. INTERNAL MENTAL MODEL
### The Signal Dependency Graph

```text
+===========================================================================================+
|                          SIGNAL DEPENDENCY GRAPH (Reactive Node Tree)                      |
|                                                                                            |
|   PRODUCERS (Writables)            COMPUTED (Derived)             CONSUMERS (Effects/Views)|
|                                                                                            |
|   [ WritableSignal A ]──────────┐                                                          |
|   value: 5                      │                                                          |
|   version: 1                    ▼                                                          |
|                           [ ComputedSignal C ]──────────────────┐                          |
|                           value: 15 (A + B)                     │                          |
|                           version: 1                            ▼                          |
|   [ WritableSignal B ]──────────┘                       [ Effect / LView ]                 |
|   value: 10                                             executes when notified             |
|   version: 1                                                                               |
|                                                                                            |
|   Execution Flow (When Signal A is set to 6):                                              |
|   1. Node A bumps version to 2.                                                            |
|   2. Node A marks consumers (Node C) as STALE (dirty).                                     |
|   3. Node C marks its consumers (Effect) as STALE.                                         |
|   4. Effect scheduler wakes up.                                                            |
|   5. Effect pulls Node C.                                                                  |
|   6. Node C checks Node A and B. Node A changed, so C recomputes (6 + 10 = 16).            |
|   7. Effect runs with new value 16.                                                        |
+===========================================================================================+
```

## 4. HOW IT WORKS
1. **Creation**: `signal(initialValue)` creates a writable reactive node (producer).
2. **Subscription (Tracking)**: When a signal is read (e.g., `mySignal()`) inside a reactive context (like `computed`, `effect`, or an Angular template), the context is registered as a consumer.
3. **Mutation**: Calling `.set()` or `.update()` on a writable signal bumps its internal version number.
4. **Push/Pull Mechanism**:
   - **Push**: The mutated signal pushes a "Stale" notification down the graph to all consumers.
   - **Pull**: The consumers (effects or templates) schedule a microtask to run. When they run, they "pull" the latest values. If intermediate computed signals are marked stale, they re-calculate lazily on demand.
5. **Glitch-Free Guarantee**: A consumer will never see an intermediate state. If a computed signal depends on `A` and `B`, and you update `A` which triggers a cascade that also updates `B`, the computed signal evaluates exactly once with the final values of both.

## 5. MODERN IMPLEMENTATION
### Signal-Driven Dashboard (Angular 19+ Standalone)

```typescript
import {
  Component, inject, computed, effect, signal,
  ChangeDetectionStrategy, untracked, linkedSignal
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PortfolioService } from './portfolio.service';
import { MatCardModule } from '@angular/material/card';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-portfolio-dashboard',
  standalone: true,
  imports: [MatCardModule, CurrencyPipe],
  template: `
    <div class="dashboard p-6">
      <h2>Portfolio {{ selectedPortfolioId() }}</h2>

      <!-- Writable Signal binding -->
      <button (click)="refresh.set(Date.now())">Refresh Data</button>

      @if (portfolioResource.isLoading()) {
        <p>Loading...</p>
      } @else if (portfolioResource.hasError()) {
        <p>Error: {{ portfolioResource.error() }}</p>
      } @else {
        @let portfolio = portfolioResource.value();
        <mat-card>
          <!-- Computed Signal binding -->
          <h3>Total Value: {{ totalValue() | currency }}</h3>
          <ul>
            @for (asset of portfolio?.assets; track asset.id) {
              <li>{{ asset.name }}: {{ asset.value | currency }}</li>
            }
          </ul>
        </mat-card>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortfolioDashboardComponent {
  private readonly portfolioService = inject(PortfolioService);

  // Writable Signals
  readonly selectedPortfolioId = signal<string>('PORT-101');
  readonly refresh = signal<number>(Date.now());

  // LinkedSignal (Angular 19+) - Resets/derives state based on source changes
  readonly localEdits = linkedSignal(() => ({
    portfolioId: this.selectedPortfolioId(),
    changes: 0
  }));

  // rxResource (Angular 19+) - Async data fetching bound to signals
  readonly portfolioResource = rxResource({
    request: () => ({
      id: this.selectedPortfolioId(),
      refreshTick: this.refresh()
    }),
    loader: ({ request }) => this.portfolioService.getPortfolio(request.id)
  });

  // Computed Signal (Memoized, Lazy)
  readonly totalValue = computed(() => {
    const portfolio = this.portfolioResource.value();
    if (!portfolio) return 0;
    return portfolio.assets.reduce((sum, asset) => sum + asset.value, 0);
  });

  constructor() {
    // Effect - Side effects reacting to state changes
    effect((onCleanup) => {
      const id = this.selectedPortfolioId();
      
      // Untracked - read value without establishing dependency
      const currentTotal = untracked(() => this.totalValue());
      
      console.log(`Portfolio switched to ${id}. Previous total was ${currentTotal}`);
      
      const timer = setTimeout(() => {
        console.log('Sending analytics ping...');
      }, 1000);

      // Cleanup logic runs before the effect re-runs or when destroyed
      onCleanup(() => clearTimeout(timer));
    });
  }
}
```

## 6. LEGACY / ENTERPRISE REALITY

| Legacy Pattern (Angular 2-15) | Modern Pattern (Angular 16-19+) | Migration Strategy |
|---|---|---|
| `@Input() data: T;` | `data = input<T>();` | Use CLI migration: `ng generate @angular/core:signal-input-migration`. Gradual refactor. |
| `BehaviorSubject` for local UI state | `signal<T>` | Replace Subjects used solely for `.next()` and `async` pipe with Signals. |
| `ngOnChanges` for derived state | `computed(() => ...)` | Move logic inside `computed()`. Completely eliminates `ngOnChanges` boilerplate. |
| `@Output() event = new EventEmitter();` | `event = output();` | Drop-in replacement, returns an `OutputEmitterRef`. |
| `@Input() data; @Output() dataChange;` | `data = model<T>();` | Two-way binding simplification. |
| `.mutate()` (Angular 16) | `.update(obj => {...})` | `mutate()` was deprecated and removed. Use `.update()` with immutable data structures or `produce` from Immer. |

## 7. PRACTICAL EXAMPLE
**Enterprise Scenario: SignalStore for Global Application State**
Managing enterprise authentication and permissions using NgRx SignalStore.

```typescript
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';

type AuthState = {
  user: User | null;
  permissions: string[];
  isLoading: boolean;
};

const initialState: AuthState = { user: null, permissions: [], isLoading: false };

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user, permissions }) => ({
    isAuthenticated: computed(() => !!user()),
    isAdmin: computed(() => permissions().includes('ADMIN'))
  })),
  withMethods((store, authService = inject(AuthService)) => ({
    login: rxMethod<Credentials>(
      pipe(
        tap(() => patchState(store, { isLoading: true })),
        switchMap(creds => authService.login(creds).pipe(
          tap(res => patchState(store, { 
            user: res.user, 
            permissions: res.permissions, 
            isLoading: false 
          }))
        ))
      )
    ),
    logout() {
      patchState(store, initialState);
    }
  }))
);
```

## 8. COMMON MISTAKES
1. **Signal in `ngOnInit`**: Attempting to read a required signal input in the constructor. (Required inputs are only available in `ngOnInit` or reactive contexts like `computed`/`effect`).
2. **Infinite Effect Loops**: Updating a signal inside an `effect()` that also reads the same signal, causing an infinite loop. Angular detects this and throws `Error: NG0600: Maximum call stack size exceeded`.
3. **Overusing `effect()`**: Using `effect()` to propagate state changes (e.g., updating Signal B when Signal A changes) instead of using `computed()`.
4. **Mutating State directly**: `mySignal().push(item)`. This bypasses the reactivity system. Always use `.update()`.
5. **RxJS Replacement Fallacy**: Trying to use Signals for complex asynchronous event coordination (like websockets with retry logic, debouncing, or race conditions) where RxJS is fundamentally superior.

## 9. LOCAL ISSUES
- **Symptom**: `ERROR Error: effect() can only be used within an injection context`
- **Root Cause**: `effect()` is called outside the `constructor()` or a field initializer, and Angular doesn't know which `Injector` to attach it to for lifecycle cleanup.
- **Fix**: Either call it in the constructor, or pass the injector explicitly: `effect(() => {...}, { injector: this.injector })`.

## 10. CI/CD ISSUES
- **Symptom**: Build fails on `Type 'Signal<Observable<T>>' is not assignable to type 'Signal<T>'`.
- **Root Cause**: Accidental nesting when using `toSignal()` inside a `computed()` or failing to unwrap an async operation properly.
- **Fix**: Use `rxResource` or `toSignal` at the top level, or use `switchMap` in an RxJS chain *before* converting to a signal.

## 11. PRODUCTION ISSUES
- **Symptom**: Subtle UI rendering glitches in legacy browsers or heavy load scenarios.
- **Root Cause**: Signal glitch-free guarantees break if you mix Signals and RxJS with improper `shareReplay` or if you manually trigger `detectChanges()` abruptly in the middle of a signal propagation tree.
- **Fix**: Rely on Zoneless CD or standard OnPush, and ensure RxJS streams converted via `toSignal(obs$, {requireSync: true})` are actually synchronous.

## 12. FULL-STACK INTERACTION
Signals integrate perfectly with Spring Boot APIs via `rxResource` or `toSignal`. 
```typescript
// Modern approach combining Signals and HttpClient
readonly userResource = rxResource({
  request: () => ({ id: this.userId() }), // Tracks userId signal
  loader: ({request}) => this.http.get<User>(`/api/users/${request.id}`)
});
```
When the user ID changes, the resource automatically cancels the previous HTTP request (preventing race conditions) and fetches the new data, exposing `.isLoading()`, `.value()`, and `.error()` as signals directly to the template.

## 13. DEBUGGING PROCESS
1. **Verify Signal Values**: Open Angular DevTools and inspect the Component state. Signals are explicitly shown and can be modified.
2. **Track Dependencies**: If a `computed` is not updating, check if the nested properties being read inside the `computed` function are actually signals. (e.g., reading `this.mySignal().nestedProp` only tracks `mySignal`, not mutations inside the object).
3. **Trace `effect` execution**: Add a `console.log` inside the `effect` to see how often it triggers. If it triggers repeatedly, look for cyclic dependencies.
4. **Use `untracked`**: If an effect triggers when it shouldn't, wrap the passive reads in `untracked(() => ...)` to break the dependency registration.

## 14. ROOT CAUSE ANALYSIS
**Why do infinite loops happen in effects?**
If an `effect` reads `signalA` and writes to `signalB`, and another `effect` reads `signalB` and writes to `signalA`, Angular's microtask scheduler will continuously wake up the effects. Angular 19 throws an error when an effect schedules itself too many times in a single CD tick, preventing browser lockup but crashing the component.

## 15. FIX
**Fixing Effect State Propagation:**
```typescript
// ❌ WRONG: Using effect for state propagation
effect(() => {
  this.fullName.set(`${this.firstName()} ${this.lastName()}`);
});

// ✅ CORRECT: Use computed
readonly fullName = computed(() => `${this.firstName()} ${this.lastName()}`);
```

## 16. PREVENTION
- **Linting Rule**: Enable `eslint-plugin-angular` rules to disallow state mutations inside `effect()`. `allowSignalWrites: true` in effects should be explicitly discouraged unless absolutely necessary (e.g., syncing with a non-reactive API).
- **Architecture**: Enforce the rule: "Derive state with `computed()`. Side effects (DOM manipulation, logging, local storage) with `effect()`."

## 17. MONITORING / OBSERVABILITY
Monitor Zone.js vs Zoneless performance. With Zoneless + Signals, the `ApplicationRef.tick()` time drops significantly. 
- Track INP (Interaction to Next Paint): Signals drastically improve INP because dirty checking is restricted to the specific component sub-tree.

## 18. PERFORMANCE CONSIDERATIONS
- **Memory**: Signals are lightweight objects. However, creating hundreds of thousands of individual signals in a massive grid can cause GC pressure. Prefer grouping related primitives into a single object signal: `signal({x: 0, y: 0})` rather than `signal(0)` and `signal(0)`.
- **Change Detection**: Signals bypass structural `LView` traversal if `OnPush` is used and intermediate views are unchanged.

## 19. SECURITY CONSIDERATIONS
- **Signal Exposure**: If you expose a `WritableSignal` directly from a service, any component can modify it. 
- **Mitigation**: Expose only `Signal` (read-only) using `.asReadonly()`:
  ```typescript
  private readonly _token = signal<string>('');
  public readonly token = this._token.asReadonly();
  ```

## 20. TESTING STRATEGY
```typescript
it('should compute full name', () => {
  const fixture = TestBed.createComponent(UserProfileComponent);
  
  // Set signal inputs using componentRef
  fixture.componentRef.setInput('firstName', 'John');
  fixture.componentRef.setInput('lastName', 'Doe');
  
  // In modern testing, trigger change detection
  fixture.detectChanges(); 
  
  expect(fixture.nativeElement.textContent).toContain('John Doe');
});
```

## 21. EXERCISES
1. Refactor a legacy component using `ngOnChanges` and `BehaviorSubject` to use `input()`, `computed()`, and `toSignal()`.
2. Implement an `rxResource` that fetches paginated data from a Spring Boot endpoint, reacting to a `page` signal.

## 22. BREAK-AND-FIX LAB
**Issue**: `ANG-SIGNALS-001` - Effect Infinite Loop
**Scenario**: An effect is used to reset a pagination index when a search query changes, but also triggers a search when the pagination index changes.
**Break**:
```typescript
effect(() => {
  const query = this.searchQuery();
  this.pageIndex.set(0); // WARNING! Writing inside effect
});
```
**Diagnostic Steps**: Observe `Maximum call stack size exceeded` in console.
**Fix**: Use `linkedSignal` for the page index:
```typescript
readonly pageIndex = linkedSignal({
  source: this.searchQuery,
  computation: () => 0 // Resets to 0 whenever search query changes
});
```

## 23. EXPERT QUESTIONS
1. **Q**: Explain the difference in CD scheduling between calling `.next()` on a `BehaviorSubject` in a Zoneless application versus calling `.set()` on a `Signal`.
   - **A**: Without Zone.js, `.next()` does not inherently schedule a CD tick unless explicitly tied to `async` pipe which marks the view dirty and calls `markForCheck()`. `Signal.set()` directly integrates with the Ivy runtime, marks the `LView` dirty, and automatically schedules `ApplicationRef.tick()`.
2. **Q**: How does Angular prevent "glitches" in computed signals when a diamond dependency problem exists?
   - **A**: Angular uses a topological push/pull graph. When a root signal changes, it pushes a "Stale" status down to computed signals but *does not evaluate them*. When the consumer (effect/view) pulls the value, the computed signal checks its dependencies. It evaluates once, topologically, resolving the diamond dependency without intermediate states.
3. **Q**: When would you use `toObservable()` on a signal instead of just keeping it as a signal?
   - **A**: When you need to cross the boundary from synchronous state into asynchronous orchestration. For example, taking a `searchQuery` signal, converting it via `toObservable()`, and then applying RxJS `debounceTime(300)` and `switchMap()` to perform an HTTP search.
