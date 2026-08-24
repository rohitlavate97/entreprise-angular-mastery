# 🐍 Angular 19+ & Django 5+ Enterprise Mastery Platform

[![Angular](https://img.shields.io/badge/Angular-19.1+-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Django](https://img.shields.io/badge/Django-5.1+-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.15+-A30000?style=for-the-badge)](https://www.django-rest-framework.org/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis / Celery](https://img.shields.io/badge/Celery-Async_Tasks-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)

> **Mission:** A battle-tested engineering curriculum and enterprise reference platform pairing **Angular 19+ (Signals, Standalone, Functional Interceptors)** with **Django 5+ / DRF / Django Ninja / Celery / PostgreSQL**. Master the full-stack request lifecycle, ORM query optimization, trailing slash mechanics, async task queues, and zero-downtime Nginx/Gunicorn deployments.

---

## 🏛️ End-to-End System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ANGULAR + DJANGO FULL-STACK ARCHITECTURE                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  [ Angular 19+ Standalone SPA ]
        │
        ├── 1. correlationIdInterceptor: Injects 'X-Request-ID: <UUID>'
        ├── 2. authInterceptor: Injects 'Authorization: Bearer <JWT>' (or manages cookies)
        │      └── If 401: Refresh Token Race-Safe Queue (BehaviorSubject lock)
        ├── 3. xsrfInterceptor: Maps 'csrftoken' cookie -> 'X-CSRFToken' header
        └── 4. UI State: Signals (signal, computed, resource) + Event Coalescing
        │
        ▼ (HTTP / HTTPS)
  [ Nginx Alpine Reverse Proxy ]
        │
        ├── 1. HTML5 SPA Fallback: 'try_files $uri $uri/ /index.html;'
        ├── 2. Trailing Slash Safe: Avoids converting POST -> 301 redirects
        ├── 3. Caching: Hashed chunks (1yr immutable) vs index.html (no-cache)
        └── 4. Header Forwarding: X-Request-ID, Host, X-Forwarded-Proto, X-Real-IP
        │
        ▼ (Reverse Proxy /api/ -> Gunicorn :8000)
  [ Django 5+ / DRF / Django Ninja Backend ]
        │
        ├── 1. CorrelationIdMiddleware: Sets Python structlog contextVar (traceId)
        ├── 2. CorsMiddleware: Preflight OPTIONS evaluation & Origin Whitelist
        ├── 3. CsrfViewMiddleware: Validates X-CSRFToken header on mutating calls
        ├── 4. Authentication (SimpleJWT / Session): Populates request.user
        ├── 5. Controllers / ViewSets / Ninja Routers: Serializer / Pydantic validation
        ├── 6. ORM Query Layer: select_related & prefetch_related (Zero N+1 queries)
        ├── 7. Celery Task Queue: Offloads heavy background jobs via Redis
        └── 8. Custom Exception Handler: Serializes uniform 'ApiErrorResponse' JSON
        │
        ▼
  [ PostgreSQL 16 ACID Database ]
```

---

## 🗺️ Master Documentation & Indexes

- 📋 [**Django Master Roadmap**](file:///D:/Projects/angular-entreprise-mastery/angular-django/ANGULAR_DJANGO_MASTER_ROADMAP.md) — 8-Phase curriculum map and module dependency matrix.
- 📊 [**Django Progress Tracker**](file:///D:/Projects/angular-entreprise-mastery/angular-django/ANGULAR_DJANGO_PROGRESS_TRACKER.md) — Live completion tracker.
- 📜 [**Master Prompt Specification**](file:///D:/Projects/angular-entreprise-mastery/ANGULAR_DJANGO_EXPERT_GUIDE_PROMPT.md) — Complete 23-section teaching rubric.
