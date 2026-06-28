import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  createUserSchema,
  loginRequestSchema,
  updateUserSchema,
  type CreateUserRequest,
  type LoginRequest,
  type UpdateUserRequest,
} from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService, type JwtPayload } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { CurrentUser } from "./current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest) {
    return this.auth.login(body.email, body.password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user);
  }

  /* ---- user management (ADMIN only) ---- */

  @Get("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  listUsers() {
    return this.auth.listUsers();
  }

  @Post("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  createUser(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserRequest) {
    return this.auth.createUser(body);
  }

  @Put("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateUser(@Param("id") id: string, @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserRequest) {
    return this.auth.updateUser(id, body);
  }

  @Delete("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  deleteUser(@Param("id") id: string) {
    return this.auth.deleteUser(id);
  }
}
