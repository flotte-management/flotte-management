package com.fleet.vehicule.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

@Configuration
public class JwtDecoderConfig {

    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${app.security.keycloak.realm-url}") String realmUrl,
            @Value("${app.security.keycloak.verify-issuer:false}") boolean verifyIssuer) {

        String jwksUri = realmUrl + "/protocol/openid-connect/certs";
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri).build();

        OAuth2TokenValidator<Jwt> validator = verifyIssuer
                ? JwtValidators.createDefaultWithIssuer(realmUrl)
                : JwtValidators.createDefault();
        decoder.setJwtValidator(validator);

        return decoder;
    }
}

