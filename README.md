# 🚀 Enterprise Angular 19+ & Spring Boot 3.4+ Mastery Platform

[![Angular](https://img.shields.io/badge/Angular-19.1+-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4+-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Spring Security](https://img.shields.io/badge/Spring_Security-6.4+-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white)](https://spring.io/projects/spring-security)
[![Java](https://img.shields.io/badge/Java-21_LTS-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-PostgreSQL_16-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

> **Mission:** A battle-tested engineering curriculum and production reference platform designed to elevate developers into **Staff and Principal Full-Stack Engineers**. Master the complete request lifecycle, memory forensics, reactive concurrency, distributed tracing, and zero-downtime deployments.

---

## 🏛️ End-to-End System Architecture

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
        ├── 2. Caching Strategy: Hashed chunks (1yr immutable) vs index.html (no-cache)
        ├── 3. Header Preservation: Forwards 'X-Request-ID', 'Host', client IP
        └── 4. Gzip / Brotli Compression
        │
        ▼ (Reverse Proxy /api/ -> :8080)
  [ Spring Boot 3.4+ Backend Service ]
        │
        ├── 1. CorrelationIdFilter: Extracts 'X-Request-ID' -> Places in SLF4J MDC (traceId)
        ├── 2. CorsConfigurationSource: Preflight OPTIONS permitAll + Credentialed Origin Whitelist
        ├── 3. SecurityFilterChain (Spring Security 6+ Lambda DSL): Stateless JWT Validation
        ├── 4. Controllers & Services: @PreAuthorize RBAC, Idempotency Guard (X-Idempotency-Key)
        ├── 5. GlobalExceptionHandler: Serializes uniform 'ApiErrorResponse' JSON with traceId
        └── 6. Spring Data JPA + HikariCP: PostgreSQL 16 ACID Transactions
```

---

## 🗺️ Master Navigation & Curated Documentation

| Resource | Purpose | Direct Link |
|---|---|---|
| 📋 **Master Roadmap** | 8-Phase comprehensive curriculum map & dependency graph | [`ANGULAR_EXPERT_MASTER_ROADMAP.md`](file:///D:/Projects/angular-entreprise-mastery/ANGULAR_EXPERT_MASTER_ROADMAP.md) |
| 📊 **Progress Tracker** | Live status matrix of all 36 modules and reference app phases | [`ANGULAR_EXPERT_PROGRESS_TRACKER.md`](file:///D:/Projects/angular-entreprise-mastery/ANGULAR_EXPERT_PROGRESS_TRACKER.md) |
| 🛠️ **Enterprise App** | Fully functioning reference application (Angular 19 + Spring Boot 3.4) | [`projects/enterprise-app/`](file:///D:/Projects/angular-entreprise-mastery/projects/enterprise-app/) |
| 📋 **Production Checklists** | Standard Operating Procedures for deployments & security audits | [`checklists/`](file:///D:/Projects/angular-entreprise-mastery/checklists/) |
| 🔍 **Debugging Playbooks** | 6 Step-by-step diagnostic workflows for production issues | [`debugging-playbooks/`](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/) |
| 💼 **Staff Interview Guide** | 30+ Deep architectural & internal interview questions | [`interview-preparation/`](file:///D:/Projects/angular-entreprise-mastery/interview-preparation/) |
| 🔬 **Issue Labs Catalog** | Catalogs of 38 local issues, 40 production incidents, & defect labs | [`FULL_STACK_ISSUES_LAB_INDEX.md`](file:///D:/Projects/angular-entreprise-mastery/FULL_STACK_ISSUES_LAB_INDEX.md) |

---

## 📚 The 36 Curriculum Modules (`guides/`)

Every module strictly follows the mandatory **23-section teaching standard** (Internal Mental Model, ASCII diagrams, Modern vs Legacy implementations, Full-Stack interaction, Break-and-Fix Labs, and Staff-level Q&A).

```
guides/
├── 00-foundations/                      ← Web protocols, browser event loop, request lifecycle
├── 01-typescript-mastery/               ← Strict mode, mapped types, conditional types, Java-TS contracts
├── 02-javascript-runtime/               ← V8 memory heap, call stack, microtasks, GC roots
├── 03-angular-fundamentals/             ← Standalone architecture, control flow (@if/@for/@let), @defer
├── 04-angular-internals/                ← Ivy runtime (LView, TView, TNode), CD engine, Zoneless
├── 05-components-and-templates/         ← Signal inputs/outputs, model(), viewChild(), content projection
├── 06-dependency-injection/             ← Injector hierarchies, Bloom filters, inject(), multi-providers
├── 07-signals-and-reactivity/           ← Reactive DAG, effects, computed(), linkedSignal(), resource()
├── 08-rxjs-mastery/                     ← Operator decisions (switchMap vs exhaustMap), race protection
├── 09-routing/                          ← Functional guards, lazy loading, route-scoped providers
├── 10-forms/                            ← Typed reactive forms, debounced async validators, CVA
├── 11-http-and-api-integration/         ← Functional interceptors, retry strategies, progress events
├── 12-authentication-and-authorization/ ← 3 Auth models, refresh race-safe queue, Spring Security 6
├── 13-state-management/                 ← SignalStore (@ngrx/signals), ComponentStore, optimistic updates
├── 14-application-architecture/         ← Feature-sliced design, Nx monorepo library boundaries, Facade
├── 15-error-handling/                   ← Centralized ApiErrorResponse, interceptor routing, @ControllerAdvice
├── 16-performance/                      ← Measurement-first profiling, Core Web Vitals, CDK virtual scroll
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
├── 31-angular-spring-boot-integration/  ← Spring Security 6 filter chain, CORS 10-lab deep dive, DTOs
├── 32-angular-spring-boot-issues-lab/   ← 38 Indexed local integration issues (FS-LOCAL-001 to 038)
├── 33-full-stack-production-incidents/  ← 40 Full-stack production incidents (FS-PROD-001 to 040)
├── 34-api-contracts-and-versioning/     ← 11 Contract mismatch scenarios, OpenAPI, Long/Date/BigDecimal safety
└── 35-full-stack-observability/         ← End-to-end tracing across Angular, Nginx, Spring Boot, and PostgreSQL
```

---

## 🛠️ Enterprise Reference Application (`projects/enterprise-app`)

A fully realized, enterprise-grade banking and identity management platform demonstrating all concepts in practice.

### 🌟 Key Engineering Features Built-In:
1. **Refresh Token Race Condition Safe Queue Interceptor**: Uses a locked `BehaviorSubject` to synchronize concurrent 401 requests, guaranteeing that exactly ONE `/auth/refresh` request is fired to the backend while other in-flight requests are queued and retried automatically.
2. **Financial Wire Transfer Idempotency**: Prevents double-charge issues on slow networks via RxJS `exhaustMap` and client-generated `X-Idempotency-Key` headers matched against database transaction locks.
3. **Real-Time Debounced Async Validation**: Username and email availability verified against Spring Boot endpoints using `timer(400)` + `switchMap` to avoid keystroke network flooding.
4. **Structured Distributed Tracing**: `X-Request-ID` is generated by Angular, forwarded by Nginx, injected into Spring Boot's SLF4J MDC, and returned in `ApiErrorResponse` envelopes for fast log correlation.
5. **Server-Side Paginated Data Table**: Reusable standalone table supporting server-side sorting, role-based filtering, and dynamic pagination controls.

---

## 🚀 Quickstart Guide

### Option 1: Run Full Multi-Container Stack via Docker Compose
```bash
cd projects/enterprise-app
docker-compose up --build
```
- **Frontend**: `http://localhost:80` (or `http://localhost:4200` via dev server)
- **Backend API**: `http://localhost:8080/api/v1/health/ping`
- **PostgreSQL**: `localhost:5432` (`enterprise_db`)

### Option 2: Local Development Mode

#### 1. Start Spring Boot 3.4+ Backend:
```bash
cd projects/enterprise-app/backend
mvn clean spring-boot:run
```
*Pre-seeded demo credentials:*
- **Admin**: `admin` / `Admin@12345` (Full directory CRUD permissions)
- **User**: `user` / `User@12345` (Standard user access)

#### 2. Start Angular 19+ Standalone Frontend:
```bash
cd projects/enterprise-app/frontend
npm install
npm start
```
*Proxy routes `/api` directly to `http://localhost:8080` via `proxy.conf.json`.*

---

## 🔍 Diagnostic Playbooks & Checklists

- [**01: Change Detection Failure Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/01-change-detection-failure-playbook.md) — Diagnosing `OnPush` skipped views, zone boundaries, and reference mutability bugs.
- [**02: CORS Preflight & Security Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/02-cors-failure-playbook.md) — Diagnosing Spring Security 6 filter chain blocking `OPTIONS` requests.
- [**03: Refresh Token Loop Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/03-refresh-token-loop-playbook.md) — Eliminating 401 refresh storms.
- [**04: Memory Leak Forensics Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/04-memory-leak-investigation-playbook.md) — Chrome DevTools heap snapshot comparison and detached DOM node tracing.
- [**05: ChunkLoadError Outages Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/05-chunk-load-error-playbook.md) — Post-deployment chunk retention and automatic router error recovery.
- [**06: Full-Stack Request Tracing Playbook**](file:///D:/Projects/angular-entreprise-mastery/debugging-playbooks/06-fullstack-request-trace-playbook.md) — End-to-end `X-Request-ID` forensics across Nginx and Spring Boot logs.
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
2. **Backend**: Maven compilation, unit & integration test suites (`@SpringBootTest`), and packaging.
3. **Containers**: Multi-stage Docker image validation for both Alpine Nginx and Eclipse Temurin JRE runtime containers.

---

## 📄 License & Attribution

Distributed under the **MIT License**. Built with ❤️ for enterprise engineering mastery.
