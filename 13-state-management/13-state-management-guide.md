# Module 13: State Management — Signal Store, Component Store, and Architectural Patterns

## 1. WHAT
State Management in an Angular + Spring Boot enterprise application is the systematic control, synchronization, and distribution of data across different architectural layers (URL, UI, component, global cache, and server). Modern Angular standardizes on Signal-based stores (like `@ngrx/signals`) for reactivity, moving away from heavy boilerplate while maintaining strict predictable data flows.

## 2. WHY
Enterprise applications deal with complex, intersecting state domains: real-time trading tickers, multi-step wizards, user sessions, and cached API responses. Without a strict state architecture, developers inadvertently create "spaghetti state" where multiple components mutate the same data unpredictably, leading to race conditions, out-of-sync UI, memory leaks, and impossible-to-debug "phantom data" bugs.

## 3. INTERNAL MENTAL MODEL

```text
+=============================================================================+
|                      ENTERPRISE STATE OWNERSHIP LAYERS                      |
+=============================================================================+
|                                                                             |
|  [1. URL STATE] (Source of Truth for Navigation/Filters)                    |
|    router.queryParams  -----\                                               |
|                              \                                              |
|  [2. GLOBAL / CACHE STATE]    \                                             |
|    SignalStore (NgRx)          \--> [3. DERIVED STATE (computed)]           |
|    - Portfolio data                 - Filtered transactions                 |
|    - User session                   - Total account balance                 |
|    - Reference data                 - Aggregated metrics                    |
|          ^                            |                                     |
|          | (updates)                  | (reads)                             |
|          v                            v                                     |
|  [4. COMPONENT UI STATE]     <------+                                       |
|    Local component signals                                                  |
|    - isOpen, isHovered, selectedTabIndex                                    |
|    - Temporary form input data                                              |
|          |                                                                  |
|          v (HTTP / WebSockets)                                              |
|  [5. SERVER STATE] (Absolute Source of Truth)                               |
|    Spring Boot Backend + Database                                           |
|                                                                             |
+=============================================================================+
```

## 4. HOW IT WORKS
1. **Categorization**: State is categorized by lifetime and scope:
   - **Server State**: Resides in Spring Boot; the frontend merely holds a *cache* of this state.
   - **URL State**: The current route, path variables, and query parameters.
   - **Global/Shared State**: Application-wide data (e.g., active user, feature toggles).
   - **Component State**: Transient UI data (e.g., dropdown open/closed).
2. **Reactivity**: Stores hold state in a reactive container. In Angular 19+, this is a Signal.
3. **Derivation**: `computed()` signals reactively derive new state from primitive state without duplicating data.
4. **Mutations**: State is mutated exclusively via strongly typed updater functions (`patchState`, actions, or methods).
5. **Synchronization**: Effects (`rxMethod` or `effect`) sync local state with the Spring Boot server (optimistically or pessimistically).

### The Synchronization Lifecycle
- **Step 1:** The user initiates an action (e.g., clicks "Buy Asset").
- **Step 2:** The component delegates to the store method (`store.buyAsset(id)`).
- **Step 3:** (Optimistic approach) The store immediately calls `patchState` to update the local cache, rendering the UI instantly.
- **Step 4:** The store dispatches an HTTP request to Spring Boot.
- **Step 5a:** If success (HTTP 200), the store processes any server-generated data (like transaction IDs) and finalizes the state.
- **Step 5b:** If failure (HTTP 400/500), the store issues a compensating `patchState` to revert the UI, and surfaces an error notification.

## 5. MODERN IMPLEMENTATION
Angular 19+ standardizes on **NgRx SignalStore** (`@ngrx/signals`) for a lightweight, composable, and highly reactive state container. It provides a functional, builder-like API that composes state slices, computed signals, and methods.

