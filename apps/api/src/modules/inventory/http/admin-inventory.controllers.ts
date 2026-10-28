import {
  Body,
  Controller,
  Inject,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import type { AssetView, CategoryWithCount, ItemModelRow } from '../data/inventory.repository';
import { assetNotFound, categoryNotFound, itemModelNotFound } from '../domain/inventory-errors';
import { isNewItem, offerState } from '../domain/pricing';
import { AssetService } from '../services/asset.service';
import { CategoryService } from '../services/category.service';
import { ItemModelService } from '../services/item-model.service';
import {
  AssetDto,
  AssetPageDto,
  AssetQuery,
  CategoryDto,
  CreateAssetDto,
  CreateCategoryDto,
  CreateItemModelDto,
  ItemModelDto,
  ItemModelQuery,
  UpdateAssetDto,
  UpdateCategoryDto,
  UpdateItemModelDto,
} from './inventory.dto';

export const categoryView = (c: {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  item_model_count?: number;
}): CategoryDto => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  parentId: c.parent_id,
  itemModelCount: c.item_model_count ?? 0,
});

export const itemModelView = (
  m: ItemModelRow & { asset_count?: number },
  now: Date,
): ItemModelDto => ({
  id: m.id,
  categoryId: m.category_id,
  name: m.name,
  description: m.description,
  photos: m.photos as string[],
  pricePerSlotPaise: m.price_per_slot_paise,
  slotMinutes: m.slot_minutes,
  minDurationMin: m.min_duration_min,
  maxDurationMin: m.max_duration_min,
  bufferMin: m.buffer_min,
  depositPaise: m.deposit_paise,
  status: m.status,
  assetCount: m.asset_count ?? 0,
  discountPercent: m.discount_percent,
  discountStartsAt: m.discount_starts_at?.toISOString() ?? null,
  discountEndsAt: m.discount_ends_at?.toISOString() ?? null,
  offerState: offerState(m, now),
  featured: m.featured,
  isNew: isNewItem(m.created_at, now),
  createdAt: m.created_at.toISOString(),
});

const assetView = (a: AssetView): AssetDto => ({
  id: a.id,
  assetCode: a.asset_code,
  itemModelId: a.item_model_id,
  itemModelName: a.item_model_name,
  drawerId: a.drawer_id,
  drawerName: a.drawer_name,
  serialNo: a.serial_no,
  status: a.status,
});

@ApiTags('admin: inventory')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOkResponse({ type: CategoryDto, isArray: true })
  @problem(403, AUTH_PROBLEMS)
  async list(): Promise<CategoryDto[]> {
    return (await this.categories.list()).map((c: CategoryWithCount) => categoryView(c));
  }

  @Post()
  @RequirePermission('inventory:write')
  @ApiCreatedResponse({ type: CategoryDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(409, '`ALREADY_EXISTS` — slug taken.')
  @problem(422, '`VALIDATION_FAILED`')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return categoryView(await this.categories.create({ id: user.id, ip }, dto));
  }

  @Patch(':id')
  @RequirePermission('inventory:write')
  @ApiOkResponse({ type: CategoryDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(409, '`ALREADY_EXISTS` — slug taken.')
  @problem(422, '`VALIDATION_FAILED`')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(categoryNotFound)) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return categoryView(await this.categories.update({ id: user.id, ip }, id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('inventory:write')
  @ApiNoContentResponse({ description: 'Category deleted (only when empty).' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(409, '`IN_USE` — it still contains item models or sub-categories.')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(categoryNotFound)) id: string,
  ): Promise<void> {
    await this.categories.remove({ id: user.id, ip }, id);
  }
}

@ApiTags('admin: inventory')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/item-models')
export class AdminItemModelsController {
  constructor(
    private readonly models: ItemModelService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOkResponse({ type: ItemModelDto, isArray: true, description: 'Includes deactivated models.' })
  @problem(403, AUTH_PROBLEMS)
  async list(@Query() query: ItemModelQuery): Promise<ItemModelDto[]> {
    const rows = await this.models.list({ categoryId: query.categoryId, includeInactive: true });
    return rows.map((m) => itemModelView(m, this.clock.now()));
  }

  @Get(':id')
  @RequirePermission('inventory:read')
  @ApiOkResponse({ type: ItemModelDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  async get(@Param('id', uuidParam(itemModelNotFound)) id: string): Promise<ItemModelDto> {
    return itemModelView(await this.models.get(id), this.clock.now());
  }

  @Post()
  @RequirePermission('inventory:write')
  @ApiCreatedResponse({ type: ItemModelDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(422, '`VALIDATION_FAILED` — a price or duration rule is broken (see `errors[]`).')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: CreateItemModelDto,
  ): Promise<ItemModelDto> {
    return itemModelView(await this.models.create({ id: user.id, ip }, dto), this.clock.now());
  }

  @Patch(':id')
  @RequirePermission('inventory:write')
  @ApiOkResponse({ type: ItemModelDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(409, '`HAS_FUTURE_BOOKINGS` — cannot deactivate while bookings are upcoming.')
  @problem(422, '`VALIDATION_FAILED`')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(itemModelNotFound)) id: string,
    @Body() dto: UpdateItemModelDto,
  ): Promise<ItemModelDto> {
    return itemModelView(await this.models.update({ id: user.id, ip }, id, dto), this.clock.now());
  }
}

@ApiTags('admin: inventory')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/assets')
export class AdminAssetsController {
  constructor(
    private readonly assets: AssetService,
    private readonly scopes: AccessScopes,
  ) {}

  @Get()
  @RequirePermission('assets:read')
  @ApiOkResponse({
    type: AssetPageDto,
    description: 'Only assets in drawers the caller may see, ordered by code.',
  })
  @problem(403, AUTH_PROBLEMS)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssetQuery,
  ): Promise<AssetPageDto> {
    const access = await this.scopes.forUser(user.id, 'assets:read');
    const { limit, cursor, ...filter } = query;
    const page = await this.assets.list(access, filter, { limit: limit ?? 25, cursor });
    return { data: page.items.map(assetView), nextCursor: page.nextCursor };
  }

  @Get(':id')
  @RequirePermission('assets:read')
  @ApiOkResponse({ type: AssetDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND` — also for assets in drawers outside your scope.')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam(assetNotFound)) id: string,
  ): Promise<AssetDto> {
    const access = await this.scopes.forUser(user.id, 'assets:read');
    return assetView(await this.assets.get(access, id));
  }

  @Post()
  @RequirePermission('assets:write')
  @ApiCreatedResponse({ type: AssetDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(409, '`ALREADY_EXISTS` — asset code taken.')
  @problem(422, '`VALIDATION_FAILED` — unknown or inactive item model, unknown drawer, bad code.')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: CreateAssetDto,
  ): Promise<AssetDto> {
    const access = await this.scopes.forUser(user.id, 'assets:write');
    return assetView(await this.assets.create({ id: user.id, ip }, access, dto));
  }

  @Patch(':id')
  @RequirePermission('assets:write')
  @ApiOkResponse({ type: AssetDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(
    409,
    '`IN_USE` — the status change is not allowed; `HAS_FUTURE_BOOKINGS` — upcoming bookings.',
  )
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(assetNotFound)) id: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<AssetDto> {
    const access = await this.scopes.forUser(user.id, 'assets:write');
    return assetView(await this.assets.update({ id: user.id, ip }, access, id, dto));
  }
}
