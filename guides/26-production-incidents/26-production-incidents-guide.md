# Module 26: Production Incidents — Triage, Postmortems, and Incident Response

## 1. WHAT
Production Incident Management is the systematic methodology of detecting, assessing, mitigating, analyzing, and preventing failures in live environments. It encompasses the human and technical workflows required to restore service rapidly (Mitigation) and ensure the same failure never occurs again (Root Cause Analysis & Prevention).

## 2. WHY
In enterprise systems, failure is inevitable. Networks partition, databases lock, tokens expire, and edge cases manifest only under production load. Without a structured incident response framework, teams panic, miscommunicate, apply destructive "band-aid" fixes, and fail to learn from outages. A blameless postmortem culture transforms outages from engineering failures into systemic resilience improvements.

## 3. INTERNAL MENTAL MODEL

```text
+=============================================================================+
|                      INCIDENT RESPONSE LIFECYCLE                            |
+=============================================================================+
|                                                                             |
|  [1. DETECTION]                                                             |
|   - Datadog Alert (e.g., P99 Latency > 2s)                                  |
|   - Sentry Error Spike (e.g., Uncaught TypeError)                           |
|   - Customer Support Ticket (e.g., "Cannot transfer funds")                 |
|          |                                                                  |
|          v                                                                  |
|  [2. TRIAGE & ASSESSMENT] (Declare Severity)                                |
|   - P1 (Critical): App down, core flow broken, data loss.                   |
|   - P2 (Major): Partial degradation, feature broken but workaround exists.  |
|   - P3 (Minor): UI glitch, isolated issue.                                  |
|          |                                                                  |
|          v                                                                  |
|  [3. MITIGATION] (Stop the bleeding)                                        |
|   - Rollback deployment (Revert Nginx to previous version)                  |
|   - Toggle feature flag off                                                 |
|   - Scale infrastructure up                                                 |
|   *DO NOT FORWARD-FIX P1 ISSUES UNLESS ROLLBACK IS IMPOSSIBLE*              |
|          |                                                                  |
|          v                                                                  |
|  [4. ROOT CAUSE ANALYSIS (RCA)]                                             |
|   - 5 Whys                                                                  |
|   - Trace distributed logs (Spring Sleuth/Micrometer)                       |
|   - Replicate locally or in Staging                                         |
|          |                                                                  |
|          v                                                                  |
|  [5. POSTMORTEM & PREVENTION]                                               |
|   - Blameless document writing                                              |
|   - Action items (Unit tests, architectural changes)                        |
|                                                                             |
+=============================================================================+
```

## 4. HOW IT WORKS
1. **Incident Commander (IC) Designation**: A single individual takes charge of the "War Room." The IC does not debug code; they coordinate communication, assign investigators, and manage stakeholders.
2. **Investigation**: Engineers query logs, inspect APM traces, and review recent PRs.
3. **Mitigation Decision**: The IC decides whether to Rollback (fast, safe) or Forward-Fix (slow, risky).
4. **Resolution**: The system stabilizes. The incident is downgraded.
5. **Postmortem**: Within 48 hours, a blameless document is drafted detailing the timeline, the 5 Whys, and actionable prevention tasks.

### The War Room Communication Protocol
During a P1 incident, the war room (Slack channel / Zoom call) must remain strictly disciplined:
- **No Side-Channel Debugging**: All theories and findings must be posted in the main channel.
- **Explicit Handoffs**: "I am looking into the Nginx logs now" → "I have found X, handing off log analysis to Y."
- **Timeboxing**: "I will spend exactly 10 minutes trying to reproduce locally. If I can't, we rollback."
- **Stakeholder Updates**: The IC posts a summary every 15-30 minutes: *Status, Impact, Current Actions, Next Update Time*.

## 5. MODERN IMPLEMENTATION
Modern enterprise incident response relies heavily on automated observability, feature toggles, and infrastructure-as-code for rapid mitigation without full deployments.

```typescript
// Modern Angular Mitigation: Feature Toggles
// If a new feature causes an incident, we disable it instantly via API, no deployment needed.
@Injectable({ providedIn: 'root' })
export class FeatureGuard implements CanActivate {
  private features = inject(FeatureToggleService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const feature = route.data['featureKey'];
    if (this.features.isEnabled(feature)) {
      return true;
    }
    // Graceful degradation instead of crashing
    return this.router.parseUrl('/fallback');
  }
}
```

