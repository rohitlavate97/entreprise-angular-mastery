# Module 22: Production Debugging — Source Maps, Error Monitoring, and Telemetry

---

## 1. WHAT
Production Debugging is the systematic process of diagnosing, tracing, and resolving application failures in live environments where the source code is heavily minified, tree-shaken, and optimized, and where developers lack direct access to user browsers or server debuggers.

---

## 2. WHY
- **Code Transformation**: Angular production builds run through AOT compilation, Terser minification, and dead code elimination. A stack trace of `TypeError: Cannot read property 'b' of undefined at u.e(main.8f3a.js:1)` is useless without deobfuscation.
- **Distributed Complexity**: A single user action might span an Angular frontend, an Nginx reverse proxy, a Spring Boot backend, and a database. Without distributed tracing and Correlation IDs, pinpointing the failure point is impossible.
- **Blind Spots**: Users rarely report non-blocking errors. Silent failures require proactive telemetry (Sentry, Datadog) to alert the engineering team before revenue or reputation is lost.
- **Security & Scale**: Real production environments introduce CDN caching, multi-node load balancing, and strict CORS/CSP policies that cannot be perfectly replicated locally.

---

## 3. INTERNAL MENTAL MODEL

### Production Observability & Deobfuscation Pipeline

```
+===========================================================================================+
|                      PRODUCTION ERROR TRACING & DEOBFUSCATION                             |
|                                                                                           |
|  ┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐ |
|  │   CI/CD PIPELINE     │        │    USER BROWSER      │        │  ERROR MONITORING    │ |
|  │                      │        │                      │        │      (Sentry)        │ |
|  │ 1. ng build --source-│        │ 3. Error Occurs      │        │                      │ |
|  │    map               │        │    (Minified Stack)  │        │                      │ |
|  │                      │        │                      │        │                      │ |
|  │ 2. Upload .map files │        │ 4. ErrorHandler      │        │ 5. Map minified      │ |
|  │    to Sentry         ├───────►│    captures error    ├───────►│    trace to original │ |
|  │                      │        │    + Breadcrumbs     │        │    TypeScript code   │ |
|  │    (Do NOT deploy    │        │    + Release ID      │        │                      │ |
|  │     .map to CDN)     │        │                      │        │ 6. Alert Engineers   │ |
|  └──────────────────────┘        └──────────┬───────────┘        └──────────────────────┘ |
|                                             │                                             |
|                                             │ (HTTP Request with X-Request-ID)            |
|                                             ▼                                             |
|  ┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐ |
|  │    NGINX PROXY       │        │ SPRING BOOT BACKEND  │        │    LOG AGGREGATOR    │ |
|  │                      │        │                      │        │    (ELK/Datadog)     │ |
|  │ 7. Logs access with  │        │ 8. Filter sets MDC   │        │ 9. Query logs using  │ |
|  │    X-Request-ID      ├───────►│    (X-Request-ID)    ├───────►│    X-Request-ID to   │ |
|  │                      │        │                      │        │    trace the entire  │ |
|  │                      │        │ 9. Logs contain ID   │        │    lifecycle.        │ |
|  └──────────────────────┘        └──────────────────────┘        └──────────────────────┘ |
+===========================================================================================+
```

---

## 4. HOW IT WORKS
1. **Build Time**: The Angular CLI builds the app with source maps enabled (`--source-map`). A script extracts these `.map` files, associates them with a specific Release ID, and uploads them securely to an error monitoring tool (like Sentry). The `.map` files are **omitted** from the final deployment payload to prevent source code leakage.
2. **Runtime Error**: A JavaScript error occurs in the user's browser.
3. **Capture & Decorate**: Angular's global `ErrorHandler` catches the unhandled exception. It attaches the current route, recent HTTP requests (breadcrumbs), the active Release ID, and the `X-Request-ID` of the last transaction.
4. **Transmission**: The payload is sent to Sentry.
5. **Deobfuscation**: Sentry uses the Release ID to find the uploaded `.map` files, mapping the minified stack trace (`main.js:2:451`) back to the exact TypeScript line (`transfer.service.ts:42`).
6. **Backend Correlation**: If the error was caused by a failed HTTP request, the frontend sends an `X-Request-ID` header. Spring Boot's MDC (Mapped Diagnostic Context) captures this ID and injects it into every backend log line, allowing engineers to query the exact backend state that caused the frontend failure.

