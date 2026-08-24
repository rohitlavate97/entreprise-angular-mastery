# Module 23: SSR, Hydration, and Rendering Strategies

## 1. WHAT
Server-Side Rendering (SSR) in Angular is the process of generating static HTML on a Node.js server before delivering it to the browser, which then "hydrates" the DOM to make it interactive, enabling improved SEO and faster perceived performance.

## 2. WHY
Modern enterprise applications face strict requirements for Time to First Byte (TTFB), First Contentful Paint (FCP), and Search Engine Optimization (SEO). Client-Side Rendering (CSR) leaves the user staring at a blank screen while massive JavaScript bundles download and execute. SSR provides immediate visible content, SSG allows infinite CDN caching, and modern hydration techniques bridge the gap between static HTML and dynamic interactivity without tearing down the DOM.

## 3. INTERNAL MENTAL MODEL

```text
[Node.js Server]                             [Browser]
      |                                          |
      |-- 1. HTTP GET /dashboard --------------->|
      |                                          |
      |<-- 2. Bootstrap Angular Server App ------|
      |                                          |
      |-- 3. Execute HTTP calls (to Spring) ---->|
      |                                          |
      |<-- 4. Inject TransferState Cache --------|
      |                                          |
      |-- 5. Render HTML string ---------------->| (FCP: User sees static UI)
      |                                          |
      |                                          |-- 6. Download main.js / polyfills
      |                                          |
      |                                          |-- 7. Hydrate DOM (Event Replay / Signals)
      |                                          |
      |                                          | (TTI: User can interact)
```

### Rendering Strategies

1. **CSR (Client-Side Rendering):** Fast subsequent navigations, but slow initial load. No SEO without headless browsers. Server cost: low. Caching: static assets only.
2. **SSR (Server-Side Rendering):** Fast FCP, SEO-friendly. TTI can be slightly delayed. High server cost (CPU intensive per request). Caching: Edge/CDN possible if stateless.
3. **SSG (Static Site Generation / Prerendering):** Extremely fast FCP, best for SEO. Server cost: zero at runtime. Caching: infinite (CDN). Drawback: Requires build-time data availability.
4. **Hybrid / Incremental:** Combining SSG for public pages and CSR/SSR for authenticated routes, using Event Replay to delay full hydration until user interaction.

## 4. HOW IT WORKS
1. The Express/Node server receives the HTTP request.
2. It instantiates the Angular `ApplicationRef` for the server platform.
3. The router resolves the matched route components.
4. Services execute (e.g., HTTP calls to Spring Boot), pausing render until `isStable` is reached (no pending macro-tasks).
5. Data is serialized into a `<script>` tag via `TransferState`.
6. The HTML string is serialized and sent to the client.
7. The browser renders the HTML immediately.
8. Angular boots on the client, reads the `TransferState` (avoiding a second HTTP call), matches the existing DOM nodes, attaches event listeners, and replays any captured events (Hydration).

## 5. MODERN IMPLEMENTATION
Angular 19+ natively supports SSR with incremental hydration and event replay.

