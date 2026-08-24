# Module 21: CI/CD Issues — The "Works on My Machine" Resolution

---

## 1. WHAT
CI/CD Issues encompass the specific class of build, test, and deployment failures that occur exclusively within an automated, containerized, headless environment, despite succeeding on local developer machines. This covers lockfile drift, memory limits, AOT compilation strictness, and timing-dependent test flakiness.

---

## 2. WHY
- **Reproducibility**: Enterprise pipelines require absolute deterministic builds. If the same source code produces a different artifact on Tuesday than it did on Monday, the deployment pipeline is broken.
- **Velocity**: Flaky tests and out-of-memory (OOM) build crashes slow down merge velocity, leading to frustrated developer experiences.
- **Production Safety**: CI acts as the final gatekeeper. Issues caught by strict AOT compilation in CI directly prevent runtime crashes in production.
- **Cost**: Inefficient CI pipelines (e.g., lacking dependency caching or `nx affected` mechanics) drastically inflate cloud compute costs.

---

## 3. INTERNAL MENTAL MODEL

### The CI Pipeline Flow & Failure Points

```text
+========================================================================================+
|                              CI/CD LIFECYCLE & FAILURE VECTORS                         |
|                                                                                        |
|  [ 1. PROVISIONING ]                                                                   |
|    - Vector: Node version mismatch (Missing .nvmrc)                                    |
|           │                                                                            |
|           ▼                                                                            |
|  [ 2. DEPENDENCY INSTALLATION ]  <-- (Cache hit/miss)                                  |
|    - Vector: Using `npm install` instead of `npm ci`                                   |
|    - Vector: Lockfile drift                                                            |
|           │                                                                            |
|           ▼                                                                            |
|  [ 3. LINTING & FORMATTING ]                                                           |
|    - Vector: Prettier/ESLint mismatches across OS lines endings (CRLF vs LF)           |
|           │                                                                            |
|           ▼                                                                            |
|  [ 4. BUILD (AOT COMPILATION) ]  <-- (Heap limits apply here)                          |
|    - Vector: Node OOM (FATAL ERROR: Ineffective mark-compacts near heap limit)         |
|    - Vector: Strict Template Type Checking catches cycle/binding errors                |
|           │                                                                            |
|           ▼                                                                            |
|  [ 5. UNIT / E2E TESTING ]       <-- (Headless Chrome)                                 |
|    - Vector: Timing/Animation flakiness                                                |
|    - Vector: Viewport size mismatches in headless mode                                 |
|           │                                                                            |
|           ▼                                                                            |
|  [ 6. ARTIFACT PACKAGING ]                                                             |
|    - Vector: Missing environment.ts substitution                                       |
|    - Vector: Multi-stage Docker build cache invalidation                               |
+========================================================================================+
```

---

## 4. HOW IT WORKS

### `npm ci` vs `npm install`
1. `npm install` parses `package.json`, checks `package-lock.json`, and if differences exist or a newer minor/patch version satisfies the semver range, it installs the new version and **modifies** the lockfile.
2. `npm ci` (Clean Install) strictly reads `package-lock.json`. If `node_modules` exists, it deletes it. It guarantees the exact dependency tree on every machine. If `package.json` and `package-lock.json` are out of sync, `npm ci` fails immediately.

### Angular AOT vs JIT
1. Locally (`ng serve`), Angular uses a faster, more forgiving compilation mode.
2. In CI (`ng build --configuration=production`), Angular uses strict Ahead-of-Time (AOT) compilation. It runs the full TypeScript compiler against HTML templates (`strictTemplates: true`), ensuring every `{{ user.name }}` actually references a valid property on the component class.

---

## 5. MODERN IMPLEMENTATION

### 5.1 Deterministic CI Pipeline (GitHub Actions Example)

