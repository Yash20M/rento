import { Global, Module } from '@nestjs/common';
import { AuthTokenRepository } from './data/auth-token.repository';
import { RefreshTokenRepository } from './data/refresh-token.repository';
import { UserRepository } from './data/user.repository';
import { AccessTokenGuard } from './http/access-token.guard';
import { AuthController } from './http/auth.controller';
import { WebSessionController } from './http/web-session.controller';
import { MeController } from './http/me.controller';
import { IdentityService } from './services/identity.service';
import { AccountLifecycleService } from './services/account-lifecycle.service';
import { AvatarService } from './services/avatar.service';
import { ProfileService } from './services/profile.service';
import { AccessTokenService } from './services/access-token.service';
import { AuthService } from './services/auth.service';
import { AuthMailService } from './services/auth-mail.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordHasher } from './services/password-hasher';
import { MfaSessionController } from './http/mfa-session.controller';
import { MfaService } from './services/mfa.service';
import { PasswordChangeService } from './services/password-change.service';
import { PasswordResetService } from './services/password-reset.service';
import { SocialAuthService } from './services/social-auth.service';
import { socialVerifiersProvider } from './providers/social-verifiers.provider';

/** Global so any module's controllers can use `AccessTokenGuard` without re-importing. */
@Global()
@Module({
  controllers: [AuthController, WebSessionController, MfaSessionController, MeController],
  providers: [
    UserRepository,
    RefreshTokenRepository,
    AuthTokenRepository,
    PasswordHasher,
    AccessTokenService,
    AuthService,
    AuthMailService,
    EmailVerificationService,
    PasswordResetService,
    PasswordChangeService,
    MfaService,
    SocialAuthService,
    IdentityService,
    ProfileService,
    AvatarService,
    AccountLifecycleService,
    socialVerifiersProvider,
    AccessTokenGuard,
  ],
  exports: [
    MfaService,
    AccessTokenService,
    AccessTokenGuard,
    PasswordHasher,
    AuthService,
    SocialAuthService,
    AuthMailService,
  ],
})
export class AuthUsersModule {}
