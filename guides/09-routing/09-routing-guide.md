# Module 09: Angular Routing Deep Dive

---

## 1. WHAT
Angular Routing is a sophisticated, event-driven navigation system that maps URL paths to component trees, manages application state transitions, handles deferred module loading (lazy loading), and orchestrates view hierarchies using a directed acyclic graph of routes.

## 2. WHY
Modern single-page applications (SPAs) require routing to simulate traditional multi-page navigation without full page reloads. Angular Routing enables deep linking, browser history manipulation, lazy loading for optimized bundle sizes, and route-level authorization mechanisms, providing a seamless user experience while interacting with robust Spring Boot backend services.

## 3. INTERNAL MENTAL MODEL
The Angular Router operates as a state machine. When a URL change occurs, the router processes a sequence of phases:

```text
[URL Change] --> 1. Parse URL 
             --> 2. Apply Redirects (match path) 
             --> 3. Recognize Router State
             --> 4. Run Guards (canMatch -> canActivate/canDeactivate -> canActivateChild)
             --> 5. Run Resolvers (resolve data before component instantiation)
             --> 6. Activate Components (inject into RouterOutlet)
             --> 7. Update URL & View

+-------------------------------------------------------------+
|                     Router Lifecycle                        |
|                                                             |
|  NavigationStart                                            |
|        │                                                    |
|  RoutesRecognized                                           |
|        │                                                    |
|  GuardsCheckStart -> GuardsCheckEnd                         |
|        │                                                    |
|  ResolveStart -> ResolveEnd                                 |
|        │                                                    |
|  NavigationEnd (or NavigationCancel / NavigationError)      |
+-------------------------------------------------------------+
```

## 4. HOW IT WORKS
1. **Trigger**: Navigation initiates via `Router.navigate()`, `Router.navigateByUrl()`, or a `routerLink` directive click.
2. **Parsing**: The router converts the URL string into an `UrlTree`.
3. **Recognition**: The router traverses the configured `Routes` array, matching paths. Wildcards and `pathMatch` rules are evaluated.
4. **Guards Evaluation**: It executes functional route guards. If a guard returns `false` or an `UrlTree`, navigation is cancelled or redirected.
5. **Data Resolution**: Resolvers execute to fetch necessary data (e.g., via HttpClient to Spring Boot) before the view renders.
6. **Activation**: Target components are instantiated and inserted into their respective `<router-outlet>` directives.
7. **Completion**: The browser URL is updated, and `NavigationEnd` fires.

## 5. MODERN IMPLEMENTATION
In Angular 19+, routing is configured functionally using `provideRouter` in `ApplicationConfig`, leveraging standalone components, functional guards, and component input binding.

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(), // Maps route params directly to @Input()
      withViewTransitions()        // Enables View Transitions API for animations
    )
  ]
};

// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    title: 'Dashboard | Enterprise App'
  },
  {
    path: 'accounts/:accountId',
    loadComponent: () => import('./accounts/account-details.component').then(m => m.AccountDetailsComponent),
    canActivate: [authGuard],
    // accountId becomes an @Input() in AccountDetailsComponent due to withComponentInputBinding
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
    canMatch: [adminGuard] // Prevents loading the chunk if not admin
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' } // Wildcard fallback
];

// core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
```

## 6. LEGACY / ENTERPRISE REALITY
Older codebases use `RouterModule.forRoot()` inside an `AppModule`, class-based guards implementing `CanActivate` interfaces, and lazy loading via strings (deprecated) or `loadChildren` pointing to `NgModule` classes.

**Migration:** 
1. Convert class guards to functional guards using `inject()`.
2. Replace `CanLoad` with `CanMatch`.
3. Switch `loadChildren` targeting modules to `loadComponent` or `loadChildren` targeting route arrays for standalone components.

## 7. PRACTICAL EXAMPLE
An enterprise banking application requires a transfer page. The route must ensure the user is logged in, ensure the target account exists before rendering, and bind the transaction ID from the URL directly to the component.

```typescript
// transfer.routes.ts
export const TRANSFER_ROUTES: Routes = [
  {
    path: ':transactionId',
    loadComponent: () => import('./transfer.component'),
    canActivate: [authGuard],
    resolve: {
      transaction: transactionResolver
    }
  }
];

