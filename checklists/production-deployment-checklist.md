# Production Deployment Checklist (Angular 19+ & Spring Boot 3.4+)

> **Purpose:** Standard Operating Procedure for zero-downtime production releases, CDN cache management, and instant rollback safety.

---

## 1. 🔍 Pre-Deployment Verification (CI/CD Pipeline)

- [ ] **Lockfile Integrity**: Verified `package-lock.json` is synced with `package.json` using `npm ci` (not `npm install`).
- [ ] **Strict AOT Compilation**: Build passed with `--configuration=production` and `strictTemplates: true`.
- [ ] **Bundle Size Budget**: Verified total initial bundle is below strict thresholds (Warning: `500kB`, Error: `1MB`).
- [ ] **Tree-Shaking Validation**: Verified no unused barrel exports or heavy libraries (e.g. Moment.js, lodash monolithic) bundled into `main.js`.
- [ ] **Database Migration Plan**: Verified Liquibase / Flyway backward-compatible schema changes (Expand/Contract pattern).
- [ ] **OpenAPI / Contract Validation**: TypeScript models match Java DTOs without breaking changes (no removed fields or renamed properties).

---

## 2. 🌐 Reverse Proxy & CDN Configuration (Nginx / Cloudflare)

- [ ] **Hashed Asset Caching**: Hashed JavaScript/CSS chunks configured with `Cache-Control: public, max-age=31536000, immutable`.
- [ ] **Index.html Cache Busting**: `index.html` configured with `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.
- [ ] **SPA Fallback Rule**: Nginx contains `try_files $uri $uri/ /index.html;` to prevent 404s on browser reload.
- [ ] **Correlation ID Forwarding**: Nginx configured with `proxy_set_header X-Request-ID $http_x_request_id;`.
- [ ] **Gzip / Brotli Compression**: Compression enabled for MIME types `application/javascript`, `text/css`, `application/json`.
- [ ] **Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN` (or CSP `frame-ancestors`)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 3. 🚀 Deployment & Switchover (Blue-Green / Rolling)

- [ ] **Deploy Backend First**: New Spring Boot version deployed and confirmed healthy via `/actuator/health` probe.
- [ ] **Keep Old Static Chunks on Server**: Retain previous deployment's hashed `.js` files for at least 48 hours to prevent `ChunkLoadError` for users with cached active tabs.
- [ ] **Deploy Frontend Build**: Update Nginx document root / invalidate CDN edge cache for `index.html` ONLY.
- [ ] **Smoke Test Critical User Journeys**:
  - [ ] User Login & Refresh Token issuance
  - [ ] Data Table pagination and filtering
  - [ ] Form submission with async validation
  - [ ] Financial transfer execution with `X-Idempotency-Key`

---

## 4. 📊 Post-Deployment Monitoring & Telemetry

- [ ] **Error Rate Monitoring (Sentry / Datadog)**: Confirm JavaScript runtime error rate does not exceed baseline (<0.01%).
- [ ] **Core Web Vitals**: LCP (<2.5s), INP (<200ms), CLS (<0.1) confirmed within budget on Real User Monitoring (RUM).
- [ ] **Log Correlation**: Trace a sample frontend request UUID (`X-Request-ID`) across Nginx and Spring Boot logs.
- [ ] **Database Connection Pool**: HikariCP active connections stable; no connection pool starvation.

---

## 5. 🛑 Rollback Triggers & Fast Reversion Plan

| Metric Trigger | Threshold | Immediate Action |
|---|---|---|
| **HTTP 5xx Error Rate** | > 1.0% over 2 minutes | Instant Nginx traffic switch to previous container |
| **JS Uncaught Exceptions** | > 50 errors/min on new release | Revert CDN `index.html` pointer to previous build |
| **API Latency (p99)** | > 2000ms | Rollback backend deployment |
