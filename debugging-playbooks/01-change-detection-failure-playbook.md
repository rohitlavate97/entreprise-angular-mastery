# Playbook 01: Change Detection Failure ("UI Not Updating")

> **Severity:** P2 / P3 | **Domain:** Angular Runtime & Ivy Engine

---

## 1. 🔍 Symptoms
- State variable or Signal changed in component TypeScript code, but the DOM reflects stale old data.
- UI only updates when the user clicks anywhere on the screen or moves their mouse.
- `ExpressionChangedAfterItHasBeenCheckedError` logged in Chrome DevTools console.

---

## 2. 📋 5-Step Diagnostic Protocol

1. **Step 1: Check ChangeDetectionStrategy**
   - Check if `@Component({ changeDetection: ChangeDetectionStrategy.OnPush })` is declared.
   - If using `OnPush` with traditional properties: Mutating an object property (e.g. `this.user.name = 'Jane'`) does NOT create a new object reference, so Angular skips the component subtree.

2. **Step 2: Check Async Event Zone.js Boundary**
   - If state updated inside a third-party callback (e.g. `WebSocket.onmessage`, `setTimeout`, `google.maps` event), it may have executed **outside Angular Zone** (`ngZone.runOutsideAngular`).

3. **Step 3: Check Observable vs Signal Subscription**
   - If using RxJS: Did you forget the `async` pipe or forget to call `cdr.markForCheck()` after manual subscription?
   - If using Signals: Is the Signal read directly in the template as a function call `user().name`?

4. **Step 4: Check Angular DevTools Component Profiler**
   - Open Angular DevTools Chrome extension -> Profiler -> Record.
   - Trigger the action. Does the component highlight green (checked) or grey (skipped)?

5. **Step 5: Check Mutability Bugs**
   - Replace mutable arrays (`this.list.push(item)`) with immutable copies (`this.list = [...this.list, item]` or `this.listSignal.update(l => [...l, item])`).

---

## 3. 🛠️ Root Cause & Solutions

### Case A: OnPush Component with Mutated Object
```typescript
// ❌ BROKEN: Mutation does not trigger OnPush
this.user.name = 'New Name';

// ✅ FIXED (Modern Signals):
readonly user = signal<User>({ name: 'Initial' });
this.user.update(u => ({ ...u, name: 'New Name' }));

// ✅ FIXED (Immutable Property):
this.user = { ...this.user, name: 'New Name' };
this.cdr.markForCheck();
```

### Case B: Third-Party Event Outside Zone
```typescript
// ❌ BROKEN: WebSocket message outside Zone
this.socket.onmessage = (event) => {
  this.latestMessage = event.data; // DOM won't update
};

// ✅ FIXED:
this.socket.onmessage = (event) => {
  this.ngZone.run(() => {
    this.latestMessage.set(event.data);
  });
};
```
