# Module 14: Application Architecture — Structuring the Enterprise

---

## 1. WHAT
Enterprise Application Architecture is the deliberate structural design of a frontend codebase into isolated, scalable, and testable boundaries. It defines the folder organization, library separation, layer segregation (presentation, domain, infrastructure), dependency rules, and cross-cutting concerns (state, routing, API access) to enable large teams to build cohesive Angular applications.

## 2. WHY
- **Cognitive Load**: As an app grows to 50+ features, developers cannot hold the entire system in their head. Predictable architecture restricts the search space.
- **Dependency Isolation**: Without strict boundaries, codebases devolve into "Big Balls of Mud" (circular dependencies, tangled logic) where modifying one feature breaks another.
- **Team Scaling**: Architecture dictates how multiple squads can work concurrently on the same monolithic repository or Nx monorepo without constant merge conflicts.
- **Testability**: Separating logic (services/facades) from presentation (components) and infrastructure (HTTP) makes it feasible to write fast unit tests without complex mocks.
- **Incremental Modernization**: Clear boundaries allow migrating features from legacy NgModules to Standalone APIs, or replacing underlying state management (NgRx to SignalStore) without rewriting the UI.

## 3. INTERNAL MENTAL MODEL
### Layered Feature-Sliced Architecture

```text
+===========================================================================================+
|                      ENTERPRISE ARCHITECTURE DEPENDENCY GRAPH                             |
|                                                                                           |
|  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐                  |
|  │ FEATURE: ACCOUNTS │    │ FEATURE: CARDS    │    │ FEATURE: LOANS    │                  |
|  │ (Smart Components,│    │ (Smart Components,│    │ (Smart Components,│  [STRICT RULE:   |
|  │  Routing)         │    │  Routing)         │    │  Routing)         │   Features CANNOT|
|  └────────┬──────────┘    └────────┬──────────┘    └────────┬──────────┘   import each    |
|           │                        │                        │              other]         |
|           ▼                        ▼                        ▼                             |
|  ┌─────────────────────────────────────────────────────────────────────┐                  |
|  │                         DOMAIN / FACADE LAYER                       │                  |
|  │  (State Management, Business Rules, Use Cases, DTOs, Store)         │                  |
|  └─────────────────────────────────┬───────────────────────────────────┘                  |
|                                    │                                                      |
|                                    ▼                                                      |
|  ┌─────────────────────────────────────────────────────────────────────┐                  |
|  │                      INFRASTRUCTURE / DATA LAYER                    │                  |
|  │  (HTTP Clients, interceptors, WebSocket connections, localStorage)  │                  |
|  └─────────────────────────────────────────────────────────────────────┘                  |
|                                                                                           |
|  [ CROSS-CUTTING CONCERNS (Accessible by ALL Layers) ]                                    |
|  ┌───────────────────────┐ ┌───────────────────────┐ ┌─────────────────────────┐          |
|  │ SHARED (UI LIBRARY)   │ │ CORE (SINGLETONS)     │ │ UTILS (PURE FUNCTIONS)  │          |
|  │ (Dumb Components,     │ │ (Auth Guard, Config,  │ │ (Date formats, Regex)   │          |
|  │  Directives, Pipes)   │ │  Interceptors, I18n)  │ │                         │          |
|  └───────────────────────┘ └───────────────────────┘ └─────────────────────────┘          |
+===========================================================================================+
```

## 4. HOW IT WORKS
1. **Presentation Layer**: Contains Dumb (Presentational) and Smart (Container) components. Smart components inject Facades/Services and pass data down via `input()` and listen to `output()`.
2. **Domain/Facade Layer**: Orchestrates state. Exposes `Signals` or `Observables`. Hides the complexity of whether data comes from an NgRx Store, SignalStore, or API call.
3. **Data/Infrastructure Layer**: Strictly handles API communication, typed network requests, and mapping backend DTOs to frontend models.
4. **Dependency Rule**: Dependencies only point **inward** and **downward**. A domain layer cannot import a presentation component. Feature A cannot import Feature B. If they must communicate, they do so via the Domain layer or routing parameters.

## 5. MODERN IMPLEMENTATION
### Standalone Feature-Sliced Structure (Nx Monorepo Style)

