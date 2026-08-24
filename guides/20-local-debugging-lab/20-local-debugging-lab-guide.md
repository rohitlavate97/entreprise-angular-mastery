# Module 20: Local Debugging Lab — Systematic Diagnosis Methodology

---

## 1. WHAT
Local Debugging is the systematic discipline of utilizing browser developer tools, framework-specific extensions (Angular DevTools), and a structured hypothesis-driven methodology to observe, isolate, and resolve runtime failures, logical defects, and performance bottlenecks in the local development environment.

---

## 2. WHY
- **Speed to Resolution**: Haphazardly adding `console.log()` statements wastes time. A systematic methodology combined with DevTools mastery exponentially reduces the time it takes to find the root cause.
- **Architectural Understanding**: Debugging forces developers to confront the reality of how the framework operates under the hood (e.g., Change Detection, RxJS subscription lifecycles, HTTP interceptors).
- **Full-Stack Visibility**: When an enterprise application fails, the fault could lie in the UI, the frontend network layer, a CORS misconfiguration, a reverse proxy, or the Spring Boot backend. You must know how to inspect the boundaries.

---

## 3. INTERNAL MENTAL MODEL

### The Senior Engineer Debugging Methodology

```text
+===========================================================================================+
|                      SYSTEMATIC DIAGNOSIS METHODOLOGY                                     |
|                                                                                           |
|  1. OBSERVE      : What is the exact symptom? (Error message, frozen UI, blank screen)    |
|       │                                                                                   |
|  2. COLLECT      : Gather evidence (Stack trace, Network payload, DevTools state)         |
|       │                                                                                   |
|  3. HYPOTHESIZE  : Formulate 2-3 plausible causes (e.g., "CORS", "Cold Observable")       |
|       │                                                                                   |
|  4. ELIMINATE    : Use DevTools to quickly disprove hypotheses (e.g., Network 200 OK)     |
|       │                                                                                   |
|  5. REPRODUCE    : Can I trigger this 100% of the time? (Crucial for verifying fix)       |
|       │                                                                                   |
|  6. ROOT CAUSE   : Why did this happen? (Not just "it was null", but "why was it null?")  |
|       │                                                                                   |
|  7. FIX          : Implement the robust solution.                                         |
|       │                                                                                   |
|  8. VERIFY       : Test the fix locally.                                                  |
|       │                                                                                   |
|  9. PREVENT      : Add strict types, lint rules, or tests to prevent recurrence.          |
|      │                                                                                    |
| 10. MONITOR      : Add observability/logs if it was a production-surfaced issue.          |
|                                                                                           |
+===========================================================================================+
```

---

## 4. HOW IT WORKS

### Browser DevTools Deep Dive Workflow

1. **Console**: Check for unhandled exceptions. Filter by errors. Use `console.table(data)` for complex arrays and `console.group('Transaction')` to organize noisy logs.
2. **Network**: Inspect the timing waterfall. Check request headers (is the Bearer token present?) and response headers (CORS `Access-Control-Allow-Origin`). Verify the actual JSON payload, not just the status code.
3. **Sources**: Set breakpoints in the TypeScript code (via Source Maps). Use Conditional Breakpoints (e.g., `user.id === 42`) to avoid pausing on every loop iteration. Use Logpoints (`console.log` without altering code). Use the Watch panel to evaluate expressions in the current scope.
4. **Elements**: Inspect the DOM. Check if a node is present but hidden (`display: none` or `opacity: 0`). Examine event listeners attached to DOM nodes to see if Zone.js or a third party is intercepting clicks.
5. **Application**: Check `localStorage`, `sessionStorage`, and Cookies (ensure `HttpOnly` or `Secure` flags are set correctly).
6. **Performance**: Record a profile to analyze CPU bottlenecks (Long Tasks) and frame drops.
7. **Memory**: Take a Heap Snapshot. Perform an action. Take another. Compare them to find detached DOM nodes or un-garbage-collected `LView` instances.

---

## 5. MODERN IMPLEMENTATION

### Angular DevTools Mastery