```yaml
# .github/workflows/ci.yml
name: Enterprise Angular CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  # Prevent Node.js Out-Of-Memory during heavy builds
  NODE_OPTIONS: "--max-old-space-size=8192"

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc' # Single source of truth for Node version
          cache: 'npm'                # Automatically caches ~/.npm based on package-lock

      - name: Install Dependencies
        run: npm ci                   # ALWAYS use ci in automation

      - name: Lint
        run: npm run lint

      - name: Strict AOT Build
        run: npm run build -- --configuration=production

      - name: Headless Tests
        # Runs Chrome in headless mode via Karma/Jasmine or Jest configuration
        run: npm run test -- --watch=false --browsers=ChromeHeadless
```

### 5.2 Multi-Stage Dockerfile for CI/CD

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Run build, leveraging AOT
RUN npm run build -- --configuration=production

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist/enterprise-app/browser /usr/share/nginx/html
COPY nginx-custom.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 6. LEGACY / ENTERPRISE REALITY

Legacy apps often struggle with:
- **Missing `package-lock.json`**: Teams utilizing YARN 1.x or older NPM versions without committing lockfiles face "drift," where a deployment on Friday suddenly breaks because a deeply nested transitive dependency published a breaking patch.
- **Environment Files**: Relying heavily on `environment.prod.ts` replacement at build time. Modern DevOps favors **"Build Once, Deploy Anywhere"**, where a single Docker image is built, and configuration is injected via environment variables (using bash scripts at container startup or `APP_INITIALIZER` fetching `/config.json`) rather than rebuilding the Angular app per environment.

---

## 7. PRACTICAL EXAMPLE

### The "Build Once, Deploy Anywhere" Configuration Setup
Instead of `environment.dev.ts` and `environment.prod.ts`, use an external config loaded at runtime.

```typescript
// core/config/app-config.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  apiUrl: string;
  enableFeatureX: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig | null = null;

  constructor(private http: HttpClient) {}

  loadConfig(): Promise<void> {
    return firstValueFrom(this.http.get<AppConfig>('/assets/config.json'))
      .then(config => {
        this.config = config;
      });
  }

  get apiBaseUrl() { return this.config?.apiUrl; }
}

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: AppConfigService) => () => configService.loadConfig(),
      deps: [AppConfigService],
      multi: true
    }
  ]
};
```
*In the CI/CD pipeline, the orchestrator (Kubernetes/Docker) simply overwrites `/usr/share/nginx/html/assets/config.json` per environment, avoiding recompilation.*

---

## 8. COMMON MISTAKES

1. **`npm install` in CI**: Using `npm install` in Jenkins/GitHub Actions. It mutates the lockfile and risks installing different versions than what was tested locally.
2. **Ignoring OOM Errors**: A pipeline randomly fails with `JavaScript heap out of memory`. Developers just restart the build. Without configuring `NODE_OPTIONS=--max-old-space-size=8192`, it will continue to fail.
3. **Hardcoding Viewport in Tests**: Writing tests that assert DOM element visibility (`display: none`) based on desktop CSS media queries, which fail when Headless Chrome defaults to an 800x600 viewport.

---

## 9. LOCAL ISSUES

- **Symptom**: You clone the repo, run `npm install`, and immediately see 50 changed files in `package-lock.json` before touching any code.
- **Root Cause**: Your local Node/NPM version (`npm v10`) differs from the version used by the last developer (`npm v8`). Lockfile formats changed (v2 vs v3 lockfile).
- **Fix**: Enforce Node version pinning using a `.nvmrc` file and run `nvm use` or `fnm use` before working.

---

## 10. CI/CD ISSUES

- **Symptom**: `ERROR: 'forwardRef' is not a known element` or `Circular dependency detected`.
- **Root Cause**: AOT compilation is strictly enabled in CI via `--configuration=production`. Locally, `ng serve` (JIT or relaxed AOT) may tolerate circular dependencies between modules or standalone components.
- **Fix**: Extract the shared dependency into a third library or component to break the import cycle.

