# Module 32: Angular + Spring Boot Local Issues Lab

## 1. WHAT
This module is an exhaustive index and lab environment for diagnosing, debugging, and resolving the 38 most common full-stack development issues encountered when connecting a modern Angular 19+ application to a Spring Boot 3.x backend in local and staging environments.

## 2. WHY
Full-stack integration is where 80% of development time is lost. Misaligned data contracts, CORS preflight failures, timezone offsets, and proxy misconfigurations cause massive developer frustration. An indexed, pattern-based approach to diagnosing these issues separates junior developers from Staff engineers.

## 3. INTERNAL MENTAL MODEL
```text
[Angular Http Client] ---> [Angular Proxy/Dev Server] ---> [Network] ---> [Spring Boot DispatcherServlet]
       |                          |                          |                       |
 (Serialization)            (CORS/Proxying)            (Latency/SSL)      (Deserialization/Auth)
```

## 4. HOW IT WORKS
Full-stack debugging requires isolating the failure point across four boundaries: 1. Angular App State, 2. Browser Network Tab, 3. Local Proxy/Network Layer, 4. Spring Boot Controller/Logs.

## 5. MODERN IMPLEMENTATION
Modern setups use `proxy.conf.js` or `angular.json` proxy configurations to bypass local CORS, while enforcing strict TypeScript/Java OpenAPI contract generation to prevent DTO mismatches.

## 6. LEGACY / ENTERPRISE REALITY
Legacy enterprise systems often rely on hardcoded backend URLs in `environment.ts`, manual DTO syncing, and heavy stateful sessions (JSESSIONID) instead of stateless JWTs.

## 7. PRACTICAL EXAMPLE
Enterprise developers face integration issues daily. A simple date picker saving to a PostgreSQL database can trigger 5 different timezone offset bugs before production.

## 8. COMMON MISTAKES
Blaming the backend when the Angular proxy is misconfigured. Blaming the frontend when Spring Security blocks a preflight OPTIONS request. Failing to check the Network tab payload before opening backend code.

## 9. LOCAL ISSUES (THE 38 ISSUES LAB)

### A. STARTUP (FS-LOCAL-001 to 006)

#### FS-LOCAL-001 | Angular starts, Spring Boot not running | STARTUP | P2
**SYMPTOMS:** Angular UI loads, but all API calls instantly fail.
**REPRODUCTION:** Run `ng serve` without starting the backend IDE.
**EXPECTED vs ACTUAL:** Expected data, actual is a completely silent UI or rapid console errors.
**ERROR MESSAGE:** `ERR_CONNECTION_REFUSED` in Chrome Network tab.
**ROOT CAUSE:** Spring Boot Tomcat server is not running on port 8080.
**DEBUGGING PROCESS:** 
- Network Tab: Shows red failed requests immediately.
- Spring Boot Logs: Blank, no process running.
- Angular DevTools: Components trapped in loading state.
**FIX:** Start the Spring Boot Application class.
```bash
# Start backend via terminal
./mvnw spring-boot:run
```
**PREVENTION:** Use a `docker-compose` or `npm-run-all` script to start both.
**REGRESSION TEST:** N/A.

#### FS-LOCAL-002 | Wrong API base URL in environment.ts | STARTUP | P3
**SYMPTOMS:** API calls fail with 404 Not Found.
**REPRODUCTION:** Point environment.ts to `/api/v2` but backend is `/api/v1`.
**EXPECTED vs ACTUAL:** Expected 200 OK, actual 404 Not Found.
**ERROR MESSAGE:** `404 Not Found` for `http://localhost:4200/api/v2/users`.
**ROOT CAUSE:** Hardcoded incorrect URL paths in Angular environments.
**DEBUGGING PROCESS:** 
- Network Tab: Inspect the exact URL requested.
- Spring Boot Logs: No log (if static resource) or explicit `NoHandlerFoundException`.
**FIX:** Correct the `apiUrl` in `environment.ts`.
```typescript
export const environment = {
  production: false,
  apiUrl: '/api/v1' // Corrected from /api/v2
};
```
**PREVENTION:** Centralize API base paths and use a robust configuration service.
**REGRESSION TEST:** E2E test to verify API connectivity.

#### FS-LOCAL-003 | Angular proxy config incorrect | STARTUP | P2
**SYMPTOMS:** 404 Not Found on API calls, despite backend running.
**REPRODUCTION:** Missing or typo in `proxy.conf.json`.
**EXPECTED vs ACTUAL:** Expected proxy to route `/api` to `:8080`, actual routing to `:4200/api`.
**ERROR MESSAGE:** `404 Not Found` (Served by Angular dev server, returning index.html).
**ROOT CAUSE:** The Webpack dev server doesn't know to forward the request.
**DEBUGGING PROCESS:** 
- Network Tab: Response returns HTML (the Angular index page) instead of JSON.
- Spring Boot Logs: No request hits the backend.
**FIX:** Add `"proxyConfig": "proxy.conf.json"` to `angular.json` serve options.
```json
// proxy.conf.json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  }
}
```
**PREVENTION:** Standardize dev environment setup scripts.
**REGRESSION TEST:** Local build check.

