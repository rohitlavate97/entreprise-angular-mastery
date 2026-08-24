# 🚀 Enterprise Angular 19+ Full-Stack Mastery Platform

[![Angular](https://img.shields.io/badge/Angular-19.1+-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4+-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Django](https://img.shields.io/badge/Django-5.1+-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Java](https://img.shields.io/badge/Java-21_LTS-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-PostgreSQL_16-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

> **Mission:** A battle-tested engineering curriculum and production reference platform designed to elevate developers into **Staff and Principal Full-Stack Engineers**. Master the complete request lifecycle, memory forensics, reactive concurrency, distributed tracing, and zero-downtime deployments across **Angular 19+**, **Spring Boot 3.4+**, and **Django 5+**.

---

## 🏛️ Dual Enterprise Tracks

This platform contains two complete, production-grade learning and implementation tracks:

| Track | Backend Stack | Key Architectural Focus | Direct Link |
|---|---|---|---|
| ☕ **Track 1: Angular + Spring Boot** | Spring Boot 3.4+, Java 21, Spring Security 6+, Hibernate, JPA | Security Filter Chain, Jackson type safety, MDC correlation, HikariCP | [`guides/`](file:///D:/Projects/angular-entreprise-mastery/guides/) & [`projects/enterprise-app/`](file:///D:/Projects/angular-entreprise-mastery/projects/enterprise-app/) |
| 🐍 **Track 2: Angular + Django** | Django 5.1+, Python 3.12, DRF, Celery, Redis, Gunicorn | Trailing Slash 301 rules, ORM N+1 optimization, SimpleJWT, Celery queues | [`angular-django/`](file:///D:/Projects/angular-entreprise-mastery/angular-django/) & [`enterprise-django-app/`](file:///D:/Projects/angular-entreprise-mastery/angular-django/projects/enterprise-django-app/) |

---

## 🌐 End-to-End Request Lifecycle & Distributed Tracing

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FULL-STACK REQUEST LIFECYCLE & TRACING                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  [ Angular 19+ Standalone SPA ]
        │
        ├── 1. correlationIdInterceptor: Injects 'X-Request-ID: <UUID>'
        ├── 2. authInterceptor: Injects 'Authorization: Bearer <JWT>'
        │      └── If 401: Refresh Token Race Condition Safe Queue (BehaviorSubject lock)
        └── 3. UI State: Angular Signals (signal, computed, resource) + Event Coalescing
        │
        ▼ (HTTP / HTTPS)
  [ Nginx Alpine Reverse Proxy ]
        │
        ├── 1. HTML5 SPA Fallback: 'try_files $uri $uri/ /index.html;'
        ├── 2. Trailing Slash Safe: Preserves POST payloads and headers
        ├── 3. Caching Strategy: Hashed chunks (1yr immutable) vs index.html (no-cache)
        └── 4. Header Forwarding: X-Request-ID, Host, client IP
        │
        ├─────────────────────────────────────────┬─────────────────────────────────────────┐
        ▼ (Proxy /api/ -> :8080)                  ▼ (Proxy /api/ -> :8000)
  [ Spring Boot 3.4+ Backend Service ]      [ Django 5.1+ / DRF Backend Service ]
        │                                         │
        ├── CorrelationIdFilter (MDC traceId)     ├── CorrelationIdMiddleware (structlog)
        ├── Spring Security 6+ Lambda DSL         ├── CorsMiddleware & CsrfViewMiddleware
        ├── @PreAuthorize RBAC & Idempotency      ├── ViewSets & Pydantic / DRF Serializers
        ├── GlobalExceptionHandler (ApiError)     ├── Custom Exception Handler (ApiError)
        └── Spring Data JPA + PostgreSQL 16       └── Django ORM + Celery Async + Redis
```

---

## 🗺️ Master Navigation & Curated Documentation

| Resource | Purpose | Direct Link |
|---|---|---|
| 📋 **Spring Boot Master Roadmap** | 8-Phase curriculum map for Angular + Spring Boot | [`ANGULAR_EXPERT_MASTER_ROADMAP.md`](file:///D:/Projects/angular-entreprise-mastery/ANGULAR_EXPERT_MASTER_ROADMAP.md) |
| 📊 **Spring Boot Progress Tracker** | Live status of 36 modules and Spring reference app | [`ANGULAR_EXPERT_PROGRESS_TRACKER.md`](file:///D:/Projects/angular-entreprise-mastery/ANGULAR_EXPERT_PROGRESS_TRACKER.md) |
| 🐍 **Django Master Roadmap** | 8-Phase curriculum map for Angular + Django | [`angular-django/ANGULAR_DJANGO_MASTER_ROADMAP.md`](file:///D:/Projects/angular-entreprise-mastery/angular-django/ANGULAR_DJANGO_MASTER_ROADMAP.md) |
| 📊 **Django Progress Tracker** | Live status of Django modules and reference app | [`angular-django/ANGULAR_DJANGO_PROGRESS_TRACKER.md`](file:///D:/Projects/angular-entreprise-mastery/angular-django/ANGULAR_DJANGO_PROGRESS_TRACKER.md) |
| 📜 **Spring Boot Master Prompt** | 23-section curriculum specification for Spring Boot | [`ANGULAR_SPRINGBOOT_EXPERT_GUIDE_PROMPT.md`](file:///D:/Projects/angular-entreprise-mastery/ANGULAR_SPRINGBOOT_EXPERT_GUIDE_PROMPT.md) |
| 📜 **Django Master Prompt** | 23-section curriculum specification for Django | [`ANGULAR_DJANGO_EXPERT_GUIDE_PROMPT.md`](file:///D:/Projects/angular-entreprise-mastery/ANGULAR_DJANGO_EXPERT_GUIDE_PROMPT.md) |
| 📋 **Production Checklists** | SOPs for zero-downtime deployments & security audits | [`checklists/`](file:///D:/Projects/angular-entreprise-mastery/checklists/) |
| 🔍 **Debugging Playbooks** | 6 Step-by-step diagnostic workflows for production issues | [`debugging-playbooks/`](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/) |
| 💼 **Staff Interview Guide** | 30+ Deep architectural & internal interview questions | [`interview-preparation/`](file:///D:/Projects/angular-entreprise-mastery/interview-preparation/) |

---

## 📚 Completed Curriculum Guides (`guides/` & `angular-django/guides/`)

Every module strictly follows the mandatory **23-section teaching standard** (Internal Mental Model, ASCII diagrams, Modern vs Legacy implementations, Full-Stack interaction, Break-and-Fix Labs, and Staff-level Q&A).

```
guides/ (Angular + Spring Boot) & angular-django/guides/ (Angular + Django)
├── 00-foundations/                      ← Web protocols, event loops, WSGI vs ASGI, request lifecycle
├── 01-typescript-mastery/               ← Strict mode, mapped types, conditional types, Java/Python contracts
├── 02-javascript-runtime/               ← V8 memory heap, call stack, microtasks, Python GIL, GC roots
├── 03-angular-fundamentals/             ← Standalone architecture, control flow (@if/@for/@let), @defer
├── 04-angular-internals/                ← Ivy runtime (LView, TView, TNode), CD engine, Zoneless
├── 05-components-and-templates/         ← Signal inputs/outputs, model(), viewChild(), content projection
├── 06-dependency-injection/             ← Injector hierarchies, Bloom filters, inject(), multi-providers
├── 07-signals-and-reactivity/           ← Reactive DAG, effects, computed(), linkedSignal(), resource()
├── 08-rxjs-mastery/                     ← Operator decisions (switchMap vs exhaustMap), race protection
├── 09-routing/                          ← Functional guards, lazy loading, route-scoped providers
├── 10-forms/                            ← Typed reactive forms, debounced async validators, CVA
├── 11-http-and-api-integration/         ← Functional interceptors, retry strategies, progress events
├── 12-authentication-and-authorization/ ← 3 Auth models, refresh race-safe queue, Spring Security / SimpleJWT
├── 13-state-management/                 ← SignalStore (@ngrx/signals), ComponentStore, optimistic updates
├── 14-application-architecture/         ← Feature-sliced design, Clean Architecture, Facade pattern
├── 15-error-handling/                   ← Centralized ApiErrorResponse, Django/Spring exception handlers
├── 16-performance/                      ← Measurement-first profiling, Core Web Vitals, ORM N+1 elimination
├── 17-security/                         ← DomSanitizer, XSS, CSRF, CSP headers, secrets boundaries, BFF
├── 18-testing/                          ← Unit testing, TestBed, HttpTestingController, Playwright E2E
├── 19-build-and-tooling/                ← esbuild/Vite application builder, tree shaking, bundle budgets
├── 20-local-debugging-lab/              ← DevTools mastery, cold Observables, change detection diagnosis
├── 21-ci-cd-issues/                     ← Strict AOT CI errors, headless testing, runtime config
├── 22-production-debugging/             ← Source maps, minified stack traces, Sentry, MDC structured logs
├── 23-ssr-hydration-rendering/          ← Angular SSR, incremental hydration, TransferState, 10 SSR labs
├── 24-deployment-and-infrastructure/   ← Nginx SPA config, Docker multi-stage, cache headers, CI/CD
├── 25-monitoring-and-observability/     ← Distributed tracing, X-Request-ID correlation, Core Web Vitals
├── 26-production-incidents/             ← Postmortem writing, 5 Whys RCA, war room protocols
├── 27-legacy-angular/                   ← NgModules, SharedModule/CoreModule, class-based interceptors
├── 28-migrations-and-upgrades/          ← CLI schematics, standalone/signal migrations, Strangler Fig
├── 29-enterprise-patterns/              ← Configuration-driven UI, multi-tenant context, feature flags
├── 30-system-design/                    ← BFF pattern, API Gateway, CDN architecture, system design interviews
├── 31-integration/                      ← Spring Security / Django Middleware, CORS deep dive, CSRF
├── 32-issues-lab/                       ← 38 Indexed local integration issues
├── 33-production-incidents/             ← 40 Full-stack production incidents with RCA & fixes
├── 34-api-contracts-and-versioning/     ← Contract mismatch scenarios, OpenAPI, BigInt/Decimal safety
└── 35-full-stack-observability/         ← End-to-end tracing across Angular, Nginx, Backend, and Database
```

---

## 🛠️ Production Reference Applications

### ☕ 1. Spring Boot 3.4+ & Angular 19+ ([`projects/enterprise-app/`](file:///D:/Projects/angular-entreprise-mastery/projects/enterprise-app/))
- **Stack**: Spring Boot 3.4+, Java 21, Spring Security 6+, PostgreSQL 16, Angular 19+ Standalone.
- **Run with Docker Compose**:
  ```bash
  cd projects/enterprise-app
  docker-compose up --build
  ```

### 🐍 2. Django 5.1+ & Angular 19+ ([`angular-django/projects/enterprise-django-app/`](file:///D:/Projects/angular-entreprise-mastery/angular-django/projects/enterprise-django-app/))
- **Stack**: Django 5.1+, Python 3.12, DRF, SimpleJWT, Celery 5.4, Redis 7, PostgreSQL 16, Angular 19+ Standalone.
- **Run with Docker Compose**:
  ```bash
  cd angular-django/projects/enterprise-django-app
  docker-compose up --build
  ```

---

## 🔍 Diagnostic Playbooks & Checklists

- [**01: Change Detection Failure Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/01-change-detection-failure-playbook.md) — Diagnosing `OnPush` skipped views, zone boundaries, and reference mutability bugs.
- [**02: CORS Preflight & Security Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/02-cors-failure-playbook.md) — Diagnosing Spring Security 6 / Django Middleware blocking `OPTIONS` requests.
- [**03: Refresh Token Loop Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/03-refresh-token-loop-playbook.md) — Eliminating 401 refresh storms with queue locks.
- [**04: Memory Leak Forensics Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/04-memory-leak-investigation-playbook.md) — Chrome DevTools heap snapshot comparison and detached DOM node tracing.
- [**05: ChunkLoadError Outages Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/05-chunk-load-error-playbook.md) — Post-deployment chunk retention and automatic router error recovery.
- [**06: Full-Stack Request Tracing Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/06-fullstack-request-trace-playbook.md) — End-to-end `X-Request-ID` forensics across Nginx and Backend logs.
- [**Production Deployment Checklist**](file:///D:/Projects/angular-entreprise-mastery/checklists/production-deployment-checklist.md) — Pre-flight verification, cache-busting headers, and instant rollback triggers.
- [**Security Hardening Checklist**](file:///D:/Projects/angular-entreprise-mastery/checklists/security-hardening-checklist.md) — XSS audit, CSP nonces, HttpOnly cookies, and `@PreAuthorize` verification.

---

## 💼 Staff & Principal Interview Preparation

Explore [**`interview-preparation/staff-principal-angular-interview-guide.md`**](file:///D:/Projects/angular-entreprise-mastery/interview-preparation/staff-principal-angular-interview-guide.md) for senior-level engineering discussions covering:
- Ivy `TView` / `LView` memory models and `TNode` bitwise Bloom filter DI resolution.
- `ExpressionChangedAfterItHasBeenCheckedError` root causes and reactive graph derivations.
- Reactive concurrency failure modes (`switchMap` data-loss on POST vs `exhaustMap` duplicate prevention).
- Micro-frontends (Module Federation) vs Monorepos trade-off decision matrices.

---

## 🤖 Automated CI/CD Pipeline (`.github/workflows/ci.yml`)

The repository includes an enterprise GitHub Actions pipeline enforcing:
1. **Frontend**: Strict AOT compilation (`strictTemplates: true`), linting, and bundle size budget checks (`<500kB`).
2. **Backend**: Maven / Pytest compilation, unit & integration test suites (`@SpringBootTest` / `pytest-django`), and packaging.
3. **Containers**: Multi-stage Docker image validation for both Alpine Nginx, Eclipse Temurin JRE, and Python Slim runtime containers.

---

## 📄 License & Attribution

Distributed under the **MIT License**. Built with ❤️ for enterprise engineering mastery.
