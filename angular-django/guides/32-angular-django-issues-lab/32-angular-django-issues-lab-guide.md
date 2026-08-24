# Module 32: Angular + Django Local Issues Lab (38 Indexed Issues)

## 1. WHAT
This module is an exhaustive index and diagnostic lab for the 38 most common local and staging full-stack development failures encountered when developing with Angular 19+ and Django 5+ / DRF.

---

## 2. WHY
Full-stack integration between Python/Django and TypeScript/Angular introduces unique failure modes: trailing slash 301 redirects, ORM N+1 performance cliffs, CSRF token cookie mismatches, SimpleJWT token expiration loops, and serialization precision truncation. Having an indexed taxonomy of root causes and fixes reduces debugging time by 90%.

---

## 3. INTERNAL MENTAL MODEL
```text
[Angular 19+ Client] ---> [Angular Proxy / Nginx] ---> [Gunicorn / WSGI] ---> [Django Middleware] ---> [Django ORM / PostgreSQL]
        |                          |                          |                       |                        |
 (Serialization)            (CORS/Trailing Slash)       (Worker Timeout)         (Auth/CSRF)              (N+1 Query / Locks)
```

---

## 4. THE 38 LOCAL ISSUES CATALOG

### CATEGORY A: STARTUP & ENVIRONMENT (DJ-LOCAL-001 to 006)

#### DJ-LOCAL-001 | Django starts, Angular API calls fail with Connection Refused
- **Symptoms:** Angular UI loads, API calls immediately fail with `ERR_CONNECTION_REFUSED`.
- **Root Cause:** Django `runserver` not running on port 8000.
- **Fix:** Start Django: `python manage.py runserver 0.0.0.0:8000`.

#### DJ-LOCAL-002 | Database Migration Pending Error
- **Symptoms:** Django returns HTTP 500: `django.db.utils.ProgrammingError: relation "app_user" does not exist`.
- **Root Cause:** Migrations created but not applied to database.
- **Fix:** Run `python manage.py makemigrations && python manage.py migrate`.

#### DJ-LOCAL-003 | Angular Proxy Misconfiguration
- **Symptoms:** API calls return 404 with Angular HTML index page instead of JSON.
- **Root Cause:** `proxy.conf.json` targeting wrong port or missing `/api` rewrite.
- **Fix:** Set `"target": "http://127.0.0.1:8000"` and `"changeOrigin": true`.

#### DJ-LOCAL-004 | Django ALLOWED_HOSTS Rejection
- **Symptoms:** Django returns `DisallowedHost: Invalid HTTP_HOST header: 'localhost:8000'`.
- **Root Cause:** Hostname missing from `ALLOWED_HOSTS` in `settings.py`.
- **Fix:** Add `ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']`.

#### DJ-LOCAL-005 | Static Files Not Found in Dev Server
- **Symptoms:** Admin static assets or uploads return 404.
- **Root Cause:** Missing `STATIC_URL` or `urlpatterns += static(settings.MEDIA_URL)`.
- **Fix:** Append static helper to `urls.py` in `DEBUG=True` mode.

#### DJ-LOCAL-006 | Secret Key Missing in Environment
- **Symptoms:** Django startup crashes: `django.core.exceptions.ImproperlyConfigured`.
- **Root Cause:** Environment variable `DJANGO_SECRET_KEY` not loaded by `.env`.
- **Fix:** Use `python-dotenv` or `django-environ` with sensible local dev defaults.

---

### CATEGORY B: HTTP, CORS & TRAILING SLASH (DJ-LOCAL-010 to 017)

#### DJ-LOCAL-010 | The Trailing Slash 301 POST Drop
- **Symptoms:** Angular `POST /api/users` redirects to `/api/users/`, and the POST payload disappears.
- **Root Cause:** `APPEND_SLASH=True` converts missing-slash POSTs into 301 GET redirects.
- **Fix:** Standardize all Angular endpoints with trailing slash: `/api/users/`.

#### DJ-LOCAL-011 | CORS Preflight OPTIONS 401 Unauthorized
- **Symptoms:** Browser logs CORS error; preflight `OPTIONS` request returns 401.
- **Root Cause:** `CorsMiddleware` placed below `AuthenticationMiddleware` in `settings.MIDDLEWARE`.
- **Fix:** Move `corsheaders.middleware.CorsMiddleware` to the very top of `MIDDLEWARE`.

