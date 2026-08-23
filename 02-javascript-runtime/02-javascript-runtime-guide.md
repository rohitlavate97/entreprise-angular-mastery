# Module 02: JavaScript Runtime & Browser Internals

---

## 1. WHAT
The JavaScript Runtime in the browser is the **single-threaded execution environment** (V8, JavaScriptCore, SpiderMonkey) comprising the **Call Stack**, the **Memory Heap**, the **Microtask Queue**, the **Macrotask (Task) Queue**, and the **Garbage Collector (Generational Mark-and-Sweep)** governed by the host browser's **Event Loop**.

---

## 2. WHY
Angular runs entirely on this single-threaded event loop:
- **Change Detection Scheduling**: Zone.js and modern Zoneless Signal schedulers hook directly into the microtask and macrotask pipelines.
- **UI Freezes (Jank)**: Executing CPU-heavy calculations synchronously on the call stack blocks the browser from executing the Render Steps (Style -> Layout -> Paint -> Composite), dropping frame rates below 60fps / 120fps.
- **Memory Leaks**: Long-lived closures, uncleaned DOM event listeners, and uncompleted RxJS subscriptions retain detached DOM nodes in the Heap, causing progressive browser memory exhaustion.

---

## 3. INTERNAL MENTAL MODEL

```
+----------------------------------------------------------------------------------------------------+
|                                    BROWSER MAIN THREAD RUNTIME                                     |
|                                                                                                    |
|  +---------------------------+                              +-----------------------------------+  |
|  |        CALL STACK         |                              |            MEMORY HEAP            |  |
|  | (Synchronous Execution)   |                              | (Objects, Closures, DOM Nodes)    |  |
|  |                           |                              |                                   |  |
|  | [ component.loadData() ]  |                              |  [ Root Object ]                  |  |
|  | [ httpService.fetch()  ]  |                              |        |                          |  |
|  | [ anonymous frame      ]  |                              |        v                          |  |
|  |                           |                              |  [ Component Instance ]           |  |
|  +-------------+-------------+                              |        | (closure retains)        |  |
|                |                                            |        v                          |  |
|                |                                            |  [ Detached DOM Tree ] <--- LEAK! |  |
|                v                                            +-----------------------------------+  |
|     +--------------------+                                                                         |
|     |  Stack is Empty?   |                                                                         |
|     +----------+---------+                                                                         |
|                |                                                                                   |
|                | YES                                                                               |
|                v                                                                                   |
|  +----------------------------------------------------------------------------------------------+  |
|  |                                    MICROTASK QUEUE                                           |  |
|  |              (Promises, queueMicrotask, MutationObserver, Signal Effects Batch)              |  |
|  |                                                                                              |  |
|  |  [ Task 1 ] -> [ Task 2 ] -> [ Task 3 ]  ---> *DRAINED COMPLETELY UNTIL EMPTY*                |  |
|  +---------------------------------------------+------------------------------------------------+  |
|                                                |                                                   |
|                                                v                                                   |
|  +----------------------------------------------------------------------------------------------+  |
|  |                                      RENDER STEPS                                            |  |
|  |                       (Run ~every 16.6ms at 60Hz if DOM is dirty)                            |  |
|  |                                                                                              |  |
|  |  [ requestAnimationFrame ] -> [ Style Recalc ] -> [ Layout (Reflow) ] -> [ Paint & Composite ]|
|  +---------------------------------------------+------------------------------------------------+  |
|                                                |                                                   |
|                                                v                                                   |
|  +----------------------------------------------------------------------------------------------+  |
|  |                                   MACROTASK / TASK QUEUE                                     |  |
|  |                      (setTimeout, setInterval, I/O, UI Click Events, postMessage)             |  |
|  |                                                                                              |  |
|  |  [ Event Task 1 ]   (Picks EXACTLY ONE task, pushes to Call Stack, repeats loop)             |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## 4. HOW IT WORKS: THE EVENT LOOP PHASES

1. **Synchronous Callstack Execution**: The engine evaluates instructions top-to-bottom on the single call stack.
2. **Microtask Queue Drain**:
   - As soon as the call stack empties, the engine immediately checks the **Microtask Queue**.
   - It executes microtasks continuously until the microtask queue is **100% empty**.
   - *Critical Nuance*: If a microtask schedules another microtask (e.g., recursive `Promise.resolve().then(...)`), the queue will never empty, starving the Macrotask Queue and freezing the browser completely.
3. **Render Pipeline (requestAnimationFrame & Painting)**:
   - If the display refresh interval is reached (~16.6ms for 60Hz screens) and layout is marked dirty, the browser executes `requestAnimationFrame` callbacks, recalculates CSS styles, performs layout calculation (geometry), and paints pixels to GPU layers.
4. **Macrotask Execution**:
   - The engine selects **the single oldest task** from the Macrotask Queue (e.g., a `setTimeout` callback or a mouse click event) and pushes it to the Call Stack.
   - Once that task finishes, the engine returns immediately to step 2 (drain microtasks).

---

## 5. MODERN IMPLEMENTATION

### A. Non-Blocking Chunked Processing (Yielding to the Event Loop)

When processing large datasets (e.g., 50,000 transaction records) in Angular without freezing the UI or dropping frames:

```typescript
// frontend/src/app/core/utils/scheduler.utils.ts

