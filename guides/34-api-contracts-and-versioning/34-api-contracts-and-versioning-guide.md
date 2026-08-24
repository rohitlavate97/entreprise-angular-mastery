# Module 34: API Contracts and Versioning

---

## 1. WHAT
API Contracts and Versioning refer to the formal agreements—typically expressed in JSON schemas or OpenAPI specifications—that govern data exchange between the Angular frontend and Spring Boot backend, and the strategies (DTOs, versioning, contract testing) used to ensure backward compatibility and type safety across this critical boundary.

---

## 2. WHY
- **The Most Important Boundary**: The network boundary where Java DTOs serialize to JSON and deserialize into TypeScript models is the single highest-risk point of failure in full-stack applications.
- **Silent Failures**: A mismatch here rarely throws a loud compile-time error. Instead, the UI silently displays `undefined`, or a precision loss corrupts an ID, resulting in data loss or corrupted state.
- **Independent Deployments**: In a microservice or decoupling strategy, frontends and backends are deployed independently. Breaking a contract causes immediate production outages unless strict backward-compatibility rules are enforced.
- **Polyglot Disconnect**: Java (strongly-typed, 64-bit Longs, exact BigDecimals, strict Enums) operates very differently than JavaScript/TypeScript (duck-typed, IEEE 754 floating-point numbers, loosely checked optionality).

---

## 3. INTERNAL MENTAL MODEL

### The Full-Stack Contract Boundary

```text
+===========================================================================================+
|                            THE CONTRACT BOUNDARY                                          |
|                                                                                           |
|  ┌───────────────────────┐            ┌────────────────┐            ┌──────────────────┐  |
|  │                       │            │                │            │                  │  |
|  │  SPRING BOOT (Java)   │            │   NETWORK      │            │ANGULAR (TS/JS)   │  |
|  │                       │            │                │            │                  │  |
|  │  public class User {  │ Jackson    │  {             │ JSON.parse │  interface User {|  |
|  │    private Long id;   ├───────────►│    "id": 123,  ├───────────►│    id: number;   │  |
|  │    private String fn; │ Serialize  │    "fn": "Bob" │Deserialize │    fn: string;   │  |
|  │  }                    │            │  }             │            │  }               │  |
|  │                       │            │                │            │                  │  |
|  └───────────────────────┘            └────────────────┘            └──────────────────┘  |
|                                                                                           |
|  Strict Types                 ◄─────  Untyped Text  ─────►          Duck Typed            |
|  64-bit Integer Limits        ◄─────  No Int Type   ─────►          53-bit Safe Limits    |
|  UTC ZonedDateTime            ◄─────  ISO 8601      ─────►          Browser Local Time    |
+===========================================================================================+
```

---

## 4. HOW IT WORKS

1. **Spring Boot (Producer)**: A `@RestController` method returns a Java DTO. The framework uses a message converter (Jackson) to introspect the object and serialize it into a JSON string based on annotations (`@JsonProperty`, `@JsonFormat`) and naming strategies.
2. **Network (Transport)**: The JSON string is transmitted over HTTP.
3. **Angular (Consumer)**: The `HttpClient` receives the string, calls `JSON.parse()`, and returns a JavaScript object. TypeScript *assumes* this object conforms to the generic interface provided (e.g., `http.get<UserDto>()`), but performs **no runtime validation**.
4. **Contract Testing**: Tools like Pact or OpenAPI validation sit in the middle during CI/CD to mathematically prove that what Spring Boot generates exactly matches what Angular expects.

---

## 5. MODERN IMPLEMENTATION

### OpenAPI-First Contract Generation

```yaml
# contract.yaml (OpenAPI 3.0)
components:
  schemas:
    AccountDto:
      type: object
      required:
        - id
        - balance
      properties:
        id:
          type: string # ID mapped to string to prevent Long precision loss
          format: uuid
        balance:
          type: string # BigDecimal mapped to string
        status:
          type: string
          enum: [ACTIVE, CLOSED, SUSPENDED]
```

### Spring Boot DTO (Generated or Manual)

```java
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.UUID;

public record AccountDto(
    @JsonProperty("id") UUID id,
    
    // Explicit string serialization for arbitrary precision
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    @JsonProperty("balance") BigDecimal balance,
    
    @JsonProperty("status") AccountStatus status
) {}
```