```java
// Spring Boot Observability (Micrometer / Trace IDs)
// Critical for tracing requests across microservices during an incident
@RestController
@RequestMapping("/api/v1/transfer")
public class TransferController {
    private static final Logger log = LoggerFactory.getLogger(TransferController.class);
    
    @PostMapping
    public ResponseEntity<TransferRes> execute(@RequestBody TransferReq req) {
        // Log automatically includes Trace ID injected by Spring Boot 3 Micrometer
        // This Trace ID is essential for identifying the exact request in Datadog/Splunk
        log.info("Executing transfer for account: {}", req.accountId());
        
        try {
            transferService.process(req);
            return ResponseEntity.ok(new TransferRes("SUCCESS"));
        } catch (Exception e) {
            log.error("Transfer failed", e); // Stack trace tied to the specific user's trace ID
            throw e;
        }
    }
}
```

## 6. LEGACY / ENTERPRISE REALITY
**Legacy Reality:** 
- **Detection**: Found by angry users calling customer support. Support emails the lead developer 3 hours later.
- **Triage**: Developers SSH directly into production servers to `tail -f catalina.out`.
- **Mitigation**: "Hot-patching" by editing compiled JavaScript on the server, or waiting 45 minutes for a full Jenkins build to forward-fix.
- **Postmortem**: A witch-hunt meeting where an individual is blamed for "being careless," resulting in fear-driven development.

**Migration to Modern:** 
Implement strict centralized logging (ELK/Datadog), remove direct SSH access, enforce CI/CD rollback pipelines (e.g., ArgoCD sync to previous git hash), and mandate a blameless culture driven by systems engineering.

## 7. PRACTICAL EXAMPLE (INCIDENT SIMULATIONS)

### Simulation 1: Easy (Wrong API URL)
**Report:** P2 - Web app fails to load any data on production.
*Symptoms:* Immediately after the 2:00 PM release, the UI loads but all data grids are empty.
*Investigation:* 
- Open Browser DevTools Network tab. 
- All API requests are failing with `ERR_NAME_NOT_RESOLVED`.
- The Request URL is `https://staging.api.bank.com/v1/data`.
*Root Cause:* The Angular `environment.prod.ts` file was accidentally overwritten, or the CI/CD pipeline injected the staging URL into the production build.
*Mitigation:* Rollback to the previous deployment. 
*Prevention:* Move configuration out of build-time `environment.ts` into a runtime `config.json` fetched on app initialization, injected by the orchestration layer (Kubernetes ConfigMap).

### Simulation 2: Medium (CORS Failure)
**Report:** P2 - Partner portal cannot access the API.
*Symptoms:* The new `promo.bank.com` site launched, but users report it's broken.
*Investigation:*
- Backend logs show absolutely no errors. The requests aren't reaching the controllers.
- Browser console shows: `Access to fetch at 'api.bank.com' from origin 'promo.bank.com' has been blocked by CORS policy`.
*Root Cause:* The new domain was not added to Spring Security's `CorsConfigurationSource`.
*Fix:* 
```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(Arrays.asList("https://app.bank.com", "https://promo.bank.com"));
    // ...
}
```

### Simulation 3: Hard (Refresh Token Race Condition)
**Report:** P1 - Users logged out randomly during heavy usage.
*Symptoms:* Angular app uses short-lived JWTs (5m) and long-lived refresh tokens. Users on slow 3G networks report being randomly logged out when loading the dashboard.
*Investigation:*
- Splunk logs show multiple `/api/auth/refresh` requests hitting Spring Boot simultaneously for the same user.
- The first request returns 200 OK. The subsequent parallel requests return 401 Unauthorized.
*Root Cause:* The dashboard fires 5 parallel HTTP requests. The HTTP Interceptor detects an expired JWT and attempts to refresh it. Because 5 requests fired simultaneously, 5 parallel refresh token requests hit Spring Boot. The first one succeeds, generates a new JWT, and invalidates the old refresh token (refresh token rotation). The other 4 requests fail with 401 because they used the invalidated token. The interceptor interprets the 401 as a hard logout.
*Fix:* The Angular interceptor must implement a `BehaviorSubject<boolean>` semaphore to queue outgoing requests while a refresh is in progress.

### Simulation 4: Expert (Blue-Green Version Mismatch with CDN)
**Report:** P1 - "Uncaught SyntaxError" breaking the app for 30% of users.
*Symptoms:* Deployed v2.0 via Blue-Green deployment. 70% of users are fine. 30% get a white screen.
*Investigation:*
- Affected users are downloading `index.html` (v2.0) but their browser is requesting `main.[old-hash].js` (v1.0), which returns a 404, or they are getting `main.[new-hash].js` but executing it against an old cached `index.html`.
*Root Cause:* The CDN sits in front of the application. The `index.html` cache TTL was set to 1 hour instead of `Cache-Control: no-cache`. During the Blue-Green swap, some edge nodes retained the old `index.html` which pointed to deleted JavaScript chunks, while other nodes served the new `index.html`.
*Mitigation:* Immediately purge the CDN cache.
*Prevention:* Enforce strict cache headers on the backend for `index.html`.
```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/index.html")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache().mustRevalidate());
    }
}
```

