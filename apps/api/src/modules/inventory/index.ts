// Public surface of the inventory module (README §12.3).
export { InventoryModule } from './inventory.module';
export { InventoryRepository, type ItemModelRow } from './data/inventory.repository';
export {
  NEW_ITEM_DAYS,
  discountPaise,
  effectiveSlotPrice,
  isNewItem,
  isOfferActive,
  offerState,
  type EffectivePrice,
} from './domain/pricing';