#### FS-LOCAL-004 | Angular calls old backend instance | STARTUP | P2
**SYMPTOMS:** Data changes made in DB don't reflect in UI.
**REPRODUCTION:** Developer has a background Java process running an old branch.
**EXPECTED vs ACTUAL:** Expected new feature data, actual returns old schema.
**ERROR MESSAGE:** Usually silent failure, or Jackson deserialization error on frontend.
**ROOT CAUSE:** Port 8080 was hijacked by a detached background Java process.
**DEBUGGING PROCESS:** 
- Network Tab: Request succeeds but payload is wrong.
- Spring Boot Logs: The IDE console shows nothing because the request hit the background process.
**FIX:** Kill the phantom process.
```bash
# Find and kill the process holding port 8080
kill -9 $(lsof -t -i:8080)
```
**PREVENTION:** Use distinct ports per microservice.
**REGRESSION TEST:** N/A.

#### FS-LOCAL-005 | Port conflict — two Spring Boot instances | STARTUP | P2
**SYMPTOMS:** Backend fails to start.
**REPRODUCTION:** Run `BootApp` twice.
**EXPECTED vs ACTUAL:** Expected successful startup, actual JVM crash.
**ERROR MESSAGE:** `Web server failed to start. Port 8080 was already in use.`
**ROOT CAUSE:** Tomcat cannot bind to a port already in use.
**DEBUGGING PROCESS:** 
- Spring Boot Logs: Immediate crash trace clearly stating port conflict.
**FIX:** Stop the existing instance or change `server.port` in `application.yml`.
```yaml
server:
  port: 8081
```
**PREVENTION:** Use dynamic ports for testing, strict process management for dev.
**REGRESSION TEST:** N/A.

#### FS-LOCAL-006 | Environment file not loaded correctly | STARTUP | P3
**SYMPTOMS:** Third-party integrations (e.g., Auth0, Stripe) fail locally.
**REPRODUCTION:** `ng serve --configuration=production` used by accident.
**EXPECTED vs ACTUAL:** Expected local dev keys, actual production keys used.
**ERROR MESSAGE:** Various 401 Unauthorized from third parties.
**ROOT CAUSE:** Angular CLI loaded `environment.prod.ts` locally.
**DEBUGGING PROCESS:** 
- Network Tab: Observe outgoing requests going to production URLs.
**FIX:** Run standard `ng serve`.
**PREVENTION:** Remove `environment.ts` pattern in favor of runtime configuration fetched from `/assets/config.json`.
**REGRESSION TEST:** Startup test asserts configuration matches `localhost`.


### B. HTTP COMMUNICATION (FS-LOCAL-010 to 017)

#### FS-LOCAL-010 | Request visible in Angular, never reaches Spring controller | HTTP COMMUNICATION | P1
**SYMPTOMS:** UI freezes, no error, backend silent.
**REPRODUCTION:** Angular proxy misconfigured or Spring Security Filter chain completely blocking.
**EXPECTED vs ACTUAL:** Expected 200, actual silent drop.
**ERROR MESSAGE:** CORS error in console, or `(canceled)` in Network tab.
**ROOT CAUSE:** Browser CORS policy blocks the preflight before Spring Boot even sees it.
**DEBUGGING PROCESS:** 
- Network Tab: `OPTIONS` request fails with CORS error.
- Spring Boot Logs: Completely empty.
**FIX:** Configure `@CrossOrigin` globally in Spring if not using a proxy.
```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**").allowedOrigins("http://localhost:4200");
    }
}
```
**PREVENTION:** Always use `proxy.conf.json` for local development.
**REGRESSION TEST:** E2E test verifying cross-origin bypass.

