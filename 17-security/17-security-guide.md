# Module 17: Security Deep Dive

---

## 1. WHAT
Security in the Angular + Spring Boot stack is a multi-layered defense architecture encompassing frontend cross-site scripting (XSS) prevention, safe token storage, content security policies (CSP), and robust backend authentication and authorization via Spring Security.

## 2. WHY
Modern enterprise web applications are primary targets for cyberattacks. A single security misconfiguration—such as improperly trusting user input, mishandling JWTs, or lacking CSRF protection—can lead to total system compromise, data breaches, and severe regulatory penalties.

## 3. INTERNAL MENTAL MODEL
Security is not a feature; it's a boundary constraint applied at every layer of the application.

```text
+-------------------------------------------------------------+
|                     User Browser Area                       |
|                                                             |
| 1. Content Security Policy (CSP) restricts external scripts |
| 2. Angular built-in DomSanitizer neuters XSS in templates   |
| 3. Tokens stored safely (e.g., HttpOnly Cookies)            |
+-------------------------------------------------------------+
                               │  
                               │ HTTPS (TLS 1.2/1.3)
                               ▼
+-------------------------------------------------------------+
|                      Spring Boot Backend                    |
|                                                             |
| 1. CORS Filter (Restricts origins)                          |
| 2. CSRF Filter (Validates X-XSRF-TOKEN if using cookies)    |
| 3. Spring Security Context (Validates Authentication)       |
| 4. @PreAuthorize / @Secured (Enforces Authorization)        |
+-------------------------------------------------------------+
```

CRITICAL AXIOM: Angular route guards (`canActivate`, `canMatch`) are **NOT** security boundaries. They are UI navigation helpers. Backend authorization is the only real security boundary.

## 4. HOW IT WORKS
1. **Frontend Rendering:** Angular treats all values bound to the DOM (via interpolation `{{ }}` or property binding `[prop]`) as untrusted by default and automatically sanitizes them.
2. **Token Management:** The client receives authentication tokens and must store them safely, balancing XSS risk against CSRF risk.
3. **HTTP Requests:** Angular attaches necessary credentials (Cookies or Bearer tokens) to outbound API requests. For cookie-based auth, it automatically reads the `XSRF-TOKEN` cookie and attaches it as an `X-XSRF-TOKEN` header.
4. **Backend Validation:** Spring Security intercepts the request, verifies CORS, validates CSRF tokens, authenticates the credential, and authorizes access to the endpoint.

## 5. MODERN IMPLEMENTATION
A modern, secure setup utilizes strict CSP with nonces, HttpOnly cookies for session tokens, and leverages Angular's implicit sanitization without manual bypasses.

**Backend (Spring Security with HttpOnly Cookies & CSRF):**
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
            )
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }
}
```

**Frontend (Angular CSP in `index.html`):**
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'nonce-random123'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.enterprise.com;">
```

## 6. LEGACY / ENTERPRISE REALITY
Legacy applications often store JWTs directly in `localStorage`. 

- `localStorage`: Vulnerable to any XSS attack on the domain. Simple to implement, but risky.
- `sessionStorage`: Also vulnerable to XSS, but scoped to the tab, offering a marginal reduction in attack surface.
- `HttpOnly Cookie`: Immune to XSS reading the token, but susceptible to Cross-Site Request Forgery (CSRF). Requires complex CORS and CSRF configurations.

**Migration:** Move from `localStorage` JWTs to a Backend-For-Frontend (BFF) pattern or HttpOnly cookies combined with strict CSRF protection.

## 7. PRACTICAL EXAMPLE
In an enterprise banking application, a user transfers funds.
1. The user logs in; Spring Boot issues an `HttpOnly` Secure cookie containing the session identifier and a non-HttpOnly `XSRF-TOKEN` cookie.
2. The user submits a transfer form.
3. Angular's `HttpClient` automatically reads the `XSRF-TOKEN` and sends it as the `X-XSRF-TOKEN` header.
4. Spring Boot verifies the CSRF header matches the expected value, preventing an attacker on `evil-site.com` from forging the transfer request via a hidden form submission.

