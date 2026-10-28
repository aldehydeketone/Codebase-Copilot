# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Build with Maven
# ─────────────────────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Download dependencies first (cache layer)
COPY pom.xml ./
RUN mvn dependency:go-offline -q

# Copy source and package (skip tests — they need a live DB/Ollama)
COPY src ./src
RUN mvn clean package -DskipTests -q

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – JDK runtime (required: JavaSourceParser uses com.sun.source APIs)
# eclipse-temurin:21-jdk-alpine provides the full JDK including compiler APIs
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS runtime

WORKDIR /app

# Non-root user for security
RUN addgroup -S copilot && adduser -S copilot -G copilot

# Copy the fat JAR
COPY --from=builder /build/target/codebase-copilot-0.0.1-SNAPSHOT.jar app.jar

# Repositories imported via the UI are stored here inside the container.
# Mount a Docker volume at this path to persist them across restarts.
RUN mkdir -p /app/repositories && chown copilot:copilot /app/repositories

USER copilot

EXPOSE 8080

# JVM flags tuned for a small container:
#   -XX:+UseContainerSupport  – respect cgroup memory limits
#   -XX:MaxRAMPercentage=75   – leave headroom for the OS
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dspring.datasource.url=jdbc:postgresql://${COPILOT_DB_HOST}:${COPILOT_DB_PORT}/${COPILOT_DB_NAME}?sslmode=require -Dspring.datasource.username=${COPILOT_DB_USER} -Dspring.datasource.password=${COPILOT_DB_PASSWORD} -jar app.jar"]