#### FS-LOCAL-011 | Spring called but Angular receives unexpected error | HTTP COMMUNICATION | P2
**SYMPTOMS:** Backend throws 500, but Angular interceptor crashes handling it.
**REPRODUCTION:** Spring throws generic `Exception`, Angular expects specific `{ message: string }` format.
**EXPECTED vs ACTUAL:** Expected graceful UI error, actual UI crash.
**ERROR MESSAGE:** `TypeError: Cannot read properties of undefined (reading 'message')`
**ROOT CAUSE:** Spring Boot returned the default Whitelabel Error Page HTML instead of JSON.
**DEBUGGING PROCESS:** 
- Network Tab: Response is raw HTML.
- Angular DevTools: State is broken due to unhandled promise rejection.
**FIX:** Add `@RestControllerAdvice` in Spring to globally format exceptions as JSON.
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handle(Exception ex) {
        return ResponseEntity.status(500).body(new ErrorResponse(ex.getMessage()));
    }
}
```
**PREVENTION:** Global Exception Handlers on the backend.
**REGRESSION TEST:** Unit test the global exception handler.

#### FS-LOCAL-012 | Angular sends wrong Content-Type | HTTP COMMUNICATION | P2
**SYMPTOMS:** Spring Boot returns 415.
**REPRODUCTION:** Sending FormData or plain text to a `@RequestBody` endpoint.
**EXPECTED vs ACTUAL:** Expected successful parse, actual 415.
**ERROR MESSAGE:** `415 Unsupported Media Type`
**ROOT CAUSE:** Angular `HttpClient` defaulted to `text/plain` or Spring requires `application/json`.
**DEBUGGING PROCESS:** 
- Network Tab: Check Request Headers `Content-Type`.
- Spring Boot Logs: `Content type 'text/plain' not supported`.
**FIX:** Pass correct headers.
```typescript
this.http.post(url, data, {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
});
```
**PREVENTION:** Wrap `HttpClient` in a base service that enforces headers.
**REGRESSION TEST:** Integration test.

#### FS-LOCAL-013 | Spring validation rejects — Angular shows wrong error | HTTP COMMUNICATION | P3
**SYMPTOMS:** Form submits, fails silently or shows generic "Error".
**REPRODUCTION:** Submit invalid email format.
**EXPECTED vs ACTUAL:** Expected "Invalid email", actual "An error occurred".
**ERROR MESSAGE:** `400 Bad Request` from Spring `@Valid`.
**ROOT CAUSE:** Angular interceptor does not parse Spring's `MethodArgumentNotValidException` array of field errors.
**DEBUGGING PROCESS:** 
- Network Tab: Inspect the 400 response body (contains field errors array).
**FIX:** Update Angular interceptor to map Spring's validation array to Angular form errors.
**PREVENTION:** Shared validation logic / OpenAPI generated forms.
**REGRESSION TEST:** Submit invalid form in E2E test, assert specific error message.

#### FS-LOCAL-014 | Backend returns HTML error page instead of JSON | HTTP COMMUNICATION | P2
**SYMPTOMS:** Parsing error in Angular `HttpClient`.
**REPRODUCTION:** Access a secured endpoint without a token, Spring Security redirects to `/login` returning HTML.
**EXPECTED vs ACTUAL:** Expected 401 JSON, actual 200 OK with HTML login page.
**ERROR MESSAGE:** `SyntaxError: Unexpected token < in JSON at position 0`
**ROOT CAUSE:** Spring Security is configured for formLogin() instead of stateless REST (httpBasic / JWT).
**DEBUGGING PROCESS:** 
- Network Tab: See 302 Redirect followed by 200 OK returning HTML.
**FIX:** Configure `formLogin().disable()` and set session management to `STATELESS`.
```java
http.csrf().disable()
    .formLogin().disable()
    .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
