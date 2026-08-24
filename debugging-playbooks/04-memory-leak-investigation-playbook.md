# Playbook 04: Angular Memory Leaks & Subscription Retainers

> **Severity:** P2 | **Domain:** JavaScript V8 Engine & DOM Lifecycle

---

## 1. 🔍 Symptoms
- Chrome tab memory grows steadily over hours of usage without stabilizing.
- UI becomes increasingly sluggish and frame rates drop.
- Subscriptions or event handlers execute multiple times for a single event (e.g. 5 duplicate toasts on a single save).

---

## 2. 📋 Chrome DevTools Heap Snapshot Diagnostic Protocol

1. **Step 1: Record Baseline Heap Snapshot**
   - Chrome DevTools -> **Memory** Tab -> Select **Heap snapshot** -> Click **Take snapshot** (Snapshot 1).

2. **Step 2: Perform the Suspected Action Cycle 5 Times**
   - E.g., Navigate to `/users` -> Navigate back to `/profile` -> Repeat 5 times.

3. **Step 3: Force Garbage Collection & Take Snapshot 2**
   - Click the **Collect garbage** (trash can icon) in DevTools -> Click **Take snapshot** (Snapshot 2).

4. **Step 4: Analyze Retained Objects in Comparison View**
   - In Snapshot 2, select **Comparison** dropdown -> Filter by Class: `Detached HTMLDivElement` or `Subject` or `Subscriber`.
   - If destroyed components are still in memory: Check the **Retainers** tree at the bottom to find the GC Root preventing cleanup!

---

## 3. 🛠️ The 3 Most Common Angular Memory Leaks & Fixes

### 1. Unmanaged RxJS Subscriptions in Services/Components
```typescript
// ❌ LEAK: Component destroyed but interval keeps running in memory!
ngOnInit() {
  interval(1000).subscribe(() => this.pollData());
}

// ✅ FIXED (takeUntilDestroyed in modern Angular 16+):
private readonly destroyRef = inject(DestroyRef);

ngOnInit() {
  interval(1000)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(() => this.pollData());
}

// ✅ BEST (Signals):
readonly polledData = toSignal(interval(1000).pipe(switchMap(() => this.pollData())));
```

### 2. Event Listeners on `window` or `document`
```typescript
// ❌ LEAK: Global listener holds reference to component instance
ngOnInit() {
  window.addEventListener('resize', this.onResize);
}

// ✅ FIXED (DestroyRef cleanup):
constructor() {
  const handler = () => this.onResize();
  window.addEventListener('resize', handler);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', handler));
}
```
