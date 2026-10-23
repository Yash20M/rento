// Public surface of the auth-users module (README §12.3): other modules import from here, never from internals.
export { AuthUsersModule } from './auth-users.module';
export {
  AccessTokenGuard,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from './http/access-token.guard';
export { CurrentUser } from './http/current-user.decorator';
export { AccessTokenService } from './services/access-token.service';
export { PasswordHasher } from './services/password-hasher';
export { AccountProvisioning } from './services/account-provisioning';
export { AuthMailService } from './services/auth-mail.service';
export { AuthService, type AuthResult } from './services/auth.service';
export { SocialAuthService } from './services/social-auth.service';
export type { SocialCredentials } from './domain/social';
export { adminInvitationEmail } from './domain/mail-templates';
export { emailTaken, identityInUse, invalidOneTimeToken, weakPassword } from './domain/auth-errors';
export { AuthResponseDto } from './http/dto/auth.dto';
export { generateOneTimeToken, hashOneTimeToken } from './domain/one-time-token';
export { validatePassword } from './domain/password-policy';
export { MfaService } from './services/mfa.service';
