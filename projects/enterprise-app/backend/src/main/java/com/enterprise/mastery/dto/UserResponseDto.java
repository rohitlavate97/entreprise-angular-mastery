package com.enterprise.mastery.dto;

import com.enterprise.mastery.domain.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponseDto {
    private Long id;
    private String username;
    private String email;
    private Set<Role> roles;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;
}
