import { randomUUID } from 'node:crypto';

export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');

/**
 * The identity-verification service behind the Aadhaar flow (owner decision 2026-10-18, README Q-11). The real vendor
 * is chosen and integrated later (P4-16); until then {@link FakeIdentityVerifier} stands in. The full Aadhaar number is
 * passed through to the vendor and is never stored, logged or returned by this system.
 */
export interface IdentityVerifier {
  readonly name: string;
  /** Sends a one-time code to the phone linked to the Aadhaar. Returns the vendor's reference for this attempt. */
  start(input: { aadhaarNumber: string }): Promise<{ providerRef: string }>;
  /** Checks the code. `undefined` = wrong or expired code. */
  verify(input: { providerRef: string; otp: string }): Promise<{ name: string } | undefined>;
}

/** Demo/dev verifier: accepts one fixed code. The real service sends real OTPs. */
export class FakeIdentityVerifier implements IdentityVerifier {
  readonly name = 'fake';

  constructor(private readonly otp: string) {}

  async start(): Promise<{ providerRef: string }> {
    return { providerRef: `fake_kyc_${randomUUID()}` };
  }

  async verify(input: { providerRef: string; otp: string }): Promise<{ name: string } | undefined> {
    return input.providerRef.startsWith('fake_kyc_') && input.otp === this.otp
      ? { name: 'Aadhaar Holder (demo)' }
      : undefined;
  }
}
