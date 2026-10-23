import { Logger, type Provider } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { SOCIAL_VERIFIERS, type SocialVerifiers } from '../domain/social';
import { AppleIdentityVerifier } from './apple/apple-identity-verifier';
import { GoogleIdentityVerifier } from './google/google-identity-verifier';
import { FacebookIdentityVerifier } from './meta/facebook-identity-verifier';

/**
 * The providers enabled in this deployment. A provider appears only when it is configured, so an unconfigured one
 * answers 404 instead of being half-working.
 */
export const socialVerifiersProvider: Provider = {
  provide: SOCIAL_VERIFIERS,
  inject: [APP_CONFIG, CLOCK],
  useFactory: (config: AppConfig, clock: Clock): SocialVerifiers => {
    const verifiers: SocialVerifiers = {};
    if (config.googleClientIds.length > 0) {
      verifiers.google = new GoogleIdentityVerifier(
        { clientIds: config.googleClientIds, jwksUrl: config.googleJwksUrl },
        clock,
        new Logger('GoogleIdentityVerifier'),
      );
    }
    if (config.facebookAppId !== undefined && config.facebookAppSecret !== undefined) {
      verifiers.facebook = new FacebookIdentityVerifier(
        {
          appId: config.facebookAppId,
          appSecret: config.facebookAppSecret,
          graphUrl: config.facebookGraphUrl,
          jwksUrl: config.facebookJwksUrl,
        },
        clock,
        new Logger('FacebookIdentityVerifier'),
      );
    }
    if (config.appleClientIds.length > 0) {
      verifiers.apple = new AppleIdentityVerifier(
        { clientIds: config.appleClientIds, jwksUrl: config.appleJwksUrl },
        clock,
        new Logger('AppleIdentityVerifier'),
      );
    }
    return verifiers;
  },
};
