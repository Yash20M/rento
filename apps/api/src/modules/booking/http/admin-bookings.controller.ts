import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { bookingNotFound } from '../domain/booking-rules';
import { AdminBookingService } from '../services/admin-booking.service';
import { AdminOpsService } from '../services/admin-ops.service';
import { BookingLifecycleService } from '../services/booking-lifecycle.service';
import { ReassignDto, ReassignOptionDto } from './admin-ops.dto';
import {
  AdminBookingDetailDto,
  AdminBookingPageDto,
  AdminBookingsQuery,
  AdminCancelDto,
  BookingDto,
} from './bookings.dto';

const SCOPE = '`NOT_FOUND` — also for bookings of drawers outside your scope.';

/** `/v1/admin/bookings` — administrators limited to some drawers only see and change those (README §13.5). */
@ApiTags('admin: bookings')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(
    private readonly admin: AdminBookingService,
    private readonly lifecycle: BookingLifecycleService,
    private readonly ops: AdminOpsService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get()
  @RequirePermission('bookings:read')
  @ApiOkResponse({
    type: AdminBookingPageDto,
    description: 'Newest first; pass `nextCursor` as `cursor` for the next page.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(422, '`VALIDATION_FAILED` — bad filter or cursor.')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminBookingsQuery,
  ): Promise<AdminBookingPageDto> {
    return this.admin.list(await this.scopes.forUser(user.id, 'bookings:read'), query);
  }

  @Get(':id')
  @RequirePermission('bookings:read')
  @ApiOkResponse({ type: AdminBookingDetailDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<AdminBookingDetailDto> {
    return this.admin.get(await this.scopes.forUser(user.id, 'bookings:read'), id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('bookings:cancel')
  @ApiOkResponse({ type: BookingDto })
  @problem(403, `${AUTH_PROBLEMS} Overriding the refund also needs \`bookings:refund\`.`)
  @problem(404, SCOPE)
  @problem(409, '`INVALID_STATE` — the rental has started or the booking is over.')
  @problem(422, '`VALIDATION_FAILED` — a reason is required.')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(bookingNotFound)) id: string,
    @Body() dto: AdminCancelDto,
  ): Promise<BookingDto> {
    return this.lifecycle.cancelAsStaff(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'bookings:cancel'),
      await this.scopes.forUser(user.id, 'bookings:refund'),
      id,
      dto.reason,
      dto.refundPercent,
    );
  }

  @Get(':id/reassign-options')
  @RequirePermission('bookings:write')
  @ApiOkResponse({
    type: ReassignOptionDto,
    isArray: true,
    description:
      'Free units of the same model for exactly this booking time. Empty when it cannot be moved.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  async reassignOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<ReassignOptionDto[]> {
    return this.ops.reassignOptions(await this.scopes.forUser(user.id, 'bookings:write'), id);
  }

  @Post(':id/reassign')
  @HttpCode(200)
  @RequirePermission('bookings:write')
  @ApiOkResponse({
    type: BookingDto,
    description:
      'The booking now uses another unit of the same model; its time and price are unchanged.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(
    409,
    '`INVALID_STATE` — the rental has started or is over; `BOOKING_SLOT_TAKEN` — the chosen (or any) unit is not free; the booking is untouched.',
  )
  @problem(
    422,
    '`VALIDATION_FAILED` — a reason is required; the unit is not of this model and drawer.',
  )
  async reassign(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(bookingNotFound)) id: string,
    @Body() dto: ReassignDto,
  ): Promise<BookingDto> {
    return this.ops.reassign(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'bookings:write'),
      id,
      dto,
    );
  }

  @Post(':id/pickup')
  @HttpCode(200)
  @RequirePermission('bookings:write')
  @ApiOkResponse({
    type: BookingDto,
    description: 'The customer has the item: `confirmed` → `active`.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(409, '`INVALID_STATE` — not confirmed, too early, or the booking time is over.')
  async pickup(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<BookingDto> {
    return this.lifecycle.pickup(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'bookings:write'),
      id,
    );
  }

  @Post(':id/return')
  @HttpCode(200)
  @RequirePermission('bookings:write')
  @ApiOkResponse({
    type: BookingDto,
    description: 'The item is back: `active`/`overdue` → `completed`.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, SCOPE)
  @problem(409, '`INVALID_STATE` — the item was not handed over.')
  async returned(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<BookingDto> {
    return this.lifecycle.returned(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'bookings:write'),
      id,
    );
  }
}