```
**PREVENTION:** Standardize security config for microservices.
**REGRESSION TEST:** API test asserting 401 returns JSON.

#### FS-LOCAL-015 | Multipart file upload fails | HTTP COMMUNICATION | P1
**SYMPTOMS:** 400 or 415 when uploading a file.
**REPRODUCTION:** Sending `FormData` with a JSON `Content-Type` header attached manually.
**EXPECTED vs ACTUAL:** Expected file upload, actual boundary missing error.
**ERROR MESSAGE:** `the request was rejected because no multipart boundary was found`
**ROOT CAUSE:** Angular `HttpClient` needs the browser to automatically set the `Content-Type: multipart/form-data; boundary=...`. Setting it manually overrides the boundary.
**DEBUGGING PROCESS:** 
- Network Tab: Check `Content-Type` header lacks the boundary hash.
**FIX:** Remove the explicit `Content-Type` header when sending `FormData` in Angular.
```typescript
const formData = new FormData();
formData.append('file', file);
// DO NOT set Content-Type header here
return this.http.post('/api/upload', formData);
```
**PREVENTION:** Create a dedicated `FileService` for uploads.
**REGRESSION TEST:** Cypress test uploading a fixture file.

#### FS-LOCAL-016 | Large response body causes frontend timeout | HTTP COMMUNICATION | P2
**SYMPTOMS:** Request pends for 10 seconds, then fails.
**REPRODUCTION:** Querying 50,000 rows without pagination.
**EXPECTED vs ACTUAL:** Expected data, actual UI crash or timeout.
**ERROR MESSAGE:** `net::ERR_CONNECTION_TIMED_OUT` or Browser Out of Memory.
**ROOT CAUSE:** Spring Boot attempts to serialize massive JSON; Angular attempts to parse it on the main thread.
**DEBUGGING PROCESS:** 
- Network Tab: Request takes 15 seconds, payload size > 25MB.
**FIX:** Implement Spring Data `Pageable` and Angular infinite scrolling.
```java
@GetMapping
public Page<Entity> getAll(Pageable pageable) {
    return repository.findAll(pageable);
}
```
**PREVENTION:** Never return `List<T>` without limits on enterprise entities.
**REGRESSION TEST:** Backend test asserting max page size is enforced.

#### FS-LOCAL-017 | Response type mismatch (expected object, got array) | HTTP COMMUNICATION | P2
**SYMPTOMS:** Angular component logic fails during rendering.
**REPRODUCTION:** Backend changed from returning single object to a list.
**EXPECTED vs ACTUAL:** Expected object properties, actual undefined.
**ERROR MESSAGE:** `Cannot read properties of undefined` in template.
**ROOT CAUSE:** API contract change not communicated to frontend.
**DEBUGGING PROCESS:** 
- Network Tab: Payload is `[{...}]` but frontend expects `{...}`.
**FIX:** Update Angular interfaces and service mappings.
**PREVENTION:** Use OpenAPI (Swagger) to auto-generate Angular services and models.
**REGRESSION TEST:** Contract testing (Pact).


### C. DATA CONTRACTS (FS-LOCAL-020 to 027)

#### FS-LOCAL-020 | Java Long precision loss | DATA CONTRACTS | P1
**SYMPTOMS:** Database ID `9007199254740993` becomes `9007199254740992` in Angular.
**REPRODUCTION:** Generate a Snowflake ID in Java and send to Angular.
**EXPECTED vs ACTUAL:** Expected exact ID, actual rounded ID, causing 404s on subsequent updates.
**ERROR MESSAGE:** None. Silent data corruption.
**ROOT CAUSE:** JavaScript represents all numbers as 64-bit floats. `Number.MAX_SAFE_INTEGER` is 2^53 - 1. Java `Long` goes up to 2^63 - 1.
**DEBUGGING PROCESS:** 
- Network Tab: ID in JSON response is correct.
- Angular DevTools: ID in component state is rounded.
**FIX:** Annotate Java field with `@JsonFormat(shape = JsonFormat.Shape.STRING)` to send as string.
**PREVENTION:** Always use `String` for IDs on the frontend.
**REGRESSION TEST:** Parse a large ID in unit tests.

#### FS-LOCAL-021 | BigDecimal as string vs number | DATA CONTRACTS | P2
**SYMPTOMS:** Currency calculations fail in Angular.
**REPRODUCTION:** Spring sends `BigDecimal` as `100.50`, Angular expects a string for precise financial math (e.g. `big.js`).
**EXPECTED vs ACTUAL:** Expected exact decimal, actual float rounding issues in JS.
**ERROR MESSAGE:** Silent calculation error.
**ROOT CAUSE:** Standard Jackson serialization sends BigDecimal as JSON numbers.
**DEBUGGING PROCESS:** 
- Console: Note floating point math issues `0.1 + 0.2 = 0.30000000000000004`.
**FIX:** Use `@JsonFormat(shape = JsonFormat.Shape.STRING)` for financial fields, and use `big.js` in Angular.
**PREVENTION:** Standardize financial data types across the stack.
**REGRESSION TEST:** Math assertion tests on currency fields.

#### FS-LOCAL-022 | LocalDate format mismatch | DATA CONTRACTS | P2
**SYMPTOMS:** Spring rejects date submitted by Angular form.
**REPRODUCTION:** Angular sends `"2023-10-01T00:00:00Z"`, Spring expects `"2023-10-01"`.
**EXPECTED vs ACTUAL:** Expected 200 OK, actual 400 Bad Request.
**ERROR MESSAGE:** `Cannot deserialize value of type java.time.LocalDate`.
**ROOT CAUSE:** Angular's `Date.toISOString()` includes time/zone data, which breaks Java `LocalDate` parsing.
**DEBUGGING PROCESS:** 
- Network Tab: Payload shows full ISO string.
- Spring Boot Logs: Jackson parsing exception.
**FIX:** Format date in Angular before sending: `date.toISOString().split('T')[0]`.
**PREVENTION:** Use a Date utility service in Angular for all API egress.
**REGRESSION TEST:** Assert specific date string format in Angular HTTP tests.

#### FS-LOCAL-023 | LocalDateTime timezone confusion | DATA CONTRACTS | P1
**SYMPTOMS:** Event scheduled for 3 PM saves as 10 PM.
**REPRODUCTION:** Submit a local time to the backend, which parses it using system default timezone.
**EXPECTED vs ACTUAL:** Expected exact time, actual shifted time.
**ERROR MESSAGE:** Silent data corruption.
**ROOT CAUSE:** Sending `LocalDateTime` without timezone context. Spring Boot assumes the server timezone (UTC), while Angular sends it based on the browser's local timezone.
**DEBUGGING PROCESS:** 
- Database: Shows shifted time.
**FIX:** Always use `Instant` or `ZonedDateTime` in Spring Boot, and send full ISO 8601 strings from Angular with `Z`.
**PREVENTION:** Enforce UTC universally.
**REGRESSION TEST:** Test spanning multiple timezones in integration tests.

#### FS-LOCAL-024 | UTC vs local time wrong date display | DATA CONTRACTS | P2
**SYMPTOMS:** "Created At" shows yesterday for a record created today.
**REPRODUCTION:** User in Japan views a record created at 1 AM UTC.
**EXPECTED vs ACTUAL:** Expected 10 AM JST today, actual 1 AM UTC yesterday.
**ERROR MESSAGE:** N/A.
**ROOT CAUSE:** Angular template renders the raw string without the `| date` pipe converting it to the local browser timezone.
**DEBUGGING PROCESS:** 
- Angular DevTools: State shows UTC string.
**FIX:** Use `{{ createdAt | date:'short' }}` which automatically localizes.
**PREVENTION:** Never manually parse dates in components; rely on Angular pipes.
**REGRESSION TEST:** Component test mocking different timezones.

#### FS-LOCAL-025 | Java enum vs TypeScript enum mismatch | DATA CONTRACTS | P2
**SYMPTOMS:** Dropdown selections fail to save.
**REPRODUCTION:** Angular sends `1` (numeric enum), Spring expects `"ACTIVE"` (string enum).
**EXPECTED vs ACTUAL:** Expected 200 OK, actual 400 Bad Request.
**ERROR MESSAGE:** `Cannot deserialize value of type Enum from number`.
**ROOT CAUSE:** TypeScript enums default to numeric indexes unless explicitly assigned string values.
**DEBUGGING PROCESS:** 
- Network Tab: Payload shows integer instead of string.
**FIX:** Use string enums in TypeScript: `enum Status { ACTIVE = 'ACTIVE' }`.
**PREVENTION:** OpenAPI code generation.
**REGRESSION TEST:** API DTO serialization tests.

#### FS-LOCAL-026 | null vs undefined form binding failure | DATA CONTRACTS | P3
**SYMPTOMS:** Partial updates clear fields in the database.
**REPRODUCTION:** Angular form omits a field (sends undefined). Spring Boot expects `null` to clear it, or ignores it.
**EXPECTED vs ACTUAL:** Expected field to remain unchanged, actual cleared or ignored.
**ERROR MESSAGE:** N/A.
**ROOT CAUSE:** `JSON.stringify()` drops `undefined` fields entirely. If Spring Boot uses `Map` or `@JsonInclude`, the behavior changes drastically versus explicit `null`.
**DEBUGGING PROCESS:** 
- Network Tab: Field is completely missing from payload.
**FIX:** Explicitly set form values to `null` instead of `undefined` when clearing.
**PREVENTION:** Strict form typing in Angular 14+.
**REGRESSION TEST:** Partial update E2E tests.

#### FS-LOCAL-027 | Backend removes field, Angular reads undefined | DATA CONTRACTS | P2
**SYMPTOMS:** UI breaks with undefined errors.
**REPRODUCTION:** Backend renames `firstName` to `givenName`.
**EXPECTED vs ACTUAL:** Expected seamless update, actual crash.
**ERROR MESSAGE:** `Cannot read properties of undefined`.
**ROOT CAUSE:** Broken API contract.
**DEBUGGING PROCESS:** 
- Network Tab: Check response payload shape.
**FIX:** Update Angular model and template bindings.
**PREVENTION:** OpenAPI code generation and breaking-change detection in CI.
**REGRESSION TEST:** Contract testing (Pact).


### D. SECURITY & AUTH (FS-LOCAL-030 to 038)

#### FS-LOCAL-030 | 401 — Authorization header missing | SECURITY & AUTH | P1
**SYMPTOMS:** All secured API calls fail immediately.
**REPRODUCTION:** Interceptor not registered in `app.config.ts`.
**EXPECTED vs ACTUAL:** Expected 200 OK, actual 401 Unauthorized.
**ERROR MESSAGE:** `401 Unauthorized`.
**ROOT CAUSE:** JWT token is not being attached to the `Authorization: Bearer <token>` header.
**DEBUGGING PROCESS:** 
- Network Tab: Request Headers block lacks `Authorization`.
**FIX:** Register `authInterceptor` using `provideHttpClient(withInterceptors([authInterceptor]))`.
**PREVENTION:** Automated E2E tests covering authenticated flows.
**REGRESSION TEST:** Unit test the interceptor directly.

#### FS-LOCAL-031 | 403 — wrong error displayed | SECURITY & AUTH | P2
**SYMPTOMS:** User lacks role, but UI shows "Network Error" or crashes.
**REPRODUCTION:** Access admin route as standard user.
**EXPECTED vs ACTUAL:** Expected "Forbidden" toast, actual silent failure.
**ERROR MESSAGE:** `403 Forbidden`.
**ROOT CAUSE:** Spring Security returns 403, but Angular's global error handler doesn't specifically catch 403s to display a meaningful message.
**DEBUGGING PROCESS:** 
- Network Tab: 403 status code.
**FIX:** Update error interceptor to handle `err.status === 403` gracefully.
**PREVENTION:** Map HTTP status codes to specific UI error states.
**REGRESSION TEST:** Trigger a 403 in Cypress and assert toast message.

#### FS-LOCAL-032 | Guard allows route but backend denies | SECURITY & AUTH | P2
**SYMPTOMS:** User can navigate to `/admin`, but data is empty.
**REPRODUCTION:** Angular `AuthGuard` checks role locally, but JWT claims don't match backend reality.
**EXPECTED vs ACTUAL:** Expected blocked navigation, actual navigation then 403.
**ERROR MESSAGE:** 403 Forbidden on API calls on the new page.
**ROOT CAUSE:** Client-side roles fell out of sync with backend database roles.
**DEBUGGING PROCESS:** 
- Angular DevTools: Guard logic passes.
- Network Tab: API calls fail.
**FIX:** Rely on the JWT claims for truth, and handle 403s globally by redirecting to a "Not Authorized" page.
**PREVENTION:** Never trust client-side state for security.
**REGRESSION TEST:** E2E test with degraded roles.

#### FS-LOCAL-033 | Spring Security blocks CORS preflight | SECURITY & AUTH | P1
**SYMPTOMS:** Angular fails to connect to local Spring Boot running on different port.
**REPRODUCTION:** Make POST request.
**EXPECTED vs ACTUAL:** Expected 200 OK, actual CORS error.
**ERROR MESSAGE:** `Response to preflight request doesn't pass access control check`.
**ROOT CAUSE:** The browser sends an `OPTIONS` request. Spring Security intercepts it and demands authentication, returning 401 instead of 200 OK with CORS headers.
**DEBUGGING PROCESS:** 
- Network Tab: `OPTIONS` request returns 401.
**FIX:** Configure Spring Security: `http.cors().and().authorizeRequests().antMatchers(HttpMethod.OPTIONS, "/**").permitAll()`.
**PREVENTION:** Standardize local proxy setups to avoid CORS entirely locally.
**REGRESSION TEST:** Integration test firing OPTIONS request.

