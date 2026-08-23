# Module 00: Foundations of Enterprise Web Systems

---

## 1. WHAT
The foundational layer of modern web engineering encompasses the **browser execution environment**, the **HTTP/HTTPS network protocol stack**, **cross-origin security policies (CORS/SOP)**, and the **distributed request-response contract** that connects a client-side Single Page Application (Angular) to an API backend (Spring Boot).

---

## 2. WHY
Angular and Spring Boot do not exist in a vacuum; they execute across a physically distributed, asynchronous, and hostile environment (the open web). 
- An engineer who does not understand the **Critical Rendering Path** will build slow UI that blocks the main thread.
- An engineer who does not understand **preflight CORS mechanisms** will deploy code that works on localhost and catastrophically fails in production.
- An engineer who does not understand **stateless HTTP vs stateful browser storage** will leak security credentials or create multi-tab race conditions.

---

## 3. INTERNAL MENTAL MODEL

```
+----------------------------------------------------------------------------------------------------+
|                                         BROWSER RUNTIME                                            |
|                                                                                                    |
|  +--------------------+     +------------------------+     +------------------------------------+  |
|  |     DOM / CSSOM    |     |     JS Engine (V8)     |     |          Web Platform APIs         |  |
|  |  Render Tree / Paint| <---| Callstack & Microtasks  | <---| Fetch / XHR / WebSockets / WebCrypto |  |
|  +--------------------+     +------------------------+     +-----------------+------------------+  |
+------------------------------------------------------------------------------|---------------------+
                                                                               |
                                    HTTP/2 or HTTP/3 (TLS 1.3 Encryption)     |
                                    Headers: Origin, Cookie, Authorization     |
                                                                               v
+----------------------------------------------------------------------------------------------------+
|                                    NETWORK & EDGE GATEWAY                                          |
|                                                                                                    |
|  [ Cloudflare / CDN ]  ---->  [ Nginx Reverse Proxy / Load Balancer ]                              |
|  - Caches Static Assets       - SSL Termination                                                    |
|  - DDoS Protection            - `try_files $uri /index.html` (SPA Routing)                         |
|                               - `proxy_pass http://spring_upstream`                                |
+------------------------------------------------------+---------------------------------------------+
                                                       |
                                    Internal Network Protocol (HTTP / TCP)
                                    Header: X-Forwarded-Proto, X-Request-ID
                                                       v
+----------------------------------------------------------------------------------------------------+
|                                    SPRING BOOT API BACKEND                                         |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | Spring Security Filter Chain (CorsFilter -> CsrfFilter -> BearerAuthFilter -> ExceptionFilter) |  |
|  +-----------------------------------------------+----------------------------------------------+  |
|                                                  |                                                 |
|                                                  v                                                 |
|                                     [ @RestController Dispatcher ]                                 |
|                                                  |                                                 |
|                                                  v                                                 |
|                                  [ Business Service & Transactions ]                               |
|                                                  |                                                 |
|                                                  v                                                 |
|                                      [ Spring Data JPA / DB ]                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## 4. HOW IT WORKS: THE END-TO-END REQUEST LIFECYCLE

When an enterprise user clicks **"Submit Transfer"**:
1. **User Action & Event Dispatch**: Click event queues on the browser event loop task queue.
2. **Callstack Execution**: Event handler invokes Angular component method.
3. **Signal / State Evaluation**: Angular updates signal state; marks component for template dirty-check.
4. **Service & HTTP Interceptor**: Request enters Angular's `HttpInterceptor` pipeline where an `Authorization: Bearer <JWT>` header and an `X-Request-ID: <UUID>` are attached.
5. **Browser Network Stack (SOP & CORS)**:
   - Browser determines if the request is **cross-origin** (e.g., frontend on `https://app.enterprise.com`, API on `https://api.enterprise.com`).
   - If non-simple (has custom headers or `application/json`), the browser intercepts and dispatches a preflight **`OPTIONS`** request first.
6. **Edge / Reverse Proxy**: Nginx inspects headers, checks SSL, and forwards the preflight or actual request to the Spring upstream container.
7. **Spring Security Filter Chain**:
   - `CorsFilter` intercepts the `OPTIONS` request and validates the `Origin` header against allowed origins.
   - If preflight passes (HTTP 200/204 with `Access-Control-Allow-*` headers), the browser dispatches the actual `POST` request.
   - `BearerTokenAuthenticationFilter` validates the JWT signature, claims, and expiration.
8. **Controller & Validation**: Spring's `DispatcherServlet` routes the request to `@RestController`. `@Valid` triggers Bean Validation on DTO fields.
9. **Service & Transaction**: Spring enters a `@Transactional` boundary, executes business logic, and communicates with PostgreSQL via JPA/Hibernate.
10. **JSON Serialization & Response**: Hibernate entities are mapped to clean DTO records and serialized to JSON by Jackson.
11. **Return Path & Angular Render**:
    - Browser receives JSON response payload.
    - Angular's `HttpClient` Observable resolves and updates the reactive Signal state.
    - Angular's change detection engine schedules DOM patch operations during the microtask drain.
    - Browser recalculates layout, paints pixels, and the user sees the confirmation message.

