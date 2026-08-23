# Production Incidents Index (`FS-PROD-001` to `FS-PROD-040`)

This index lists the 40 real-world production incident scenarios covered throughout the course.

---

## 🚨 Incident Directory

| Incident ID | Incident Title | Severity | Root Cause Category |
|---|---|---|---|
| `FS-PROD-001` | Angular production build calls localhost or staging API URL | P1 | Environment Configuration |
| `FS-PROD-002` | CORS works locally, production domain not configured in Spring Security | P1 | CORS / Origin Policy |
| `FS-PROD-003` | Authorization header stripped by Nginx / API Gateway proxy | P1 | Gateway / Reverse Proxy |
| `FS-PROD-004` | Cookie domain mismatch across subdomains (`api.domain.com` vs `app.domain.com`) | P1 | Cookie / SameSite Scope |
| `FS-PROD-005` | `SameSite=Strict` breaks authentication on external redirect login | P2 | Cookie Policy |
| `FS-PROD-006` | Secure cookie dropped because reverse proxy does not forward `X-Forwarded-Proto` | P1 | Proxy Headers / HTTPS |
| `FS-PROD-007` | Mixed content error: HTTPS frontend makes HTTP API call | P1 | Security Policy |
| `FS-PROD-008` | API Gateway returns generic HTML/JSON error shape diverging from Spring Boot contract | P2 | Contract Divergence |
| `FS-PROD-009` | Nginx returns 504 Gateway Timeout HTML page; Angular fails JSON parsing | P2 | Proxy Error Handling |
| `FS-PROD-010` | Load balancer connection timeout shorter than heavy backend reporting query | P2 | Timeout Alignment |
| `FS-PROD-011` | Angular `HttpClient` timeout fires before backend transaction completes | P2 | Client/Server Timeout |
| `FS-PROD-012` | Automatic HTTP retry policy causes duplicate entity creation on slow network | P1 | Idempotency / Retries |
| `FS-PROD-013` | Double-click on checkout button creates duplicate financial transaction | P1 | Concurrency / Double Submit |
| `FS-PROD-014` | Backend commits transaction but network drops response; client assumes failure | P1 | Distributed State |
| `FS-PROD-015` | Optimistic UI update shows success, background sync conflicts and rolls back silently | P2 | UI State Sync |
| `FS-PROD-016` | Lost Update: Two users edit the same entity without optimistic locking (`@Version`) | P2 | Database Concurrency |
| `FS-PROD-017` | Redis cache returns stale JSON entity after database update | P2 | Cache Invalidation |
| `FS-PROD-018` | Frontend displays stale state after server background worker modifies record | P3 | Cache / Real-time Sync |
| `FS-PROD-019` | Breaking DTO schema change deployed to backend breaks active client sessions | P1 | Backward Compatibility |
| `FS-PROD-020` | New frontend version deployed before backend API changes are live | P1 | Deployment Ordering |
| `FS-PROD-021` | Backend deployment introduces breaking change while old clients are cached | P1 | Versioning / Contract |
| `FS-PROD-022` | Cloudflare / CDN caches old `index.html` referencing non-existent old bundles | P1 | CDN Caching Policy |
| `FS-PROD-023` | Lazy-loaded chunk returns 404 after rolling deployment replaces assets | P1 | Deployment Hash / Rollout |
| `FS-PROD-024` | Angular asset hash mismatch during blue-green deployment routing | P2 | Blue-Green Routing |
| `FS-PROD-025` | Multi-node cluster routing traffic to mixed API versions | P1 | Traffic Splitting |
| `FS-PROD-026` | Production server running in UTC vs database configured with local timezone offset | P2 | Timezone Drift |
| `FS-PROD-027` | Legacy production records contain null fields unexpected by TypeScript strict models | P2 | Data Hygiene |
| `FS-PROD-028` | 10,000 item table payload blocks the browser main thread | P2 | DOM / Virtualization |
| `FS-PROD-029` | Slow API response triggers race condition in `switchMap` / search typeahead | P2 | Stream Concurrency |
| `FS-PROD-030` | 4 concurrent 401s trigger 4 token refreshes; single-use refresh token revoked | P1 | Token Refresh Race |
| `FS-PROD-031` | Infinite refresh token loop floods auth server after password reset | P1 | Auth Interceptor Loop |
| `FS-PROD-032` | SSR node server caches user-specific HTML payload in shared server cache | P1 | SSR Security / Caching |
| `FS-PROD-033` | Hydration mismatch error: Server HTML differs from client initial render | P2 | SSR Hydration |
| `FS-PROD-034` | Angular app never reaches stability in SSR due to unclosed `setInterval` in Zone | P1 | SSR Stability / Zone.js |
| `FS-PROD-035` | Production bundle triples in size due to un-tree-shaken icon library import | P3 | Build / Bundle Optimization |
| `FS-PROD-036` | Memory leak: Unclosed RxJS subscription retains detached component in memory | P2 | Memory Management |
| `FS-PROD-037` | Global event listener (`window:resize`) retains entire view tree | P2 | Event Teardown |
| `FS-PROD-038` | Minified error in production (`Error: e.slice is not a function`) with no source maps | P2 | Telemetry & Observability |
| `FS-PROD-039` | High-concurrency race condition reproduces only under heavy production traffic | P1 | Concurrency |
| `FS-PROD-040` | Spring Cloud Circuit Breaker opens (503), Angular renders blank page without fallback | P2 | Fault Tolerance |
