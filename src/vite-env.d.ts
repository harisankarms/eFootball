/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Where this build serves the OCR engine from, e.g. "/ocr/3f2a9c01de" (set in vite.config.ts). */
declare const __OCR_BASE__: string
/** Changes when the shape of saved league data could have changed (set in vite.config.ts). */
declare const __CACHE_VERSION__: string