```typescript
// app.config.server.ts
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering()
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

```typescript
// app.config.ts
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()), // Modern hydration
    // ...
  ]
};
```

Using TransferState to avoid duplicate API calls is largely automated via `provideHttpClient(withFetch())` in modern Angular, but can be managed manually:

```typescript
import { TransferState, makeStateKey, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';

const DATA_KEY = makeStateKey<string>('my-data');

export class MyService {
  private transferState = inject(TransferState);
  private platformId = inject(PLATFORM_ID);

  getData() {
    if (this.transferState.hasKey(DATA_KEY)) {
      return of(this.transferState.get(DATA_KEY, null)); // Client uses cache
    } else {
      return this.http.get('/api/data').pipe(
        tap(data => {
          if (isPlatformServer(this.platformId)) {
            this.transferState.set(DATA_KEY, data); // Server caches data
          }
        })
      );
    }
  }
}
```

## 6. LEGACY / ENTERPRISE REALITY
Historically (Angular 15 and earlier), developers used Angular Universal. Hydration was "destructive"—the server rendered the HTML, but when the client booted, it completely destroyed the DOM and recreated it, causing a visible flicker and losing form state. 
Legacy code heavily relies on `isPlatformBrowser` checks scattered throughout components.

## 7. PRACTICAL EXAMPLE
An enterprise dashboard serves thousands of concurrent users. The login page and marketing materials use SSG. The actual dashboard uses SSR to quickly load the user's widgets. When the SSR server calls the Spring Boot microservices, it uses a secure internal VPC network. The resulting data is injected via `TransferState`. The browser renders the dashboard instantly, and Event Replay ensures that if the user clicks a "Refresh" button before JavaScript is fully loaded, the event is captured and fired once the app hydrates.

## 8. COMMON MISTAKES
1. **Window/Document Access:** Accessing `window.localStorage` in a component constructor without `isPlatformBrowser` checks, crashing the Node server.
2. **Double Fetching:** Failing to use `TransferState`, resulting in the server calling the backend, and then the client calling the backend again immediately upon boot.
3. **Zone Stability Issues:** Using `setInterval` without `runOutsideAngular`, preventing the server from ever reaching a stable state to serialize HTML.

## 9. LOCAL ISSUES
- Hydration mismatches can be silent in production but log heavily in development mode.
- Local `npm run serve` (CSR) behaves differently than `npm run dev:ssr`.

## 10. CI/CD ISSUES
- Builds failing because third-party libraries (e.g., charting libraries) contain `window` references in their module scope, crashing the server build.

## 11. PRODUCTION ISSUES
- **Memory Leaks:** The Node.js server holding onto subscriptions or DOM elements because of poorly managed application lifecycles.
- **Node Server Crash:** One unhandled exception in an SSR route taking down the entire Express server, affecting all other users.

## 12. FULL-STACK INTERACTION
When the Angular SSR server requests data from Spring Boot, it acts as an HTTP client. It must forward authorization headers (e.g., cookies) from the incoming browser request to the backend. Spring Boot sees the request originating from the Node server's IP, not the user's IP, which requires `X-Forwarded-For` handling in Spring Security for audit logs.

## 13. DEBUGGING PROCESS
1. **Console:** Check for `Hydration mismatch` errors.
2. **Network Tab:** Disable JavaScript. Reload. Does the page render? If yes, SSR is working.
3. **View Source:** Look for `<script id="ng-state" type="application/json">`. Verify your data is serialized.
4. **Node Logs:** Check the server logs for `ReferenceError: window is not defined`.

## 14. ROOT CAUSE ANALYSIS
Hydration mismatches occur because Angular expects the DOM generated by the server to exactly match the DOM it generates on the client. If the server renders `<p>Time: 12:00</p>` (because it evaluated `Date.now()`), and the client evaluates `Date.now()` a second later resulting in `<p>Time: 12:01</p>`, Angular detects the discrepancy, throws a hydration error, and falls back to destructive rendering.

## 15. FIX
Move browser-only code (like `window.matchMedia` or dynamic timestamps) into the `afterNextRender` lifecycle hook, which guarantees execution only on the client.

```typescript
import { Component, afterNextRender } from '@angular/core';

@Component({ ... })
export class MyComponent {
  currentTime = 'Loading...';

  constructor() {
    afterNextRender(() => {
      // Guaranteed to run ONLY in the browser
      this.currentTime = new Date().toLocaleTimeString();
    });
  }
}
```

## 16. PREVENTION
- **eslint-plugin-angular:** Enforce rules against using `window` or `document` directly. Use Angular's `DOCUMENT` token instead.
- Use `afterNextRender` for all browser-specific initializations (e.g., Chart.js, D3).

## 17. MONITORING / OBSERVABILITY
- Monitor Node.js event loop lag and memory usage. SSR is CPU-heavy.
- Track FCP and TTI metrics via Google Lighthouse to ensure SSR is actually providing a performance benefit.

## 18. PERFORMANCE CONSIDERATIONS
SSR offloads rendering CPU cycles from the client to your servers. While this is great for low-end mobile devices, it requires significant auto-scaling capabilities on your Node.js infrastructure during traffic spikes. Caching the serialized HTML (via Redis or CDN) is critical for enterprise scale.

## 19. SECURITY CONSIDERATIONS
- **XSS via TransferState:** If user-generated content is blindly serialized into the TransferState JSON without sanitization, it can lead to XSS.
- **Shared State Leakage:** If a service provided in the root holds state (e.g., `userProfile`) and isn't cleaned up, User B's SSR request might render HTML containing User A's data due to Node's single-threaded nature.

## 20. TESTING STRATEGY
- **Unit:** Mock `PLATFORM_ID` to test component behavior in both server and browser modes.
- **E2E:** Playwright tests with JavaScript disabled to verify SSR structural integrity.

## 21. EXERCISES
1. Implement TransferState manually for a complex API call.
2. Refactor a legacy component using `isPlatformBrowser` into `afterNextRender`.

## 22. BREAK-AND-FIX LABS: SSR ISSUES

### SSR-001: Hydration mismatch
- **Break:** Render `Math.random()` directly in the template.
- **Fix:** Hydration mismatch because server and client generated different numbers. Move to `afterNextRender`.

### SSR-002: Browser-only API used during server render
- **Break:** Call `localStorage.getItem('theme')` in a constructor.
- **Fix:** Causes `ReferenceError: localStorage is not defined` on Node. Wrap in `isPlatformBrowser` or move to `afterNextRender`.

### SSR-003: Direct DOM manipulation breaks hydration
- **Break:** Use `document.getElementById('app').innerHTML = 'hello'`.
- **Fix:** Angular's internal node mapping is lost, breaking hydration. Use ViewChild and Renderer2.

### SSR-004: Third-party script modifies DOM before Angular hydrates
- **Break:** A synchronous ad-script injects a `<div>` into the app root before `main.js` loads.
- **Fix:** Use `ngSkipHydration` on the affected container or defer the script.

### SSR-005: Application never becomes stable
- **Break:** Create a `setInterval` in `ngOnInit`.
- **Fix:** Node server hangs waiting for the macro-task queue to clear. Wrap in `this.ngZone.runOutsideAngular()`.

### SSR-006: User-specific data rendered into shared server cache
- **Break:** Cache a user's private dashboard HTML at the CDN edge based purely on URL (`/dashboard`).
- **Fix:** SSR caching must incorporate the `Authorization` header or Session ID into the cache key.

### SSR-007: Transfer state not used — API called twice
- **Break:** Use `fetch()` without Angular's HttpClient.
- **Fix:** Network tab shows two identical API calls. Use `provideHttpClient(withFetch())` which automatically wires up TransferState.

### SSR-008: Server environment variable missing
- **Break:** Use `process.env.API_URL` which exists on the Node server but not in the browser.
- **Fix:** Inject environment variables explicitly into the Angular environment configuration during the server build process.

### SSR-009: Invalid HTML structure causes browser to restructure DOM
- **Break:** Put a `<div>` inside a `<p>` tag in the template.
- **Fix:** The browser automatically fixes this invalid HTML *before* Angular hydrates, causing a mismatch. Use valid HTML (`<span>` inside `<p>`).

### SSR-010: SSR crash on one route takes down entire Node.js server
- **Break:** Trigger an unhandled promise rejection in an SSR route.
- **Fix:** The Express server dies, 502 Bad Gateway for everyone. Ensure all async operations have robust `catchError` handlers.

## 23. EXPERT QUESTIONS
1. **In an SSR environment, how do you manage Angular's dependency injection to ensure request-scoped data (like cookies) doesn't leak between concurrent users on the Node server?**
   *Answer:* Angular creates a separate `ApplicationRef` and DI tree per incoming request on the server. As long as you do not store state in global/module-level variables and rely purely on DI (`@Injectable({providedIn: 'root'})` which is instanced per application, and thus per request on the server), state will not leak.
2. **Explain how Angular 19's Event Replay handles user interactions that occur *before* the application has fully hydrated.**
   *Answer:* A minimal inline script captures user events (clicks, inputs) at the document level. Once Angular completes hydration, it replays these captured events sequentially through the newly attached Angular event listeners, preventing "lost clicks."
3. **If your Spring Boot API is protected by a CSRF token stored in a cookie, how do you handle POST requests originating from the Angular SSR server during rendering?**
   *Answer:* The SSR server (Node) must extract the cookies from the incoming client request (via Express `req.cookies`) and forward them in the HTTP calls it makes to Spring Boot, including the CSRF token in the headers. However, state-changing operations (POST/PUT/DELETE) should generally be deferred to the client, keeping SSR focused on GET requests for initial view rendering.
