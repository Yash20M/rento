import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AUTH_PROBLEMS, problem } from '../../../common/http/problem-response';
import { RateLimited } from '../../../common/rate-limit/rate-limited.decorator';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { KycService } from '../services/kyc.service';
import { kycView } from './kyc-view';
import { AadhaarRequestDto, KycStatusDto, StartAadhaarDto, VerifyAadhaarDto } from './kyc.dto';

/** The customer's own identity verification (owner decision 2026-10-18: required before booking). */
@ApiTags('me')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('me/kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get()
  @ApiOkResponse({ type: KycStatusDto })
  @problem(401, AUTH_PROBLEMS)
  async status(@CurrentUser() user: AuthenticatedUser): Promise<KycStatusDto> {
    return kycView(await this.kyc.status(user.id));
  }

  @Post('aadhaar')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: AadhaarRequestDto,
    description: 'A one-time code was sent to the phone linked to the Aadhaar.',
  })
  @problem(401, AUTH_PROBLEMS)
  @problem(
    409,
    '`AADHAAR_IN_USE` — already verified on another account; `INVALID_STATE` — already verified, or declined by staff.',
  )
  @problem(422, '`VALIDATION_FAILED` — not a valid Aadhaar number (12 digits, checksum).')
  @problem(429, '`RATE_LIMITED` — too many attempts today.')
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartAadhaarDto,
  ): Promise<AadhaarRequestDto> {
    const started = await this.kyc.start(user.id, dto.aadhaarNumber);
    return {
      requestId: started.requestId,
      expiresAt: started.expiresAt.toISOString(),
      maskedAadhaar: started.maskedAadhaar,
    };
  }

  @Post('aadhaar/verify')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({ type: KycStatusDto, description: 'Verified — bookings are now allowed.' })
  @problem(401, AUTH_PROBLEMS)
  @problem(404, "`VALIDATION_FAILED` on `requestId` — unknown, finished or someone else's request.")
  @problem(409, '`AADHAAR_IN_USE`')
  @problem(
    422,
    '`VALIDATION_FAILED` on `otp` — wrong or expired code (the message says how many attempts are left).',
  )
  @problem(429, '`RATE_LIMITED` — too many wrong codes.')
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyAadhaarDto,
  ): Promise<KycStatusDto> {
    return kycView(await this.kyc.verify(user.id, dto.requestId, dto.otp));
  }
}
