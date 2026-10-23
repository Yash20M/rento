import { Global, Module } from '@nestjs/common';
import { MediaStore } from './media-store';

/** Global so profile photos, drawer photos and product photos all use the same checks and the same table. */
@Global()
@Module({ providers: [MediaStore], exports: [MediaStore] })
export class MediaModule {}
