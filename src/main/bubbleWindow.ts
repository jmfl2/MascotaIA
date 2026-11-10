/**
 * Bocadillo junto al robot: avisos (recordatorios, pomodoro) y ofertas
 * (portapapeles). Es una ventana aparte, transparente y que no roba el foco.
 *
 * Cada bocadillo tiene acciones cuyo código se queda aquí, en el proceso
 * principal; el renderer solo envía "pulsé la acción X del bocadillo Y".
 * Si el robot está oculto, los avisos importantes salen como notificación
 * de Windows. En modo pestaña, el robot baja para decirlo y luego vuelve a subir.
 */
import { BrowserWindow, Notification, screen } from 'electron'
import { IPC, type BubbleAction, type BubbleView } from '../shared/ipc'
import { newId } from './services/jsonFile'
import { loadPage, PRELOAD_PATH } from './paths'
import { needRobot, robotAvailable } from './dock'
import { getRobotBounds, ROBOT_SIZE } from './robotWindow'
import { hardenWebContents, secureWebPreferences } from './security'

/** Ancho fijo; el alto se ajusta al contenido. Incluye 14 px de margen para la sombra. */
const WIDTH = 300
const MARGIN = 14
/** Solape horizontal con la ventana del robot (su zona transparente). */
const OVERLAP = 34
const HIDE_TIMEOUT_MS = 400

/** Prioridad: un aviso nunca lo tapa una oferta del portapapeles. */
const PRIORITY: Record<BubbleView['kind'], number> = { chatter: 0, clipboard: 0, info: 1, favorite: 1, link: 2, pomodoro: 2, reminder: 3 }

export interface BubbleSpec {
  kind: BubbleView['kind']
  title: string
  text?: string
  actions?: Array<BubbleAction & { run: () => void }>
  timeoutMs?: number | null
  chime?: boolean
  /** Si el robot está oculto, mostrar como notificación de Windows. */
  notifyIfHidden?: boolean
  /** Al cerrarse sin pulsar ninguna acción (tiempo agotado o ×). */
  onDismiss?: () => void
  /** Al cerrarse por cualquier motivo. */
  onClose?: () => void
}

interface Active {
  view: BubbleView
  spec: BubbleSpec
}

let win: BrowserWindow | null = null
let active: Active | null = null
let height = 120
let hideTimer: NodeJS.Timeout | null = null

function getWin(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function createBubbleWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: WIDTH,
    height,
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
    focusable: false,
    title: 'Mascota: bocadillo',
    webPreferences: secureWebPreferences(PRELOAD_PATH)
  })
  win.setAlwaysOnTop(true, 'pop-up-menu')
  hardenWebContents(win.webContents)
  win.on('closed', () => {
    win = null
  })
  void loadPage(win, 'bubble')
  return win
}

/** Lado del robot con sitio para el bocadillo (izquierda si cabe). */
function chooseSide(): BubbleView['side'] {
  const robot = getRobotBounds()
  if (!robot) return 'left'
  const area = screen.getDisplayMatching(robot).workArea
  return robot.x + OVERLAP - WIDTH >= area.x ? 'left' : 'right'
}

/** Coloca el bocadillo a la altura de la cara del robot, dentro de la pantalla. */
export function repositionBubble(): void {
  const w = getWin()
  const robot = getRobotBounds()
  if (!w || !robot || !active) return
  const area = screen.getDisplayMatching(robot).workArea
  const x = active.view.side === 'left' ? robot.x + OVERLAP - WIDTH : robot.x + ROBOT_SIZE.width - OVERLAP
  const faceY = robot.y + ROBOT_SIZE.height * 0.45
  const y = Math.min(Math.max(faceY - height / 2, area.y), area.y + area.height - height)
  w.setBounds({ x: Math.round(x), y: Math.round(y), width: WIDTH, height: Math.round(height) })
}

/** Muestra un bocadillo. Devuelve su id (o null si no se mostró). */
export function showBubble(spec: BubbleSpec): string | null {
  if (active && PRIORITY[spec.kind] < PRIORITY[active.view.kind]) return null

  if (!robotAvailable()) {
    if (spec.notifyIfHidden && Notification.isSupported()) {
      new Notification({ title: spec.title, body: spec.text ?? '', silent: !spec.chime }).show()
    }
    return null
  }
  // En modo pestaña baja el robot; va antes de elegir el lado, que depende de dónde esté.
  needRobot('bubble', true)

  // Sustituye al anterior (sin llamar a su onDismiss: no lo cerró el usuario).
  active?.spec.onClose?.()
  const view: BubbleView = {
    id: newId(),
    kind: spec.kind,
    title: spec.title,
    text: spec.text,
    actions: (spec.actions ?? []).map(({ id, label, primary }) => ({ id, label, primary })),
    timeoutMs: spec.timeoutMs === undefined ? 6000 : spec.timeoutMs,
    side: chooseSide(),
    chime: spec.chime
  }
  active = { view, spec }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  repositionBubble()
  getWin()?.webContents.send(IPC.bubbleShow, view)
  return view.id
}

/** Cambia el texto del bocadillo sin volver a animarlo (p. ej. progreso de una descarga). */
export function updateBubble(id: string, patch: { title?: string; text?: string }): void {
  if (!active || active.view.id !== id) return
  active.view = { ...active.view, ...patch }
  getWin()?.webContents.send(IPC.bubbleUpdate, { id, ...patch })
}

/** Cierra el bocadillo actual con animación. */
export function closeBubble(): void {
  const w = getWin()
  if (!active || !w) return
  active.spec.onClose?.()
  active = null
  needRobot('bubble', false)
  w.webContents.send(IPC.bubbleHide)
  hideTimer = setTimeout(hideNow, HIDE_TIMEOUT_MS)
}

function hideNow(): void {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = null
  if (!active) getWin()?.hide()
}

// --- Mensajes del renderer (ya validado el remitente en index.ts) --------------------

export function bubbleResized(newHeight: number): void {
  if (!Number.isFinite(newHeight)) return
  height = Math.min(Math.max(Math.ceil(newHeight) + MARGIN * 2, 60), 400)
  repositionBubble()
  const w = getWin()
  if (w && active && !w.isVisible()) w.showInactive()
}

export function bubbleAction(bubbleId: string, actionId: string): void {
  if (!active || active.view.id !== bubbleId) return
  const action = active.spec.actions?.find((a) => a.id === actionId)
  if (!action) return
  closeBubble()
  action.run()
}

export function bubbleDismissed(bubbleId: string): void {
  if (!active || active.view.id !== bubbleId) return
  const { spec } = active
  closeBubble()
  spec.onDismiss?.()
}

export function bubbleHidden(): void {
  hideNow()
}

export function isBubbleShowing(kind?: BubbleView['kind']): boolean {
  return !!active && (!kind || active.view.kind === kind)
}

export function getBubbleWebContents() {
  return getWin()?.webContents
}

/** Un mensaje corto que se cierra solo (p. ej. "Nota guardada"). */
export function toast(text: string): void {
  showBubble({ kind: 'info', title: text, timeoutMs: 2200 })
}
