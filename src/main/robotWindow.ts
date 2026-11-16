/**
 * Ventana del robot: transparente, sin bordes, siempre encima y fuera de la
 * barra de tareas.
 *
 * Clics que atraviesan: la ventana ignora el ratón salvo cuando el cursor está
 * sobre el cuerpo del robot. Lo decide el proceso principal comparando la
 * posición global del cursor con la silueta, así funciona también mientras se
 * arrastra un archivo por encima (en ese caso el renderer no recibe eventos).
 */
import { BrowserWindow, screen, type Rectangle } from 'electron'
import type { Appearance } from '../shared/appearance'
import { IPC, type CursorOffset, type PomodoroView, type RobotState } from '../shared/ipc'
import { loadPage, PRELOAD_PATH } from './paths'
import { hardenWebContents, secureWebPreferences } from './security'
import { getConfig } from './store'
import { tabAnchor } from './tabWindow'

/** Tamaño de la ventana en DIP. Deja margen para sombra, rebotes y el "asomarse". */
export const ROBOT_SIZE = { width: 200, height: 200 }
/** ¿Suena música? (para mandarlo de nuevo si la página se recarga). */
let music = false
/** Fecha especial activa (id), para mandarla de nuevo si la página se recarga. */
let season: string | null = null
/** Centro de la cara del robot dentro de la ventana (coincide con el SVG). */
const FACE_CENTER = { x: 0.5, y: 0.51 }
/** Silueta sensible al ratón, igual que #hit en robot.html. */
const HIT = { x: 26, y: 20, width: 148, height: 152, radius: 56 }
/** Modo pestaña: cuánto se mete la ventana bajo la píldora (su parte de arriba es transparente). */
const DOCK_TUCK = 12
/** Lo que tarda en subir antes de ocultar la ventana (coincide con el muelle del renderer). */
const LEAVE_MS = 380

let win: BrowserWindow | null = null
let cursorTimer: NodeJS.Timeout | null = null
let lastCursor = { x: Number.NaN, y: Number.NaN }
/** null = desconocido: el próximo movimiento del cursor lo recalcula. */
let hovering: boolean | null = null
let onMoved: () => void = () => {}
let leaveTimer: NodeJS.Timeout | null = null

export function getRobotWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

/** Callback cuando el robot cambia de sitio (el bocadillo lo sigue). */
export function onRobotMoved(cb: () => void): void {
  onMoved = cb
}

/** ¿Está el punto (relativo a la ventana) dentro del rectángulo redondeado HIT? */
function insideHit(x: number, y: number): boolean {
  const { radius: r } = HIT
  const cx = Math.min(Math.max(x, HIT.x + r), HIT.x + HIT.width - r)
  const cy = Math.min(Math.max(y, HIT.y + r), HIT.y + HIT.height - r)
  const inBox = x >= HIT.x && x <= HIT.x + HIT.width && y >= HIT.y && y <= HIT.y + HIT.height
  return inBox && Math.hypot(x - cx, y - cy) <= r
}

/** Mueve la ventana conservando su tamaño (setPosition puede alterarlo con escalado DPI). */
function moveTo(x: number, y: number): void {
  win?.setBounds({ x: Math.round(x), y: Math.round(y), ...ROBOT_SIZE })
  onMoved()
}

