# Module 18: Testing Strategy

---

## 1. WHAT
Testing in an Angular and Spring Boot enterprise ecosystem is a multi-layered strategy that verifies system correctness, from isolated frontend utility functions and component rendering with `TestBed`, up through API contract verification, and finally to Playwright-driven End-to-End (E2E) journeys across the full stack.

---

## 2. WHY
- **Confidence in Refactoring**: A robust test suite allows developers to modify complex Angular components or Spring Boot services without fear of regressions.
- **Fail Fast & Cheap**: Catching a business logic bug in a fast-running unit test is exponentially cheaper than discovering it in a slow E2E test or, worse, in production.
- **Contract Adherence**: In decoupled frontend/backend architectures, the highest risk of failure lies at the network boundary. Testing ensures the Angular UI aligns perfectly with Spring Boot API definitions.
- **Self-Documenting Code**: Well-written tests demonstrate the expected behavior of signals, functional interceptors, and complex reactive forms, serving as executable documentation.

---

## 3. INTERNAL MENTAL MODEL

### The Enterprise Testing Pyramid

```text
+===========================================================================================+
|                            ENTERPRISE TESTING PYRAMID                                     |
|                                                                                           |
|          ▲                   ┌───────────────────────┐                                    |
|          │                 /│       E2E TESTS       │\          Cost: High                |
|          │                / │      (Playwright)     │ \         Speed: Slow               |
|          │               /  └───────────────────────┘  \        Scope: Full Stack         |
|          │              /   ┌───────────────────────┐   \                                 |
|          │             /    │    CONTRACT TESTS     │    \                                |
|   Increasing          /     │  (OpenAPI / Pact)     │     \                               |
|   Integration        /      └───────────────────────┘      \                              |
|          │          /       ┌───────────────────────┐       \                             |
|          │         /        │   INTEGRATION TESTS   │        \                            |
|          │        /         │ (TestBed / @SpringBootTest)    \                            |
|          │       /          └───────────────────────┘         \                           |
|          │      /           ┌───────────────────────┐          \                          |
|          │     /            │    COMPONENT TESTS    │           \                         |
|          │    /             │(DOM, @Component, Forms)            \                        |
|          │   /              └───────────────────────┘             \                       |
|          │  /               ┌───────────────────────┐              \                      |
|          │ /                │       UNIT TESTS      │               \                     |
|          │/                 │ (Services, Pipes, DTOs)                \                    |
|          +────────────────────────────────────────────────────────────+                   |
|                             Quantity & Frequency of Execution                             |
+===========================================================================================+
```

---

## 4. HOW IT WORKS

1. **Unit Tests (Angular)**: Instantiate classes, services, or pipes manually without Angular's dependency injection or DOM rendering. Verify pure functions and business logic.
2. **Component Tests (Angular `TestBed`)**: Angular compiles the component template, creates a fixture, and renders the DOM. Developers interact with elements, trigger change detection (`fixture.detectChanges()`), and assert state/DOM updates.
3. **HTTP Mocking (`HttpTestingController`)**: Intercept outbound `HttpClient` requests during tests, assert on the request URL/headers, and flush mock responses back to the application.
4. **Integration Tests (Spring Boot)**: Use `@SpringBootTest` to load the application context. Verify that controllers, services, and repositories work together (often backed by Testcontainers).
5. **Contract Tests**: Verify that the TypeScript models generated (or manually written) in Angular perfectly match the OpenAPI spec or Spring Boot DTOs, often using consumer-driven contract tools like Pact.
6. **E2E Tests (Playwright)**: A headless browser automates user interactions against a deployed (or fully local) environment, verifying the complete frontend-to-backend-to-database journey.

---

## 5. MODERN IMPLEMENTATION

### Modern Angular Testing (Signals & Standalone)

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountDetailComponent } from './account-detail.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('AccountDetailComponent (Signals & Standalone)', () => {
  let fixture: ComponentFixture<AccountDetailComponent>;
  let component: AccountDetailComponent;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountDetailComponent], // Standalone components go in imports
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountDetailComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify(); // Ensure no outstanding requests
  });

  it('should render account balance using signal inputs', () => {
    // Modern way to set signal inputs: fixture.componentRef.setInput()
    fixture.componentRef.setInput('accountId', 'ACC-123');
    
    // Trigger initial change detection to process inputs
    fixture.detectChanges();

    // Mock the HTTP request triggered by the input change
    const req = httpTesting.expectOne('/api/accounts/ACC-123');
    expect(req.request.method).toBe('GET');
    req.flush({ balance: 5000, currency: 'USD' });

    // Trigger change detection again to update the DOM with HTTP data
    fixture.detectChanges();

    const balanceElement = fixture.nativeElement.querySelector('.balance');
    expect(balanceElement.textContent).toContain('$5,000.00');
  });
});
```

### Modern Playwright E2E Test

```typescript
// e2e/transfer.spec.ts
import { test, expect } from '@playwright/test';

