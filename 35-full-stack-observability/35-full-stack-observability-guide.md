# Module 35: Full-Stack Observability

## 1. WHAT
Full-Stack Observability is the architectural practice of Instrumenting applications (Angular, Nginx, Spring Boot, Databases) with continuous logging, metrics, and distributed tracing so that any user action can be tracked end-to-end, enabling rapid diagnosis of systemic failures.

## 2. WHY
In a distributed enterprise architecture, a single user click in an Angular application might traverse a WAF, an Nginx API Gateway, three Spring Boot microservices, and a PostgreSQL database. When a user reports "the checkout failed," debugging is impossible without a unified correlation ID tying the frontend error report to the specific backend exceptions and database query latency.

## 3. INTERNAL MENTAL MODEL

```text
[User Click] 
      |
[Angular App]
      | 1. Interceptor generates UUID
      |    Adds `X-Request-ID: 1234-abcd`
      |
[Nginx API Gateway]
      | 2. proxy_pass preserves `X-Request-ID: 1234-abcd`
      |    (Logs ID in Nginx access.log)
      |
[Spring Boot App]
      | 3. OncePerRequestFilter extracts `X-Request-ID`
      |    Stores in MDC (Mapped Diagnostic Context)
      |    All application logs now include `[1234-abcd]`
      |
[Database]
      | 4. Slow Query (Logged with MDC ID)
      |
[Spring Boot App]
      | 5. Exception Thrown
      | 6. @ControllerAdvice intercepts
      |    Returns 500 JSON with `{"traceId": "1234-abcd"}`
      |
[Angular App]
      | 7. HttpErrorResponse caught
      |    Sends `1234-abcd` to Sentry/Datadog
      |
[Support Engineer]
      | 8. Searches Splunk/ELK for `1234-abcd`
      |    Sees complete story from Browser to DB.
```

## 4. HOW IT WORKS
1. **Frontend Origination:** Angular's HTTP Interceptor generates a UUID v4 for every outgoing API request and appends it as an `X-Request-ID` (or standard W3C `traceparent`) header.
2. **Infrastructure Pass-through:** Proxies (Nginx, Envoy) and API Gateways must be explicitly configured to forward this header to downstream services.
3. **Backend Ingestion:** Spring Boot intercepts the HTTP request early in the filter chain, extracts the header, and places it into the logging framework's thread-local storage (MDC - Mapped Diagnostic Context).
4. **Log Appending:** Logback or Log4j2 pattern layouts inject the MDC value into every log statement emitted by that thread.
5. **Round-Trip Error Handling:** If an error occurs, Spring Boot includes the correlation ID in the JSON error response. Angular's error handler attaches this ID to the frontend telemetry event (e.g., Sentry), closing the loop.

## 5. MODERN IMPLEMENTATION

### Angular: Functional Correlation Interceptor

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { v4 as uuidv4 } from 'uuid';