/**
 * Yields execution back to the browser event loop to allow UI rendering and user input handling.
 * Leverages the modern `scheduler.yield()` API with fallback to `MessageChannel` / `setTimeout`.
 */
export async function yieldToMain(): Promise<void> {
  // 1. Modern Chrome / Edge native cooperative scheduling API
  if ('scheduler' in window && 'yield' in (window as any).scheduler) {
    return (window as any).scheduler.yield();
  }

  // 2. High-performance fallback using MessageChannel (avoids setTimeout 4ms clamping)
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

/**
 * Processes heavy arrays in non-blocking batches.
 */
export async function processInBatches<T, R>(
  items: ReadonlyArray<T>,
  batchSize: number,
  transform: (item: T) => R
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i++) {
    results.push(transform(items[i]));
    
    // Yield every batchSize items to let the browser paint
    if ((i + 1) % batchSize === 0) {
      await yieldToMain();
    }
  }
  
  return results;
}
```

### B. Leak-Free Lifecycle Teardown with Modern `DestroyRef` & AbortController

```typescript
// frontend/src/app/features/analytics/components/live-stream.component.ts
import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';

@Component({
  selector: 'app-live-stream',
  standalone: true,
  template: `<div class="p-4">Live Heartbeats: {{ heartbeats() }}</div>`
})
export class LiveStreamComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly heartbeats = signal<number>(0);

  ngOnInit(): void {
    const controller = new AbortController();
    const { signal: abortSignal } = controller;

    // Modern Native Event Listener with AbortSignal cleanup
    window.addEventListener(
      'resize',
      () => console.log('Window resized - safe handling'),
      { signal: abortSignal }
    );

    // High precision timer cleanup
    const timerId = setInterval(() => {
      this.heartbeats.update((v) => v + 1);
    }, 1000);

    // Guaranteed teardown on component destruction
    this.destroyRef.onDestroy(() => {
      controller.abort(); // Automatically removes window event listener
      clearInterval(timerId); // Prevents interval leak in the event loop
    });
  }
}
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Modern Pattern (Angular 19 / ES2024) | Legacy Pattern (Angular 2-15) | Underlying Runtime Vulnerability |
|---|---|---|
| Native `AbortSignal.timeout(5000)` / `DestroyRef` | `ngOnDestroy` + manual boolean flags (`isDestroyed = true`) | Flags don't stop background timers; memory leaks if cleanup is forgotten |
| Signals batching in microtask queue | Zone.js monkey-patching every asynchronous browser API (`setTimeout`, `Promise`, XHR) | Zone.js adds overhead to every single event loop turn and prevents true fine-grained reactivity |
| `MessageChannel` / `scheduler.yield()` | `setTimeout(fn, 0)` for deferral | `setTimeout` has a browser-enforced minimum clamp of 4ms on nested calls, wasting CPU cycles |
| `WeakMap` / `WeakRef` for object caching | Global `Map` / Object dictionaries for caching | Objects in standard `Map` are strongly referenced, preventing GC even after component destruction |

