/**
 * Modo "hablador": comentarios espontáneos del robot (saludos, ánimos en el
 * pomodoro, recordar descansar). Solo si la personalidad está en "hablador",
 * nunca más de uno cada 20 minutos y nunca tapando otro aviso.
 */
import { screen } from 'electron'
import { isBarOpen } from './barWindow'
import { isBubbleShowing, showBubble } from './bubbleWindow'
import { pickGreeting, pickLine, type ChatterMoment } from './chatterLines'
import { robotMood } from './robotMood'
import { getConfig } from './store'

const MIN_GAP_MS = 20 * 60_000
const BREAK_AFTER_ACTIVE_MIN = 75
const CHECK_EVERY_MS = 60_000

let lastSpoke = 0
let activeMinutes = 0
let lastCursor = { x: Number.NaN, y: Number.NaN }
let nightNoticeDay = -1

const isChatty = () => getConfig().personality.chattiness === 'hablador'

/** Dice algo si toca. `force` ignora el tiempo mínimo entre comentarios (saludo inicial). */
function say(text: string, force = false): boolean {
  if (!isChatty() || isBarOpen() || isBubbleShowing()) return false
  if (!force && Date.now() - lastSpoke < MIN_GAP_MS) return false
  lastSpoke = Date.now()
  robotMood.flash('happy')
  showBubble({ kind: 'chatter', title: text, timeoutMs: 5000 })
  return true
}

/** Hay algo que comentar en un momento concreto (p. ej. mitad del pomodoro). */
export function chatterMoment(moment: ChatterMoment): void {
  say(pickLine(moment, Math.random(), getConfig().personality.name))
}

export function startChatter(): void {
  // Saludo al arrancar.
  setTimeout(() => say(pickGreeting(new Date().getHours(), Math.random(), getConfig().personality.name), true), 2500)

  setInterval(() => {
    const p = screen.getCursorScreenPoint()
    const moved = p.x !== lastCursor.x || p.y !== lastCursor.y
    lastCursor = p
    if (!moved) return // ausente: no cuenta como rato de trabajo
    activeMinutes++

    const now = new Date()
    if (activeMinutes >= BREAK_AFTER_ACTIVE_MIN && say(pickLine('break', Math.random(), getConfig().personality.name))) {
      activeMinutes = 0
    }
    // Trasnochando (una vez por noche).
    if (now.getHours() < 5 && now.getHours() >= 0 && now.getDate() !== nightNoticeDay) {
      if (say(pickLine('late', Math.random(), getConfig().personality.name))) nightNoticeDay = now.getDate()
    }
  }, CHECK_EVERY_MS)
}

/** Al volver de un rato sin tocar el ratón, el contador de "rato seguido" se reinicia. */
export function resetActivity(): void {
  activeMinutes = 0
}
