export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_MODEL = 10;
/** Profile and drawer pictures are shown small: a smaller limit than product photos. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** How a stored photo is referenced from an item model: a path on this API, never a file path. */
export const MEDIA_PATH = '/v1/media/';
const MEDIA_REF = /^\/v1\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const mediaRef = (id: string): string => `${MEDIA_PATH}${id}`;
/** The media id behind a photo reference, or `undefined` for an external URL. */
export const mediaIdOf = (ref: string): string | undefined =>
  MEDIA_REF.exec(ref)?.[1]?.toLowerCase();

/**
 * What the bytes really are, from their leading signature — the client's `Content-Type` is only a claim. Anything else
 * (SVG and HTML included, which can carry scripts) is refused.
 */
export function sniffImage(bytes: Uint8Array): ImageType | undefined {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)
  ) {
    return 'image/png';
  }
  const ascii = (from: number, text: string) =>
    [...text].every((c, i) => at(from + i) === c.charCodeAt(0));
  if (bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  return undefined;
}
