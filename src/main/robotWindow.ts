/**
 * Ventana del robot: transparente, sin bordes, siempre encima y fuera de la
 * barra de tareas. Por defecto deja pasar los clics al escritorio; el renderer
 * avisa cuando el ratón está sobre el cuerpo del robot para capturarlos.
 */
import { BrowserWindow, screen, type Rectangle } from 'electron'
import { IPC, type CursorOffset, type RobotState } from '../shared/ipc'
import { loadPage, PRELOAD_PATH } from './paths'
import { hardenWebContents, secureWebPreferences } from './security'
import { getConfig, setConfig } from './store'

/** Tamaño de la ventana en DIP. Deja margen para sombra, rebotes y el "asomarse". */
export const ROBOT_SIZE = { width: 200, height: 200 }
/** Centro de la cara del robot dentro de la ventana (coincide con el SVG). */
const FACE_CENTER = { x: 0.5, y: 0.51 }
/** Margen respecto al borde de la pantalla al colocarlo por defecto. */
const EDGE_MARGIN = 24
/** Píxeles que hay que mover el ratón para que cuente como arrastre y no como clic. */
const DRAG_THRESHOLD = 4

let win: BrowserWindow | null = null
let cursorTimer: NodeJS.Timeout | null = null
let lastCursor = { x: Number.NaN, y: Number.NaN }

interface DragState {
  startCursor: { x: number; y: number }
  startPos: { x: number; y: number }
  moved: boolean
  timer: NodeJS.Timeout
}
let drag: DragState | null = null

export function getRobotWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

/** Ajusta una posición para que el robot quede entero dentro de la pantalla más cercana. */
function clampToDisplay(x: number, y: number): { x: number; y: number } {
  const center = { x: Math.round(x + ROBOT_SIZE.width / 2), y: Math.round(y + ROBOT_SIZE.height / 2) }
  const area = screen.getDisplayNearestPoint(center).workArea
  return {
    x: Math.round(Math.min(Math.max(x, area.x), area.x + area.width - ROBOT_SIZE.width)),
    y: Math.round(Math.min(Math.max(y, area.y), area.y + area.height - ROBOT_SIZE.height))
  }
}

/** Posición inicial: la guardada (si sigue siendo visible) o abajo a la derecha. */
function initialPosition(): { x: number; y: number } {
  const saved = getConfig().robotPosition
  if (saved) {
    const visible = screen.getAllDisplays().some((d) => intersects(d.workArea, { ...saved, ...ROBOT_SIZE }))
    if (visible) return clampToDisplay(saved.x, saved.y)
  }
  const area = screen.getPrimaryDisplay().workArea
  return {
    x: area.x + area.width - ROBOT_SIZE.width - EDGE_MARGIN,
    y: area.y + area.height - ROBOT_SIZE.height - EDGE_MARGIN
  }
}

function intersects(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** Mueve la ventana conservando su tamaño (setPosition puede alterarlo con escalado DPI). */
function moveTo(x: number, y: number): void {
  win?.setBounds({ x: Math.round(x), y: Math.round(y), ...ROBOT_SIZE })
}

export function createRobotWindow(): BrowserWindow {
  const pos = initialPosition()
  win = new BrowserWindow({
    ...ROBOT_SIZE,
    ...pos,
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
  // Las zonas transparentes dejan pasar los clics; `forward` mantiene los
  // eventos de movimiento para saber cuándo el ratón entra en el robot.
  win.setIgnoreMouseEvents(true, { forward: true })
  hardenWebContents(win.webContents)

  win.once('ready-to-show', () => {
    if (getConfig().robotVisible) win?.showInactive()
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

export function setRobotIgnoreMouse(ignore: boolean): void {
  // Durante un arrastre siempre capturamos el ratón.
  if (drag && ignore) return
  getRobotWindow()?.setIgnoreMouseEvents(ignore, { forward: true })
}

export function sendRobotState(state: RobotState): void {
  getRobotWindow()?.webContents.send(IPC.robotState, state)
}

export function setRobotVisible(visible: boolean): void {
  const w = getRobotWindow()
  if (!w) return
  if (visible) w.showInactive()
  else w.hide()
  setConfig({ robotVisible: visible })
}

export function isRobotVisible(): boolean {
  return getRobotWindow()?.isVisible() ?? false
}

// --- Seguimiento del cursor -------------------------------------------------
// El ratón casi nunca está sobre la ventana, así que preguntamos su posición
// global unas 30 veces por segundo y enviamos solo los cambios.

function startCursorTracking(): void {
  if (cursorTimer) return
  cursorTimer = setInterval(() => {
    const w = getRobotWindow()
    if (!w) return
    const p = screen.getCursorScreenPoint()
    if (p.x === lastCursor.x && p.y === lastCursor.y) return
    lastCursor = p
    const b = w.getBounds()
    const offset: CursorOffset = {
      dx: p.x - (b.x + b.width * FACE_CENTER.x),
      dy: p.y - (b.y + b.height * FACE_CENTER.y)
    }
    w.webContents.send(IPC.robotCursor, offset)
  }, 33)
}

function stopCursorTracking(): void {
  if (cursorTimer) clearInterval(cursorTimer)
  cursorTimer = null
}

// --- Arrastre ---------------------------------------------------------------
// No usamos `-webkit-app-region: drag` porque se come los clics y no permite
// animar al robot mientras se arrastra. En su lugar seguimos el cursor desde aquí.

export function dragStart(): void {
  const w = getRobotWindow()
  if (!w || drag) return
  const [x, y] = w.getPosition()
  const state: DragState = {
    startCursor: screen.getCursorScreenPoint(),
    startPos: { x, y },
    moved: false,
    timer: setInterval(() => {
      const p = screen.getCursorScreenPoint()
      const dx = p.x - state.startCursor.x
      const dy = p.y - state.startCursor.y
      if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      if (!state.moved) {
        state.moved = true
        w.webContents.send(IPC.robotDragMoving)
      }
      moveTo(state.startPos.x + dx, state.startPos.y + dy)
    }, 8)
  }
  drag = state
  w.setIgnoreMouseEvents(false)
}

export function dragEnd(): { moved: boolean } {
  if (!drag) return { moved: false }
  clearInterval(drag.timer)
  const { moved } = drag
  drag = null
  const w = getRobotWindow()
  if (w && moved) {
    const [x, y] = w.getPosition()
    const pos = clampToDisplay(x, y)
    moveTo(pos.x, pos.y)
    setConfig({ robotPosition: pos })
  }
  return { moved }
}
