/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API (no trailing slash). Empty = same origin. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
