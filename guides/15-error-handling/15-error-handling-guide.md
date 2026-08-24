# Module 15: Error Handling — Architecture, Ownership, and the Full-Stack Contract

---

## 1. WHAT
Enterprise Error Handling is a comprehensive full-stack architecture that unifies how exceptions are caught, transformed, transmitted via a standardized JSON contract, and ultimately presented to the user, ensuring that no unhandled error degrades the user experience or obscures forensic observability.

---

## 2. WHY
- **Resilience**: Network instability and backend latency are realities. Unhandled HTTP 0 (offline) or 504 (timeout) errors will freeze a Single Page Application (SPA).
- **User Trust**: Displaying raw SQL stack traces or generic "Something went wrong" messages during a complex form submission destroys user confidence.
- **Traceability**: In microservices architectures, an error visible in the frontend must carry a correlation ID (`X-Request-ID`) to pinpoint the failure across distributed backend logs.
- **Security**: 401 and 403 errors require deterministic routing (e.g., token refresh, logout, or permission-denied pages) rather than being treated as generic data fetching failures.

---

## 3. INTERNAL MENTAL MODEL

### Error Ownership Layers

Errors must be handled exactly where the context to resolve them exists.

```text
+========================================================================================+
|                             FULL-STACK ERROR ARCHITECTURE                              |
|                                                                                        |
|  [ SPRING BOOT BACKEND ]                                                               |
|    @ControllerAdvice / @ExceptionHandler                                               |
|           │ (Transforms Exception to StandardErrorResponse JSON)                       |
|           ▼                                                                            |
|  [ ANGULAR HTTP INTERCEPTOR ] ──(Global / Auth / Retry logic)──┐                       |
|    - 401: Refresh Token Queue                                  │                       |
|    - 403: Redirect to Unauthorized Page                        │                       |
|    - 500: Log to Sentry & Trigger Global Toast                 │                       |
|    - 0  : Show Offline Banner                                  │                       |
|           │ (Passes 400, 409, 422 downstream to Component)     │                       |
|           ▼                                                    │                       |
|  [ ANGULAR SERVICE ]                                           │                       |
|    - Maps raw HTTP error to Domain Error Model                 │                       |
|    - Example: HttpErrorResponse ──> TransferValidationError    │                       |
|           │                                                    │                       |
|           ▼                                                    │                       |
|  [ ANGULAR COMPONENT ] ────────────────────────────────────────┤                       |
|    - Displays 400 Field Validation errors under inputs         │                       |
|    - Displays 409 Conflict logic (e.g., "Account locked")      │                       |
|                                                                │                       |
|  [ ANGULAR GLOBAL ERROR HANDLER ] <────────────────────────────┘                       |
|    - Catches unhandled JS exceptions (NullReference, etc.)                             |
|    - Last line of defense (logs to Sentry, shows generic fatal error)                  |
+========================================================================================+
```

---

## 4. HOW IT WORKS

### The Lifecycle of an API Validation Error (HTTP 422)
1. User clicks "Submit Transfer" with an amount exceeding their balance.
2. Spring Boot Service throws `InsufficientFundsException`.
3. Spring Boot `@ControllerAdvice` catches it, transforming it into a JSON response with status 422 and a specific `errorCode: "ERR_INSUFFICIENT_FUNDS"`.
4. Angular `HttpClient` receives the 422 and throws an `HttpErrorResponse`.
5. The `ErrorInterceptor` sees the 422. It recognizes this is a *business* error, so it bypasses global toast notifications and passes the error downstream via `throwError`.
6. The `TransferService` catches the error, parses the JSON body, and throws a typed `TransferError`.
7. The `TransferComponent`'s RxJS stream catches the error, maps the message to the UI state using a Signal, and displays a red inline alert "Insufficient funds available."

---

## 5. MODERN IMPLEMENTATION

### 5.1 The Standardized Error Contract
Both Spring Boot and Angular must share this interface:
```typescript
// models/error.model.ts
export interface FieldError {
  field: string;
  message: string;
}

export interface StandardErrorResponse {
  timestamp: string;
  status: number;
  errorCode: string;       // e.g., "ERR_VALIDATION_FAILED"
  message: string;         // Developer-facing or safe generic message
  fieldErrors?: FieldError[]; 
  traceId: string;         // Sentry / Zipkin correlation ID
}
```

