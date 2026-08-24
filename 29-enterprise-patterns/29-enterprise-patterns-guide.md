# Module 29: Enterprise Patterns — Dynamic UI, Multi-Tenancy, and Scale

---

## 1. WHAT
Enterprise Patterns in Angular and Spring Boot represent the architectural blueprints required to build hyper-scalable, multi-tenant, configuration-driven, and white-labeled applications. These patterns go beyond static layouts, utilizing dynamic component rendering, runtime feature toggling, fine-grained RBAC, and pluggable architectures to serve diverse business units from a single unified codebase.

---

## 2. WHY
- **Extreme Scale**: A single SaaS product might need to serve 1,000 corporate clients (tenants), each requiring their own branding, specific feature sets, and unique workflow approvals.
- **Maintainability**: Hardcoding 1,000 different forms is impossible. Configuration-driven UIs allow the backend to dictate the form structure via JSON, drastically reducing frontend code.
- **Continuous Delivery**: Feature flags allow code to be deployed safely into production while being disabled for users, enabling dark launches and A/B testing without redeploying.
- **Extensibility**: Plugin modules allow third-party teams to build extensions (via Angular libraries) that plug into the core application at runtime.

---

## 3. INTERNAL MENTAL MODEL

### Multi-Tenant & Configuration-Driven Architecture

```
+===========================================================================================+
|                     ENTERPRISE MULTI-TENANT & DYNAMIC UI ARCHITECTURE                     |
|                                                                                           |
|  ┌───────────────────────┐        ┌───────────────────────┐       ┌──────────────────────┐|
|  │ INITIALIZATION PHASE  │        │ DYNAMIC UI BUILDER    │       │  SPRING BOOT BACKEND │|
|  │                       │        │                       │       │                      │|
|  │ 1. APP_INITIALIZER    │        │ 3. Fetch View Config  │◄──────┤ /api/v1/ui-config    │|
|  │    fetches Tenant ID  │        │                       │       │                      │|
|  │    from domain/URL    │        │ 4. Parse JSON Schema  │       │ /api/v1/theme        │|
|  │                       │        │                       │       │                      │|
|  │ 2. Fetch Theme &      │        │ 5. ViewContainerRef.  │       │ /api/v1/flags        │|
|  │    Feature Flags      │        │    createComponent()  │       │                      │|
|  └──────────┬────────────┘        └──────────┬────────────┘       └──────────────────────┘|
|             │                                │                                            |
|             ▼                                ▼                                            |
|  ┌───────────────────────┐        ┌───────────────────────┐                               |
|  │  TENANT CONTEXT       │        │   RENDERED VIEW       │                               |
|  │                       │        │                       │                               |
|  │ - CSS Variables       │        │  [ Dynamic Form ]     │                               |
|  │ - X-Tenant-ID Header  │        │  [ Dynamic Table ]    │                               |
|  │ - Active Features     │        │  [ Tenant Branding ]  │                               |
|  └───────────────────────┘        └───────────────────────┘                               |
+===========================================================================================+
```

---

## 4. HOW IT WORKS
1. **Tenant Identification**: On application boot, the hostname or URL path is used to identify the current tenant (e.g., `clientA.saas.com`).
2. **Context Hydration**: An `APP_INITIALIZER` factory function pauses the Angular boot process to fetch tenant metadata, feature flags, and RBAC permissions from the Spring Boot backend.
3. **Theming**: CSS custom properties (`--primary-color`) are dynamically injected into the `document.body` to instantly white-label the application.
4. **Configuration-Driven Rendering**: When a user navigates to a dynamic route, the component fetches a JSON configuration describing the layout (e.g., fields, types, validators). Angular uses `ViewContainerRef` to instantiate components matching the JSON types and inserts them into the DOM.
5. **Context Propagation**: Every HTTP request sent to the backend includes an `X-Tenant-ID` header. Spring Boot's interceptors read this header to route the query to the correct database schema or tenant data partition.

---

## 5. MODERN IMPLEMENTATION

### Dynamic Component Loading (Angular 14+)

```typescript
import { Component, ViewContainerRef, inject, input, OnInit } from '@angular/core';
import { TextInputComponent } from './text-input.component';
import { DropdownComponent } from './dropdown.component';

// Component mapping registry
const componentRegistry = {
  text: TextInputComponent,
  dropdown: DropdownComponent,
};

@Component({
  selector: 'app-dynamic-field',
  standalone: true,
  template: `<ng-container #container></ng-container>`
})
export class DynamicFieldComponent implements OnInit {
  private vcr = inject(ViewContainerRef);
  
  // Field configuration from JSON
  fieldConfig = input.required<{ type: 'text' | 'dropdown', label: string, value: any }>();

