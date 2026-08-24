# Module 11: HTTP and API Integration

---

## 1. WHAT
HTTP and API Integration in Angular revolves around the `HttpClient` service—a powerful, RxJS-based API that manages asynchronous HTTP requests, request/response transformations via functional interceptors, error handling, retry strategies, and context propagation between the frontend and backend servers (e.g., Spring Boot).

---

## 2. WHY
- **Declarative Asynchrony**: `HttpClient` heavily leverages RxJS Observables, enabling operators like `retry`, `catchError`, and `switchMap` for complex API workflows, cancellation, and caching.
- **Cross-Cutting Concerns**: Interceptors provide a centralized way to handle authentication tokens, request IDs, logging, and global error handling without polluting component logic.
- **Enterprise Robustness**: Real-world applications require sophisticated resilience mechanisms (exponential backoff), progress tracking for large uploads, and type-safe data contracts when communicating with backend services like Spring Boot.
- **Modern Performance**: Using `withFetch()` avoids legacy `XMLHttpRequest` overhead and provides better integration with Server-Side Rendering (SSR) and edge workers.

---

## 3. INTERNAL MENTAL MODEL

### The Interceptor Pipeline and Request Lifecycle

```text
+===========================================================================================+
|                           HTTP CLIENT INTERCEPTOR PIPELINE                                |
|                                                                                           |
|  ┌──────────────────┐                                                                     |
|  │ Component / Store│                                                                     |
|  │ httpClient.get() │                                                                     |
|  └────────┬─────────┘                                                                     |
|           │ Observable<Response>                                                          |
|           ▼                                                                               |
|  ┌─────────────────────────────────────────────────────────────┐                          |
|  │                 Angular HttpClient                          │                          |
|  │                                                             │                          |
|  │  ┌────────────────┐       ┌────────────────┐                │                          |
|  │  │ Interceptor 1  │ ────► │ Interceptor 2  │ ────► ...      │                          |
|  │  │ (e.g., Auth)   │       │ (e.g., Logging)│                │                          |
|  │  │ req.clone()    │ ◄──── │ handle(req)    │ ◄────          │                          |
|  │  └────────────────┘       └────────────────┘                │                          |
|  │           │                        │                        │                          |
|  │           ▼                        ▼                        │                          |
|  │  ┌───────────────────────────────────────────────────────┐  │                          |
|  │  │                   HttpBackend                         │  │                          |
|  │  │             (HttpXhrBackend or fetch API)             │  │                          |
|  │  └─────────────────────────┬─────────────────────────────┘  │                          |
|  └────────────────────────────┼────────────────────────────────┘                          |
|                               │                                                           |
|                               ▼                                                           |
|  ┌─────────────────────────────────────────────────────────────┐                          |
|  │                      BROWSER DOMAIN                         │                          |
|  │             Network / Fetch API / XMLHttpRequest            │                          |
|  └────────────────────────────┬────────────────────────────────┘                          |
|                               │ HTTP Request                                              |
|                               ▼                                                           |
|  ┌─────────────────────────────────────────────────────────────┐                          |
|  │                     SPRING BOOT BACKEND                     │                          |
|  │  [Nginx] ──► [Spring Security / Filter] ──► [Controller]    │                          |
|  └─────────────────────────────────────────────────────────────┘                          |
+===========================================================================================+
```

### HttpContext Token Usage

```text
HttpContext ──► Key-Value map attached to HttpRequest
  ├── NEEDS_AUTH (true/false)
  ├── RETRY_COUNT (number)
  └── CACHEABLE (true/false)
```

---

## 4. HOW IT WORKS

1. **Request Creation**: A component or service calls a method on `HttpClient` (e.g., `get<T>()`). An `HttpRequest` object is instantiated containing the URL, method, headers, and an optional `HttpContext`.
2. **Interceptor Chain**: The request enters the interceptor pipeline. Each interceptor (configured via `withInterceptors([])`) receives the request and the `next` handler.
3. **Transformation**: An interceptor can inspect the request, mutate it using `req.clone()` (since requests are immutable), and pass it forward via `next(clonedReq)`.
4. **Backend Dispatch**: The final handler in the chain is the `HttpBackend`, which translates the `HttpRequest` into a native browser call (either `fetch` if `withFetch()` is used, or `XMLHttpRequest`).
5. **Response Reception**: The backend replies. The browser handles the HTTP response and hands it back to the `HttpBackend`, which emits an `HttpResponse` or `HttpErrorResponse`.
6. **Reverse Pipeline**: The response travels backward up the interceptor chain. Interceptors can map the response, catch errors, or log metrics.
7. **Component Subscription**: The final Observable emission reaches the subscriber in the component or state management layer.