### 5.2 Functional Error Interceptor (Angular 19+)
```typescript
// core/interceptors/error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 1. Network / Offline errors
      if (error.status === 0) {
        toast.showError('No internet connection. Please check your network.');
        return throwError(() => error);
      }

      // 2. Authentication / Authorization
      if (error.status === 401) {
        // Typically handled by a specialized AuthInterceptor for token refresh
        return throwError(() => error); 
      }
      if (error.status === 403) {
        router.navigate(['/unauthorized']);
        return throwError(() => error);
      }

      // 3. Business / Validation Errors (passed to component)
      if (error.status === 400 || error.status === 409 || error.status === 422) {
        // Do not show global toast. Let the component handle inline display.
        return throwError(() => error);
      }

      // 4. Rate Limiting
      if (error.status === 429) {
        toast.showWarning('You are doing that too often. Please wait.');
        return throwError(() => error);
      }

      // 5. Server Errors
      if (error.status >= 500) {
        const traceId = error.error?.traceId || 'unknown';
        toast.showError(`System error occurred. Ref: ${traceId}`);
      }

      return throwError(() => error);
    })
  );
};
```

### 5.3 Global Error Handler (Unhandled Client Exceptions)
```typescript
// core/errors/global-error-handler.ts
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);

  handleError(error: any): void {
    const message = error.message ? error.message : error.toString();
    
    // Log to external observability platform (e.g., Sentry)
    this.logger.logException(error);

    // Prevent default console dump in production, but log neatly
    console.error('💥 [Global Error]', message);
  }
}

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideHttpClient(withInterceptors([errorInterceptor]))
  ]
};
```

---

## 6. LEGACY / ENTERPRISE REALITY

Older Angular applications rely heavily on class-based interceptors and class-based providers.
```typescript
// LEGACY: Class-based HTTP Interceptor
@Injectable()
export class LegacyErrorInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req).pipe(
      catchError(...)
    );
  }
}
```
**Migration Path**: Use `ng generate @angular/core:functional-interceptor` to migrate. The logic remains mostly identical, but DI shifts to `inject()` calls.

---

## 7. PRACTICAL EXAMPLE

### Enterprise Transfer Form (Component-level Error Handling)

```typescript
// features/banking/transfer.component.ts
import { Component, inject, signal } from '@angular/core';
import { TransferService } from './transfer.service';
import { HttpErrorResponse } from '@angular/common/http';
import { StandardErrorResponse } from '../../core/models/error.model';

@Component({
  selector: 'app-transfer',
  template: `
    <form (ngSubmit)="submit()">
      <input type="number" [(ngModel)]="amount" name="amount" />
      
      <!-- Field-level error from backend -->
      @if (fieldErrors()['amount']) {
        <div class="text-red-500 text-sm">{{ fieldErrors()['amount'] }}</div>
      }
      
      <!-- Form-level business error -->
      @if (globalError()) {
        <div class="alert alert-danger">{{ globalError() }}</div>
      }
      
      <button type="submit" [disabled]="isSubmitting()">Transfer</button>
    </form>
  `
})
export class TransferComponent {
  private transferService = inject(TransferService);
  
  amount = 0;
  isSubmitting = signal(false);
  
  // Error state signals
  globalError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  submit() {
    this.isSubmitting.set(true);
    this.globalError.set(null);
    this.fieldErrors.set({});

    this.transferService.executeTransfer({ amount: this.amount }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        // Handle success (e.g. redirect)
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        
        const errorData = err.error as StandardErrorResponse;
        
        if (err.status === 400 && errorData.fieldErrors) {
          // Map backend field errors to UI format
          const errorMap: Record<string, string> = {};
          errorData.fieldErrors.forEach(fe => {
            errorMap[fe.field] = fe.message;
          });
          this.fieldErrors.set(errorMap);
        } else if (err.status === 422) {
          // Business error (e.g., Insufficient Funds)
          this.globalError.set(errorData.message);
        } else {
          // Fallback for unhandled statuses in component
          this.globalError.set('An unexpected error occurred during transfer.');
        }
      }
    });
  }
}
```

---

## 8. COMMON MISTAKES

1. **Swallowing Errors**: Using `catchError(() => of(null))` without logging or notifying the user. The application degrades silently.
2. **Duplicate Error Display**: An interceptor shows a global toast ("Payment failed") AND the component shows an inline error ("Payment failed"). The user sees two aggressive red messages. Interceptors must know which status codes are delegated to components.
3. **Leaking Stack Traces to UI**: Displaying `err.message` directly in the UI when `err` is a raw exception object. This often reveals internal backend topology or framework details.

---

## 9. LOCAL ISSUES

