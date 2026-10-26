let base = '';

/** Where uploaded photos are served from (the API origin; empty = same origin). Set once at start-up. */
export const setMediaBase = (apiBaseUrl: string): void => {
  base = apiBaseUrl;
};

/** An uploaded photo is stored as a path on the API (`/v1/media/<id>`); other photos are full https links. */
export const photoUrl = (ref: string): string => (ref.startsWith('/') ? `${base}${ref}` : ref);

export const mediaIdOf = (ref: string): string | undefined =>
  /^\/v1\/media\/([0-9a-f-]{36})$/i.exec(ref)?.[1];

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const MAX_PHOTOS = 10;

/**
 * Sorts a batch of chosen files into the ones that can be uploaded and a sentence for each that cannot (wrong type,
 * empty, too big, a repeat, or no room left among the [MAX_PHOTOS]). [room] is how many more pictures fit.
 */
export function checkPhotos(
  files: ReadonlyArray<File>,
  room: number,
): { accepted: File[]; problems: string[] } {
  const accepted: File[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type))
      problems.push(`${file.name}: only JPEG, PNG or WebP pictures can be uploaded.`);
    else if (file.size === 0) problems.push(`${file.name}: the file is empty.`);
    else if (file.size > MAX_PHOTO_BYTES)
      problems.push(`${file.name}: the picture is larger than 5 MB.`);
    else if (seen.has(key)) problems.push(`${file.name}: already chosen.`);
    else if (accepted.length >= room)
      problems.push(`${file.name}: not added — a product can have at most ${MAX_PHOTOS} photos.`);
    else {
      seen.add(key);
      accepted.push(file);
    }
  }
  return { accepted, problems };
}
