import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { config } from './config.js';
import { logger } from './logger.js';

export interface JwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
  iss?: string;
}

const jwksClient = jwksRsa({
  jwksUri: `${config.keycloak.realmUrl}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxAge: 600_000,  // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid ?? '', (err, key) => {
    if (err) {
      callback(err);
    } else {
      callback(null, key?.getPublicKey());
    }
  });
}

/**
 * Verify Keycloak JWT and return decoded payload.
 * Returns null if token is absent or invalid.
 */
export async function verifyToken(authHeader?: string): Promise<JwtPayload | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  return new Promise((resolve) => {
    const options: jwt.VerifyOptions = {
      algorithms: ['RS256'],
      ...(config.keycloak.verifyIssuer ? { issuer: config.keycloak.realmUrl } : {}),
    };

    jwt.verify(token, getKey, options, (err, decoded) => {
      if (err) {
        logger.warn(`JWT verification failed: ${err.message}`);
        resolve(null);
      } else {
        resolve(decoded as JwtPayload);
      }
    });
  });
}

/**
 * Extract normalised role list from a Keycloak JWT payload.
 */
export function getRoles(payload: JwtPayload): string[] {
  const realmRoles = payload.realm_access?.roles ?? [];
  const resourceRoles = Object.values(payload.resource_access ?? {})
    .flatMap((r) => r.roles ?? []);
  const directRoles = payload.roles ?? [];
  return [...new Set([...realmRoles, ...resourceRoles, ...directRoles])]
    .map((r) => r.toUpperCase().replace(/^ROLE_/, ''));
}