  ngOnInit() {
    this.vcr.clear();
    const componentClass = componentRegistry[this.fieldConfig().type];
    
    if (componentClass) {
      // Modern dynamic loading without ComponentFactoryResolver
      const componentRef = this.vcr.createComponent(componentClass);
      
      // Pass inputs to the dynamically created component
      componentRef.setInput('label', this.fieldConfig().label);
      componentRef.setInput('value', this.fieldConfig().value);
    }
  }
}
```

### Feature Flag Initialization

```typescript
// feature-flag.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  flags = signal<Record<string, boolean>>({});

  constructor(private http: HttpClient) {}

  loadFlags() {
    return this.http.get<Record<string, boolean>>('/api/v1/flags').pipe(
      tap(flags => this.flags.set(flags))
    );
  }
}

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (flagService: FeatureFlagService) => () => flagService.loadFlags(),
      deps: [FeatureFlagService],
      multi: true
    }
  ]
};
```

---

## 6. LEGACY / ENTERPRISE REALITY
- **Legacy Dynamic Loading**: Pre-Angular 13 required `ComponentFactoryResolver` to instantiate components dynamically. This was verbose and complex.
- **Compile-Time i18n**: Angular's built-in i18n traditionally required building a separate bundle for each language (`main.fr.js`, `main.en.js`). Modern enterprise apps often use `@ngx-translate/core` or Transloco for runtime translation switching, though Angular is introducing new runtime i18n APIs.
- **Monoliths**: Many older "enterprise" apps started as monoliths and attempted to shoehorn multi-tenancy in later by adding `tenant_id` columns to every database table, leading to massive data leak risks.

---

## 7. PRACTICAL EXAMPLE
**Scenario**: An Enterprise Banking Platform offers a white-label onboarding flow to different credit unions. 

- **Tenant A (Credit Union X)** requires a 3-step wizard with strict compliance checkboxes and a blue theme.
- **Tenant B (Bank Y)** requires a 1-step quick form with red theming.

**Solution**:
Instead of two components, a single `OnboardingComponent` fetches `GET /api/v1/ui/onboarding`. The Spring Boot backend identifies the tenant via `X-Tenant-ID` and returns the specific JSON structure. The Angular `DynamicFieldComponent` recursively renders the JSON into the appropriate form layout, applies the CSS variables for the tenant's brand, and validates based on the config.

---

## 8. COMMON MISTAKES
1. **Memory Leaks in Dynamic Components**: Forgetting to call `componentRef.destroy()` when manually managing dynamic components outside of standard lifecycle hooks.
2. **Race Conditions**: Attempting to check a feature flag in an `ngOnInit` before the feature flag service has completed its HTTP request.
3. **Hardcoding Tenant Logic**: Using `if (tenant === 'clientA')` in frontend components instead of relying on generic configuration payloads.
4. **Bundle Bloat**: Importing every possible dynamic component directly into the main bundle instead of using lazy loading or `loadComponent()`.

---

## 9. LOCAL ISSUES
- **Symptom**: Multi-tenant routing breaks locally.
- **Root Cause**: `localhost:4200` doesn't provide subdomain context. Developers must use `/etc/hosts` to map `clienta.local.com` to `127.0.0.1` and configure the Angular CLI proxy to handle host headers, or rely on URL parameters for local development tenant switching.

---

## 10. CI/CD ISSUES
- **Symptom**: Building an Angular library (`ng-packagr`) fails with "Cannot resolve dependency".
- **Root Cause**: The library attempts to import a service from the main application shell. Libraries must be standalone and strictly use peer dependencies; they cannot depend on the consuming app.

---

## 11. PRODUCTION ISSUES
- **Symptom**: Users randomly see features they don't have access to for a split second before the UI hides them (FOUC - Flash of Unstyled Content).
- **Root Cause**: The RBAC or Feature Flag service was initialized asynchronously, and the UI rendered before the data arrived.
- **Symptom**: Memory usage grows infinitely during long-lived sessions on a dashboard with dynamic widgets.
- **Root Cause**: Dynamic components were cleared via DOM removal instead of `ViewContainerRef.clear()`, causing memory leaks.

---

## 12. FULL-STACK INTERACTION

### Tenant Propagation Contract
The Angular frontend extracts the tenant from the URL (`tenantA.example.com`) and adds it to an HTTP Interceptor.

```typescript
// tenant.interceptor.ts
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantId = inject(TenantService).currentTenant();
  return next(req.clone({ setHeaders: { 'X-Tenant-ID': tenantId } }));
};
```

**Spring Boot Interceptor:**
Spring Boot reads the header and sets it in a `ThreadLocal` context, routing the database query to the correct schema using Hibernate's `@TenantId` or a `CurrentTenantIdentifierResolver`.

```java
@Component
public class TenantInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String tenantId = request.getHeader("X-Tenant-ID");
        TenantContext.setCurrentTenant(tenantId);
        return true;
    }
}
```

---

## 13. DEBUGGING PROCESS
**Debugging a Dynamic UI Rendering Failure:**
1. **Inspect the JSON payload**: Check the Network tab. Did the backend send `{ type: 'date-picker' }`?
2. **Check the Component Registry**: Does `date-picker` exist in the frontend `componentRegistry`? If not, the mapping failed.
3. **Verify ViewContainerRef**: Use Angular DevTools to inspect the DOM tree. If the `<ng-container>` is empty, the `createComponent` call silently failed or was wrapped in an `*ngIf` that evaluated to false.

---

## 14. ROOT CAUSE ANALYSIS
### Why Feature Flag Race Conditions Occur
If a component uses `*ngIf="featureFlags.has('NEW_DASHBOARD')"` and the flags are loaded asynchronously in the background, the UI will initially evaluate to `false`. Once the HTTP call completes, it updates to `true`, causing a jarring UI jump. If a user is fast enough, they might click a legacy button before the new layout renders. 

---

## 15. FIX
**Fixing the Race Condition**:
Use `APP_INITIALIZER` to block the application bootstrap until critical configuration (Tenant, RBAC, Feature Flags) is fully loaded.
```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (config: ConfigService) => () => config.loadAppConfiguration(),
  deps: [ConfigService],
  multi: true
}
```
This guarantees the UI will not render until `featureFlags.has()` can evaluate synchronously.

---

## 16. PREVENTION
1. **Strict Typings for Dynamic Configs**: Use TypeScript interfaces to tightly couple the expected JSON structure from Spring Boot.
2. **Library Boundaries**: For plugin architectures, enforce Nx Workspaces or Angular Workspace boundaries so libraries cannot accidentally import application shell code.
3. **Audit Trails**: Ensure all actions restricted by RBAC log an audit event in Spring Boot, including the `User`, `Tenant`, and `Action`.

---

## 17. MONITORING / OBSERVABILITY
- **Feature Flag Telemetry**: Track flag evaluations. If a feature flag is rolled out to 100% of users and has been stable for 30 days, create a Jira ticket to remove the flag and clean up the legacy code.
- **Tenant Telemetry**: Tag all DataDog/Sentry errors with `tenant_id` to quickly identify if a production issue is isolated to a single tenant's specific configuration.

---

## 18. PERFORMANCE CONSIDERATIONS
- **Dynamic Component Lazy Loading**: If your dynamic form supports 50 different input types, importing them all into the registry bloats the main bundle. Use async imports to lazy-load them:
  ```typescript
  const registry = {
    richText: () => import('./rich-text.component').then(m => m.RichTextComponent)
  };
  ```

---

## 19. SECURITY CONSIDERATIONS
- **Never Trust Frontend RBAC**: Hiding a button via `*ngIf="hasRole('ADMIN')"` is purely cosmetic. The Spring Boot backend MUST enforce `@PreAuthorize("hasRole('ADMIN')")` on the corresponding endpoint.
- **Tenant Data Leakage**: If a developer forgets to apply the `TenantContext` to a database query, one tenant could see another's data. Use Hibernate Multi-Tenancy capabilities (Database per Tenant or Schema per Tenant) to enforce this at the driver level, rather than relying on `WHERE tenant_id = ?` clauses.

---

## 20. TESTING STRATEGY
- **Visual Regression Testing**: Because dynamic UIs can render thousands of combinations, use tools like Percy or Cypress to snapshot test standard configurations.
- **Testing Dynamic Rendering**: Provide mock JSON configs in Jasmine/Jest and verify that `fixture.debugElement.queryAll` finds the correct number and types of instantiated child components.

---

## 21. EXERCISES
1. Build a generic `TableBuilderComponent` that takes a JSON definition of columns, data types, and sorting rules, and renders a fully functional Angular Material table.
2. Implement an HTTP Interceptor that attaches `X-Tenant-ID` based on the subdomain.
3. Write an `APP_INITIALIZER` that fetches a user's permissions and stores them in a Signal for synchronous UI access.

---

## 22. BREAK-AND-FIX LAB
**Defect ANG-ENTERPRISE-001**: Feature Flag Race Condition.
- **Scenario**: A new "Beta Dashboard" is enabled for Tenant A via a feature flag.
- **Reproduction**: When a user logs in, they see the old dashboard for 0.5 seconds, then the screen flickers and loads the new beta dashboard.
- **Diagnosis**: The `DashboardComponent` executes `ngOnInit` and renders the default view. The `FeatureFlagService` completes its background HTTP request and updates a BehaviorSubject, which triggers change detection and swaps the view.
- **Fix**: Move the HTTP request from the `AppComponent.ngOnInit` to an `APP_INITIALIZER` factory. The app will show a blank screen (or loading spinner in `index.html`) until the flags are loaded, completely preventing the FOUC.

---

## 23. EXPERT QUESTIONS
1. **Question**: Explain how you would architect an Angular application to allow third-party developers to write plugins (compiled as independent JavaScript bundles) and load them into the application at runtime without recompiling the main shell.
2. **Question**: Discuss the trade-offs between implementing Multi-Tenancy at the Database level (Database-per-Tenant) versus the Row level (Shared Database, `tenant_id` column) regarding connection pooling, schema migrations, and frontend context propagation.
3. **Question**: How do you manage continuous integration and bundle optimization when utilizing massive configuration-driven UI registries that contain hundreds of potential component mappings?
