# Module 30: System Design — Full-Stack Architecture at Enterprise Scale

---

## 1. WHAT
System Design is the holistic process of architecting a scalable, resilient, and maintainable software system. For a full-stack Angular + Spring Boot engineer, it involves selecting the correct topologies (CDN, BFF, Microservices), communication protocols (HTTP, WebSocket, SSE), data access patterns, and organizational boundaries to support high concurrency, large development teams, and rigorous SLAs.

## 2. WHY
- **Complexity Management**: Applications spanning dozens of microservices and frontend domains collapse under their own weight without a deliberate architectural strategy (BFFs, Monorepos).
- **Scale Requirements**: Building a system for 500 concurrent users requires different caching and DB strategies than building for 50,000 concurrent users.
- **Interview Readiness**: Principal and Staff engineers are evaluated heavily on their ability to design full-stack systems, negotiate trade-offs, and identify bottlenecks before they reach production.
- **Organizational Scaling**: Technical architecture dictates team autonomy (Conway's Law). Properly sliced Micro-frontends or Nx Workspaces allow independent deployments without blocking other teams.

## 3. INTERNAL MENTAL MODEL
### Full-Stack Distributed Architecture

```text
+===========================================================================================+
|                     ENTERPRISE BANKING SYSTEM ARCHITECTURE                                |
|                                                                                           |
|  [ BROWSER CLIENTS ]                                                                      |
|  (Angular SPA, Mobile Web)                                                                |
|            │                                                                              |
|            ▼  (HTTPS / WebSocket)                                                         |
|  [ GLOBAL CDN (Cloudflare/Akamai) ]                                                       |
|  - Caches static assets (JS, CSS, HTML, Images)                                           |
|  - DDoS Protection & WAF (Web Application Firewall)                                       |
|            │                                                                              |
|            ▼  (Dynamic API Traffic)                                                       |
|  [ API GATEWAY / LOAD BALANCER ]                                                          |
|  - SSL Termination, Rate Limiting, Route Resolution                                       |
|            │                                                                              |
|            ▼                                                                              |
|  [ BACKEND-FOR-FRONTEND (BFF) ]                                                           |
|  - Aggregates APIs, trims payloads, manages session cookies                               |
|            │                        │                        │                            |
|            ▼ (gRPC / HTTP)          ▼                        ▼                            |
|  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐                  |
|  │ ACCOUNTS SERVICE  │    │ PAYMENTS SERVICE  │    │ REAL-TIME ALERTS  │                  |
|  │ (Spring Boot)     │    │ (Spring Boot)     │    │ (WebSocket/SSE)   │                  |
|  └────────┬──────────┘    └────────┬──────────┘    └────────┬──────────┘                  |
|           │                        │                        │                             |
|           ▼                        ▼                        ▼                             |
|       [ Redis ]                [ Kafka / RabbitMQ ]     [ Redis Pub/Sub ]                 |
|       (Cache)                  (Event Queue)            (Event Fan-out)                   |
|           │                        │                                                      |
|           ▼                        ▼                                                      |
|   [ PostgreSQL DB ]        [ PostgreSQL DB ]                                              |
+===========================================================================================+
```

## 4. HOW IT WORKS
1. **Static Delivery**: Angular is compiled into static assets and pushed to a global CDN edge. The CDN serves the UI with near-zero latency worldwide.
2. **Dynamic Data**: The browser requests dynamic data through an API Gateway, which handles security and routes traffic to a BFF (Backend-for-Frontend).
3. **BFF Pattern**: Instead of the Angular client making 5 parallel requests to different microservices, it makes 1 request to the BFF. The BFF (often Spring Cloud Gateway or Node.js) orchestrates the downstream calls, aggregating and mapping data to exactly match the Angular UI models.
4. **Caching Strategy**: 
   - Browser: HTTP cache for static files.
   - CDN: Edge cache for static files.
   - BFF/Gateway: Redis cache for slowly changing reference data.
   - DB: Query cache or materialized views.
5. **Real-time Push**: The backend pushes events (e.g., stock price ticks, transfer statuses) through a Kafka queue, picked up by a WebSockets/SSE service, which pushes down to the Angular client.

## 5. MODERN IMPLEMENTATION
### BFF Pattern (Spring Cloud Gateway)
Instead of Angular storing JWTs in `localStorage` (vulnerable to XSS), a BFF pattern is used with the **Token Handler Pattern**.

```yaml
# Spring Cloud Gateway BFF Configuration
spring:
  cloud:
    gateway:
      routes:
        - id: accounts-service
          uri: lb://accounts-service
          predicates:
            - Path=/api/accounts/**
          filters:
            - TokenRelay= # Automatically attaches the OAuth2 JWT to downstream requests
            - RateLimiter=10,20 # 10 requests per second, 20 burst capacity
            - CircuitBreaker=accountsCB
```
The Angular app never sees the JWT token; it only receives a Secure, HttpOnly Session Cookie from the BFF.

## 6. LEGACY / ENTERPRISE REALITY
| Legacy Pattern | Modern Pattern | Trade-offs & Migration |
|---|---|---|
| Monolithic Backend (All controllers in one Spring Boot app) | Microservices + BFF | Microservices add network latency, distributed transaction complexity (Sagas). Use BFF to shield frontend from this complexity. |
| JWTs in `localStorage` | HttpOnly Cookies via BFF | `localStorage` is easily read by XSS scripts. Migrating requires setting up a reverse proxy/BFF to handle token exchange. |
| REST Polling (e.g., `setInterval`) | WebSockets or Server-Sent Events (SSE) | Polling destroys backend DBs. SSE is unidirectional and easier to scale than bi-directional WebSockets. |
| Single massive Git repo without boundaries | Nx Monorepo or Micro-frontends | Moving to Micro-frontends (Module Federation) introduces huge deployment complexity. Prefer Nx Monorepo until deployment pipelines become the bottleneck. |

## 7. PRACTICAL EXAMPLE
**System Design: Real-Time Trading Dashboard**

*Requirements*: Show live portfolio value. Users can execute trades. 100,000 active users.

*Design*:
1. **Frontend**: Angular standalone components. Uses `rxResource` for initial state, and a WebSocket connection for live price ticks.
2. **WebSocket Fleet**: A dedicated fleet of lightweight Spring Boot instances (or Node/Go) handle WebSocket connections. 100k users = ~10 servers (10k connections each).
3. **Data Stream**: A central pricing engine publishes price ticks to Kafka. The WebSocket servers subscribe to Kafka and fan-out the ticks to connected browsers.
4. **Trade Execution**: User clicks "Buy". Angular sends a standard POST HTTP request to the API Gateway. Standard HTTP is preferred over WebSockets for mutations due to built-in retries, status codes, and easier load balancing.
5. **UI Updates**: The HTTP POST returns 202 Accepted. The backend processes the trade and pushes a "Trade Completed" event down the WebSocket to update the Angular UI.

## 8. COMMON MISTAKES
1. **Premature Micro-frontends**: Splitting an Angular app into Module Federation micro-frontends when the team is only 5 people. This causes massive overhead in version management, shared dependency loading, and testing.
2. **Overusing WebSockets**: Using WebSockets for everything. WebSockets bypass HTTP caching, make load balancing difficult (sticky sessions required), and complicate error handling. Use HTTP for mutations/queries, WebSockets/SSE for server-to-client push.
3. **BFF Bloat**: Putting heavy business logic in the BFF. The BFF should ONLY route, aggregate, trim payloads, and manage sessions. Business logic belongs in domain microservices.
4. **Ignoring Cursors for Pagination**: Using `OFFSET` pagination on a table with 10 million rows. As users go to page 10,000, the database scans and discards massive amounts of data. Use cursor-based pagination (e.g., `last_id`) for infinite scroll.
5. **Missing Rate Limits**: Exposing a public API without rate limiting, allowing a malicious script (or a buggy Angular `effect()`) to take down the database.

## 9. LOCAL ISSUES
- **Symptom**: WebSocket drops connections repeatedly during local development.
- **Root Cause**: The local Webpack Dev Server or Angular CLI proxy is not configured to upgrade WebSocket connections.
- **Fix**: Update `proxy.conf.json` to include `"ws": true`.
  ```json
  {
    "/ws": {
      "target": "http://localhost:8080",
      "ws": true
    }
  }
  ```

## 10. CI/CD ISSUES
- **Symptom**: Nx Monorepo CI pipeline takes 45 minutes to run.
- **Root Cause**: The system architecture placed all apps in a monorepo, but CI is running tests and builds for the *entire* workspace on every commit.
- **Fix**: Use Nx Affected commands in CI: `npx nx affected --target=build`. This analyzes the Git diff and only builds the Angular apps and Spring Boot libraries that actually changed.

## 11. PRODUCTION ISSUES
- **Symptom**: Sporadic HTTP 504 Gateway Timeout on peak traffic days.
- **Root Cause**: Angular fires an expensive API call on a dashboard. The Spring Boot backend opens a DB connection, but the DB is under heavy load. The backend connection pool exhausts, requests queue up, and the API Gateway eventually times out.
- **Fix**: Implement the **Circuit Breaker** pattern (e.g., Resilience4j) in the API Gateway. If the backend fails 50% of the time over 10 seconds, the circuit opens, immediately returning an HTTP 503 (or a cached fallback) to Angular without waiting, protecting the DB from further strain.

## 12. FULL-STACK INTERACTION
**The CAP Theorem & Frontend UX**
When a network partition occurs (P), backend databases must choose between Consistency (C) and Availability (A).
- If the backend chooses **Consistency**, it will reject writes during the partition. The Angular frontend must be designed to gracefully handle HTTP 503s with user-friendly messages ("System currently unavailable for trading").
- If the backend chooses **Availability**, it will accept writes but risk conflict. The Angular frontend might need to implement **Optimistic UI Updates** (showing the change immediately, then reverting if a conflict is detected later).

## 13. DEBUGGING PROCESS
**Scenario: Investigating a Caching Failure**
Users report they updated their profile, but the dashboard still shows the old profile picture.
1. **Network Tab**: Is Angular caching it? Check if the browser sent `If-None-Match` (ETag) or if it loaded from disk cache.
2. **CDN Layer**: Bypass the CDN cache (e.g., add a cache-buster `?t=123`). If it shows the new picture, the CDN edge cache was not invalidated.
3. **API Gateway / Backend Cache**: If bypassing the CDN still shows old data, check if the Spring Boot service relies on a stale Redis cache entry.
4. **Resolution**: Fix the cache invalidation strategy. When the `PUT /profile` endpoint succeeds, Spring Boot must explicitly evict the Redis cache for that user.

## 14. ROOT CAUSE ANALYSIS
**Why do Module Federation setups crash with "shared module not available"?**
In Webpack Module Federation, Host apps and Remote apps share dependencies (like `@angular/core`). If the Host requires Angular 18.0.0 and the Remote requires Angular 18.2.0, and they are configured as `strictVersion: true`, Webpack will refuse to load the Remote app to prevent runtime crashes. Managing shared dependency versions is the single hardest part of Micro-frontend architectures.

## 15. FIX
**Implementing SSE (Server-Sent Events) in Angular**
SSE is lighter than WebSockets, natively uses HTTP, traverses firewalls easily, and automatically reconnects.

```typescript
import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationStream {
  private zone = inject(NgZone);

  getStream(): Observable<string> {
    return new Observable(observer => {
      const eventSource = new EventSource('/api/notifications/stream');
      
      eventSource.onmessage = event => {
        // EventSource runs outside Angular Zone by default in some polyfills, 
        // ensure we re-enter to trigger Change Detection
        this.zone.run(() => observer.next(event.data));
      };

      eventSource.onerror = error => {
        this.zone.run(() => observer.error(error));
      };

      return () => eventSource.close();
    });
  }
}
```

## 16. PREVENTION
- **Capacity Planning Formula**: 
  (Total Daily Active Users * Average Requests per User) / 86400 = Average Requests Per Second (RPS).
  Peak RPS is usually 2x to 5x the average. Design the API Gateway and DB connection pools for Peak RPS.
- **Architectural Decision Records (ADRs)**: Always document *why* a major architectural choice was made (e.g., "Why we chose SSE over WebSockets for price tickers").

## 17. MONITORING / OBSERVABILITY
- **Gateway Metrics**: The API Gateway is the ultimate choke point. Monitor HTTP 4xx (client errors) and 5xx (server errors) rates here.
- **Cache Hit Ratio**: A CDN or Redis cache hit ratio below 80% means your caching strategy is ineffective, and your database is absorbing too much traffic.

## 18. PERFORMANCE CONSIDERATIONS
- **Edge-Side Rendering (ESR)**: For ultimate performance, CDNs (like Cloudflare Workers) can intercept the request, fetch user-specific data from an Edge Key-Value store, inject it directly into the Angular `index.html` as a global variable, and serve it. Angular boots, reads the variable, and skips the initial HTTP fetch entirely.
- **Compression**: Ensure the API Gateway compresses JSON payloads using Brotli or Gzip. A 2MB JSON array can compress down to 200KB.

## 19. SECURITY CONSIDERATIONS
- **DDoS Mitigation**: CDNs absorb volumetric network DDoS attacks. However, Application-Layer DDoS (e.g., aggressively calling an expensive database search API) will bypass the CDN. The API Gateway must implement strict rate limiting per IP or JWT to protect the DB.
- **CORS (Cross-Origin Resource Sharing)**: The API Gateway should enforce strict CORS policies. If the frontend is hosted on `app.bank.com`, the API Gateway must only accept preflight `OPTIONS` requests originating from that exact domain.

## 20. TESTING STRATEGY
- **Load Testing**: Use tools like k6 or Gatling to simulate 10,000 concurrent users logging in simultaneously to ensure the authentication service and DB do not buckle.
- **Chaos Engineering**: Randomly kill a Spring Boot microservice node in a staging environment to ensure the API Gateway successfully routes around the failure, the Circuit Breaker opens, and the Angular UI shows a graceful degradation message instead of a blank white screen.

## 21. EXERCISES
1. Draw an architecture diagram for an e-commerce platform that includes a CDN, BFF, Order Service, Inventory Service, and Payment Gateway.
2. Calculate the estimated RPS and DB storage required per month for an application with 50,000 daily active users, assuming 50 requests/user/day and 5KB generated data/user/day.
3. Write a Spring Cloud Gateway route configuration that applies a rate limit of 5 requests per second to the `/api/login` endpoint.

## 22. BREAK-AND-FIX LAB
**Issue**: `ANG-SYSDESIGN-001` - CDN Cache Causes Version Mismatch.
**Scenario**: You deployed v2.0 of the Angular app. Users report getting a blank screen.
**Break**: The `index.html` was cached by the CDN for 24 hours. However, the JS bundles (`main.a1b2.js`) were purged from the origin server. The cached `index.html` tries to load JS files that no longer exist, resulting in HTTP 404s.
**Diagnostic Steps**: Inspect network tab. `index.html` returns 200 (from disk cache). `main.js` returns 404.
**Fix**: Configure the CDN to NEVER cache `index.html` (`Cache-Control: no-cache`). The `index.html` is tiny and loading it from the origin ensures the client always gets the latest pointers to the JS bundles. Cache the hashed JS files indefinitely (`Cache-Control: max-age=31536000, immutable`).

## 23. EXPERT QUESTIONS
1. **Q**: You are designing a system where users upload large video files (500MB+). How do you architect the flow between Angular and Spring Boot to avoid exhausting backend memory and network bandwidth?
   - **A**: Do not send the file through the API Gateway and Spring Boot. Use the **Pre-signed URL** pattern. Angular requests an upload token from Spring Boot. Spring Boot generates a temporary, cryptographically signed AWS S3 pre-signed URL. Angular uploads the file directly to S3 via PUT. S3 then triggers a webhook/event to notify Spring Boot that the upload is complete.
2. **Q**: Your Angular application pulls data from three slow legacy systems, resulting in a 6-second page load. How do you re-architect this using the BFF pattern?
   - **A**: Move the integration logic to a BFF. The BFF makes the three slow backend calls in parallel using async/await or Project Reactor. Alternatively, the BFF can implement a caching layer (Redis) for the legacy data, or immediately return a partial response (using Server-Sent Events or GraphQL `@defer`) to render the shell instantly while the slow data trickles in.
3. **Q**: In a Micro-frontend architecture using Webpack Module Federation, how do you handle routing and shared global state (like user authentication) between the Host shell and the Remote applications?
   - **A**: The Host shell is responsible for authentication and initializing the Router. It manages a lightweight global state (e.g., using a shared RxJS Subject or CustomEvent bus exposed via a shared library). The Remote apps mount themselves based on wildcard routes delegated by the Host, and they subscribe to the shared auth state to obtain tokens. Remote apps should otherwise maintain their own isolated state to prevent tight coupling.
