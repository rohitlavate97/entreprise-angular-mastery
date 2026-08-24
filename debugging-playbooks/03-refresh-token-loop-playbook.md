# Playbook 03: Refresh Token Infinite Loop & Race Conditions

> **Severity:** P1 (Production Outage) | **Domain:** Angular HTTP Interceptors & Spring Security

---

## 1. 🔍 Symptoms
- Infinite loop of HTTP 401 and `/auth/refresh` requests in Chrome Network tab (100+ requests/second freezing the browser).
- Users randomly logged out when navigating to a dashboard with multiple widgets.
- Backend database deadlocks or high CPU load on refresh token table.

---

## 2. 📋 Root Causes & Diagnostic Flowchart

```text
[HTTP 401 Received by authInterceptor]
               │
               ▼
   Is URL == '/auth/refresh'?
        ├── YES ──> [FATAL LOOP] Interceptor is retrying the refresh endpoint itself!
        │                        FIX: Exclude /auth/refresh from 401 retry interceptor.
        │
        └── NO ───> Is refresh already in progress (isRefreshing == true)?
                      ├── YES ──> Queue in BehaviorSubject! Do NOT fire second /refresh.
                      └── NO ───> Set isRefreshing=true -> Call /auth/refresh -> Flush Queue.
```

---

## 3. 🛠️ The 3 Cardinal Rules for Auth Interceptors

1. **Rule 1: Never intercept the refresh endpoint itself.**
   If `/api/v1/auth/refresh` returns 401 (e.g. refresh token expired), your interceptor MUST NOT catch it and call `/auth/refresh` again! It must trigger immediate logout.

2. **Rule 2: Implement a Token Refresh Queue.**
   When multiple requests fail with 401 simultaneously:
   - Request 1 triggers the refresh call.
   - Requests 2..N wait on a `BehaviorSubject`.
   - Once refreshed, all waiting requests are retried with the new token.

3. **Rule 3: Rotate Refresh Tokens Atomically.**
   In Spring Boot, invalidate the old refresh token and return a new one inside a `@Transactional` block.