### Angular TypeScript Interface (Generated or Manual)

```typescript
export interface AccountDto {
    readonly id: string;
    readonly balance: string; // Stays string to prevent float math errors
    readonly status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
}
```

---

## 6. LEGACY / ENTERPRISE REALITY

| Modern Pattern | Legacy Pattern | Enterprise Reality |
|---|---|---|
| OpenAPI generation | Manual DTO synchronization | Many codebases rely on devs manually keeping Java and TS in sync. This results in "drift" over time where TS interfaces no longer reflect reality. |
| API Versioning in Header/Path (`/v2/api`) | Breaking changes in `/api` | Legacy apps often deployed Frontend and Backend simultaneously in a monolith, meaning contracts could break freely. Independent microservice deployments prohibit this. |
| Dedicated API DTO layer | Returning JPA Entities | Legacy Spring Boot apps often returned `@Entity` objects directly from controllers, exposing database schema to the UI, causing infinite recursion (`@JsonIgnore` hell), and accidentally leaking passwords. |

---

## 7. PRACTICAL EXAMPLE

**Scenario**: Evolving a Banking API safely.

**V1 Contract**:
```json
{ "userId": "123", "name": "John Doe" }
```

**Business Requirement**: Split `name` into `firstName` and `lastName`.

**Unsafe Evolution (Breaks Angular V1):**
```json
{ "userId": "123", "firstName": "John", "lastName": "Doe" }
```
Angular code `user.name.toUpperCase()` throws `TypeError: Cannot read properties of undefined (reading 'toUpperCase')`.

**Safe Evolution (Backward Compatible):**
```java
public record UserDto(
    String userId,
    @Deprecated String name, // Keep for old clients
    String firstName,
    String lastName
) {
    public static UserDto fromEntity(User user) {
        return new UserDto(
            user.getId(),
            user.getFirstName() + " " + user.getLastName(), // Legacy field populated
            user.getFirstName(),
            user.getLastName()
        );
    }
}
```
Deploy the backend. Then update Angular to use `firstName` and `lastName`. Then deploy Angular. Finally, wait a week and remove `name` from the backend.

---

## 8. COMMON MISTAKES: THE 11 CONTRACT MISMATCH SCENARIOS

### 1. Field Name Difference (camelCase vs snake_case)
- **Symptom**: Angular expects `userId`, but the JSON contains `user_id`. Angular renders `undefined`.
- **Root Cause**: Spring Boot's Jackson is configured with `PropertyNamingStrategies.SNAKE_CASE`, but TypeScript assumes `camelCase`.
- **Fix**: Align Jackson config, or use `@JsonProperty("user_id")` on Java, and match it in TS interface.

### 2. Java Long Precision Loss in JavaScript
- **Symptom**: An ID of `9007199254740993` in the DB arrives in Angular as `9007199254740992`.
- **Root Cause**: Java `Long` goes up to 2^63. JavaScript numbers are IEEE-754 floats with a max safe integer of `Number.MAX_SAFE_INTEGER` (2^53 - 1). The browser silently rounds the number during `JSON.parse()`.
- **Fix**: Annotate Java Long IDs with `@JsonFormat(shape = JsonFormat.Shape.STRING)` to send them as strings, or change the API to return UUID strings instead of sequential IDs.

### 3. BigDecimal Serialized as String vs Number
- **Symptom**: Financial values show rounding errors in the UI (`0.1 + 0.2 = 0.30000000000000004`).
- **Root Cause**: Sending `BigDecimal` as a raw JSON number forces `JSON.parse()` to evaluate it as a float, losing precision.
- **Fix**: Serialize `BigDecimal` as a String in Java. Use a specialized arbitrary-precision library like `big.js` or `decimal.js` on the Angular side if math is required, otherwise just display the string.

### 4. LocalDate Format Mismatch
- **Symptom**: `Failed to deserialize java.time.LocalDate` in Spring Boot logs, or Angular shows "Invalid Date".
- **Root Cause**: Jackson might serialize a date as `[2024, 5, 23]` (array) or a weird custom string. Angular expects ISO 8601 (`"2024-05-23"`).
- **Fix**: Ensure `JavaTimeModule` is registered in Jackson and use `@JsonFormat(pattern = "yyyy-MM-dd")`.

