# Module 05: Components and Templates — Signal APIs, Projection, and Lifecycle

## 1. WHAT
Components and templates are the foundational building blocks of an Angular application, tightly coupling UI structure with declarative rendering logic, leveraging Signal-based APIs (inputs, outputs, model, and queries) to achieve reactive, fine-grained change detection.

## 2. WHY
Modern enterprise applications require modular, reusable, and encapsulated UI components that communicate efficiently and deterministically. Signal-based component APIs eliminate the reliance on deeply nested RxJS subscriptions for synchronous UI state and remove the unpredictable nature of Zone.js monkey-patching, offering a strict reactive data flow directly integrated into Angular's rendering engine.

## 3. INTERNAL MENTAL MODEL

```text
[Parent Component (Producer)] -> Template Binding `[data]="mySignal()"` -> [Child Component]
                                                                                  |
    +-----------------------------------------------------------------------------+
    | Child Component Encapsulation
    |
    |  [Signal Input] `data = input<T>()` 
    |        | (derived computed / effect bindings)
    |        v
    |  [Template View] `<div *ngIf="data()">...</div>`
    |
    |  [Signal Query] `chart = viewChild(ChartComponent)` --> Points to View Element
    |
    |  [Content Projection] `<ng-content select="[header]"></ng-content>`
    |
    |  [Signal Output] `statusChange = output<Status>()` --> Emits up to Parent
    +-----------------------------------------------------------------------------+
                                                                                  |
[Parent Component] <- Template Event `(statusChange)="handle($event)"` <----------+
```

## 4. HOW IT WORKS
1. **Creation**: The framework instantiates the component class.
2. **Signal Wiring**: `input()`, `model()`, `viewChild()`, and `contentChild()` functions return reactive signals immediately, reflecting the bound values from the parent or template.
3. **Projection**: `ng-content` evaluates multi-slot selectors and dynamically projects light DOM content into the shadow-like component view.
   ```text
   [Parent Template]                             [Child Component View]
   <app-card>
     <div header>Title</div>   ==============>   <ng-content select="[header]"></ng-content>
     <p>Body content</p>       ==============>   <ng-content></ng-content> (Default Slot)
   </app-card>
   ```
4. **Rendering**: The template is rendered. Signal accesses inside the template create implicit dependencies.
5. **Lifecycle**: New hooks (`afterRender`, `afterNextRender`) and signal effects (`effect`) react to DOM changes and signal updates. Output emitters (`output()`) push events upward.
6. **Dynamic Rendering**: `ViewContainerRef` allows components to be instantiated dynamically at runtime, bypassing static template declarations.

## 5. MODERN IMPLEMENTATION
Angular 19+ standardizes on standalone components, Signal inputs/outputs, and functional APIs.

```typescript
import { Component, input, output, model, viewChild, afterNextRender, ElementRef, ViewContainerRef, Type, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dynamic-widget',
  standalone: true,
  template: `<p>Dynamic Content Loaded</p>`
})
export class DynamicWidgetComponent {}

@Component({
  selector: 'app-transaction-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid-container" [class.is-loading]="isLoading()">
      <!-- Content Projection with multi-slot -->
      <ng-content select="[grid-header]"></ng-content>
      
      <table #gridTable>
        <tr *ngFor="let tx of transactions()">
          <td>{{ tx.id }}</td>
          <td>{{ tx.amount }}</td>
          <td>
            <button (click)="approve(tx)">Approve</button>
          </td>
        </tr>
      </table>

      <!-- Dynamic Component Container -->
      <ng-container #widgetContainer></ng-container>

      <!-- Two-way bound model -->
      <label>
        Rows per page: 
        <input type="number" [ngModel]="pageSize()" (ngModelChange)="pageSize.set($event)">
      </label>
    </div>
  `,
  host: {
    'role': 'grid',
    '[attr.aria-busy]': 'isLoading()'
  }
})
export class TransactionGridComponent {
  // Required Input
  accountId = input.required<string>();
  
  // Optional Input with Transform
  transactions = input<Transaction[], unknown>([], {
    transform: (value: unknown) => Array.isArray(value) ? value : []
  });

  // Model (Two-way binding)
  pageSize = model<number>(10);

  // Output
  approved = output<string>();

