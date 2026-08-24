# Module 06: Dependency Injection Deep Dive

---

## 1. WHAT
Angular's Dependency Injection (DI) system is a hierarchical, token-based resolution framework that manages the creation, wiring, and lifecycle of dependencies (services, configuration values, functions) across two distinct parallel trees: the `EnvironmentInjector` tree (logical boundaries like application and routes) and the `ElementInjector` tree (DOM/component hierarchy).

---

## 2. WHY
- **Decoupling & Testability**: Decouples consumers from concrete implementations, allowing seamless substitution of mocked services during testing.
- **Hierarchical Scoping**: Unlike traditional flat IoC containers, Angular's DI allows multiple instances of the same service at different levels of the component tree, enabling state encapsulation (e.g., a shared state for a specific wizard or form).
- **Tree-Shaking**: The modern `providedIn: 'root'` pattern ensures that unreferenced services are eliminated from the final JavaScript bundle, unlike legacy NgModule providers which were always retained.
- **Pluggability**: Multi-providers allow developers to hook into the framework lifecycle or networking layers (e.g., `APP_INITIALIZER`, `HTTP_INTERCEPTORS`) without altering the core framework code.

---

## 3. INTERNAL MENTAL MODEL

### The Dual Injector Hierarchy

```text
+===========================================================================================+
|                          ANGULAR DI INJECTOR HIERARCHY                                    |
|                                                                                           |
|  ┌───────────────────────┐             ┌───────────────────────┐                          |
|  │   ElementInjector     │             │ EnvironmentInjector   │                          |
|  │     (DOM Tree)        │             │   (Logical Tree)      │                          |
|  └───────────┬───────────┘             └───────────┬───────────┘                          |
|              │                                     │                                      |
|              │                                     ▼                                      |
|              │                            [ NullInjector ]                                |
|              │                            (Throws Error)                                  |
|              │                                     ▲                                      |
|              │                                     │                                      |
|              │                          [ PlatformInjector ]                              |
|              │                       (Shared across microfrontends)                       |
|              │                                     ▲                                      |
|              │                                     │                                      |
|              │                            [ RootInjector ]                                |
|              │                   (bootstrapApplication providers / root)                  |
|              │                                     ▲                                      |
|              │                                     │                                      |
|              │                        [ RouteEnvironmentInjector ]                        |
|              │                        (Lazy route providers array)                        |
|              │                                     ▲                                      |
|              │                                     │                                      |
|              ▼                                     │                                      |
|      <app-root> [ElementInjector] ─────────────────┘ (Fallback link to Environment)       |
|              │                                                                            |
|              ▼                                                                            |
|      <header> [ElementInjector]                                                           |
|              │                                                                            |
|              ▼                                                                            |
|      <nav> [ElementInjector] (inject(AuthService))                                        |
|              │                                                                            |
|              └─► Resolution traverses UP the Element tree, then UP the Environment tree   |
|                                                                                           |
+===========================================================================================+
```

### Provider Resolution Algorithm

When a component calls `inject(Token)`:
1. Look in the current Node's `ElementInjector`.
2. Walk UP the DOM tree to the parent `ElementInjector`.
3. If `<app-root>` is reached and the token is not found, jump to the `EnvironmentInjector` where the component was instantiated (often the Route Injector).
4. Walk UP the `EnvironmentInjector` tree (Route → Root → Platform).
5. If still not found, throw `NullInjectorError` (unless `@Optional()` flag is used).

---

## 4. HOW IT WORKS

### Resolution Steps during Component Creation

1. **Compilation**: The Angular compiler converts `inject(MyService)` or `constructor(private myService: MyService)` into an internal Ivy instruction: `ɵɵdirectiveInject(MyService)`.
2. **Execution**: During `LView` creation, the Ivy runtime executes `ɵɵdirectiveInject`.
3. **Lookup**: Angular checks the `TNode` (Template Node) for a local provider array.
4. **Traversal**: If not present on the `TNode`, it inspects the parent `TNode`'s bloom filter (a highly optimized bitmask that prevents checking node injectors that definitely don't have the provider).
5. **Environment Fallback**: If the `ElementInjector` tree yields nothing, it queries the current `EnvironmentInjector`.
6. **Factory Invocation**: Once found, Angular checks if an instance already exists. If yes, it returns it. If no, it invokes the factory function defined in the provider record to create a singleton instance *for that specific injector*.

---

## 5. MODERN IMPLEMENTATION

