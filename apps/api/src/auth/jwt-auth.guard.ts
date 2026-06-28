import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { JwtPayload } from "./auth.service";

/** Verifies a JWT from the `Authorization: Bearer` header or the `jm_session` cookie. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload; cookies?: Record<string, string> }>();
    const token = extractToken(req);
    if (!token) throw new UnauthorizedException("Authentication required.");
    try {
      req.user = this.jwt.verify<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired session.");
    }
  }
}

function extractToken(req: Request & { cookies?: Record<string, string> }): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.jm_session ?? null;
}
