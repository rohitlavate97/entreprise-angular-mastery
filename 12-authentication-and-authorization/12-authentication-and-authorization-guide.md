# Module 12: Authentication and Authorization

## 1. WHAT
Authentication verifies *who* the user is, while authorization dictates *what* the user is allowed to do; in a modern Angular + Spring Boot enterprise architecture, this is typically orchestrated via token-based flows or secure sessions with stateless backend verification.

## 2. WHY
Modern enterprise applications demand scalability, robust cross-origin security, seamless user experience, and fine-grained access control. A naive auth implementation exposes the business to severe risks (XSS, CSRF, session hijacking), while a robust architecture protects sensitive data while maintaining high performance without overwhelming the backend with state management.

## 3. INTERNAL MENTAL MODEL

```text
[Browser / Angular]                            [Spring Boot Server]
       |                                                |
       |------- 1. POST /api/auth/login --------------->| (Validates credentials)
       |                                                |
       |<------ 2. Returns Access + Refresh Token ------| (Or Sets HttpOnly Cookie)
       |                                                |
       |------- 3. GET /api/secure + Access Token ----->| (Filter extracts token)
       |                                                |
       |<------ 4. 401 Unauthorized (Token Expired) ----| 
       |                                                |
[Auth Interceptor]                                      |
       |                                                |
       |---[Lock] 5. POST /api/auth/refresh ----------->| (Validates refresh token)
       |                                                |
       |<------ 6. Returns New Access Token ------------|
       |                                                |
       |------- 7. Re-executes GET /api/secure -------->| (With new token)
       |                                                |
       |<------ 8. 200 OK + Payload --------------------|
```

### Three Production Auth Models

#### Model A: Bearer Access Token (Stateless)
- **Design:** Backend issues a long-lived JWT. Angular stores it in memory or localStorage and sends it via `Authorization: Bearer <token>`.
- **Security Posture:** Highly vulnerable to XSS if stored in localStorage. No CSRF risk.
- **Scalability:** Very high. Backend is completely stateless.
- **Refresh / Logout:** No real token refresh. Logout requires client-side token deletion, but the token remains valid on the server until expiry unless a complex blacklist is implemented.

#### Model B: Access Token + Refresh Token (Stateless + Rotation)
- **Design:** Backend issues a short-lived access token (e.g., 5 mins) and a long-lived, single-use refresh token (e.g., 7 days). Both can be sent as JSON payloads or the refresh token can be an HttpOnly cookie.
- **Security Posture:** Mitigates the risk of access token theft by making it short-lived. Refresh token rotation helps detect stolen refresh tokens.
- **Scalability:** High. Access token validation is stateless. Refresh requires a DB hit but occurs infrequently.
- **Refresh / Logout:** Angular automatically refreshes access tokens. Logout invalidates the refresh token in the backend DB and clears client state.