## 8. COMMON MISTAKES
1. **Bypassing Sanitization:** Using `DomSanitizer.bypassSecurityTrustHtml()` on user-supplied content (e.g., comments or forum posts) without server-side sanitization.
2. **Secrets in Environment Files:** Believing `environment.prod.ts` is secret. It is compiled directly into the JavaScript bundle. Any API keys placed there are public.
3. **Wildcard CORS:** Setting `Access-Control-Allow-Origin: *` while also allowing credentials, completely breaking origin-based security boundaries.
4. **Relying on Route Guards for Security:** Hiding a button or using a route guard and assuming the underlying API is safe from direct invocation.

## 9. LOCAL ISSUES
- **CORS Failures in Local Dev:** Because the Angular dev server (`localhost:4200`) and Spring Boot (`localhost:8080`) are different origins, CORS must be explicitly configured or bypassed using the Angular CLI proxy (`proxy.conf.json`).

## 10. CI/CD ISSUES
- **Vulnerable Dependencies:** Failing CI builds due to `npm audit` finding critical vulnerabilities in deep transitive dependencies. Use lockfile integrity checking (`npm ci` instead of `npm install`).
- **Secret Management:** Hardcoding secrets in source code instead of injecting them via CI/CD environment variables or a vault during the Spring Boot build process.

## 11. PRODUCTION ISSUES
- **CSP Blocking Inline Styles:** Angular heavily relies on inline styles for component encapsulation. A strict CSP without `'unsafe-inline'` for `style-src` will break Angular styling.
- **Mixed Content:** Loading HTTP scripts/assets on an HTTPS production site, which browsers will block.

## 12. FULL-STACK INTERACTION
Security requires continuous handshake and agreement between Angular and Spring Boot:
- Angular relies on Spring Boot to set `HttpOnly` and `Secure` flags on auth cookies.
- Spring Boot relies on Angular's built-in `HttpClient` interceptors to bounce the `XSRF-TOKEN` back as a header.
- Angular relies on the browser to enforce CSP headers sent by Spring Boot or the API Gateway (Nginx).

## 13. DEBUGGING PROCESS
1. **XSS Issues:** Inspect the DOM for improperly escaped characters. Check where `DomSanitizer` is injected.
2. **CSRF Failures:** Check the Network tab in DevTools. Verify the `XSRF-TOKEN` cookie is set, not `HttpOnly`, and that the `X-XSRF-TOKEN` header is present on POST/PUT/DELETE requests.
3. **CORS Errors:** Check the preflight `OPTIONS` request. Ensure the backend returns the exact origin in `Access-Control-Allow-Origin`, not `*`, if credentials are required.

## 14. ROOT CAUSE ANALYSIS
A common security breach occurs when developers assume Angular's default sanitization is a magic bullet, but then explicitly bypass it using `bypassSecurityTrustHtml` to render rich text from a database, forgetting that malicious `<script>` or `<img>` tags might have been injected via an API directly, bypassing frontend validation.

## 15. FIX
Never bypass security trusting user input. Instead, use a robust, server-side HTML sanitizer (like OWASP Java HTML Sanitizer) before storing data, or use a safe client-side library like DOMPurify before rendering it in Angular.

```typescript
import { Component, input, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import * as DOMPurify from 'dompurify';

@Component({
  selector: 'app-safe-html',
  template: `<div [innerHTML]="safeContent()"></div>`
})
export class SafeHtmlComponent {
  htmlContent = input<string>('');
  private sanitizer = inject(DomSanitizer);

  safeContent() {
    // 1. Purify with DOMPurify
    const cleanHtml = DOMPurify.sanitize(this.htmlContent());
    // 2. Safely tell Angular to trust the purified HTML
    return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
  }
}
```

## 16. PREVENTION
- Enforce ESLint rules preventing the injection of `DomSanitizer` unless explicitly reviewed.
- Utilize architectural safeguards: completely disable Angular DevTools in production via the build optimizer.
- Implement Sub-Resource Integrity (SRI) for all external CDN scripts to prevent supply-chain attacks.

## 17. MONITORING / OBSERVABILITY
- Configure the `Content-Security-Policy-Report-Only` header to send violation reports to a logging endpoint (e.g., Sentry) before enforcing strict CSP, to catch breaking changes in production.
- Monitor Spring Security audit logs for repeated 401 Unauthorized or 403 Forbidden events, indicating brute-force or authorization traversal attempts.

