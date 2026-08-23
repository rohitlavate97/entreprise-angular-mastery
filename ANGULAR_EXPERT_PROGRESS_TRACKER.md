# Angular + Spring Boot Expert Engineering Guide — Progress Tracker

> **Status Legend:**
> - 🔴 **Not Started**
> - 🟡 **In Progress**
> - 🟢 **Completed**
> - 🔵 **Needs Review**

---

## 📚 Curriculum Modules

| # | Module Name | Status | Notes & Milestones |
|---|---|---|---|
| 00 | 00-foundations | 🟢 Completed | Modern web fundamentals, protocols, browser lifecycle, end-to-end request flow |
| 01 | 01-typescript-mastery | 🟢 Completed | Strict typing, conditional types, mapped types, type guards, Java-TS contracts |
| 02 | 02-javascript-runtime | 🟢 Completed | Event loop, microtask queue, memory management, garbage collection, GC roots |
| 03 | 03-angular-fundamentals | 🔴 Not Started | Modern Angular paradigm, standalone architecture, project layout |
| 04 | 04-angular-internals | 🔴 Not Started | Bootstrap, ViewTree, Change Detection engine, AOT compiler |
| 05 | 05-components-and-templates | 🔴 Not Started | Signals inputs/outputs, queries, deferred loading (`@defer`), control flow |
| 06 | 06-dependency-injection | 🔴 Not Started | Injector hierarchies, ElementInjector vs EnvironmentInjector, tokens |
| 07 | 07-signals-and-reactivity | 🔴 Not Started | Reactive graph, effects, computed, Signal/Observable interop (`toSignal`, `toObservable`) |
| 08 | 08-rxjs-mastery | 🔴 Not Started | Higher-order mapping (`switchMap`, `exhaustMap`, etc.), subject pipelines, race protection |
| 09 | 09-routing | 🔴 Not Started | Functional guards, resolvers, lazy loading routes, title strategies |
| 10 | 10-forms | 🔴 Not Started | Reactive forms, async validators, control value accessor, validation contracts |
| 11 | 11-http-and-api-integration | 🔴 Not Started | `HttpClient`, functional interceptors, retry strategies, progress events |
| 12 | 12-authentication-and-authorization | 🔴 Not Started | Bearer, Refresh token rotation & race-safe queue, HttpOnly cookies, RBAC |
| 13 | 13-state-management | 🔴 Not Started | Signal Store, Component Store, NgRx patterns, state ownership |
| 14 | 14-application-architecture | 🔴 Not Started | Feature-sliced design, enterprise folder boundaries, library architectures |
| 15 | 15-error-handling | 🔴 Not Started | Centralized error contract, ErrorHandler, Interceptor routing, field errors |
| 16 | 16-performance | 🔴 Not Started | Profiling with Chrome & Angular DevTools, OnPush, Zoneless, virtual scroll |
| 17 | 17-security | 🔴 Not Started | DomSanitizer, XSS, CSRF, CSP headers, secrets boundaries |
| 18 | 18-testing | 🔴 Not Started | Unit tests, TestBed, HttpTestingController, Playwright E2E |
| 19 | 19-build-and-tooling | 🔴 Not Started | esbuild/Vite build system, tree shaking, bundle budget analysis |
| 20 | 20-local-debugging-lab | 🔴 Not Started | Local breakdown labs & systematic diagnosis |
| 21 | 21-ci-cd-issues | 🔴 Not Started | Headless browser testing, build failures, lockfile divergence |
| 22 | 22-production-debugging | 🔴 Not Started | Source maps in prod, minified stack traces, telemetry capture |
| 23 | 23-ssr-hydration-rendering | 🔴 Not Started | Angular SSR, Hydration errors, TransferState, Node.js server stability |
| 24 | 24-deployment-and-infrastructure | 🔴 Not Started | Nginx SPA configuration, cache-control headers, Docker multi-stage |
| 25 | 25-monitoring-and-observability | 🔴 Not Started | Telemetry, Core Web Vitals logging, Sentry error monitoring |
| 26 | 26-production-incidents | 🔴 Not Started | Production postmortems, triage simulations |
| 27 | 27-legacy-angular | 🔴 Not Started | NgModules, decorators, legacy Interceptors & Guards |
| 28 | 28-migrations-and-upgrades | 🔴 Not Started | Angular CLI schematics, standalone migration, signals refactoring |
| 29 | 29-enterprise-patterns | 🔴 Not Started | Dynamic UI builders, multi-tenant architectures, plug-in modules |
| 30 | 30-system-design | 🔴 Not Started | High-scale frontend architecture, resilient backend-for-frontend (BFF) |
| 31 | 31-angular-spring-boot-integration | 🔴 Not Started | Spring Security 6+, Filter chain, CORS configuration, JPA DTOs |
| 32 | 32-angular-spring-boot-issues-lab | 🔴 Not Started | Local Full-stack issues (FS-LOCAL-001 to FS-LOCAL-038) |
| 33 | 33-full-stack-production-incidents | 🔴 Not Started | Full-stack incidents (FS-PROD-001 to FS-PROD-040) |
| 34 | 34-api-contracts-and-versioning | 🔴 Not Started | OpenAPI generators, DTO stability, serialization safety (Long, Date, BigDecimal) |
| 35 | 35-full-stack-observability | 🔴 Not Started | Distributed tracing, `X-Request-ID` correlation across Angular, Nginx, and Spring Boot |

---

## 🛠️ Enterprise Reference Project (`projects/enterprise-app`)

| Phase | Milestone Description | Status |
|---|---|---|
| **Phase 1: Foundation** | Scaffolding, Spring Boot 3+ / Angular 19+ standalone, basic HTTP & error contracts | 🔴 Not Started |
| **Phase 2: Authentication** | JWT Bearer & HttpOnly cookie models, refresh token race condition protection queue | 🔴 Not Started |
| **Phase 3: Core Features** | User CRUD, dynamic data tables, async validations, debounced search, file uploads | 🔴 Not Started |
| **Phase 4: Production Readiness**| Nginx proxy & caching, Docker multi-stage builds, performance profiling & correlation IDs | 🔴 Not Started |
| **Phase 5: Break-and-Fix Labs** | Injecting real-world production defects, root cause analysis & regression test suites | 🔴 Not Started |
