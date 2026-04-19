import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
  groups?: string[];
  scope?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    return request.user ?? ({ sub: '' } as JwtPayload);
  },
);

