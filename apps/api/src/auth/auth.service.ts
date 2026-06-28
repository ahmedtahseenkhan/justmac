import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AuthUser, CreateUserRequest, LoginResponse, Role, UpdateUserRequest } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    const token = this.jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role } as JwtPayload);
    return { token, user: toAuthUser(user) };
  }

  /** Re-read the user from the DB so role/active changes take effect immediately. */
  async me(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) throw new UnauthorizedException("Session expired.");
    return toAuthUser(user);
  }

  /* ---- user management (ADMIN) ---- */

  async listUsers(): Promise<AuthUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map(toAuthUser);
  }

  async createUser(req: CreateUserRequest): Promise<AuthUser> {
    const email = req.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new BadRequestException("A user with that email already exists.");
    }
    const user = await this.prisma.user.create({
      data: { email, name: req.name, role: req.role, passwordHash: await bcrypt.hash(req.password, 10) },
    });
    return toAuthUser(user);
  }

  async updateUser(id: string, req: UpdateUserRequest): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    const data: Record<string, unknown> = {};
    if (req.role) data.role = req.role;
    if (typeof req.active === "boolean") data.active = req.active;
    if (req.password) data.passwordHash = await bcrypt.hash(req.password, 10);
    const updated = await this.prisma.user.update({ where: { id }, data });
    return toAuthUser(updated);
  }

  async deleteUser(id: string): Promise<{ ok: true }> {
    const count = await this.prisma.user.count({ where: { role: "ADMIN" } });
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (target?.role === "ADMIN" && count <= 1) {
      throw new BadRequestException("Can't delete the last admin.");
    }
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}

function toAuthUser(u: { id: string; email: string; name: string; role: string; active: boolean }): AuthUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role as Role, active: u.active };
}