## 8. COMMON MISTAKES
1. **Forward-Fixing During a P1:** Attempting to write code, pass CI, and deploy a fix while the system is down instead of just rolling back to the last known good state.
2. **Failing to check the timeline:** Ignoring the "what changed recently" question. 90% of incidents are caused by a deployment, config change, or DNS update in the last 2 hours.
3. **Tunnel Vision:** Investigating complex race conditions before checking basic infrastructure (e.g., "Is the database disk full?").
4. **Blaming the Developer:** Writing postmortems that conclude with "Engineer X will be more careful next time." (The correct conclusion is "The CI pipeline allowed Engineer X to deploy broken code.")

## 9. LOCAL ISSUES
- **"It Works On My Machine":** The classic local issue. The developer's machine runs Windows, uses `localhost`, and has no network latency. Production runs Linux, uses `app.company.com`, sits behind WAF/Nginx, and experiences 200ms latency. Local development must simulate production conditions (using Docker, proxies, and latency simulation).
- **Timezone Bugs:** Developer is in EST, production servers run in UTC. `new Date()` logic behaves differently locally versus on the server, causing bugs that only appear in deployed environments. Always force UTC on local Docker containers.

## 10. CI/CD ISSUES
- **Cache Poisoning:** The CI pipeline builds the Angular app but reuses a stale `node_modules` cache containing an outdated transitive dependency with a critical bug.
- **Environment Variable Mismatch:** The build pipeline succeeds, but the deployment pipeline injects the Staging environment variables into the Production container.
- **Silent Failures:** The Angular build command fails (`exit code 1`), but the CI bash script pipes the output in a way that swallows the error code (`ng build | tee log.txt`), causing the pipeline to falsely report success and deploy an empty directory.

## 11. PRODUCTION ISSUES
- **Performance Degradation (CD Thrashing):** A new feature introduces a poorly memoized computed signal or RxJS mapping that triggers thousands of change detection cycles per second when a large dataset is loaded. The browser main thread locks up, causing the "Page Unresponsive" popup.
- **Nginx 502/504 Errors:** Spring Boot takes 35 seconds to process a massive export report. Nginx has a default `proxy_read_timeout` of 30 seconds. Nginx drops the connection and returns 504 Gateway Timeout, even though Spring Boot eventually finishes the job successfully. The user clicks "Export" again, compounding the backend load.
- **CORS Failures on New Domains:** The marketing team launches `promo.bank.com` which tries to call the Spring Boot API, but the domain wasn't added to the `@CrossOrigin` or Spring Security configuration.

## 12. FULL-STACK INTERACTION
**The Payload Bloat Incident**
*Scenario:* An Angular grid component displays a list of accounts. It worked flawlessly for 2 years.
*Incident:* On a Monday morning, the application crashes for the company's largest client.
*Root Cause Analysis:*
The Spring Boot endpoint `/api/accounts` returns a `List<AccountDto>`. Initially, the client had 50 accounts (payload: 10KB). Over 2 years, they acquired 50,000 accounts. Spring Boot now attempts to serialize 50,000 complex objects into JSON. 
1. Spring Boot consumes massive Heap Memory to generate the 25MB JSON string, triggering severe Garbage Collection (GC) pauses.
2. The network takes 8 seconds to transfer the 25MB payload.
3. The Angular `HttpClient` parses the 25MB JSON string into JavaScript objects, freezing the V8 main thread.
4. The Angular template `*ngFor` attempts to render 50,000 DOM nodes, crashing the browser tab.
*Fix:* The backend must enforce pagination. The frontend must implement Virtual Scrolling (`@angular/cdk/scrolling`) and infinite scroll data fetching.

## 13. DEBUGGING PROCESS
### The Incident Commander Triage Workflow
1. **Establish the War Room:** Open a dedicated Zoom/Slack channel.
2. **Assign Roles:** 
   - *Commander*: Manages flow.
   - *Communicator*: Updates stakeholders every 15 minutes.
   - *Investigator(s)*: Looks at code/logs.
3. **Assess Blast Radius:** Who is affected? Which regions? Which features?
4. **Timeline Review:** What was deployed, merged, or changed in the last 24 hours?
5. **Mitigation First:** If a deploy caused it, rollback immediately. Do not wait for investigators to find the exact code line.