---

## 5. MODERN IMPLEMENTATION

### Angular: Sentry Integration and Correlation IDs

```typescript
// app.config.ts - Setting up ErrorHandler and Interceptors
import { ApplicationConfig, ErrorHandler, importProvidersFrom } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import * as Sentry from '@sentry/angular';
import { v4 as uuidv4 } from 'uuid';

Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  environment: 'production',
  release: 'my-project@1.5.0', // Must match CI/CD upload
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1, // Sample 10% of transactions for performance
  replaysSessionSampleRate: 0.01, // Sample 1% of sessions for replay
  replaysOnErrorSampleRate: 1.0, // Always replay if error occurs
});

// Interceptor to add Correlation ID to all requests
export const correlationIdInterceptor = (req, next) => {
  const reqId = uuidv4();
  const cloned = req.clone({
    setHeaders: { 'X-Request-ID': reqId }
  });
  // Add as Sentry breadcrumb
  Sentry.addBreadcrumb({
    category: 'http',
    message: `${req.method} ${req.url} - ID: ${reqId}`,
    level: 'info'
  });
  return next(cloned);
};

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler({ showDialog: false }) },
    provideHttpClient(withInterceptors([correlationIdInterceptor]))
  ]
};
```

### Spring Boot: MDC Structured Logging

```java
// CorrelationFilter.java
@Component
public class CorrelationFilter extends OncePerRequestFilter {
    private static final String CORRELATION_ID_HEADER = "X-Request-ID";
    private static final String CORRELATION_ID_LOG_VAR = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String correlationId = request.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null) {
            correlationId = UUID.randomUUID().toString();
        }
        
        // Add to MDC for logging
        MDC.put(CORRELATION_ID_LOG_VAR, correlationId);
        // Return in response for frontend tracking
        response.setHeader(CORRELATION_ID_HEADER, correlationId);
        
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(CORRELATION_ID_LOG_VAR);
        }
    }
}
```

---

## 6. LEGACY / ENTERPRISE REALITY
- **No Source Maps**: Many legacy apps deploy without generating or uploading source maps, forcing developers to debug using purely minified code or by attempting to replicate the state locally.
- **Scattered Logs**: Without ELK/Datadog and MDC, backend logs are text files grepped on individual servers via SSH, making it near impossible to trace a request across microservices.
- **`console.error` Dependency**: Relying on users taking screenshots of the browser console instead of automated telemetry.

---

## 7. PRACTICAL EXAMPLE
**Scenario**: Users report they cannot approve a transfer in production.
**Investigation Workflow**:
1. **Sentry Alert**: Sentry captures `TypeError: Cannot read properties of undefined (reading 'amount')` in `TransferComponent`.
2. **Deobfuscation**: Because source maps were uploaded during CI, Sentry shows the exact line: `const total = this.transferConfig.details.amount;`.
3. **Breadcrumbs**: Sentry shows the user clicked "Approve", then an HTTP GET to `/api/transfers/config` returned a 200, followed by the error.
4. **Backend Tracing**: The breadcrumb shows `X-Request-ID: abc-123`.
5. **Kibana/Datadog Search**: Querying `correlationId:"abc-123"` in backend logs reveals that the database returned a null config object for that specific transfer type, causing the Spring Boot controller to return `{ "details": null }`.
6. **Resolution**: The frontend assumed `details` was always present. The fix requires handling the null case in Angular and investigating the backend data anomaly.

---

## 8. COMMON MISTAKES
1. **Exposing Source Maps to the Public**: Deploying `.map` files to the CDN allows anyone to read the original source code, exposing proprietary business logic and potential security flaws.
2. **Ignoring Sentry Noise**: Failing to group/ignore known non-actionable errors (like AdBlocker interference or network timeouts) leads to alert fatigue, causing teams to ignore real critical alerts.
3. **Missing Correlation IDs**: Sending HTTP requests without generating a trace ID, making it impossible to connect a frontend exception to the backend logs.
4. **Logging PII in Breadcrumbs**: Accidentally logging user passwords, SSNs, or tokens in Sentry breadcrumbs or Datadog logs.