---

## 7. PRACTICAL EXAMPLE: MEMORY LEAK DIAGNOSIS (THE DETACHED DOM TREE)

A common enterprise defect occurs when an Angular service or RxJS subscription holds a reference to a component that has been destroyed by router navigation:

```
[ Router Navigates away from UserDetailsComponent ]
  |
  +---> Angular destroys Component View & removes <app-user-details> from active DOM tree
  |
  +---> Global NotificationService still holds: `this.sub = liveUpdates$.subscribe(data => this.component.update(data))`
  |
  +---> V8 Garbage Collector runs:
        Is UserDetailsComponent reachable from GC Roots (Global Scope / Services)?
        YES -> NotificationService -> Closure -> UserDetailsComponent -> ViewRef -> Native DOM Nodes.
  |
  +---> RESULT: 50MB of detached DOM elements retained in RAM on every page visit!
```

---

## 8. COMMON MISTAKES

1. **Creating Microtask Starvation**: Calling `queueMicrotask()` or resolving nested promises in a tight loop blocks the Macrotask queue and UI rendering entirely.
2. **Retaining DOM References in Global Singletons**: Passing component instances (`this`) into root-level `@Injectable({ providedIn: 'root' })` services without explicitly clearing them on teardown.
3. **Uncleaned `setInterval`**: A `setInterval` callback registered on the browser runtime holds a strong closure reference to its parent scope until `clearInterval` is invoked.
4. **Misunderstanding `setTimeout(..., 0)`**: Believing `setTimeout(fn, 0)` executes "immediately". It actually yields to the **macrotask queue**, allowing all currently pending synchronous code and **all microtasks** to finish first.

---

## 9. LOCAL ISSUES
- **Symptom**: Browser tab CPU spikes to 100%, devtools disconnects or crashes with `Out of Memory`.
- **Root Cause**: An infinite microtask loop or recursive signal computation scheduling microtasks continuously without giving control back to the event loop.

---

## 10. CI/CD ISSUES
- **Symptom**: Headless Chrome (Playwright / Karma) tests time out or crash with `Fatal process out of memory: Zone allocation failed`.
- **Root Cause**: Test suites creating thousands of component fixtures without calling `fixture.destroy()`, exhausting Node/V8 heap memory.

---

## 11. PRODUCTION ISSUES
- **Symptom**: After a user leaves an enterprise dashboard open for 4 hours, browser RAM consumption increases from 120MB to 2.8GB, causing laggy interactions and eventual tab crash.
- **Root Cause**: Detached DOM leak from uncompleted RxJS subscriptions and uncleaned third-party chart library instances.

---

## 12. FULL-STACK INTERACTION: ASYNC HTTP TEARDOWN & ABORT SIGNALS

When an Angular user navigates away from a route while a large Spring Boot query is executing:
- Without client cancellation, Spring Boot continues executing heavy database queries and serializing data for a client that is no longer listening.
- With modern `AbortController` / `HttpClient` teardown, the browser immediately closes the TCP socket / HTTP/2 stream, allowing Spring Boot's Tomcat/Netty container to detect the client disconnect (`ClientAbortException`) and terminate backend processing early.

```
ANGULAR (Browser)                                    SPRING BOOT (Tomcat / Netty)
   |                                                              |
   | --- GET /api/v1/heavy-report (Stream Open) ----------------> |
   |                                                              | ---> Starts heavy SQL query
   | [ User clicks 'Back' -> DestroyRef triggers controller.abort() ]
   |                                                              |
   | --- RST_STREAM (HTTP/2 Cancel) ----------------------------> |
   |                                                              | ---> Detects Socket Closed
   |                                                              | ---> Cancels Transaction / DB cursor
```

---

## 13. DEBUGGING PROCESS (Senior Engineer Memory Profiling)

