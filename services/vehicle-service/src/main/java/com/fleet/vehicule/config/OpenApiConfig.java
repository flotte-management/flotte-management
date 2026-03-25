package com.fleet.vehicule.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI vehicleServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Vehicle Service API")
                        .version("v1")
                        .description("Documentation des endpoints du service de gestion des vehicules"));
    }
}