  // View Queries
  gridTable = viewChild<ElementRef<HTMLTableElement>>('gridTable');
  widgetContainer = viewChild('widgetContainer', { read: ViewContainerRef });

  isLoading = input<boolean>(false);

  constructor() {
    // SSR-safe DOM read
    afterNextRender(() => {
      const tableHeight = this.gridTable()?.nativeElement.clientHeight;
      console.log('Table rendered with height:', tableHeight);
    });
  }

  loadWidget() {
    const vcr = this.widgetContainer();
    if (vcr) {
      vcr.clear();
      const componentRef = vcr.createComponent(DynamicWidgetComponent);
      // In Angular 19+, use setInput to pass data dynamically
      // componentRef.setInput('data', '...');
    }
  }

  approve(tx: Transaction) {
    this.approved.emit(tx.id);
  }
}
```

## 6. LEGACY / ENTERPRISE REALITY
**Legacy Pattern:** `@Input()`, `@Output()`, `@ViewChild()`, and `ngOnChanges`.
In legacy Angular (<17), developers relied heavily on decorator metadata. Tracking input changes required implementing `OnChanges` and writing tedious `if (changes['prop'])` logic, often triggering redundant renders.

**Migration:** 
Angular CLI provides schematics (`ng generate @angular/core:signal-input-migration`) to automatically convert `@Input` to `input()`. Teams must systematically replace `ngOnChanges` with `computed()` signals or `effect()` blocks, drastically simplifying data flow.

## 7. PRACTICAL EXAMPLE
**Scenario:** A Trade Execution Dashboard in a financial application.
The `TradeTicketComponent` needs to receive the selected security (`input.required`), project custom warning banners (`ng-content`), two-way bind the quantity (`model`), and emit execution requests (`output`). The parent `TradeDashboardComponent` coordinates this and communicates with the Spring Boot backend to place the trade.

```typescript
@Component({
  selector: 'app-trade-ticket',
  standalone: true,
  template: `
    <div class="ticket-panel">
      <!-- Warning Banner Projection -->
      <ng-content select="[trade-warning]"></ng-content>
      
      <header>
        <h3>Trade: {{ security().symbol }}</h3>
        <p>Market Price: {{ security().price | currency }}</p>
      </header>

      <div class="controls">
        <label>
          Shares:
          <input type="number" [ngModel]="quantity()" (ngModelChange)="quantity.set($event)">
        </label>
        <p>Total Estimated: {{ totalCost() | currency }}</p>
      </div>

      <button [disabled]="!isValid()" (click)="execute()">Execute Trade</button>
    </div>
  `
})
export class TradeTicketComponent {
  security = input.required<SecurityDto>();
  quantity = model<number>(100);
  executeTrade = output<TradeRequestDto>();

  totalCost = computed(() => this.security().price * this.quantity());
  isValid = computed(() => this.quantity() > 0 && this.quantity() <= this.security().maxVolume);

  execute() {
    this.executeTrade.emit({
      symbol: this.security().symbol,
      shares: this.quantity(),
      orderType: 'MARKET'
    });
  }
}
```

## 8. COMMON MISTAKES
1. **Mutating Model Signals Incorrectly:** Using `model().update()` when a simple `model.set()` is appropriate, leading to unexpected reference equality checks.
2. **Overusing `effect()` instead of `computed()`:** Using effects to synchronize state back into other signals instead of deriving state immutably with `computed()`.
3. **Ignoring DOM availability in SSR:** Querying `viewChild()` and accessing its `nativeElement` in the constructor or standard effects without using `afterNextRender`, breaking Universal/SSR builds.

## 9. LOCAL ISSUES
- **Content Projection Collisions:** When using multiple `ng-content` slots, if a projected element matches multiple selectors, Angular projects it into the *first* matching slot, leaving subsequent slots empty and confusing developers.

## 10. CI/CD ISSUES
- **Type Checking Errors on Signal Transforms:** Strict template type checking (`strictTemplates: true`) will fail in CI if the `transform` function signature on an `input()` doesn't perfectly align with the bound value's type from the parent template.

## 11. PRODUCTION ISSUES
- **ExpressionChangedAfterItHasBeenCheckedError in legacy views:** While Signals mitigate this, mixing legacy `@ViewChild` static queries with new signal components can still trigger this error in production if the child view mutates parent state synchronously during rendering.

## 12. FULL-STACK INTERACTION
Component inputs often directly mirror Spring Boot API DTOs.
```java
// Spring Boot Response DTO
public record SecurityDto(String symbol, BigDecimal price, Integer maxVolume) {}
public record TradeRequestDto(String symbol, Integer shares, String orderType) {}

