# Module 28: Migrations and Upgrades — Keeping the Enterprise Codebase Alive

---

## 1. WHAT
Migrations and Upgrades involve the systematic process of moving an enterprise Angular application across major framework versions. This encompasses executing automated CLI schematics (e.g., Standalone, Signals, Control Flow), managing breaking changes in underlying toolchains (TypeScript, Node.js, RxJS), and refactoring deprecated architectural patterns without halting feature delivery.

---

## 2. WHY
- **Security & Compliance**: Enterprise platforms cannot run on End-Of-Life (EOL) framework versions due to unpatched CVEs.
- **Developer Retention**: Engineers want to work with modern paradigms (Signals, Zoneless). Legacy codebases (e.g., Angular 14 NgModules) suffer from high attrition.
- **Performance Improvements**: Framework upgrades (like Ivy, Standalone, and Signals) bring massive bundle size reductions and change detection speedups out-of-the-box.
- **Ecosystem Compatibility**: Third-party libraries drop support for old Angular versions quickly. Stalling an upgrade prevents the adoption of necessary new libraries.

---

## 3. INTERNAL MENTAL MODEL

### The Enterprise Upgrade Lifecycle

```text
+========================================================================================+
|                             INCREMENTAL UPGRADE ARCHITECTURE                           |
|                                                                                        |
|  [ 1. PRE-FLIGHT & TOOLCHAIN ALIGNMENT ]                                               |
|    - Upgrade Node.js & npm/yarn/pnpm to target version                                 |
|    - Update TypeScript version to align with target Angular                            |
|    - Assess Third-Party Library compatibility (ngx-translate, chart.js, etc.)          |
|                                                                                        |
|  [ 2. CORE FRAMEWORK UPGRADE (ng update) ]                                             |
|    ng update @angular/cli @angular/core                                                |
|    └── Runs Schematics: Auto-fixes imports, basic breaking changes                     |
|                                                                                        |
|  [ 3. ARCHITECTURAL MIGRATIONS (Schematics) ]                                          |
|    ├── Step A: Control Flow      (ng g @angular/core:control-flow)                     |
|    ├── Step B: Standalone        (ng g @angular/core:standalone)                       |
|    ├── Step C: Signal Inputs     (ng g @angular/core:signal-input-migration)           |
|    └── Step D: Signal Queries    (ng g @angular/core:signal-queries-migration)         |
|                                                                                        |
|  [ 4. MANUAL DEPRECATION REMEDIATION ]                                                 |
|    - Angular Material MDC migration (v15)                                              |
|    - RxJS v7/v8 deprecations (replacing string operators, subscribe signatures)        |
|                                                                                        |
|  [ 5. THE ZONELESS HORIZON ]                                                           |
|    - Remove Zone.js from polyfills, adopt provideExperimentalZonelessChangeDetection() |
+========================================================================================+
```

---

## 4. HOW IT WORKS

### The `ng update` Execution Pipeline
When `ng update @angular/core@19` is executed:
1. The CLI reads the `package.json` to identify current versions.
2. It fetches the target package and inspects its `migrations.json` file.
3. The CLI downloads the required AST (Abstract Syntax Tree) transformation tools.
4. It executes migration schematics in sequence (e.g., V17 to V18, then V18 to V19).
5. The schematics rewrite source code files, auto-fixing removed APIs or renamed imports (e.g., migrating to the new `@angular/core/rxjs-interop`).
6. It runs `npm install` to finalize the dependency tree.

---

## 5. MODERN IMPLEMENTATION

### Running the Modern Migration Schematics

Angular provides built-in schematics to modernize legacy codebases step-by-step:

```bash
# 1. Update Core Framework (do this ONE major version at a time)
ng update @angular/core@19 @angular/cli@19

# 2. Migrate from *ngIf / *ngFor to @if / @for
ng generate @angular/core:control-flow

# 3. Migrate to Standalone Components (run multiple times per directory)
ng generate @angular/core:standalone

# 4. Migrate @Input() to input() Signals
ng generate @angular/core:signal-input-migration

# 5. Migrate @ViewChild / @ContentChildren to viewChild() / contentChildren()
ng generate @angular/core:signal-queries-migration
```

---

## 6. LEGACY / ENTERPRISE REALITY

### The "Big Bang" Anti-Pattern
Legacy enterprises often wait 3 years, accumulating 5 major version jumps (e.g., v13 to v18).
They attempt a "Big Bang" upgrade in a long-lived feature branch.
**Reality**: The branch suffers massive merge conflicts every week. By the time the upgrade is stable, business features are vastly out of sync.

### Incremental Migration Strategy (The Strangler Fig Pattern)
- Keep the app running on the current version.
- Upgrade the framework version first, leaving legacy syntax (`NgModules`, `*ngIf`) intact (Angular guarantees backward compatibility).
- Migrate module-by-module to `Standalone`.
- Migrate component-by-component to `Signals`.
- Merge to `main` continuously. The application can run a mix of Standalone and NgModules indefinitely.

---

## 7. PRACTICAL EXAMPLE

