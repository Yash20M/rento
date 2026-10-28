import type { PaymentRow, RefundRow } from '../payments';
import type { BookingView } from './data/booking.repository';
import { MINUTE_MS } from './domain/booking-rules';
import type { AdminBookingDto, BookingDto } from './http/bookings.dto';

/** The customer's picture of a booking. Money is integer paise. */
export function toBookingDto(
  view: BookingView,
  payment: PaymentRow | undefined,
  refund: RefundRow | undefined,
): BookingDto {
  return {
    id: view.id,
    status: view.status,
    drawer: {
      id: view.drawer_id,
      name: view.drawer_name,
      address: view.drawer_address,
      timezone: view.drawer_timezone,
    },
    itemModel: {
      id: view.item_model_id,
      name: view.item_model_name,
      photoUrl: view.item_photo,
    },
    assetCode: view.asset_code,
    startsAt: view.starts_at.toISOString(),
    endsAt: view.ends_at.toISOString(),
    durationMinutes: Math.round((view.ends_at.getTime() - view.starts_at.getTime()) / MINUTE_MS),
    pricePaise: view.price_paise,
    discountPaise: view.discount_paise,
    depositPaise: view.deposit_paise,
    totalPaise: view.price_paise + view.deposit_paise,
    currency: view.currency,
    holdExpiresAt: view.hold_expires_at?.toISOString() ?? null,
    cancellable: view.status === 'held' || view.status === 'confirmed',
    cancelReason: view.cancel_reason,
    payment: payment
      ? {
          status: payment.status,
          orderId: payment.provider_order_id,
          amountPaise: payment.amount_paise,
        }
      : null,
    refund: refund ? { amountPaise: refund.amount_paise, status: refund.status } : null,
    createdAt: view.created_at.toISOString(),
  };
}

export const toAdminBookingDto = (
  view: BookingView,
  payment: PaymentRow | undefined,
  refund: RefundRow | undefined,
): AdminBookingDto => ({
  ...toBookingDto(view, payment, refund),
  customer: { id: view.user_id, email: view.customer_email, name: view.customer_name },
});