## 18. PERFORMANCE CONSIDERATIONS
- **Token Storage:** Reading from `localStorage` is synchronous and can block the main thread if accessed frequently. Caching the token in memory (Angular service state) is faster and more secure against persistent XSS.
- **Sanitization Overhead:** Extensive runtime sanitization of large HTML documents can cause frame drops. Sanitize on the backend when possible.

## 19. SECURITY CONSIDERATIONS
- **Open Redirects:** Never blindly use a URL parameter like `?returnUrl=` in the Angular Router without validating it's a relative path, otherwise an attacker can redirect users to a phishing site.
- **Memory Exposure:** Sensitive data (PII, tokens) in component state can be extracted via memory dumps. Clear sensitive state immediately when no longer needed.
- **Clickjacking:** Protect the application by ensuring the backend or CDN sends the `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'none'` headers.

## 20. TESTING STRATEGY
- **Unit Testing:** Assert that components properly bind data using interpolation `{{ }}` rather than `[innerHTML]`.
- **Integration Testing:** Write `@SpringBootTest` cases specifically testing the CSRF filter and CORS configurations.
- **E2E/Penetration Testing:** Run automated Dynamic Application Security Testing (DAST) tools like OWASP ZAP against the deployed application.

## 21. EXERCISES
1. Configure Spring Boot to serve a strict Content Security Policy header and verify it in the browser's Network tab.
2. Implement a custom Angular HTTP Interceptor that handles CSRF token extraction for a non-standard header name.
3. Use DOMPurify in an Angular pipe to safely render markdown-generated HTML.

## 22. BREAK-AND-FIX LAB
**Defect ANG-SEC-001: XSS via bypassSecurityTrustHtml on user content**
- **Scenario:** A developer uses `bypassSecurityTrustHtml` to display user comments that contain rich text formatting, trusting the client-side form validation.
- **Reproduction:** An attacker uses an API tool like Postman to POST a comment containing `<img src="x" onerror="alert(document.cookie)">`, bypassing the form. When another user views the comment, the script executes.
- **Diagnostic Steps:** Inspect the DOM and observe the malicious payload was not stripped by Angular because the developer explicitly bypassed the trust mechanism.
- **Fix:** Remove `bypassSecurityTrustHtml`. If rich text is strictly required, integrate DOMPurify to strip malicious tags before passing it to Angular's DOM binding, and implement server-side validation rejecting payloads containing `<script>` or on-event attributes.

## 23. EXPERT QUESTIONS
1. **"Why is `localStorage` considered highly dangerous for storing JWTs in a modern enterprise application, and what is the definitive architectural solution?"**
   *(Answer: `localStorage` is accessible via JavaScript, meaning any successful XSS attack immediately exposes the JWT, leading to full session hijacking. The architectural solution is the Backend-For-Frontend (BFF) pattern, where the BFF handles the OAuth2/OIDC flow and issues an encrypted, HttpOnly, Secure cookie to the Angular app, completely removing tokens from the browser's JS context.)*

2. **"If we deploy Angular as static files on an S3 bucket or Nginx, how do we handle dynamic secrets like API URLs or Feature Flags without recompiling the bundle for every environment?"**
   *(Answer: Angular `environment.ts` files are compiled into the bundle and are immutable post-build. To handle dynamic config, we use a "Run-Time Configuration" pattern. We deploy a dynamic `config.json` file in the `assets/` folder, which the CI/CD pipeline replaces per environment, and the Angular app fetches it via `APP_INITIALIZER` before bootstrapping.)*

3. **"Explain the exact mechanism by which Angular's built-in `HttpClientXsrfModule` interacts with Spring Security to prevent CSRF attacks."**
   *(Answer: Spring Security's `CookieCsrfTokenRepository` sends a CSRF token in an unencrypted cookie (typically `XSRF-TOKEN`). Because of the Same-Origin Policy, only our frontend domain can read this cookie. Angular's `HttpClientXsrfModule` automatically intercepts outgoing mutating requests (POST/PUT/DELETE), reads the `XSRF-TOKEN` cookie value, and attaches it as an HTTP header (`X-XSRF-TOKEN`). Spring Security verifies that the header matches the expected token, proving the request originated from our trusted frontend, not a hidden form on an attacker's domain.)*
