# ==============================================================================
# Multi-Stage Build: Spring Boot 3.4+ Java 21 Backend
# ==============================================================================

# -------------------------------------------------------------
# Stage 1: Build JAR with Maven and Eclipse Temurin JDK 21
# -------------------------------------------------------------
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Copy POM and download dependencies for layer caching
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy full application source and compile production artifact
COPY src ./src
RUN mvn clean package -DskipTests -B

# -------------------------------------------------------------
# Stage 2: Minimal Runtime Container with Eclipse Temurin JRE 21
# -------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a dedicated non-root application user for container security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled JAR from builder stage
COPY --from=builder /build/target/enterprise-backend-*.jar app.jar

# Set file ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# Production JVM optimizations (G1GC, ContainerAware heap sizing)
ENTRYPOINT ["java", \
    "-XX:+UseG1GC", \
    "-XX:MaxRAMPercentage=75.0", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-jar", "app.jar"]
