/**
 * Ventana de ajustes (skin, accesorios, personalidad...). Se crea al abrirla y
 * se destruye al cerrarla: no ocupa memoria mientras no se usa.
 */
import { BrowserWindow, screen } from 'electron'
import { loadPage, PRELOAD_PATH } from './paths'
import { hardenWebContents, secureWebPreferences } from './security'

const SIZE = { width: 520, height: 720 }

let win: BrowserWindow | null = null

export function getSettingsWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function openSettings(): void {
  const existing = getSettingsWindow()
  if (existing) {
    existing.show()
    existing.focus()
    return
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  win = new BrowserWindow({
    ...SIZE,
    x: Math.round(area.x + (area.width - SIZE.width) / 2),
    y: Math.round(area.y + Math.max(0, (area.height - SIZE.height) / 2)),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    thickFrame: false,
    title: 'Ajustes de Mascota',
    webPreferences: secureWebPreferences(PRELOAD_PATH)
  })
  hardenWebContents(win.webContents)
  win.once('ready-to-show', () => {
    win?.show()
    win?.focus()
  })
  win.on('closed', () => {
    win = null
  })
  void loadPage(win, 'settings')
}

export function closeSettings(): void {
  getSettingsWindow()?.close()
}
