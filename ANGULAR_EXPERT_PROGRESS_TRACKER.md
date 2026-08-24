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
| 03 | 03-angular-fundamentals | 🟢 Completed | Standalone architecture, bootstrap, control flow (@if/@for/@let), @defer, inject() |
| 04 | 04-angular-internals | 🟢 Completed | Ivy runtime (LView/TView/TNode), bootstrap lifecycle, change detection engine, AOT/TCB, Zone.js vs Zoneless, dirty-marking |
| 05 | 05-components-and-templates | 🟢 Completed | Signal inputs/outputs, model(), queries, content projection, afterRender, host bindings |
| 06 | 06-dependency-injection | 🟢 Completed | Injector hierarchies, ElementInjector vs EnvironmentInjector, tokens, inject(), Bloom filter resolution |
| 07 | 07-signals-and-reactivity | 🟢 Completed | Reactive graph, effects, computed, Signal/Observable interop, resource(), linkedSignal(), Zoneless |
| 08 | 08-rxjs-mastery | 🟢 Completed | Higher-order mapping operators, Subject types, race protection, operator decision matrix |
| 09 | 09-routing | 🟢 Completed | Functional guards, resolvers, lazy loading routes, title strategies, route-scoped providers |
| 10 | 10-forms | 🟢 Completed | Typed reactive forms, async validators, ControlValueAccessor, Bean Validation contracts |
| 11 | 11-http-and-api-integration | 🟢 Completed | HttpClient, functional interceptors, retry strategies, progress events, full-stack lifecycle |
| 12 | 12-authentication-and-authorization | 🟢 Completed | Three auth models, refresh token race condition, HttpOnly cookies, RBAC, Spring Security |
| 13 | 13-state-management | 🟢 Completed | SignalStore, Component Store, NgRx, BehaviorSubject, state ownership, optimistic updates |
| 14 | 14-application-architecture | 🟢 Completed | Feature-sliced design, enterprise folder boundaries, Nx monorepo, Facade pattern |
| 15 | 15-error-handling | 🟢 Completed | Centralized error contract, ErrorHandler, interceptor routing, field errors, Spring Boot @ControllerAdvice |
| 16 | 16-performance | 🟢 Completed | Measurement-first profiling, Core Web Vitals, @defer, Signals, Zoneless, virtual scroll |
| 17 | 17-security | 🟢 Completed | DomSanitizer, XSS, CSRF, CSP headers, HttpOnly cookies, secrets boundaries, BFF patterns |
| 18 | 18-testing | 🟢 Completed | Unit tests, TestBed, HttpTestingController, Playwright E2E, contract tests, signal testing |
| 19 | 19-build-and-tooling | 🟢 Completed | esbuild/Vite build system, tree shaking, bundle budgets, Docker multi-stage |
| 20 | 20-local-debugging-lab | 🟢 Completed | Senior debugging methodology, DevTools mastery, cold Observable, change detection diagnosis |
| 21 | 21-ci-cd-issues | 🟢 Completed | AOT CI errors, headless testing, lockfile, Node OOM, runtime config |
| 22 | 22-production-debugging | 🟢 Completed | Source maps, minified stack traces, Sentry, X-Request-ID, structured logging |
| 23 | 23-ssr-hydration-rendering | 🟢 Completed | Angular SSR, incremental hydration, TransferState, 10 SSR issue labs |
| 24 | 24-deployment-and-infrastructure | 🟢 Completed | Nginx SPA config, Docker multi-stage, cache headers, CI/CD pipeline, runtime config |
| 25 | 25-monitoring-and-observability | 🟢 Completed | X-Request-ID correlation, Sentry, Core Web Vitals, distributed tracing |
| 26 | 26-production-incidents | 🟢 Completed | Incident response lifecycle, 5 Whys RCA, postmortems, simulation exercises |
| 27 | 27-legacy-angular | 🟢 Completed | NgModules, SharedModule/CoreModule, class-based interceptors/guards, @Input/@Output |
| 28 | 28-migrations-and-upgrades | 🟢 Completed | CLI schematics, standalone/signal migrations, Strangler Fig pattern |
| 29 | 29-enterprise-patterns | 🟢 Completed | Dynamic UI, multi-tenant architecture, feature flags, plugin modules |
| 30 | 30-system-design | 🟢 Completed | BFF pattern, API Gateway, Micro-frontends, CDN architecture, system design interviews |
| 31 | 31-angular-spring-boot-integration | 🟢 Completed | Spring Security 6+ filter chain, CORS 10-lab deep dive, JWT, DTO design |
| 32 | 32-angular-spring-boot-issues-lab | 🟢 Completed | Local Full-stack issues (FS-LOCAL-001 to FS-LOCAL-038) |
| 33 | 33-full-stack-production-incidents | 🟢 Completed | 40 full-stack production incidents (FS-PROD-001 to FS-PROD-040) |
| 34 | 34-api-contracts-and-versioning | 🟢 Completed | 11 contract mismatch scenarios, OpenAPI, DTO stability, Long/Date/BigDecimal safety |
| 35 | 35-full-stack-observability | 🟢 Completed | Distributed tracing, X-Request-ID, MDC, OpenTelemetry, SLOs/SLIs |

---

## 🛠️ Enterprise Reference Project (`projects/enterprise-app`)

| Phase | Milestone Description | Status |
|---|---|---|
| **Phase 1: Foundation** | Scaffolding, Spring Boot 3.4+ / Angular 19+ standalone, basic HTTP & error contracts, MDC X-Request-ID | 🟢 Completed |
| **Phase 2: Authentication** | JWT Bearer & Refresh token rotation, race-safe 401 queue interceptor, Spring Security 6+ | 🟢 Completed |
| **Phase 3: Core Features** | User CRUD, paginated/sorted data table, debounced search, async validators, idempotent transfers | 🟢 Completed |
| **Phase 4: Production Readiness**| Nginx proxy & caching, Docker multi-stage builds, CI/CD pipeline, correlation IDs | 🟢 Completed |
| **Phase 5: Break-and-Fix Labs** | 401 race-safe queue tests, backend idempotency tests, validation envelope tests | 🟢 Completed |