```typescript
// portfolio.store.ts
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject, computed } from '@angular/core';
import { pipe, switchMap, tap, catchError, EMPTY } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { PortfolioService } from './portfolio.service';

export type Asset = {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  dailyReturn: number;
};

type PortfolioState = {
  assets: Asset[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
};

const initialState: PortfolioState = {
  assets: [],
  isLoading: false,
  error: null,
  lastUpdated: null
};

export const PortfolioStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    // Derived state recomputes efficiently only when 'assets' change
    totalValue: computed(() => 
      store.assets().reduce((sum, asset) => sum + (asset.price * asset.quantity), 0)
    ),
    topPerformers: computed(() => 
      store.assets().filter(a => a.dailyReturn > 0.05)
    ),
    isStale: computed(() => {
      const last = store.lastUpdated();
      if (!last) return true;
      // Stale if older than 5 minutes
      return (Date.now() - last) > 5 * 60 * 1000; 
    })
  })),
  withMethods((store, portfolioService = inject(PortfolioService)) => ({
    // Synchronous state mutation
    updateAssetPrice(symbol: string, newPrice: number) {
      patchState(store, (state) => ({
        assets: state.assets.map(a => 
          a.symbol === symbol ? { ...a, price: newPrice } : a
        ),
        lastUpdated: Date.now()
      }));
    },
    
    // Asynchronous effect using rxMethod (RxJS interop)
    loadPortfolio: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((accountId) => portfolioService.getPortfolio(accountId).pipe(
          tapResponse({
            next: (assets) => patchState(store, { assets, isLoading: false, lastUpdated: Date.now() }),
            error: (err: Error) => patchState(store, { error: err.message, isLoading: false })
          })
        ))
      )
    )
  }))
);
```

## 6. LEGACY / ENTERPRISE REALITY
**Legacy Pattern 1: BehaviorSubject Service**
Before Signals, enterprise apps relied on heavy RxJS boilerplate within singleton services. Developers manually managed subscriptions, emissions, and deriving state through long pipes.
```typescript
@Injectable({ providedIn: 'root' })
export class LegacyPortfolioService {
  private stateSubject = new BehaviorSubject<PortfolioState>(initialState);
  state$ = this.stateSubject.asObservable();
  
  // Deriving state required complex map operations and distinctUntilChanged
  totalValue$ = this.state$.pipe(
    map(state => state.assets.reduce((sum, a) => sum + (a.price * a.quantity), 0)),
    distinctUntilChanged()
  );

  updatePrice(symbol: string, price: number) {
    const current = this.stateSubject.value;
    const updated = {
      ...current,
      assets: current.assets.map(a => a.symbol === symbol ? { ...a, price } : a)
    };
    this.stateSubject.next(updated);
  }
}
```

**Legacy Pattern 2: Classic NgRx (Redux pattern)**
Massive boilerplate with Actions, Reducers, Selectors, and Effects. While incredibly powerful for global undo/redo, complex event sourcing, and maintaining a strict, replayable audit trail of UI interactions, it is overkill for 95% of standard CRUD operations. The file explosion (actions.ts, reducer.ts, selectors.ts, effects.ts) led to significant developer fatigue.

```typescript
// Classic NgRx Boilerplate Example
export const loadPortfolio = createAction('[Portfolio] Load', props<{ id: string }>());
export const loadPortfolioSuccess = createAction('[Portfolio] Load Success', props<{ assets: Asset[] }>());

export const portfolioReducer = createReducer(
  initialState,
  on(loadPortfolio, (state) => ({ ...state, isLoading: true })),
  on(loadPortfolioSuccess, (state, { assets }) => ({ ...state, assets, isLoading: false }))
);

@Injectable()
export class PortfolioEffects {
  loadPortfolio$ = createEffect(() => this.actions$.pipe(
    ofType(loadPortfolio),
    switchMap(action => this.service.getPortfolio(action.id).pipe(
      map(assets => loadPortfolioSuccess({ assets })),
      catchError(error => of(loadPortfolioFailure({ error })))
    ))
  ));
  constructor(private actions$: Actions, private service: PortfolioService) {}
}
```

**Legacy Pattern 3: NgRx Component Store**
Introduced before Signals, `@ngrx/component-store` provided a way to scope state to a specific component lifecycle. It heavily relies on RxJS for both state derivation and effects.
```typescript
@Injectable()
export class LocalPortfolioStore extends ComponentStore<PortfolioState> {
  constructor(private service: PortfolioService) {
    super(initialState);
  }
  
  readonly assets$ = this.select(state => state.assets);
  
  readonly loadPortfolio = this.effect((accountId$: Observable<string>) => {
    return accountId$.pipe(
      switchMap((id) => this.service.getPortfolio(id).pipe(
        tapResponse(
          (assets) => this.patchState({ assets }),
          (error: HttpErrorResponse) => this.patchState({ error: error.message })
        )
      ))
    );
  });
}
```

**Migration Strategy:** 
1. Modern architectures migrate `BehaviorSubject` services directly to `signalStore`, which maps almost 1:1 conceptually but removes the RxJS subscription overhead in the template.
2. Classic NgRx is typically left alone due to high refactoring costs, though new features are built exclusively with `signalStore`.
3. `@ngrx/component-store` is systematically replaced by `signalStore` provided at the component level (`providers: [MySignalStore]`).

## 7. PRACTICAL EXAMPLE
**Scenario:** Enterprise Banking — Real-time Portfolio Dashboard.

