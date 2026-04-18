import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums';

/** Vérifie le JWT Keycloak (RS256). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/** Vérifie que l'utilisateur possède au moins un des rôles requis. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Pas de restriction de rôle déclarée → accès libre (JWT validé en amont)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const userRoles: string[] = user?.realm_access?.roles ?? [];

    const hasRole = requiredRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé. Rôles requis : ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
