/**
 * Dónde vive la mascota: siempre en pantalla (modo libre) o escondida en una
 * pestaña arriba (modo pestaña).
 *
 * En modo pestaña (la isla de arriba, como en el iPhone) el robot no baja a la
 * pantalla: los avisos salen dentro de la isla (ver bubbleWindow.ts). En modo
 * libre el robot está siempre fuera.
 */
import { getRobotWindow, isRobotVisible, leaveDocked, placeFree, setRobotVisible } from './robotWindow'
import { getConfig, setConfig } from './store'
import { getTabWindow, hideTab, showTab } from './tabWindow'

export type PresenceReason = 'bar' | 'bubble' | 'drop'

const reasons = new Set<PresenceReason>()

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
  // En la isla el robot se queda arriba: todo pasa dentro de la píldora.
  if (isDocked() && isRobotVisible()) leaveDocked()
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
  } else {
    hideTab()
    getRobotWindow()?.hide()
  }
}

/**
 * Cambia de modo en caliente. Al cambiar de modo la mascota siempre se ve:
 * si se había ocultado antes, cambiar de modo y no ver nada parece un fallo.
 */
export function setDocked(docked: boolean): void {
  if (docked === isDocked()) return
  setConfig({ dockTop: docked, robotVisible: true })
  if (docked) {
    getRobotWindow()?.hide()
    showTab()
  } else {
    hideTab()
    placeFree()
    setRobotVisible(true)
  }
}

/** Que la mascota se vea (al abrir la app a mano o desde la bandeja si estaba oculta). */
export function revealMascot(): void {
  if (!mascotVisible()) setMascotVisible(true)
}

/** Al arrancar, cuando la pestaña está lista para pintarse. */
export function showInitialTab(): void {
  if (isDocked() && getConfig().robotVisible) showTab()
}
