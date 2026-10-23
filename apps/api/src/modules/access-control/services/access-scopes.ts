import { Inject, Injectable } from '@nestjs/common';
import {
  type DrawerAccess,
  PERMISSION_RESOLVER,
  type PermissionResolver,
  drawerAccess,
} from '../domain/authorization';

/** "Which drawers may this administrator touch with this permission?" — the one call scoped modules make. */
@Injectable()
export class AccessScopes {
  constructor(@Inject(PERMISSION_RESOLVER) private readonly resolver: PermissionResolver) {}

  async forUser(userId: string, permission: string): Promise<DrawerAccess> {
    return drawerAccess(await this.resolver.effective(userId), permission);
  }
}
