import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { mediaRef } from '../../../common/media/images';
import { PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import type { PromotionView } from '../data/promotion.repository';
import { IMAGE_TYPES } from '../domain/images';
import { promotionState } from '../domain/promotion-rules';
import { PromotionService, promotionNotFound } from '../services/promotion.service';
import {
  CreatePromotionDto,
  PromotionDto,
  PublicPromotionDto,
  UpdatePromotionDto,
} from './promotions.dto';

const publicView = (p: PromotionView): PublicPromotionDto => ({
  id: p.id,
  title: p.title,
  subtitle: p.subtitle,
  ctaLabel: p.cta_label,
  theme: p.theme,
  imageUrl: p.image_media_id ? mediaRef(p.image_media_id) : null,
  // A banner never leads to a product that is off the shelf.
  itemModelId: p.item_model_status === 'active' ? p.item_model_id : null,
});

const adminView = (p: PromotionView, now: Date): PromotionDto => ({
  ...publicView(p),
  itemModelId: p.item_model_id,
  itemModelName: p.item_model_name,
  startsAt: p.starts_at?.toISOString() ?? null,
  endsAt: p.ends_at?.toISOString() ?? null,
  active: p.active,
  sortOrder: p.sort_order,
  state: promotionState(p, now),
  createdAt: p.created_at.toISOString(),
});

const claimedType = (contentType: string | undefined): string =>
  (contentType ?? '').split(';')[0]!.trim().toLowerCase();

/** Staff manage the banners of the customer app's home screen. Reading needs `inventory:read`, changing `inventory:write`. */
@ApiTags('admin: promotions')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(
    private readonly promotions: PromotionService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOkResponse({
    type: PromotionDto,
    isArray: true,
    description:
      'Every banner, in the order customers see them (switched-off and scheduled ones included).',
  })
  @problem(403, AUTH_PROBLEMS)
  async list(): Promise<PromotionDto[]> {
    const now = this.clock.now();
    return (await this.promotions.list()).map((p) => adminView(p, now));
  }

  @Post()
  @RequirePermission('inventory:write')
  @ApiCreatedResponse({ type: PromotionDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(422, '`VALIDATION_FAILED` — see `errors[]`.')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Body() dto: CreatePromotionDto,
  ): Promise<PromotionDto> {
    return adminView(await this.promotions.create({ id: user.id, ip }, dto), this.clock.now());
  }

  @Patch(':id')
  @RequirePermission('inventory:write')
  @ApiOkResponse({ type: PromotionDto })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(422, '`VALIDATION_FAILED`')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(promotionNotFound)) id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionDto> {
    return adminView(await this.promotions.update({ id: user.id, ip }, id, dto), this.clock.now());
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('inventory:write')
  @ApiNoContentResponse({ description: 'The banner and its picture are deleted.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(promotionNotFound)) id: string,
  ): Promise<void> {
    await this.promotions.remove({ id: user.id, ip }, id);
  }

  @Post(':id/image')
  @HttpCode(200)
  @RequirePermission('inventory:write')
  @ApiConsumes(...IMAGE_TYPES)
  @ApiBody({
    description: 'The picture itself (JPEG, PNG or WebP, at most 5 MB), sent as the request body.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiOkResponse({
    type: PromotionDto,
    description: 'The banner with its new picture (the old one is deleted).',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(422, '`VALIDATION_FAILED` — not a JPEG/PNG/WebP image, empty, or larger than 5 MB.')
  async setImage(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(promotionNotFound)) id: string,
    @Req() request: FastifyRequest,
    @Headers('content-type') contentType: string | undefined,
  ): Promise<PromotionDto> {
    return adminView(
      await this.promotions.setImage(
        { id: user.id, ip },
        id,
        request.body,
        claimedType(contentType),
      ),
      this.clock.now(),
    );
  }

  @Delete(':id/image')
  @HttpCode(200)
  @RequirePermission('inventory:write')
  @ApiOkResponse({
    type: PromotionDto,
    description: 'The banner without a picture (also when it had none).',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  async clearImage(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(promotionNotFound)) id: string,
  ): Promise<PromotionDto> {
    return adminView(await this.promotions.clearImage({ id: user.id, ip }, id), this.clock.now());
  }
}

/** What the customer app shows on its home screen: live banners only, no sign-in needed. */
@ApiTags('catalog')
@Controller('promotions')
export class PublicPromotionsController {
  constructor(private readonly promotions: PromotionService) {}

  @Get()
  @ApiOkResponse({
    type: PublicPromotionDto,
    isArray: true,
    description:
      "Banners that are switched on, have begun and have not ended, in the staff's order.",
  })
  async list(): Promise<PublicPromotionDto[]> {
    return (await this.promotions.listLive()).map(publicView);
  }
}
