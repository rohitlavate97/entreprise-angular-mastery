# Playbook 05: ChunkLoadError Post-Deployment Outages

> **Severity:** P1 (Production User Interruption) | **Domain:** Webpack / esbuild Chunk Hashing & Nginx Deployment

---

## 1. 🔍 Symptoms
- Users actively browsing an Angular application suddenly see blank pages and error:
  `Uncaught (in promise): ChunkLoadError: Loading chunk chunk-XYZ.js failed.`
- Occurs immediately after a new CI/CD deployment is released to production.

---

## 2. 📋 Root Cause Mechanics

```text
[User has App Open with Old index.html] ───> Requests: 'chunk-OLD123.js'
                                                        │
[CI/CD deploys new version: deletes old chunks] ────────┼───> Returns: HTTP 404 Not Found!
                                                        ▼
                                            [ ChunkLoadError Thrown! ]
```

When a new build is deployed with `outputHashing: 'all'`, all lazy chunk filenames change (`chunk-ABC.js` becomes `chunk-DEF.js`). If the deployment script wipes the Nginx `/usr/share/nginx/html` folder, existing users requesting old chunks receive 404s.

---

## 3. 🛠️ Prevention & Production Fix

1. **Deploy with Chunk Retention (Do not delete old chunks immediately):**
   ```bash
   # ❌ WRONG: Wipes existing directory
   rm -rf /usr/share/nginx/html/* && cp -r dist/* /usr/share/nginx/html/

   # ✅ CORRECT: Merge new build with existing files. Retain older chunks for 48 hours.
   cp -r dist/* /usr/share/nginx/html/
   find /usr/share/nginx/html -type f -mtime +2 -name "*.js" -delete
   ```

2. **Automatic Angular Router Retry on ChunkLoadError:**
   ```typescript
   export const appConfig: ApplicationConfig = {
     providers: [
       provideRouter(
         routes,
         withRouterConfig({
           onSameUrlNavigation: 'reload'
         })
       ),
       {
         provide: ErrorHandler,
         useClass: class implements ErrorHandler {
           handleError(error: unknown): void {
             const chunkFailedMessage = /Loading chunk [\d]+ failed/;
             if (error && chunkFailedMessage.test((error as Error).message)) {
               window.location.reload(); // Force full reload to fetch latest index.html
             }
           }
         }
       }
     ]
   };
   ```
