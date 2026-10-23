import type { KycView } from '../services/kyc.service';
import type { KycStatusDto } from './kyc.dto';

export const kycView = (v: KycView): KycStatusDto => ({
  required: v.required,
  status: v.status,
  maskedAadhaar: v.maskedAadhaar,
  verifiedAt: v.verifiedAt?.toISOString() ?? null,
  verifiedName: v.verifiedName,
  reason: v.reason,
});