- **Symptom**: `HttpErrorResponse` appears as `status: 0, statusText: "Unknown Error"`.
- **Root Cause**: This usually isn't a network issue locally; it is a **CORS (Cross-Origin Resource Sharing)** failure. When CORS fails, the browser blocks the response entirely, hiding the true HTTP status code (often a 401 or 403) from Angular.
- **Fix**: Configure the Spring Boot `@CrossOrigin` or `CorsFilter` correctly for development.

---

## 10. CI/CD ISSUES

- **Symptom**: Integration tests randomly fail with timeout exceptions.
- **Root Cause**: Error interceptors often contain retry logic (e.g., `retry(3)` for 503 errors). During headless testing, the mock server returns 503, triggering 3 retries with exponential backoff, exceeding the test's 5000ms timeout.
- **Fix**: Use environments or DI tokens to disable or reduce HTTP retry delays in testing environments.

---

## 11. PRODUCTION ISSUES

- **Symptom**: Users report "System error occurred. Ref: undefined."
- **Root Cause**: The backend failed behind a reverse proxy (e.g., Nginx or AWS API Gateway) returning a raw HTML 502 Bad Gateway page instead of the standardized JSON `StandardErrorResponse`. Angular attempts to parse `error.error.traceId` on an HTML string, yielding `undefined`.
- **Fix**: Check `err.headers.get('content-type')`. Only parse JSON properties if the content type is `application/json`.

---

## 12. FULL-STACK INTERACTION

### Spring Boot Side (`@ControllerAdvice`)
```java
// Spring Boot backend exception handler
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public StandardErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        List<FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .map(err -> new FieldError(err.getField(), err.getDefaultMessage()))
            .collect(Collectors.toList());

        return StandardErrorResponse.builder()
            .timestamp(Instant.now())
            .status(400)
            .errorCode("ERR_VALIDATION")
            .message("Invalid request payload")
            .fieldErrors(fieldErrors)
            .traceId(MDC.get("traceId"))
            .build();
    }
}
```
**Interaction**: Spring Boot uses standard Java Bean Validation (`@NotNull`, `@Min`). The `@ControllerAdvice` captures validation failures, formats them into the exact JSON contract Angular expects, and includes the Zipkin/Sleuth trace ID.

---

## 13. DEBUGGING PROCESS

### Diagnosing "Silent API Failures"
1. **Network Tab Check**: Is the request actually failing (red text)? Look at the status code.
2. **CORS Check**: Does the console say "blocked by CORS policy"? If yes, Angular receives status 0. Fix backend CORS headers.
3. **Interceptor Bypass**: Does the request go through `errorInterceptor`? Place a breakpoint in the interceptor. Ensure it returns `throwError(() => error)` and doesn't accidentally return `of()`.
4. **Component Subscription**: Did the component provide an `error:` callback in the `.subscribe()` block? If not, RxJS throws it to the global `ErrorHandler`.

---

## 14. ROOT CAUSE ANALYSIS

### Why Unhandled Promise Rejections Crash Apps
Angular runs inside Zone.js (unless Zoneless is enabled). Zone.js intercepts async operations and ties them into Angular's change detection. If an RxJS stream or Promise throws an error and no `catchError` or `.catch()` handles it, it bubbles up to Zone.js, which forwards it to Angular's `ErrorHandler`. By default, Angular logs it. However, if the error occurs within critical initialization code (like `APP_INITIALIZER`), the bootstrapping process halts entirely, leaving a white screen.

---

## 15. FIX

### Fixing the Double Error Notification Bug
```typescript
// ❌ BROKEN Interceptor: Shows toast for EVERYTHING
catchError((error) => {
  toast.showError('An error occurred'); 
  return throwError(() => error);
})

// ✅ FIXED Interceptor: Skips specific codes
catchError((error) => {
  // Delegate 4xx business/validation errors to components
  const isBusinessError = error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 403;
  
  if (!isBusinessError) {
    toast.showError('System error');
  }
  return throwError(() => error);
})
```

---

## 16. PREVENTION

1. **Strict Type Checking in HTTP Calls**: 
   ```typescript
   // Enforce catching errors properly
   this.http.get<Data>('/api/data').pipe(
     catchError(this.handleError) // Mandatory architectural rule
   );
   ```
2. **Centralized Error Models**: Publish the `StandardErrorResponse` interface in a shared library (e.g., an OpenAPI generated client) so the frontend and backend cannot drift.
3. **Linter Rules**: Ban console.error in production components; require usage of a `LoggerService`.

---

## 17. MONITORING / OBSERVABILITY

