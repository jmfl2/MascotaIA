/**
 * Interpreta cuándo avisar a partir de lo que se escribe tras "rec":
 *
 *   10m sacar la ropa          -> dentro de 10 minutos
 *   1h30m llamar               -> dentro de 1 h 30 min
 *   en 20 minutos café         -> dentro de 20 minutos
 *   18:30 llamar a mamá        -> hoy a las 18:30 (mañana si ya ha pasado)
 *   a las 9 gimnasio           -> a las 9:00
 *   mañana 9:00 dentista       -> mañana a las 9:00
 *   mañana a las 8 correr      -> mañana a las 8:00
 *
 * También entiende inglés, sea cual sea el idioma de la interfaz:
 *
 *   in 20 minutes coffee       -> dentro de 20 minutos
 *   1 hour and 30 minutes call -> dentro de 1 h 30 min
 *   at 9 gym · 6:30pm call     -> a las 9:00 · a las 18:30
 *   tomorrow at 8am run        -> mañana a las 8:00
 *
 * Un número suelto ("rec 5 llamar") no vale: sería ambiguo ("5pm" sí).
 */
import { t } from '../shared/i18n'

export const MAX_REMINDER_MS = 30 * 24 * 60 * 60 * 1000 // 30 días

const UNIT_MS: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1_000 }

/** Unidad normalizada a h / m / s. */
function unitOf(raw: string): 'h' | 'm' | 's' {
  const u = raw.toLowerCase()
  if (u.startsWith('h')) return 'h'
  if (u.startsWith('m')) return 'm'
  return 's'
}

const UNIT = '(?:horas|hora|hours|hour|hrs|hr|h|minutos|minuto|minutes|minute|mins|min|m|segundos|segundo|seconds|second|segs|secs|seg|sec|s)'
const AMOUNT = `\\d{1,4}\\s*${UNIT}`
// Una o más cantidades ("1h30m", "1 hora y 30 minutos", "1 hour and 30 minutes") seguidas del texto.
const RELATIVE = new RegExp(`^(?:(?:en|in)\\s+)?((?:${AMOUNT}\\s*(?:(?:y|and)\\s+)?)+)(?=\\s|$)\\s*([\\s\\S]*)$`, 'i')
const PART = new RegExp(`(\\d{1,4})\\s*(${UNIT})`, 'gi')

// [hoy|mañana|today|tomorrow] [a la(s)|at] HH[:MM][h|am|pm]
const ABSOLUTE =
  /^(?:(hoy|mañana|manana|today|tomorrow)\s+)?(a\s+las?\s+|at\s+)?(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm|a\.m\.|p\.m\.)|\s*h)?(?=\s|$)\s*([\s\S]*)$/i

export interface ParsedReminder {
  dueAt: number
  text: string
}

export function parseReminder(input: string, now: Date): ParsedReminder | null {
  const s = input.trim()
  if (!s) return null
  return parseRelative(s, now) ?? parseAbsolute(s, now)
}

function parseRelative(s: string, now: Date): ParsedReminder | null {
  const match = RELATIVE.exec(s)
  if (!match) return null
  let ms = 0
  for (const part of match[1].matchAll(PART)) ms += Number(part[1]) * UNIT_MS[unitOf(part[2])]
  if (ms <= 0 || ms > MAX_REMINDER_MS) return null
  return { dueAt: now.getTime() + ms, text: cleanText(match[2]) }
}

function parseAbsolute(s: string, now: Date): ParsedReminder | null {
  const match = ABSOLUTE.exec(s)
  if (!match) return null
  const [, day, aLas, hh, mm, meridiem, rest] = match
  // Sin "a las", sin día, sin minutos y sin am/pm sería un número suelto: no lo aceptamos.
  if (!aLas && !day && mm === undefined && !meridiem) return null

  let hours = Number(hh)
  const minutes = mm === undefined ? 0 : Number(mm)
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    const pm = meridiem.toLowerCase().startsWith('p')
    hours = (hours % 12) + (pm ? 12 : 0)
  }
  if (hours > 23 || minutes > 59) return null

  const due = new Date(now)
  due.setHours(hours, minutes, 0, 0)
  const tomorrow = day !== undefined && !['hoy', 'today'].includes(day.toLowerCase())
  if (tomorrow) {
    due.setDate(due.getDate() + 1)
  } else if (due.getTime() <= now.getTime()) {
    if (day) return null // "hoy 8:00" cuando ya son las 9
    due.setDate(due.getDate() + 1)
  }
  return { dueAt: due.getTime(), text: cleanText(rest) }
}

function cleanText(raw: string | undefined): string {
  const text = (raw ?? '').trim().replace(/^(?:que|de|para|to|that|about)\s+/i, '')
  return text || t('Recordatorio', 'Reminder')
}