## 14. ROOT CAUSE ANALYSIS
### The 5 Whys Methodology
The "5 Whys" is an iterative interrogative technique used to explore the cause-and-effect relationships underlying a particular problem.

**Problem:** The payment gateway rejected 10,000 transactions on Black Friday.
- *Why?* The Angular app sent a string `"100.00"` instead of a number `100` to the Spring Boot API.
- *Why?* The Spring Boot API accepted it because the DTO field was changed from `BigDecimal` to `String` by accident in a recent PR.
- *Why?* The database required a numeric format, causing the payment processor client to fail downstream.
- *Why?* There was no contract test enforcing the numeric constraint between the API and the payment processor.
- *Why?* Contract testing is only run manually before major releases, not on every PR.

**Root Cause Solution:** Implement automated Pact contract testing on the CI pipeline for all payment-related endpoints.

### Distributed Tracing for RCA
In a microservice architecture, an incident reported as "Frontend is slow" requires distributed tracing to find the root cause.
1. The Angular app injects a `b3` or `traceparent` header into outgoing HTTP requests.
2. Spring Boot API Gateway receives it and forwards it.
3. If the delay is in the `AccountService`, tracing tools (Zipkin, Datadog) will visualize the exact span that took 5 seconds.
4. RCA reveals a missing database index on the `AccountService` PostgreSQL database.