@RestController
@RequestMapping("/api/v1/trading")
public class TradeController {
    
    @PostMapping("/execute")
    public ResponseEntity<TradeExecutionResult> executeTrade(@Valid @RequestBody TradeRequestDto request) {
        // Business logic to execute the trade
        return ResponseEntity.ok(tradingService.execute(request));
    }
}
```
The Angular component's `input.required<SecurityDto>()` enforces that the frontend UI cannot render the component without the precise contract provided by the Spring API, ensuring strong type safety across the network boundary. The component strictly structures the `TradeRequestDto` mapping directly to the `@RequestBody` expected by the controller.

## 13. DEBUGGING PROCESS
1. **Angular DevTools:** Inspect the component tree to verify `input()` values are updating. With Signal inputs, you can see the precise value held in the signal at any given moment.
2. **Template Breakpoints:** Place a `debugger;` inside a component method triggered by the template to inspect signal values. Alternatively, drop an `@let devMode = debugger();` inside your Angular 19+ template to break precisely during rendering.
3. **Effect Logging:** Temporarily add an `effect(() => console.log(this.myInput()))` to trace when an input changes. Unlike `ngOnChanges`, effects automatically track all signals read inside them, making them highly resilient for debugging complex state graphs.
4. **Network Traces:** Use Chrome DevTools Network panel to confirm that an HTTP response has actually arrived before expecting a component to update. Often, a component appears "stuck" when in reality, the backend has not yet responded or Spring Boot returned a 500.

## 14. ROOT CAUSE ANALYSIS
**Issue:** A view query (`viewChild`) returns `undefined` intermittently.
**Root Cause:** The element being queried is inside a structural directive (like `*ngIf`). `viewChild` returns a Signal that reacts to the DOM. If the `*ngIf` evaluates to false, the signal resolves to `undefined`. Attempting to access `this.myChild()?.nativeElement` without checking for undefined causes a runtime crash.
**Deep Dive:** In the Ivy runtime, template instructions for structural directives create an embedded view. Elements inside this view do not exist in the parent's `LView` until the condition is met and the embedded view is instantiated and attached.

## 15. FIX
Make the component logic reactive to the view query signal using an effect.
```typescript
effect(() => {
  const table = this.gridTable(); // Tracks the signal dynamically
  if (table) {
    // Safely execute DOM logic when the table actually exists in the LView
    this.initializeTablePlugin(table.nativeElement);
  } else {
    // Cleanup logic if the table is removed from the DOM
    this.cleanupTablePlugin();
  }
});
```

## 16. PREVENTION
1. Enable `strictTemplates: true` and `strictNullChecks: true` in `tsconfig.json`. This forces the compiler to flag unguarded accesses to potentially `undefined` view queries and model signals.
2. Prefer `viewChild.required()` if the element is statically present in the template (not inside a structural directive), which instructs the compiler that `undefined` is impossible.
3. Establish architectural safeguards by wrapping raw DOM plugins in dedicated directive wrappers, removing the need for components to query native elements directly.

## 17. MONITORING / OBSERVABILITY
For critical component interactions (like trade executions), intercept the `output()` emissions. Bind them to a telemetry service that logs user interactions, attaching distributed trace IDs before making the HTTP call to Spring Boot, linking the UI click directly to the backend transaction.

```typescript
import { inject, effect } from '@angular/core';
import { TelemetryService } from './telemetry.service';

export class TradeTicketComponent {
  private telemetry = inject(TelemetryService);
  
  constructor() {
    effect(() => {
      // Log whenever the user changes the quantity to understand behavior
      this.telemetry.logEvent('trade_quantity_changed', { newQty: this.quantity() });
    });
  }
  
