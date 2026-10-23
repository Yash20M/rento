// Public surface of the drawers module (README §12.3).
export { DrawersModule } from './drawers.module';
export {
  DrawerRepository,
  type ClosureRow,
  type DrawerRow,
  type HoursRow,
} from './data/drawer.repository';
export { isOpenAt } from './domain/drawer-rules';
export { isValidTimeZone, localParts, zonedToUtc } from './domain/time';
export { DiscoverySettings } from './services/discovery-settings';