test('completes an enterprise money transfer', async ({ page }) => {
  // Mock backend response for predictability
  await page.route('**/api/v1/transfers', async route => {
    await route.fulfill({ status: 201, json: { transferId: 'TX-999', status: 'SUCCESS' } });
  });

  await page.goto('/transfers/new');
  
  await page.getByLabel('Recipient Account').fill('987654321');
  await page.getByLabel('Amount').fill('1500');
  await page.getByRole('button', { name: 'Submit Transfer' }).click();

  await expect(page.getByText('Transfer TX-999 Successful')).toBeVisible();
});
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Modern Pattern | Legacy Pattern | Enterprise Reality |
|---|---|---|
| Playwright / Cypress | Protractor | Protractor is officially deprecated. Migrating thousands of Protractor tests to Playwright is a massive, ongoing effort in enterprise codebases. |
| Jest / Vitest | Karma + Jasmine | Many legacy projects still run Karma (which requires a real browser instance). Migrating to Jest or Vitest provides huge speed improvements and headless native execution. |
| `fixture.componentRef.setInput()` | `component.myInput = value;` | Legacy components using `@Input()` had properties mutated directly, which bypasses `ngOnChanges` unless manually called. Modern `setInput()` correctly triggers lifecycle hooks. |
| Functional Interceptors | Class-based Interceptors | Testing legacy class-based interceptors required complex module setups. Functional interceptors can be unit-tested directly as plain functions passing mock `HttpRequest` and `HttpHandler` arguments. |

---

## 7. PRACTICAL EXAMPLE

**Scenario**: Testing a complex Reactive Form validation.

```typescript
describe('TransferFormComponent', () => {
  // Setup omitted for brevity...
  
  it('should invalidate form if amount exceeds daily limit (async validation)', async () => {
    fixture.detectChanges(); // Init form
    
    const amountControl = component.transferForm.get('amount');
    amountControl?.setValue(50000);
    
    // Because async validators return observables, we wait
    await fixture.whenStable();
    fixture.detectChanges();

    expect(amountControl?.errors?.['exceedsLimit']).toBeTruthy();
    expect(component.transferForm.valid).toBeFalse();
    
    const errorMsg = fixture.nativeElement.querySelector('.error-message');
    expect(errorMsg.textContent).toContain('Amount exceeds daily limit');
  });
});
```

---

## 8. COMMON MISTAKES

1. **Testing Implementation Details**: Asserting that `myService.calculate()` was called instead of asserting that the DOM displays the correct calculated value. This leads to brittle tests that break upon refactoring.
2. **Vanity Code Coverage**: Writing tests with no `expect()` assertions just to hit the lines of code and satisfy SonarQube's 80% coverage gate.
3. **Overusing `TestBed`**: Putting simple, pure utility functions or pure services into `TestBed`. Just instantiate them with `new MyService()` for 10x faster execution.
4. **Mocking Too Much in E2E**: An E2E test that mocks the entire backend is just a slow integration test. True E2E tests should hit a real database (or isolated container instance).
5. **Dangling Subscriptions in Tests**: Not verifying outstanding HTTP requests with `httpTesting.verify()` can cause tests to bleed state into one another, resulting in flaky builds.

---

## 9. LOCAL ISSUES

- **Symptom**: `1 timer(s) still in the queue.` error when running tests.
- **Root Cause**: You used `fakeAsync` in a test where a component initiates a `setInterval` or `setTimeout`, but you forgot to clear the timer before the test ended.
- **Fix**: Use `discardPeriodicTasks()` or `flush()` at the end of your `fakeAsync` block to clear the queue, or explicitly `clearInterval` in your component's `ngOnDestroy`.

---

## 10. CI/CD ISSUES

- **Symptom**: Tests pass locally but fail in the Jenkins/GitHub Actions pipeline (Flaky Tests).
- **Root Cause**: Timing differences. The local machine is fast, so DOM updates finish instantly. The CI runner is constrained on CPU, so `await fixture.whenStable()` might time out, or animations/change detection might take longer.
- **Fix**: Never use `setTimeout` with arbitrary delays (like `setTimeout(..., 500)`) in tests. Use deterministic waits: `fixture.detectChanges()`, `whenStable()`, or Playwright's auto-retrying assertions (`expect(locator).toBeVisible()`).

