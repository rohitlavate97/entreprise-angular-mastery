# Module 31: Angular + Spring Boot Integration Deep Dive

---

## 1. WHAT
The Angular + Spring Boot integration defines the strict architectural contracts, HTTP request lifecycles, cross-origin resource sharing (CORS) configurations, security filter chains, and data mapping strategies required to build a cohesive, full-stack enterprise web application.

## 2. WHY
A decoupled architecture—where Angular drives the UI and Spring Boot drives the API—allows independent scaling, deployment, and team autonomy. However, this necessitates rigorous integration standards. Poorly integrated systems suffer from security vulnerabilities (like improperly configured CORS), fragile API contracts (leaking database entities), inconsistent error handling, and unmaintainable monolithic frontend code.

## 3. INTERNAL MENTAL MODEL
The full-stack request lifecycle crosses the network boundary, passing through multiple layers of security and data transformation before returning to the UI.

```text
[ Angular Frontend ]                          [ Spring Boot Backend ]
                               │
HttpClient ──> HttpInterceptor ──> (Network) ──> DispatcherServlet
                               │                       │
                               │                [ Spring Security ]
                               │                 1. CorsFilter
                               │                 2. CsrfFilter
                               │                 3. JwtAuthFilter (Extract/Validate)
                               │                       │
                               │                [ Web Layer ]
                               │                 Controller (@RestController)
                               │                 DTO Validation (@Valid)
                               │                       │
                               │                [ Business Layer ]
                               │                 Service (@Transactional)
                               │                 Mapper (Entity <-> DTO)
                               │                       │
                               │                [ Data Layer ]
                               │                 Repository (Spring Data JPA)
                               │                 Database
```

## 4. HOW IT WORKS
1. **Frontend Request:** Angular's `HttpClient` initiates an HTTP request. Interceptors attach necessary headers (e.g., JWT `Authorization: Bearer <token>` or `X-XSRF-TOKEN`).
2. **Preflight (OPTIONS):** If the request is cross-origin, the browser automatically sends an HTTP `OPTIONS` request.
3. **CORS Filter:** Spring Security's `CorsFilter` intercepts the request. If the origin is allowed, it returns the appropriate `Access-Control` headers. If it's a preflight request, it returns 200 OK without hitting the controller.
4. **Authentication:** The `JwtAuthenticationFilter` extracts the token, validates its signature and expiration, parses claims, and populates the `SecurityContextHolder`.
5. **Controller Routing:** The `DispatcherServlet` routes the request to the matching `@RestController`.
6. **Validation & Mapping:** The payload (DTO) is validated using `@Valid`. If valid, it is mapped to a JPA Entity.
7. **Business Logic & Persistence:** The `@Service` layer executes business rules within an `@Transactional` boundary, interacting with the `@Repository` to save the entity.
8. **Response:** The Entity is mapped back to a Response DTO, serialized to JSON by Jackson, and returned to Angular, where it is unwrapped and bound to the UI.

## 5. MODERN IMPLEMENTATION
Modern Spring Boot 3.x+ and Spring Security 6.x+ require the Lambda DSL for security configurations and explicit, non-wildcard CORS definitions.

```java
// Spring Security 6+ Configuration
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable()) // Assuming stateless JWT without cookies for this example
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/api/public/**", "/error").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class);
            
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://enterprise-app.com", "http://localhost:4200"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

## 6. LEGACY / ENTERPRISE REALITY
Legacy applications often use deprecated Spring Security paradigms like extending `WebSecurityConfigurerAdapter` and overriding `configure(HttpSecurity http)`. They may also rely on `@CrossOrigin` at the controller level instead of a global `CorsConfigurationSource`, leading to inconsistent CORS behavior and security vulnerabilities where endpoints forget the annotation.

**Migration:** Upgrade to Spring Boot 3, replace `WebSecurityConfigurerAdapter` with a `SecurityFilterChain` bean, and centralize CORS configuration inside the security filter chain to ensure it executes before authentication filters.

## 7. PRACTICAL EXAMPLE
An enterprise banking API handles paginated transactions.

**Spring Boot Controller:**
```java
@RestController
@RequestMapping("/api/transactions")
public class TransactionController {
    
    private final TransactionService service;

    @GetMapping
    public ResponseEntity<Page<TransactionDto>> getTransactions(
            @RequestParam String accountId,
            Pageable pageable) { // Handles ?page=0&size=20&sort=date,desc
        Page<TransactionDto> page = service.findTransactions(accountId, pageable);
        return ResponseEntity.ok(page);
    }
}
```

**Angular Service:**
```typescript
@Injectable({ providedIn: 'root' })
export class TransactionService {
  private http = inject(HttpClient);

