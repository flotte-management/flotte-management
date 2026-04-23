import { useState, useEffect, useCallback } from 'react';
import keycloakInstance, { initKeycloak } from '../auth/keycloak';
import type Keycloak from 'keycloak-js';
import type { UserRole } from '../types';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: UserRole[];
}

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  token: string | undefined;
  roles: UserRole[];
  keycloak: Keycloak;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const authenticated = await initKeycloak();

        if (authenticated) {
          const token = keycloakInstance.tokenParsed ?? {};
          const realmRoles = (keycloakInstance.realmAccess?.roles ?? []) as UserRole[];
          const resourceRoles = Object.values(keycloakInstance.resourceAccess ?? {}).flatMap(r => r.roles ?? []) as UserRole[];
          const allRoles = [...new Set([...realmRoles, ...resourceRoles])].map(r =>
            r.toUpperCase().replace(/^ROLE_/, '') as UserRole
          );

          setUser({
            id: keycloakInstance.subject ?? '',
            username: (token as Record<string, string>).preferred_username ?? '',
            email: (token as Record<string, string>).email,
            firstName: (token as Record<string, string>).given_name,
            lastName: (token as Record<string, string>).family_name,
            roles: allRoles,
          });
        }

        setIsAuthenticated(authenticated);
      } catch (err) {
        console.error('Keycloak init failed', err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    keycloakInstance.onTokenExpired = () => {
      keycloakInstance.updateToken(60).catch(() => {
        keycloakInstance.logout();
      });
    };
  }, []);

  const login = useCallback(() => keycloakInstance.login(), []);
  const logout = useCallback(() => keycloakInstance.logout({ redirectUri: window.location.origin + '/login' }), []);
  const hasRole = useCallback((role: UserRole) => user?.roles.includes(role) ?? false, [user]);
  const hasAnyRole = useCallback((roles: string[]) => roles.some(r => user?.roles.includes(r as UserRole)), [user]);

  return {
    isAuthenticated,
    isLoading,
    user,
    token: keycloakInstance.token,
    roles: user?.roles ?? [],
    keycloak: keycloakInstance,
    hasRole,
    hasAnyRole,
    login,
    logout,
  };
}