Angular DevTools provides framework-aware inspection:
1. **Component Explorer**: View the component tree. Select a component to see its `@Input()`, `@Output()`, Signals, and injected services.
2. **Profiler**: Record a change detection session. Identify which components triggered the cycle, how long they took (`refreshView` duration), and the source of the trigger (e.g., `Timer` or `Event`).
3. **Injector Graph**: Visualize the dependency injection tree. Trace exactly where a service was provided (ElementInjector vs EnvironmentInjector) to solve `NullInjectorError` issues.

```typescript
// Modern debug helper: using Signals in DevTools
// In DevTools Component Explorer, you can see the value of a Signal.
// If you modify it in the console, Angular automatically triggers change detection!
const ng = window.ng; // Angular's global debugging object
const component = ng.getComponent(document.querySelector('app-transfer'));
component.amountSignal.set(5000); // UI updates instantly!
ng.applyChanges(component);       // Force CD if needed
```

---

## 6. LEGACY / ENTERPRISE REALITY

### Debugging Legacy Code
In older Angular applications (RxJS heavy, NgModules, Default CD):
- You will often rely on RxJS `tap(console.log)` inserted into massive observable pipelines.
- Source maps might be broken or inaccurate due to complex Webpack configurations. In these cases, debugging the generated JavaScript in the Sources tab is sometimes necessary.
- Finding the source of infinite loops is harder without Angular DevTools' modern Profiler.

---

## 7. PRACTICAL EXAMPLE

### Debugging an Enterprise Transfer that Silently Fails

**Symptom**: User clicks "Submit Transfer". The button spinner spins indefinitely. No error appears on the screen.

**Diagnosis Steps**:
1. **Observe**: UI is stuck in a loading state.
2. **Console**: Open DevTools Console. No red errors.
3. **Network**: Check Network tab. The `POST /api/v1/transfers` request returned a `200 OK`! The response JSON is `{ "status": "SUCCESS", "id": 12345 }`.
4. **Hypothesis**: The frontend received the success response but failed to process it or update the UI.
5. **Sources**: Set a breakpoint in the `TransferService.submit()` subscribe block.
6. **Eliminate**: Trigger the action again. The breakpoint hits the `next` block. The code does `this.loading = false`.
7. **Root Cause**: The component is using `ChangeDetectionStrategy.OnPush`. Modifying `this.loading = false` in a plain property inside an asynchronous HTTP callback does NOT mark the view dirty.
8. **Fix**: Change `this.loading` to a `signal` or call `this.cdr.markForCheck()`.

---

## 8. COMMON MISTAKES

1. **"Refresh Driven" Debugging**: Modifying code randomly and refreshing the page without forming a hypothesis. This is the slowest way to debug.
2. **Ignoring the Network Tab**: Blaming Angular for a data issue without verifying what the backend actually sent.
3. **Overusing console.log()**: Filling the codebase with `console.log('here')` instead of using Breakpoints or Logpoints in the DevTools Sources tab.
4. **Not Checking CORS Preflight**: A failed API call might show as "CORS error" in the console, but the real issue is often the `OPTIONS` preflight request failing because the backend isn't configured to accept the specific HTTP headers sent by the frontend.
5. **Ignoring Source Maps**: Debugging compiled `main.js` instead of the original TypeScript files.

---

## 9. LOCAL ISSUES

- **Symptom**: "Cannot read properties of undefined (reading 'length')" in a template.
- **Root Cause**: The component attempts to iterate over `items.length`, but `items` is loaded asynchronously and is initially `undefined`.
- **Fix**: Use the safe navigation operator (`items?.length`), `@if (items) { ... }`, or initialize the variable (`items = []`).

- **Symptom**: "UI not updating" when a Signal is updated.
- **Root Cause**: Setting a signal marks the view dirty and schedules a microtask for Change Detection. If the current executing block is running outside `NgZone` (e.g., third-party library callback), CD won't trigger automatically unless you re-enter the zone or manually trigger it.

---

## 10. CI/CD ISSUES

- **Symptom**: A test passes locally but fails intermittently in CI (flaky test).
- **Root Cause**: Timing issues. The local machine is fast, so an API mock returns instantly. CI is slower, exposing a race condition where the UI checks for an element before the asynchronous operation completes.
- **Fix**: Never use `setTimeout` to wait for DOM updates in tests. Use `fixture.whenStable()`, `flush()`, or Playwright's auto-waiting assertions.

