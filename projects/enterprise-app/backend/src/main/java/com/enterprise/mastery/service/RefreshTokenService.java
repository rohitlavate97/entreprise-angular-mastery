package com.enterprise.mastery.service;

import com.enterprise.mastery.domain.entity.RefreshToken;
import com.enterprise.mastery.domain.entity.User;
import com.enterprise.mastery.domain.repository.RefreshTokenRepository;
import com.enterprise.mastery.domain.repository.UserRepository;
import com.enterprise.mastery.core.error.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    @Value("${app.security.jwt.refresh-expiration-ms:604800000}")
    private long refreshTokenDurationMs;

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;

    @Transactional
    public RefreshToken createRefreshToken(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "User not found with id: " + userId));

        // Revoke / delete existing tokens for this user upon new login (strict rotation policy)
        refreshTokenRepository.deleteByUser(user);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString())
                .expiryDate(Instant.now().plusMillis(refreshTokenDurationMs))
                .revoked(false)
                .build();

        return refreshTokenRepository.save(refreshToken);
    }

    @Transactional(readOnly = true)
    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.isRevoked()) {
            log.warn("Attempted use of revoked refresh token for user ID: {}", token.getUser().getId());
            throw new BusinessException("REFRESH_TOKEN_REVOKED", "Refresh token was revoked. Please log in again.");
        }

        if (token.getExpiryDate().isBefore(Instant.now())) {
            log.warn("Expired refresh token for user ID: {}", token.getUser().getId());
            throw new BusinessException("REFRESH_TOKEN_EXPIRED", "Refresh token has expired. Please sign in again.");
        }

        return token;
    }

    @Transactional
    public RefreshToken rotateRefreshToken(RefreshToken oldToken) {
        User user = oldToken.getUser();
        oldToken.setRevoked(true);
        refreshTokenRepository.save(oldToken);

        RefreshToken newToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString())
                .expiryDate(Instant.now().plusMillis(refreshTokenDurationMs))
                .revoked(false)
                .build();

        return refreshTokenRepository.save(newToken);
    }

    @Transactional
    public void deleteByUserId(Long userId) {
        userRepository.findById(userId).ifPresent(refreshTokenRepository::deleteByUser);
    }
}