---

## 11. PRODUCTION ISSUES

- **Symptom**: A bug reaches production despite 95% unit test coverage.
- **Root Cause**: The mock data in the Angular tests was perfectly valid, but the Spring Boot backend actually changed the DTO structure (e.g., changing `userId` to `user_id`). The Angular unit tests mocked the *old* shape, so they passed.
- **Fix**: Contract testing! The boundary between UI and API is the highest risk area. Generate TypeScript interfaces directly from the Spring Boot OpenAPI spec, and fail the build if the contract changes.

---

## 12. FULL-STACK INTERACTION

### Test-Layer Decision Framework

| Scenario | Where to Test? | Tool | Reason |
|---|---|---|---|
| Does the pipe correctly format a currency? | Unit Test | Vitest/Jest (No TestBed) | Pure logic, fastest execution, no DOM needed. |
| Does clicking "Save" disable the button and show a spinner? | Component Test | TestBed | Verifies DOM interaction and component state synchronization. |
| Does the AuthInterceptor attach the JWT token to requests? | Integration Test | `HttpTestingController` | Requires the HttpClient pipeline to execute fully. |
| Does the Spring Boot `/api/transfer` endpoint reject negative amounts? | Backend Integration | `@SpringBootTest` + `MockMvc` | Validates Spring Validation and HTTP layer binding. |
| Does the frontend properly display the backend's specific 400 Error format? | Contract / Mock Test | Pact / MSW | Verifies the agreed-upon data shape between teams. |
| Can a user log in, view their balance, and make a transfer? | E2E Test | Playwright | Validates the complete integrated system architecture. |

---

## 13. DEBUGGING PROCESS

**Scenario**: A Component test is failing with "Expected element to have text 'Active', but got ''".

1. **Check Change Detection**: Did you call `fixture.detectChanges()` after updating the input or state? Angular requires explicit instructions to update the DOM in tests.
2. **Check Async Tasks**: If the data comes from an async operation, did you use `fakeAsync` + `tick()` or `await fixture.whenStable()` before asserting?
3. **Inspect the DOM**: Log `console.log(fixture.nativeElement.innerHTML)` just before the failing assertion to see what the DOM actually looks like at that exact millisecond.
4. **Isolate**: Use `fit()` or `it.only()` to run just the failing test and prevent other tests from bleeding state.

---

## 14. ROOT CAUSE ANALYSIS

### Why `fakeAsync` vs `async/await` Matters

Angular's `fakeAsync` patches the global JavaScript clock and Promise resolution queues.
When you call `tick(50)`, it instantly fast-forwards time by 50ms.
This makes testing `RxJS` delays (`debounceTime`, `delay`) incredibly fast and deterministic.

However, if your component uses native `async/await` (or the native `fetch` API via `withFetch()`), `fakeAsync` cannot always properly patch the native microtask queue. In modern Angular (especially zoneless or with native fetch), using `async/await` with `whenStable()` or `ComponentFixture.whenStable()` is safer and closer to actual browser behavior.

---

## 15. FIX

**Fixing a Flaky Async Test**:

```typescript
// ❌ BROKEN: Race condition, DOM might not be updated yet
it('should load data', () => {
  component.loadData(); // Returns a promise
  fixture.detectChanges();
  expect(el.textContent).toBe('Data'); // Fails 10% of the time in CI
});

// ✅ FIXED (Modern): Use async/await and whenStable
it('should load data', async () => {
  await component.loadData();
  fixture.detectChanges();
  await fixture.whenStable(); // Wait for any pending microtasks/promises
  expect(el.textContent).toBe('Data');
});
```

---

## 16. PREVENTION

1. **Strict Mocking Policies**: Use Mock Service Worker (MSW) or robust `HttpTestingController` setups. Do not allow real HTTP requests to leave the test runner.
2. **Automate Contract Validation**: Add a CI step that runs `openapi-generator-cli validate` against the Spring Boot swagger JSON before generating Angular models.
3. **Visual Regression Testing**: Use Playwright's native visual comparison (`expect(page).toHaveScreenshot()`) to prevent CSS regressions that logical tests miss.

---

## 17. MONITORING / OBSERVABILITY

- **Test Flakiness Dashboards**: Use tools like Allure Reports or GitHub Actions test analytics to identify tests that frequently fail and pass on retry. A flaky test is worse than no test because developers will learn to ignore the CI failures.
- **Coverage Trends**: Track code coverage over time. Do not enforce absolute metrics (like 100%), but alert on downward trends in business-critical modules.

---

