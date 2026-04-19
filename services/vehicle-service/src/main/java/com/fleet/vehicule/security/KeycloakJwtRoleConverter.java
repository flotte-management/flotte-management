package com.fleet.vehicule.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.stream.Collectors;

/**
 * Keycloak place les rôles dans realm_access.roles (et resource_access.<client>.roles).
 * Spring Security cherche par défaut dans "scope" → on surcharge ici.
 *
 * Résultat : ROLE_ADMIN, ROLE_MANAGER, ROLE_TECHNICIEN, ROLE_UTILISATEUR
 * compatibles avec @PreAuthorize("hasRole('ADMIN')")
 */
@Component
public class KeycloakJwtRoleConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final String clientId;

    public KeycloakJwtRoleConverter(
            @Value("${app.security.keycloak.client-id:flotte-services}") String clientId) {
        this.clientId = clientId;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = extractRoles(jwt);
        return new JwtAuthenticationToken(jwt, authorities);
    }

    @SuppressWarnings("unchecked")
    private Collection<GrantedAuthority> extractRoles(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
        List<String> realmRoles = realmAccess == null
                ? Collections.emptyList()
                : (List<String>) realmAccess.getOrDefault("roles", Collections.emptyList());

        Map<String, Object> resourceAccess = jwt.getClaimAsMap("resource_access");
        List<String> clientRoles = Collections.emptyList();
        if (resourceAccess != null) {
            Object selectedClient = resourceAccess.get(clientId);
            if (selectedClient instanceof Map<?, ?> selectedMap) {
                Object rolesClaim = selectedMap.get("roles");
                if (rolesClaim instanceof List<?> roleList) {
                    clientRoles = roleList.stream()
                            .filter(String.class::isInstance)
                            .map(String.class::cast)
                            .toList();
                }
            }
        }

        Set<String> allRoles = new HashSet<>();
        allRoles.addAll(realmRoles);
        allRoles.addAll(clientRoles);

        if (allRoles.isEmpty()) {
            return Collections.emptyList();
        }

        return allRoles.stream()
                .map(String::trim)
                .filter(role -> !role.isEmpty())
                .map(role -> role.toUpperCase().replaceFirst("^ROLE_", ""))
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
    }
}