1. **Open Chrome DevTools -> Memory Panel**.
2. **Take Baseline Heap Snapshot**: Record snapshot at page startup (e.g., 25MB).
3. **Perform Repetitive User Action 5 Times**: (Navigate to Target Route -> Navigate Back to Home).
4. **Take Second Heap Snapshot**.
5. **Filter by "Detached"**:
   - Type `Detached` in the Class filter box.
   - Look for `Detached HTMLDivElement` or `Detached Component`.
   - Inspect the **Retainers Tree** at the bottom to find the GC Root retaining the object (e.g., `context in closure` -> `Subscription`).

---

## 14. ROOT CAUSE ANALYSIS: Generational Garbage Collection & Roots
V8 uses a **Generational Mark-and-Sweep** GC. Objects begin in the "Nursery" (Young Generation). If they survive GC cycles, they are promoted to the "Old Generation". An object can ONLY be garbage collected if there is **no reference path** connecting it back to a **GC Root** (Window, Global Scope, Active Stack Frame, or DOM root). An uncompleted observable subscription or open event listener creates an active reference path from the global runtime down to the component instance.

---

## 15. FIX
- Always use `DestroyRef.onDestroy()` or modern `takeUntilDestroyed()` to terminate asynchronous observables and event listeners.
- Use `AbortController` to cancel in-flight HTTP requests on component destruction.

---

## 16. PREVENTION
- Enable ESLint rule `@angular-eslint/use-lifecycle-interface`.
- Implement automated memory leak smoke tests in Playwright using `page.evaluate(() => performance.memory.usedJSHeapSize)`.

---

## 17. MONITORING / OBSERVABILITY
- Capture browser memory pressure using `performance.memory` (where supported) and report high percentile heap sizes to frontend monitoring dashboards.

---

## 18. PERFORMANCE CONSIDERATIONS
- Keep the call stack short. Break any single task that exceeds **50ms** (Long Task threshold defined by Chrome Core Web Vitals) into chunks using `scheduler.yield()` to protect the **Interaction to Next Paint (INP)** metric.

---

## 19. SECURITY CONSIDERATIONS
- Memory leaks can inadvertently retain sensitive user credentials, decrypted encryption tokens, or PII (Personally Identifiable Information) in RAM long after a user has clicked "Logout".

---

## 20. TESTING STRATEGY
- In unit and component tests, assert that teardown hooks correctly dispose of subscriptions, timers, and abort controllers.

---

## 21. EXERCISES
1. Trace the exact console output order of the following snippet:
   ```javascript
   console.log('1');
   setTimeout(() => console.log('2'), 0);
   Promise.resolve().then(() => console.log('3'));
   queueMicrotask(() => console.log('4'));
   console.log('5');
   ```
2. Refactor an uncleaned `window.addEventListener('scroll', fn)` into a leak-free implementation using `DestroyRef` and `AbortController`.

---

## 22. BREAK-AND-FIX LAB: `JS-RUNTIME-001`
- **Injected Bug**: In a polling widget component, start a `setInterval` that appends items to an array without clearing it in `ngOnDestroy` / `DestroyRef`.
- **Observation**: Navigate back and forth between routes 10 times. Observe CPU usage climbing and interval callbacks multiplying exponentially in the console.
- **Diagnostic Action**: Inspect the DevTools Performance Monitor: JS Heap size climbs monotonically without plateauing.
- **Fix**: Hook into `DestroyRef.onDestroy(() => clearInterval(timerId))` to guarantee event loop cleanup.

---

## 23. EXPERT QUESTIONS (Principal / Staff Level)

1. *Why does executing a microtask loop (e.g., recursive `Promise.resolve().then()`) completely freeze the browser UI and prevent user clicks from firing, whereas a recursive `setTimeout(..., 0)` loop does not?*
2. *In the V8 engine, what is the exact difference between a "Shallow Size" and a "Retained Size" in a Chrome Heap Snapshot, and which metric determines how much memory will be freed if a specific reference is severed?*
3. *How does modern Angular Signal reactivity batch DOM updates using the microtask queue, and how does this eliminate the historic "ExpressionChangedAfterItHasBeenCheckedError" associated with Zone.js lifecycle ticks?*