- **Sentry Integration**: In the global `ErrorHandler`, initialize `@sentry/angular`.
- **Trace IDs**: Ensure every backend error response contains a `traceId`. Display this ID in the Angular toast (e.g., "Error Code: a1b2c3d4"). When a user files a support ticket, developers can paste `a1b2c3d4` into Datadog/Splunk to instantly find the backend exception and database query that caused the failure.

---

## 18. PERFORMANCE CONSIDERATIONS

- **Avoid Infinite Retry Loops**: If a token refresh fails with 401, do not attempt to refresh again. Log the user out immediately. A loop of 401s will crash the browser tab.
- **Heavy Logging in Dev**: The Global Error Handler might log extensively. Ensure `LoggerService` uses a no-op or batched upload mechanism in production to avoid blocking the main UI thread during cascade failures.

---

## 19. SECURITY CONSIDERATIONS

- **Information Disclosure**: Never reflect raw HTTP response bodies into the UI unconditionally. An attacker might manipulate a backend service to return a malicious XSS string within the error `message` property. Ensure error messages are bound via Angular's default `{textContent}` binding, avoiding `[innerHTML]`.
- **Trace ID Entropy**: Ensure `traceId`s are random UUIDs, not sequential integers, to prevent attackers from mapping the system's traffic volume.

---

## 20. TESTING STRATEGY

### Mocking HTTP Errors
```typescript
it('should display field errors on 400 response', () => {
  const errorResponse: StandardErrorResponse = {
    timestamp: '2026-08-24T10:00:00Z',
    status: 400,
    errorCode: 'VALIDATION',
    message: 'Invalid',
    fieldErrors: [{ field: 'amount', message: 'Amount too high' }],
    traceId: '123'
  };

  component.submit();
  
  const req = httpTestingController.expectOne('/api/v1/transfers');
  req.flush(errorResponse, { status: 400, statusText: 'Bad Request' });
  
  fixture.detectChanges();
  
  const errorDiv = fixture.nativeElement.querySelector('.text-red-500');
  expect(errorDiv.textContent).toContain('Amount too high');
});
```

---

## 21. EXERCISES

1. **The Silencer**: Create an HTTP Interceptor that adds a `X-Silent-Error: true` header to specific HTTP requests. Modify the global error interceptor to check for this header and completely bypass global toast notifications if present.
2. **The Translator**: Update the component error handling to map Spring Boot `errorCode` values (e.g., `ERR_INSUFFICIENT_FUNDS`) to localized string keys using `@ngx-translate/core` or Angular i18n, rather than trusting the backend's English `message`.

---

## 22. BREAK-AND-FIX LAB

**Issue**: `ANG-ERROR-001`
**Description**: "Interceptor swallows 422 error." The interceptor catches 422 errors, displays a toast, and returns `EMPTY` instead of `throwError`. As a result, the `TransferComponent`'s `subscribe.error` callback never fires, leaving the "Submit" button permanently disabled in a loading state.
**Reproduction**:
1. Submit an invalid transfer.
2. Toast appears.
3. Loading spinner spins infinitely.
**Fix**: Change `catchError(err => { toast.show(err); return EMPTY; })` to `return throwError(() => err);` in the interceptor.

---

## 23. EXPERT QUESTIONS

1. **"In a zoneless Angular application using Signals, how do you handle asynchronous HTTP errors elegantly without relying on RxJS `catchError` throughout your components?"**
   *Answer*: Utilize the `rxMethod` or a dedicated Signal Store (like NgRx SignalStore) where the HTTP call is executed within an injection context. The store manages the state via `patchState({ error: err.message })`, allowing the component to remain purely reactive (`store.error()`) without any direct RxJS manipulation.

2. **"If the Spring Boot application is down and AWS Application Load Balancer returns a 502 HTML page, how do you prevent Angular's JSON parser from throwing a fatal `SyntaxError` before the interceptor even sees it?"**
   *Answer*: The Angular `HttpClient` expects JSON by default and will throw a parsing error if it receives HTML. You must inspect the `HttpErrorResponse`. The original unparsed text is available under `error.error.text` if parsing failed. The interceptor should safely fallback to a generic message when `typeof error.error === 'string'`.

3. **"Explain the architectural difference between using an HttpInterceptor versus a global ErrorHandler for HTTP errors."**
   *Answer*: `HttpInterceptor` is pipeline-specific; it operates on the request/response stream and allows for asynchronous recovery (e.g., pausing the request, fetching a new JWT, and retrying). The `ErrorHandler` is the framework's terminal bucket for unhandled exceptions—synchronous or asynchronous. Once an error reaches `ErrorHandler`, recovery is generally impossible; it is strictly for logging, telemetry, and notifying the user of a fatal crash.
