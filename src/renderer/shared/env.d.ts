/// <reference types="vite/client" />
import type { MascotaApi } from '../../shared/ipc'

declare global {
  interface Window {
    /** API expuesta por el preload (src/preload/index.ts). */
    readonly mascota: MascotaApi
  }
}
