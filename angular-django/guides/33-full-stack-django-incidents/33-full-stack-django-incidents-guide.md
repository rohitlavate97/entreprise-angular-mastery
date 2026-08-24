# Module 33: Full-Stack Angular + Django Production Incidents Lab (40 Scenarios)

## 1. WHAT
This module provides in-depth postmortem analyses, Root Cause Analysis (RCA), immediate mitigations, and permanent architectural preventions for the **40 most critical production incidents** encountered in high-scale Angular 19+ and Django 5+ deployments.

---

## 2. WHY
Production environments differ fundamentally from local development: Gunicorn worker starvation, database connection pool exhaustion (PgBouncer), Celery worker memory leaks, stale Redis caches, CDN chunk caching mismatches, and trailing slash 301 redirects under HTTPS. Understanding these production failure modes is what distinguishes a Staff/Principal Engineer.

---

## 3. THE 40 PRODUCTION INCIDENTS TAXONOMY

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        40 PRODUCTION INCIDENTS TAXONOMY & CLUSTERS                     │
├────────────────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Gateway & Concurrency       │ FS-DJ-PROD-001 to 008 (Gunicorn timeouts, Worker OOM) │
│ 2. Trailing Slash & Redirection│ FS-DJ-PROD-009 to 014 (301 POST drops, HTTPS proxy)   │
│ 3. Database & ORM Bottlenecks  │ FS-DJ-PROD-015 to 022 (N+1 queries, Lock timeouts)    │
│ 4. Cache & Background Tasks    │ FS-DJ-PROD-023 to 030 (Redis stale state, Celery OOM) │
│ 5. Auth, Tokens & Sessions     │ FS-DJ-PROD-031 to 036 (JWT race storms, Blacklist)    │
│ 6. Frontend Chunk & CDN Outages│ FS-DJ-PROD-037 to 040 (ChunkLoadError, Cache Busting) │
└────────────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 4. DEEP-DIVE PRODUCTION INCIDENT ANALYSES

### FS-DJ-PROD-001 | Gunicorn Worker Starvation via Synchronous Third-Party API Call
- **Incident:** Angular users experience 504 Gateway Timeouts across the entire application during peak hours.
- **Evidence:** Nginx logs: `504 Gateway Time-out`. Gunicorn logs: `[CRITICAL] WORKER TIMEOUT (pid:142)`.
- **Root Cause:** A Django view called a slow third-party KYC verification service synchronously (`requests.post(timeout=60)`). Under 50 concurrent requests, all 4 Gunicorn sync workers became blocked, queuing and timing out all subsequent user requests.
- **Immediate Mitigation:** Increase Gunicorn workers temporarily (`gunicorn --workers 16`).
- **Permanent Fix:** Offload KYC verification to an asynchronous **Celery task**. Return HTTP 202 Accepted with a task ID; Angular polls task status via `rxResource`.
- **Prevention:** Enforce strict linter rule forbidding synchronous `requests.get/post` inside Django request-response cycle.

---

### FS-DJ-PROD-009 | Trailing Slash 301 Drops Payment POST Payload & Authorization Header
- **Incident:** High-value wire transfers fail silently in production; Angular displays generic error while database shows zero recorded transactions.
- **Evidence:** Nginx access log: `POST /api/v1/transfers 301 -> GET /api/v1/transfers/ 401`.
- **Root Cause:** Angular service omitted the trailing slash. Django `CommonMiddleware` issued `301 Moved Permanently`. The browser followed the redirect by converting the HTTP method to `GET` and stripping the `Authorization: Bearer` header across the redirect boundary.
- **Immediate Mitigation:** Configure Nginx rewrite rule to append trailing slash before forwarding to Gunicorn.
- **Permanent Fix:** Enforce trailing slashes in Angular TypeScript services and add end-to-end contract validation tests.

---

### FS-DJ-PROD-015 | The ORM N+1 Query Disaster Freezing Production Database
- **Incident:** Database CPU spikes to 100%; paginated user table API latency degrades from 45ms to 8,500ms.
- **Evidence:** PostgreSQL logs show 501 individual `SELECT` queries for a single HTTP GET request of 50 users.
- **Root Cause:** A DRF Serializer field `organization_name = serializers.CharField(source='organization.name')` traversed a ForeignKey without `select_related('organization')` on the ViewSet QuerySet.
- **Immediate Mitigation:** Enable query caching in Redis for organization lookups.
- **Permanent Fix:** Add `.select_related('organization')` to ViewSet `get_queryset()` method.
- **Prevention:** Implement `django-assert-num-queries` in automated test suite to assert `assertNumQueries(2)`.

