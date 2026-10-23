import { Controller, Delete, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNoContentResponse as NoContent,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { IMAGE_TYPES } from '../../../common/media/images';
import { ClientIp } from '../../../common/http/client-ip.decorator';
import { AUTH_PROBLEMS, problem, uuidParam } from '../../../common/http/problem-response';
import { AccessScopes, PermissionGuard, RequirePermission } from '../../access-control';
import { AccessTokenGuard, CurrentUser, type AuthenticatedUser } from '../../auth-users';
import { drawerNotFound } from '../domain/drawer-rules';
import { DrawerPhotoService } from '../services/drawer-photo.service';

/** `/v1/admin/drawers/{id}/photo` — the cover photo shown on the drawer\'s card in the app. */
@ApiTags('admin: drawers')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller('admin/drawers/:id/photo')
export class AdminDrawerPhotoController {
  constructor(
    private readonly photos: DrawerPhotoService,
    private readonly scopes: AccessScopes,
  ) {}

  @Post()
  @HttpCode(204)
  @RequirePermission('drawers:write')
  @ApiConsumes(...IMAGE_TYPES)
  @ApiBody({
    description: 'The image itself (JPEG, PNG or WebP, at most 5 MB), sent as the request body.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiNoContentResponse({
    description: 'The drawer has the new cover photo (the old one is deleted).',
  })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND` — no such drawer (or outside your drawers).')
  @problem(422, '`VALIDATION_FAILED` — not a JPEG/PNG/WebP image, empty, or larger than 5 MB.')
  async set(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(drawerNotFound)) id: string,
    @Req() request: FastifyRequest,
    @Headers('content-type') contentType: string | undefined,
  ): Promise<void> {
    const claimed = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    await this.photos.set(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'drawers:write'),
      id,
      request.body,
      claimed,
    );
  }

  @Delete()
  @HttpCode(204)
  @RequirePermission('drawers:write')
  @NoContent({ description: 'The cover photo is removed (also when there was none).' })
  @problem(403, AUTH_PROBLEMS)
  @problem(404, '`NOT_FOUND` — no such drawer (or outside your drawers).')
  async clear(
    @CurrentUser() user: AuthenticatedUser,
    @ClientIp() ip: string,
    @Param('id', uuidParam(drawerNotFound)) id: string,
  ): Promise<void> {
    await this.photos.clear(
      { id: user.id, ip },
      await this.scopes.forUser(user.id, 'drawers:write'),
      id,
    );
  }
}
