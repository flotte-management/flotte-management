import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private configService: ConfigService) {
    super({
      /**
       * Récupère la JWKS (clés publiques RS256) depuis Keycloak automatiquement.
       * En dev, si KEYCLOAK n'est pas disponible, on peut passer une clé PEM statique.
       */
      secretOrKeyProvider: async (
        _request,
        rawJwtToken,
        done,
      ) => {
        try {
          // Utilise la JWKS URI du realm Keycloak
          const jwksUri = `${configService.get('KEYCLOAK_REALM_URL')}/protocol/openid-connect/certs`;
          // En production, utiliser passportJwtSecret de `jwks-rsa`
          // Ici, pour simplifier, on lit la clé publique PEM depuis env (dev)
          const publicKey = configService.get<string>('JWT_PUBLIC_KEY');
          if (!publicKey) {
            this.logger.warn(
              'JWT_PUBLIC_KEY non défini — vérifiez votre .env. JWKS URI : ' + jwksUri,
            );
            return done(new UnauthorizedException('Clé publique JWT manquante'));
          }
          done(null, publicKey);
        } catch (err) {
          done(err);
        }
      },
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      issuer: configService.get('KEYCLOAK_REALM_URL'),
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub) throw new UnauthorizedException('Token invalide');
    return payload;
  }
}