## 15. FIX
**Rollback vs Forward-Fix Framework:**
- **Rollback** if: The incident started exactly after a deployment. The database schema wasn't destructively migrated. The rollback takes < 5 minutes (e.g., swapping a Kubernetes deployment tag or pointing Nginx to the old directory).
- **Forward-Fix** if: The rollback is dangerous (e.g., database schema changes prevent reverting the app code without massive data loss). The fix is literally a one-line config change (e.g., flipping a feature toggle off via a remote config dashboard). The incident was caused by a third-party API going down (rollback won't help, you must write and deploy fallback logic).

## 16. PREVENTION
1. **Blameless Culture:** If a developer breaks production, the system failed them. The postmortem must focus on fixing the system, not punishing the human. "You can't fire your way to a reliable system."
2. **Infrastructure as Code (IaC):** Prevent "drift" where the production server's manual Nginx config differs from staging. Use Terraform, Ansible, or Helm charts.
3. **Chaos Engineering:** Intentionally terminate Spring Boot pods in staging to verify that the Angular frontend gracefully handles 502s with retry logic and offline states, rather than crashing to a white screen.
4. **Pre-flight Checks:** Automate configuration validation on startup. If Spring Boot starts without a required database URL, it should fail immediately before the load balancer sends it traffic.

## 17. MONITORING / OBSERVABILITY
**Key Incident Metrics to Monitor:**
- **Error Budget / SLA:** If uptime drops below 99.9%, feature development freezes, and the team focuses 100% on reliability engineering.
- **MTTD (Mean Time To Detect):** How long before we knew we were broken? (Target: < 5 mins).
- **MTTR (Mean Time To Resolve):** How long before service was restored? (Target: < 30 mins).

**Alert Fatigue Prevention:** 
If an alert fires but requires no human action, delete the alert. Alerts should only trigger when a human must intervene. Use "symptom-based alerting" (e.g., "Checkout Success Rate dropped below 95%") rather than "cause-based alerting" (e.g., "CPU usage is at 80%"). High CPU is fine if the app is still serving traffic fast enough.

## 18. PERFORMANCE CONSIDERATIONS
During an incident, diagnosing a memory leak requires specific profiling:
- **Angular Memory Leak:** Navigate between routes 20 times. Take a Chrome Heap Snapshot. If detached DOM nodes or `LView` arrays accumulate, an RxJS subscription or DOM event listener wasn't destroyed.
- **Spring Boot Memory Leak:** Use `jmap` or JDK Mission Control to dump the heap. Often caused by unbounded caches (e.g., storing millions of user sessions in a standard `HashMap` instead of a Redis/Caffeine cache with eviction policies) or open database connections that are never returned to the HikariCP pool.
- **Thread Starvation:** If Spring Boot logs show Tomcat threads maxed out (default 200), but CPU is low, the app is blocking on downstream I/O (e.g., waiting for a slow third-party API). Fix by using `CompletableFuture` or WebFlux for non-blocking I/O.

## 19. SECURITY CONSIDERATIONS
Incidents are often security breaches in disguise.
- A sudden spike in 401/403 errors might be a credential stuffing attack, not a broken auth server.
- A spike in database CPU utilization might be a SQL injection attempt running expensive analytical queries.
- During an incident, **never disable security controls** (like CORS, CSRF, or Authentication) just to "get it working again." This is exactly when attackers strike, knowing the engineering team is distracted.
- Post-incident, verify that no PII (Personally Identifiable Information) or secure tokens were leaked into Datadog/Splunk logs while debug logging was turned on.

## 20. TESTING STRATEGY
**Incident-Driven Testing:**
Every postmortem action item MUST result in at least one automated test.
- If a UI state race condition caused the incident, write a Cypress E2E test that explicitly triggers that race condition using `cy.intercept` to delay responses.
- If a Spring Boot DTO mismatch caused it, write an `@WebMvcTest` asserting the exact JSON shape.
- If a dependency version caused it, lock the version in `package-lock.json` and add a Dependabot rule.

## 21. EXERCISES
1. **Roleplay:** Conduct a mock P1 incident in a team setting. One person is Commander, one is Investigator. Introduce fake log evidence via a shared screen.
2. **Write a Postmortem:** Take a recent bug you wrote that made it to the `main` branch. Write a formal 5-Whys postmortem document for it, focusing on systemic failures rather than human error.
3. **Configure Alerts:** Set up a Datadog or Prometheus alert that triggers when 5xx errors exceed 1% of total traffic over a 5-minute window, routing the alert to a PagerDuty test endpoint.
4. **Build a Runbook:** Write a step-by-step runbook for "How to rollback the production Angular application."

## 22. BREAK-AND-FIX LAB
**Issue ANG-INCIDENT-001:** Duplicate Money Transfer from Retry.
**Context:** A user clicked "Transfer", the network dropped, the Angular HTTP Interceptor auto-retried, and the user was charged twice.
**Defect:** The Spring Boot API is not idempotent. The frontend retry blindly resent the exact same payload.
**Reproduction:**
1. Intercept the network request in Chrome DevTools and simulate a timeout on the response.
2. Observe the Angular interceptor firing a second request.
3. Check the database; two transfers are recorded.
**Fix (Backend):** Implement Idempotency Keys. The Angular frontend generates a UUID (`X-Idempotency-Key`) for the transfer. Spring Boot stores this key in a Redis cache for 24 hours. If a second request arrives with the same key, Spring Boot recognizes it as a duplicate and returns the cached success response without executing the database transfer again.

```java
// Spring Boot Idempotency Interceptor logic
@PostMapping("/transfer")
public ResponseEntity<?> transfer(@RequestHeader("X-Idempotency-Key") String idempotencyKey, @RequestBody TransferReq req) {
    if (redisTemplate.hasKey(idempotencyKey)) {
        // Return cached successful response
        return ResponseEntity.ok(redisTemplate.opsForValue().get(idempotencyKey));
    }
    
    TransferRes res = transferService.execute(req);
    redisTemplate.opsForValue().set(idempotencyKey, res, 24, TimeUnit.HOURS);
    return ResponseEntity.ok(res);
}
```

## 23. EXPERT QUESTIONS
1. **Question:** During a P1 outage, the database CPU is at 100% and the site is down. The lead developer says, "I found the bad query, let me write a patch, run tests, and deploy." As the Incident Commander, what is your immediate directive?
   *Answer:* The directive is to immediately scale up the database instance, rollback the recent deployment that introduced the query, or kill the specific runaway query via DB admin tools. Forward-fixing through a full CI pipeline takes too long (often 20+ minutes) and violates the "Mitigate First, Fix Later" principle of incident response.
2. **Question:** How do you design an Angular HTTP interceptor architecture that gracefully degrades functionality during a partial backend outage (e.g., the recommendation service is down, but core banking is up)?
   *Answer:* Implement the Circuit Breaker pattern on the frontend (or via API Gateway). The interceptor tracks consecutive 5xx/timeout errors for specific service routes. Once a threshold is crossed (e.g., 5 failures in 10 seconds), it "opens" the circuit, failing fast and returning a cached or fallback `Observable` (like `of([])`) without making the HTTP call. This allows the UI to render a graceful "Service Unavailable" skeleton block while keeping core functionality intact and preventing the frontend from continually hammering a struggling backend service.
3. **Question:** In a blameless postmortem, a developer states: "I forgot to add the environment variable to production." How do you reframe this using systems thinking?
   *Answer:* "The deployment pipeline lacked an automated pre-flight validation step to ensure required configuration variables were present in the target environment before initiating the pod replacement." The failure is the system's reliance on human memory and the lack of automated safeguards, not the human's forgetfulness.