### Migrating an Enterprise App from Angular 15 (NgModules) to Angular 19 (Standalone)

**Phase 1: Bootstrapping**
```typescript
// Legacy: main.ts
platformBrowserDynamic().bootstrapModule(AppModule);

// Modern: main.ts
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(ROUTES),
    provideHttpClient(withInterceptors([authInterceptor]))
    // ... importProvidersFrom(LegacySharedModule) if needed temporarily
  ]
});
```

**Phase 2: Component Conversion**
```typescript
// Legacy
@Component({ selector: 'app-user', templateUrl: './user.html' })
export class UserComponent {
  @Input() userId: string;
}

// Modern (Post-Schematic)
@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user.html'
})
export class UserComponent {
  readonly userId = input<string>();
}
```

---

## 8. COMMON MISTAKES

1. **Skipping Major Versions**: Running `ng update @angular/core@15` to `@19` directly. Angular requires migrating one major version at a time (15 → 16 → 17 → 18 → 19) because migration schematics depend on intermediate AST transformations.
2. **Ignoring Peer Dependencies**: Upgrading Angular but forgetting that `ngrx`, `ngx-translate`, or Angular Material must be upgraded in the exact same PR.
3. **Forced Upgrades**: Using `ng update --force`. This overrides dependency conflicts but often results in a broken node_modules tree where a third-party library is incompatible with the new Angular version.

---

## 9. LOCAL ISSUES

- **Symptom**: After running `ng update`, `npm start` throws random module resolution errors like `Error: TS2307: Cannot find module '@angular/core'`.
- **Root Cause**: `node_modules` is out of sync or corrupted by a failed lockfile merge during the schematic execution.
- **Fix**: Run `rm -rf node_modules package-lock.json`, clear cache (`npm cache clean --force`), and reinstall (`npm install`).

---

## 10. CI/CD ISSUES

- **Symptom**: The upgrade branch passes locally but fails in CI with Node.js engine incompatibility.
- **Root Cause**: Developer machine uses Node 20, but the CI pipeline Docker image is hardcoded to Node 16 (which is incompatible with Angular 18+).
- **Fix**: Align the `.nvmrc` and the CI pipeline's base image/Node setup step to the exact Node version required by the new Angular version.

---

## 11. PRODUCTION ISSUES

- **Symptom**: After a major version upgrade (e.g., v14 to v15 MDC Material migration), the application deploys successfully, but users report buttons are misaligned and tables are overflowing.
- **Root Cause**: The Angular Material MDC migration completely rewrote the underlying DOM structure of components (`<mat-form-field>`, `<button>`). Custom global CSS overrides targeting legacy Material classes (`.mat-button-wrapper`) broke silently.
- **Fix**: Use Visual Regression Testing tools (Percy, BackstopJS) before deploying structural DOM changes to production.

---

## 12. FULL-STACK INTERACTION

### TypeScript Alignment with Spring Boot
When upgrading Angular, the TypeScript version is strictly bumped. This often enables stricter type checking.
If the Spring Boot API contract generates an OpenAPI TypeScript client, the generated client might fail compilation on the new TypeScript version (e.g., due to `exactOptionalPropertyTypes`).
**Action**: Ensure the OpenAPI generator is updated simultaneously to output modern, compliant TypeScript definitions.

---

## 13. DEBUGGING PROCESS

### Diagnosing a Failed `ng update`
1. Run `ng update` (without packages) to see available updates and warnings.
2. Check `npm ls <package>` for dependency tree conflicts.
3. If `ng update` fails mid-execution, read the terminal output carefully—it often specifies which file's AST could not be parsed.
4. Temporarily revert the problematic file, re-run the schematic, and manually migrate the reverted file afterward.
5. Use `--commit=false` to inspect changes before they are committed to Git.

---

## 14. ROOT CAUSE ANALYSIS

### Why Third-Party Libraries Break Upgrades
Angular uses Ivy as its compilation engine. In older versions (pre-v16), libraries published using View Engine format required `ngcc` (Angular Compatibility Compiler) to run post-install. Angular 16 removed `ngcc` entirely. If a third-party library has not been published natively with Ivy (i.e., it is unmaintained since 2021), the Angular upgrade will permanently fail because the framework can no longer digest View Engine libraries.

---

## 15. FIX

### Fixing Incompatible Third-Party Libraries
If an unmaintained library blocks the upgrade:
1. **Fork and Patch**: Fork the repository, upgrade its build system to output Ivy, and publish to an internal enterprise registry.
2. **Replace**: Swap it for a modern equivalent (e.g., swapping a dead date-picker for Angular Material).
3. **Wrap as Web Component**: If replacement is impossible, isolate the legacy component in a Web Component using Angular Elements built on the older framework version, though this is a last resort.

---

## 16. PREVENTION

