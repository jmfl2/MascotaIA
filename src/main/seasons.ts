/**
 * Fechas especiales en marcha: se mira cada hora qué toca, se avisa al robot
 * (accesorios y partículas) y a la pestaña (un emoji), y se felicita una vez
 * por fecha y año.
 */
import { seasonFor, type Season } from '../shared/seasons'
import { tx } from '../shared/i18n'
import { showBubble } from './bubbleWindow'
import { robotMood } from './robotMood'
import { sendRobotSeason } from './robotWindow'
import { getConfig, setConfig } from './store'

const CHECK_EVERY_MS = 60 * 60_000

let current: Season | null = null
const listeners = new Set<() => void>()

/** La fecha especial activa (null si no hay o si están desactivadas). */
export function activeSeason(): Season | null {
  return current
}

/** La de hoy aunque estén desactivadas (para enseñarla en los ajustes). */
export function todaysSeason(): Season | null {
  return seasonFor(new Date())
}

export function onSeasonChange(cb: () => void): void {
  listeners.add(cb)
}

function greetOnce(season: Season): void {
  const key = `${season.id}-${new Date().getFullYear()}`
  const cfg = getConfig()
  if (cfg.lastSeasonGreeting === key || cfg.personality.chattiness === 'discreto') return
  setConfig({ lastSeasonGreeting: key })
  robotMood.flash('excited')
  showBubble({ kind: 'chatter', title: tx(season.greeting), timeoutMs: 6000 })
}

/** Vuelve a calcular la fecha especial (al arrancar, cada hora y al cambiar los ajustes). */
export function refreshSeason(): void {
  const next = getConfig().seasonal ? seasonFor(new Date()) : null
  if (next?.id !== current?.id) {
    current = next
    sendRobotSeason(next?.id ?? null)
    for (const cb of listeners) cb()
  }
  if (current) greetOnce(current)
}

export function startSeasons(): void {
  refreshSeason()
  setInterval(refreshSeason, CHECK_EVERY_MS)
}
