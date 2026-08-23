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

## 21. EXERCISES & SOLUTIONS

### Exercise 1: Unconfigured Cross-Origin POST Flow
**Question:** Explain what happens if an Angular app on `http://localhost:4200` makes a `POST` request (`application/json`) to `http://localhost:8080/api` without a preflight CORS configuration on the backend.
**Solution & Analysis:**
1. Because `application/json` is NOT a simple content type (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`), the browser halts the `POST` request.
2. The browser automatically dispatches an `OPTIONS` preflight request with headers:
   - `Origin: http://localhost:4200`
   - `Access-Control-Request-Method: POST`
   - `Access-Control-Request-Headers: content-type`
3. Spring Boot receives the `OPTIONS` request. Without CORS enabled in Spring Security, Spring Security treats `OPTIONS` as unauthenticated or unmapped and returns `401 Unauthorized` or `403 Forbidden` without `Access-Control-Allow-*` headers.
4. The browser inspects the response status and missing headers, aborts the network call, throws a CORS error in the browser console, and **never sends the actual `POST` request**. The backend database and business logic are never touched.

---

### Exercise 2: Nginx SPA Routing + Reverse Proxy Configuration
**Question:** Write an enterprise-ready `nginx.conf` snippet that serves the Angular SPA, enables HTML5 pushState routing fallback, sets correct caching headers, and proxies `/api/` requests to the Spring Boot upstream.
**Solution:**
```nginx
events { worker_connections 1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    upstream backend_api {
        server backend:8080 max_fails=3 fail_timeout=10s;
        keepalive 32;
    }

    server {
        listen 80;
        server_name app.enterprise.com;

        root /usr/share/nginx/html;
        index index.html;

        # 1. Hashed Static Assets (Immutable Cache for 1 Year)
        location ~* \.(?:css|js|woff2?|svg|png|jpg|webp)$ {
            expires 1y;
            add_header Cache-Control "public, max-age=31536000, immutable";
            access_log off;
            try_files $uri =404;
        }

        # 2. SPA Entry Point (Never Cache index.html)
        location / {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
            try_files $uri $uri/ /index.html;
        }

        # 3. API Gateway Reverse Proxy
        location /api/ {
            proxy_pass http://backend_api;
            proxy_http_version 1.1;
            
            # Forward Original Client Details & Security Headers
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Request-ID $http_x_request_id;
            
            # Timeouts
            proxy_connect_timeout 5s;
            proxy_read_timeout 60s;
        }
    }
}
```

---

## 22. BREAK-AND-FIX LAB: `FS-FOUNDATION-001`
- **Injected Bug**: In Spring Boot's CORS configuration, set `config.setAllowedOrigins(List.of("https://production.domain.com"))` while running frontend tests from `http://localhost:4200`.
- **Observation**: The browser console reports `Access to XMLHttpRequest at 'http://localhost:8080/api' from origin 'http://localhost:4200' has been blocked by CORS policy`.
- **Diagnostic Action**: Inspect the Network tab preflight `OPTIONS` response header: notice the missing `Access-Control-Allow-Origin` matching `http://localhost:4200`.
- **Fix**: Update the allowed origins list to include local development environments or manage them dynamically via Spring Profiles (`@Profile("dev")`).

---

## 23. EXPERT QUESTIONS & ANSWERS (Principal / Staff Level)

### Question 1
*Why does the browser omit the `Authorization` header during a CORS preflight `OPTIONS` request, and what architectural requirement does this impose on the Spring Security filter chain?*
> **Answer:**
> Under the W3C/WHATWG CORS specification, preflight `OPTIONS` requests are strictly non-credentialed probes designed to query server permissions *before* sensitive data or user tokens are sent across origins. Browsers intentionally strip `Authorization` and `Cookie` headers from `OPTIONS` calls to prevent credential leakage. 
> 
> **Architectural Requirement on Spring Security:**
> `CorsFilter` must execute **before** `AuthorizationFilter` and `AuthenticationFilter` in the `SecurityFilterChain`. Furthermore, Spring Security must explicitly permit all `OPTIONS` requests without requiring authentication (`requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()` or via `http.cors(Customizer.withDefaults())`). If authentication is checked before CORS evaluation, Spring will reject the preflight with `401 Unauthorized`, deadlocking the browser.

---

### Question 2
*If an application uses HttpOnly cookies for session management across subdomains (`app.company.com` and `api.company.com`), what specific `SameSite` and `Domain` cookie attributes are required, and why does `SameSite=Strict` fail in this topology?*
> **Answer:**
> - **`Domain=.company.com`**: Setting the root domain with a leading dot allows both `app.company.com` (origin 1) and `api.company.com` (origin 2) to share the cookie.
> - **`SameSite=Lax` or `SameSite=None; Secure`**: Because `app.company.com` and `api.company.com` are different origins (even if same site), cross-origin XHR/Fetch requests initiated from `app.` to `api.` will **omit** cookies if `SameSite=Strict` is set. `SameSite=Strict` forbids sending the cookie on any cross-origin HTTP request regardless of whether the site/domain matches.
> - **Angular Requirement**: Angular's `HttpClient` must make requests with `{ withCredentials: true }` so the browser attaches the cookie.
> - **Backend Requirement**: Spring Boot CORS must declare `Access-Control-Allow-Credentials: true` and specify explicit allowed origins (never `*`).

---

### Question 3
*How does the browser event loop prioritize microtasks (Promises, `queueMicrotask`) versus macrotasks (`setTimeout`, DOM events), and why does Angular schedule Change Detection within the microtask drain?*
> **Answer:**
> 1. The browser event loop processes synchronous code on the call stack first.
> 2. When the call stack becomes empty, the engine drains the **Microtask Queue** completely until zero microtasks remain.
> 3. After draining microtasks (and rendering if a frame tick occurs), the engine picks **exactly one** task from the Macrotask Queue.
> 
> **Why Angular schedules Change Detection in Microtasks:**
> Multiple state changes often occur in rapid succession during a single user interaction (e.g., a component updates a signal, triggers a child component input change, and resolves an internal promise). By scheduling Change Detection as a **microtask**, Angular batches all synchronous mutations into a single coherent pass before the browser paints the screen. This ensures optimal rendering performance (preventing layout thrashing/jank) and guarantees that the DOM always reflects the latest state before the next frame is drawn.
