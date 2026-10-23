import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { AppError } from '../../../common/errors/app-error';
import { requestHash } from '../../../common/idempotency/idempotency.service';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { RateLimited } from '../../../common/rate-limit/rate-limited.decorator';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { bookingNotFound } from '../domain/booking-rules';
import { BookingExtensionService } from '../services/booking-extension.service';
import { BookingLifecycleService } from '../services/booking-lifecycle.service';
import { BookingPaymentService } from '../services/booking-payment.service';
import { BookingService } from '../services/booking.service';
import {
  BookingDto,
  ConfirmPaymentDto,
  CreateBookingDto,
  ExtendBookingDto,
  ExtensionDto,
  MyBookingsQuery,
  PaymentOrderDto,
  SimulatedCheckoutDto,
} from './bookings.dto';

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;

function idempotencyKey(header: string | undefined): string {
  if (header === undefined || !KEY_PATTERN.test(header)) {
    throw new AppError({
      status: 422,
      code: 'VALIDATION_FAILED',
      detail: 'Request validation failed',
      errors: [
        {
          field: 'Idempotency-Key',
          message: 'send a header of 8–128 letters, digits or - _ . : (a UUID is ideal)',
        },
      ],
    });
  }
  return header;
}

const OWN = "Another customer's booking is `NOT_FOUND`, exactly like one that does not exist.";

