# Module 31: Angular 19+ & Django 5+ / DRF / Ninja Integration

## 1. WHAT
This module provides a comprehensive, production-grade guide to integrating a modern Angular 19+ standalone frontend with a Django 5+ backend powered by Django REST Framework (DRF) and Django Ninja. It covers the complete WSGI/ASGI request pipeline, middleware ordering, CORS preflight handling, CSRF mechanics, JWT authentication via SimpleJWT, and the critical **Trailing Slash** architectural contract.

---

## 2. WHY
Angular and Django are a premier enterprise combination, but they come from different architectural philosophies:
1. **Trailing Slashes**: Django defaults to `APPEND_SLASH=True`, issuing `301 Moved Permanently` redirects if a trailing slash is omitted. Naive HTTP clients convert `POST` to `GET` or drop `Authorization` headers during redirects.
2. **CSRF & Cookies**: Django's built-in `CsrfViewMiddleware` requires specific cookie naming (`csrftoken`) and header extraction (`X-CSRFToken`), which must be synchronized with Angular's `withXsrfConfiguration`.
3. **ORM Concurrency & N+1 Queries**: Django ORM lazily evaluates queries. Without explicit `select_related` and `prefetch_related`, a single Angular paginated table request can trigger 500+ database queries, starving Gunicorn workers.

---

## 3. INTERNAL MENTAL MODEL

```text
[Angular 19+ Client]
       │
       ├── 1. correlationIdInterceptor ('X-Request-ID: <UUID>')
       ├── 2. authInterceptor ('Authorization: Bearer <JWT>')
       └── 3. xsrfInterceptor ('X-CSRFToken: <cookie-val>')
       │
       ▼ (HTTP Request)
[Nginx Reverse Proxy]
       │
       ├── Proxy pass to Gunicorn :8000
       └── Preserves trailing slash & forwards X-Request-ID
       │
       ▼ (WSGI / ASGI)
[Django Middleware Pipeline] (Execution Order is Critical)
       │
       ├── 1. SecurityMiddleware (HSTS, SSL)
       ├── 2. CorrelationIdMiddleware (Sets structlog contextVar 'traceId')
       ├── 3. CorsMiddleware (corsheaders - MUST run before auth/views)
       ├── 4. CommonMiddleware (APPEND_SLASH evaluation)
       ├── 5. CsrfViewMiddleware (Validates X-CSRFToken header on unsafe methods)
       └── 6. AuthenticationMiddleware (Resolves request.user from JWT or session)
       │
       ▼
[Django ViewSet / Ninja Router]
       │
       ├── Deserializes payload & validates via Serializer / Pydantic
       ├── Executes business logic inside transaction.atomic()
       └── Queries DB via Django ORM (select_related / prefetch_related)
       │
       ▼
[Custom Exception Handler]
       │
       └── Formats response as standardized ApiErrorResponse DTO with traceId
```

---

## 4. HOW IT WORKS

### 1. The Trailing Slash Architectural Contract
Django's `CommonMiddleware` inspects incoming URL paths. If a path does not match any URL pattern in `urlpatterns` but matches when a trailing slash `/` is appended, Django sends an `HTTP 301 Moved Permanently` redirect:
```text
POST /api/v1/transfers HTTP/1.1  ──> Django sends 301 Redirect to /api/v1/transfers/
Browser follows 301 redirect    ──> Browser issues GET /api/v1/transfers/ (POST body lost! Auth header dropped!)
```
**The Production Standard:**
Enforce trailing slash consistency across both Angular API services and Django `urls.py`. In Angular, all API base paths must terminate with a trailing slash (`/api/v1/transfers/`), or Django routers must configure `trailing_slash=False` uniformly.

### 2. Django CORS Middleware Execution
`corsheaders.middleware.CorsMiddleware` intercepts browser preflight `OPTIONS` requests and checks `CORS_ALLOWED_ORIGINS`. It must be placed **at the top** of `settings.MIDDLEWARE`, above `CommonMiddleware` and `CsrfViewMiddleware`, so that preflight requests return HTTP 200 with `Access-Control-Allow-Origin` before security middleware evaluates.

---

## 5. MODERN IMPLEMENTATION

### A. Django 5+ Production Settings (`settings.py`)
```python
import os
from datetime import timedelta

# -------------------------------------------------------------
# Middleware Pipeline Configuration (Order is Critical!)
# -------------------------------------------------------------
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'core.middleware.CorrelationIdMiddleware', # Custom MDC traceId
    'corsheaders.middleware.CorsMiddleware',    # CORS preflight handler
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# -------------------------------------------------------------
# CORS & CSRF Configuration
# -------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = [
    "X-Request-ID",
    "Content-Disposition",
    "Link",
    "X-Total-Count",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]
CSRF_COOKIE_HTTPONLY = False  # Must be readable by Angular to send X-CSRFToken
CSRF_COOKIE_SAMESITE = 'Lax'

# -------------------------------------------------------------
# Django REST Framework & SimpleJWT
# -------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 10,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.getenv('SECRET_KEY', 'insecure-dev-key'),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}
```

