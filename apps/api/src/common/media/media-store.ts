import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type Kysely, sql } from 'kysely';
import type { Database } from '../../db/kysely';
import { AppError } from '../errors/app-error';
import { type ImageType, sniffImage } from './images';

const invalid = (field: string, message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field, message }],
  });

/**
 * Pictures kept in the database (`media`). One place checks what arrives (the real signature, not the claimed type;
 * the size) and one place writes and deletes, so every kind of photo follows the same rules.
 */
@Injectable()
export class MediaStore {
  /** The image type the bytes really are, or a 422 naming `field`. */
  check(field: string, bytes: unknown, claimedType: string, maxBytes: number): ImageType {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw invalid(field, 'send the image file as the request body');
    }
    if (bytes.length > maxBytes) {
      throw invalid(field, `is larger than ${Math.round(maxBytes / (1024 * 1024))} MB`);
    }
    const real = sniffImage(bytes);
    if (!real) throw invalid(field, 'must be a JPEG, PNG or WebP image');
    if (real !== claimedType) throw invalid(field, 'does not match its declared type');
    return real;
  }

  async insert(
    db: Kysely<Database>,
    type: ImageType,
    bytes: Buffer,
    uploadedBy: string | null,
  ): Promise<string> {
    const stored = await sql<{ id: string }>`
      INSERT INTO media (content_type, byte_size, sha256, data, uploaded_by)
      VALUES (${type}, ${bytes.length}, ${createHash('sha256').update(bytes).digest('hex')}, ${bytes}, ${uploadedBy})
      RETURNING id`.execute(db);
    return stored.rows[0]!.id;
  }

  async remove(db: Kysely<Database>, id: string | null | undefined): Promise<void> {
    if (id) await sql`DELETE FROM media WHERE id = ${id}`.execute(db);
  }
}
