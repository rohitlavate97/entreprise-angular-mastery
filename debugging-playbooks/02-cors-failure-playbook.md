# Playbook 02: CORS Preflight & Authorization Failures

> **Severity:** P1 | **Domain:** Network / Browser Security / Spring Security 6+

---

## 1. 🔍 Symptoms
- Console displays: `Access to XMLHttpRequest at 'http://backend:8080/api/...' from origin 'http://localhost:4200' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.`
- Request works perfectly in Postman / cURL, but fails in Chrome / Firefox!
- HTTP Status is 401, 403, or `(canceled)` on the preflight `OPTIONS` request.

---

## 2. 📋 5-Step Diagnostic Protocol

1. **Step 1: Understand Postman vs Browser Difference**
   - Postman is a backend testing client; it ignores CORS because CORS is a **Browser Security Standard** implemented to prevent malicious cross-origin scripts.

2. **Step 2: Inspect the Preflight `OPTIONS` Request in Network Tab**
   - Filter Network Tab by `OPTIONS`.
   - Check status code: If 401 or 403, **Spring Security is intercepting the OPTIONS request before the CORS filter evaluates!**

3. **Step 3: Check Spring Security 6+ Filter Order**
   - Ensure `http.cors(...)` is applied BEFORE `http.authorizeHttpRequests(...)`.
   - Ensure `requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()` is explicitly configured.

4. **Step 4: Check Allowed Origins with Credentials**
   - If Angular uses `withCredentials: true` (or sends cookies/Authorization headers), Spring Boot CANNOT use wildcard `allowedOrigins("*")`.
   - Must use `allowedOrigins("http://localhost:4200")` or `allowedOriginPatterns("https://*.enterprise.com")` with `allowCredentials(true)`.

5. **Step 5: Check Nginx Proxy Layer**
   - If Nginx sits between Angular and Spring Boot, verify Nginx is not stripping `Origin` or adding duplicate `Access-Control-Allow-Origin` headers.

---

## 3. 🛠️ Root Cause & Solutions

### Spring Boot 3.4+ Security Fix
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http, CorsConfigurationSource corsSource) throws Exception {
    return http
        // 1. MUST apply CORS before security rules
        .cors(cors -> cors.configurationSource(corsSource))
        .csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(auth -> auth
            // 2. MUST permit all OPTIONS preflights unconditionally
            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            .requestMatchers("/api/v1/auth/**").permitAll()
            .anyRequest().authenticated()
        )
        .build();
}

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:4200"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-ID", "Accept"));
    config.setExposedHeaders(List.of("X-Request-ID", "Authorization"));
    config.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```
