import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { IMAGE_TYPES } from '../domain/images';
import { itemModelNotFound } from '../domain/inventory-errors';
import { ItemPhotoService } from '../services/item-photo.service';
import { itemModelView } from './admin-inventory.controllers';
import { ItemModelDto } from './inventory.dto';

const mediaNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Photo not found' });

/** Photos of a product, uploaded by the staff who maintain the catalogue (`inventory:write`). */
@ApiTags('admin: inventory')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/item-models/:id/photos')
export class AdminItemPhotosController {
  constructor(
    private readonly photos: ItemPhotoService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Post()
  @RequirePermission('inventory:write')
  @ApiConsumes(...IMAGE_TYPES)
  @ApiBody({
    description:
      'The image file itself (JPEG, PNG or WebP, at most 5 MB), sent as the request body.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiCreatedResponse({
    type: ItemModelDto,
    description: 'The product with the new photo appended.',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND`')
  @problem(
    422,
    '`VALIDATION_FAILED` — not a JPEG/PNG/WebP image, larger than 5 MB, empty, or the product already has 10 photos. Other content types and oversize bodies are refused with 4xx before reaching this.',
  )
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(itemModelNotFound)) id: string,
    @Req() request: FastifyRequest,
    @Headers('content-type') contentType: string | undefined,
  ): Promise<ItemModelDto> {
    const claimed = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    return itemModelView(
      await this.photos.add({ id: user.id, ip }, id, request.body, claimed),
      this.clock.now(),
    );
  }

  @Delete(':mediaId')
  @HttpCode(200)
  @RequirePermission('inventory:write')
  @ApiOkResponse({ type: ItemModelDto, description: 'The product without that photo.' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND` — unknown product or photo.')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(itemModelNotFound)) id: string,
    @Param('mediaId', uuidParam(mediaNotFound)) mediaId: string,
  ): Promise<ItemModelDto> {
    return itemModelView(
      await this.photos.remove({ id: user.id, ip }, id, mediaId),
      this.clock.now(),
    );
  }
}

/** Serves stored photos to everyone (they are public catalogue pictures); immutable, so cached for a year. */
@ApiTags('catalog')
@Controller('media')
export class MediaController {
  constructor(private readonly photos: ItemPhotoService) {}

  @Get(':id')
  @ApiProduces(...IMAGE_TYPES)
  @ApiOkResponse({
    description: 'The image bytes.',
    content: Object.fromEntries(
      IMAGE_TYPES.map((t) => [t, { schema: { type: 'string', format: 'binary' } }]),
    ),
  })
  @problem(404, '`NOT_FOUND`')
  async get(
    @Param('id', uuidParam(mediaNotFound)) id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const image = await this.photos.find(id);
    if (!image) throw mediaNotFound();
    const etag = `"${image.sha256}"`;
    void reply
      .header('etag', etag)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'")
      .header('cross-origin-resource-policy', 'cross-origin');
    if (ifNoneMatch === etag) {
      void reply.code(304).send();
      return;
    }
    void reply.header('content-type', image.contentType).send(image.data);
  }
}
