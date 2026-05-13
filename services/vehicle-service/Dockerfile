FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copie du pom.xml séparément pour profiter du cache Docker
COPY pom.xml .

RUN mvn dependency:go-offline -B

# Téléchargement de l'agent OpenTelemetry
RUN curl -L -o opentelemetry-javaagent.jar https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# Copie du code source et build
COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Création d'un utilisateur non-root (sécurité)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copie de l'agent OTEL
COPY --from=builder --chown=appuser:appgroup /app/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

# Copie du JAR depuis l'étape builder
COPY --from=builder --chown=appuser:appgroup /app/target/*.jar app.jar

USER appuser

EXPOSE 8080

# Optimisations JVM pour les conteneurs et execution avec OpenTelemetry
ENTRYPOINT ["java", \
  "-javaagent:/app/opentelemetry-javaagent.jar", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
