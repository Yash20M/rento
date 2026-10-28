-- Up Migration
-- An extension of a running rental is priced at the offer that applies when it is bought (M29). Its saving is kept on the
-- extension and added to the booking's `discount_paise` when the extension is paid, like its price is added to `price_paise`.

ALTER TABLE booking_extensions
  ADD COLUMN extra_discount_paise integer NOT NULL DEFAULT 0 CHECK (extra_discount_paise >= 0);