---

## 5. MODERN IMPLEMENTATION

### Modern Angular 19+ (Standalone + Functional Interceptors + Signals)

```typescript
// frontend/src/app/core/interceptors/request-id.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  // Generate RFC4122 v4 UUID natively without external libraries
  const traceId = crypto.randomUUID();
  
  const tracedReq = req.clone({
    setHeaders: {
      'X-Request-ID': traceId
    }
  });
  
  return next(tracedReq);
};
```

### Modern Spring Boot 3.4+ / Java 21 (Record DTOs + Strict Security Config)

```java
// backend/src/main/java/com/enterprise/config/SecurityConfig.java
package com.enterprise.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable()) // Disabled for stateless JWT architectures
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**", "/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://app.enterprise.com", "http://localhost:4200"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-ID"));
        config.setExposedHeaders(List.of("X-Request-ID"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L); // Cache preflight for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Aspect | Modern Standard (Angular 19 / Spring 3.4) | Legacy Enterprise Reality (Angular 8-15 / Spring 2.x) |
|---|---|---|
| **Angular Architecture** | Standalone Components & Functional Interceptors (`provideHttpClient(withInterceptors([...]))`) | `NgModule` monolithic containers, `HTTP_INTERCEPTORS` multi-provider DI tokens |
| **Reactivity** | Signals (`signal()`, `computed()`, `toSignal()`) | Pure RxJS Subjects with manual `.unsubscribe()` / `takeUntil` boilerplate |
| **Spring Security** | Lambda DSL (`http.cors(...).authorizeHttpRequests(...)`) | `WebSecurityConfigurerAdapter` subclassing, method chaining `.and()` |
| **Java Models** | Java `record` immutable data carriers | Heavy Lombok `@Data` classes with mutable getters/setters |
| **API Contract** | OpenAPI 3.1 / Jackson 3 with strict ISO 8601 strings | Unconfigured Jackson returning numeric epoch timestamps or localized date strings |

---

## 7. PRACTICAL EXAMPLE: DISTRIBUTED TRACE CORRELATION

In high-throughput enterprise systems, an unhandled error on the UI must be instantly traceable to the exact backend database query in log management tools (Datadog, Splunk, Grafana Loki).

```
1. Angular Client Error:
   [Error: Payment Transfer Rejected] - X-Request-ID: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d

2. Support / Sentry Search:
   query: "X-Request-ID: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"

3. Spring Boot Log output:
   2026-08-23 22:15:01.120 [traceId=9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d] INFO  c.e.service.TransferService - Starting transfer for account ACC-49102
   2026-08-23 22:15:01.215 [traceId=9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d] ERROR c.e.service.TransferService - Insufficient funds: required 5000.00, available 1240.50
```

---

## 8. COMMON MISTAKES

1. **Treating CORS as a Backend Security Firewall**: CORS does not prevent malicious attackers using Postman or cURL from hitting your API. CORS is purely a **browser instruction** restricting browser scripts from reading responses.
2. **Hardcoding API Hostnames in TypeScript Code**: Violates the Twelve-Factor App methodology; leads to staging builds hitting production APIs or vice-versa.
3. **Misconfiguring `Access-Control-Allow-Origin: *` with `credentials: true`**: The browser security engine will unconditionally reject responses where wildcard origin is paired with cookie or auth credential sharing.
4. **Ignoring Single Page Application 404 Fallback in Nginx**: Reloading `/dashboard/transfers` returns Nginx 404 because Nginx looks for a physical directory on the disk rather than falling back to `index.html`.

---

## 9. LOCAL ISSUES
- **Symptom**: `net::ERR_CONNECTION_REFUSED` when Angular loads.
- **Root Cause**: Spring Boot backend has not finished starting on port `8080` or Angular `proxy.conf.json` is pointed to the wrong port.

---

## 10. CI/CD ISSUES
- **Symptom**: `npm run build` succeeds locally on Windows/macOS but fails on GitHub Actions / GitLab CI Linux runner with `Module not found: Can't resolve './Header/Header.component'`.
- **Root Cause**: Local filesystems are often case-insensitive; Linux CI filesystems are strictly case-sensitive.

---

## 11. PRODUCTION ISSUES
- **Symptom**: Users refreshing the page on deep URLs (`/accounts/1234`) receive an Nginx `404 Not Found` error.
- **Root Cause**: The web server is not configured with Single Page Application fallback rewrite rules (`try_files $uri $uri/ /index.html;`).

---

## 12. FULL-STACK INTERACTION: THE CORS PREFLIGHT CONTRACT