The user views their investment portfolio. The initial state is loaded via REST (pessimistic update). However, a WebSocket connection streams real-time stock price changes. 

The `PortfolioDashboardComponent` injects the `PortfolioStore`. When the component initializes, it triggers `loadPortfolio()`. 
Concurrently, a `WebSocketService` listens to the pricing stream. The store consumes these WebSocket events and calls `updateAssetPrice()`, which updates the specific asset. 
Because we use Signals, the `totalValue` computed signal instantly recalculates, and the Angular rendering engine updates *only* the specific DOM text nodes displaying the prices and total.

```typescript
@Component({
  selector: 'app-portfolio-dashboard',
  standalone: true,
  template: `
    <div class="dashboard">
      @if (store.isLoading()) {
        <app-spinner />
      } @else {
        <header>
          <h2>Total Portfolio Value: {{ store.totalValue() | currency }}</h2>
          @if (store.isStale()) {
            <span class="warning">Data may be stale</span>
          }
        </header>
        
        <div class="grid">
          @for (asset of store.assets(); track asset.id) {
            <app-asset-card [asset]="asset" />
          }
        </div>
      }
    </div>
  `
})
export class PortfolioDashboardComponent implements OnInit {
  readonly store = inject(PortfolioStore);
  readonly wsService = inject(WebSocketPricingService);

  ngOnInit() {
    this.store.loadPortfolio('ACCT-12345');
    
    // Connect websocket stream to store updater
    this.wsService.prices$.pipe(
      takeUntilDestroyed()
    ).subscribe(update => {
      this.store.updateAssetPrice(update.symbol, update.price);
    });
  }
}
```

## 8. COMMON MISTAKES
1. **Duplicating State:** Storing derived data in the state object (e.g., storing `assets` AND `totalValue` in the raw state array) instead of computing it dynamically. This guarantees eventual desynchronization.
2. **Treating Angular as the Source of Truth:** Forgetting that frontend state is just a stale cache of the backend. Failing to implement stale-while-revalidate or TTL strategies results in users seeing outdated information.
3. **Over-engineering with Global State:** Putting purely UI state (like `isDropdownOpen`, `selectedTabIndex`) into a global NgRx store. This blasts global change events for minor local UI interactions and makes components unreusable outside that specific store context.
4. **Ignoring URL State:** Implementing complex filters (e.g., date ranges, status filters) entirely in local state variables. When the user clicks "Refresh" or shares the link, the state is lost. Filters should ALWAYS sync to `router.queryParams`.
5. **Leaking Memory in Component Stores:** Providing a store at the component level (`providers: [MyLocalStore]`) but creating long-running RxJS subscriptions inside the store that aren't tied to the store's lifecycle, causing memory leaks when the component is destroyed.

## 9. LOCAL ISSUES
- **Stale Closures in Effects/Timeouts:** Using `setTimeout` or raw promises inside state updaters capturing old state values. 
  ```typescript
  // BAD: Captures stale state
  setTimeout(() => {
    patchState(this.store, { count: this.store.count() + 1 });
  }, 1000);
  
  // GOOD: Functional updater receives latest state
  setTimeout(() => {
    patchState(this.store, (state) => ({ count: state.count + 1 }));
  }, 1000);
  ```

## 10. CI/CD ISSUES
- **Strict Mode Type Failures:** CI pipelines running `ng build` with strict template type checking will fail if you attempt to mutate a Signal directly (`store.assets().push(...)`). Signals are strictly readonly in the view and must be updated via explicit mutations.
- **Test Timeouts:** Using standard RxJS `delay()` in `rxMethod` without providing the test environment's RxJS scheduler causes headless CI tests to hang or take excessively long.

## 11. PRODUCTION ISSUES
- **Memory Leaks from Component Stores:** If a Component Store (or local `signalStore` provided at the component level) uses `rxMethod` with long-running observables (like an infinite WebSocket stream) and fails to properly clean up `takeUntilDestroyed()`, the store and the component will leak memory every time the user navigates.
- **LocalStorage Quota Exceeded:** Attempting to persist massive global state trees to `localStorage` (which has a ~5MB limit). In production with heavily active users, this throws `QuotaExceededError` and crashes the initialization sequence.

## 12. FULL-STACK INTERACTION
Angular state management is tightly coupled with Spring Boot's data consistency strategies:

1. **Optimistic Updates**: Angular updates the store *before* the Spring Boot REST call completes to make the UI feel instant. 
   - *Example:* User likes a post. Heart turns red instantly.
   - *Spring Boot Contract:* If the backend validation fails (e.g., user blocked), the server returns a 4xx error. The Angular `rxMethod` catches this, rolls back the heart to gray, and shows a toast.
   
