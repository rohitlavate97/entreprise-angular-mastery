package com.enterprise.mastery.service;

import com.enterprise.mastery.core.error.exception.BusinessException;
import com.enterprise.mastery.core.error.exception.ResourceNotFoundException;
import com.enterprise.mastery.domain.entity.Role;
import com.enterprise.mastery.domain.entity.User;
import com.enterprise.mastery.domain.repository.UserRepository;
import com.enterprise.mastery.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public PageResponse<UserResponseDto> getUsers(
            String query,
            Role role,
            Boolean active,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {
        Sort sort = Sort.by(Sort.Direction.fromString(sortDir.toUpperCase()), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);

        // Fetch page of users
        Page<User> userPage = userRepository.findAll(pageable);

        Page<UserResponseDto> dtoPage = userPage.map(this::mapToDto);
        return PageResponse.from(dtoPage);
    }

    @Transactional(readOnly = true)
    public UserResponseDto getUserById(Long id) {
        return userRepository.findById(id)
                .map(this::mapToDto)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    @Transactional
    public UserResponseDto createUser(UserCreateRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("USERNAME_TAKEN", "Username is already taken.");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("EMAIL_TAKEN", "Email address is already in use.");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .roles(request.getRoles())
                .active(request.isActive())
                .build();

        return mapToDto(userRepository.save(user));
    }

    @Transactional
    public UserResponseDto updateUser(Long id, UserUpdateRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        if (!user.getEmail().equalsIgnoreCase(request.getEmail()) && userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("EMAIL_TAKEN", "Email is already taken by another user.");
        }

        user.setEmail(request.getEmail());
        user.setRoles(request.getRoles());
        user.setActive(request.isActive());

        return mapToDto(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User", id));
        }
        userRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public AvailabilityResponse checkUsernameAvailability(String username) {
        boolean exists = StringUtils.hasText(username) && userRepository.existsByUsername(username);
        return AvailabilityResponse.builder()
                .field("username")
                .value(username)
                .available(!exists)
                .build();
    }

    @Transactional(readOnly = true)
    public AvailabilityResponse checkEmailAvailability(String email) {
        boolean exists = StringUtils.hasText(email) && userRepository.existsByEmail(email);
        return AvailabilityResponse.builder()
                .field("email")
                .value(email)
                .available(!exists)
                .build();
    }

    private UserResponseDto mapToDto(User user) {
        return UserResponseDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .roles(user.getRoles())
                .active(user.isActive())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