---

## 5. MODERN IMPLEMENTATION

### Bootstrapping with Fetch and Functional Interceptors (Angular 15+)

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(), // Uses the modern Fetch API instead of XHR
      withInterceptors([
        loggingInterceptor, // Order matters! First in, first to run.
        authInterceptor,
        errorInterceptor
      ])
    )
  ]
};
```

### Functional Interceptors & HttpContext

```typescript
// core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// Context token to skip auth if needed
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Check HttpContext to bypass auth
  if (req.context.get(SKIP_AUTH)) {
    return next(req);
  }

  const token = authService.getToken();
  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }
  
  return next(req);
};
```

### Advanced API Client with Retries

```typescript
// features/accounts/account.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, timer, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { SKIP_AUTH } from '../../core/interceptors/auth.interceptor';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/accounts';

  getPublicAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.apiUrl}/public`, {
      context: new HttpContext().set(SKIP_AUTH, true)
    }).pipe(
      // Conditional exponential backoff
      retry({
        count: 3,
        delay: (error, retryCount) => {
          if (error.status === 404 || error.status === 401) {
            return throwError(() => error); // Fast fail
          }
          return timer(Math.pow(2, retryCount) * 1000); // 2s, 4s, 8s
        }
      })
    );
  }
}
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Modern Pattern | Legacy Pattern | Enterprise Reality |
|---|---|---|
| `provideHttpClient(withInterceptors([...]))` | `HttpClientModule` | Many codebases still use module-based providers. Migration involves converting classes to functions and updating providers. |
| Functional Interceptors (`HttpInterceptorFn`) | Class-based Interceptors implementing `HttpInterceptor` | Class-based interceptors require `@Injectable()` and `HTTP_INTERCEPTORS` multi-provider logic. |
| `withFetch()` | `XMLHttpRequest` backend | `withFetch()` might not support legacy features like synchronous HTTP or exact XHR upload progress behaviors in older Safari versions. |
| Context (`HttpContextToken`) | Custom headers (`X-Skip-Auth`) | Legacy code often used custom HTTP headers to pass metadata to interceptors, which were then stripped before sending. Context is cleaner and type-safe. |

### Legacy Class-Based Interceptor

```typescript
@Injectable()
export class LegacyAuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // ... logic
    return next.handle(req);
  }
}

