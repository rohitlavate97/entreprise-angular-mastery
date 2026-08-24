package com.enterprise.mastery.config;

import com.enterprise.mastery.domain.entity.Role;
import com.enterprise.mastery.domain.entity.User;
import com.enterprise.mastery.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (!userRepository.existsByUsername("admin")) {
            User admin = User.builder()
                    .username("admin")
                    .email("admin@enterprise.io")
                    .passwordHash(passwordEncoder.encode("Admin@12345"))
                    .roles(Set.of(Role.ROLE_ADMIN, Role.ROLE_USER))
                    .active(true)
                    .build();

            userRepository.save(admin);
            log.info("Initialized default admin user: 'admin' / 'Admin@12345'");
        }

        if (!userRepository.existsByUsername("user")) {
            User user = User.builder()
                    .username("user")
                    .email("user@enterprise.io")
                    .passwordHash(passwordEncoder.encode("User@12345"))
                    .roles(Set.of(Role.ROLE_USER))
                    .active(true)
                    .build();

            userRepository.save(user);
            log.info("Initialized default standard user: 'user' / 'User@12345'");
        }
    }
}
