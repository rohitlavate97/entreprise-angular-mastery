# Security Hardening Checklist (Angular 19+ & Spring Boot 3.4+)

> **Guiding Principle:** Angular route guards are UI navigation helpers — NEVER security boundaries. Spring Boot security filter chain is the only true authorization boundary.

---

## 1. 🛡️ Angular Frontend Hardening

- [ ] **Sanitization Audit**: Verified zero instances of `bypassSecurityTrustHtml`, `bypassSecurityTrustScript`, or `bypassSecurityTrustResourceUrl` on untrusted user data.
- [ ] **No Secrets in Bundles**: Verified that API keys, private tokens, or database credentials are NEVER placed in `environment.ts` or Angular source code (client bundles are 100% public).
- [ ] **DevTools Disabled in Prod**: Verified `--configuration=production` disables `ng.probe` and Angular DevTools hooks.
- [ ] **Token Storage Strategy**:
  - Bearer tokens stored in-memory / Signal state with short TTL (15 mins).
  - Refresh tokens rotated strictly on each refresh cycle.
- [ ] **Content Security Policy (CSP)**:
  - `default-src 'self'`
  - Nonce-based script loading (`script-src 'self' 'nonce-...'`)
  - No `unsafe-eval` in production builds.

---

## 2. 🔐 Spring Boot 3.4+ Backend Hardening

- [ ] **Spring Security 6+ Filter Chain**:
  - Universal Preflight: `http.authorizeHttpRequests(auth -> auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll())`
  - Stateless Session: `SessionCreationPolicy.STATELESS`
  - Method-Level Security: `@EnableMethodSecurity` enabled with `@PreAuthorize("hasRole('ADMIN')")` on all sensitive controllers.
- [ ] **CORS Configuration**:
  - Explicit origin whitelist configured in `CorsConfigurationSource` (No `*` wildcard with `allowCredentials=true`).
  - Required headers exposed: `X-Request-ID`, `Authorization`, `Link`.
- [ ] **CSRF Defense**:
  - Stateless Bearer token APIs disable CSRF.
  - Cookie-based authentication uses `CookieCsrfTokenRepository.withHttpOnlyFalse()` with `SameSite=Strict`.
- [ ] **Password Hashing**: Passwords stored using `BCryptPasswordEncoder(12)` or `Argon2`.
- [ ] **SQL Injection Prevention**: Spring Data JPA parameterized queries and JPQL (no raw string concatenation).
- [ ] **Rate Limiting**: Spring Cloud Gateway / Bucket4j rate limiting on `/api/v1/auth/login` to prevent brute force.

---

## 3. 🌐 Network & Infrastructure Hardening

- [ ] **HTTPS Everywhere**: Strict HSTS header (`Strict-Transport-Security`) enforced with 1-year duration.
- [ ] **Nginx Reverse Proxy Masking**: `server_tokens off;` hides Nginx/Tomcat version banners.
- [ ] **Correlation Trace ID**: `X-Request-ID` sanitized and logged across all service boundaries.
