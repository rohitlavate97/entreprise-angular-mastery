# Debugging Playbooks Index

Standard operating procedures for diagnosing, isolating, and fixing critical enterprise frontend and full-stack failures.

All playbooks follow the **10-Step Senior Investigation Lifecycle**:
`OBSERVE` → `COLLECT EVIDENCE` → `FORM HYPOTHESES` → `ELIMINATE VARIABLES` → `REPRODUCE` → `ROOT CAUSE` → `FIX` → `VERIFY` → `PREVENT` → `MONITOR`

---

## 📖 Playbook Catalog

| # | Playbook Title | Key Diagnostic Tools |
|---|---|---|
| 01 | **Application Does Not Start** | Webpack/esbuild logs, Node runtime version, tsconfig flags |
| 02 | **Build Fails Locally** | TypeScript strict checks, compiler options, path aliases |
| 03 | **Build Fails in CI Only** | Node/npm lockfile drift, case-sensitive filesystem (Linux vs Windows), headless envs |
| 04 | **Works Locally, Fails in Production** | Minification side-effects, environment replacements, proxy bypass |
| 05 | **UI Does Not Update (Change Detection)** | Angular DevTools profiler, Signals graph, `ChangeDetectorRef`, `NgZone` boundary |
| 06 | **API Called Multiple Times Unexpectedly** | RxJS stream tracing, multiple subscriptions, effect dependencies, duplicate events |
| 07 | **API Not Called at All** | Cold Observable execution check, missing `.subscribe()` or `toSignal()`, guard blocking |
| 08 | **Memory Continuously Grows** | Chrome DevTools Memory Heap Snapshot, detached DOM trees, unclosed Observables |
| 09 | **Page Becomes Slower Over Time** | Performance profiler, excessive change detection cycles, unoptimized template bindings |
| 10 | **404 On Page Refresh in SPA** | Nginx `try_files` configuration, HTML5 PushState routing fallback |
| 11 | **Lazy-Loaded Chunk Fails to Load** | CDN invalidation, chunk hashing strategy, service worker cache update |
| 12 | **Authentication Randomly Fails** | Token expiration timing, clock drift, cross-origin cookie restrictions |
| 13 | **Token Refresh Creates Infinite Loop** | Refresh interceptor circular call, 401 handling on the refresh endpoint itself |
| 14 | **CORS Failure Diagnosis** | Browser DevTools Network tab, OPTIONS preflight response headers, Spring Security filter chain |
| 15 | **Hydration Mismatch Diagnosis** | Angular hydration flags, server vs client DOM diff, browser-only APIs (`window`, `localStorage`) |
| 16 | **SSR Server Crash / Instability** | Node.js process logs, unhandled rejections, Zone.js microtask/macrotask stability |
| 17 | **Production Minified Error Tracing** | Production source maps, Sentry symbolication, unminified stack reconstruction |
| 18 | **Error Cannot Be Reproduced Locally** | Network latency simulation, CPU throttling, production data volume recreation |
| 19 | **Intermittent Race Conditions** | Chrome Network throttling, RxJS concurrency operators (`exhaustMap`, `switchMap`, `concatMap`) |
| 20 | **Performance Regression After Deployment** | Lighthouse CI, bundle budget diff, Core Web Vitals (LCP, INP, CLS) regression analysis |
| 21 | **Full-Stack: Angular + Spring Boot End-to-End Request Failure** | Full path trace: Component → Interceptor → Nginx → Security Filter Chain → Controller → JPA → DB |
| 22 | **Full-Stack: Contract Mismatch Discovered in Production** | JSON payload schema validation, Jackson annotations, TypeScript strict interface diffing |