  getTransactions(accountId: string, page: number, size: number): Observable<Page<TransactionDto>> {
    const params = new HttpParams()
      .set('accountId', accountId)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'date,desc');

    return this.http.get<Page<TransactionDto>>('/api/transactions', { params });
  }
}
```

## 8. COMMON MISTAKES
1. **Exposing JPA Entities:** Returning raw entities (e.g., `@Entity User`) directly from controllers exposes database architecture, creates circular reference JSON serialization errors, and risks massive data leakage. ALWAYS use DTOs.
2. **Implicit Transactions:** Forgetting `@Transactional` on service methods that perform multiple database writes, resulting in partial data corruption if an exception occurs mid-execution.
3. **Mismatched Error Contracts:** Angular expecting a custom `{ errorCode: 123 }` response, but Spring Boot returning its default `{ timestamp, status, error, path }` JSON, breaking UI error handling.

## 9. LOCAL ISSUES (CORS ISSUE LABS)
CORS is the most frequent source of local integration friction. Common manifestations:
- **CORS-001:** Preflight missing `Access-Control-Allow-Origin` (Spring Security blocking OPTIONS).
- **CORS-002:** The `Origin` header (`http://localhost:4200`) is absent from the backend's allowed list.
- **CORS-003:** Missing `Access-Control-Allow-Methods` (e.g., PUT is rejected).
- **CORS-004:** Missing `Access-Control-Allow-Headers` (e.g., custom `X-Tenant-ID` header rejected).
- **CORS-005:** `AllowCredentials` is true, but `AllowOrigin` is `*` (Browsers strictly forbid this combination).
- **CORS-006:** Trailing slash mismatch in allowed origins (`http://localhost:4200/` vs `http://localhost:4200`).
- **CORS-007:** Angular Proxy configuration (`proxy.conf.json`) masking CORS locally, which then fails in production.
- **CORS-008:** Nginx stripping CORS headers injected by Spring Boot.
- **CORS-009:** Spring MVC CORS vs Spring Security CORS conflicting.
- **CORS-010:** Exceptions thrown before the CORS filter executes (e.g., Tomcat header size limits) resulting in 500s lacking CORS headers.

## 10. CI/CD ISSUES
- Integration tests (`@SpringBootTest`) failing because mock environments lack the necessary Spring Profiles (`application-test.yml`) needed to wire up specific database dialects or mock external OAuth2 servers.

## 11. PRODUCTION ISSUES
- **Nginx Proxy Pass:** When deploying Angular behind Nginx alongside Spring Boot, configuring Nginx to handle `/api` via `proxy_pass` eliminates the need for CORS entirely, because Angular and Spring Boot now share the same domain and port from the browser's perspective. If CORS headers are still emitted by Spring Boot, Nginx might duplicate them, causing browser errors.

