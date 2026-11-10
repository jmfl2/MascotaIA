/**
 * Ventana de la barra de comandos (tipo Spotlight). Es transparente: el panel
 * de cristal con esquinas de 24 px y su sombra se dibujan con CSS.
 *
 * Se crea una sola vez y se muestra u oculta, así abre al instante.
 * Para que el cierre se vea animado, el proceso principal pide al renderer
 * que cierre (IPC.barClose) y oculta la ventana cuando este avisa (IPC.barHidden).
 */
import { BrowserWindow, screen } from 'electron'
import { IPC } from '../shared/ipc'
import { loadPage, PRELOAD_PATH } from './paths'
import { hardenWebContents, secureWebPreferences } from './security'
import { getConfig } from './store'

/** Panel de 680 px + 20 px de margen por lado para la sombra. */
const BAR_SIZE = { width: 720, height: 480 }
/** Altura a la que aparece, como fracción de la pantalla. */
const BAR_TOP = 0.2
/** Modo pestaña: deja sitio arriba para el robot, que cuelga de la pestaña. */
const BAR_MIN_TOP_DOCKED = 185
/** Si el renderer no confirma el cierre en este tiempo, ocultamos igualmente. */
const CLOSE_TIMEOUT_MS = 400

let win: BrowserWindow | null = null
let open = false
let closeTimer: NodeJS.Timeout | null = null
let onVisibilityChange: (open: boolean) => void = () => {}

export function getBarWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function isBarOpen(): boolean {
  return open
}

/** Callback para que el robot reaccione cuando la barra se abre o se cierra. */
export function onBarVisibilityChange(cb: (open: boolean) => void): void {
  onVisibilityChange = cb
}

export function createBarWindow(): BrowserWindow {
  win = new BrowserWindow({
    ...BAR_SIZE,
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
    title: 'Mascota: barra de comandos',
    webPreferences: secureWebPreferences(PRELOAD_PATH)
  })
  win.setAlwaysOnTop(true, 'pop-up-menu')
  hardenWebContents(win.webContents)

  // Al hacer clic fuera (otra ventana toma el foco) la barra se cierra.
  win.on('blur', () => closeBar())
  win.on('closed', () => {
    win = null
    open = false
  })

  void loadPage(win, 'bar')
  return win
}

/** Centra la barra en la pantalla donde está el cursor. */
function placeOnActiveDisplay(w: BrowserWindow): void {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const top = area.height * BAR_TOP
  w.setBounds({
    x: Math.round(area.x + (area.width - BAR_SIZE.width) / 2),
    y: Math.round(area.y + (getConfig().dockTop ? Math.max(top, BAR_MIN_TOP_DOCKED) : top)),
    ...BAR_SIZE
  })
}

export function openBar(): void {
  const w = getBarWindow()
  if (!w) return
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (!open) placeOnActiveDisplay(w)
  open = true
  w.show()
  w.focus()
  w.webContents.send(IPC.barOpen)
  onVisibilityChange(true)
}

/** Pide al renderer la animación de cierre; ocultamos al terminar. */
export function closeBar(): void {
  const w = getBarWindow()
  if (!w || !open) return
  open = false
  w.webContents.send(IPC.barClose)
  onVisibilityChange(false)
  closeTimer = setTimeout(hideNow, CLOSE_TIMEOUT_MS)
}

export function toggleBar(): void {
  if (open) closeBar()
  else openBar()
}

/** El renderer terminó de animar el cierre. */
export function barHidden(): void {
  if (open) return // se volvió a abrir mientras se cerraba
  hideNow()
}

function hideNow(): void {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (!open) getBarWindow()?.hide()
}