### 5. LocalDateTime Timezone Confusion
- **Symptom**: An event created for 9:00 AM shows up as 4:00 AM or 2:00 PM for different users.
- **Root Cause**: `LocalDateTime` has no timezone context. If serialized to the browser, the browser assumes it's UTC (or local) arbitrarily.
- **Fix**: **Never use `LocalDateTime` in APIs.** Always use `ZonedDateTime` or `Instant` in Java, and ISO 8601 UTC strings (`"2024-05-23T14:00:00Z"`) over the wire. Angular's `DatePipe` will automatically localize it for the user's browser timezone.

### 6. null vs undefined Behavior Difference
- **Symptom**: Angular sends `{ "description": undefined }` (which `JSON.stringify` completely drops). Spring Boot assumes the field wasn't updated, but the user wanted to clear it.
- **Root Cause**: JSON does not support `undefined`.
- **Fix**: Explicitly send `null` from Angular when clearing a field. Distinguish between omitted fields (no update) and `null` fields (clear value) in Java using `Optional<String>`.

### 7. Optional Field Missing Entirely vs null
- **Symptom**: TypeScript interface says `middleName: string;`. Backend omits the field entirely. UI throws an error.
- **Root Cause**: TypeScript assumes non-optional fields are ALWAYS present.
- **Fix**: If a field can be missing from the JSON, mark it optional in TS: `middleName?: string;`.

### 8. Enum Value Mismatch
- **Symptom**: Spring Boot throws a 400 Bad Request: `Cannot deserialize value of type Status`.
- **Root Cause**: Java Enum `PENDING_APPROVAL` vs TS expecting `"pendingApproval"`.
- **Fix**: Standardize on `UPPER_SNAKE_CASE` for Enums in both systems to match Java's default serialization.

### 9. Array vs Single Object (One Result)
- **Symptom**: Angular `http.get<User[]>()` fails with `.map is not a function`.
- **Root Cause**: If an XML/JSON converter (or legacy backend) returns an object when 1 result exists, but an array when >1 exist.
- **Fix**: Ensure Spring Boot always returns `List<User>` (which Jackson strictly serializes as a JSON array `[]`, even if empty or size 1).

### 10. Extra Backend Fields Angular Didn't Expect
- **Symptom**: No immediate error, but payload sizes are massively bloated.
- **Root Cause**: Backend returns a 150-field entity. Angular TS interface only maps 3 fields. The browser still downloads all 150 fields over the network.
- **Fix**: Implement dedicated DTOs in Spring Boot that contain *only* the fields requested by the specific UI view.

### 11. Removed Backend Fields Angular Still Reads
- **Symptom**: Silent `undefined` in UI.
- **Root Cause**: Backend deletes a field. Angular interface wasn't updated. `JSON.parse` doesn't care.
- **Fix**: Contract testing.

---

## 9. LOCAL ISSUES

- **Symptom**: `TypeError: Cannot read properties of undefined` deep in a component.
- **Root Cause**: Developers mock HTTP responses in local unit tests perfectly according to the TypeScript interface, but the actual Spring Boot response differs.
- **Fix**: Do not manually craft mock objects. Generate mock fixtures directly from the OpenAPI spec, or capture them from real backend integration tests.

---

## 10. CI/CD ISSUES

- **Symptom**: Pipeline fails at the "Pact Verification" step.
- **Root Cause**: The Angular team added a required field to their consumer contract expectations. The Spring Boot provider tests ran against this new contract and failed because the controller doesn't output that field yet.
- **Fix**: This is a *good* failure. It prevented a production incident. The backend must deploy the new field before the frontend depends on it.

---

## 11. PRODUCTION ISSUES

- **Symptom**: 500 Internal Server Error when Angular sends a POST request.
- **Root Cause**: The backend added a new `@NotNull` field to the DTO without a default value. The frontend hasn't been updated to send it yet.
- **Fix**: API evolution rule: **Never add a required input field in a non-breaking version.** Always add it as optional, configure a default backend value, update the frontend to send it, and then (optionally) make it required in a later major version.