export function createRobotWindow(): BrowserWindow {
  win = new BrowserWindow({
    ...ROBOT_SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false, // lo movemos nosotros (ver dragStart)
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    thickFrame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false, // hacer clic en el robot no roba el foco a la app activa
    title: 'Mascota',
    webPreferences: secureWebPreferences(PRELOAD_PATH)
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setIgnoreMouseEvents(true, { forward: true })
  hardenWebContents(win.webContents)

  // Al cargar (y en cada recarga en desarrollo) se le envía su skin.
  win.webContents.on('did-finish-load', () => {
    sendAppearance(getConfig().appearance)
    win?.webContents.send(IPC.robotMusic, music)
    win?.webContents.send(IPC.robotSeason, season)
  })
  win.on('show', startCursorTracking)
  win.on('hide', stopCursorTracking)
  win.on('closed', () => {
    stopCursorTracking()
    win = null
  })

  void loadPage(win, 'robot')
  return win
}

// --- Modo pestaña -------------------------------------------------------------
// El robot cuelga de la pestaña de arriba: baja al llamarlo y sube al terminar.

/** ¿Está fuera (visible y sin estar subiendo)? */
export function isRobotOut(): boolean {
  return isRobotVisible() && !leaveTimer
}

/** Baja el robot desde la pestaña. Si ya está fuera, no hace nada. */
export function enterDocked(): void {
  const w = getRobotWindow()
  if (!w) return
  if (leaveTimer) {
    // Estaba subiendo: vuelve a bajar desde donde esté.
    clearTimeout(leaveTimer)
    leaveTimer = null
    w.webContents.send(IPC.robotEnter)
    return
  }
  if (w.isVisible()) return
  // Al volver a mostrarse, se recalcula si el cursor está encima.
  hovering = null
  lastCursor = { x: Number.NaN, y: Number.NaN }
  w.setIgnoreMouseEvents(true, { forward: true })
  const anchor = tabAnchor()
  moveTo(anchor.centerX - ROBOT_SIZE.width / 2, anchor.bottom - DOCK_TUCK)
  w.webContents.send(IPC.robotEnter)
  w.showInactive()
}

/** Sube el robot a la pestaña y oculta la ventana al terminar. */
export function leaveDocked(): void {
  const w = getRobotWindow()
  if (!w || !w.isVisible() || leaveTimer) return
  w.webContents.send(IPC.robotLeave)
  leaveTimer = setTimeout(() => {
    leaveTimer = null
    getRobotWindow()?.hide()
  }, LEAVE_MS)
}

export function getRobotBounds(): Rectangle | null {
  return getRobotWindow()?.getBounds() ?? null
}

export function sendRobotState(state: RobotState): void {
  getRobotWindow()?.webContents.send(IPC.robotState, state)
}

export function sendAppearance(appearance: Appearance): void {
  getRobotWindow()?.webContents.send(IPC.robotAppearance, appearance)
}

export function sendRobotSeason(id: string | null): void {
  season = id
  getRobotWindow()?.webContents.send(IPC.robotSeason, id)
}

export function sendRobotMusic(playing: boolean): void {
  music = playing
  getRobotWindow()?.webContents.send(IPC.robotMusic, playing)
}

export function sendPomodoro(view: PomodoroView): void {
  getRobotWindow()?.webContents.send(IPC.robotPomodoro, view)
}

export function isRobotVisible(): boolean {
  return getRobotWindow()?.isVisible() ?? false
}

// --- Seguimiento del cursor -------------------------------------------------
// El ratón casi nunca está sobre la ventana, así que preguntamos su posición
// global unas 60 veces por segundo y enviamos solo los cambios.

function setHovering(value: boolean): void {
  const w = getRobotWindow()
  if (!w || value === hovering) return
  hovering = value
  w.setIgnoreMouseEvents(!value, { forward: true })
  w.webContents.send(IPC.robotHover, value)
}

function startCursorTracking(): void {
  if (cursorTimer) return
  cursorTimer = setInterval(() => {
    const w = getRobotWindow()
    if (!w) return
    const p = screen.getCursorScreenPoint()
    if (p.x === lastCursor.x && p.y === lastCursor.y) return
    lastCursor = p
    const b = w.getBounds()
    setHovering(insideHit(p.x - b.x, p.y - b.y))
    const offset: CursorOffset = {
      dx: p.x - (b.x + b.width * FACE_CENTER.x),
      dy: p.y - (b.y + b.height * FACE_CENTER.y)
    }
    w.webContents.send(IPC.robotCursor, offset)
  }, 16)
}

function stopCursorTracking(): void {
  if (cursorTimer) clearInterval(cursorTimer)
  cursorTimer = null
}

// --- Clic ------------------------------------------------------------------
// El robot cuelga de la isla: no se arrastra. Estas dos llamadas solo sirven
// para que el renderer distinga el clic (que abre o cierra la barra).

export function dragStart(): void {}

export function dragEnd(): { moved: boolean } {
  return { moved: false }
}
