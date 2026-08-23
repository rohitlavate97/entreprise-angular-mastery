# Angular Issues Lab Index

This index categorizes frontend-specific issues, debugging procedures, and regression verification steps.

---

## 🔍 Category Breakdown

### 1. Change Detection & Rendering (`CD`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `ANG-CD-001` | ExpressionChangedAfterItHasBeenCheckedError in dev mode | Local | Medium | Console error on view render |
| `ANG-CD-002` | OnPush component does not re-render on object mutation | Local/Prod | High | UI appears stale/unresponsive |
| `ANG-CD-003` | Signal effect creates recursive loop | Local/Prod | Critical | Maximum call stack exceeded / infinite CD cycle |
| `ANG-CD-004` | Detached view retains DOM references preventing GC | Prod | High | Continuous memory leak over time |

---

### 2. Dependency Injection & Instantiation (`DI`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `ANG-DI-001` | Circular dependency in injectable services | Local/CI | High | `NG0200: Circular dependency found` |
| `ANG-DI-002` | Service provided in Component providers creates multiple instances | Local/Prod | Medium | State not shared across sibling routes |
| `ANG-DI-003` | NullInjectorError for optional tokens without `@Optional()` / `optional: true` | Local | High | Application startup crash |

---

### 3. RxJS & Reactivity (`RX`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `ANG-RX-001` | Memory leak due to unclosed subscription on component destroy | Prod | High | Heap size grows with route changes |
| `ANG-RX-002` | `switchMap` cancels critical mutation request | Prod | High | Data updates silently dropped on fast clicks |
| `ANG-RX-003` | Double submission on fast user button clicks | Local/Prod | Critical | Duplicate entities created |
| `ANG-RX-004` | `combineLatest` fails to emit because one source has not emitted | Local/Prod | Medium | Stream remains permanently silent |

---

### 4. Routing, Guards & Resolvers (`ROUT`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `ANG-ROUT-001`| Resolver hangs indefinitely preventing route transition | Local/Prod | High | Blank screen on navigation |
| `ANG-ROUT-002`| Guard redirect loop between `/login` and protected route | Local/Prod | Critical | Browser tab hangs / infinite redirect |
| `ANG-ROUT-003`| Lazy chunk 404 error after new build deployment | Prod | Critical | User cannot navigate without hard refresh |

---

### 5. Forms & Validation (`FORM`)
| Issue ID | Title | Environment | Severity | Primary Symptom |
|---|---|---|---|---|
| `ANG-FORM-001`| Async validator triggers on every keystroke without debounce | Local/Prod | Medium | Backend flooded with validation requests |
| `ANG-FORM-002`| ControlValueAccessor fails to propagate disabled state | Local | Low | Disabled UI element allows input |
| `ANG-FORM-003`| `setValue` fails due to missing properties vs `patchValue` | Local | Medium | Runtime error on partial model updates |
