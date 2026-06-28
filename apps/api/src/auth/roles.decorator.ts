import { SetMetadata } from "@nestjs/common";
import type { Role } from "@sellme/shared";

export const ROLES_KEY = "roles";
/** Restrict a route/controller to one or more roles. Use with RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
