/**
 * La mascota vive arriba, en la isla (como la Dynamic Island del iPhone).
 *
 * Los avisos salen dentro de la isla (ver bubbleWindow.ts). El robot solo baja
 * de ella mientras la barra está abierta, y solo si está activado "Bajar al
 * abrir la barra" (`robotWithBar`); al cerrarla vuelve a subir.
 */
import { enterDocked, getRobotWindow, isRobotVisible, leaveDocked } from './robotWindow'
import { getConfig, setConfig } from './store'
import { getTabWindow, hideTab, showTab } from './tabWindow'

export type PresenceReason = 'bar' | 'bubble' | 'drop'

/** Cuánto se queda fuera cuando ya no hace falta (para que no parezca que huye). */
const LINGER_MS = 900

const reasons = new Set<PresenceReason>()
let lingerTimer: NodeJS.Timeout | null = null

/** ¿Puede hablar la mascota (avisos en la isla)? Si no, los importantes van a Windows. */
export function robotAvailable(): boolean {
  return getConfig().robotVisible
}

/** ¿Tiene que estar el robot fuera ahora mismo? */
function robotWanted(): boolean {
  const { robotVisible, robotWithBar } = getConfig()
  return robotVisible && robotWithBar && reasons.has('bar')
}

/** Baja o sube el robot según lo que haga falta ahora. */
function syncRobot(): void {
  if (robotWanted()) {
    if (lingerTimer) clearTimeout(lingerTimer)
    lingerTimer = null
    enterDocked()
  } else if (isRobotVisible() && !lingerTimer) {
    lingerTimer = setTimeout(() => {
      lingerTimer = null
      if (!robotWanted()) leaveDocked()
    }, LINGER_MS)
  }
}

/** Marca o quita un motivo para que el robot esté fuera (solo la barra lo hace bajar). */
export function needRobot(reason: PresenceReason, on: boolean): void {
  if (on) reasons.add(reason)
  else reasons.delete(reason)
  syncRobot()
}

/** Cambia "Bajar al abrir la barra" (si la barra está abierta, se nota al momento). */
export function setRobotWithBar(on: boolean): void {
  setConfig({ robotWithBar: on })
  syncRobot()
}

/** Cuánto espera a que le sueltes algo después de acercarlo a la isla. */
const DROP_WAIT_MS = 6000
let dropTimer: NodeJS.Timeout | null = null

/** Se está arrastrando un archivo sobre la isla: espera un rato (cada aviso alarga la espera). */
export function dropIncoming(): void {
  needRobot('drop', true)
  if (dropTimer) clearTimeout(dropTimer)
  dropTimer = setTimeout(() => {
    dropTimer = null
    needRobot('drop', false)
  }, DROP_WAIT_MS)
}

/** Ya se soltó: deja de esperar. */
export function dropDone(): void {
  if (dropTimer) clearTimeout(dropTimer)
  dropTimer = null
  needRobot('drop', false)
}

/** ¿Se ve la mascota (la isla)? */
export function mascotVisible(): boolean {
  return getTabWindow()?.isVisible() ?? false
}

/** Mostrar u ocultar la mascota desde la bandeja, el menú contextual o los ajustes. */
export function setMascotVisible(visible: boolean): void {
  setConfig({ robotVisible: visible })
  if (visible) {
    showTab()
    syncRobot()
  } else {
    hideTab()
    if (lingerTimer) clearTimeout(lingerTimer)
    lingerTimer = null
    getRobotWindow()?.hide()
  }
}

/** Que la mascota se vea (al abrir la app a mano o desde la bandeja si estaba oculta). */
export function revealMascot(): void {
  if (!mascotVisible()) setMascotVisible(true)
}

/** Al arrancar, cuando la isla está lista para pintarse. */
export function showInitialTab(): void {
  if (getConfig().robotVisible) showTab()
}