---

## 11. PRODUCTION ISSUES

- **Symptom**: Minified stack traces in production (e.g., `TypeError: c.x is not a function at t.r (main.123.js:4)`).
- **Fix**: Never debug minified code directly if you can avoid it. Generate and securely store source maps (`.map` files) during the production build. Use Sentry or Datadog to ingest these source maps so production errors are automatically de-obfuscated into readable TypeScript stack traces.

---

## 12. FULL-STACK INTERACTION

### Tracing a Request from Angular to Spring Boot
When an API request fails, use the **Collect Evidence** phase across the stack:
1. **Frontend (Browser Network Tab)**: Did the request leave the browser? What were the exact headers and payload?
2. **Reverse Proxy (Nginx/Gateway)**: Check the Nginx `access.log`. Did it reach the server, or was it blocked by a WAF (403 Forbidden) or route misconfiguration (404 Not Found)?
3. **Backend (Spring Boot Logs)**: Did the request reach the Spring Controller? Was there an exception thrown during deserialization, security filter chain, or database access?

**Pro Tip**: Pass a Correlation ID (e.g., `X-Request-ID`) in the HTTP headers via an Angular Interceptor. If the request fails, you can search all backend microservices for that exact ID.

---

## 13. DEBUGGING PROCESS

### Debugging an Infinite Loop / Maximum Call Stack Size Exceeded
1. The browser tab freezes or the console spams `RangeError: Maximum call stack size exceeded`.
2. Hit the "Pause" button (`F8`) in the Sources tab to freeze execution.
3. Look at the Call Stack panel. You will see a repeating pattern of functions calling each other.
4. If it happens during Angular's `ApplicationRef.tick()`, it's usually a getter function in a template that mutates state, triggering another change detection cycle.
5. If using Signals, check if an `effect()` modifies a signal that it also reads, creating a feedback loop (though Angular 17+ throws a specific error for this).

---

## 14. ROOT CAUSE ANALYSIS

### Why "Cold Observables" Cause "API Not Called"
A common debugging scenario is an `HttpClient.get()` that never fires. You check the Network tab, and no request is made. No error is in the console.

**Root Cause**: `HttpClient` returns a "Cold" Observable. A cold observable is merely a *blueprint* for an action. It does absolutely nothing until a subscriber attaches to it via `.subscribe()`. If you map, filter, and pipe an observable but never subscribe (either explicitly in code or via the `async` pipe in the template), the network request is never initiated.

---

## 15. FIX

**Fixing the Cold Observable Issue**:

```typescript
// ❌ Broken: Creates the observable pipeline but never executes it
submit() {
  this.http.post('/api/save', this.data).pipe(
    tap(() => console.log('Saved!'))
  ); // Missing .subscribe()
}

// ✅ Fix 1: Explicit Subscription
submit() {
  this.http.post('/api/save', this.data).pipe(
    tap(() => console.log('Saved!'))
  ).subscribe(); // Now it executes
}

// ✅ Fix 2: Modern approach using rxResource or converting to Promise
async submit() {
  await firstValueFrom(this.http.post('/api/save', this.data));
  console.log('Saved!');
}
```

---

## 16. PREVENTION

1. **Strict TypeScript**: Enable `strictNullChecks` to prevent "Cannot read property of undefined" at compile time.
2. **Linter Rules**: Use ESLint rules like `rxjs/no-ignored-observable` to warn when an observable is created but not subscribed to or returned.
3. **No console.log in Commits**: Use Git hooks (husky) to reject commits containing `console.log`. Force the use of proper logging services or DevTools logpoints.

---

## 17. MONITORING / OBSERVABILITY

In local development, ensure your Angular application connects to local instances of your observability stack if possible, or print structured logs to the console that match production formats. Use Angular Interceptors to log all outgoing HTTP requests and their durations.

---

## 18. PERFORMANCE CONSIDERATIONS

