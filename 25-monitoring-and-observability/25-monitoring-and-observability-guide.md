# Module 25: Monitoring and Observability — Bridging the Frontend-Backend Divide

---

## 1. WHAT
Monitoring and Observability form the socio-technical nervous system of an enterprise application. It encompasses distributed tracing (Correlation IDs), structured JSON logging, real user monitoring (RUM), and exception tracking, allowing engineering teams to proactively detect, diagnose, and resolve production failures across the entire Angular + Spring Boot stack without relying on user bug reports.

## 2. WHY
- **The Microservices Void**: When a frontend request fails in a distributed system, without a unified trace ID, correlating the Angular UI error to the specific Spring Boot failure (and underlying DB timeout) is like finding a needle in a haystack.
- **Silent Failures**: Users rarely report non-blocking JavaScript errors or degraded performance. Observability tools capture these silent failures automatically.
- **Mean Time To Resolution (MTTR)**: High-performing teams rely on full-stack observability to reduce debugging time from hours (grep'ing raw logs) to seconds (clicking a Trace ID link in Sentry that jumps to Datadog).
- **Proactive SLA Management**: Monitoring Core Web Vitals (INP, LCP) and backend p99 latency ensures the application meets performance Service Level Agreements before customer churn occurs.

## 3. INTERNAL MENTAL MODEL
### The Correlation ID Lifecycle Graph

```text
+===========================================================================================+
|                      FULL-STACK DISTRIBUTED TRACING WORKFLOW                              |
|                                                                                           |
|  [ 1. ANGULAR (Frontend) ]                                                                |
|   - HTTP Request initiated.                                                               |
|   - HttpInterceptor generates UUID: 123e4567-e89b-12d3...                                 |
|   - Appends header: `X-Request-ID: 123e4567-...`                                          |
|            │                                                                              |
|            ▼ (Network)                                                                    |
|  [ 2. NGINX / API GATEWAY ]                                                               |
|   - Intercepts request. Logs access.                                                      |
|   - configuration: `proxy_pass_header X-Request-ID;`                                      |
|            │                                                                              |
|            ▼ (Network)                                                                    |
|  [ 3. SPRING BOOT (Backend) ]                                                             |
|   - OncePerRequestFilter extracts `X-Request-ID`.                                         |
|   - Injects into MDC (Mapped Diagnostic Context).                                         |
|   - All logs for this thread now include: `{"reqId": "123e4567..."}`                      |
|   - Error occurs! Exception thrown.                                                       |
|            │                                                                              |
|            ▼ (HTTP 500 Response)                                                          |
|  [ 4. RESPONSE TO BROWSER ]                                                               |
|   - Payload: `{ "error": "System failure", "traceId": "123e4567..." }`                    |
|            │                                                                              |
|            ▼                                                                              |
|  [ 5. ERROR MONITORING (Sentry/Datadog) ]                                                 |
|   - Angular Global ErrorHandler catches HTTP 500.                                         |
|   - Logs to Sentry with tag: `reqId: 123e4567...`                                         |
|            │                                                                              |
|            ▼                                                                              |
|  [ 6. TRIAGE (The Engineer) ]                                                             |
|   - Searches Datadog/ELK for `123e4567...`                                                |
|   - Instantly sees the precise Java stack trace that caused the UI error.                 |
+===========================================================================================+
```

## 4. HOW IT WORKS
1. **Frontend Instrumentation**: An Angular `HttpInterceptor` attaches trace IDs to outgoing requests. An `ErrorHandler` intercepts uncaught exceptions and sends them (with context) to an error tracking service.
2. **Backend Context**: Spring Boot uses a Filter to read the trace ID and places it in the SLF4J MDC (Mapped Diagnostic Context), tying it to the local thread.
3. **Structured Logging**: Spring Boot writes logs as JSON (via Logback/Log4j2). The log aggregator (ELK, Datadog) indexes these fields.
4. **Source Mapping**: The CI/CD pipeline builds the Angular app, uploads source maps to the error tracker, and deletes them from the public build. When errors occur, the tracker reconstructs the TypeScript stack trace.
5. **Performance Telemetry**: The `web-vitals` library collects metrics via `PerformanceObserver` and beacons them to an analytics endpoint.

## 5. MODERN IMPLEMENTATION
### 5A. Angular Correlation Interceptor

```typescript
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';

export const correlationInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  // Generate a random UUID v4 for tracing
  const requestId = crypto.randomUUID();
  
  // Clone request and add headers
  const modifiedReq = req.clone({
    setHeaders: {
      'X-Request-ID': requestId,
      'traceparent': generateW3CTraceContext(requestId) // Optional W3C standard
    }
  });

  return next(modifiedReq);
};
```

### 5B. Spring Boot MDC Filter

```java
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
public class CorrelationIdFilter implements Filter {
    private static final String CORRELATION_ID_HEADER = "X-Request-ID";
    private static final String MDC_KEY = "reqId";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String correlationId = httpRequest.getHeader(CORRELATION_ID_HEADER);

        if (correlationId != null) {
            MDC.put(MDC_KEY, correlationId);
        }

        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY); // CRITICAL: Prevent memory leaks / thread pollution
        }
    }
}
```

## 6. LEGACY / ENTERPRISE REALITY
| Legacy Pattern | Modern Pattern | Migration Strategy |
|---|---|---|
| Unstructured text logs (`log.info("User {} login", id)`) | JSON Structured Logging (`log.info(json)`) | Replace Logback encoder with `LogstashTcpSocketAppender` or JSON formatter. |
| Asking users to refresh on error | Global `ErrorHandler` → Sentry | Implement `ErrorHandler` to catch, log context, and show user-friendly fallback. |
| Relying on Nginx access logs for metrics | Real User Monitoring (RUM) & Web Vitals | Integrate `web-vitals` library and report actual client-side latency. |
| Raw stack traces in production bundles | Source Maps uploaded to CI | Configure Angular build: `"sourceMap": {"scripts": true, "hidden": true}`. |

## 7. PRACTICAL EXAMPLE
**Enterprise Banking: Tracking a Failed Transfer**

A user attempts a $5,000 transfer, but it fails due to a downstream banking API timeout.
1. Angular generates `X-Request-ID: 8a7b6c5d`.
2. The UI shows: "Transfer failed. Reference: 8a7b6c5d".
3. Angular's `ErrorHandler` logs to Sentry, including Redux/Signal state (e.g., `{amount: 5000, from: 'CHECKING'}`).
4. Support receives a call. They paste `8a7b6c5d` into Datadog.
5. Datadog instantly correlates the UI error with the Spring Boot error log: `[reqId: 8a7b6c5d] java.net.SocketTimeoutException: Read timed out at WireTransferClient`.
6. Issue is triaged to the 3rd-party integration team in 2 minutes.

## 8. COMMON MISTAKES
1. **Thread Pollution in Spring Boot**: Failing to clear the MDC in a `finally` block. Because Tomcat reuses threads, subsequent requests on that thread will inherit the previous user's Correlation ID, destroying traceability.
2. **Exposing Source Maps**: Deploying `.map` files to the public internet, allowing anyone to reverse-engineer the unminified, commented source code.
3. **Logging PII**: Accidentally logging passwords, SSNs, or auth tokens in MDC or structured logs. Logs must be heavily sanitized.
4. **Ignoring Breadcrumbs**: Catching an error in Angular but failing to provide the preceding user actions (clicks, router navigations) that led to it.
5. **Alert Fatigue**: Paging on-call engineers for every JavaScript TypeError. Alerts should trigger on *rates* (e.g., >5% error rate over 5 minutes), not individual occurrences.

## 9. LOCAL ISSUES
- **Symptom**: Sentry/Datadog SDKs crash or flood local development environment.
- **Root Cause**: Observability SDKs initialized in local mode without proper disabled flags.
- **Fix**: Use environment variables to conditionally initialize heavy SDKs.
  ```typescript
  if (environment.production) {
    Sentry.init({ dsn: environment.sentryDsn });
  }
  ```

## 10. CI/CD ISSUES
- **Symptom**: Unreadable minified stack traces in production (e.g., `Error at a.b (main.js:1:2345)`).
- **Root Cause**: Source maps were not generated, or not uploaded to the error tracking service during the build phase.
- **Fix**: Ensure `ng build --source-map` is used. Use the Sentry CLI in the CI pipeline to upload the maps, associating them with the Git commit hash (Release tracking), then delete them before deploying to the CDN.

## 11. PRODUCTION ISSUES
- **Symptom**: Correlation IDs are missing from backend logs.
- **Root Cause**: An intermediary proxy (Nginx, AWS ALB, Istio) stripped unknown HTTP headers, dropping `X-Request-ID`.
- **Fix**: Configure proxies to explicitly pass through custom tracing headers, or adopt the W3C `traceparent` standard which is universally recognized.

## 12. FULL-STACK INTERACTION
**Metrics and Alerting Matrix**

| Layer | Metric | Threshold / Alert Condition | Impact |
|---|---|---|---|
| **Frontend** | LCP (Largest Contentful Paint) | p75 > 2.5 seconds | User perceived slowness; SEO penalty. |
| **Frontend** | JS Error Rate | > 1% of sessions | Feature breakage. |
| **Network** | 5xx Rate | > 0.5% over 5 mins | Backend node crash or downstream failure. |
| **Backend** | API Latency (p99) | > 1000ms | Poor UX, potential connection pool exhaustion. |
| **Database** | Connection Pool Wait | > 50ms | Thread starvation in Spring Boot. |

## 13. DEBUGGING PROCESS
**Scenario: Resolving a Spiky "INP (Interaction to Next Paint)" Metric**

1. **Detect**: Alert triggers: "P75 INP exceeded 200ms on the /dashboard route".
2. **Observe**: Open the RUM (Real User Monitoring) dashboard. Filter by route. Notice that INP spikes specifically on devices with low CPU cores.
3. **Analyze Frontend**: Use Chrome DevTools Performance Profiler with CPU Throttling (4x slowdown). Click the primary action on the dashboard.
4. **Identify**: A long task (>50ms) blocks the main thread. A massive array `.filter().sort()` operation is running on the UI thread when data arrives.
5. **Verify**: Check the RUM tool's breadcrumbs. It confirms the issue happens exactly when the WebSocket pushes large payloads.

## 14. ROOT CAUSE ANALYSIS
**Why do Correlation IDs fail in reactive programming?**
In traditional Spring MVC, a request is tied to a single thread, so `ThreadLocal` variables (which power MDC) work perfectly. If you migrate to Spring WebFlux (Project Reactor), execution jumps between threads. The MDC loses context instantly. To trace reactive pipelines, you must use Micrometer Tracing (formerly Spring Cloud Sleuth) with Context Propagation, which explicitly passes the trace context across thread boundaries.

## 15. FIX
**Implementing Web Vitals Telemetry:**
```typescript
import { onLCP, onINP, onCLS } from 'web-vitals';
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class WebVitalsService {
  private http = inject(HttpClient);

  init() {
    const sendToAnalytics = (metric: any) => {
      const body = {
        name: metric.name,
        value: metric.value,
        id: metric.id,
        path: window.location.pathname
      };
      // Use navigator.sendBeacon for reliable delivery during page unload
      navigator.sendBeacon('/api/telemetry/vitals', JSON.stringify(body));
    };

    onLCP(sendToAnalytics);
    onINP(sendToAnalytics);
    onCLS(sendToAnalytics);
  }
}
```

## 16. PREVENTION
- **W3C Trace Context**: Adopt standard `traceparent` and `tracestate` headers instead of custom `X-Request-ID` to ensure compatibility across all cloud providers and APM tools.
- **Log Masking**: Configure Logback to automatically mask PII.
  ```xml
  <replace>
      <pattern>${msg}</pattern>
      <regex>(password" ?: ?")[^"]+(")</regex>
      <replacement>$1***$2</replacement>
  </replace>
  ```
- **Global Error Handling**: Ensure every Angular app defines an `ErrorHandler` provider that forwards to the APM.

## 17. MONITORING / OBSERVABILITY
- **Synthetic Monitoring**: Configure Playwright scripts to run every 5 minutes in production against critical flows (e.g., login, checkout). If a synthetic transaction fails, immediately page the team via PagerDuty, *before* actual users experience the outage.
- **Health Checks**: Expose an `/api/actuator/health` endpoint on Spring Boot, and potentially a `/health` static route on the Angular CDN, checked by external monitors (Pingdom, Route53).

## 18. PERFORMANCE CONSIDERATIONS
- **RUM Overhead**: Excessive performance telemetry logging can ironically hurt performance. Batch analytics payloads and send them via `navigator.sendBeacon()`.
- **Sampling Rates**: In high-traffic systems, logging 100% of traces generates massive costs. Implement a sampling strategy (e.g., trace 10% of successful requests, but 100% of failed requests using tail-based sampling).

## 19. SECURITY CONSIDERATIONS
- **Error Responses**: Spring Boot must never return internal stack traces in HTTP responses (disable `server.error.include-stacktrace=never`). It should return the Correlation ID, requiring support to look up the secure logs.
- **Content Security Policy (CSP)**: If using external error trackers like Sentry, the CDN domains must be explicitly allowed in the `connect-src` CSP directive, or the browser will block the telemetry requests.

## 20. TESTING STRATEGY
- **Unit Testing MDC**: Write JUnit tests for the Filter to ensure `MDC.get()` returns the correct header value and `MDC.remove()` runs.
- **E2E Observability**: In E2E tests, assert that API requests sent by the browser contain the correct tracing headers.

## 21. EXERCISES
1. Implement an Angular `HttpInterceptor` that generates a UUID and appends an `X-Correlation-ID` header to all API calls.
2. Implement a Spring Boot `Filter` that extracts the header and logs it via MDC in a JSON format.
3. Trigger an HTTP 500 in the Spring backend and ensure the Angular `ErrorHandler` catches it and logs the correlation ID to the console.

## 22. BREAK-AND-FIX LAB
**Issue**: `ANG-OBSERVE-001` - Correlation ID Not Propagated Through Nginx.
**Scenario**: Support complains that UI errors provide a Reference ID, but searching Kibana yields no results.
**Break**: Inspect the Nginx configuration. It is dropping custom headers with underscores or missing the proxy pass rule.
**Diagnostic Steps**: 
1. Check browser network tab — header `X-Request-ID` is present.
2. Check Spring Boot logs — `reqId` is null.
3. Check Nginx logs — header missing.
**Fix**: Add `proxy_set_header X-Request-ID $http_x_request_id;` to the Nginx config, or switch to standard `traceparent`.

## 23. EXPERT QUESTIONS
1. **Q**: In a high-throughput microservices architecture, how do you handle the massive storage cost of distributed tracing logs?
   - **A**: Implement **Tail-Based Sampling** at the APM or collector level (e.g., OpenTelemetry Collector). Instead of head-based sampling (randomly keeping 10% of traces at the edge), tail-based sampling holds the entire trace in memory until it completes. It then discards 100% of normal, fast traces, but retains 100% of traces that contain an error or exceed a latency threshold.
2. **Q**: How does Spring WebFlux fundamentally break traditional SLF4J MDC, and how do you restore correlation?
   - **A**: MDC is backed by `ThreadLocal`. In WebFlux, a single request can execute across multiple threads in an event loop. The `ThreadLocal` context does not cross reactive boundaries. You must use Micrometer Observation and `ContextSnapshot` to propagate context into the reactive subscriber context.
3. **Q**: How do you reconstruct source-mapped stack traces for Angular errors if the `.map` files are not deployed to production for security reasons?
   - **A**: The CI pipeline must generate the source maps using `hidden: true`. It then securely uploads these maps to the APM (e.g., Sentry) via an authenticated CLI, associating them with the specific release hash. The CI pipeline then strips or deletes the `.map` files before deploying the `.js` files to the public CDN. When an error occurs, the APM uses the uploaded maps internally to reverse-engineer the stack trace.