### Modern `inject()` Function and Standalone Providers

Angular 14+ introduced the `inject()` function, which fundamentally shifted DI from class constructors to functional properties, enabling highly composable, reusable logic (like functional guards, interceptors, and custom hooks).

```typescript
// tokens.ts
import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiUrl: string;
  maxRetries: number;
}
export const APP_CONFIG = new InjectionToken<AppConfig>('App Config');

// auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG } from './tokens';

// Tree-shakable providedIn: 'root'
@Injectable({ providedIn: 'root' })
export class AuthService {
  // MODERN: Property-based injection using inject()
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  login(credentials: any) {
    return this.http.post(`${this.config.apiUrl}/login`, credentials);
  }
}

// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // Value provider for InjectionToken
    { 
      provide: APP_CONFIG, 
      useValue: { apiUrl: 'https://api.enterprise.com/v1', maxRetries: 3 } 
    }
  ]
};
```

---

## 6. LEGACY / ENTERPRISE REALITY

### Legacy NgModule Providers & Constructor Injection

In enterprise codebases built prior to Angular 14, you will encounter constructor injection and `NgModule` providers arrays. 

```typescript
// LEGACY PATTERN: Constructor Injection
@Injectable()
export class LegacyAuthService {
  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) private config: AppConfig, // Requires @Inject decorator for tokens
    @Optional() private logger: LoggerService
  ) {}
}

// LEGACY: Provided in NgModule (Not tree-shakable)
@NgModule({
  providers: [
    LegacyAuthService,
    // LEGACY: HTTP_INTERCEPTORS using multi: true
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LegacyAuthInterceptor,
      multi: true
    }
  ]
})
export class CoreModule {}
```

### Migration Path
1. Replace `constructor` injections with `inject()` property assignments.
2. Replace `@Inject(TOKEN)` with `inject(TOKEN)`.
3. Move `NgModule` providers to `providedIn: 'root'` or `bootstrapApplication` config.
4. Replace class-based interceptors (`HTTP_INTERCEPTORS`) with functional interceptors (`withInterceptors([...])`).

---

## 7. PRACTICAL EXAMPLE

### Hierarchical Element Injection for Multi-Tenant Data Grids

In a complex enterprise application, you may need a completely isolated state for a specific UI component, like a highly interactive Data Grid where you can have multiple grids on the screen simultaneously. We provide the service at the Component level (`ElementInjector`), not the Root.

```typescript
// data-grid.service.ts
import { Injectable, signal } from '@angular/core';

// No providedIn: 'root'. We want isolated instances per component.
@Injectable()
export class DataGridStateService {
  readonly selection = signal<string[]>([]);
  
  toggleSelection(id: string) {
    this.selection.update(curr => 
      curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id]
    );
  }
}

// data-grid.component.ts
import { Component, inject } from '@angular/core';

@Component({
  selector: 'app-data-grid',
  standalone: true,
  // Creates a new instance of DataGridStateService for EACH <app-data-grid> ElementInjector
  providers: [DataGridStateService],
  template: `
    <div>
      <p>Selected Items: {{ state.selection().length }}</p>
      <!-- grid rows... -->
    </div>
  `
})
export class DataGridComponent {
  // Injects the instance tied to THIS component's ElementInjector
  readonly state = inject(DataGridStateService);
}
```

---

## 8. COMMON MISTAKES

1. **Memory Leaks via Route Providers**: Providing a service with long-lived subscriptions or state in a lazy-loaded route's `providers` array. When the user navigates away, the route environment injector might be kept alive if components are cached, or recreated duplicating state.
2. **Accidental Singletons in Lazy Modules**: Assuming `providedIn: 'root'` and a provider array in a lazy route are the same. A lazy route provider creates a *second instance* of the service if it's already provided in root.
3. **Overusing `ElementInjector`**: Adding `providers: [SharedService]` to a component when it should be a global singleton. This instantiates a new service for every component instance, losing shared state.
4. **Constructor Injection Clutter**: Creating massive inheritance hierarchies (`class BaseComponent`) passing 15 dependencies via `super(dep1, dep2...)`. Use `inject()` to avoid constructor boilerplate.

---

## 9. LOCAL ISSUES

- **Symptom**: `NullInjectorError: No provider for XService!` when rendering a standalone component in a storybook or test.
- **Root Cause**: The standalone component injects `XService`, but `XService` does not have `providedIn: 'root'` AND was not provided in the component's `providers` array or the test/storybook environment.
- **Fix**: Either add `providedIn: 'root'` to `XService` or add it to the test module configuration.

