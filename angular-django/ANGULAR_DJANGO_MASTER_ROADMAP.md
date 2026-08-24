# Angular 19+ & Django 5+ Expert Master Roadmap

> **Target Architecture:** Angular 19+ (Signals, Standalone) + Django 5.x / Django REST Framework & Django Ninja + Python 3.12+ + Celery / Redis + PostgreSQL 16 + Gunicorn / Nginx

---

## 🗺️ 8-Phase Curriculum Roadmap

```text
PHASE 0: Foundations & Runtime
├── 00-foundations                   (HTTP/2, HTTP/3, TLS 1.3, Browser Lifecycle, WSGI vs ASGI)
├── 01-typescript-python-typing     (Strict TypeScript, Pydantic v2, mypy, DTO contracts)
└── 02-javascript-python-runtime     (V8 Microtasks, Python GIL, asyncio event loop, GC)

PHASE 1: Core Angular Engine
├── 03-angular-fundamentals         (Standalone bootstrap, control flow @if/@for/@let, @defer)
├── 04-angular-internals            (Ivy engine, LView/TView/TNode, Zoneless change detection)
├── 05-components-and-templates     (Signal inputs/outputs, model(), content projection)
└── 06-dependency-injection         (Injector hierarchies, Element vs Environment, inject())

PHASE 2: Reactivity & Concurrency
├── 07-signals-and-reactivity       (Reactive DAG, computed(), effects, linkedSignal(), resource())
└── 08-rxjs-mastery                 (Operator decisions, race condition protection, exhaustMap)

PHASE 3: Application Building Blocks
├── 09-routing                      (Functional guards, lazy loading, route-scoped providers)
├── 10-forms                        (Typed reactive forms, debounced async validators against Django)
├── 11-http-and-api-integration     (Functional interceptors, retry with backoff, progress)
├── 12-authentication-and-auth      (SimpleJWT Bearer, Session Auth + CSRF, Refresh race queue)
└── 13-state-management            (SignalStore, ComponentStore, optimistic updates)

PHASE 4: Django 5+ & DRF Integration
├── 14-application-architecture     (Feature-sliced Angular, Clean Architecture & Services in Django)
├── 31-angular-django-integration   (Django Middleware, CORS headers, CSRF token mechanics)
└── 34-api-contracts-and-versioning (DRF Serializers vs Django Ninja Pydantic, camelCase/snake_case)

PHASE 5: Quality, Performance & SSR
├── 15-error-handling               (Standardized ApiErrorResponse, Django Custom Exception Handler)
├── 16-performance                  (Core Web Vitals, Django ORM N+1 optimization, select_related)
├── 17-security                     (XSS, CSRF, CSP headers, HttpOnly cookies, SecurityMiddleware)
├── 18-testing                      (Angular TestBed, pytest-django, Playwright E2E contract tests)
└── 23-ssr-hydration-rendering      (Angular SSR with Node.js calling Django backend, TransferState)

PHASE 6: DevOps, CI/CD & Infrastructure
├── 19-build-and-tooling            (esbuild/Vite, Django collectstatic, WhiteNoise, Docker)
├── 21-ci-cd-issues                 (GitHub Actions, pytest, Angular AOT check, Docker multi-stage)
├── 24-deployment-and-infra         (Nginx reverse proxy, Gunicorn/Uvicorn, trailing slash rules)
├── 25-monitoring-and-observability (Correlation ID tracing with structlog, Sentry, Prometheus)
└── 35-full-stack-observability     (End-to-end tracing: Angular -> Nginx -> Django -> Celery -> DB)

PHASE 7: Diagnostic Labs & Production Incidents
├── 20-local-debugging-lab          (DevTools mastery, Django Silk / Debug Toolbar profiling)
├── 22-production-debugging         (Minified stack traces, Django Sentry breadcrumbs)
├── 26-production-incidents         (Incident response, 5 Whys RCA, blameless postmortems)
├── 32-angular-django-issues-lab    (38 Indexed local full-stack issues)
└── 33-full-stack-django-incidents  (40 Production incidents with RCA & permanent fixes)

PHASE 8: Enterprise Patterns & System Design
├── 27-legacy-angular-and-django    (NgModules, Class-based views, Django Template Tags)
├── 28-migrations-and-upgrades      (Angular CLI schematics, Django DB schema migrations)
├── 29-enterprise-patterns          (Multi-tenancy schema routing, Celery background queues)
└── 30-system-design                (BFF pattern, API Gateway, Real-time Django Channels)
```
