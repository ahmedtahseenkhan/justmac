import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@sellme/shared";
import { ROLES_KEY } from "./roles.decorator";
import type { JwtPayload } from "./auth.service";

/** Enforces @Roles(...) metadata against the authenticated user (set by JwtAuthGuard). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("You don't have access to this resource.");
    }
    return true;
  }
}
