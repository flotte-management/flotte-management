FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copie du pom.xml séparément pour profiter du cache Docker
COPY pom.xml .

RUN mvn dependency:go-offline -B

# Copie du code source et build
COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Création d'un utilisateur non-root (sécurité)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup


# Copie du JAR depuis l'étape builder
COPY --from=builder --chown=appuser:appgroup /app/target/*.jar app.jar

USER appuser

EXPOSE 8080

# Optimisations JVM pour les conteneurs
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]

  