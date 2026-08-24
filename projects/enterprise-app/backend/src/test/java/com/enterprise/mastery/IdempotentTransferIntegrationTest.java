package com.enterprise.mastery;

import com.enterprise.mastery.dto.TransferRequest;
import com.enterprise.mastery.dto.TransferResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class IdempotentTransferIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    @DisplayName("Should return identical transaction response and prevent duplicate transfer execution when repeating X-Idempotency-Key")
    void shouldPreventDuplicateTransfersWithSameIdempotencyKey() throws Exception {
        String idempotencyKey = UUID.randomUUID().toString();

        TransferRequest request = TransferRequest.builder()
                .sourceAccount("US89370400440532013000")
                .targetAccount("GB29NWBK60161331926819")
                .amount(new BigDecimal("500.00"))
                .currency("USD")
                .description("Automated Idempotency Test")
                .build();

        // First Transfer Execution
        MvcResult firstResult = mockMvc.perform(post("/api/v1/transfers")
                        .header("X-Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        TransferResponse firstResponse = objectMapper.readValue(
                firstResult.getResponse().getContentAsString(), TransferResponse.class);

        // Immediate Second Execution (Duplicate Click Simulation)
        MvcResult secondResult = mockMvc.perform(post("/api/v1/transfers")
                        .header("X-Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        TransferResponse secondResponse = objectMapper.readValue(
                secondResult.getResponse().getContentAsString(), TransferResponse.class);

        // Assert that both responses return the EXACT same transaction reference ID (Deduplication verified!)
        assertEquals(firstResponse.getReferenceId(), secondResponse.getReferenceId());
        assertEquals(firstResponse.getId(), secondResponse.getId());
    }
}
