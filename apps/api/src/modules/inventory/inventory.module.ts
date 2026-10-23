import { Module } from '@nestjs/common';
import { InventoryRepository } from './data/inventory.repository';
import {
  AdminAssetsController,
  AdminCategoriesController,
  AdminItemModelsController,
} from './http/admin-inventory.controllers';
import { AdminTransfersController } from './http/admin-transfers.controller';
import { AdminItemPhotosController, MediaController } from './http/item-photos.controllers';
import { PublicCatalogController } from './http/public-catalog.controller';
import { AssetService } from './services/asset.service';
import { AssetTransferService } from './services/asset-transfer.service';
import { ItemPhotoService } from './services/item-photo.service';
import { CategoryService } from './services/category.service';
import { ItemModelService } from './services/item-model.service';

/** Categories, item models and physical assets (README §8.2, §13.1). */
@Module({
  controllers: [
    AdminCategoriesController,
    AdminItemModelsController,
    AdminAssetsController,
    AdminTransfersController,
    AdminItemPhotosController,
    MediaController,
    PublicCatalogController,
  ],
  providers: [
    InventoryRepository,
    CategoryService,
    ItemModelService,
    AssetService,
    AssetTransferService,
    ItemPhotoService,
  ],
  exports: [InventoryRepository],
})
export class InventoryModule {}
