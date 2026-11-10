/**
 * Estado de ánimo del robot. El estado base depende de lo que pasa:
 *   barra abierta -> escuchando · aviso pendiente -> alerta · si no -> reposo
 * Encima se pueden lanzar reacciones breves (contento, confundido) que el
 * renderer deshace solo al cabo de un momento.
 */
import { sendRobotState } from './robotWindow'

let barOpen = false
let alert = false

function sendBase(): void {
  sendRobotState(barOpen ? 'listening' : alert ? 'alert' : 'idle')
}

export const robotMood = {
  setBarOpen(open: boolean): void {
    barOpen = open
    sendBase()
  },
  setAlert(on: boolean): void {
    alert = on
    sendBase()
  },
  flash(mood: 'happy' | 'confused'): void {
    sendRobotState(mood)
  }
}
