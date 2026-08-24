package com.enterprise.mastery.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransferResponse {
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private Long id; // Serialized as String to prevent IEEE-754 precision loss in JS!
    private String referenceId;
    private String sourceAccount;
    private String targetAccount;
    private BigDecimal amount;
    private String currency;
    private String status;
    private String description;
    private String idempotencyKey;
    private Instant createdAt;
}