/** The customer's own bookings: hold → pay → confirm → cancel (README §9.4–§9.8). */
@ApiTags('bookings')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingService,
    private readonly payment: BookingPaymentService,
    private readonly lifecycle: BookingLifecycleService,
    private readonly extensions: BookingExtensionService,
  ) {}

  @Post()
  @RateLimited('booking')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'A fresh key per booking attempt. Retrying with the same key returns the original booking (200).',
  })
  @ApiCreatedResponse({
    type: BookingDto,
    description: 'The slot is held for a few minutes: pay before `holdExpiresAt`.',
  })
  @ApiOkResponse({
    type: BookingDto,
    description: 'Replay of an earlier request with the same key and body.',
  })
  @problem(401, AUTH_PROBLEMS)
  @problem(
    404,
    '`NOT_FOUND` — unknown or inactive drawer/model, or the model is not offered there.',
  )
  @problem(
    409,
    '`BOOKING_SLOT_TAKEN` — no free unit for that time; `REQUEST_IN_PROGRESS` — the same key is still running.',
  )
  @problem(
    422,
    '`VALIDATION_FAILED`, `DURATION_INVALID`, `LEAD_TIME_VIOLATION`, `DRAWER_CLOSED`, `IDEMPOTENCY_KEY_REUSED` (same key, different body).',
  )
  @problem(503, '`RETRY_LATER` — the system was busy; retry with the same key.')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') header: string | undefined,
    @Body() dto: CreateBookingDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<BookingDto> {
    const key = idempotencyKey(header);
    const result = await this.bookings.createHold(
      user.id,
      key,
      requestHash('POST', '/v1/bookings', dto),
      dto,
    );
    if (result.replayed) {
      void reply.status(200).header('Idempotency-Replayed', 'true');
    }
    return result.body as BookingDto;
  }

  @Get()
  @ApiOkResponse({ type: BookingDto, isArray: true, description: 'Your 100 most recent bookings.' })
  @problem(401, AUTH_PROBLEMS)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MyBookingsQuery,
  ): Promise<BookingDto[]> {
    return this.bookings.list(user.id, query.status);
  }

  @Get(':id')
  @ApiOkResponse({ type: BookingDto })
  @problem(401, AUTH_PROBLEMS)
  @problem(404, `\`NOT_FOUND\`. ${OWN}`)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<BookingDto> {
    return this.bookings.get(user.id, id);
  }

  @Post(':id/payment')
  @HttpCode(200)
  @ApiOkResponse({
    type: PaymentOrderDto,
    description: 'The order to pay. Asking again returns the same order.',
  })
  @problem(401, AUTH_PROBLEMS)
  @problem(404, `\`NOT_FOUND\`. ${OWN}`)
  @problem(409, '`INVALID_STATE` — the booking is not a hold any more.')
  @problem(410, '`HOLD_EXPIRED` — the hold ran out.')
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<PaymentOrderDto> {
    return this.payment.createOrder(user.id, id);
  }

  @Post(':id/payment/simulate')
  @HttpCode(200)
  @ApiOkResponse({
    type: SimulatedCheckoutDto,
    description:
      'Only with the fake payment provider (development and demos): returns what the gateway checkout would hand the app.',
  })
  @problem(401, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND` — not your booking, or a real payment provider is configured.')
  @problem(409, '`INVALID_STATE` — create the payment order first.')
  simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<SimulatedCheckoutDto> {
    return this.payment.simulateCheckout(user.id, id);
  }

  @Post(':id/payment/confirm')
  @HttpCode(200)
  @ApiOkResponse({
    type: BookingDto,
    description: 'The booking is now `confirmed`. Confirming twice is harmless.',
  })
  @problem(401, AUTH_PROBLEMS)
  @problem(404, `\`NOT_FOUND\`. ${OWN}`)
  @problem(409, '`INVALID_STATE` — the booking cannot be confirmed (for example it was cancelled).')
  @problem(
    410,
    '`HOLD_EXPIRED` — the hold ran out and the slot was taken meanwhile; nothing was captured.',
  )
  @problem(422, '`PAYMENT_INVALID` — the order, payment id or signature did not verify.')
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<BookingDto> {
    return this.payment.confirm(user.id, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({
    type: BookingDto,
    description:
      'Cancelled (cancelling again returns the same state). A paid booking gets a refund per the cancellation policy.',
  })
  @problem(401, AUTH_PROBLEMS)
  @problem(404, `\`NOT_FOUND\`. ${OWN}`)
  @problem(409, '`INVALID_STATE` — the rental has started or the booking is already over.')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
  ): Promise<BookingDto> {
    return this.lifecycle.cancelOwn(user.id, id);
  }

  @Post(':id/extend')
  @ApiCreatedResponse({
    type: ExtensionDto,
    description: 'The order for the extra time. Nothing changes until it is paid.',
  })
  @problem(401, AUTH_PROBLEMS)
  @problem(404, `\`NOT_FOUND\`. ${OWN}`)
  @problem(
    409,
    '`INVALID_STATE` — the rental is not running; `EXTENSION_UNAVAILABLE` — the unit is booked after this rental (the field error says how many minutes are possible).',
  )
  @problem(422, '`VALIDATION_FAILED` — not a multiple of the slot length.')
  extend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
    @Body() dto: ExtendBookingDto,
  ): Promise<ExtensionDto> {
    return this.extensions.start(user.id, id, dto.extraMinutes);
  }

  @Post(':id/extensions/:extensionId/simulate')
  @HttpCode(200)
  @ApiOkResponse({ type: SimulatedCheckoutDto, description: 'Fake payment provider only.' })
  @problem(404, '`NOT_FOUND`')
  @problem(409, '`INVALID_STATE`')
  simulateExtension(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
    @Param('extensionId', uuidParam(bookingNotFound)) extensionId: string,
  ): Promise<SimulatedCheckoutDto> {
    return this.extensions.simulate(user.id, id, extensionId);
  }

  @Post(':id/extensions/:extensionId/confirm')
  @HttpCode(200)
  @ApiOkResponse({
    type: BookingDto,
    description: 'The rental now ends later and costs more. Confirming twice is harmless.',
  })
  @problem(404, '`NOT_FOUND`')
  @problem(
    409,
    '`INVALID_STATE`; `EXTENSION_UNAVAILABLE` — someone booked the unit meanwhile; nothing was charged.',
  )
  @problem(422, '`PAYMENT_INVALID`')
  confirmExtension(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(bookingNotFound)) id: string,
    @Param('extensionId', uuidParam(bookingNotFound)) extensionId: string,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<BookingDto> {
    return this.extensions.confirm(user.id, id, extensionId, dto);
  }
}