#### FS-LOCAL-034 | CSRF token missing | SECURITY & AUTH | P1
**SYMPTOMS:** GET requests work, POST/PUT/DELETE return 403.
**REPRODUCTION:** Submit a form to a stateful Spring Boot application.
**EXPECTED vs ACTUAL:** Expected 200 OK, actual 403 Forbidden.
**ERROR MESSAGE:** `403 Forbidden - Invalid CSRF Token`.
**ROOT CAUSE:** Angular `HttpClient` looks for `XSRF-TOKEN` cookie, but Spring Boot provides `X-CSRF-TOKEN` by default or cookie is missing.
**DEBUGGING PROCESS:** 
- Network Tab: Missing `X-XSRF-TOKEN` header on POST request.
**FIX:** Align Angular's `HttpClientXsrfModule` config with Spring Boot's CSRF configuration, or disable CSRF if using purely stateless JWTs.
**PREVENTION:** Security architecture alignment documentation.
**REGRESSION TEST:** POST request test asserting CSRF header presence.

#### FS-LOCAL-035 | HttpOnly cookie not sent | SECURITY & AUTH | P1
**SYMPTOMS:** Authentication works, but subsequent requests are unauthenticated.
**REPRODUCTION:** Use cookie-based sessions/JWTs on different local domains (e.g., localhost:4200 and localhost:8080).
**EXPECTED vs ACTUAL:** Expected cookie attached, actual cookie dropped by browser.
**ERROR MESSAGE:** `401 Unauthorized`.
**ROOT CAUSE:** Angular `HttpClient` does not send cookies cross-origin by default.
**DEBUGGING PROCESS:** 
- Network Tab: `Cookie` header is missing in Request Headers.
**FIX:** Set `withCredentials: true` in the Angular HTTP request or interceptor.
**PREVENTION:** Universal interceptor configuration.
**REGRESSION TEST:** Unit test the interceptor for `withCredentials`.