Debugging itself has a performance cost:
- Leaving the DevTools "Elements" panel open forces the browser to do extra work tracking DOM changes.
- Setting many breakpoints or having the "Pause on caught exceptions" checked can make local execution feel incredibly slow.
- Taking Heap Snapshots temporarily freezes the browser tab.

---

## 19. SECURITY CONSIDERATIONS

When debugging locally, developers often disable security mechanisms (e.g., disabling Chrome Web Security to bypass CORS, or hardcoding admin tokens). 
**Danger**: Never commit these bypasses. Always use proper environment variables (`environment.development.ts`) and ensure local backend servers are configured to send permissive CORS headers for `localhost`, rather than disabling browser security.

---

## 20. TESTING STRATEGY

Debugging and testing are two sides of the same coin. When you fix a bug found via debugging, **always write a test to reproduce the exact failure scenario before committing**.
1. **Reproduce via Test**: Write a unit test that fails for the same reason the bug occurred.
2. **Apply Fix**: Implement the fix.
3. **Verify via Test**: Ensure the test now passes.

---

## 21. EXERCISES

1. **The Logpoint Challenge**: Find a loop in your codebase. Instead of adding `console.log`, use a DevTools Logpoint to print the loop index and a variable value without modifying the source file.
2. **Network Throttling**: Use the Network tab to throttle your connection to "Slow 3G". Observe how your application loads. Does the LCP degrade gracefully? Are loading spinners visible?
3. **Heap Snapshot**: Take a memory snapshot. Navigate through 5 different routes. Navigate back to the home route. Take another snapshot. Compare them and look for detached DOM nodes.

---

## 22. BREAK-AND-FIX LAB

**Issue**: `ANG-DEBUG-001` - Observable Never Fires
**Scenario**: The user clicks "Delete Profile". The function executes, but the profile remains, and no backend call is made.
**Diagnosis**:
1. Open Network tab. Click "Delete Profile". Notice no HTTP request is made.
2. Open Sources tab. Place a breakpoint inside the component's `delete()` method.
3. Step through the code. The `this.profileService.delete()` method is called and returns an Observable, but nothing else happens.
4. Notice that `.subscribe()` is missing on the returned Observable.
**Fix**:
Add `.subscribe({ next: () => this.router.navigate(['/home']) })` to execute the cold observable.

---

## 23. EXPERT QUESTIONS

1. **Staff/Principal Question:** "During local development, an API request fails with a CORS preflight error, but the exact same request succeeds when triggered via cURL or Postman. Explain the underlying browser mechanism causing this discrepancy and how to diagnose it using DevTools."
   *Answer Hint:* cURL and Postman are not browsers; they do not enforce the Same-Origin Policy and do not send `OPTIONS` preflight requests. The browser does this for cross-origin requests. DevTools Network tab will show the `OPTIONS` request failing. Diagnosis involves checking if the backend is configured to respond to `OPTIONS` with `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers`.

2. **Staff/Principal Question:** "You have a memory leak causing the browser tab to crash after an hour of use. Describe your exact methodology using Chrome DevTools Memory tab to isolate the component causing the leak."
   *Answer Hint:* Use the "Three Snapshot Technique". 1. Load the app, warm it up, take Snapshot 1. 2. Perform the suspect action (e.g., open and close a complex modal 10 times). 3. Take Snapshot 2. 4. Filter by "Objects allocated between Snapshot 1 and 2". 5. Look for detached DOM elements or Angular `LView` arrays that should have been garbage collected. Examine their retainer tree to find the subscription or global reference holding them in memory.

3. **Staff/Principal Question:** "Explain how to diagnose a 'UI not updating' issue when using `ChangeDetectionStrategy.OnPush` and RxJS streams, specifically utilizing Angular DevTools and the concept of execution contexts (Zones)."
   *Answer Hint:* Use Angular DevTools Profiler to record the interaction. If no CD cycle is recorded, the event happened outside the Angular Zone (e.g., raw DOM event or third-party callback). If a CD cycle is recorded but the component's `refreshView` is skipped, it means the component was not marked dirty. Check if the RxJS stream uses the `async` pipe (which automatically calls `markForCheck()`) or if manual subscription failed to update a Signal or call `cdr.markForCheck()`.