- **Symptom**: CSS animations cause E2E or Component tests to timeout or fail randomly in CI.
- **Root Cause**: Headless browsers render frames differently under heavy CI CPU load. An animation that takes 300ms locally might stretch to 1000ms in CI.
- **Fix**: Provide `NoopAnimationsModule` in test setups to instantly complete animations.

---

## 11. PRODUCTION ISSUES

- **Symptom**: Users see an old version of the app after deployment.
- **Root Cause**: Build artifacts were not hashed, or caching headers on the CDN/Nginx are incorrect.
- **Fix**: Ensure Angular's output hashing is enabled (`"outputHashing": "all"` in `angular.json`), and configure the web server to cache `index.html` with `Cache-Control: no-cache`, but cache `*.js` bundles immutably for 1 year.

---

## 12. FULL-STACK INTERACTION

### End-to-End Pipeline
When Spring Boot and Angular share a pipeline or are deployed in tandem:
- **Contract Testing**: CI executes Pact tests to ensure Angular's HTTP client expectations match Spring Boot's API responses before allowing deployment.
- **Semantic Release**: Using Conventional Commits (`feat: add transfer`, `fix: payment bug`), CI auto-generates release notes, increments version numbers, and tags Docker images coordinately across frontend and backend repos.

---

## 13. DEBUGGING PROCESS

### Diagnosing Headless Test Failures
If a test passes locally but fails in CI:
1. **Rule out network/dependency**: Verify `npm ci` was used.
2. **Replicate Headless Locally**: Run `ng test --browsers=ChromeHeadless` locally.
3. **Check Viewport**: Does the test rely on element width/visibility? Log `window.innerWidth` in the test.
4. **Timing Issues**: Use `fakeAsync` and `tick()` to gain deterministic control over time, rather than relying on `setTimeout` or real-world DOM rendering speed.

---

## 14. ROOT CAUSE ANALYSIS

### Why AOT Catches More Errors
In AOT mode, the Angular compiler (`ngtsc`) translates your HTML templates into a TypeScript Type Check Block (TCB).
```html
<!-- Template -->
<div *ngIf="user.isAdmin">{{ user.name }}</div>
```
```typescript
// Generated TCB
if (ctx.user.isAdmin) {
  "" + ctx.user.name; // TSC checks if user has 'name' property
}
```
If `user` is typed as `{ isAdmin: boolean }` without a `name` property, standard TypeScript compilation will fail. Local JIT mode evaluates the template at runtime in the browser, failing silently or showing `undefined`, but CI AOT mode enforces type safety strictly.

---

## 15. FIX

### Fixing the OOM Build Error
```yaml
# Add to CI Pipeline Configuration
env:
  NODE_OPTIONS: "--max-old-space-size=8192" # Grants 8GB RAM to Node process
```

### Fixing Flaky Animation Tests
```typescript
// core/testing/setup.ts
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

TestBed.configureTestingModule({
  providers: [
    // Use Noop in tests to eliminate animation timing flakiness
    provideNoopAnimations()
  ]
});
```

---

## 16. PREVENTION

1. **Nx Affected**: In a monorepo, configure CI to only lint, build, and test projects that have changed since the last green build (`npx nx affected --target=build`). This saves massive CI compute time.
2. **Husky & Lint-Staged**: Catch formatting and lint errors locally on pre-commit, rather than waiting 5 minutes for CI to fail.
3. **Dependabot / Renovate**: Automate lockfile updates via bot PRs to ensure dependencies are constantly vetted against the CI pipeline.

---

## 17. MONITORING / OBSERVABILITY