## 18. PERFORMANCE CONSIDERATIONS

- **TestBed Reset**: `TestBed` destroys and recreates the testing module for every single `it()` block. If your `configureTestingModule` includes dozens of complex modules, your test suite will take minutes to run. Use Standalone components to import *only* what is necessary.
- **Parallel Execution**: Configure Playwright to run E2E tests fully in parallel (`fullyParallel: true`) across multiple CI workers to reduce deployment pipeline bottlenecks.

---

## 19. SECURITY CONSIDERATIONS

- **Test Secrets in Repo**: Never hardcode production passwords, API keys, or JWT tokens in your test files.
- **Mocking Security Boundaries**: If your component tests mock out the authentication service, you are completely bypassing frontend security checks. Ensure integration tests and E2E tests log in as real (test) users with explicit RBAC roles to verify authorization guards.

---

## 20. TESTING STRATEGY

The overarching enterprise strategy:
1. **Push tests downward**: 80% Unit/Component, 15% Integration, 5% E2E.
2. **Behavior over Implementation**: Test what the user (or consuming service) sees, not how it's calculated.
3. **CI Integration**: Tests must run on every PR. Flaky tests must be quarantined immediately to maintain CI trust.

---

## 21. EXERCISES

1. **Signal Input Testing**: Write a component test for a standalone component that uses a required signal input (`input.required<User>()`), updates it via `componentRef.setInput()`, and verifies the DOM updates correctly.
2. **Functional Interceptor Test**: Write a unit test (without `TestBed`) for a functional interceptor that appends an `X-Correlation-ID` header.
3. **Playwright Journey**: Write a Playwright test that intercepts a Spring Boot `/api/profile` call, mocks a 500 error, and verifies the Angular global error banner appears.

---

## 22. BREAK-AND-FIX LAB

**Lab ID**: ANG-TEST-001

**Defect Injection**:
A developer writes a search component with an RxJS `debounceTime(300)` on the search input. They write a test using standard `async/await` and `fixture.detectChanges()`, but the test immediately asserts the HTTP request.

**Reproduction**:
The test fails with `Expected one matching request for criteria "...", found none.` because the `debounceTime` hasn't elapsed.

**Diagnostic Steps**:
1. Identify that the test is executing synchronously, but the component has a 300ms async delay.
2. Observe that standard `fixture.detectChanges()` does not advance time.

**Fix**:
Wrap the test in `fakeAsync` and use `tick(300)` to simulate the passage of time deterministically.

```typescript
it('should trigger search after debounce', fakeAsync(() => {
  const input = fixture.nativeElement.querySelector('input');
  input.value = 'query';
  input.dispatchEvent(new Event('input'));
  
  // Advance the virtual clock by 300ms
  tick(300);
  
  const req = httpTesting.expectOne('/api/search?q=query');
  expect(req.request.method).toBe('GET');
}));
```

---

## 23. EXPERT QUESTIONS

**Q1: What is the architectural difference between using `fakeAsync` with `tick()` versus `waitForAsync` (or standard `async/await`)? When would `fakeAsync` fail?**
*Answer*: `fakeAsync` patches the environment to make asynchronous operations (timers, promises, RxJS schedulers) execute deterministically and synchronously on a virtual clock. `waitForAsync` or `async/await` rely on the actual browser/Node microtask queue. `fakeAsync` fails when the code relies on native implementations that cannot be patched by Zone.js, such as modern native `fetch` (often used with `withFetch()` in Angular) or native `async/await` in some compilation targets, resulting in unresolved promises in the virtual queue.

**Q2: In an enterprise setting, how do you prevent the "TestBed bloat" problem where testing a single component requires mocking 20 unrelated services?**
*Answer*: TestBed bloat indicates poor component architecture (violating Single Responsibility Principle) or relying heavily on deeply nested NgModules. The solution is migrating to Standalone components to strictly control imports, utilizing the "Smart/Dumb" (Container/Presenter) component pattern to push complex DI out of visual components, and using lightweight mock provider libraries or Angular's `MockProvider` utilities to provide automatic stubs.

**Q3: How do Consumer-Driven Contract Tests (e.g., Pact) differ from standard E2E testing, and why are they cheaper?**
*Answer*: E2E tests spin up both the real frontend and real backend (and database) and run them together, which is slow, brittle, and stateful. Contract tests define the expected HTTP interactions (the "contract") in an isolated format. The frontend is tested quickly against a mock server generated from the contract. The backend is tested quickly by replaying the contract requests against its API. They are cheaper because they run entirely in isolation as unit/integration tests without requiring full-stack orchestration, yet they guarantee API compatibility.