1. **Migration Cadence**: Establish an engineering OKR to perform minor Angular updates monthly and major updates within 3 months of release.
2. **Deprecation Warnings**: Treat console deprecation warnings as errors during local development to fix them proactively before they are removed in the next major version.
3. **Isolate Third-Party Dependencies**: Wrap third-party libraries (e.g., charts, grids) in custom adapter components. When a library requires swapping during an upgrade, you only rewrite the adapter, not the 50 consuming feature components.

---

## 17. MONITORING / OBSERVABILITY

- **Bundle Size Tracking**: Major upgrades often decrease bundle sizes. Track the `main.js` output size before and after the Standalone/Control Flow migrations to report ROI to stakeholders.
- **Runtime Error Spikes**: Monitor Sentry heavily in the 48 hours following a major framework upgrade. Unexpected breaking changes in RxJS (e.g., `subscribe` syntax changes) can cause silent runtime drops if the AST migration was incomplete.

---

## 18. PERFORMANCE CONSIDERATIONS

- **The Control Flow Migration**: Migrating from `*ngIf`/`*ngFor` to `@if`/`@for` provides immediate performance gains. The new control flow operates without creating embedded views through directives, reducing the runtime execution overhead and dropping the `CommonModule` payload from the bundle.
- **Signals Migration**: Adopting `input()` and `viewChild()` sets the stage for `ChangeDetectionStrategy.OnPush` and eventually Zoneless, which fundamentally eliminates deep component tree traversals.

---

## 19. SECURITY CONSIDERATIONS

- **Automated Refactoring Risks**: Schematics use AST manipulation to rewrite code. While highly reliable, they can occasionally refactor complex security-sensitive logic (like custom HttpInterceptors handling auth tokens) incorrectly if the code was highly unconventional. Always manually code-review automated schematic PRs, focusing specifically on security boundaries.

---

## 20. TESTING STRATEGY

### Migration Confidence Testing
1. **Automated Unit Tests**: The most critical safety net. Ensure tests pass before starting the upgrade.
2. **Parallel CI Runs**: During a large migration, configure CI to run the build/test pipeline on both the old and new branches.
3. **Visual Regression**: Use tools to snapshot UI components before and after the Material MDC migration.
4. **Contract Testing**: Ensure HTTP interceptors and service layers still communicate perfectly with the Spring Boot backend via Pact or Cypress E2E tests.

---

## 21. EXERCISES

1. **The Step-by-Step Upgrader**: Take an open-source Angular 15 project. Upgrade it to Angular 16, then 17, then 18. Document every manual intervention required during the `ng update` process.
2. **The Standalone Converter**: Run the `ng g @angular/core:standalone` schematic on an `NgModule`-heavy feature. Review the resulting `imports: []` arrays. Find and eliminate any unnecessary imports left behind by the schematic.

---

## 22. BREAK-AND-FIX LAB

**Issue**: `ANG-MIGRATE-001`
**Description**: "Partial Standalone Migration Leaves Orphaned NgModule Providers." A team ran the standalone schematic on `DashboardComponent` but forgot to migrate the parent `DashboardModule`. The module provided a stateful singleton `DashboardService`.
**Reproduction**: 
1. `DashboardComponent` is now standalone and imported directly into the router.
2. `DashboardModule` is never imported anywhere anymore.
3. At runtime, injecting `DashboardService` throws a `NullInjectorError`.
**Diagnostic**: The service was provided in a now-orphaned module, not in `providedIn: 'root'` or the component itself.
**Fix**: Move the service provider to the route definition: `provideRouter([{ path: '', component: DashboardComponent, providers: [DashboardService] }])`.

---

## 23. EXPERT QUESTIONS

1. **"When running the `ng g @angular/core:standalone` schematic on a massive enterprise codebase, why is it recommended to run it on a per-directory basis rather than the entire `src/` folder at once?"**
   *Answer*: Running the schematic globally on thousands of files generates an un-reviewable PR, often exceeding GitHub's UI limits. It also maximizes the chance of merge conflicts against active feature branches. An incremental, per-feature directory approach allows for atomic PRs, thorough code review, and localized regression testing without halting feature development.

2. **"Angular 16 removed the Angular Compatibility Compiler (ngcc). What architectural challenge does this pose for enterprise upgrades, and how do you resolve it?"**
   *Answer*: Any internal or external library still using the legacy View Engine format will immediately break the build, as `ngcc` is no longer there to compile them to Ivy at post-install. To resolve this, you must upgrade the third-party library to an Ivy-native version, replace it, or update your internal Nexus/Artifactory library build pipelines to use modern `ng-packagr` formats before attempting the consuming application upgrade.

3. **"Explain the performance advantage of migrating from `@ViewChild` to the Signal-based `viewChild()` regarding change detection."**
   *Answer*: The legacy `@ViewChild` relies on lifecycle hooks (`ngAfterViewInit`) to guarantee readiness, often forcing developers to trigger manual `detectChanges()` or defer state updates, leading to `ExpressionChangedAfterItHasBeenCheckedError`. `viewChild()` returns a reactive Signal. It seamlessly integrates into `computed()` signals and reactive control flow, naturally propagating dirtiness to the exact consumers without relying on synchronous lifecycle hooks or full component tree traversals.