// In app.module.ts
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: LegacyAuthInterceptor, multi: true }
]
```

---

## 7. PRACTICAL EXAMPLE

**Scenario**: Enterprise API client handling file uploads with progress events and mapping backend Spring Boot error DTOs to Angular models.

```typescript
import { HttpClient, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { filter, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private http = inject(HttpClient);

  uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    // Observe 'events' to receive HttpProgressEvent
    return this.http.post('/api/v1/documents/upload', formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = event.total ? Math.round(100 * event.loaded / event.total) : 0;
            return { status: 'progress', progress };
          case HttpEventType.Response:
            return { status: 'completed', data: event.body };
          default:
            return { status: 'pending' };
        }
      })
    );
  }
  
  downloadReport(id: string) {
    return this.http.get(`/api/v1/reports/${id}`, {
      responseType: 'blob' // Critical for file downloads
    });
  }
}
```

---

## 8. COMMON MISTAKES

1. **Mutating the HttpRequest**: The `HttpRequest` object is immutable. Modifying its properties directly (e.g., `req.headers.set(...)`) throws errors or silently fails. Always use `req.clone()`.
2. **Missing `multi: true`**: When using legacy class-based interceptors, forgetting `multi: true` overwrites all previous interceptors instead of appending to the array.
3. **Forgetting to Subscribe**: Observables returned by `HttpClient` are cold. If you don't call `.subscribe()`, the HTTP request is never sent.
4. **Leaking Subscriptions in Interceptors**: Performing long-running tasks or side-effects inside interceptors without proper termination can lead to memory leaks.
5. **Wrong `responseType`**: Requesting non-JSON data (e.g., text, blobs) without specifying `responseType: 'text'` or `'blob'`. Angular defaults to JSON parsing, which will fail with a syntax error for non-JSON responses.

---

## 9. LOCAL ISSUES

- **Symptom**: CORS errors (Cross-Origin Resource Sharing) in the browser console during local development.
- **Root Cause**: The local Angular dev server (e.g., `localhost:4200`) is attempting to access a Spring Boot API (e.g., `localhost:8080`), and the preflight `OPTIONS` request is rejected.
- **Fix**: Use Angular's `proxy.conf.json` to proxy API requests through the Webpack dev server, bypassing CORS.

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

---

## 10. CI/CD ISSUES

- **Symptom**: E2E tests fail intermittently with "timeout" errors when waiting for API calls.
- **Root Cause**: Mocking mechanisms (like WireMock or Cypress network stubs) are not correctly matching the headers modified by interceptors (e.g., missing authentication headers in the stub definition).
- **Fix**: Ensure test fixtures account for the exact request signatures generated by the interceptor chain.

---

## 11. PRODUCTION ISSUES

- **Symptom**: Stale data is displayed after an update operation.
- **Root Cause**: The browser aggressively caches GET requests.
- **Fix**: Apply an interceptor that appends Cache-Control headers, or use Spring Boot's ETag support properly.

```typescript
const noCacheReq = req.clone({
  headers: req.headers
    .set('Cache-Control', 'no-cache, no-store, must-revalidate')
    .set('Pragma', 'no-cache')
});
```

---

## 12. FULL-STACK INTERACTION

### Complete Request Lifecycle (Angular → Spring Boot)

1. **Angular**: `HttpClient.get('/api/accounts')` fires.
2. **Angular Interceptor**: `authInterceptor` attaches `Authorization: Bearer <JWT>`.
3. **Browser**: Sends HTTP GET. Preflight `OPTIONS` may be sent if cross-origin.
4. **Nginx / Ingress**: Terminates TLS, forwards to Spring Boot container.
5. **Spring Security**: `JwtAuthenticationFilter` intercepts the request, validates the JWT signature, and sets the `SecurityContext`.
6. **Spring MVC**: Maps the request to `@GetMapping("/api/accounts")` in `AccountController`.
7. **Business Logic**: Service fetches data from PostgreSQL.
8. **Spring MVC**: Serializes `List<AccountDto>` to JSON.
9. **Browser**: Receives JSON response.
10. **Angular Interceptor**: `errorInterceptor` inspects status code (200 OK).
11. **Angular**: Parses JSON, emits value to subscriber.

### Error Contract Mapping

Spring Boot's `ProblemDetail` (RFC 7807) to Angular Error model mapping:

**Spring Boot Response (400 Bad Request):**
```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid account parameters",
  "instance": "/api/v1/accounts"
}
```

**Angular Error Interceptor:**
```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 400 && error.error?.detail) {
        // Map to custom application error
        const uiError = new AppBusinessError(error.error.detail);
        return throwError(() => uiError);
      }
      return throwError(() => error);
    })
  );
};
```

---

## 13. DEBUGGING PROCESS

**Scenario**: API calls randomly fail with 401 Unauthorized despite having a valid token.

1. **Check Network Tab**: Inspect the failing request. Is the `Authorization` header present?
2. **Review Interceptor Order**: In `provideHttpClient()`, is the `authInterceptor` placed before an interceptor that might strip headers or fail?
3. **Inspect the Token**: Use browser DevTools (Application > Local Storage) to verify token expiration.
4. **Backend Logs**: Check Spring Boot logs. Is it a token validation failure, or is the token missing entirely?
5. **Console Logging**: Add a temporary `tap(req => console.log(req.headers))` in the interceptor right before `next(req)` to verify exact mutations.

---

## 14. ROOT CAUSE ANALYSIS

### Interceptor Execution Order Failure
When multiple interceptors mutate headers, execution order is paramount. If `authInterceptor` relies on an `API_URL` interceptor that rewrites URLs, but `authInterceptor` explicitly checks if the URL matches `/api/`, it might skip adding the token if it runs *before* the rewrite interceptor.

Functional interceptors execute in the exact order they are provided in the `withInterceptors([...])` array.

---

## 15. FIX

Ensure correct ordering and use robust condition checks (e.g., checking HttpContext instead of raw URL parsing when deciding to bypass auth).

```typescript
// Correct ordering in app.config.ts
provideHttpClient(
  withInterceptors([
    baseUrlInterceptor,  // Runs first: Rewrites URL
    authInterceptor,     // Runs second: Checks URL/Context and adds Token
    loggingInterceptor   // Runs last: Logs the finalized request
  ])
)
```

---

## 16. PREVENTION

1. **Type-Safe Contexts**: Always use `HttpContext` and `HttpContextToken` to pass flags between components and interceptors rather than custom headers.
2. **Strict Mocking**: Use robust MSW (Mock Service Worker) setups to catch integration issues early.
3. **Resilience Testing**: Inject latency and network failures in staging environments to verify RxJS `retry` logic.

---

## 17. MONITORING / OBSERVABILITY

- **Distributed Tracing**: Generate and inject a trace ID (e.g., `X-B3-TraceId` or W3C `traceparent`) in an interceptor. This allows correlating frontend clicks to backend Spring Boot latency in tools like Datadog or Jaeger.

```typescript
const tracingInterceptor: HttpInterceptorFn = (req, next) => {
  const traceId = crypto.randomUUID();
  const tracedReq = req.clone({
    headers: req.headers.set('X-Trace-Id', traceId)
  });
  return next(tracedReq);
};
```

---

## 18. PERFORMANCE CONSIDERATIONS

- **Bundle Size**: `HttpClient` is highly tree-shakeable. However, heavy reliance on massive third-party mapping libraries within interceptors can bloat the bundle.
- **Fetch vs XHR**: `withFetch()` reduces memory overhead and integrates better with modern edge environments (like Cloudflare Workers for Angular SSR).
- **Caching**: Aggressively use RxJS `shareReplay(1)` for static lookup data to prevent duplicate HTTP requests within the same session.

---

## 19. SECURITY CONSIDERATIONS

- **Token Leakage**: Ensure the `authInterceptor` does NOT attach the Bearer token to requests destined for external third-party domains (e.g., external analytics or CDN URLs). Always check the origin.
- **CSRF**: If using cookie-based authentication with Spring Security instead of JWT, ensure `HttpClient` is configured with `withXsrfConfiguration()` to automatically read the `XSRF-TOKEN` cookie and send it in the `X-XSRF-TOKEN` header.

---

## 20. TESTING STRATEGY

### Unit Testing Interceptors via HttpTestingController

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken: () => 'fake-jwt-token' } }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should attach Authorization header', () => {
    http.get('/api/test').subscribe();
    
    const req = httpTesting.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-jwt-token');
    req.flush({}); // Provide dummy response
  });
});
```