#### Model C: HttpOnly Secure Cookie (Session or Token in Cookie)
- **Design:** Backend issues a Session ID or a JWT but instructs the browser to store it in a `Set-Cookie: HttpOnly, Secure, SameSite=Strict` header. Angular never touches the token directly.
- **Security Posture:** Immune to XSS token theft (JS cannot read the cookie). Vulnerable to CSRF unless `SameSite` or an explicit CSRF token is used.
- **Scalability:** Medium to High (depending on if it's a stateful session vs stateless JWT in the cookie). Requires sticky sessions if stateful.
- **Refresh / Logout:** Handled transparently via cookies. Logout requires an API call to clear the cookie.

## 4. HOW IT WORKS
1. **Login:** User submits credentials. Spring Security `AuthenticationManager` authenticates the request.
2. **Token Generation:** Spring Boot generates JWTs (Access & Refresh) and returns them.
3. **Storage & State:** Angular stores tokens (e.g., `sessionStorage`) and updates a Signal-based `AuthService` state.
4. **Interception:** A functional Angular `HttpInterceptor` clones outgoing requests, attaching the Access Token header.
5. **Authorization (Backend):** Spring Security `JwtAuthenticationFilter` validates the signature, extracts roles, and builds the `SecurityContext`.
6. **Method Security:** Spring's `@PreAuthorize` evaluates if the extracted roles permit execution of the service method.
7. **Expiry & Refresh:** If the backend returns `401 Unauthorized`, the Angular interceptor catches it, pauses in-flight requests, calls the refresh endpoint, updates tokens, and replays the queued requests.

## 5. MODERN IMPLEMENTATION

### Angular: Signal-based Auth State and Functional Interceptors (Angular 19+)

```typescript
// auth.service.ts
import { Injectable, signal, computed } from '@angular/core';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private state = signal<AuthState>({ user: null, accessToken: null });
  
  public readonly user = computed(() => this.state().user);
  public readonly isAuthenticated = computed(() => !!this.state().accessToken);
  public readonly hasRole = (role: string) => computed(() => this.state().user?.roles.includes(role) ?? false);

  login(token: string, user: User) {
    this.state.set({ user, accessToken: token });
    sessionStorage.setItem('access_token', token);
  }

  logout() {
    this.state.set({ user: null, accessToken: null });
    sessionStorage.removeItem('access_token');
    // Notify other tabs
    new BroadcastChannel('auth_channel').postMessage('LOGOUT');
  }
}
```

### Refresh Token Interceptor with Concurrency Lock

```typescript
// auth.interceptor.ts
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { throwError, BehaviorSubject } from 'rxjs';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = sessionStorage.getItem('access_token');

  let authReq = req;
  if (token) {
    authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/auth/refresh')) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refreshToken().pipe(
            switchMap((newToken: string) => {
              isRefreshing = false;
              refreshTokenSubject.next(newToken);
              return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
            }),
            catchError((err) => {
              isRefreshing = false;
              authService.logout();
              return throwError(() => err);
            })
          );
        } else {
          // Wait for refresh to complete
          return refreshTokenSubject.pipe(
            filter(token => token !== null),
            take(1),
            switchMap(token => {
              return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};
```

### Spring Boot 3.x Security Filter Chain

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // Disabled for pure stateless API (Model B)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
```

## 6. LEGACY / ENTERPRISE REALITY
- **Legacy Interceptors:** `class AuthInterceptor implements HttpInterceptor` registered via `HTTP_INTERCEPTORS` multi-provider in an `NgModule`.
- **Auth State:** BehaviorSubjects stored inside singletons, often leading to race conditions if subscribed to synchronously.
- **Refresh Mechanisms:** Often poorly implemented without concurrency controls, leading to simultaneous refresh requests on route load.
- **Migration:** Convert class-based interceptors to functional ones (`provideHttpClient(withInterceptors([authInterceptor]))`), migrate auth state to Signals.

## 7. PRACTICAL EXAMPLE
**Enterprise Banking App:** A user accesses the dashboard which fires 4 parallel HTTP calls (Account Balance, Transactions, Notifications, Profile). The access token has expired.
Instead of 4 refresh tokens firing (which would invalidate rotating refresh tokens in the DB and log the user out), the Auth Interceptor catches the first 401, pauses the other 3 requests, successfully rotates the token, and replays all 4 calls seamlessly.
Role-based UI visibility (`@if(authService.hasRole('ADMIN')())`) hides administrative actions, while backend `@PreAuthorize("hasRole('ADMIN')")` prevents actual API execution even if the UI is bypassed.

## 8. COMMON MISTAKES
1. **Refresh Race Conditions:** Failing to lock the refresh call, resulting in simultaneous refresh requests that invalidate rotating tokens.
2. **Missing Backend Checks:** Relying on Angular Route Guards for absolute security instead of verifying permissions on the Spring Boot backend.
3. **Local Storage Abuse:** Storing sensitive long-lived tokens in localStorage, exposing the application to XSS token theft.
4. **Retry Loops:** Failing to exclude the `/refresh` URL from the retry interceptor, causing an infinite loop of 401s when the refresh token itself expires.
5. **Multi-Tab Desync:** Logging out in one tab but leaving active tokens in other tabs because local state wasn't synced.

## 9. LOCAL ISSUES
- Interceptors firing in an unexpected order (e.g., Error Interceptor running before Auth Interceptor) because of the order they were provided in `withInterceptors()`.
- CORS issues masking 401 Unauthorized errors as `0 Unknown Error` in the browser console.

## 10. CI/CD ISSUES
- Integration tests failing because MockMvc environments do not evaluate `@PreAuthorize` unless explicit test configurations are supplied.
- Hardcoded JWT secrets in environment files causing test failures across different stages.

## 11. PRODUCTION ISSUES
- Skewed server clocks causing JWT `exp` or `nbf` (not before) validation to fail unpredictably.
- WAF (Web Application Firewall) stripping `Authorization` headers.
- Multi-instance backend concurrency conflicts when rotating refresh tokens (Instance A validates the refresh token, while Instance B processes the overlapping parallel request).

## 12. FULL-STACK INTERACTION
Angular handles the UX of authentication (login forms, guards, redirects) and request augmentation (interceptors). Spring Boot guarantees system integrity.
If an attacker uses Postman to call `/api/transfer-funds`, Angular's guards and UI logic are entirely bypassed. Thus, Spring Security's filter chain and method-level security (`@PreAuthorize`) form the definitive security boundary.

## 13. DEBUGGING PROCESS
1. **Network Tab:** Filter by `XHR/Fetch`. Verify if the `Authorization` header is present and structurally valid (e.g., `Bearer ey...`).
2. **Network Tab:** Check for `401 Unauthorized` responses. Did the refresh call fire? Did it fire multiple times?
3. **Application Tab:** Inspect `sessionStorage` or Cookies to confirm token presence and expiration.
4. **Spring Logs:** Check for `JwtException` or `SignatureException` indicating a malformed or expired token.
5. **Spring Trace:** Enable `logging.level.org.springframework.security=TRACE` to see exactly which filter in the chain blocked the request.

## 14. ROOT CAUSE ANALYSIS
A common issue is intermittent logouts when opening the dashboard. 
*Why?* The dashboard fires multiple parallel requests. If the access token is expired, all requests return 401 almost simultaneously. 
*Why the logout?* A naive interceptor fires a refresh request for *each* 401. If the backend uses Token Rotation (where using a refresh token issues a new one and revokes the old one), Request 1 rotates the token successfully. Request 2 arrives microseconds later with the *old* revoked refresh token. The backend detects this as a reuse attack, revokes the entire token family, and returns 401, forcing an immediate logout in the UI.

## 15. FIX
Implement the `BehaviorSubject` concurrency lock in the interceptor (shown in Section 5). 
When the first 401 occurs, `isRefreshing` becomes `true`. Subsequent 401s hit the `else` block and wait for the `refreshTokenSubject` to emit the new token.

## 16. PREVENTION
- **Architecture:** Standardize the functional interceptor pattern with built-in concurrency controls.
- **Backend Constraints:** Implement a grace period (e.g., 30 seconds) in Spring Boot for refresh token reuse to account for inevitable network delays and race conditions.
- **Linters:** Enforce rules avoiding hardcoded tokens or missing interceptors.

## 17. MONITORING / OBSERVABILITY
- **Metrics (Spring):** Track `security.authentication.success` vs `security.authentication.failure` rates.
- **Alerting:** High spikes in 401 errors or refresh token reuse detections indicate either a bug in the client interceptor or an active credential stuffing/token theft attack.

## 18. PERFORMANCE CONSIDERATIONS
- **Token Size:** Large JWTs (with heavy payloads) increase HTTP overhead on every request. Keep JWTs lean (user ID, roles).
- **Backend Caching:** Parsing and verifying JWT signatures on every request requires CPU overhead. Use highly optimized libraries (e.g., `jjwt`).
- **DB Hits:** Avoid database lookups in the primary `JwtAuthFilter`. Validation should rely purely on the cryptographic signature and expiration data within the token.

## 19. SECURITY CONSIDERATIONS
- **XSS vs CSRF Tradeoffs:** Model B (Tokens in storage) mitigates CSRF but is vulnerable to XSS. Model C (HttpOnly Cookies) mitigates XSS but is vulnerable to CSRF. Modern enterprise standard usually dictates Model B for SPAs, or Model C with strict SameSite attributes.
- **Refresh Token Theft:** Implement Refresh Token Rotation and Absolute Lifetimes (e.g., max 30 days regardless of activity).
- **Logout:** Ensure logout destroys tokens both locally and on the server. Implement multi-tab logout via `BroadcastChannel` or `storage` events.

## 20. TESTING STRATEGY
- **Unit (Angular):** Test the functional interceptor using `HttpTestingController` to simulate concurrent 401s and verify only one refresh call is made.
- **Integration (Spring Boot):** Use `@WithMockUser(roles = "ADMIN")` to test controller access rules without generating real JWTs.
- **E2E:** Automate login, token expiration wait time, and seamless background refresh via Playwright/Cypress.

## 21. EXERCISES
1. Convert an existing Angular application from class-based to functional interceptors.
2. Implement Multi-Tab logout: when a user clicks "Logout" in Tab A, Tab B should instantly redirect to the login screen.
3. Configure Spring Security to implement a 10-second grace period for refresh token rotation.

## 22. BREAK-AND-FIX LAB: ANG-AUTH-001
- **Objective:** Fix the refresh token race condition causing random logouts.
- **Break:** Remove the `isRefreshing` lock from the interceptor. Create a dashboard that fires 5 simultaneous requests with an expired token.
- **Diagnosis:** Observe the Network tab. You will see 5 `401` errors followed by 5 `/api/auth/refresh` POSTs. The first succeeds, the remaining fail, triggering the `catchError` logout block.
- **Fix:** Restore the `BehaviorSubject` queue. Verify the Network tab shows 5 `401`s -> 1 `/api/auth/refresh` -> 5 replays with the new token.

## 23. EXPERT QUESTIONS
1. **How do you handle authenticating Angular Server-Side Rendering (SSR) requests when using HttpOnly cookies vs LocalStorage?**
   *Answer:* LocalStorage is inaccessible during SSR. With HttpOnly cookies, the Angular server middleware must pass the cookie header from the client's incoming request to the backend API calls made during hydration.
2. **If an access token is compromised, how do we revoke it before its expiration time if the backend validates it purely statelessly?**
   *Answer:* You cannot, unless you introduce state. The common architectural compromise is maintaining a Redis-based "blacklist" of revoked JTI (JWT ID) claims for compromised tokens, checked by the Spring Security filter.
3. **Explain how "Refresh Token Rotation" provides security against token theft and how you detect a breach.**
   *Answer:* Every time a refresh token is used, a new one is issued and the old one is tied to the new one in the DB (a token family). If an attacker steals a refresh token and uses it, the real user's subsequent attempt to use their copy will trigger a reuse detection. The backend invalidates the entire token family, logging out both the user and the attacker immediately.