#### FS-LOCAL-036 | Refresh interceptor infinite loop | SECURITY & AUTH | P1
**SYMPTOMS:** Browser hangs, millions of requests sent.
**REPRODUCTION:** Token expires. Interceptor catches 401, calls `/refresh`. Refresh endpoint also returns 401. Interceptor catches it and calls `/refresh` again.
**EXPECTED vs ACTUAL:** Expected logout, actual infinite loop crashing backend/browser.
**ERROR MESSAGE:** Browser crash or backend DDoS.
**ROOT CAUSE:** The 401 handler does not exclude the `/refresh` endpoint itself.
**DEBUGGING PROCESS:** 
- Network Tab: Thousands of `/refresh` requests.
**FIX:** Add a check in the interceptor: `if (req.url.includes('/refresh')) { return logout(); }`.
**PREVENTION:** Strict state machine logic in auth interceptors.
**REGRESSION TEST:** Unit test simulating 401 on refresh endpoint.

#### FS-LOCAL-037 | Logout doesn't clear Angular state | SECURITY & AUTH | P2
**SYMPTOMS:** User logs out, logs in as a different user, sees previous user's data.
**REPRODUCTION:** Log out without hard refresh.
**EXPECTED vs ACTUAL:** Expected clean state, actual polluted global state.
**ERROR MESSAGE:** Data leakage.
**ROOT CAUSE:** `NgRx` or `SignalStore` state was not reset on logout.
**DEBUGGING PROCESS:** 
- Angular DevTools: State tree still holds old user data.
**FIX:** Dispatch a `[Auth] Logout` action that uses a meta-reducer to reset all state to initial, or explicitly reset global signals.
**PREVENTION:** Centralize state reset logic attached to the logout event.
**REGRESSION TEST:** E2E test simulating sequential logins.