---

## 21. EXERCISES

1. **Implement Conditional Retry**: Write a service method using `HttpClient` and RxJS that retries network timeouts (status 504) three times with exponential backoff, but fails immediately on 401 Unauthorized.
2. **Progress Indicator**: Build a file upload component that visually updates a progress bar using `HttpEventType.UploadProgress`.
3. **Correlation ID**: Implement a functional interceptor that generates a unique UUID and attaches it to the `X-Correlation-ID` header of every outgoing request.

---

## 22. BREAK-AND-FIX LAB

**Lab ID**: ANG-HTTP-001

**Defect Injection**:
Provide an interceptor array in the wrong order. A base-url interceptor rewrites `/api/users` to `https://api.enterprise.com/v1/users`. The auth interceptor checks if `req.url.startsWith('https://api.enterprise.com')` to attach a token. However, in `provideHttpClient`, the auth interceptor is placed *before* the base-url interceptor.

**Reproduction**:
Make a call to `/api/users`. The request fails with 401 Unauthorized.

**Diagnostic Steps**:
1. Check the Network tab. Observe the URL is correctly rewritten to `https://api.enterprise.com/v1/users`, but the `Authorization` header is missing.
2. Add a `console.log(req.url)` inside the `authInterceptor`.
3. Notice that `req.url` logs as `/api/users`, meaning the URL hasn't been rewritten yet when the auth logic runs.

**Fix**:
Swap the order in `app.config.ts`:
```typescript
provideHttpClient(
  withInterceptors([
    baseUrlInterceptor,
    authInterceptor
  ])
)
```

---

## 23. EXPERT QUESTIONS

**Q1: How does `withFetch()` change the internal behavior of `HttpClient`, and what legacy `XMLHttpRequest` features are lost when migrating?**
*Answer*: `withFetch()` replaces the underlying `HttpXhrBackend` with a `fetch`-based backend. This improves SSR (fetch is native to Node/Edge) and reduces memory overhead. However, it drops support for tracking upload progress on legacy platforms and eliminates the ability to make synchronous HTTP requests (which were deprecated anyway).

**Q2: Explain how `shareReplay` interacts with `HttpClient` subscriptions and why it is critical for performance.**
*Answer*: `HttpClient` returns "cold" Observables; every `.subscribe()` triggers a new HTTP network request. If multiple components subscribe to the same data stream, multiple identical API calls are made. Applying `shareReplay(1)` creates a multicasted Observable that caches the latest response and replays it to subsequent subscribers, effectively caching the data without re-fetching.

**Q3: In a microfrontend architecture, how would you ensure that interceptors registered by remote modules do not pollute the host application's HTTP traffic?**
*Answer*: Interceptors are global to the dependency injection environment where `provideHttpClient` is called. If remote modules provide their own HTTP client in a child EnvironmentInjector (or via module isolation), their interceptors only apply to requests made by services injected in that child scope. To prevent pollution, ensure the remote doesn't use `provideHttpClient` at the root/host level, or architect interceptors to strictly check request URLs or `HttpContext` before acting.
