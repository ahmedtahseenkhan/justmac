import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { JwtPayload } from "./auth.service";

/** Injects the authenticated user payload (set by JwtAuthGuard) into a handler. */
export const CurrentUser = createParamDecorator((_data, ctx: ExecutionContext): JwtPayload => {
  return ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user;
});
