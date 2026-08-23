# Issue Lab Template

Every issue in the Angular and Full-Stack Issues Labs must follow this uniform structure.

---

```markdown
# [ISSUE-ID]: [Issue Title]

- **Category:** [startup | http | contract | security | cors | rxjs | forms | ssr | performance]
- **Environment:** [local | CI | staging | production | all]
- **Severity:** [Low | Medium | High | Critical]
- **Angular Version:** [e.g., 19.x]
- **Spring Boot Version:** [e.g., 3.4.x / Java 21/25]

---

## 1. Symptoms & User Impact
- What the user or developer observes when this issue occurs.

## 2. Reproduction Steps
1. Step 1...
2. Step 2...
3. Step 3...

## 3. Expected vs Actual Result
- **Expected:** 
- **Actual:** 

## 4. Exact Error Message & Stack Trace
```text
[Exact error or exception log]
```

## 5. Root Cause & Internal Explanation
- Deep technical explanation of why this happens at the runtime / protocol / framework level.

## 6. How to Debug (Senior Engineer Workflow)
- **Browser DevTools:** (Tab, network request, payload, status)
- **Angular DevTools:** (Profiler, component view, signal graph)
- **Backend Logs:** (Spring Boot log lines, SQL output, security filter traces)
- **Smoking Gun Evidence:** Which specific line/header proves the root cause.

## 7. Minimal Permanent Fix
```typescript
// Frontend fix
```
```java
// Backend fix
```

## 8. Prevention & Guardrails
- How to prevent this from ever recurring (linter, compiler flags, architectural guardrails).

## 9. Automated Regression Test
- Unit or integration test code that asserts the fix.

## 10. Related Issues
- Links to related issue labs or incident playbooks.
```