---

## 10. CI/CD ISSUES

- **Symptom**: `Warning: Circular dependency detected` during the production build.
- **Root Cause**: `AuthService` injects `UserService`, and `UserService` injects `AuthService`. Angular's DI cannot resolve this.
- **Fix**: Extract the shared functionality into a third `AuthTokenService` and have both inject the new service, or use the `Injector` directly to lazily get the dependency at runtime (`this.injector.get(UserService)`).

---

## 11. PRODUCTION ISSUES

- **Symptom**: An `InjectionToken` based on an interface fails minification in production, throwing injection errors.
- **Root Cause**: Using strings directly as token identifiers that clash, or relying on `name` properties of functions that get mangled during Terser minification.
- **Fix**: Always define `InjectionToken` with a clear, unique string description: `new InjectionToken<Interface>('UniqueDescription')`.

---

## 12. FULL-STACK INTERACTION

### Angular DI vs Spring Boot IoC

While both frameworks utilize Dependency Injection, their paradigms differ significantly:

| Concept | Angular DI | Spring Boot IoC |
|---|---|---|
| **Hierarchy** | **Tree-based** (Element / Environment). Services can exist at multiple levels. | **Flat Context** (usually). Single ApplicationContext. Scopes dictate lifecycle, not hierarchy. |
| **Scopes** | `root`, Route, Component. | `singleton`, `prototype`, `request`, `session`. |
| **Registration** | `@Injectable({ providedIn: 'root' })`, `providers: []`. | `@Component`, `@Service`, `@Bean` in `@Configuration`. |
| **Token Type** | Type (Class), `InjectionToken<T>`, String (legacy). | Type (Class), String qualifier (`@Qualifier`). |
| **Resolution** | Bottom-up traversal through DOM/Route trees. | Graph resolution at startup. |

**Full-Stack Alignment Strategy**: 
When mapping a Spring `@Service` (singleton) to the frontend, use Angular's `@Injectable({ providedIn: 'root' })`. 
When mapping a Spring `@Scope("request")`, map this conceptually to an Angular component-level provider (`providers: [MyService]`) so a new instance lives and dies with the view.

---

## 13. DEBUGGING PROCESS

1. **Angular DevTools**: 
   - Open Angular DevTools.
   - Select the Component in the Explorer.
   - Look at the **"Providers"** section on the right panel. It shows exactly which services are resolved from the `ElementInjector` vs the `EnvironmentInjector`.
2. **Check the Injection Flags**: Are there `@Optional()`, `@SkipSelf()`, `@Host()`, or `@Self()` flags altering the resolution path?
   - `inject(Service, { optional: true })` returns `null` instead of throwing.
   - `inject(Service, { self: true })` ONLY looks at the current `ElementInjector`.
   - `inject(Service, { skipSelf: true })` starts lookup at the parent `ElementInjector`.
3. **Identify the Error Source**: A `NullInjectorError` stack trace clearly shows the chain of dependencies that led to the failure.

---

## 14. ROOT CAUSE ANALYSIS

### Why `NullInjectorError` happens in Lazy Routes

If `AuthService` is provided in a feature's `routes.ts` providers array (`RouteEnvironmentInjector`), and you try to inject `AuthService` inside an `AppHeaderComponent` (which lives in `<app-root>`), resolution will fail.
The `AppHeaderComponent` ElementInjector traverses up to the Root `EnvironmentInjector`, **bypassing** the lazy Route EnvironmentInjector entirely. Downward injection is not possible.

---

## 15. FIX

**Fixing the Route Injector Issue**:
If a service must be shared across the entire application, move it to the `root` environment.

```typescript
// ❌ Broken: Feature-scoped but accessed globally
export const featureRoutes: Routes = [
  {
    path: '',
    providers: [GlobalUserStateService], // Trap!
    component: FeatureComponent
  }
];

// ✅ Fix: Use providedIn: 'root' on GlobalUserStateService
@Injectable({ providedIn: 'root' })
export class GlobalUserStateService { ... }
```

---

## 16. PREVENTION

1. **Strictly prefer `providedIn: 'root'`**: This guarantees singleton behavior, enables tree-shaking, and avoids injector hierarchy confusion.
2. **Limit Component Providers**: Only use `providers: []` on `@Component` when you explicitly require a separate instance tied to the component's lifecycle (e.g., local UI state).
3. **Use Linter Rules**: Enforce `prefer-inject-function` to eliminate constructor injection boilerplate.

