import { Module } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { FakeIdentityVerifier, IDENTITY_VERIFIER } from './domain/identity-verifier';
import { AdminCustomersController } from './http/admin-customers.controller';
import { KycController } from './http/kyc.controller';
import { CustomerService } from './services/customer.service';
import { KycService } from './services/kyc.service';

/** Identity verification (Aadhaar) and the staff view of customers (owner decision 2026-10-18, README Q-11). */
@Module({
  controllers: [KycController, AdminCustomersController],
  providers: [
    KycService,
    CustomerService,
    {
      provide: IDENTITY_VERIFIER,
      useFactory: (config: AppConfig) => new FakeIdentityVerifier(config.kycFakeOtp),
      inject: [APP_CONFIG],
    },
  ],
  exports: [KycService],
})
export class KycModule {}
