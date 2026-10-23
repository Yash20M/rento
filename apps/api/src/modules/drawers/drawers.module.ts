import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory';
import { DrawerRepository } from './data/drawer.repository';
import { AdminDrawerPhotoController } from './http/admin-drawer-photo.controller';
import { AdminSettingsController } from './http/admin-settings.controller';
import { AdminDrawersController } from './http/admin-drawers.controller';
import { PublicDrawersController } from './http/public-drawers.controller';
import { AvailabilityService } from './services/availability.service';
import { DiscoverySettings } from './services/discovery-settings';
import { DiscoveryService } from './services/discovery.service';
import { DrawerPhotoService } from './services/drawer-photo.service';
import { DrawerService } from './services/drawer.service';

/** Drawers, opening hours, closures, nearby discovery and availability (README §8.2, §10, §9.7). */
@Module({
  imports: [InventoryModule],
  controllers: [
    AdminDrawersController,
    AdminDrawerPhotoController,
    AdminSettingsController,
    PublicDrawersController,
  ],
  providers: [
    DrawerRepository,
    DrawerService,
    DiscoveryService,
    DiscoverySettings,
    DrawerPhotoService,
    AvailabilityService,
  ],
  exports: [DrawerRepository, DiscoverySettings],
})
export class DrawersModule {}