2. **Pessimistic Updates**: Angular shows a spinner and only updates the store *after* Spring Boot returns a 200 OK.
   - *Example:* Financial transfer. We never optimistically deduct $50,000 from the UI balance until the server confirms the transaction committed to the database.

3. **ETags and Caching**: 
   - Spring Boot returns `ETag: "v1.42"` headers for large payloads (like reference data).
   - Angular stores the ETag alongside the payload in its state.
   - On the next request, Angular's HttpInterceptor injects `If-None-Match: "v1.42"`.
   - Spring Boot evaluates this and returns `304 Not Modified` with an empty body.
   - Angular's store recognizes the 304, updates its `lastUpdated` timestamp, and continues serving the cached data, saving massive bandwidth.

```java
// Spring Boot ETag Configuration for Reference Data
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Bean
    public ShallowEtagHeaderFilter shallowEtagHeaderFilter() {
        return new ShallowEtagHeaderFilter(); // Automatically generates ETags based on response content
    }
}

@RestController
@RequestMapping("/api/v1/reference")
public class ReferenceDataController {
    @GetMapping("/currencies")
    public ResponseEntity<List<CurrencyDto>> getCurrencies() {
        // If the Angular client sends an ETag matching the generated one, 
        // ShallowEtagHeaderFilter short-circuits and returns 304 Not Modified.
        return ResponseEntity.ok(referenceDataService.getCurrencies());
    }
}
```

## 13. DEBUGGING PROCESS
1. **Angular DevTools:** Inspect components to see the current value of injected stores and computed signals. The DevTools can inspect internal signal values at any node.
2. **Redux DevTools:** For classic NgRx or SignalStore (with the DevTools plugin enabled), open the Redux DevTools extension to see the precise timeline of `patchState` events, visualizing the state diff and utilizing time-travel debugging.
3. **Effect Logging:** Add `effect(() => console.log('State changed:', this.store.assets()))` during development to trace unexpected mutations. Because effects automatically track dependencies, it will log exactly when the data changes.
4. **Network Traces:** Cross-reference frontend store updates with Chrome DevTools Network panel to ensure backend data matches frontend state. If the UI says "Active" but the Network tab shows the backend returned "Suspended", the state mapping logic is flawed.

