# Module 33: Full-Stack Production Incidents

---

## 1. WHAT
Full-Stack Production Incidents are complex system failures that manifest exclusively when the Angular frontend, Nginx gateway, Spring Boot backend, and databases interact under real-world conditions (load, latency, caching, strict security, and clustered deployments). 

---

## 2. WHY
Locally, applications run in perfect isolation (JIT, `localhost`, single DB node). Production introduces asynchronous state, distributed networks, CDN caching, tree-shaking, and multi-tenant traffic. Mastering these 40 specific incidents is the difference between a mid-level developer and a Staff Engineer.

---

## 3. INTERNAL MENTAL MODEL
```text
[Browser/CDN] <--> [Nginx/API Gateway] <--> [Spring Boot Cluster] <--> [DB/Redis]
   (Cache/AOT)         (CORS/Timeouts)          (Concurrency/Auth)     (Deadlocks)
```

---

## 4. HOW IT WORKS
Incidents are diagnosed by aligning client telemetry (Sentry), edge logs (Nginx access), and backend traces (Datadog/MDC) using `X-Request-ID`.

---

## 5. MODERN IMPLEMENTATION
Modern resolution relies on structured logging, distributed tracing (OpenTelemetry), strict API versioning, and Blue/Green canary deployments.

---

## 6. LEGACY / ENTERPRISE REALITY
Legacy systems lack correlation IDs, making tracing a nightmare. They often suffer from "works on my machine" syndrome due to non-parity staging environments.

---

## 7. PRACTICAL EXAMPLE
An Angular `switchMap` bug colliding with a Spring Boot database lock, causing the wrong data to display exclusively under multi-user concurrency.

---

## 8. COMMON MISTAKES
- Fixing the frontend when the backend contract changed.
- Increasing timeouts instead of fixing slow queries.

---

## 9. LOCAL ISSUES
- Missing HTTPS/SSL locally hides Secure Cookie bugs.
- Single-instance Spring Boot hides clustering session issues.

---

## 10. CI/CD ISSUES
- Missing environment variables.
- CDN cache invalidation failures.

---

## 11. PRODUCTION ISSUES (40 INCIDENTS)

### GROUP 1: CONFIGURATION & NETWORK
**FS-PROD-001: Angular prod calls wrong API host**
- LOCAL: Calls localhost | CI: Calls staging | PROD: Calls localhost/staging | WHY: `environment.prod.ts` missing correct URL.
- EVIDENCE: Network tab shows 404 to wrong host.
- ROOT CAUSE: Hardcoded API URL / failed file replacement. | MITIGATION: Emergency hotfix to environment file. | FIX: Use relative paths `/api/` + Nginx routing. | PREVENTION: 12-factor config injection at runtime.

**FS-PROD-002: CORS works locally, prod domain not allowed**
- LOCAL: Webpack proxy handles CORS | PROD: Browser blocks | WHY: Spring Boot `@CrossOrigin` missing prod origin.
- EVIDENCE: Browser console: `CORS policy: No 'Access-Control-Allow-Origin'`.
- ROOT CAUSE: Prod domain omitted in backend config. | FIX: Add prod domain to Spring Boot CorsRegistry. | PREVENTION: Terraform managed CORS configs.

**FS-PROD-003: Auth header stripped by Nginx/gateway**
- LOCAL: Direct to Spring | PROD: 401 Unauthorized | WHY: Nginx drops headers with underscores (e.g. `auth_token`).
- EVIDENCE: Nginx logs show header missing.
- ROOT CAUSE: `underscores_in_headers off;`. | FIX: Use standard `Authorization: Bearer`. | PREVENTION: Stick to standard HTTP headers.

**FS-PROD-004: Cookie domain incorrect for prod subdomain**
- LOCAL: `localhost` | PROD: `api.site.com` setting cookie for `site.com` failing | WHY: Domain mismatch.
- EVIDENCE: Cookie not saved in Application tab.
- ROOT CAUSE: Spring Boot setting explicit wrong domain. | FIX: Set cookie domain to `.site.com`.

**FS-PROD-005: SameSite=Strict breaks cross-subdomain cookie**
- LOCAL: Works | PROD: Auth drops after redirect from external SSO | WHY: `SameSite=Strict` drops cookie on cross-site redirect.
- EVIDENCE: SSO redirects back, user is immediately logged out.
- ROOT CAUSE: Strict cookie. | FIX: `SameSite=Lax`.