```text
/src
  /app
    app.component.ts
    app.routes.ts              # Lazy loads features
  /core
    /auth                      # Auth interceptors, guards
    /config                    # Runtime environment tokens
  /shared
    /ui                        # Design system (Buttons, Cards)
    /pipes                     # CurrencyFormatter, DatePipe
  /features
    /accounts                  # Feature Domain
      /data-access             # Infrastructure (HTTP, State)
        account.service.ts
        account.store.ts
      /ui                      # Presentational components
        account-card.component.ts
      /utils                   # Domain-specific helpers
      /feature                 # Smart components / Routing
        account-list.component.ts
        accounts.routes.ts
      index.ts                 # Barrel export (Public API)
```

```typescript
// features/accounts/index.ts (Barrel Export - The Public API)
// STRICT BOUNDARY: Other features can ONLY import what is exported here.
export { accountsRoutes } from './feature/accounts.routes';
export { AccountFacade } from './data-access/account.facade';
export { AccountType, AccountStatus } from './utils/account.models';
// Notice we DO NOT export account-list.component.ts! It is internal to the feature.
```

```typescript
// features/accounts/feature/account-list.component.ts
// SMART COMPONENT using Facade Pattern
import { Component, inject } from '@angular/core';
import { AccountFacade } from '../data-access/account.facade';
import { AccountCardComponent } from '../ui/account-card.component';

@Component({
  selector: 'app-account-list',
  standalone: true,
  imports: [AccountCardComponent],
  template: `
    @if (facade.isLoading()) {
      <p>Loading accounts...</p>
    } @else {
      @for (account of facade.accounts(); track account.id) {
        <!-- Dumb Component -->
        <app-account-card 
          [account]="account"
          (lockRequested)="facade.lockAccount($event)">
        </app-account-card>
      }
    }
  `
})
export class AccountListComponent {
  public facade = inject(AccountFacade); // Encapsulates NgRx/State
}
```

## 6. LEGACY / ENTERPRISE REALITY
| Legacy Pattern (Angular 2-14) | Modern Pattern (Angular 15-19+) | Migration Strategy |
|---|---|---|
| `SharedModule` importing/exporting 100 UI components | Standalone Components. Import exactly what you need where you need it. | Convert components to standalone incrementally. Delete `SharedModule`. |
| `CoreModule` for `forRoot()` singletons | `provideFeature()` functions in `app.config.ts`. | Move providers to `ApplicationConfig`. Use `inject()` instead of constructor injection. |
| Deep, tangled imports (`import ../../../../shared`) | Path Aliases (`@app/shared/ui`) or Nx Libraries. | Configure `tsconfig.json` paths or migrate to Nx workspace workspaces. |
| Feature Modules (`AccountsModule`) | `accounts.routes.ts` (exporting a `Routes` array). | Replace `loadChildren: () => import('./...').then(m => m.AccountsModule)` with `loadChildren: () => import('./...').then(c => c.accountsRoutes)`. |

## 7. PRACTICAL EXAMPLE
**Enterprise Banking with 10+ Feature Domains**

In a massive banking app, you have domains like `accounts`, `transfers`, `loans`, `cards`, and `profile`.
If `transfers` needs to show a dropdown of active accounts, it **must not** import the `accounts` HTTP service directly or read its internal state.

**Solution:**
The `accounts` domain exposes an `AccountDropdownFacade` and an `AccountDropdownComponent` via its public API barrel file (`features/accounts/index.ts`). The `transfers` feature imports these public APIs. This enforces Domain-Driven Design (DDD) bounded contexts on the frontend.

## 8. COMMON MISTAKES
1. **Circular Dependencies**: Feature A imports Feature B, which imports Feature A. Angular's DI or Webpack will crash.
2. **Leaking Private APIs**: Importing a component directly via a deep path (`import { CardComp } from '../../cards/ui/card.component'`) instead of using the barrel export.
3. **Fat Smart Components**: Putting HTTP calls, state management, and complex business logic directly inside the component class instead of a Service/Facade.
4. **Environment File Abuse**: Putting application logic or business rules inside `environment.ts` instead of using an injection token populated by an HTTP config endpoint.
5. **Shared Module Bloat**: Creating a massive `SharedModule` that imports every UI component and pipes it into every feature, destroying tree-shaking and increasing bundle sizes.

## 9. LOCAL ISSUES
- **Symptom**: `NG3003: One or more import cycles would need to be created to compile this component.`
- **Root Cause**: Circular imports between files or barrel files. Often caused when an interface file imports a class that implements it, or barrel files refer to each other.
- **Fix**: Extract shared interfaces into a separate `.models.ts` file that has no external dependencies. Avoid `index.ts` files importing from other `index.ts` files in the same directory tree.