#### FS-LOCAL-038 | Logout doesn't invalidate Spring Boot session | SECURITY & AUTH | P1
**SYMPTOMS:** Logged out user can still use old JWT/Session to make requests via Postman.
**REPRODUCTION:** Click logout, copy token, paste into Postman, request succeeds.
**EXPECTED vs ACTUAL:** Expected 401, actual 200 OK.
**ERROR MESSAGE:** Security vulnerability.
**ROOT CAUSE:** Stateless JWTs cannot be invalidated unless using a token denylist in Redis, or if using sessions, the `/logout` endpoint wasn't called.
**DEBUGGING PROCESS:** 
- Postman: Send old token, observe success.
**FIX:** Implement a Redis JWT blocklist, or ensure Angular calls the backend `/logout` endpoint to invalidate the session cookie before clearing local state.
**PREVENTION:** Security architecture reviews.
**REGRESSION TEST:** API test attempting to use a logged-out token.


## 10. CI/CD ISSUES
Pipeline builds often fail due to environment mismatches (FS-LOCAL-006). If an Angular build uses `environment.prod.ts` but the deployment expects `environment.staging.ts`, API calls will fail immediately in the deployed environment.
Automated contract testing in CI prevents data contract issues (FS-LOCAL-020 to 027). Tools like Pact can fail a CI build if Spring Boot changes a DTO field from `BigDecimal` to `String` without a corresponding change in the Angular consumer tests.

## 11. PRODUCTION ISSUES
CORS rules differ radically in production vs local `proxy.conf.json`. Issues like FS-LOCAL-010 (CORS Preflight) frequently reappear during initial production deployments when the frontend and backend are hosted on different domains (e.g., `app.company.com` and `api.company.com`).
Production environments also introduce load balancers and reverse proxies (Nginx/HAProxy) which can strip headers, causing unexpected Auth issues (FS-LOCAL-030) or changing the apparent client IP.

## 12. FULL-STACK INTERACTION
The network boundary is where 99% of these bugs live. Proper typing, strict OpenAPI codegen, and robust Angular HTTP Interceptors bridge the gap between the frontend UI state and backend Spring Boot processing. 
For instance, a `Date` object in JavaScript is inherently a specific point in time, but `LocalDate` in Java is a date without a time or timezone. The interaction between these two distinct paradigms requires explicit serialization rules, usually enforcing ISO-8601 strings across the wire.

## 13. DEBUGGING PROCESS
Always isolate the layer sequentially when dealing with a full-stack bug: 
1. **Angular Component State:** Use Angular DevTools. Is the data correct in memory before the `HttpClient` call?
2. **Browser Network Tab:** Inspect the exact payload leaving the browser. Did `JSON.stringify` strip undefined fields? Was the timezone offset applied automatically?
3. **Proxy/Gateway Layer:** Did the request route correctly? Are headers being dropped?
4. **Spring Boot Controller:** Use breakpoints. Did Jackson deserialize the JSON into the DTO correctly?
5. **Database:** Did Hibernate persist the entity with the correct precision?

