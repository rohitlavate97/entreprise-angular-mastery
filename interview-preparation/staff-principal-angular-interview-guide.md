# Staff & Principal Angular + Full-Stack Interview Guide

> **Target Level:** Senior, Lead, Staff, and Principal Engineers. Focuses on internals, architectural decision trade-offs, concurrency bugs, and system-level reasoning.

---

## 🏛️ Section 1: Framework Internals & Runtime Execution

### Q1: Explain how the Ivy runtime engine compiles and updates templates using `TView`, `LView`, and `TNode`.
**Principal-Level Answer:**
Ivy represents components using two distinct data structures:
1. **`TView` (Template/Type View)**: Immutable, shared across all instances of a component. Stores static data (template bytecode instructions, element tag names, binding slot offsets, and DI bloom filters).
2. **`LView` (Logical View)**: Mutable, 1-to-1 per component instance in the DOM. An array holding current evaluated expression values, DOM node references, Child `LView` pointers, and injector state.
3. **`TNode`**: Abstract DOM representation containing bitwise Bloom filters for fast `ElementInjector` resolution in $O(1)$ time without prototype tree traversal.

During Change Detection, Ivy traverses `LView` arrays, evaluating generated template functions in two modes: `Create` (mode 1) and `Update` (mode 2). By comparing the current value in `LView[i]` with the evaluated expression, Ivy writes to the DOM only if reference equality (`Object.is`) fails.

---

### Q2: What causes `ExpressionChangedAfterItHasBeenCheckedError` and what are the only two architecturally sound fixes?
**Principal-Level Answer:**
In development mode, Angular runs change detection twice:
1. Pass 1: Runs component logic, updates bindings, updates DOM, captures values.
2. Pass 2: Reruns expressions and asserts `oldValue === newValue`. If false, throws `ExpressionChangedAfterItHasBeenCheckedError`.

This indicates a unidirectional data flow violation where a child component modified state in a parent component during the child's render pass (e.g. in `ngOnInit`, `ngAfterViewInit`, or a setter).

**Architecturally Sound Fixes:**
1. **Migrate to Signals (`computed()` / `signal()`):** Signals use a push-pull reactive graph. State updates during computed derivations are forbidden, eliminating out-of-order parent mutations.
2. **State Elevation (Lift State Up):** Move state ownership to a shared Service or the Parent component so the state is resolved *before* child change detection runs.
*(Anti-pattern to avoid: Wrapping in `setTimeout()` or `cdr.detectChanges()` in lifecycle hooks, which masks root architectural flaws).*

---

### Q3: How do Angular 19+ Signals integrate with Change Detection in both OnPush and Zoneless modes?
**Principal-Level Answer:**
Signals maintain a directed acyclic graph (DAG) of Producers (writable signals, computed signals) and Consumers (template reactive contexts, effects).
When a Signal's value changes (`.set()` or `.update()`):
1. It traverses its consumer graph and marks reactive consumers as dirty.
2. If the consumer is a template, it invokes `markViewDirty(lView)` directly upwards through parent views, scheduling an asynchronous microtask (`requestAnimationFrame` / `queueMicrotask`).
3. In **Zoneless Angular** (`provideExperimentalZonelessChangeDetection()`), change detection is driven entirely by these signal dirty notifications and event listeners, eliminating the global monkey-patching overhead of `Zone.js`.

---

## ⚡ Section 2: Concurrency, RxJS & Network Architecture

### Q4: Compare `switchMap`, `mergeMap`, `concatMap`, and `exhaustMap` with production disaster scenarios for incorrect usage.
| Operator | Execution Semantics | Correct Use Case | Disaster Scenario if Used Incorrectly |
|---|---|---|---|
| `switchMap` | Cancels previous in-flight observable | Typeahead search, Tab switching | **Financial Payment POST**: Cancels transaction in-flight, leaving backend with orphaned DB commit while frontend drops response! |
| `mergeMap` | Concurrent execution (no cancellation) | Fetching independent details for multiple IDs | **Autosave Form**: Out-of-order network responses overwrite newest user input with stale earlier state. |
| `concatMap` | Sequential queuing (preserves order) | Drag-and-drop reordering, sequential file uploads | **High-frequency search**: Queues 20 searches, executing all 20 sequentially, causing UI freeze and severe lag. |
| `exhaustMap` | Ignores new emissions while active | Login submit, Wire transfer button | **Search Box**: Ignores new keystrokes while first search is in flight, returning completely wrong search results. |

---

### Q5: How do you architect a Race-Condition-Safe Refresh Token Queue in Angular?
**Principal-Level Answer:**
When an access token expires, a dashboard firing 5 simultaneous requests will receive five `401 Unauthorized` responses simultaneously. A naive interceptor fires five `/refresh` requests, causing race condition failures or database lock collisions.

**The Principal Solution:**
1. Maintain a module-level lock `let isRefreshing = false` and a queue `refreshTokenSubject = new BehaviorSubject<string | null>(null)`.
2. The **first** request sets `isRefreshing = true`, clears the subject, and calls `authService.refreshToken()`.
3. Requests 2 through 5 detect `isRefreshing === true` and subscribe to `refreshTokenSubject.pipe(filter(token => token !== null), take(1), switchMap(token => next(retryWith(token))))`.
4. When the refresh call resolves with a new token, set `isRefreshing = false`, emit the token to `refreshTokenSubject`, and all waiting requests are retried concurrently.

---

## 🛡️ Section 3: Full-Stack Security & System Boundaries

### Q6: Why are Angular Route Guards NOT a security boundary?
**Principal-Level Answer:**
Angular runs entirely in the client browser's memory. Any user can open Chrome DevTools, modify JavaScript variables, bypass `canActivate` guards, or inject custom components into the DOM.

Therefore:
- **Route Guards are UI navigation conveniences** (hiding inaccessible screens, redirecting unauthenticated users to `/login`).
- **Spring Security is the only security boundary.** Every API endpoint must enforce authorization independently via `@PreAuthorize("hasRole('ADMIN')")`, JWT claim verification, and database-level tenancy filters.
