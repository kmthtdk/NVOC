/// <reference types="vite/client" />

// Typed environment variables exposed to the client via Vite's `import.meta.env`.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Baked in at image build. Shown in the UI so the airgapped Production PC can state its own release. */
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_TIME?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_DEMO_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
