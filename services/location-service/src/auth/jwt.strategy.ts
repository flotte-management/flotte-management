import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/decorators/current-user.decorator';

interface JwksKey {
  kid?: string;
  x5c?: string[];
}

interface JwksResponse {
  keys: JwksKey[];
}

const jwksCache = new Map<string, string>();

function decodeJwtHeader(rawJwtToken: string): { kid?: string } {
  const [encodedHeader] = rawJwtToken.split('.');
  if (!encodedHeader) return {};

  try {
    const normalized = encodedHeader
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedHeader.length / 4) * 4, '=');

    const headerJson = Buffer.from(normalized, 'base64').toString('utf8');
    return JSON.parse(headerJson) as { kid?: string };
  } catch {
    return {};
  }
}

async function fetchPemFromJwks(
  realmUrl: string,
  kid: string | undefined,
): Promise<string | undefined> {
  const jwksUri = `${realmUrl}/protocol/openid-connect/certs`;
  const response = await fetch(jwksUri, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`JWKS inaccessible (${response.status})`);
  }

  const jwks = (await response.json()) as JwksResponse;
  const selected = kid ? jwks.keys.find((key) => key.kid === kid) : jwks.keys[0];

  const cert = selected?.x5c?.[0];
  if (!cert) return undefined;

  return `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const realmUrl = configService.get<string>('KEYCLOAK_REALM_URL') ?? '';
    const verifyIssuer =
      (configService.get<string>('KEYCLOAK_VERIFY_ISSUER') ?? '').toLowerCase() ===
      'true';

    super({
      secretOrKeyProvider: async (_request, rawJwtToken, done) => {
        try {
          if (!realmUrl) {
            return done(
              new UnauthorizedException('Missing KEYCLOAK_REALM_URL in configuration'),
            );
          }

          const { kid } = decodeJwtHeader(rawJwtToken);
          const cacheKey = kid ?? 'default';
          const cachedPem = jwksCache.get(cacheKey);
          if (cachedPem) {
            return done(null, cachedPem);
          }

          let jwksPem: string | undefined;
          try {
            jwksPem = await fetchPemFromJwks(realmUrl, kid);
          } catch (err) {
            this.logger.warn(
              `Unable to fetch JWT key from JWKS: ${
                err instanceof Error ? err.message : 'unknown error'
              }`,
            );
          }

          if (jwksPem) {
            jwksCache.set(cacheKey, jwksPem);
            return done(null, jwksPem);
          }

          const publicKey = configService.get<string>('JWT_PUBLIC_KEY');
          if (!publicKey) {
            return done(
              new UnauthorizedException('JWT public key not found (JWKS + JWT_PUBLIC_KEY)'),
            );
          }

          return done(null, publicKey.replace(/\\n/g, '\n'));
        } catch (err) {
          this.logger.warn(
            `JWT validation failed: ${
              err instanceof Error ? err.message : 'unknown error'
            }`,
          );
          return done(err);
        }
      },
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      issuer: verifyIssuer ? realmUrl : undefined,
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub) throw new UnauthorizedException('Invalid token');
    return payload;
  }
}

