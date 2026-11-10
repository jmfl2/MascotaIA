import { app, type BrowserWindow } from 'electron'
import { join } from 'node:path'

/** Ruta del preload compilado (out/preload/index.js). */
export const PRELOAD_PATH = join(__dirname, '../preload/index.js')

/** Ruta a un archivo de la carpeta assets/. */
export function assetPath(file: string): string {
  return join(app.getAppPath(), 'assets', file)
}

/**
 * Carga una página del renderer: en desarrollo desde el servidor de Vite
 * (recarga en caliente) y en producción desde los archivos compilados.
 */
export function loadPage(win: BrowserWindow, page: 'robot' | 'bar' | 'bubble' | 'settings'): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    return win.loadURL(`${devUrl}/${page}.html`)
  }
  return win.loadFile(join(__dirname, `../renderer/${page}.html`))
}
