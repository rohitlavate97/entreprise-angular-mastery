# Production Incident Postmortem Template

Every production incident simulation in the curriculum adheres to this industry-standard RCA & postmortem format.

---

```markdown
# [INCIDENT-ID]: [Production Incident Title]

- **Incident Date & Time:** [ISO 8601 Timestamp]
- **Severity Level:** [P1 - Critical Outage | P2 - Major Degradation | P3 - Minor Issue]
- **Impact Area:** [Authentication | Billing | Data Integrity | Routing | Performance]
- **Detection Method:** [Monitoring Alert | Customer Support Ticket | Synthetic Canary]

---

## 1. Executive Summary & Impact
- High-level non-technical summary of the incident, duration, user impact (e.g., number of impacted sessions or failed transactions).

---

## 2. Timeline of Events (UTC)
- `HH:MM` - Deployment or trigger event
- `HH:MM` - First anomaly detected in telemetry
- `HH:MM` - Incident response team mobilized
- `HH:MM` - Root cause identified
- `HH:MM` - Immediate mitigation deployed
- `HH:MM` - System restored to healthy state

---

## 3. Observable Symptoms & Evidence Artifacts
- **User Complaints:** [Quote customer error reports]
- **Browser Console:** [Client logs and unhandled rejections]
- **Network Tab:** [Headers, payload, timing, status codes]
- **Nginx / Reverse Proxy Logs:** [Access & error logs]
- **Spring Boot Logs:** [Exceptions, correlation IDs, stack traces]
- **Database & Telemetry Metrics:** [Connection pools, APM metrics, latency percentiles]

---

## 4. Root Cause Analysis (5 Whys)
1. *Why did the user get logged out?* -> Interceptor triggered 4 refresh calls simultaneously.
2. *Why did 4 refresh calls trigger?* -> 4 parallel widget requests received 401s when access token expired.
3. *Why did the backend reject the remaining 3?* -> Backend implements single-use refresh token rotation.
4. *Why did Angular not coordinate the refresh?* -> Interceptor lacked a synchronized token lock/queue mechanism.
5. *Why was this not caught in staging?* -> Staging tests ran sequentially with fresh tokens, never testing concurrency.

---

## 5. Immediate Mitigation vs Permanent Resolution
- **Immediate Mitigation (Rollback / Hotfix):** How the system was quickly restored.
- **Permanent Architectural Fix:** Long-term code and configuration fix across Angular and Spring Boot.

---

## 6. Testing & Regression Strategy
- Contract test, concurrency test, or E2E Playwright test proving that the bug cannot re-occur.

---

## 7. Action Items & Preventative Guardrails
| Action Item | Type | Owner | Target Date |
|---|---|---|---|
| Implement synchronized token queue interceptor | Code Fix | Frontend Lead | Done |
| Add distributed trace correlation ID across logs | Observability | DevOps | Next Sprint |
| Introduce automated concurrent token refresh test | Testing | QA / SDET | Next Sprint |
```
