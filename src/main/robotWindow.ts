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
import { getConfig, setConfig } from './store'
import { tabAnchor } from './tabWindow'

/** Tamaño de la ventana en DIP. Deja margen para sombra, rebotes y el "asomarse". */
export const ROBOT_SIZE = { width: 200, height: 200 }
/** Centro de la cara del robot dentro de la ventana (coincide con el SVG). */
const FACE_CENTER = { x: 0.5, y: 0.51 }
/** Silueta sensible al ratón, igual que #hit en robot.html. */
const HIT = { x: 26, y: 20, width: 148, height: 152, radius: 56 }
/** Margen respecto al borde de la pantalla al colocarlo por defecto. */
const EDGE_MARGIN = 24
/** Píxeles que hay que mover el ratón para que cuente como arrastre y no como clic. */
const DRAG_THRESHOLD = 4
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

/** Callback cuando el robot cambia de sitio (el bocadillo lo sigue). */
export function onRobotMoved(cb: () => void): void {
  onMoved = cb
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
  win.setIgnoreMouseEvents(true, { forward: true })
  hardenWebContents(win.webContents)

  win.once('ready-to-show', () => {
    // En modo pestaña empieza escondido: baja cuando se le llama.
    const { robotVisible, dockTop } = getConfig()
    if (robotVisible && !dockTop) win?.showInactive()
  })
  // Al cargar (y en cada recarga en desarrollo) se le envía su skin.
  win.webContents.on('did-finish-load', () => sendAppearance(getConfig().appearance))
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

/** Al volver al modo libre: a su sitio de siempre. */
export function placeFree(): void {
  if (leaveTimer) clearTimeout(leaveTimer)
  leaveTimer = null
  const pos = initialPosition()
  moveTo(pos.x, pos.y)
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

export function sendPomodoro(view: PomodoroView): void {
  getRobotWindow()?.webContents.send(IPC.robotPomodoro, view)
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
// global unas 60 veces por segundo y enviamos solo los cambios.

function setHovering(value: boolean): void {
  const w = getRobotWindow()
  if (!w || value === hovering) return
  hovering = value
  // Durante un arrastre siempre capturamos el ratón.
  if (!drag) w.setIgnoreMouseEvents(!value, { forward: true })
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

// --- Arrastre ---------------------------------------------------------------
// No usamos `-webkit-app-region: drag` porque se come los clics y no permite
// animar al robot mientras se arrastra. En su lugar seguimos el cursor desde aquí.

export function dragStart(): void {
  const w = getRobotWindow()
  // En modo pestaña el robot cuelga de la pestaña: no se arrastra (el clic sigue funcionando).
  if (!w || drag || getConfig().dockTop) return
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
  // Recalcula si el cursor sigue encima al soltar.
  hovering = null
  lastCursor = { x: Number.NaN, y: Number.NaN }
  return { moved }
}
