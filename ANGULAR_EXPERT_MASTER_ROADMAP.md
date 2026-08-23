# Angular + Spring Boot Expert Engineering Guide — Master Roadmap

## 🎯 Mission Statement
Transform into an industry-ready, production-grade Staff/Principal Full-Stack Engineer who understands the full request lifecycle from browser interaction, Angular internals, network proxies, Spring Security, Spring Boot API, and PostgreSQL back to DOM updates, performance optimization, and production incident investigation.

---

## 🗺️ Curriculum & Module Directory Map

```
angular-expert-guide/
├── 00-foundations/
├── 01-typescript-mastery/
├── 02-javascript-runtime/
├── 03-angular-fundamentals/
├── 04-angular-internals/
├── 05-components-and-templates/
├── 06-dependency-injection/
├── 07-signals-and-reactivity/
├── 08-rxjs-mastery/
├── 09-routing/
├── 10-forms/
├── 11-http-and-api-integration/
├── 12-authentication-and-authorization/
├── 13-state-management/
├── 14-application-architecture/
├── 15-error-handling/
├── 16-performance/
├── 17-security/
├── 18-testing/
├── 19-build-and-tooling/
├── 20-local-debugging-lab/
├── 21-ci-cd-issues/
├── 22-production-debugging/
├── 23-ssr-hydration-rendering/
├── 24-deployment-and-infrastructure/
├── 25-monitoring-and-observability/
├── 26-production-incidents/
├── 27-legacy-angular/
├── 28-migrations-and-upgrades/
├── 29-enterprise-patterns/
├── 30-system-design/
├── 31-angular-spring-boot-integration/
├── 32-angular-spring-boot-issues-lab/
├── 33-full-stack-production-incidents/
├── 34-api-contracts-and-versioning/
├── 35-full-stack-observability/
├── projects/
│   └── enterprise-app/          (Angular 19+ Standalone + Spring Boot 3.x/4.x + Postgres + Docker)
├── issue-labs/
├── debugging-playbooks/
├── checklists/
├── interview-preparation/
└── progress-tracker/
```

---

## 📚 Module Sequence & Dependency Matrix

| Stage | Modules | Prerequisites | Focus Areas |
|---|---|---|---|
| **Phase 0: Foundations & Runtime** | `00-foundations`, `01-typescript-mastery`, `02-javascript-runtime` | Basic JS/Web knowledge | Event loop, Microtasks/Macrotasks, Memory heap, TS Strict types, Generics, Type narrowing |
| **Phase 1: Core Angular Engine** | `03-angular-fundamentals`, `04-angular-internals`, `05-components-and-templates`, `06-dependency-injection` | Phase 0 | Bootstrap sequence, View tree, DI resolution & Hierarchies, Change Detection, AOT compilation |
| **Phase 2: Modern Reactivity & Async** | `07-signals-and-reactivity`, `08-rxjs-mastery` | Phase 1 | Signals dependency graph, Signal-Observable interop, RxJS operators decision matrix (`switchMap`, `exhaustMap`, etc.) |
| **Phase 3: Application Building Blocks** | `09-routing`, `10-forms`, `11-http-and-api-integration`, `12-authentication-and-authorization`, `13-state-management` | Phase 2 | Navigation guards, Signal forms, Reactive forms async validation, Functional interceptors, Token refresh queue |
| **Phase 4: Spring Boot Full-Stack Integration** | `31-angular-spring-boot-integration`, `34-api-contracts-and-versioning`, `14-application-architecture` | Phase 3 | JSON serialization contracts (Long, Date, BigDecimal, Enums), Spring Security filter chain, CORS policy, OpenAPI |
| **Phase 5: Quality, Performance & SSR** | `15-error-handling`, `16-performance`, `17-security`, `18-testing`, `23-ssr-hydration-rendering` | Phase 4 | Centralized error contract, Profiling CWV, CSP & DomSanitizer, Contract testing, Hydration mismatches, TransferState |
| **Phase 6: DevOps, CI/CD & Infrastructure** | `19-build-and-tooling`, `21-ci-cd-issues`, `24-deployment-and-infrastructure`, `25-monitoring-and-observability`, `35-full-stack-observability` | Phase 5 | Vite/esbuild tooling, Docker multi-stage builds, Nginx SPA proxy & caching headers, Distributed tracing (`X-Request-ID`) |
| **Phase 7: Production Diagnostics & Incidents** | `20-local-debugging-lab`, `22-production-debugging`, `26-production-incidents`, `32-angular-spring-boot-issues-lab`, `33-full-stack-production-incidents` | Phase 6 | 40+ Production incident investigations, Postmortems, Break-and-Fix labs |
| **Phase 8: Enterprise Legacy & System Design** | `27-legacy-angular`, `28-migrations-and-upgrades`, `29-enterprise-patterns`, `30-system-design` | Phase 7 | NgModules to Standalone migration, Zoneless migration, Micro-frontends, Enterprise architectural trade-offs |

---

## 🛠️ The Hands-on Enterprise App

Located in `projects/enterprise-app/`:
- **Frontend (`/frontend`)**: Angular (Standalone, Signals, Functional Interceptors, OnPush / Zoneless-ready)
- **Backend (`/backend`)**: Spring Boot (Java, Spring Security 6+, Spring Data JPA, Bean Validation, Actuator)
- **Database**: PostgreSQL / H2 local profile
- **Infrastructure**: Nginx reverse proxy + Docker Compose configuration
