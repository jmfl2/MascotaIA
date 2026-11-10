/**
 * Estado de ánimo del robot. El estado base depende de lo que pasa, por prioridad:
 *   aviso pendiente -> alerta · la IA trabajando -> pensando
 *   barra abierta -> escuchando · si no -> reposo
 * Encima se pueden lanzar reacciones breves (contento, confundido) que el
 * renderer deshace solo al cabo de un momento.
 */
import { sendRobotState } from './robotWindow'

let barOpen = false
let alert = false
let thinking = false

function sendBase(): void {
  sendRobotState(alert ? 'alert' : thinking ? 'thinking' : barOpen ? 'listening' : 'idle')
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
  setThinking(on: boolean): void {
    thinking = on
    sendBase()
  },
  flash(mood: 'happy' | 'confused'): void {
    sendRobotState(mood)
  }
}