---

## 17. MONITORING / OBSERVABILITY

DI itself is lightweight, but the *factories* invoked during resolution are not.
If an injected service executes heavy synchronous logic in its constructor, it blocks the main thread during component instantiation.
**Telemetry**: Monitor Component instantiation time (Time to First Paint) via Lighthouse. If a component is slow, inspect the constructors of its injected dependencies.

---

## 18. PERFORMANCE CONSIDERATIONS

- **ElementInjector (DOM-based)** lookup is extremely fast due to Ivy's Bloom Filter implementation. Angular uses a bitmask at each Node to check if a provider *might* exist before walking up the tree.
- **Tree-Shaking**: `providedIn: 'root'` does not push the service into the root bundle automatically. It tells the root injector *how* to create the service if requested. If no compiled component ever imports the service, modern bundlers (esbuild) will safely strip it out.

---

## 19. SECURITY CONSIDERATIONS

**Unsafe Injection of Globals**:
Never inject `document` or `window` directly from the global scope for DOM manipulation. Always use DI tokens.
```typescript
// ❌ DANGEROUS: Hard reference to global document
const el = document.getElementById('hack');

// ✅ SECURE: Inject Angular's DOCUMENT token (allows safe SSR and mocking)
import { DOCUMENT } from '@angular/common';
const doc = inject(DOCUMENT);
```

---

## 20. TESTING STRATEGY

Angular's DI makes unit testing highly robust. We can override providers at both the Environment (`TestBed`) and Element (`Component`) level.

```typescript
// Overriding an Environment Provider
TestBed.configureTestingModule({
  providers: [
    { provide: AuthService, useValue: mockAuthService }
  ]
});

// Overriding an Element Provider (Component-level)
TestBed.overrideComponent(DataGridComponent, {
  set: { providers: [{ provide: DataGridStateService, useValue: mockGridState }] }
});
```

---

## 21. EXERCISES

1. **Create an `InjectionToken`** for a `Logger` configuration and provide different values in two different components.
2. **Implement an `APP_INITIALIZER`**: Create a multi-provider that delays application bootstrap until a configuration file is fetched via HTTP.
3. **Component State**: Build a `TimerService` without `providedIn: 'root'`. Provide it to a `CardComponent`. Place three `CardComponent`s on the screen and verify their timers operate independently.

---

## 22. BREAK-AND-FIX LAB

**Issue**: `ANG-DI-001` - Component instances sharing state unintentionally.
**Scenario**: You have an `AccordionComponent` that provides `AccordionStateService`. Inside the accordion, you nest *another* `AccordionComponent`. Clicking the inner accordion toggles the outer accordion.
**Diagnosis**: The inner accordion is injecting the outer accordion's service instance.
**Fix**: 
Change the injection flag in the inner accordion to explicitly resolve from its own ElementInjector, or prevent it from skipping itself.
```typescript
// Fix inside AccordionComponent
// Ensure we get our OWN instance, not a parent's
readonly state = inject(AccordionStateService, { self: true });
```

---

## 23. EXPERT QUESTIONS

1. **Staff/Principal Question:** "Explain the structural difference between `ElementInjector` and `EnvironmentInjector`. Why does Angular need both, and how does Ivy optimize the `ElementInjector` traversal?"
   *Answer Hint:* `ElementInjector` is tied to the DOM (LView/TView) for isolated component state and content projection boundaries. `EnvironmentInjector` is tied to logical boundaries (App, Route) for shared singletons. Ivy optimizes Element traversal using Bloom Filters on TNodes.

2. **Staff/Principal Question:** "If I declare a service in a lazy-loaded route's `providers` array, and use it in a component within that route, how does tree-shaking handle that service compared to `providedIn: 'root'`?"
   *Answer Hint:* Route providers force a hard reference to the service in the lazy chunk, preventing it from being tree-shaken if it turns out to be unused within that route. `providedIn: 'root'` allows the compiler to drop it if there are no active `inject()` calls.

3. **Staff/Principal Question:** "What is the difference between `providers` and `viewProviders` in a Component decorator, and how does it relate to `<ng-content>` projection?"
   *Answer Hint:* `providers` exposes the service to the component AND any content projected into it via `<ng-content>`. `viewProviders` explicitly restricts the service to only the component's own view (its template), hiding it from projected content. This is crucial for encapsulating internal state in complex UI libraries.