## 10. CI/CD ISSUES
- **Symptom**: Nx Linting fails with: `A project tagged with "type:ui" can only depend on libs tagged with "type:util"`.
- **Root Cause**: Architecture boundary enforcement. A UI library (which should be dumb) is trying to import a Data-Access library (which contains HTTP calls).
- **Fix**: Move the import up to the Feature library (Smart Component) and pass the data down to the UI library via Inputs.

## 11. PRODUCTION ISSUES
- **Symptom**: Massive `main.js` bundle size; initial load takes 6 seconds.
- **Root Cause**: Lack of strict architecture led to "Shared Module Bloat" or improper lazy loading boundaries. If a heavily used shared component imports a massive 3rd party library (like Moment.js or a heavy charting library), and that shared component is imported in the eager `app.component`, the entire heavy library is bundled in `main.js`.
- **Fix**: Apply strictly scoped standalone imports. Lazily load heavy UI components using `@defer`.

## 12. FULL-STACK INTERACTION
**Architectural Symmetry: Angular vs. Spring Boot**

Angular's frontend architecture intentionally mirrors Spring Boot's layered backend architecture to create a ubiquitous language for full-stack developers:

| Angular (Frontend) | Spring Boot (Backend) | Responsibility |
|---|---|---|
| **Smart Component** | **@RestController** | Orchestrates inputs/outputs. Minimal logic. Delegates to Services. |
| **Facade / State** | **@Service / ApplicationService** | Business logic, state, cross-domain orchestration. |
| **Data Service / HTTP Client** | **@Repository / DAO** | Infrastructure, data retrieval, API mapping. |
| **TypeScript Interfaces / Zod** | **DTOs / Records** | Data contracts between layers. |
| **HttpInterceptor** | **Filter / HandlerInterceptor** | Cross-cutting networking (Auth, Logging, Headers). |

When an API client is organized into one service per backend controller (`AccountsService.ts` calls `AccountController.java`), the mental mapping is seamless.

## 13. DEBUGGING PROCESS
**Scenario: Diagnosing a "Big Ball of Mud" Circular Dependency**

1. **Identify the Cycle**: Use a tool like `madge` or Nx graph to visualize the dependency graph. `npx madge --circular --extensions ts src/`
2. **Trace the Path**: Look at the console output: `features/a/a.ts -> features/b/b.ts -> features/c/c.ts -> features/a/a.ts`.
3. **Analyze the Root Cause**: Why does `c` need `a`? Usually, it's a shared model, interface, or a utility function.
4. **Refactor**: Extract the shared piece into a lower-level layer (e.g., `shared/utils` or a dedicated `models` library) that both `a` and `c` can import without knowing about each other.

## 14. ROOT CAUSE ANALYSIS
**Why do boundaries erode over time?**
When deadlines are tight, a developer might need to display a user's avatar inside a settings panel. Instead of routing the data properly through the domain layer or extracting the avatar component to a shared UI library, they use IDE auto-import, which creates a deep import directly into the `user-profile` feature's internal folder. This creates a hidden coupling. Over 50 features and 2 years, this results in an unmaintainable, monolithic spaghetti structure where changing the avatar breaks the settings panel.

## 15. FIX
**Applying Architectural Linting Rules:**
Use ESLint to enforce dependency rules mechanically.

```json
// .eslintrc.json (Nx Enforce Module Boundaries)
"@nx/enforce-module-boundaries": [
  "error",
  {
    "enforceBuildableLibDependency": true,
    "allow": [],
    "depConstraints": [
      {
        "sourceTag": "type:feature",
        "onlyDependOnLibsWithTags": ["type:data-access", "type:ui", "type:util"]
      },
      {
        "sourceTag": "type:data-access",
        "onlyDependOnLibsWithTags": ["type:util"]
      },
      {
        "sourceTag": "type:ui",
        "onlyDependOnLibsWithTags": ["type:util"]
      }
    ]
  }
]
```

## 16. PREVENTION
- **Nx Monorepo / Workspaces**: Split the app into logical libraries instead of just folders. Libraries have strict visibility and dependency constraints enforced by the build system.
- **Architecture Decision Records (ADRs)**: Document *why* a pattern (like the Facade pattern) was chosen in a `docs/adr/001-use-facade-pattern.md` file so new developers understand the intent.
- **Code Reviews**: Look specifically for deep imports. Any import containing more than one `../` or targeting a file outside an `index.ts` barrel should be rejected.

