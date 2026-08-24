package com.enterprise.mastery.api;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
public class HealthCheckController {

    @GetMapping("/ping")
    public ResponseEntity<HealthStatusDto> ping() {
        return ResponseEntity.ok(HealthStatusDto.builder()
                .status("UP")
                .service("enterprise-backend")
                .version("1.0.0")
                .timestamp(Instant.now())
                .details(Map.of(
                        "environment", "development",
                        "database", "connected",
                        "authStrategy", "stateless-jwt"
                ))
                .build());
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HealthStatusDto {
        private String status;
        private String service;
        private String version;
        private Instant timestamp;
        private Map<String, Object> details;
    }
}
