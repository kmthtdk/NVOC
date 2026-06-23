/// <reference types="vite/client" />

// Typed environment variables exposed to the client via Vite's `import.meta.env`.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
