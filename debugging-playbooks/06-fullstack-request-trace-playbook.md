# Playbook 06: Full-Stack Request Tracing & Correlation ID Forensics

> **Severity:** Standard SOP | **Domain:** Angular -> Nginx -> Spring Boot -> PostgreSQL End-to-End Tracing

---

## 1. 🔍 Purpose
How to isolate a bug in 60 seconds by following a single `X-Request-ID` from a user's click in the browser all the way to a database SQL query in Spring Boot.

---

## 2. 📋 The 4-Stage Correlation Flowchart

```text
1. [Angular Browser Client] 
   └── correlationIdInterceptor generates UUID -> Headers['X-Request-ID'] = "f47ac10b-58cc..."
         │
         ▼
2. [Nginx Reverse Proxy]
   └── proxy_set_header X-Request-ID $http_x_request_id; (Preserves trace header)
         │
         ▼
3. [Spring Boot Backend Filter]
   └── CorrelationIdFilter extracts header -> MDC.put("traceId", "f47ac10b-58cc...")
   └── All SLF4J log lines include: [traceId=f47ac10b-58cc...]
         │
         ▼
4. [Global Exception Handler / Database Query]
   └── ApiErrorResponse envelope returns traceId to Angular
   └── Support engineer searches Kibana/CloudWatch: "traceId: f47ac10b-58cc..."
```

---

## 3. 🛠️ Step-by-Step Diagnostic Protocol

1. **Step 1: Open Chrome DevTools Network Tab**
   - Click the failing request.
   - Look under **Request Headers** for `X-Request-ID: <UUID>`.
   - Copy the UUID.

2. **Step 2: Search Backend Logs**
   ```bash
   grep "f47ac10b-58cc" /var/log/enterprise-backend/*.log
   ```

3. **Step 3: Pinpoint the Failure Layer**
   - If log line found with `[traceId=...]` -> Inspect exact Java exception stack trace.
   - If NO log lines found -> Nginx dropped the request or URL path did not match proxy location.
   - If 403 Forbidden -> Spring Security blocked request before controller reached (inspect SecurityFilter logs).