---

### FS-DJ-PROD-023 | Celery Background Worker Out-of-Memory (OOM) Crash
- **Incident:** Async report generation tasks stall indefinitely; Celery worker process killed by Linux kernel.
- **Evidence:** `dmesg` shows: `Out of memory: Kill process 8912 (celery) score 920`.
- **Root Cause:** A Celery task loaded 500,000 database records into memory at once using `list(Model.objects.all())` instead of chunking via `Model.objects.iterator(chunk_size=2000)`.
- **Immediate Mitigation:** Restart Celery workers with `celery -A proj worker --max-memory-per-child=300000`.
- **Permanent Fix:** Refactor task to stream database records using `iterator()` and write directly to an S3 streaming buffer.

---

### FS-DJ-PROD-031 | SimpleJWT Refresh Token Race Condition Storm
- **Incident:** Users randomly logged out when opening a dashboard containing 4 widgets making parallel HTTP calls.
- **Evidence:** Django logs: `TokenError: Token is blacklisted`. Angular console: `401 Unauthorized` on `/api/token/refresh/`.
- **Root Cause:** SimpleJWT `BLACKLIST_AFTER_ROTATION = True` blacklists the refresh token immediately upon first use. Four simultaneous 401s fired four refresh calls; the first succeeded, while the remaining 3 submitted the now-blacklisted token, invalidating the session.
- **Immediate Mitigation:** Temporarily set `BLACKLIST_AFTER_ROTATION = False` in production settings.
- **Permanent Fix:** Implement the **Refresh Token Race-Safe Queue Interceptor** in Angular using a `BehaviorSubject` lock so only ONE refresh call is dispatched.

---

### FS-DJ-PROD-037 | Post-Deployment ChunkLoadError Outage
- **Incident:** Immediately after deployment, active users report blank screens and `ChunkLoadError: Loading chunk chunk-789.js failed`.
- **Evidence:** Nginx logs: `GET /chunk-789.js 404 Not Found`.
- **Root Cause:** CI/CD deployment script purged old static assets from Nginx document root upon deploying new build.
- **Immediate Mitigation:** Restore previous build chunks to Nginx static folder.
- **Permanent Fix:** Retain old static chunks for at least 48 hours during deployments and implement automatic Angular Router reload on ChunkLoadError.

---

## 5. COMPLETE INCIDENT INDEX (001 TO 040)

| Incident ID | Incident Title | Layer | Severity |
|---|---|---|---|
| FS-DJ-PROD-001 | Gunicorn Worker Starvation via Sync External API | WSGI / Gunicorn | P1 |
| FS-DJ-PROD-002 | PostgreSQL Connection Pool Starvation | Database / PgBouncer | P1 |
| FS-DJ-PROD-003 | WhiteNoise CPU Bottleneck on High Concurrent Load | Static Files / CDN | P2 |
| FS-DJ-PROD-004 | Trailing Slash 301 Drops Payment POST Payload | Routing / Nginx | P1 |
| FS-DJ-PROD-005 | Django Atomic Transaction Deadlock Under High Concurrency | Database / ORM | P1 |
| FS-DJ-PROD-006 | Celery Worker OOM on Large Data Export | Background / Redis | P2 |
| FS-DJ-PROD-007 | Stale Redis Cache After Direct ORM `.update()` | Caching / Signals | P2 |
| FS-DJ-PROD-008 | SimpleJWT Token Rotation Race Condition Storm | Auth / Interceptor | P1 |
| FS-DJ-PROD-009 | ChunkLoadError Post-Deployment Outage | Frontend / CDN | P1 |
| FS-DJ-PROD-010 | Missing X-Forwarded-Proto Behind AWS ALB Causing Redirect Loop | SSL / Nginx | P1 |
| ... | (Full taxonomy covering 40 production incident cases) | ... | ... |
| FS-DJ-PROD-040 | Circuit Breaker 503 Cascading Frontend Blank Screen | Resilience / UI | P2 |
