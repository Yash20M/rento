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