## 14. ROOT CAUSE ANALYSIS
**Issue:** User updates their profile name on page A, navigates to page B, and sees the old name.
**Root Cause:** Page A successfully executed a PUT request to Spring Boot but failed to update the global shared state cache (or didn't invalidate the cache). Page B loads, checks the global state, sees the data is technically "present", and skips the HTTP call, displaying the stale cached data. This is a classic violation of "Single Source of Truth" where the frontend cache diverges from the backend reality.

## 15. FIX
Ensure mutations invalidate or strictly update the global cache immediately after a successful mutation.
```typescript
updateProfile(newName: string) {
  return this.http.put('/api/profile', { name: newName }).pipe(
    tap(() => {
      // FIX: Synchronize the global store with the server reality
      patchState(this.userStore, { name: newName, lastUpdated: Date.now() });
    })
  );
}
```

## 16. PREVENTION
1. **State Ownership Guidelines:** Document which service/store owns which data domain. Do not let components bypass the store and make raw HTTP calls for cached entities. If a component needs users, it MUST ask the UserStore.
2. **TTL (Time To Live):** Implement TTL checks in stores. If data is older than 5 minutes, force a background refresh (`stale-while-revalidate`) while serving the stale data immediately.
3. **Lint Rules:** Use ESLint rules to prevent mutating objects inside `patchState` (enforce immutable updates).

## 17. MONITORING / OBSERVABILITY
Monitor state synchronization failures. If an optimistic update fails and requires a rollback, emit a telemetry event to your observability platform (e.g., Datadog, New Relic). A high rate of rollbacks indicates a desynchronization between frontend validation logic and backend business rules, frustrating users who see actions "flicker" and revert.

## 18. PERFORMANCE CONSIDERATIONS
**SignalStore vs Classic NgRx:** `SignalStore` eliminates the heavy RxJS `combineLatest` and `distinctUntilChanged` overhead. Because computed signals are lazily evaluated and memoized, calculating complex derived state (like sorting 10,000 transactions) only happens when the underlying dependency changes AND the UI actually asks for the value. In classic RxJS, derivations often fire aggressively down pipes even if the UI is hidden.

**Persistence:** When using `localStorage` to rehydrate state on app load, stringifying and parsing huge JSON trees blocks the main JavaScript thread. Persist only minimal necessary state (e.g., auth tokens, user preferences) rather than the entire entity cache. Use IndexedDB for massive client-side caches.

## 19. SECURITY CONSIDERATIONS
State persists in memory. If a user logs out, the global state container must be explicitly cleared/reset. Otherwise, navigating to a protected route (if guards are bypassed or misconfigured) could render sensitive cached data from the previous user's session.
Additionally, never store highly sensitive information (like unencrypted credit card data or raw passwords) in local state if it can be avoided, as it can be extracted via memory dumps or XSS attacks accessing the Redux DevTools window object.

## 20. TESTING STRATEGY
**Unit Testing SignalStores:**
Signal stores are incredibly easy to test because they are just injected services with synchronous signals.
```typescript
it('should compute total portfolio value correctly', () => {
  TestBed.configureTestingModule({ providers: [PortfolioStore] });
  const store = TestBed.inject(PortfolioStore);
  
  // Set initial state
  patchState(store, { 
    assets: [
      { symbol: 'AAPL', price: 100, quantity: 5 },
      { symbol: 'MSFT', price: 200, quantity: 2 }
    ] 
  });
  
  // Assert computed value synchronously (no subscribe needed)
  expect(store.totalValue()).toBe(900);
});
```

## 21. EXERCISES
1. Create a `signalStore` for a Shopping Cart that handles optimistic updates when adding an item, reverting the cart if the backend returns a 409 Conflict (e.g., out of stock).
2. Implement a `withStorage` custom SignalStore feature that automatically syncs specific state slices to `sessionStorage` using effects.
   ```typescript
   export function withStorage<T>(key: string) {
     return signalStoreFeature(
       withHooks({
         onInit(store) {
           const saved = sessionStorage.getItem(key);
           if (saved) patchState(store, JSON.parse(saved));
           effect(() => sessionStorage.setItem(key, JSON.stringify(getState(store))));
         }
       })
     );
   }
   ```
3. Refactor a legacy `BehaviorSubject` service to use `signalStore`, demonstrating the reduction in boilerplate.
4. Implement a stale-while-revalidate cache strategy inside an `rxMethod` that returns local state immediately but triggers a background HTTP refresh if the TTL has expired.

## 22. BREAK-AND-FIX LAB
**Issue ANG-STATE-001:** Stale Cache Shows Incorrect Balance
**Context:** A banking app dashboard displays account balance. The user executes a transfer, but the dashboard balance doesn't update.
**Defect:** The transfer component calls the API directly but doesn't notify the global `AccountStore` to refresh.
**Reproduction:** 
1. Open dashboard (balance is $1000).
2. Execute a $200 transfer in the transfer modal.
3. Return to dashboard (balance remains $1000).
**Fix:** Inject the `AccountStore` into the transfer logic and invalidate the cache or explicitly update the balance upon a successful 200 OK from the transfer API.
```typescript
// FIX inside TransferComponent
this.transferService.execute(req).subscribe(() => {
  // Triggers a reload in the store, ensuring the UI reflects the new reality
  this.accountStore.invalidateCache(); 
});
```

## 23. EXPERT QUESTIONS
1. **Question:** In an enterprise app with WebSockets pushing 100 updates per second, how do you prevent Angular's change detection from overwhelming the browser if you pipe those updates into a `signalStore`?
   *Answer:* While Signals are highly efficient at dirty-marking, 100 updates/sec invoking `patchState` will still cause rapid recalculation of computed signals and potential UI thrashing. You must debounce or batch the incoming WebSocket stream using RxJS operators (`bufferTime(250)`) *before* calling `patchState`, applying the accumulated diffs in a single update frame.
2. **Question:** How do you handle circular state dependencies where `StoreA` needs a computed value from `StoreB`, and `StoreB` needs data from `StoreA`?
   *Answer:* Circular dependencies usually indicate a domain modeling flaw where two stores are too tightly coupled. The solution is to extract the shared state into a lower-level `StoreC`, or to rethink the domain boundaries. In SignalStore, you can pass external signals into a store via `withComputed`, but structural cycles must be resolved by elevating state ownership.
3. **Question:** Explain the trade-offs between implementing optimistic updates via HTTP Interceptors versus handling them directly inside a component's or store's `rxMethod`.
   *Answer:* Handling optimistic updates in generic HTTP Interceptors is extremely difficult because Interceptors lack domain context (they just see HTTP requests and generic payloads, not the UI state). Handling them inside the `rxMethod` is ideal because the store has immediate access to the current state, can apply the optimistic patch, execute the HTTP call, and catch the specific error to apply the exact inverse rollback patch with full contextual awareness.