### B. Django Correlation ID Middleware (`core/middleware.py`)
```python
import uuid
import structlog
from django.utils.deprecation import MiddlewareMixin

CORRELATION_HEADER = 'HTTP_X_REQUEST_ID'

class CorrelationIdMiddleware(MiddlewareMixin):
    def process_request(self, request):
        trace_id = request.META.get(CORRELATION_HEADER) or str(uuid.uuid4())
        request.trace_id = trace_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

    def process_response(self, request, response):
        trace_id = getattr(request, 'trace_id', None)
        if trace_id:
            response['X-Request-ID'] = trace_id
        return response
```

### C. Standardized Django Exception Handler (`core/exceptions.py`)
```python
import datetime
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get('request')
    trace_id = getattr(request, 'trace_id', 'N/A') if request else 'N/A'

    if response is not None:
        field_errors = []
        message = "An error occurred while processing your request."

        if isinstance(response.data, dict):
            if 'detail' in response.data:
                message = str(response.data['detail'])
            else:
                for field, errors in response.data.items():
                    error_msg = errors[0] if isinstance(errors, list) else str(errors)
                    field_errors.append({
                        "field": field,
                        "message": error_msg
                    })
                message = "Validation failed for one or more fields."

        custom_data = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": response.status_code,
            "errorCode": getattr(exc, 'default_code', 'API_ERROR').upper(),
            "message": message,
            "fieldErrors": field_errors if field_errors else None,
            "traceId": trace_id,
        }
        return Response(custom_data, status=response.status_code)

    # Unhandled Internal Server Error (500)
    return Response({
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "errorCode": "INTERNAL_SERVER_ERROR",
        "message": "An unexpected server error occurred. Please contact support quoting the trace ID.",
        "fieldErrors": None,
        "traceId": trace_id
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

---

## 6. LEGACY / ENTERPRISE REALITY
Legacy Django applications frequently use:
- Django session authentication with monolithic templates rendering forms via `{{ form.as_p }}`.
- Manual JSON views with `JsonResponse({'error': str(e)})` producing inconsistent error schemas.
- Synchronous calls inside view methods (e.g. `requests.post()` to payment gateways or `send_mail()`) blocking WSGI threads and causing HTTP 504 Gateway Timeouts.

---

## 7. PRACTICAL EXAMPLE: Enterprise Account Transfer API
### Django ViewSet with Idempotency & ORM Optimization
```python
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from .models import Transfer
from .serializers import TransferSerializer

class TransferViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TransferSerializer

    def get_queryset(self):
        # Prevent N+1 queries by joining source and target account foreign keys
        return Transfer.objects.select_related('source_account', 'target_account') \
                               .filter(user=self.request.user) \
                               .order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        idempotency_key = request.headers.get('X-Idempotency-Key')

        if idempotency_key:
            existing = Transfer.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer = serializer.save(user=request.user, idempotency_key=idempotency_key)

        return Response(self.get_serializer(transfer).data, status=status.HTTP_201_CREATED)