export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationId = uuidv4();
  const modifiedReq = req.clone({
    setHeaders: {
      'X-Request-ID': correlationId
    }
  });
  return next(modifiedReq);
};
```

### Nginx: Proxy Pass Configuration

```nginx
server {
    listen 80;
    server_name api.enterprise.com;

    # Custom log format to include the correlation ID
    log_format combined_trace '$remote_addr - $remote_user [$time_local] '
                              '"$request" $status $body_bytes_sent '
                              '"$http_referer" "$http_user_agent" '
                              'TraceID: $http_x_request_id';

    access_log /var/log/nginx/access.log combined_trace;

    location /api/ {
        # Forward the header to Spring Boot
        proxy_set_header X-Request-ID $http_x_request_id;
        proxy_pass http://springboot-backend;
    }
}
```

### Spring Boot: MDC Filter and Error Handling

```java
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final String CORRELATION_ID_HEADER = "X-Request-ID";
    private static final String MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                    HttpServletResponse response, 
                                    FilterChain filterChain) throws ServletException, IOException {
        
        String correlationId = request.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null || correlationId.isEmpty()) {
            correlationId = UUID.randomUUID().toString(); // Fallback
        }

        MDC.put(MDC_KEY, correlationId);
        // Put it in the response header as well
        response.setHeader(CORRELATION_ID_HEADER, correlationId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY); // CRITICAL: Prevent memory leaks / thread pollution
        }
    }
}
```

**Logback Configuration (`logback-spring.xml`):**
```xml
<pattern>%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - [%X{requestId}] - %msg%n</pattern>
```

## 6. LEGACY / ENTERPRISE REALITY
Legacy systems often lack end-to-end tracing. The frontend logs errors to one silo, the backend logs to another, and engineers manually guess which logs match based on timestamps. Additionally, reactive programming (Spring WebFlux / Project Reactor) breaks ThreadLocal MDC because requests jump across threads, requiring complex Context propagation APIs like Micrometer Tracing.

## 7. PRACTICAL EXAMPLE
A user attempts to submit a complex multi-step loan application. They click "Submit", a loading spinner appears, and then a red toast notification says "Internal Server Error." 
The user calls support. Support asks for the "Error Code" displayed on the screen (which is actually the `X-Request-ID` returned by Spring Boot). 
The engineer pastes `f81d4fae-7dec-11d0-a765-00a0c91e6bf6` into Kibana/Datadog and instantly sees:
1. Angular generated the UUID.
2. Nginx routed it to microservice A.
3. Microservice A called Microservice B.
4. Microservice B threw a `NullPointerException` because a required field was missing from the database.

## 8. COMMON MISTAKES
1. **Thread Pollution in Spring:** Failing to call `MDC.remove()` or `MDC.clear()` in a `finally` block in the Servlet filter. Since Tomcat reuses threads, Request 2 might inherit Request 1's correlation ID.
2. **Missing Proxy Headers:** Nginx dropping custom headers by default if they contain underscores instead of dashes (e.g., `X_Request_ID`).
3. **Ignoring Async Boundaries:** MDC values are lost when moving work to an `@Async` method or a `CompletableFuture`.

## 9. LOCAL ISSUES
- Missing headers during local development due to CORS configurations. If `X-Request-ID` is not added to `Access-Control-Allow-Headers`, the browser's preflight OPTIONS request will fail.

## 10. CI/CD ISSUES
- Automated E2E test failures that are impossible to debug because the headless browser doesn't expose the correlation ID to the test report upon failure.

## 11. PRODUCTION ISSUES
- High volume of traffic creating immense log volume.
- Sampling rates in OpenTelemetry/Datadog dropping the exact trace you are looking for (e.g., only 10% of traces are kept to save costs).

## 12. FULL-STACK INTERACTION
Observability is fundamentally full-stack. It requires agreement on the header names (W3C Trace Context standardizes this to `traceparent` and `tracestate`). If Angular sends `X-Correlation-ID`, Nginx expects `X-Request-ID`, and Spring Boot looks for `trace-id`, the entire chain is broken.

## 13. DEBUGGING PROCESS
1. **Frontend:** Open Chrome DevTools -> Network -> Click the failed request -> Headers. Ensure `X-Request-ID` is present in Request Headers.
2. **Gateway:** Check the Nginx access log to ensure the ID is printed.
3. **Backend Logs:** Check Kibana/Splunk. If the ID exists in Nginx but not in Spring Boot, the reverse proxy configuration dropped the header.

## 14. ROOT CAUSE ANALYSIS
Why does a missing `finally { MDC.remove(); }` cause log pollution?
Java servlet containers like Tomcat use a thread pool. A thread handles Request A, places `reqA-id` into MDC (which is backed by `ThreadLocal`), and finishes. The thread returns to the pool. When Request B comes in, Tomcat assigns the same thread. If Request B doesn't provide an ID, the thread still contains `reqA-id`, meaning all logs for User B appear as if they belong to User A.

## 15. FIX
Always use `try/finally` blocks when interacting with MDC, or utilize Spring's built-in `ServerHttpObservationFilter` with Micrometer Tracing (Spring Boot 3.x) which handles context propagation automatically.

## 16. PREVENTION
- Enforce W3C Trace Context standard across the organization.
- Use SonarQube rules to detect manual MDC usage without `finally` blocks.
- Configure Spring Boot's `@ControllerAdvice` to automatically inject the correlation ID into every `ProblemDetail` or custom API error response.

## 17. MONITORING / OBSERVABILITY
Beyond tracing:
- **Metrics:** Spring Boot Actuator (`/actuator/prometheus`) exposes JVM memory, CPU, and HikariCP connection pool metrics.
- **RUM (Real User Monitoring):** Angular uses `PerformanceObserver` to report Core Web Vitals (LCP, FID, CLS) to the backend.
- **SLIs/SLOs:** Service Level Indicators (e.g., "99% of requests < 200ms") define the health of the system.

## 18. PERFORMANCE CONSIDERATIONS
Generating a UUID in Angular is cheap. However, extensive MDC usage and large trace payloads in Spring Boot can impact throughput. When using OpenTelemetry agents, span export processes can consume 5-10% of CPU overhead. Use probabilistic sampling in production.

## 19. SECURITY CONSIDERATIONS
- Do not log sensitive PII (Passwords, Credit Cards, Social Security Numbers).
- Ensure the `X-Request-ID` generated by the frontend is sanitized by the backend to prevent Log Forging attacks (e.g., a malicious user sending `X-Request-ID: 1234\nINFO: Admin Login Success`).

## 20. TESTING STRATEGY
- **Unit (Angular):** Test the interceptor using `HttpTestingController` to ensure the header is appended.
- **Integration (Spring Boot):** Use `@SpringBootTest` and MockMvc to send a request with an ID and verify the MDC context is set correctly in a dummy log appender.
- **E2E:** Playwright tests that capture the response correlation ID and verify it exists in the test output.

## 21. EXERCISES
1. Implement the Angular interceptor and Spring Boot MDC filter.
2. Modify a Spring `@ControllerAdvice` global exception handler to return the `X-Request-ID` in a standard RFC 7807 Problem Detail JSON response.
3. Integrate Spring Boot Actuator and Prometheus to visualize HTTP response times in Grafana.

## 22. BREAK-AND-FIX LAB: FS-OBSERVE-001
- **Objective:** Fix a broken tracing pipeline where Nginx drops the correlation ID.
- **Break:** Configure Nginx with `proxy_pass` but intentionally omit `proxy_set_header X-Request-ID`. Trigger a frontend error.
- **Diagnosis:** The frontend network tab shows `X-Request-ID: abc-123`. Search the Spring Boot logs for `abc-123`—zero results. Spring Boot logs show a completely different, backend-generated fallback UUID.
- **Fix:** Add `proxy_set_header X-Request-ID $http_x_request_id;` to the Nginx location block. Reload Nginx (`nginx -s reload`). Retrigger the error. Verify `abc-123` now appears in both the browser and the backend logs.

## 23. EXPERT QUESTIONS
1. **How do you propagate distributed tracing context (like MDC) across thread boundaries in an asynchronous Spring WebFlux or `@Async` environment?**
   *Answer:* `ThreadLocal` variables (like MDC) do not cross thread boundaries automatically. You must use Micrometer Tracing's Context Snapshot APIs or Project Reactor's `Context` to capture the state from the parent thread and re-apply it to the worker thread executing the asynchronous task.
2. **If we transition from custom `X-Request-ID` to the W3C Trace Context standard, what headers are involved and what is the difference between a Trace ID and a Span ID?**
   *Answer:* W3C uses the `traceparent` header (format: `version-traceid-spanid-traceflags`). The Trace ID represents the entire end-to-end journey (browser to database). The Span ID represents a specific segment of that journey (e.g., just the database query or just the Nginx proxy step).
3. **How does RUM (Real User Monitoring) in Angular differ from Synthetic Monitoring, and when would you use each?**
   *Answer:* Synthetic monitoring uses automated headless browsers to ping the site periodically from various regions to ensure baseline uptime and performance. RUM instruments the actual Angular application using Web APIs (`PerformanceObserver`) to capture performance metrics from real users across varying devices, network conditions, and interactions. You need Synthetics for 24/7 proactive alerting and RUM for actual user experience analysis.
