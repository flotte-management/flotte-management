package com.fleet.vehicule.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI vehicleServiceOpenAPI() {
        return new OpenAPI()
                .components(new Components().addSecuritySchemes("JWT-Keycloak",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Access token Keycloak")))
                .addSecurityItem(new SecurityRequirement().addList("JWT-Keycloak"))
                .info(new Info()
                        .title("Vehicle Service API")
                        .version("v1")
                        .description("Documentation des endpoints du service de gestion des vehicules"));
    }
}