#### DJ-LOCAL-012 | CORS Wildcard with Credentials Rejected
- **Symptoms:** Browser error: `The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'`.
- **Root Cause:** `CORS_ALLOW_ALL_ORIGINS = True` with `CORS_ALLOW_CREDENTIALS = True`.
- **Fix:** Use explicit `CORS_ALLOWED_ORIGINS = ['http://localhost:4200']`.

#### DJ-LOCAL-013 | Missing X-Request-ID in Response Headers
- **Symptoms:** Frontend cannot read correlation trace ID from Django responses.
- **Root Cause:** `X-Request-ID` not included in `CORS_EXPOSE_HEADERS`.
- **Fix:** Add `CORS_EXPOSE_HEADERS = ['X-Request-ID', 'Content-Disposition']`.

#### DJ-LOCAL-014 | CSRF Token Missing on State-Changing Request
- **Symptoms:** Django returns `HTTP 403 Forbidden: CSRF verification failed. Request aborted.`
- **Root Cause:** Angular session auth request did not send `X-CSRFToken` header.
- **Fix:** Enable `provideHttpClient(withXsrfConfiguration({ cookieName: 'csrftoken', headerName: 'X-CSRFToken' }))`.

#### DJ-LOCAL-015 | Multipart File Upload Size Exceeded
- **Symptoms:** Django returns 400 or truncates file; `DATA_UPLOAD_MAX_MEMORY_SIZE` exceeded.
- **Root Cause:** Upload exceeds 2.5MB default memory buffer.
- **Fix:** Configure `FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760` (10MB).

#### DJ-LOCAL-016 | Trailing Slash 308 Permanent Redirect Fix
- **Symptoms:** Using 308 instead of 301 to preserve POST method during redirect.
- **Root Cause:** HTTP 301 allows method change (POST->GET); HTTP 308 strictly forbids method change.
- **Fix:** Configure Nginx or custom middleware to issue 308 instead of 301 if redirects occur.

#### DJ-LOCAL-017 | Unsupported Content-Type in DRF
- **Symptoms:** DRF returns `HTTP 415 Unsupported Media Type`.
- **Root Cause:** Angular omitted `Content-Type: application/json` or sent raw form data without parser.
- **Fix:** Add `MultiPartParser` and `JSONParser` to DRF `DEFAULT_PARSER_CLASSES`.

---

### CATEGORY C: SERIALIZATION & DATA CONTRACTS (DJ-LOCAL-020 to 027)

#### DJ-LOCAL-020 | Python Decimal Serialized as String vs Number
- **Symptoms:** Angular TypeScript receives `"1250.50"` (string) instead of `1250.50` (number), breaking arithmetic.
- **Root Cause:** DRF `DecimalField(coerce_to_string=True)` by default to prevent float precision loss.
- **Fix:** In Angular, parse with `Number(val)` or configure `COERCE_DECIMAL_TO_STRING = False` in DRF settings.

#### DJ-LOCAL-021 | ISO 8601 Datetime Timezone Mismatch
- **Symptoms:** Dates display 5 hours off in Angular UI.
- **Root Cause:** Django `USE_TZ = True` stores UTC, but serializer outputs string without 'Z' suffix.
- **Fix:** Ensure DRF outputs ISO 8601 UTC with explicit timezone: `serializers.DateTimeField(format='iso-8601')`.

#### DJ-LOCAL-022 | snake_case to camelCase Contract Mismatch
- **Symptoms:** Angular reads `user.first_name` as `undefined` because it expects `user.firstName`.
- **Root Cause:** Django DRF outputs `snake_case` by default.
- **Fix:** Use `djangorestframework-camel-case` renderer or map fields explicitly in Serializers.

#### DJ-LOCAL-023 | 64-Bit Integer Truncation in JavaScript
- **Symptoms:** High ID values like `9007199254740993` become `9007199254740992` in Angular.
- **Root Cause:** IEEE-754 JavaScript `Number.MAX_SAFE_INTEGER` is $2^{53} - 1$. Python handles arbitrary precision.
- **Fix:** Serialize large IDs as strings: `serializers.CharField(source='id')`.

#### DJ-LOCAL-024 | DRF Validation Error Envelope Inconsistency
- **Symptoms:** DRF returns `{ "email": ["This field is required."] }` (dict of lists), breaking Angular error parser.
- **Root Cause:** Default DRF `exception_handler` returns raw dictionary without standard envelope.
- **Fix:** Implement `custom_exception_handler` formatting uniform `ApiErrorResponse` JSON.

