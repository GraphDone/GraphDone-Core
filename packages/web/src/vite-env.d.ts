/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_URL?: string
  readonly VITE_GRAPHQL_WS_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_ENABLE_SUBSCRIPTIONS?: string
  readonly VITE_ENABLE_3D_VIEW?: string
  readonly VITE_ENABLE_AI_AGENTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}