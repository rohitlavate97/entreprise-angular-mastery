package com.enterprise.mastery;

import com.enterprise.mastery.core.error.ApiErrorResponse;
import com.enterprise.mastery.dto.UserCreateRequest;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class GlobalExceptionHandlerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    @DisplayName("Should return 404 with standardized ApiErrorResponse envelope when resource does not exist")
    void shouldReturn404ErrorEnvelope() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/users/999999"))
                .andExpect(status().isNotFound())
                .andReturn();

        ApiErrorResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), ApiErrorResponse.class);

        assertEquals(404, response.getStatus());
        assertEquals("RESOURCE_NOT_FOUND", response.getErrorCode());
        assertNotNull(response.getTimestamp());
        assertNotNull(response.getTraceId());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    @DisplayName("Should return 400 with fieldErrors list when Bean Validation fails")
    void shouldReturn400ValidationErrorsEnvelope() throws Exception {
        UserCreateRequest invalidRequest = UserCreateRequest.builder()
                .username("") // invalid blank
                .email("not-an-email") // invalid email
                .password("123") // too short
                .build();

        MvcResult result = mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andReturn();

        ApiErrorResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), ApiErrorResponse.class);

        assertEquals(400, response.getStatus());
        assertEquals("VALIDATION_FAILED", response.getErrorCode());
        assertNotNull(response.getFieldErrors());
        assertTrue(response.getFieldErrors().size() >= 3);
    }
}
