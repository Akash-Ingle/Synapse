import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import {
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
} from "@synapse/shared";
import { AuthService } from "./auth.service";
import { Public } from "../common/public.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshDto,
  ) {
    await this.auth.logout(user.id, dto.refreshToken);
  }
}