- **Pipeline Telemetry**: Track CI build times. If average build time creeps from 4 minutes to 12 minutes over a quarter, investigate caching, enable Nx distributed task execution (DTE), or check bundle sizes.
- **Artifact Size Monitoring**: Implement a pipeline step (e.g., using `bundlesize` or Angular's budget feature) to fail the build if the main JS bundle exceeds a set threshold (e.g., 500kb).

---

## 18. PERFORMANCE CONSIDERATIONS

- **Docker Caching**: In a multi-stage Dockerfile, copy `package.json` and run `npm ci` BEFORE copying the rest of the source code. This allows Docker to cache the entire `node_modules` layer as long as the lockfile hasn't changed, reducing build times from minutes to seconds.
- **NPM Cache**: Utilize CI platform caching for `~/.npm` (Linux) or `%AppData%\npm-cache` (Windows).

---

## 19. SECURITY CONSIDERATIONS

- **Malicious Dependency Injections**: CI is vulnerable to supply chain attacks. Run `npm audit` or tools like Snyk in the pipeline to fail builds introducing known CVEs.
- **Secret Leakage**: Never bake secrets (API keys) into `environment.ts` which get hardcoded into JS bundles via the CI build. Always inject sensitive values into the backend and expose safe public variables via runtime configuration.

---

## 20. TESTING STRATEGY

- **Test Isolation**: Ensure tests clean up after themselves. Leftover DOM elements or unclosed subscriptions can cause subsequent tests in the headless runner to fail, creating phantom flakiness.
- **Retries**: For flaky E2E tests (Cypress/Playwright), implement a retry mechanism in CI, but flag tests that require retries for immediate investigation to prevent "retry blindness."

---

## 21. EXERCISES

1. **The Strict Fixer**: Take a legacy Angular app. Run `ng build --configuration=production`. Resolve all strict template type-checking errors that emerge.
2. **The Dockerizer**: Write a highly optimized, two-stage Dockerfile for an Angular app that leverages layer caching to build the app and serve it via a lightweight Nginx container.

---

## 22. BREAK-AND-FIX LAB

**Issue**: `ANG-CI-001`
**Description**: "AOT catches template type error in CI that JIT misses locally." Developer adds a new property to a template, serves locally, and sees it work. Pushes to CI, and the build fails.
**Reproduction**: 
1. In a component, create `user: any = { name: 'Alice' }`.
2. In template: `{{ user.firstName }}`.
3. Run `ng serve` (works). Run `ng build --configuration=production`.
**Diagnostic**: Build fails with `Property 'firstName' does not exist on type 'any'`.
**Fix**: Define an interface `User { firstName: string }`, type the property correctly, and fix the template binding.

---

## 23. EXPERT QUESTIONS

1. **"Explain the difference between `environment.ts` substitution at build time versus using `APP_INITIALIZER` to fetch configuration at runtime. Why is the latter required for 12-Factor App compliance?"**
   *Answer*: `environment.ts` builds the configuration directly into the static JS bundles, requiring a separate CI build process for every environment (Dev, QA, Prod). `APP_INITIALIZER` fetches a dynamic JSON file at startup. This enables "Build Once, Deploy Anywhere", satisfying the 12-Factor App methodology which mandates separating configuration from the codebase.

2. **"If a CI build randomly fails with a heap out-of-memory error during AOT compilation, but you cannot increase the container's RAM, what Angular architectural changes can you make to reduce memory pressure?"**
   *Answer*: Migrate to a monorepo structure (like Nx) and split the monolith into smaller, independently buildable libraries. Enable incremental compilation and `nx affected` builds so the compiler only processes a fraction of the codebase per build, drastically reducing the AST memory footprint.

3. **"How does `npm ci` handle transitive dependency drift compared to `npm install`, and why is this critical for deterministic builds?"**
   *Answer*: `npm install` may update the `package-lock.json` if it finds newer versions that satisfy the semver ranges of dependencies or sub-dependencies, resulting in non-deterministic builds across machines. `npm ci` strictly honors the exact versions mapped in `package-lock.json` and deletes existing `node_modules` first, guaranteeing a 100% reproducible dependency tree.
