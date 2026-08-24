# Module 24: Deployment and Infrastructure

---

## 1. WHAT
Deployment and Infrastructure in an Angular + Spring Boot enterprise ecosystem encompasses the automated CI/CD pipelines, containerization (Docker multi-stage builds), web server configuration (Nginx SPA routing, caching, and reverse proxying), and the runtime orchestration required to deliver secure, highly available, and performant applications to production.

---

## 2. WHY
- **Reproducibility**: Docker containers ensure that the Angular application and Spring Boot backend run identically on a developer's laptop, in CI pipelines, and in production clusters.
- **SPA Routing**: Single Page Applications require specialized web server configurations (like Nginx's `try_files`) to fallback to `index.html` for deep links, otherwise users encounter 404 errors on page refresh.
- **Performance Optimization**: Correct `Cache-Control` headers (immutable hashed assets, no-cache `index.html`) and compression (Gzip/Brotli) are critical for fast frontend load times.
- **Security & Secrets**: Embedding API URLs or secrets in the Angular build process is a major security flaw. Infrastructure must support injecting environment configurations at runtime.

---

## 3. INTERNAL MENTAL MODEL

### Enterprise Deployment Architecture

```text
+===========================================================================================+
|                         FULL-STACK DEPLOYMENT ARCHITECTURE                                |
|                                                                                           |
|  ┌──────────────────┐                                                                     |
|  │                  │       DNS / CDN / Load Balancer                                     |
|  │     BROWSER      │────►  (SSL/TLS Termination)                                         |
|  │                  │               │                                                     |
|  └──────────────────┘               ▼                                                     |
|                           ┌──────────────────┐                                            |
|                           │                  │                                            |
|                           │  NGINX (Reverse  │ ────► Serves Static Assets (Angular)       |
|                           │  Proxy & Static) │ ────► Cache-Control: max-age=31536000      |
|                           │                  │                                            |
|                           └────────┬─────────┘                                            |
|                                    │ proxy_pass /api                                      |
|                                    ▼                                                      |
|                           ┌──────────────────┐                                            |
|                           │                  │                                            |
|                           │ SPRING BOOT APP  │ ────► Validates JWT                        |
|                           │    (Backend)     │ ────► Business Logic                       |
|                           │                  │                                            |
|                           └────────┬─────────┘                                            |
|                                    │ JDBC / JPA                                           |
|                                    ▼                                                      |
|                           ┌──────────────────┐                                            |
|                           │                  │                                            |
|                           │  POSTGRES DB     │                                            |
|                           │                  │                                            |
|                           └──────────────────┘                                            |
+===========================================================================================+
```

---

## 4. HOW IT WORKS

1. **Build Phase**: CI/CD pipeline checks out code. Angular is built via `ng build --configuration production`, resulting in static HTML, CSS, JS, and hashed assets. Spring Boot is built via Maven/Gradle into an executable JAR.
2. **Containerization**: A multi-stage Dockerfile copies the Angular dist folder into an Nginx base image. Another Dockerfile containerizes the Spring Boot JAR.
3. **Runtime Configuration**: Upon container startup, a script (or `envsubst`) reads environment variables and generates an `assets/config.json` file. Angular fetches this file on bootstrap to know its API endpoints.
4. **Request Routing**:
   - A request to `https://app.com/main.js` hits Nginx, matches static files, and is returned with a 1-year cache header.
   - A request to `https://app.com/dashboard` hits Nginx, finds no static file named `dashboard`, and triggers `try_files` to serve `index.html`. Angular then handles the client-side routing.
   - A request to `https://app.com/api/users` hits Nginx, matches the `/api` block, and is proxied to the Spring Boot backend container.

---

## 5. MODERN IMPLEMENTATION

### Angular Multi-Stage Dockerfile

```dockerfile
# Stage 1: Build the Angular App
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve with Nginx
FROM nginx:1.25-alpine
# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy Angular build output
COPY --from=build /app/dist/enterprise-app/browser /usr/share/nginx/html

# Script to inject environment variables into runtime config
COPY generate-config.sh /docker-entrypoint.d/99-generate-config.sh
RUN chmod +x /docker-entrypoint.d/99-generate-config.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Production Nginx Configuration (`nginx.conf`)

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 1. API Reverse Proxy
    location /api/ {
        # Assuming Spring Boot runs on a container named 'backend'
        proxy_pass http://backend:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Immutable Assets (Hashed JS/CSS)
    location ~* \.(?:css|js|woff2?|svg|gif|png|jpe?g)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # 3. SPA Routing Fallback (and no-cache for index.html)
    location / {
        try_files $uri $uri/ /index.html;
        
        # Prevent caching of index.html so users always get the latest app version
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Modern Pattern | Legacy Pattern | Enterprise Reality |
|---|---|---|
| Runtime `config.json` injection | Build-time `environment.prod.ts` | Legacy apps often baked secrets or URLs directly into the build via Angular `environment.ts` replacements, requiring a full recompile to promote from Staging to Prod. Modern 12-factor apps compile *once* and inject config at runtime. |
| Nginx Reverse Proxy | CORS Enabled in Spring Boot | Legacy setups often exposed the backend directly to the browser on a different domain, requiring complex CORS headers. Modern setups proxy `/api` through the same Nginx domain, eliminating CORS entirely. |
| Docker Multi-stage | Jenkins SCP to VM | Legacy deployments often involved Jenkins SCP-ing the `dist` folder directly onto a mutable VM's `/var/www/html`. Containers ensure immutability. |

---

## 7. PRACTICAL EXAMPLE

**Scenario**: Injecting Runtime Configuration (12-Factor App methodology).

Instead of `environment.ts`, the app loads config on startup.

**`assets/config.template.json`**:
```json
{
  "apiUrl": "${API_URL}",
  "authClientId": "${AUTH_CLIENT_ID}"
}
```

**`generate-config.sh`** (runs in Docker entrypoint):
```bash
#!/bin/sh
# Replaces variables in the template and outputs the actual config.json
envsubst < /usr/share/nginx/html/assets/config.template.json > /usr/share/nginx/html/assets/config.json
```

**Angular `APP_INITIALIZER`**:
```typescript
export function initializeApp(http: HttpClient, configService: ConfigService) {
  return () => http.get('/assets/config.json').pipe(
    tap(config => configService.setConfig(config))
  );
}
```

---

## 8. COMMON MISTAKES

1. **Caching `index.html`**: If Nginx adds a long `max-age` cache header to `index.html`, users will never download the new version of your app when you deploy, resulting in endless "Blank Screen" or "Mismatched Hash" errors.
2. **Missing `try_files`**: Deploying an SPA without `try_files $uri /index.html`. Users can navigate via Angular Router, but if they hit refresh (F5), Nginx looks for a literal directory and returns 404.
3. **Baking API URLs into Docker Images**: Using `environment.prod.ts` to hardcode the production API URL. This prevents you from testing the exact same Docker image in a staging environment.
4. **Huge Docker Images**: Using the full Node.js image to serve the application instead of a multi-stage build that extracts only the static files into a lightweight Nginx Alpine image.

---

## 9. LOCAL ISSUES

- **Symptom**: Local Docker Compose works, but the frontend can't connect to the backend because it uses `http://localhost:8080` inside the container.
- **Root Cause**: The browser (running on the host) needs to connect to the backend. If you configure Angular to call `http://backend:8080`, it will fail because `backend` is a Docker internal DNS name, not resolvable by the browser.
- **Fix**: Use a relative path `/api` in Angular, and let Nginx (which is *inside* the Docker network) proxy `/api` to `http://backend:8080`.

---

## 10. CI/CD ISSUES

- **Symptom**: CI Pipeline fails during the Angular build step with Out Of Memory (OOM) errors (e.g., `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed`).
- **Root Cause**: Webpack/Terser minification in production builds is heavily CPU and memory intensive. CI runners (like GitHub Actions free tier) have limited RAM.
- **Fix**: Increase Node memory limits via `NODE_OPTIONS="--max_old_space_size=4096"` in the CI pipeline script.

---

## 11. PRODUCTION ISSUES

- **Symptom**: After a new deployment, users report random elements missing, broken styles, or "ChunkLoadError".
- **Root Cause**: The new deployment replaced the static files on Nginx. However, the user's browser still has the *old* `index.html` cached, which is trying to load old hashed files (e.g., `main-XYZ.js`). Since `main-XYZ.js` was deleted from Nginx during the deployment, the chunk load fails.
- **Fix**:
  1. Ensure `Cache-Control: no-cache` on `index.html`.
  2. Implement a rolling deployment or keep the previous deployment's hashed assets on the server for a transition period.
  3. Catch `ChunkLoadError` in Angular's global error handler and force a `window.location.reload()`.

---

## 12. FULL-STACK INTERACTION

### Complete CI/CD Pipeline Stages

1. **Commit**: Developer pushes to `main`.
2. **Build & Test (Angular)**: `npm ci`, `ng lint`, `ng test`, `ng build`.
3. **Build & Test (Spring Boot)**: `mvn clean test package`.
4. **Security Scan**: SonarQube for code quality, Trivy for Docker image CVEs.
5. **Image Build**: Docker multi-stage builds execute.
6. **Registry Push**: Images pushed to AWS ECR / Azure ACR.
7. **Staging Deploy**: Orchestrator (Kubernetes/Helm) pulls images. Injects Staging environment variables.
8. **E2E Tests**: Playwright runs against the Staging environment.
9. **Production Deploy (Blue-Green)**:
   - **Blue** (Active) is serving users.
   - **Green** (New) is spun up and Health Checks are verified.
   - Load balancer switches traffic to **Green**.
   - **Blue** is kept alive for 15 minutes as a fallback.

---

## 13. DEBUGGING PROCESS

**Scenario**: User reports 404 errors when navigating to a specific route via a shared link.

1. **Check Nginx Logs**: Tail the Nginx access logs: `docker logs nginx-container`.
2. **Identify Request**: Look for the request to the specific route. If it returns 404, Nginx did not fall back to `index.html`.
3. **Inspect Nginx Config**: Verify `try_files` exists in the `location /` block.
4. **Check Base Href**: Verify that `<base href="/">` is set correctly in `index.html`. If the app is hosted in a sub-folder (e.g., `/app/`), the base href and `try_files` must be adjusted accordingly.

---

## 14. ROOT CAUSE ANALYSIS

### Why `try_files` is Necessary for SPAs

Traditional web servers map URLs to physical directories and files on the filesystem. If a browser requests `http://domain.com/dashboard/users`, the server looks for the folder `dashboard/users` and an `index.html` inside it.

In an Angular SPA, there is only ONE physical HTML file: the root `index.html`. The route `/dashboard/users` is a virtual state managed by the Angular Router using the HTML5 History API. When a user clicks a link inside the app, the browser suppresses the network request and Angular updates the URL.

However, if the user hits F5, the browser sends a *hard network request* for `/dashboard/users`. Without `try_files $uri $uri/ /index.html`, Nginx will look for the physical folder, fail to find it, and return a 404.

---

## 15. FIX

**Fixing Nginx SPA Routing**:
```nginx
location / {
    # 1. Try exact file ($uri) - catches hashed .js, .css files
    # 2. Try directory ($uri/)
    # 3. Fallback to index.html (Allows Angular Router to take over)
    try_files $uri $uri/ /index.html;
}
```

---

## 16. PREVENTION

1. **Infrastructure as Code (IaC)**: Nginx configuration should be checked into version control alongside the application code. Do not manually configure production servers via SSH.
2. **Automated E2E Testing of Direct Navigation**: Add a Playwright test that directly navigates to a deeply nested URL (e.g., `page.goto('/dashboard/users')`) instead of starting from the homepage. This instantly catches broken Nginx configurations.
3. **Health Check Probes**: In Kubernetes, configure liveness and readiness probes. For Spring Boot, use Actuator `/actuator/health`. For Angular/Nginx, an HTTP GET to `/index.html` ensures the server is up.

---

## 17. MONITORING / OBSERVABILITY

- **Access Logs**: Ship Nginx access logs to an ELK stack (Elasticsearch, Logstash, Kibana) or Datadog to monitor 4xx and 5xx error rates.
- **Uptime Monitoring**: Use tools like Pingdom or AWS Route53 Health Checks to monitor the public URL.
- **Distributed Tracing**: If Nginx acts as a reverse proxy, configure it to generate and propagate `X-Request-Id` or W3C Trace headers to the Spring Boot backend.

---

## 18. PERFORMANCE CONSIDERATIONS

- **Brotli over Gzip**: Modern browsers support Brotli (`br`), which offers significantly better compression ratios than Gzip for text assets (JS, CSS, HTML). Consider adding the Nginx Brotli module.
- **CDN Offloading**: For global enterprise applications, place a CDN (Cloudflare, AWS CloudFront) in front of Nginx. The CDN should cache the immutable hashed assets at the edge, drastically reducing load on your origin Nginx servers.
- **SSL Termination**: Terminate SSL/TLS at the Load Balancer or Ingress Controller rather than the Nginx pod itself to reduce CPU overhead on the application nodes.

---

## 19. SECURITY CONSIDERATIONS

- **Security Headers**: Nginx must attach standard security headers to all responses:
  ```nginx
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self' http://backend:8080;";
  ```
- **Information Disclosure**: Disable server version tokens to prevent attackers from knowing your Nginx version: `server_tokens off;`.
- **Root Privileges**: The Docker container should not run Nginx as root. Use an unprivileged Nginx image (`nginxinc/nginx-unprivileged`) to comply with strict enterprise container security policies.

---

## 20. TESTING STRATEGY

1. **Docker Build Testing**: Ensure the CI pipeline builds the Docker image on every PR to catch build-time errors (like failing `npm run build`).
2. **Container Scanning**: Run Trivy or Clair against the built Docker image to detect OS-level or Node-level CVEs before deployment.
3. **Smoke Testing**: After deploying to Staging, run a fast suite of E2E smoke tests to verify Nginx routing, backend proxying, and database connectivity are all functioning correctly.

---

## 21. EXERCISES

1. **Multi-Stage Build**: Write a `Dockerfile` that builds an Angular application using Node 20, and then serves it using `nginx:alpine`.
2. **Nginx Configuration**: Modify an `nginx.conf` to proxy `/api/v1` to `http://springboot:8080`, proxy `/auth` to `http://keycloak:8080`, and serve the Angular SPA for all other routes.
3. **Runtime Config**: Implement a bash script that reads `API_URL` and `THEME_COLOR` from the environment and injects them into a `config.json` file in the Nginx html directory.

---

## 22. BREAK-AND-FIX LAB

**Lab ID**: ANG-DEPLOY-001

**Defect Injection**:
Provide an `nginx.conf` that is missing the `try_files` directive for the Angular application.
```nginx
location / {
    root /usr/share/nginx/html;
    index index.html;
}
```

**Reproduction**:
1. Run the Docker container.
2. Navigate to `http://localhost/`. The app loads perfectly.
3. Click a link in the UI to go to `http://localhost/accounts`. The app routes perfectly.
4. Hit F5 (Refresh) on the `/accounts` page.
5. The browser displays an Nginx 404 Not Found error.

**Diagnostic Steps**:
1. Check the Nginx access logs. See a 404 response for `/accounts`.
2. Identify that Nginx is looking for a file or directory named `accounts` on the disk, which does not exist.

**Fix**:
Add the `try_files` directive to route all unknown requests to `index.html`.
```nginx
location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```

---

## 23. EXPERT QUESTIONS

**Q1: Explain the "ChunkLoadError" in Angular deployments. How do you architect your deployment strategy (Blue-Green vs Rolling) and Nginx configuration to prevent it?**
*Answer*: ChunkLoadError occurs when a user's browser, holding an older `index.html`, tries to lazily load an older hashed chunk (e.g., `main-v1.js`) that was deleted from the server during a new deployment. To prevent this, Nginx must serve `index.html` with `Cache-Control: no-cache`. Additionally, deployments should use Blue-Green (where the old environment stays alive until traffic is fully drained) or a Rolling update strategy where the previous version's static assets are retained on the CDN or server for a transition window.

**Q2: Why is embedding environment variables (like API keys or URLs) at build time via `environment.prod.ts` considered an anti-pattern in modern cloud-native architectures?**
*Answer*: The 12-Factor App methodology mandates strict separation of build, release, and run stages. Baking config into the build violates this by coupling the artifact to a specific environment. You would need to rebuild the Angular app for Staging and Production separately, destroying the guarantee that the exact same codebase/artifact tested in Staging is what goes to Production. Config must be injected at runtime (e.g., fetching a generated `config.json`).

**Q3: Describe how you would configure Nginx to act as an API Gateway for a frontend SPA talking to multiple microservices (e.g., Spring Boot Core API, Node.js Chat Service, and Keycloak Auth). What headers must Nginx forward?**
*Answer*: Nginx would use path-based routing in its configuration.
- `location /api/` -> `proxy_pass http://spring-boot-core:8080/api/`
- `location /chat/` -> `proxy_pass http://nodejs-chat:3000/`
- `location /auth/` -> `proxy_pass http://keycloak:8080/auth/`
Nginx must forward headers to preserve client context: `X-Real-IP`, `X-Forwarded-For` (client IP chain), `X-Forwarded-Proto` (HTTP/HTTPS), and the original `Host` header. This ensures Spring Security and Keycloak generate correct redirect URIs and audit logs.