```
BROWSER (Angular)                                   SERVER (Spring Boot)
   |                                                        |
   | --- OPTIONS /api/v1/transfers -----------------------> |
   |     Origin: https://app.enterprise.com                 |
   |     Access-Control-Request-Method: POST                |
   |     Access-Control-Request-Headers: Authorization,     |
   |                                     X-Request-ID       |
   |                                                        |
   | <--- 204 No Content (or 200 OK) ---------------------- |
   |      Access-Control-Allow-Origin:                      |
   |        https://app.enterprise.com                      |
   |      Access-Control-Allow-Methods: POST, OPTIONS       |
   |      Access-Control-Allow-Headers: Authorization,      |
   |                                    X-Request-ID        |
   |      Access-Control-Max-Age: 3600                      |
   |                                                        |
   | --- POST /api/v1/transfers --------------------------> |
   |     Authorization: Bearer eyJhbGci...                  |
   |     X-Request-ID: 9b1deb4d...                          |
   |     {"amount": 100.00, "target": "ACC-99"}             |
   |                                                        |
   | <--- 200 OK (JSON Response Payload) ------------------ |
```

---

## 13. DEBUGGING PROCESS (Senior Engineer Protocol)

When a full-stack request fails:
1. **Network Tab Check**:
   - Inspect request Method: was it `OPTIONS` or `POST`?
   - If `OPTIONS` failed with `403` or `401`, Spring Security blocked the preflight request before CORS filter evaluated it.
2. **Response Headers Inspection**:
   - Verify `Access-Control-Allow-Origin` matches the exact browser `Origin` header.
3. **Console Log Correlation**:
   - Extract `X-Request-ID` from the failed request.
4. **Backend Log Grep**:
   - Run `grep "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" /var/log/app/spring-boot.log` to immediately inspect the backend stack trace.

---

## 14. ROOT CAUSE ANALYSIS: Why Spring Security Blocks Preflight
By default, older or improperly configured Spring Security filter chains place the `AuthorizationFilter` before the `CorsFilter`, or require authentication for all endpoints without explicitly whitelisting the HTTP `OPTIONS` method. Because the browser never attaches `Authorization: Bearer` to preflight `OPTIONS` requests, Spring Security rejects the preflight with `401/403`, preventing the browser from ever issuing the actual payload request.

---

## 15. FIX
Ensure `CorsFilter` runs at the highest precedence in the Spring Security filter chain and configure `HttpSecurity.cors()` with a centralized `CorsConfigurationSource`.

---

## 16. PREVENTION
- Enforce strict OpenAPI contract specifications and generate TypeScript API clients during CI build.
- Implement an automated contract test or integration test asserting that `OPTIONS` requests return `200/204` with appropriate CORS headers without authentication credentials.

---

## 17. MONITORING / OBSERVABILITY
- Configure an MDC (Mapped Diagnostic Context) logging filter in Spring Boot to automatically bind `X-Request-ID` into every structured log line (`log.info()`, `log.error()`).
- Capture frontend unhandled errors in Sentry / OpenTelemetry with the associated `X-Request-ID` tag.

---

## 18. PERFORMANCE CONSIDERATIONS
- Set `Access-Control-Max-Age: 3600` or higher in production so the browser caches the preflight response, eliminating redundant round-trip latencies for subsequent API calls.

---

## 19. SECURITY CONSIDERATIONS
- Never trust input from the client. Angular forms validation is for **User Experience only**; Spring Boot Bean Validation (`@NotNull`, `@Pattern`, `@Size`) is the **Security Boundary**.
- Never store sensitive secrets or encryption keys in Angular code or `.env` files — all code shipped to a browser is public.

---

## 20. TESTING STRATEGY
- **Unit Test (Angular)**: Verify that the `requestIdInterceptor` attaches an `X-Request-ID` header.
- **Integration Test (Spring Boot)**: Use `@SpringBootTest` + `MockMvc` to issue an `OPTIONS` request and verify that CORS headers match allowed origins.

---

## 21. EXERCISES
1. Explain what happens if an Angular app on `http://localhost:4200` makes a `POST` request to `http://localhost:8080/api` without a preflight configuration.
2. Configure an Nginx configuration file snippet that handles both Angular HTML5 routing and proxies `/api/*` to Spring Boot.

---

## 22. BREAK-AND-FIX LAB: `FS-FOUNDATION-001`
- **Injected Bug**: In Spring Boot's CORS configuration, set `config.setAllowedOrigins(List.of("https://production.domain.com"))` while running frontend tests from `http://localhost:4200`.
- **Observation**: The browser console reports `Access to XMLHttpRequest at 'http://localhost:8080/api' from origin 'http://localhost:4200' has been blocked by CORS policy`.
- **Diagnostic Action**: Inspect the Network tab preflight `OPTIONS` response header: notice the missing `Access-Control-Allow-Origin` matching `http://localhost:4200`.
- **Fix**: Update the allowed origins list to include local development environments or manage them dynamically via Spring Profiles (`@Profile("dev")`).

---

## 23. EXPERT QUESTIONS (Principal / Staff Level)

1. *Why does the browser omit the `Authorization` header during a CORS preflight `OPTIONS` request, and what architectural requirement does this impose on the Spring Security filter chain?*
2. *If an application uses HttpOnly cookies for session management across subdomains (`app.company.com` and `api.company.com`), what specific `SameSite` and `Domain` cookie attributes are required, and why does `SameSite=Strict` fail in this topology?*
3. *How does the browser event loop prioritize microtasks (Promises, `queueMicrotask`) versus macrotasks (`setTimeout`, DOM events), and why does Angular schedule Change Detection within the microtask drain?*