// transfer.component.ts
@Component({
  selector: 'app-transfer',
  standalone: true,
  template: `<h1>Transfer {{ transactionId() }}</h1> <p>{{ transaction().amount }}</p>`
})
export default class TransferComponent {
  // Automatically bound from route parameter :transactionId
  transactionId = input<string>(); 
  
  // Automatically bound from the 'transaction' resolver data
  transaction = input<TransactionData>(); 
}
```

## 8. COMMON MISTAKES
1. **Confusing Frontend Guards with Security:** Believing `canActivate` secures data. Guards are UX tools; security *must* be enforced by Spring Boot endpoints.
2. **Heavy Resolvers:** Performing slow API calls in resolvers, causing the UI to freeze (no route transition happens until the resolver completes).
3. **Memory Leaks in Subscriptions:** Subscribing to `ActivatedRoute.params` but failing to understand that the component is reused, leading to multiple subscriptions if not using `takeUntilDestroyed()`.
4. **Incorrect Path Matching:** Forgetting `pathMatch: 'full'` on empty path redirects, causing infinite routing loops.

## 9. LOCAL ISSUES
- **Development Server 404s:** Directly navigating to a deep link works in `ng serve` because of webpack-dev-server's history API fallback, but might fail in production if the server isn't configured to route all paths to `index.html`.
- **Stale Data:** Components re-using the same instance for different parameters (e.g., `/user/1` to `/user/2`), requiring listening to `paramMap` observables rather than `snapshot`.

## 10. CI/CD ISSUES
- Broken lazy load imports due to incorrect casing on case-sensitive Linux build agents, even if it worked on Windows/macOS.
- Circular dependencies caused by route configurations importing services that in turn inject the router.

## 11. PRODUCTION ISSUES
- **Asset Hashing Mismatches:** Deploying a new version while users are navigating. A lazy-loaded chunk from the old version is requested but no longer exists (ChunkLoadError).
- **Backend 404 on Deep Links:** Nginx or Apache Tomcat returning 404 for Angular routes because they are not configured to fallback to `index.html`.

## 12. FULL-STACK INTERACTION
Angular Route Guards (`canActivate`) and Spring Security (`@PreAuthorize`) operate on two entirely different planes.
- **Frontend Guards:** Purely for UX. They prevent the browser from rendering a screen. They do NOT protect the data. A malicious user can bypass guards or inspect API payloads in DevTools.
- **Spring Security:** The actual security boundary. Even if a user hacks the frontend router to reach `/admin`, the API calls to `GET /api/admin/data` will return a `403 Forbidden` from Spring Boot.

## 13. DEBUGGING PROCESS
1. Enable route tracing temporarily: `provideRouter(routes, withDebugTracing())`.
2. Inspect the console for `NavigationStart`, `GuardsCheckStart`, etc.
3. Check if a guard is returning an uncompleted Observable, causing navigation to hang.
4. Verify Nginx/Spring MVC configuration if deep links return 404 (ensure `server.error.whitelabel.enabled=false` and mapping to `index.html` is present).

## 14. ROOT CAUSE ANALYSIS
When a user clicks a link and nothing happens, the most common root cause is a guard or resolver returning an `Observable` that never completes or emits a value. The Angular Router waits indefinitely for the Observable to resolve before proceeding to the next routing phase.

## 15. FIX
Ensure all Observables in guards and resolvers complete. Use `.pipe(take(1))` or `first()` when wrapping persistent streams (like a NgRx selector or an ongoing WebSocket connection).

```typescript
export const roleGuard: CanActivateFn = () => {
  const store = inject(Store);
  return store.select(selectUserRole).pipe(
    filter(role => role !== null),
    take(1), // Crucial: Router needs a completed observable
    map(role => role === 'ADMIN')
  );
};
```

## 16. PREVENTION
- Enforce strict typing in route data and resolver returns.
- Write unit tests for guards to ensure they emit exactly one value and complete.
- Use `withComponentInputBinding()` to eliminate boiler-plate `ActivatedRoute` subscriptions, inherently avoiding memory leaks.

## 17. MONITORING / OBSERVABILITY
- Monitor `ChunkLoadError` exceptions in tools like Sentry. This indicates a user is on an outdated client version attempting to lazy-load a module that was overwritten in a new deployment.
- Track route transition times by hooking into `NavigationStart` and `NavigationEnd` events and sending telemetry to the backend.

## 18. PERFORMANCE CONSIDERATIONS
- **Preloading:** Use `withPreloading(PreloadAllModules)` or a custom preloading strategy to download lazy chunks in the background *after* the initial application load, eliminating network latency when the user eventually navigates.
- **Resolvers vs. Skeletons:** Resolvers delay component rendering. For perceived performance, it is often better to load the component immediately and show a skeleton loader while fetching data, rather than blocking navigation with a resolver.

## 19. SECURITY CONSIDERATIONS
- **Defense in Depth:** Never put sensitive logic, encryption keys, or privileged data within lazy-loaded chunks just because they are protected by a `canMatch` guard. The JavaScript payload is entirely readable if a user guesses the chunk URL.
- **CSRF & Navigation:** Ensure that router state doesn't leak sensitive session identifiers into the URL parameters, which could be logged by proxy servers or exposed via the `Referer` header.

## 20. TESTING STRATEGY
- **Unit Testing Guards:** Test the functional guard using `TestBed.runInInjectionContext` directly without bringing up the entire Router.
- **Integration Testing Router:** Use `provideRouter` and `RouterTestingHarness` to verify navigation flows, checking that specific components render when URLs change.

```typescript
it('should redirect to login if not authenticated', () => {
  TestBed.runInInjectionContext(() => {
    const result = authGuard(mockRoute, mockState);
    expect(result).toBeInstanceOf(UrlTree); // Navigates away
  });
});
```

## 21. EXERCISES
1. Implement a custom Preloading Strategy that only preloads routes where `data: { preload: true }`.
2. Migrate an old `CanActivate` class-based guard into a modern functional guard using `inject()`.
3. Set up a global route loading indicator component that listens to `RouterEvent` streams.

## 22. BREAK-AND-FIX LAB
**Defect ANG-ROUTING-001: Guard allows route, API returns 403**
- **Scenario:** The Angular `canActivate` guard allows access to `/hr-portal` based on a stale JWT claim in localStorage, but the Spring Boot backend has revoked the user's HR role.
- **Reproduction:** Navigate to `/hr-portal`. The view renders, but the data grid is empty and the network tab shows a 403 Forbidden.
- **Diagnostic Steps:** Inspect the router events (navigation succeeds) vs Network tab (API fails).
- **Fix:** Implement a global `HttpInterceptor` that catches `403 Forbidden` responses, displays a toast notification ("Permissions revoked"), and programmatically triggers `router.navigate(['/login'])`, clearing local state.

## 23. EXPERT QUESTIONS
1. **"How does `canMatch` differ fundamentally from `canActivate`, and why did the Angular team deprecate `canLoad` in its favor?"**
   *(Answer: `canActivate` prevents activation but still matches the route. `canMatch` prevents the route from even being matched, allowing the router to fall through to alternative routes with the exact same path based on user roles. It replaces `canLoad` because `canLoad` only applied to lazy-loaded modules, whereas `canMatch` applies universally.)*

2. **"If multiple routes match a URL, how does Angular determine priority, and how do you implement a dynamic route matcher?"**
   *(Answer: Angular uses first-match-wins order from the `Routes` array. For advanced scenarios, a custom `MatcherFn` can be provided in the route configuration to parse URLs via regex or custom logic instead of static paths.)*

3. **"In a high-security Enterprise banking app, an auditor points out that your admin dashboard route is lazy-loaded but protected only by `canMatch`. What is the actual vulnerability here, and how do you remediate it full-stack?"**
   *(Answer: The vulnerability is that the compiled JS chunk for the admin dashboard is still hosted publicly on the web server. Anyone who knows or discovers the chunk name (`chunk-admin.js`) can download and reverse-engineer the source code. Remediation requires ensuring no hardcoded secrets exist in the frontend code, and enforcing robust Spring Security endpoint protection, treating all frontend code as inherently untrusted public knowledge.)*
