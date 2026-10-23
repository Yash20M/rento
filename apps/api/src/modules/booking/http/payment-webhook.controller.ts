import { Controller, Headers, HttpCode, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { PaymentWebhookService } from '../services/payment-webhook.service';

/** Called by the payment gateway, not by apps: authenticated by the webhook signature, hidden from the public API docs. */
@ApiExcludeController()
@Controller('payments/webhooks')
export class PaymentWebhookController {
  constructor(private readonly webhooks: PaymentWebhookService) {}

  @Post('razorpay')
  @HttpCode(200)
  async razorpay(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    await this.webhooks.razorpay(request.rawBody, signature);
    return { received: true };
  }
}