  execute() {
    const traceId = this.telemetry.generateTraceId();
    // Pass traceId along with output emission or inject the HTTP service directly
  }
}
```

## 18. PERFORMANCE CONSIDERATIONS
Signal inputs provide highly granular change detection. When an `input()` changes, only the specific template bindings relying on that signal are marked dirty, bypassing the traditional component-wide `ChangeDetectorRef.markForCheck()`. This enables near-instantaneous updates in complex enterprise data grids.
**Profiling Evidence:** In Angular DevTools Profiler, a legacy component triggering `markForCheck()` will show a full component re-render. A signal-based component with Zoneless change detection will show *only* the specific view node updating, reducing change detection overhead by up to 80% in large lists.

## 19. SECURITY CONSIDERATIONS
When using `[innerHTML]` or projecting untrusted content via `ng-content`, ensure data is sanitized. Angular's built-in `DomSanitizer` handles standard interpolations, but dynamically injecting HTML directly into a `viewChild` nativeElement bypasses these protections and opens an XSS vector. Always rely on Angular's template bindings rather than manual DOM manipulation.

## 20. TESTING STRATEGY
**Unit Test:**
Use `ComponentFixture` and `defer` block testing APIs.
```typescript
it('should emit executeTrade event', () => {
  const fixture = TestBed.createComponent(TradeTicketComponent);
  
  // Set required signal inputs via ComponentFixture
  fixture.componentRef.setInput('security', { symbol: 'AAPL', price: 150, maxVolume: 1000 });
  fixture.detectChanges();
  
  let emittedRequest: TradeRequestDto | undefined;
  fixture.componentInstance.executeTrade.subscribe(req => emittedRequest = req);
  
  // Update model signal
  fixture.componentInstance.quantity.set(200);
  fixture.detectChanges();
  
  // Trigger logic
  fixture.componentInstance.execute();
  
  expect(emittedRequest).toEqual({
    symbol: 'AAPL',
    shares: 200,
    orderType: 'MARKET'
  });
});
```

## 21. EXERCISES
1. Refactor a legacy component with `@Input`, `@Output`, and `ngOnChanges` to use `input()`, `output()`, and `computed()`.
2. Implement a generic multi-slot card component using `<ng-content select="...">`.
3. Create a directive that two-way binds to a component using `model()`.
4. Migrate an `ngAfterViewInit` hook that reads a DOM element's height into an `afterNextRender` phase hook.

## 22. BREAK-AND-FIX LAB
**Issue ANG-COMPONENTS-001:** Signal Input Sync Bug
**Context:** A user profile component updates data, but the derived full name doesn't update on the screen.
**Defect:** The developer used `effect()` to update a separate property instead of a `computed()` signal.
```typescript
// BROKEN CODE
fullName = ''; 
constructor() {
  effect(() => { this.fullName = this.firstName() + ' ' + this.lastName(); });
}
```
**Reproduction:** Update the `firstName` signal input; observe `fullName` property remains stale in the view because plain properties are not tracked by the view in Zoneless change detection.
**Fix:** Replace the effect with a computed signal.
```typescript
// FIXED CODE
fullName = computed(() => this.firstName() + ' ' + this.lastName());
```

## 23. EXPERT QUESTIONS
1. **Question:** How does the memory footprint of `input()` signals compare to `Observable`-based inputs, and how are subscriptions managed when the component is destroyed?
   *Answer:* Signal inputs do not require explicit subscription management or cleanup. They are intrinsically tied to the component's injector/node tree and are garbage collected naturally when the component is destroyed, eliminating memory leaks common with un-unsubscribed Observables.
   
2. **Question:** Explain the difference between `afterRender` and `afterNextRender` phases, and why are they critical for SSR/Hydration compared to `ngAfterViewInit`?
   *Answer:* `afterRender` runs continuously after every change detection cycle, while `afterNextRender` runs exactly once after the next cycle. Crucially, they *only execute in the browser*, completely preventing illegal DOM accesses during SSR, whereas `ngAfterViewInit` executes on both server and client.

3. **Question:** When building a generic component library, how do you handle strict type checking on multi-slot content projection fallback content?
   *Answer:* Angular's projection doesn't strongly type the projected structural DOM elements natively. You must use generic Structural Directives with structural typing context (`ngTemplateContextGuard`) combined with `contentChild(TemplateRef)` to achieve strict type safety for projected content, rather than relying on raw `ng-content`.