---

## 12. FULL-STACK INTERACTION

### The Evolution Dance (Zero Downtime Deployment)

When deploying breaking contract changes, you must follow the expand/contract pattern:

1. **Phase 1: Expand (Backend)**: Add new fields/endpoints. Keep the old ones. Deploy backend.
2. **Phase 2: Migrate (Frontend)**: Update Angular to use the new fields/endpoints. Stop reading/sending the old ones. Deploy frontend.
3. **Phase 3: Contract (Backend)**: Delete the old fields/endpoints from Spring Boot. Deploy backend.

If you attempt Phase 1 and 3 at the same time, the old frontend running in the user's browser will fail until they refresh the page.

---

## 13. DEBUGGING PROCESS

**Scenario**: Account ID in URL doesn't match the database when navigating.

1. **Check the Network Tab**: Look at the raw JSON response from Spring Boot.
   - Raw JSON: `"id": 9007199254740993`
2. **Check the Console / State**: Log the ID inside Angular.
   - Console: `9007199254740992`
3. **Identify the Delta**: The numbers don't match. It's an off-by-one error on a massive integer.
4. **Conclusion**: Java `Long` precision loss during JS IEEE-754 conversion.

---

## 14. ROOT CAUSE ANALYSIS

### Why TypeScript Interfaces Don't Protect You

TypeScript is erased at compile time. At runtime, Angular's `HttpClient.get<User>()` translates to a raw `fetch` or `XHR`. The `<User>` generic type parameter is discarded. 

If Spring Boot sends `{"name": "Alice"}`, but your TS interface says `interface User { firstName: string }`, the `HttpClient` happily returns the object. Your code then says `user.firstName.toLowerCase()`, which throws `undefined is not an object` at runtime.

To achieve true runtime safety, you must use a schema validation library (like Zod) on the Angular side to parse and validate the JSON payload at runtime, though this incurs a performance penalty.

---

## 15. FIX

**Fixing the Long Precision Loss**:

In Spring Boot:
```java
public record TransactionDto(
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Long transactionId, // Will serialize as "9007199254740993"
    BigDecimal amount
) {}
```

In Angular:
```typescript
export interface TransactionDto {
    transactionId: string; // Treat as an opaque string
    amount: number;
}
```

---

## 16. PREVENTION

1. **Branded Types in TypeScript**: Prevent developers from accidentally performing math on IDs or mixing up User IDs and Account IDs.
   ```typescript
   export type UserId = string & { readonly __brand: unique symbol };
   export type AccountId = string & { readonly __brand: unique symbol };
   ```
2. **Strict Null Checks**: Enable `strictNullChecks` in `tsconfig.json`.
3. **OpenAPI Generator**: Automate the creation of TS interfaces and Angular Services using `openapi-generator-cli`. Do not write them by hand.

---

## 17. MONITORING / OBSERVABILITY

- **Deserialization Error Tracking**: In Spring Boot, log `HttpMessageNotReadableException`. A spike in these errors indicates a deployed frontend is sending incompatible payloads.
- **Frontend Error Boundaries**: Use Global Error Handlers in Angular linked to Sentry to track `TypeError` exceptions caused by missing fields.

---

## 18. PERFORMANCE CONSIDERATIONS

- **Over-fetching**: Returning massive JPA entities wrapped as JSON bloats network transfer, slows down `JSON.parse()`, and consumes excess memory on mobile devices. Tailor DTOs tightly to the UI view.
- **Zod Validation Overhead**: Validating massive arrays of objects at runtime using Zod or Joi on the frontend guarantees contract safety but blocks the main thread. Apply runtime validation selectively to critical payloads.

---

## 19. SECURITY CONSIDERATIONS

- **Mass Assignment Vulnerabilities**: If a Spring Boot controller accepts a JPA `@Entity` directly as the `@RequestBody`, an attacker can send `{"id": 1, "role": "ADMIN"}` and accidentally overwrite restricted database columns. **ALWAYS use dedicated DTOs for inbound data.**
- **Information Leakage**: Using `@JsonIgnore` on an entity password field is brittle. If someone accidentally removes the annotation, all passwords leak via the API. Again, use isolated output DTOs.