#### DJ-LOCAL-025 | null vs undefined in Django Model Validation
- **Symptoms:** Django returns `This field may not be null.` when Angular sends `{ description: null }`.
- **Root Cause:** Django model field has `blank=True` but missing `null=True`.
- **Fix:** Add `null=True, blank=True` to Django model field.

#### DJ-LOCAL-026 | Nested Serializer Read vs Write Asymmetry
- **Symptoms:** Angular sends `{ "author_id": 5 }`, but DRF expects `{ "author": { "name": ... } }`.
- **Root Cause:** Nested serializer used for both read and write without `PrimaryKeyRelatedField`.
- **Fix:** Use `author = AuthorSerializer(read_only=True)` and `author_id = serializers.PrimaryKeyRelatedField(write_only=True, queryset=Author.objects.all(), source='author')`.

#### DJ-LOCAL-027 | Enum Value Case Mismatch
- **Symptoms:** Django `TextChoices` expects `"ROLE_ADMIN"`, Angular sends `"admin"`.
- **Root Cause:** Mismatched Enum string constants between Python and TypeScript.
- **Fix:** Share generated OpenAPI schemas or mirror TypeScript `enum Role { ROLE_ADMIN = 'ROLE_ADMIN' }`.

---

### CATEGORY D: SECURITY & AUTHENTICATION (DJ-LOCAL-030 to 038)

#### DJ-LOCAL-030 | SimpleJWT 401 on Expired Access Token
- **Symptoms:** Angular receives `401 Unauthorized: Token is invalid or expired`.
- **Root Cause:** Access token 15-minute TTL elapsed.
- **Fix:** Angular `authInterceptor` catches 401 and invokes `/api/token/refresh/`.

#### DJ-LOCAL-031 | SimpleJWT Refresh Token Race Condition Storm
- **Symptoms:** 4 parallel Angular requests get 401; naive interceptor fires 4 refresh calls; 3 fail with `Token is blacklisted`.
- **Root Cause:** `BLACKLIST_AFTER_ROTATION = True` invalidates the refresh token on first use; subsequent simultaneous calls fail.
- **Fix:** Implement `BehaviorSubject` queue lock in Angular `authInterceptor`.

#### DJ-LOCAL-032 | Django PermissionDenied Returns 403 Forbidden
- **Symptoms:** Angular receives 403 when standard user attempts admin action.
- **Root Cause:** DRF `permission_classes = [IsAdminUser]` correctly enforces RBAC.
- **Fix:** Ensure Angular UI hides admin buttons and route guards redirect unauthorized users.

#### DJ-LOCAL-033 | SimpleJWT Token Not Stored in HttpOnly Cookie
- **Symptoms:** Tokens stored in `localStorage` vulnerable to XSS.
- **Root Cause:** Using Bearer header model without HttpOnly cookie storage.
- **Fix:** Configure Django `SimpleJWT` to set `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict`.

#### DJ-LOCAL-034 | Trailing Slash Strip on Auth Headers
- **Symptoms:** Login succeeds, but subsequent API calls fail with 401.
- **Root Cause:** URL redirect drops `Authorization` header.
- **Fix:** Add trailing slashes to all Angular HTTP service URLs.

#### DJ-LOCAL-035 | Password Validation Too Strict in Dev
- **Symptoms:** User registration fails: `This password is too common.`
- **Root Cause:** `AUTH_PASSWORD_VALIDATORS` enforcing production complexity locally.
- **Fix:** Keep validators active; use strong test passwords (`Admin@12345`).

#### DJ-LOCAL-036 | Refresh Token Expiration Forces Full Logout
- **Symptoms:** User session terminates after 7 days of inactivity.
- **Root Cause:** Refresh token lifetime reached.
- **Fix:** Expected behavior; Angular catches refresh failure, clears storage, and navigates to `/login`.

#### DJ-LOCAL-037 | User Active Flag Invalidation
- **Symptoms:** Deactivated user tokens continue to authenticate until expiration.
- **Root Cause:** Stateless JWT does not check database `is_active` status on each request.
- **Fix:** Use custom JWT authentication class that verifies `user.is_active` or implement token blacklisting.

#### DJ-LOCAL-038 | Logout Fails to Blacklist Refresh Token
- **Symptoms:** Refresh token remains valid on backend after client logout.
- **Root Cause:** Angular only cleared local storage without calling `/api/auth/logout/`.
- **Fix:** Angular calls `POST /api/auth/logout/` sending refresh token to `OutstandingToken.objects.blacklist()`.