## 17. MONITORING / OBSERVABILITY
- **Bundle Analysis**: Run `ng build --stats-json` and `webpack-bundle-analyzer` in CI. Monitor the size of feature chunks. If a lazy-loaded feature chunk suddenly grows by 2MB, an architectural boundary was likely breached (e.g., importing the whole ECharts library instead of a specific module).
- **Module Federation (Micro-frontends)**: If a monolithic architecture becomes too large for a single CI/CD pipeline (e.g., 20+ min build times), consider Webpack Module Federation to split the app into independently deployable micro-frontends.

## 18. PERFORMANCE CONSIDERATIONS
- **Lazy Loading Boundaries**: Every major feature domain should be lazy-loaded. In Angular 19+, use `loadChildren: () => import('./features/accounts.routes').then(r => r.routes)`.
- **Tree-Shaking**: Standalone components and functional interceptors are vastly superior for tree-shaking compared to NgModules. If a feature isn't imported, the bundler guarantees it won't be in the final JavaScript file.

## 19. SECURITY CONSIDERATIONS
- **Environment Configuration**: Never compile secrets (API keys for paid services, OAuth client secrets) into `environment.prod.ts`. Frontend code is public. Use a runtime configuration pattern where the app fetches a `config.json` on bootstrap via `APP_INITIALIZER`.
- **Layered Security**: Domain layer facades should enforce authorization (e.g., `if (!this.isAdmin()) throw Error()`) even if the UI layer hides the button. Never rely solely on UI hiding for security (though the backend is the ultimate source of truth).

## 20. TESTING STRATEGY
- **Domain Layer (Facades/Services)**: Jest unit tests. Because they don't depend on components, these tests run in milliseconds.
- **Presentation Layer (Components)**: `TestBed` or Cypress Component Tests. Mock the Facade.
- **Infrastructure Layer (HTTP)**: `HttpTestingController` to verify API calls, headers, and payload mapping.
- **E2E**: Cypress/Playwright tests running against the fully assembled application to verify the boundaries interoperate correctly.

## 21. EXERCISES
1. Refactor a legacy `AppModule` with 50 declarations into a Standalone, Feature-Sliced architecture with 3 domain boundaries.
2. Implement an Nx workspace with `feature`, `data-access`, and `ui` libraries, and configure ESLint to enforce boundary rules.
3. Implement the runtime configuration pattern using `APP_INITIALIZER` to fetch an `environment.json` from the server before the app starts.

## 22. BREAK-AND-FIX LAB
**Issue**: `ANG-ARCH-001` - Circular Dependency between Feature Modules.
**Scenario**: The `OrdersFeature` needs to display a user's address, so it imports `AddressComponent` from `UsersFeature`. The `UsersFeature` needs to display the user's latest order, so it imports `OrderCardComponent` from `OrdersFeature`.
**Break**: Run the build; observe the circular dependency warning/error.
**Diagnostic Steps**: Trace the imports. Identify that `UsersFeature` and `OrdersFeature` are tightly coupled.
**Fix**: Create a `SharedUI` library. Move `AddressComponent` and `OrderCardComponent` (making them dumb components) into `SharedUI`. Both features now import from `SharedUI`, breaking the cycle.

## 23. EXPERT QUESTIONS
1. **Q**: In a large enterprise app, when would you choose Nx Monorepo libraries over Webpack Module Federation (Micro-frontends)?
   - **A**: Nx libraries are ideal for organizational scaling within a single repository, providing excellent DevEx, strict boundaries, and single-version policies. Module Federation is justified when you need *independent deployability* (Team A deploys without Team B knowing) or when integrating applications built with different frameworks (e.g., legacy React app inside an Angular shell). Micro-frontends introduce massive operational complexity and should be deferred until CI/CD or team autonomy becomes the primary bottleneck.
2. **Q**: How does the Facade pattern improve the resilience of a frontend architecture over time?
   - **A**: It decouples the Presentation layer from the Infrastructure layer. If the team decides to migrate state management from NgRx to SignalStore, or change the HTTP polling strategy to WebSockets, only the Facade and Infrastructure change. The Smart Components remain completely untouched, drastically reducing regression risk.
3. **Q**: Why are Barrel (`index.ts`) exports critical for enterprise Angular architectures?
   - **A**: They define a strict "Public API" for a feature or library. Without them, consumers can deep-import internal components or utilities, coupling themselves to implementation details. Barrels allow refactoring internal folder structures without breaking consumer imports, and enable tools like Nx to statically analyze dependency graphs accurately.