---

## 20. TESTING STRATEGY

- **Consumer-Driven Contracts (Pact)**: 
  - Angular writes a test specifying exactly what JSON it expects. This generates a "Pact file".
  - Spring Boot downloads the Pact file during CI and runs a test verifying its controllers produce exactly that JSON.
  - Deployment is blocked if the verification fails.
- **DTO Unit Testing**: Write `@JsonTest` slices in Spring Boot to assert that complex DTOs serialize specifically to the expected JSON string structure (e.g., verifying date formats).

---

## 21. EXERCISES

1. **Long Precision Fix**: Modify a Spring Boot entity containing a large primary key sequence to serialize as a string using `@JsonFormat`. Update the corresponding Angular interface and service to handle it as a string.
2. **Expand/Contract Pattern**: Simulate a business requirement to rename `amount` to `transferAmount`. Write the Java code for the intermediate state that supports both fields simultaneously.
3. **Zod Parsing**: Write an Angular service interceptor that uses Zod to validate an incoming HTTP response against a defined schema, throwing a custom application error if the contract is violated.

---

## 22. BREAK-AND-FIX LAB

**Lab ID**: FS-CONTRACT-001

**Defect Injection**:
A Spring Boot endpoint returns an `Account` with a generated ID of `9007199254740993` (Long). The Angular UI lists the accounts and provides a "Delete" button. 

**Reproduction**:
1. User clicks "Delete" on the account.
2. The Angular app sends `DELETE /api/accounts/9007199254740992`.
3. The backend returns 404 Not Found (or worse, deletes the wrong account).

**Diagnostic Steps**:
1. Open Chrome DevTools > Network tab. Inspect the initial GET request.
2. Notice the raw JSON has `"id": 9007199254740993` (no quotes around the number).
3. Inspect the Angular Component state in Angular DevTools. The ID is `9007199254740992`.
4. The truncation happened exactly at the `JSON.parse()` boundary in the browser.

**Fix**:
Apply `@JsonFormat(shape = JsonFormat.Shape.STRING)` to the ID in the Spring Boot DTO.
Change the TypeScript interface to `id: string`.
Update the HTTP DELETE call to use string concatenation.

---

## 23. EXPERT QUESTIONS

**Q1: Explain the concept of "Consumer-Driven Contract Testing" versus "Schema Validation". Why is OpenAPI validation alone sometimes insufficient for preventing production breakages?**
*Answer*: Schema validation (OpenAPI) proves that a provider produces valid output according to a spec, but it doesn't prove that the consumer is actively requesting or relying on that specific version of the spec. Consumer-Driven Contracts (like Pact) record the *exact expectations* of the consumer and force the provider to verify against those expectations. If a provider removes an optional field from OpenAPI, schema validation passes, but if the consumer actually needed that optional field, the system breaks. Pact catches this.

**Q2: How do you handle polymorphic JSON serialization/deserialization across the Java/TypeScript boundary (e.g., returning different subtypes of `Notification` in a single list)?**
*Answer*: In Spring Boot, use Jackson's `@JsonTypeInfo` and `@JsonSubTypes` to inject a discriminator field (e.g., `type: 'EMAIL' | 'SMS'`). In Angular, use TypeScript Discriminated Unions on the interface, matching that exact discriminator field. This allows the TypeScript compiler to narrow the type correctly within `switch` statements or `@if` blocks based on the discriminator.

**Q3: Why should you never use `LocalDateTime` in a REST API, and how exactly do `ZonedDateTime` and `Instant` differ when serialized over the wire?**
*Answer*: `LocalDateTime` lacks a timezone offset; when a browser parses "2024-01-01T10:00:00", it arbitrarily assumes local time or UTC based on the parser, causing severe synchronization bugs. You must include an offset. `Instant` serializes as a fixed point in UTC (e.g., "2024-01-01T10:00:00Z"). `ZonedDateTime` serializes with the offset and region (e.g., "2024-01-01T10:00:00+02:00[Europe/Paris]"). Use `Instant` for absolute timestamps (like `createdAt`), and `ZonedDateTime` when future regional rules matter (like a recurring meeting in a timezone with changing DST).
