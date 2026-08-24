# Angular + Django Expert Engineering Guide — Progress Tracker

> **Status Legend:**
> - 🔴 **Not Started**
> - 🟡 **In Progress**
> - 🟢 **Completed**
> - 🔵 **Needs Review**

---

## 📚 Curriculum Modules (`angular-django/guides/`)

| # | Module Name | Status | Notes & Milestones |
|---|---|---|---|
| 00 | 00-foundations | 🔴 Not Started | Modern web fundamentals, HTTP/2/3, browser lifecycle, WSGI vs ASGI |
| 01 | 01-typescript-python-typing | 🔴 Not Started | Strict TypeScript, Pydantic v2, mypy, DTO contracts, type guards |
| 02 | 02-javascript-python-runtime | 🔴 Not Started | V8 event loop, Python GIL, asyncio, memory management, garbage collection |
| 03 | 03-angular-fundamentals | 🔴 Not Started | Standalone architecture, control flow (@if/@for/@let), @defer, inject() |
| 04 | 04-angular-internals | 🔴 Not Started | Ivy runtime (LView/TView/TNode), change detection engine, Zoneless |
| 05 | 05-components-and-templates | 🔴 Not Started | Signal inputs/outputs, model(), viewChild(), content projection |
| 06 | 06-dependency-injection | 🔴 Not Started | Injector hierarchies, ElementInjector vs EnvironmentInjector, tokens |
| 07 | 07-signals-and-reactivity | 🔴 Not Started | Reactive graph, effects, computed(), linkedSignal(), resource() |
| 08 | 08-rxjs-mastery | 🔴 Not Started | Higher-order mapping, race condition protection, exhaustMap |
| 09 | 09-routing | 🔴 Not Started | Functional guards, resolvers, lazy loading routes, title strategies |
| 10 | 10-forms | 🔴 Not Started | Typed reactive forms, async validators, Django serializer errors |
| 11 | 11-http-and-api-integration | 🔴 Not Started | HttpClient, functional interceptors, retry strategies, progress events |
| 12 | 12-authentication-and-auth | 🔴 Not Started | SimpleJWT, Session Auth + CSRF, refresh token race-safe queue |
| 13 | 13-state-management | 🔴 Not Started | SignalStore, ComponentStore, optimistic updates, server sync |
| 14 | 14-application-architecture | 🔴 Not Started | Feature-sliced design, Clean Architecture & Services in Django |
| 15 | 15-error-handling | 🔴 Not Started | Centralized ApiErrorResponse, Django custom exception handler |
| 16 | 16-performance | 🔴 Not Started | Core Web Vitals, Django ORM N+1 optimization, select_related |
| 17 | 17-security | 🔴 Not Started | XSS, CSRF, CSP headers, HttpOnly cookies, Django SecurityMiddleware |
| 18 | 18-testing | 🔴 Not Started | Angular TestBed, pytest-django, Playwright E2E contract tests |
| 19 | 19-build-and-tooling | 🔴 Not Started | esbuild/Vite build system, Django collectstatic, WhiteNoise |
| 20 | 20-local-debugging-lab | 🔴 Not Started | DevTools mastery, Django Silk / Debug Toolbar profiling |
| 21 | 21-ci-cd-issues | 🔴 Not Started | GitHub Actions, pytest, Angular AOT check, Docker multi-stage |
| 22 | 22-production-debugging | 🔴 Not Started | Source maps in prod, minified stack traces, Django Sentry logs |
| 23 | 23-ssr-hydration-rendering | 🔴 Not Started | Angular SSR with Node.js calling Django backend, TransferState |
| 24 | 24-deployment-and-infra | 🔴 Not Started | Nginx reverse proxy, Gunicorn/Uvicorn, trailing slash rules |
| 25 | 25-monitoring-and-observability | 🔴 Not Started | Correlation ID tracing with structlog, Sentry, Prometheus metrics |
| 26 | 26-production-incidents | 🔴 Not Started | Incident response, 5 Whys RCA, blameless postmortems |
| 27 | 27-legacy-angular-and-django | 🔴 Not Started | NgModules, Class-based views, Django Template Tags |
| 28 | 28-migrations-and-upgrades | 🔴 Not Started | Angular CLI schematics, Django DB schema migrations |
| 29 | 29-enterprise-patterns | 🔴 Not Started | Multi-tenancy schema routing, Celery background queues |
| 30 | 30-system-design | 🔴 Not Started | BFF pattern, API Gateway, Real-time Django Channels WebSockets |
| 31 | 31-angular-django-integration | 🟢 Completed | Django Middleware, CORS headers, CSRF token mechanics, simplejwt, trailing slash |
| 32 | 32-angular-django-issues-lab | 🟢 Completed | 38 Indexed local full-stack issues (DJ-LOCAL-001 to 038) |
| 33 | 33-full-stack-django-incidents | 🟢 Completed | 40 Production incidents with RCA & permanent fixes |
| 34 | 34-api-contracts-and-versioning | 🔴 Not Started | DRF Serializers vs Django Ninja Pydantic, camelCase/snake_case |
| 35 | 35-full-stack-observability | 🔴 Not Started | End-to-end tracing: Angular -> Nginx -> Django -> Celery -> DB |

---

## 🛠️ Enterprise Reference Project (`angular-django/projects/enterprise-django-app`)

| Phase | Milestone Description | Status |
|---|---|---|
| **Phase 1: Foundation** | Docker Compose, Django 5+ / DRF / Ninja setup, Angular 19+ standalone, structured structlog & correlation ID | 🟢 Completed |
| **Phase 2: Authentication** | SimpleJWT Bearer & Session CSRF auth, refresh token race-safe queue interceptor | 🟢 Completed |
| **Phase 3: Core Features** | User CRUD, server-side paginated data table, debounced search, async uniqueness validation, idempotent transfers | 🟢 Completed |
| **Phase 4: Production Readiness** | Nginx reverse proxy (trailing slash safe), Gunicorn + Uvicorn ASGI, Celery worker pool, Docker multi-stage | 🟢 Completed |
| **Phase 5: Break-and-Fix Labs** | Automated pytest-django & Angular TestBed regression tests for 401 race queue, N+1 query prevention, and error envelopes | 🟢 Completed |