**FS-PROD-006: Secure cookie not set (proxy doesn't forward HTTPS)**
- LOCAL: HTTP | PROD: HTTPS offloaded at Load Balancer | WHY: Spring Boot thinks request is HTTP, refuses to set `Secure` cookie.
- EVIDENCE: Set-Cookie ignored.
- ROOT CAUSE: Missing `X-Forwarded-Proto`. | FIX: Add proxy headers in LB and `server.forward-headers-strategy=framework` in Spring.

**FS-PROD-007: Mixed HTTP/HTTPS blocks requests**
- LOCAL: HTTP | PROD: HTTPS site calling HTTP API | WHY: Strict browser security.
- EVIDENCE: `Mixed Content` error in console.
- ROOT CAUSE: Absolute HTTP URL in API config. | FIX: Force HTTPS.

### GROUP 2: GATEWAY & TIMEOUTS
**FS-PROD-008: API Gateway different error format from Spring Boot**
- PROD BEHAVIOR: Angular interceptor crashes parsing error.
- ROOT CAUSE: Gateway returns `{"message": "Gateway Timeout"}` instead of Spring's `{"error": {"code": ...}}`. | FIX: Defensive parsing in interceptor.

**FS-PROD-009: Nginx 504 HTML page, Angular can't parse JSON**
- PROD BEHAVIOR: `Unexpected token < in JSON`.
- ROOT CAUSE: Nginx returns default HTML 504 page. | FIX: Configure Nginx to return JSON for API routes.

**FS-PROD-010: Load balancer timeout < Spring Boot processing**
- PROD BEHAVIOR: 504 Gateway Timeout exactly at 60s, but DB commits at 65s.
- ROOT CAUSE: LB times out before backend finishes. | FIX: Increase LB timeout or use async polling for slow tasks.

**FS-PROD-011: Angular timeout vs backend timeout mismatch**
- PROD BEHAVIOR: Angular shows timeout, user clicks again, backend executes twice.
- FIX: Align HTTP timeouts, use idempotency keys.

### GROUP 3: STATE & CONCURRENCY
**FS-PROD-012: Retry causes duplicate POST**
- ROOT CAUSE: Angular `retry(2)` on POST when network drops, but backend processed the first.
- FIX: Never retry non-idempotent verbs, or use Idempotency-Key header.

**FS-PROD-013: Double-click creates duplicate transaction**
- ROOT CAUSE: Submit button not disabled, no `exhaustMap`. | FIX: Use `exhaustMap` in NgRx/RxJS.

**FS-PROD-014: Backend succeeds but Angular times out**
- ROOT CAUSE: DB lock delays response, Angular cuts connection. Data is saved, user thinks it failed. | FIX: Transaction boundaries and WebSockets.

**FS-PROD-015: Optimistic update shows wrong state after conflict**
- ROOT CAUSE: Frontend assumes success, backend fails due to validation.
- FIX: Revert state locally on error.

**FS-PROD-016: Two users update same resource simultaneously**
- ROOT CAUSE: Lost update anomaly. | FIX: Spring Boot `@Version` (Optimistic Locking) + Angular `409 Conflict` handling.

### GROUP 4: CACHE & CONSISTENCY
**FS-PROD-017: Redis cache stale after backend update**
- ROOT CAUSE: Entity updated via direct SQL, Spring `@CacheEvict` didn't fire.
- FIX: TTL on cache + proper cache invalidation.

**FS-PROD-018: Frontend stale, no real-time update**
- ROOT CAUSE: Long-lived SPA session, data changed on backend.
- FIX: SSE (Server-Sent Events) or WebSocket to push invalidation.

### GROUP 5: DEPLOYMENTS & CONTRACTS
**FS-PROD-019: JSON contract breaks after Spring Boot deploy**
- ROOT CAUSE: Backend renamed field `userId` to `id`. Angular silently maps to `undefined`. | FIX: End-to-end contract testing (Pact).

**FS-PROD-020: New Angular expects API not yet deployed**
- ROOT CAUSE: Frontend deployed before backend. | FIX: Always deploy backend first (backward compatible).

**FS-PROD-021: Backend deployed first, breaks old Angular**
- ROOT CAUSE: Breaking API change. | FIX: API versioning (`/v1/`, `/v2/`).

**FS-PROD-022: CDN serves old Angular build**
- ROOT CAUSE: `index.html` cached heavily. | FIX: `Cache-Control: no-cache` for index.

**FS-PROD-023: Lazy chunk 404 after new deployment**
- ROOT CAUSE: User on old `index.html` requests `chunk-old.js`, which was deleted.
- FIX: Global error handler catches `ChunkLoadError` and calls `location.reload()`.

**FS-PROD-024: Chunk hash changes, wrong bundle**
- ROOT CAUSE: Non-deterministic builds. | FIX: Proper Webpack configuration.

**FS-PROD-025: Blue-green creates mixed version traffic**
- ROOT CAUSE: Session bouncing between old and new backend nodes.
- FIX: Session stickiness or stateless backward-compatible APIs.

### GROUP 6: DATA & LOAD
**FS-PROD-026: Production-only timezone bug**
- ROOT CAUSE: Local matches server. Prod server is UTC, user is PST.
- FIX: Always send ISO8601 UTC. Use Angular `DatePipe` for display.

**FS-PROD-027: Production DB returns unexpected nulls**
- ROOT CAUSE: Legacy bad data in Prod DB.
- FIX: Strict DTO validation and nullable types in Angular.

**FS-PROD-028: Large dataset freezes Angular rendering**
- ROOT CAUSE: Prod has 10,000 rows, local had 10. `ngFor` crashes DOM.
- FIX: Angular CDK Virtual Scrolling.

**FS-PROD-029: Slow API causes switchMap race condition**
- ROOT CAUSE: Search term "A" (takes 2s), term "AB" (takes 0.5s). `switchMap` handles it, but if using `mergeMap`, "A" overwrites "AB".
- FIX: Always use `switchMap` for read queries.

### GROUP 7: AUTH & TOKEN
**FS-PROD-030: Multiple 401 → multiple refresh → logout**
- ROOT CAUSE: 5 simultaneous API calls hit 401, all 5 try to refresh token, invalidating each other.
- FIX: Auth Interceptor must use a `BehaviorSubject` semaphore to pause requests while refreshing once.

**FS-PROD-031: Refresh loop — token accepted but request still 401**
- ROOT CAUSE: Backend and Gateway disagree on token signature. Infinite loop in interceptor.
- FIX: Limit refresh retry to exactly 1 attempt per request.

### GROUP 8: SSR & MEMORY
**FS-PROD-032: SSR renders user data into shared cache**
- ROOT CAUSE: Angular Universal injected a user-specific singleton, caching Private Data for all users.
- FIX: Never use global singletons for user state in SSR.

**FS-PROD-033: Hydration mismatch**
- ROOT CAUSE: Browser DOM != Server DOM (e.g. `window.innerWidth`).
- FIX: Wrap browser-only logic in `afterNextRender()`.

**FS-PROD-034: Application never stable (Zone.js pending)**
- ROOT CAUSE: `setInterval` running outside Angular SSR prevents application from stabilizing, timing out server.
- FIX: `runOutsideAngular()` for polling.

**FS-PROD-035: Bundle 3x larger than expected**
- ROOT CAUSE: Deep import (`import * from 'lodash'`) breaks tree shaking.
- FIX: Lint rules, `import { cloneDeep } from 'lodash-es'`.

**FS-PROD-036: Memory grows — subscription leak**
- ROOT CAUSE: `router.events.subscribe()` in a component without `takeUntilDestroyed()`.
- FIX: Use `async` pipe or `takeUntilDestroyed()`.

**FS-PROD-037: Memory grows — detached component in closure**
- ROOT CAUSE: Event listener referencing `this` preventing GC.
- FIX: Proper teardown in `ngOnDestroy`.

### GROUP 9: MISCELLANEOUS
**FS-PROD-038: Production-only minified error**
- ROOT CAUSE: AOT drops variables. | FIX: Upload source maps to Sentry.

**FS-PROD-039: Error only under real load (race condition)**
- ROOT CAUSE: `APP_INITIALIZER` finished but async service inside it wasn't awaited.
- FIX: Ensure Observables complete properly.

**FS-PROD-040: Circuit breaker 503, blank page**
- ROOT CAUSE: Backend Resilience4j trips, returns 503, frontend fails ungracefully.
- FIX: Global error handling showing "Service Degraded" UI.

---

## 12. FULL-STACK INTERACTION
Every incident highlights the hard truth: The API Contract is not just a JSON schema. It is Timeouts, Headers, Cookies, Status Codes, and Concurrency.

---

## 13. DEBUGGING PROCESS
1. Reproduce with `ng serve --configuration production`.
2. Trace `X-Request-ID` across Datadog and Sentry.
3. Check Nginx access logs for 499 (Client Closed Request) or 504.

---

## 14. ROOT CAUSE ANALYSIS
Systematic failure of environments to mirror production topology (Load Balancers, UTC servers, large datasets).

---

## 15. FIX
Implemented individually per incident (e.g., `exhaustMap`, Virtual Scroll, `SameSite=Lax`).

---

## 16. PREVENTION
- Contract Testing (Pact).
- Chaos Engineering.
- True staging environments.

---

## 17. MONITORING / OBSERVABILITY
- Sentry for JS errors.
- ELK/Datadog for backend structured logs.

---

## 18. PERFORMANCE CONSIDERATIONS
Virtual scrolling, caching, and debouncing.

---

## 19. SECURITY CONSIDERATIONS
Cookie flags, CORS boundaries, and RBAC token refresh logic.

---

## 20. TESTING STRATEGY
End-to-End tests against prod-like infrastructure (using Cypress with simulated network throttling).

---

## 21. EXERCISES
Replicate a 499 Nginx error locally using a timeout proxy.

---

## 22. BREAK-AND-FIX LAB
**ANG-PROD-030: Auth Refresh Loop**
Deliberately fire 5 simultaneous failing API calls. Watch the Auth Interceptor DDOS the backend. Fix using a `isRefreshing` semaphore and `BehaviorSubject`.

---

## 23. EXPERT QUESTIONS
1. Explain the mechanism of `ChunkLoadError` during blue-green deployments and your strategy for graceful recovery.
2. How do you guarantee idempotency for a POST request originating from a highly concurrent Angular UI?
3. Describe the memory forensics workflow to identify an Angular component leaking due to a detached DOM node.
