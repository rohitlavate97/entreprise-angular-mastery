# Full-Stack Issues Lab Index (Angular + Spring Boot)

This index tracks end-to-end integration issues spanning Angular frontend and Spring Boot backend.

---

## 🚀 Category Breakdown

### A. Startup & Environment (`FS-LOCAL-001` to `FS-LOCAL-006`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `FS-LOCAL-001` | Angular starts, Spring Boot not running | Local | Medium | `net::ERR_CONNECTION_REFUSED` in console |
| `FS-LOCAL-002` | Wrong API base URL in environment configuration | Local | High | 404 Not Found on all API calls |
| `FS-LOCAL-003` | Angular dev proxy configuration `proxy.conf.json` incorrect | Local | Medium | Requests hit dev server port instead of backend |
| `FS-LOCAL-004` | Angular calls zombie backend instance on old port | Local | Medium | Outdated schema errors / stale logic |
| `FS-LOCAL-005` | Port conflict — two Spring Boot instances or background process | Local | Medium | `Port 8080 already in use` |
| `FS-LOCAL-006` | Environment file replacement not configured in `angular.json` | Local/CI | High | Prod builds pointing to `localhost:8080` |

---

### B. HTTP Communication & Protocol (`FS-LOCAL-010` to `FS-LOCAL-017`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `FS-LOCAL-010` | Request created in Angular, never reaches Spring controller | Local | High | Silent failure / missing interceptor `next.handle` |
| `FS-LOCAL-011` | Spring called but Angular receives unexpected error | Local | Medium | HTTP 500 converted to generic UI crash |
| `FS-LOCAL-012` | Angular sends wrong `Content-Type` header (e.g., text/plain) | Local | High | HTTP 415 Unsupported Media Type |
| `FS-LOCAL-013` | Spring validation rejects request — Angular displays generic error | Local | Medium | Form fields not highlighted with validation errors |
| `FS-LOCAL-014` | Backend returns Whitelabel HTML error page instead of JSON | Local | High | `SyntaxError: Unexpected token '<' in JSON` |
| `FS-LOCAL-015` | Multipart file upload fails due to manual Content-Type header | Local | High | Boundary missing in multipart form data |
| `FS-LOCAL-016` | Large response payload triggers frontend client timeout | Local/Prod | Medium | `TimeoutError` in RxJS stream |
| `FS-LOCAL-017` | Response type mismatch (single object expected, array returned) | Local | High | `TypeError: Cannot read properties of undefined` |

---

### C. Data Contracts & Serialization (`FS-LOCAL-020` to `FS-LOCAL-027`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `FS-LOCAL-020` | Java `Long` > `Number.MAX_SAFE_INTEGER` loses precision in JS | Local/Prod | Critical | Truncated IDs cause 404s or entity corruption |
| `FS-LOCAL-021` | `BigDecimal` serialized as string vs number in Angular | Local/Prod | High | String concatenation instead of numerical addition |
| `FS-LOCAL-022` | `LocalDate` format mismatch (ISO 8601 vs Array `[yyyy,mm,dd]`) | Local | High | NaN in UI date pickers |
| `FS-LOCAL-023` | `LocalDateTime` timezone offset confusion (server vs browser) | Local/Prod | High | Events displayed shifted by +/- timezone offset |
| `FS-LOCAL-024` | UTC vs local time mismatch causes calendar off-by-one day | Local/Prod | Medium | Date picked shifts to previous day |
| `FS-LOCAL-025` | Java Enum (`UPPERCASE`) vs TypeScript Enum (`camelCase`) mismatch | Local | High | Enum value comparisons fail |
| `FS-LOCAL-026` | `null` vs `undefined` causes Angular form reset / binding failure | Local | Medium | Form controls fail to bind initial state |
| `FS-LOCAL-027` | Backend removes field, Angular model silently reads `undefined` | Local/Prod | High | Template rendering breaks silently |

---

### D. Security, CORS & Authentication (`FS-LOCAL-030` to `FS-LOCAL-038`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `FS-LOCAL-030` | 401 Unauthorized — Bearer Authorization header omitted | Local | High | API rejects request despite successful login |
| `FS-LOCAL-031` | 403 Forbidden — Insufficient role, Angular shows blank screen | Local | Medium | User not redirected to Access Denied page |
| `FS-LOCAL-032` | Angular route guard allows route, backend denies API execution | Local/Prod | High | UI loads but data table displays 403 error |
| `FS-LOCAL-033` | Spring Security filter chain blocks CORS preflight `OPTIONS` | Local/Prod | Critical | CORS error in browser despite `@CrossOrigin` |
| `FS-LOCAL-034` | CSRF token missing on mutating POST/PUT requests with cookies | Local/Prod | High | 403 Forbidden on form submissions |
| `FS-LOCAL-035` | HttpOnly cookie not sent (`SameSite` / `Secure` mismatch on HTTP) | Local | High | Session lost on every page reload |
| `FS-LOCAL-036` | Refresh token interceptor creates infinite retry loop on 401 | Local/Prod | Critical | Thousands of requests flood backend until rate-limited |
| `FS-LOCAL-037` | Logout does not clear Angular signals/localStorage auth state | Local/Prod | High | Stale user identity persists in UI |
| `FS-LOCAL-038` | Logout clears Angular state but leaves Spring session/token valid | Local/Prod | High | Reused token remains valid on backend |