## 12. FULL-STACK INTERACTION
The most critical interaction point is the **Global Error Contract**.
Spring Boot must use `@RestControllerAdvice` to intercept exceptions and map them into a standardized format.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationErrors(MethodArgumentNotValidException ex) {
        List<FieldErrorDto> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(err -> new FieldErrorDto(err.getField(), err.getDefaultMessage()))
            .toList();
        
        ApiErrorResponse response = new ApiErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "VALIDATION_FAILED",
            "Invalid request payload",
            errors,
            MDC.get("traceId")
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }
}
```

Angular's `HttpInterceptor` can then universally parse this structure:
```typescript
if (error.status === 400 && error.error?.errorCode === 'VALIDATION_FAILED') {
  // Map fieldErrors to Angular Reactive Forms
}
```

## 13. DEBUGGING PROCESS
1. **Network Tab:** Always start by checking the HTTP status. If a request is blocked by CORS, look for the preceding `OPTIONS` request. Did it return 200 or 401/403?
2. **Spring Boot Logs:** If the OPTIONS request returned 401, Spring Security blocked the preflight.
3. **Trace IDs:** Ensure a unique Trace ID is generated at the Nginx/Gateway layer and injected into both Angular logs and Spring Boot MDC (Mapped Diagnostic Context) to trace a single request across the entire stack.

## 14. ROOT CAUSE ANALYSIS
A 403 Forbidden error on a cross-origin `POST` request, despite a seemingly correct `@CrossOrigin` annotation on the controller, usually happens because Spring Security's authorization filters execute *before* the Spring MVC controller. Because an `OPTIONS` request lacks a JWT, Spring Security rejects it as unauthenticated before the controller's `@CrossOrigin` metadata can ever be read.

## 15. FIX
To fix Spring Security blocking CORS preflight requests, the CORS filter must be registered within the Spring Security filter chain (as shown in Section 5), explicitly allowing `OPTIONS` requests through before requiring authentication.

## 16. PREVENTION
- **API First Design:** Use OpenAPI (Swagger) to define the contract. Generate Angular HTTP client services and Spring Boot controller interfaces automatically to ensure contract parity.
- **Strict Layering:** Enforce ArchUnit tests in Spring Boot to prevent `@RestController` classes from directly depending on `@Repository` classes, ensuring DTO mapping occurs in the `@Service` layer.

## 17. MONITORING / OBSERVABILITY
- Expose Spring Boot Actuator endpoints (`/actuator/prometheus`, `/actuator/health`).
- Forward all Angular client-side exceptions to a dedicated backend endpoint that correlates the frontend error with the specific backend Trace ID.

## 18. PERFORMANCE CONSIDERATIONS
- **N+1 Query Problem:** A poorly mapped DTO in the service layer might trigger hundreds of lazy-loaded JPA queries. Use `@EntityGraph` or `JOIN FETCH` in Spring Data JPA to optimize queries before mapping to DTOs.
- **Pagination:** Never return full lists from the backend. Always use Spring Data's `Pageable` and Angular's infinite scrolling or pagination components.

## 19. SECURITY CONSIDERATIONS
- **Bean Validation:** Never trust frontend form validation. Always use `@Valid` in Spring Boot controllers. Angular reactive form validators are purely for UX; backend `@NotBlank` and `@Size` are for security and data integrity.
- **Mass Assignment:** Exposing an Entity directly allows a malicious user to send `{"isAdmin": true}` in a JSON payload. Using a strict DTO that only contains `{"username": "test"}` prevents this.

## 20. TESTING STRATEGY
- **Frontend:** Mock backend responses using Angular's `HttpTestingController`.
- **Backend:** Use `@WebMvcTest` for controller layer testing (validating JSON serialization and HTTP status codes) and `@DataJpaTest` for repository testing.
- **Contract Testing:** Use Spring Cloud Contract or Pact to ensure the Angular consumer and Spring Boot provider agree on the JSON structure.

## 21. EXERCISES
1. Create a global `@RestControllerAdvice` in Spring Boot and a corresponding `HttpInterceptor` in Angular to handle and display field-level validation errors automatically.
2. Configure Spring Security to accept JWTs and implement an Angular interceptor that attaches the token from local state.
3. Purposely misconfigure CORS on the backend to trigger CORS-005 (`AllowCredentials` true with `*` origin) and observe the exact browser console error.

## 22. BREAK-AND-FIX LAB
**Defect FS-INTEGRATION-001: Spring Security blocks CORS preflight**
- **Scenario:** The frontend attempts a cross-origin `POST` to `/api/data`. The Network tab shows a CORS error.
- **Reproduction:** An `OPTIONS` request was sent by the browser. Spring Boot returns `401 Unauthorized`.
- **Diagnostic Steps:** The backend logs show `Full authentication is required to access this resource`.
- **Fix:** Remove `@CrossOrigin` from the controller. Implement `CorsConfigurationSource` in `SecurityConfig.java` and explicitly add `.cors(cors -> cors.configurationSource(corsConfigurationSource()))` to the `SecurityFilterChain`. The preflight request now bypasses authentication and returns `200 OK`, allowing the `POST` to proceed.

## 23. EXPERT QUESTIONS
1. **"Why should we avoid `@CrossOrigin` on Spring Controllers and instead configure CORS at the Spring Security Filter Chain level?"**
   *(Answer: `@CrossOrigin` is processed by Spring MVC's `DispatcherServlet`. Spring Security's filter chain executes *before* the `DispatcherServlet`. Therefore, security filters will intercept and reject unauthenticated CORS preflight `OPTIONS` requests before the `@CrossOrigin` annotation is ever evaluated. Centralizing it in Security ensures preflights are correctly handled globally.)*

2. **"How do you implement distributed tracing between an Angular SPA and a Spring Boot microservice architecture?"**
   *(Answer: The initial entry point (e.g., Nginx or an Angular interceptor) generates a unique trace ID (e.g., UUID) and attaches it to a standard header like `X-B3-TraceId` or `traceparent`. The Spring Boot app reads this header via a Servlet Filter or Interceptor, places it in the MDC (Mapped Diagnostic Context), and includes it in all subsequent logs. The trace ID is then attached to any outbound HTTP calls to other microservices or returned in the API error payload.)*

3. **"What is the architectural danger of using Jackson's `@JsonIgnore` on JPA entities to fix infinite recursion serialization errors instead of using DTOs?"**
   *(Answer: Using `@JsonIgnore` couples the API contract directly to the database schema. Any change to the database structure immediately breaks the API contract. Furthermore, it creates a risk of exposing sensitive data if an engineer forgets to add the annotation to a new field (e.g., `passwordHash`). The only robust solution is strict separation: Entities for the database, DTOs for the API, mapped explicitly in the service layer.)*