## 14. ROOT CAUSE ANALYSIS
Most issues stem from assumptions made by frontend engineers about backend behavior (e.g., assuming pagination exists, assuming dates are UTC), and vice-versa (e.g., backend developers assuming Enums will be sent as strings rather than numeric indexes). Conducting a 5-Whys analysis on these issues almost always points to a lack of shared data contracts.

## 15. FIX
Implement the correct fix at the correct layer. Do not fix a timezone issue in Angular by manually adding 5 hours if the database is storing it incorrectly. Fix the root cause at the source of truth. If Spring Boot validation is failing, fix the validation logic or the frontend input, do not attempt to bypass it.

## 16. PREVENTION
**OpenAPI Code Generation:** This is the silver bullet for data contract issues. By defining the API in a YAML file and generating both the Spring Boot Interfaces and the Angular Services/Models, you eliminate almost all Data Contract issues (FS-LOCAL-020 to 027). The compiler will catch mismatches before the code ever runs.

## 17. MONITORING / OBSERVABILITY
Trace IDs (Sleuth/Micrometer) connecting Angular HTTP requests to Spring Boot logs are critical for diagnosing HTTP Communication issues in production. When an Angular interceptor catches a 500 error, it should log the specific `X-B3-TraceId` so developers can query Splunk/Datadog and instantly find the exact Spring Boot stack trace that caused it.

## 18. PERFORMANCE CONSIDERATIONS
Large responses (FS-LOCAL-016) must be paginated. Never allow Spring Boot to return an unbounded `List<T>`, as it will freeze the browser's main thread during JSON parsing. Implement Virtual Scrolling (`@angular/cdk/scrolling`) on the frontend to efficiently render large datasets without destroying the DOM performance.

## 19. SECURITY CONSIDERATIONS
Auth issues (FS-LOCAL-030 to 038) often expose sensitive routes or fail to invalidate sessions. 
- Always rely on `HttpOnly` cookies for JWT tokens where possible to mitigate Cross-Site Scripting (XSS).
- Ensure CSRF protection is perfectly aligned between Angular and Spring. If using stateless APIs without cookies, CSRF is naturally mitigated, but if relying on JSESSIONID, strict CSRF headers must be enforced.

## 20. TESTING STRATEGY
**Contract Testing:** Use Pact to ensure both sides agree on the API, preventing all response type mismatches (FS-LOCAL-017) and missing fields (FS-LOCAL-027).
**E2E Testing:** Use Cypress or Playwright to test the full flow, capturing network requests to assert that the Angular UI gracefully handles backend 500s or 401s without crashing.

## 21. EXERCISES
1. **Trigger CORS:** Stop your local proxy and attempt to call the Spring Boot backend directly from `localhost:4200` to `localhost:8080` without `@CrossOrigin`. Observe the exact preflight failure.
2. **Precision Loss:** Send a Long ID of `9999999999999999` from Spring Boot to Angular. Log it to the console in Angular. Observe the rounding. Fix it using `@JsonFormat`.
3. **Auth Loop:** Intentionally write a bad HTTP Interceptor that redirects to `/refresh` on 401, but forget to exclude the `/refresh` endpoint itself. Watch the browser network tab explode.

## 22. BREAK-AND-FIX LAB
**Lab Challenge:**
You are given a broken branch `feature/broken-contracts`. Complete the lab by fixing the injected errors based on the symptoms provided in the local issues list above.
1. Fix the proxy configuration so the app boots.
2. Fix the file upload component by removing the hardcoded `Content-Type`.
3. Fix the DatePicker by truncating the ISO string before it hits the Spring Boot `LocalDate` endpoint.
4. Implement the logout logic to explicitly clear the `SignalStore` state.

## 23. EXPERT QUESTIONS
1. **Question:** How do you debug an HTTP 500 when Spring Boot logs show absolutely nothing in the console?
   *Answer:* Check the Spring Security filter chain or Tomcat global exception handlers. If an error occurs before the `DispatcherServlet` (e.g., a bad JWT filter crashing), standard controller `@ExceptionHandler` advice won't catch it, and it may fail silently in application logs while Tomcat returns a 500 to the client.
2. **Question:** Why does a Java Long precision loss occur in JavaScript, and how do we architect around it globally?
   *Answer:* JavaScript Numbers are IEEE 754 64-bit floats, which lose precision beyond `2^53 - 1` (`9007199254740991`). Java `Long` goes up to `2^63 - 1`. To fix globally, configure the Jackson `ObjectMapper` in Spring Boot to serialize all `Long` types as strings.
3. **Question:** How do you prevent CSRF token issues in stateless JWT applications?
   *Answer:* True stateless JWT applications utilizing the `Authorization: Bearer` header are inherently immune to CSRF because the browser does not automatically attach the token to cross-site requests (unlike cookies). If you must use cookies for JWT storage (for XSS protection), you must use `HttpOnly` combined with `SameSite=Strict`, or implement the Double-Submit Cookie pattern.