---

## 9. LOCAL ISSUES
- **Symptom**: A bug happens in production but never locally, even with identical data.
- **Root Cause**: The local environment runs in JIT mode (development) while production runs in AOT mode. 
- **Diagnosis**: Run the app locally using production configuration: `ng serve --configuration production`. This enables AOT, minification, and environment variable swaps.

---

## 10. CI/CD ISSUES
- **Symptom**: Sentry alerts show minified code instead of TypeScript.
- **Root Cause**: The CI pipeline built the app, uploaded source maps, but the `release` version configured in `Sentry.init` inside the Angular app does not match the version used during the `sentry-cli releases files` upload.
- **Fix**: Inject the release ID (e.g., git commit hash) into the Angular build via `environment.prod.ts` replacement during CI.

---

## 11. PRODUCTION ISSUES
- **Tree-Shaking Dropped Code**: 
  - **Symptom**: A dynamically injected service throws a "No provider for X" error in production.
  - **Root Cause**: If a service is never explicitly referenced in static code (e.g., loaded via a string identifier), Angular's build optimizer may tree-shake it out of the bundle.
- **Stale CDN Cache**:
  - **Symptom**: Users see a white screen after a new deployment. `ChunkLoadError` in Sentry.
  - **Root Cause**: The `index.html` was cached by the browser/CDN, pointing to old `main.xyz.js` chunks that were deleted from the server during deployment.

---

## 12. FULL-STACK INTERACTION

### The Telemetry Contract
When diagnosing full-stack issues, the contract relies on HTTP Headers:
1. **Angular (Client)** generates `X-Request-ID` and sends it.
2. **Nginx (Proxy)** logs `X-Request-ID` in `access.log`.
3. **Spring Boot (API)** reads `X-Request-ID`, adds it to SLF4J MDC.
4. **Spring Boot (Downstream)** forwards `X-Request-ID` if it calls other microservices via `RestTemplate`/`WebClient`.
5. **Database (RDBMS)**: Advanced setups may include the ID as a SQL comment `/* req_id: abc */` to correlate slow queries.

---

## 13. DEBUGGING PROCESS
**Senior Engineer Workflow for a Production Bug Report:**
1. **Gather Context**: Check Sentry for the reported time window and user ID.
2. **Review User Session**: Watch the Sentry Session Replay (if enabled) to see the DOM state right before the error.
3. **Extract Correlation ID**: Find the `X-Request-ID` of the failed API call in the Sentry breadcrumbs.
4. **Query Log Aggregator**: Search Kibana/Datadog for the Correlation ID. Review Nginx logs (did it reach the server?) and Spring Boot logs (did the DB throw an exception?).
5. **Reproduce Locally**: Branch off the exact release tag. If data-dependent, dump an anonymized subset of the prod DB locally. Run `ng serve --configuration production`.

---

## 14. ROOT CAUSE ANALYSIS
### Why AOT Differs from JIT
In development (JIT), Angular compiles templates in the browser. If a template binds to a private component property (`<div *ngIf="isReady">`), JIT might allow it. In production (AOT), the compiler strictly enforces TypeScript access modifiers. The build will fail, but if bypassed or misconfigured, it results in silent runtime failures.

### Why Tree-Shaking Breaks Dynamic Imports
Webpack/Esbuild static analysis traverses `import` statements. If you dynamically resolve a component class name based on backend data (`const comp = resolve(data.type)`), the bundler doesn't know which classes to keep. It removes them to save bundle size, causing runtime crashes.

---

## 15. FIX
- **Fixing Tree-Shaken Services**: Ensure dynamically loaded services/components are explicitly imported or provided in routes, or avoid string-based resolution.
- **Fixing Stale Cache (`ChunkLoadError`)**: 
  1. Configure Nginx/S3 to set `Cache-Control: no-cache` for `index.html`.
  2. In Angular, catch `ChunkLoadError` in a global error handler and force a `window.location.reload()` to fetch the new `index.html`.

