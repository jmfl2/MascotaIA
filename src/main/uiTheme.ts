/**
 * Aspecto de las ventanas de la app (barra, isla, ajustes y bocadillo):
 * - Tema: el del sistema, siempre claro o siempre oscuro (nativeTheme cambia
 *   `prefers-color-scheme` en todas las páginas a la vez).
 * - Color de acento: se inyecta como variable CSS en cada página al cargar y
 *   al cambiarlo, así no hace falta tocar cada ventana por separado.
 */
import { app, nativeTheme, webContents, type WebContents } from 'electron'
import { ACCENT_PRESETS, type UiTheme } from '../shared/appearance'
import { getConfig } from './store'

/** CSS inyectado en cada página, para poder quitarlo al cambiar de color. */
const injected = new WeakMap<WebContents, string>()

function accentCss(): string {
  const accent = getConfig().accent ?? ACCENT_PRESETS[0].color
  // Solo colores "#rrggbb" validados al guardar (store.ts): no puede colarse CSS.
  return `:root { --accent: ${accent} !important; }`
}

async function paint(wc: WebContents): Promise<void> {
  if (wc.isDestroyed()) return
  const previous = injected.get(wc)
  if (previous) await wc.removeInsertedCSS(previous).catch(() => {})
  const key = await wc.insertCSS(accentCss()).catch(() => null)
  if (key) injected.set(wc, key)
}

/** Aplica el tema y el acento guardados en todas las ventanas abiertas. */
export function applyUiTheme(): void {
  nativeTheme.themeSource = getConfig().theme satisfies UiTheme
  for (const wc of webContents.getAllWebContents()) void paint(wc)
}

/** Al arrancar: el tema ya, y el acento en cada página que se cargue. */
export function startUiTheme(): void {
  nativeTheme.themeSource = getConfig().theme
  app.on('web-contents-created', (_event, wc) => {
    wc.on('did-finish-load', () => void paint(wc))
  })
}