```

---

## 8. COMMON MISTAKES
1. **Missing Trailing Slash on Angular HTTP Calls**: Angular calls `POST /api/users` -> Django issues `301 Moved Permanently` -> Browser drops `Authorization` header -> 401 Unauthorized!
   - *Fix:* Always define consistent trailing slash routes or configure DRF DefaultRouter with `trailing_slash=True` uniformly.
2. **Placing `CorsMiddleware` below `CsrfViewMiddleware`**: Django rejects preflight `OPTIONS` requests before CORS headers can be set.
3. **Triggering N+1 Queries in Serializer Method Fields**: Calling `obj.related_items.count()` inside a serializer without `prefetch_related()`.

---

## 9. LOCAL ISSUES
- **Issue DJ-LOCAL-001**: Angular proxy fails to route to Django dev server due to `changeOrigin: true` missing in `proxy.conf.json`.
- **Issue DJ-LOCAL-002**: Database migration pending (`django.db.utils.ProgrammingError: relation "app_user" does not exist`) -> Run `python manage.py migrate`.

---

## 10. CI/CD ISSUES
- Flaky tests due to non-isolated test databases. Use `pytest-django` with `@pytest.mark.django_db(transaction=True)`.
- Static files missing in production containers -> Run `python manage.py collectstatic --noinput` during Docker build stage.

---

## 11. PRODUCTION ISSUES
- **Gunicorn Worker Starvation**: Synchronous external API calls inside Django views hold Gunicorn worker threads open, leading to worker exhaustion and HTTP 502/504 gateway errors.
- **Remediation**: Offload all external calls, email sending, and PDF generation to Celery workers using Redis as broker.

---

## 12. FULL-STACK INTERACTION
Angular `ApiErrorResponse` TypeScript interface maps 1-to-1 with the Django `custom_exception_handler` JSON envelope, ensuring that form field validation errors (`fieldErrors`) highlight the exact form control in the Angular UI seamlessly.

---

## 13. DEBUGGING PROCESS
1. Check Chrome DevTools Network Tab for `X-Request-ID` and HTTP Status Code.
2. Search Django structured logs: `grep "trace_id=<UUID>" /var/log/django.log`.
3. Inspect SQL query count using `django-debug-toolbar` or `django-silk`.

---

## 14. ROOT CAUSE ANALYSIS (5 Whys)
1. *Why did the transaction fail with 401?* The browser did not include the Bearer token.
2. *Why did the browser omit the token?* It was following an HTTP 301 redirect.
3. *Why did Django issue a 301 redirect?* Angular requested `/api/v1/transfers` without a trailing slash.
4. *Why did Django require a trailing slash?* `APPEND_SLASH=True` is enabled in `CommonMiddleware`.
5. *Root Cause:* URL path convention divergence between frontend and backend.

---

## 15. FIX
Add the trailing slash to the Angular Service endpoint and add automated contract tests.

---

## 16. PREVENTION
Configure Angular ESLint rule `enforce-trailing-slash-api-urls` and enforce DRF router uniformity.

---

## 17. MONITORING / OBSERVABILITY
Log all Django requests via `structlog` outputting JSON formatted lines with `trace_id`, `user_id`, `status_code`, and `query_count`.

---

## 18. PERFORMANCE
Use `select_related()` for Foreign Key relationships (SQL `INNER JOIN`) and `prefetch_related()` for Many-to-Many / Reverse Foreign Key sets to keep database query count constant ($O(1)$) regardless of page size.

---

## 19. SECURITY
- Enforce `@permission_classes([IsAuthenticated])` on all views.
- Enable `SECURE_BROWSER_XSS_FILTER = True`, `SECURE_CONTENT_TYPE_NOSNIFF = True`.
- Restrict `CORS_ALLOWED_ORIGINS` to exact production domain names.

---

## 20. TESTING STRATEGY
- **Backend**: `pytest-django` tests checking permissions, serializer validation, and transaction rollbacks.
- **Frontend**: Angular `HttpTestingController` tests verifying header injection and error mapping.
- **E2E**: Playwright tests verifying end-to-end user workflows against running Django container.

---

## 21. EXERCISES (WITH SOLUTIONS)
### Exercise 1: Build a Django Serializer with CamelCase Translation
**Challenge:** Write a DRF Serializer that receives camelCase JSON from Angular (`sourceAccount`, `targetAccount`) and populates snake_case Django model fields.
**Solution:**
```python
from rest_framework import serializers
from .models import Transfer

class TransferSerializer(serializers.ModelSerializer):
    sourceAccount = serializers.CharField(source='source_account')
    targetAccount = serializers.CharField(source='target_account')

    class Meta:
        model = Transfer
        fields = ['id', 'reference_id', 'sourceAccount', 'targetAccount', 'amount', 'currency', 'created_at']
        read_only_fields = ['id', 'reference_id', 'created_at']
```

---

## 22. BREAK-AND-FIX LAB: LAB-DJ-001 (The Trailing Slash Post Drop)
- **Defect:** Angular submits payment to `/api/v1/transfers` (no slash).
- **Symptom:** Backend receives a `GET` request with no payload; user sees blank error.
- **Investigation:** Open Network tab -> Notice `301 Moved Permanently` -> Notice subsequent `GET` request.
- **Fix:** Update Angular `transfer.service.ts` to request `/api/v1/transfers/`.

---

## 23. EXPERT QUESTIONS (STAFF / PRINCIPAL LEVEL)

### Q1: Compare Django WSGI vs ASGI execution models when serving an Angular SPA.
**Answer:** WSGI (Gunicorn) is synchronous and multi-process/multi-threaded; each incoming HTTP request occupies an entire worker thread until completion. If an external API or DB query is slow, workers starve. ASGI (Uvicorn / Daphne) supports asynchronous Python (`async`/`await`), allowing WebSockets (Django Channels) and non-blocking I/O tasks to handle thousands of concurrent client connections with minimal memory overhead.

### Q2: Why does `select_related` fail on Many-to-Many relationships and what must be used instead?
**Answer:** `select_related` performs a single SQL `INNER JOIN` or `LEFT OUTER JOIN`, which is only valid for single-valued relationships (`ForeignKey` and `OneToOneField`). Joining Many-to-Many tables creates a massive Cartesian product of duplicate rows. Therefore, `prefetch_related` must be used; it executes a separate batched SQL query using `WHERE id IN (...)` and stitches the records in Python memory.

### Q3: How do you prevent Django database connection starvation under high-frequency Angular polling?
**Answer:** Use `CONN_MAX_AGE` for persistent connections, configure **PgBouncer** in transaction pooling mode in front of PostgreSQL, and replace high-frequency polling in Angular with WebSockets (Django Channels) or Server-Sent Events (SSE).
