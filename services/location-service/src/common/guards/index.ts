import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  private normalizeRole(role: string): string {
    return role.trim().toUpperCase().replace(/^ROLE_/, '');
  }

  private collectRoles(value: unknown): string[] {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(/[\s,]+/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }

    return [];
  }

  private extractRoles(user: Record<string, any>): Set<string> {
    const realmRoles = this.collectRoles(user?.realm_access?.roles);

    const resourceAccess = (user?.resource_access ?? {}) as Record<
      string,
      { roles?: string[] }
    >;
    const resourceRoles = Object.values(resourceAccess).flatMap((client) =>
      this.collectRoles(client?.roles),
    );

    const rootRoles = this.collectRoles(user?.roles);
    const groupRoles = this.collectRoles(user?.groups).map(
      (group) => group.split('/').pop() ?? group,
    );
    const scopeRoles = this.collectRoles(user?.scope);
    const scpRoles = this.collectRoles(user?.scp);
    const authorities = this.collectRoles(user?.authorities);

    const allRoles = [
      ...realmRoles,
      ...resourceRoles,
      ...rootRoles,
      ...groupRoles,
      ...scopeRoles,
      ...scpRoles,
      ...authorities,
    ];

    return new Set(
      allRoles
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .map((r) => this.normalizeRole(r)),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const extractedRoles = this.extractRoles(user ?? {});
    const requiredNormalized = requiredRoles.map((role) => this.normalizeRole(role));

    const hasRole = requiredNormalized.some((requiredRole) =>
      extractedRoles.has(requiredRole),
    );

    if (extractedRoles.size === 0) {
      this.logger.warn(
        'No role extracted from JWT. Check Keycloak realm/client role mappers.',
      );
    }

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