---

## 16. PREVENTION
1. **Production Parity**: Maintain a Staging environment that mirrors Production infrastructure identically (Load balancers, CDN, AOT builds, minification).
2. **Canary Deployments**: Route 5% of traffic to the new deployment. Monitor Sentry for error rate spikes. If errors exceed a threshold, automatically rollback.
3. **Automated Source Map Upload**: Fail the CI build if the `sentry-cli` upload command fails, ensuring no release goes out without source maps.

---

## 17. MONITORING / OBSERVABILITY
- **Real User Monitoring (RUM)**: Tools like Datadog RUM or Sentry track core web vitals (LCP, FID, CLS) from actual user browsers.
- **Alerting Thresholds**: Alert on a spike in Error Rate (e.g., > 1% of sessions in 5 minutes). Do NOT alert on every single error, as it causes fatigue.
- **Apdex Score**: Monitor the Apdex (Application Performance Index) to gauge overall user satisfaction based on response times and error rates.

---

## 18. PERFORMANCE CONSIDERATIONS
- **Session Replay Overhead**: Recording the DOM for Session Replays (like LogRocket or Sentry Replay) consumes browser CPU and network bandwidth. Configure low sample rates (e.g., 1%) and only record on error (`replaysOnErrorSampleRate: 1.0`).
- **Telemetry Payload Size**: Ensure telemetry beacons are batched and sent via `navigator.sendBeacon()` so they don't block the main thread or delay page unloading.

---

## 19. SECURITY CONSIDERATIONS
- **PII Scrubbing**: Ensure the `ErrorHandler` scrubs Personally Identifiable Information (passwords, credit cards, auth tokens) from URLs, bodies, and breadcrumbs BEFORE sending to Sentry.
- **Source Map Protection**: Never host `.map` files on publicly accessible URLs. Upload them directly to the error tracking service using internal CI tokens.
- **Data Residency**: Ensure error monitoring services comply with GDPR/HIPAA by storing data in appropriate regions and not capturing sensitive DOM elements (masking inputs).

---

## 20. TESTING STRATEGY
- **End-to-End Testing on Prod Builds**: Run Cypress/Playwright tests against the `ng build --configuration production` output to catch AOT/minification issues before deployment.
- **Chaos Engineering**: Deliberately inject network latency and HTTP 500 errors into the staging environment to verify that the `ErrorHandler` captures them correctly.

---

## 21. EXERCISES
1. Configure an Angular `HttpInterceptor` to generate and append an `X-Request-ID`.
2. Configure Spring Boot to read `X-Request-ID` and output it in JSON structured logs using Logback.
3. Introduce a deliberate `TypeError` in an Angular component, run a production build, and manually map the minified line number back to the source code using the generated `.map` file.

---

## 22. BREAK-AND-FIX LAB
**Defect ANG-PROD-DEBUG-001**: Production error from tree-shaken code path.
- **Scenario**: A dynamically loaded feature module uses a generic factory pattern to instantiate services based on a string payload from the backend.
- **Reproduction**: Works perfectly in `ng serve`. In production, the app crashes with `NullInjectorError: No provider for X`.
- **Diagnosis**: The optimizer tree-shook the service because it wasn't statically imported anywhere.
- **Fix**: Use `@Injectable({ providedIn: 'root' })` to ensure the service is globally available, or explicitly declare the services in a `providers` array in the routing configuration to prevent dead-code elimination.

---

## 23. EXPERT QUESTIONS
1. **Question**: Explain the mechanical difference between how JIT and AOT compilation handle template bindings to component properties, and why a specific binding might work in development but crash the build in production.
2. **Question**: Describe an architecture to safely capture and transmit frontend errors (including Source Map resolution) in an enterprise environment completely isolated from the public internet (air-gapped).
3. **Question**: How would you design a distributed tracing strategy to diagnose a performance bottleneck where a user click takes 5 seconds to resolve, spanning an Angular app, a reverse proxy, a Spring Boot gateway, two backend microservices, and a PostgreSQL database?
