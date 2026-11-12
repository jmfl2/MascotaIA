/**
 * Pestaña de arriba (modo pestaña): una píldora fina pegada al borde superior
 * de la pantalla principal. Crece al acercar el ratón y, al hacerle clic, baja
 * el robot y se abre la barra.
 *
 * Igual que el robot, la ventana deja pasar los clics salvo cuando el cursor
 * está encima de la píldora. La cercanía la calcula el proceso principal con la
 * posición global del cursor: así funciona aunque la ventana no reciba eventos.
 */
import { BrowserWindow, screen, type Rectangle } from 'electron'
import { formatAccelerator } from '../shared/accelerator'
import { IPC, type PomodoroView, type TabInfo, type TabMediaView } from '../shared/ipc'
import { loadPage, PRELOAD_PATH } from './paths'
import { distanceToRect, nearness } from './tabGeometry'
import { hardenWebContents, secureWebPreferences } from './security'

/** Ventana con margen para la sombra de la píldora abierta (la de la música es la más grande). */
export const TAB_SIZE = { width: 360, height: 76 }
/** Píldora abierta (coincide con tab.css), relativa a la ventana. */
const OPEN_PILL = { width: 208, height: 34 }
/** Píldora abierta con música: carátula, título y controles (tab.css, .has-music). */
const MUSIC_PILL = { width: 320, height: 56 }
/** Al cambiar de canción, la píldora se asoma abierta este rato. */
const PEEK_MS = 3500
/** Cada cuánto se mira el cursor: más despacio si está lejos. */
const POLL_NEAR_MS = 16
const POLL_FAR_MS = 120

let win: BrowserWindow | null = null
let pollTimer: NodeJS.Timeout | null = null
let lastNear = -1
let clickable = false
let info: TabInfo = { name: 'Mascota', shortcut: '' }
let pomodoro: PomodoroView = null
let media: TabMediaView = null
let peekUntil = 0

const openPill = () => (media ? MUSIC_PILL : OPEN_PILL)

export function getTabWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

/** Arriba en el centro de la pantalla principal (por debajo de la barra de tareas si está arriba). */
function tabBounds(): Rectangle {
  const area = screen.getPrimaryDisplay().workArea
  return { x: Math.round(area.x + (area.width - TAB_SIZE.width) / 2), y: area.y, ...TAB_SIZE }
}

/** Rectángulo de la píldora abierta en coordenadas de pantalla. */
function pillRect(): Rectangle | null {
  const w = getTabWindow()
  if (!w) return null
  const b = w.getBounds()
  const pill = openPill()
  return { x: b.x + (b.width - pill.width) / 2, y: b.y, width: pill.width, height: pill.height }
}

function poll(): void {
  pollTimer = null
  const w = getTabWindow()
  const rect = pillRect()
  if (!w || !rect || !w.isVisible()) return
  const distance = distanceToRect(screen.getCursorScreenPoint(), rect)
  // Recién cambiada la canción, se enseña abierta aunque el ratón esté lejos.
  const near = Date.now() < peekUntil ? 1 : nearness(distance)
  if (near !== lastNear) {
    lastNear = near
    w.webContents.send(IPC.tabNear, near)
  }
  const inside = distance === 0
  if (inside !== clickable) {
    clickable = inside
    w.setIgnoreMouseEvents(!inside, { forward: true })
  }
  pollTimer = setTimeout(poll, near > 0 ? POLL_NEAR_MS : POLL_FAR_MS)
}

function startPolling(): void {
  if (!pollTimer) poll()
}

function stopPolling(): void {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
  lastNear = -1
  clickable = false
}

export function createTabWindow(): BrowserWindow {
  win = new BrowserWindow({
    ...tabBounds(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    thickFrame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false, // hacer clic no roba el foco a la app activa
    title: 'Mascota: pestaña',
    webPreferences: secureWebPreferences(PRELOAD_PATH)
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setIgnoreMouseEvents(true, { forward: true })
  hardenWebContents(win.webContents)

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send(IPC.tabInfo, info)
    win?.webContents.send(IPC.tabPomodoro, pomodoro)
    win?.webContents.send(IPC.tabMedia, media)
  })
  win.on('show', startPolling)
  win.on('hide', stopPolling)
  win.on('closed', () => {
    stopPolling()
    win = null
  })
  // Si cambia la resolución o la barra de tareas, se vuelve a centrar.
  const recenter = () => getTabWindow()?.setBounds(tabBounds())
  screen.on('display-metrics-changed', recenter)
  screen.on('display-added', recenter)
  screen.on('display-removed', recenter)

  void loadPage(win, 'tab')
  return win
}

export function showTab(): void {
  const w = getTabWindow()
  if (!w) return
  w.setBounds(tabBounds())
  w.showInactive()
}

export function hideTab(): void {
  getTabWindow()?.hide()
}

/** Abajo del todo de la píldora, en pantalla: el robot cuelga justo debajo. */
export function tabAnchor(): { centerX: number; bottom: number } {
  const b = tabBounds()
  return { centerX: b.x + b.width / 2, bottom: b.y + openPill().height }
}

export function setTabInfo(name: string, accelerator: string, emoji?: string): void {
  info = { name, shortcut: formatAccelerator(accelerator), ...(emoji ? { emoji } : {}) }
  getTabWindow()?.webContents.send(IPC.tabInfo, info)
}

/** Canción que enseñar en la pestaña. `peek`: asomarse abierta un momento (canción nueva). */
export function setTabMedia(view: TabMediaView, peek = false): void {
  media = view
  if (peek && view) peekUntil = Date.now() + PEEK_MS
  getTabWindow()?.webContents.send(IPC.tabMedia, view)
}

export function sendTabPomodoro(view: PomodoroView): void {
  pomodoro = view
  getTabWindow()?.webContents.send(IPC.tabPomodoro, view)
}
