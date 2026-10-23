import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { PROBLEM_JSON, ProblemDetailsDto } from '../../../common/errors/problem.dto';
import { RateLimited } from '../../../common/rate-limit/rate-limited.decorator';
import { AuthResponseDto } from '../../auth-users';
import { InvitationService } from '../services/invitation.service';
import { AcceptInvitationDto, AcceptInvitationGoogleDto } from './admins.dto';

const problem = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsDto) } } },
  });

/** Public: the invitee has no account yet. The mailed single-use token is the credential. */
@ApiTags('auth')
@Controller('auth/admin-invitations')
export class InvitationAcceptController {
  constructor(private readonly invitations: InvitationService) {}

  @Post('accept')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Account created with the invited roles; the new administrator is signed in.',
  })
  @problem(
    409,
    '`EMAIL_TAKEN` — an account with the invited address exists now; ask an administrator to assign the roles to it.',
  )
  @problem(
    422,
    '`VALIDATION_FAILED` — field `token` (unknown, expired, used, revoked or superseded link) or `password` (weak; the link stays usable).',
  )
  accept(@Body() dto: AcceptInvitationDto): Promise<AuthResponseDto> {
    return this.invitations.acceptWithPassword(dto.token, dto);
  }

  @Post('accept/google')
  @HttpCode(200)
  @RateLimited('auth')
  @ApiOkResponse({ type: AuthResponseDto })
  @problem(401, '`SOCIAL_TOKEN_INVALID` — the Google token failed verification.')
  @problem(404, '`NOT_FOUND` — Google sign-in is not enabled.')
  @problem(
    409,
    '`EMAIL_TAKEN` — an account with the invited address exists now; `IDENTITY_IN_USE` — that Google account belongs to someone else.',
  )
  @problem(
    422,
    '`VALIDATION_FAILED` — field `token` (unusable link) or `idToken` (its verified email is not the invited address).',
  )
  acceptWithGoogle(@Body() dto: AcceptInvitationGoogleDto): Promise<AuthResponseDto> {
    return this.invitations.acceptWithGoogle(dto.token, dto.idToken);
  }
}
