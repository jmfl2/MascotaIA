/**
 * Dónde vive la mascota: siempre en pantalla (modo libre) o escondida en una
 * pestaña arriba (modo pestaña).
 *
 * En modo pestaña el robot baja cuando hay un motivo (la barra abierta, un
 * bocadillo que enseñar) y vuelve a subir un momento después de que no quede
 * ninguno. En modo libre todo esto no hace nada: el robot está siempre fuera.
 */
import { enterDocked, getRobotWindow, isRobotVisible, leaveDocked, placeFree, setRobotVisible } from './robotWindow'
import { getConfig, setConfig } from './store'
import { getTabWindow, hideTab, showTab } from './tabWindow'

export type PresenceReason = 'bar' | 'bubble' | 'drop'

/** Cuánto se queda fuera cuando ya no hace falta (para que no parezca que huye). */
const LINGER_MS = 900

const reasons = new Set<PresenceReason>()
let lingerTimer: NodeJS.Timeout | null = null

export function isDocked(): boolean {
  return getConfig().dockTop
}

/** ¿Puede hablar el robot (bocadillos)? Si no, los avisos importantes van a Windows. */
export function robotAvailable(): boolean {
  return isDocked() ? getConfig().robotVisible : isRobotVisible()
}

/** Marca o quita un motivo para que el robot esté fuera. */
export function needRobot(reason: PresenceReason, on: boolean): void {
  if (on) reasons.add(reason)
  else reasons.delete(reason)
  if (!isDocked()) return

  if (reasons.size) {
    if (lingerTimer) clearTimeout(lingerTimer)
    lingerTimer = null
    if (getConfig().robotVisible) enterDocked()
  } else if (!lingerTimer) {
    lingerTimer = setTimeout(() => {
      lingerTimer = null
      if (!reasons.size) leaveDocked()
    }, LINGER_MS)
  }
}

/** Cuánto espera el robot fuera a que le sueltes algo después de acercarlo a la pestaña. */
const DROP_WAIT_MS = 6000
let dropTimer: NodeJS.Timeout | null = null

/**
 * Se está arrastrando un archivo sobre la pestaña: el robot baja a recogerlo y
 * espera un rato (cada nuevo aviso alarga la espera).
 */
export function dropIncoming(): void {
  needRobot('drop', true)
  if (dropTimer) clearTimeout(dropTimer)
  dropTimer = setTimeout(() => {
    dropTimer = null
    needRobot('drop', false)
  }, DROP_WAIT_MS)
}

/** Ya se soltó (en el robot o en la pestaña): deja de esperar; el bocadillo lo mantiene fuera. */
export function dropDone(): void {
  if (dropTimer) clearTimeout(dropTimer)
  dropTimer = null
  needRobot('drop', false)
}

/** ¿Se ve la mascota? (el robot en modo libre, la pestaña en modo pestaña). */
export function mascotVisible(): boolean {
  return isDocked() ? (getTabWindow()?.isVisible() ?? false) : isRobotVisible()
}

/** Mostrar u ocultar la mascota desde la bandeja o el menú contextual. */
export function setMascotVisible(visible: boolean): void {
  if (!isDocked()) return setRobotVisible(visible)
  setConfig({ robotVisible: visible })
  if (visible) {
    showTab()
    if (reasons.size) enterDocked()
  } else {
    hideTab()
    getRobotWindow()?.hide()
  }
}

/** Cambia de modo en caliente. */
export function setDocked(docked: boolean): void {
  if (docked === isDocked()) return
  setConfig({ dockTop: docked })
  const visible = getConfig().robotVisible
  if (docked) {
    getRobotWindow()?.hide()
    if (visible) showTab()
    if (visible && reasons.size) enterDocked()
  } else {
    if (lingerTimer) clearTimeout(lingerTimer)
    lingerTimer = null
    hideTab()
    placeFree()
    if (visible) getRobotWindow()?.showInactive()
  }
}

/** Al arrancar, cuando la pestaña está lista para pintarse. */
export function showInitialTab(): void {
  if (isDocked() && getConfig().robotVisible) showTab()
}
