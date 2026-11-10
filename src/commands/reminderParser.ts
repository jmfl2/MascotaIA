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
 * Un número suelto ("rec 5 llamar") no vale: sería ambiguo.
 */

export const MAX_REMINDER_MS = 30 * 24 * 60 * 60 * 1000 // 30 días
const DEFAULT_TEXT = 'Recordatorio'

const UNIT_MS: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1_000 }

/** Unidad normalizada a h / m / s. */
function unitOf(raw: string): 'h' | 'm' | 's' {
  const u = raw.toLowerCase()
  if (u.startsWith('h')) return 'h'
  if (u.startsWith('m')) return 'm'
  return 's'
}

const UNIT = '(?:horas|hora|hrs|hr|h|minutos|minuto|mins|min|m|segundos|segundo|segs|seg|s)'
const AMOUNT = `\\d{1,4}\\s*${UNIT}`
// Una o más cantidades ("1h30m", "1 hora y 30 minutos") seguidas del texto.
const RELATIVE = new RegExp(`^(?:en\\s+)?((?:${AMOUNT}\\s*(?:y\\s+)?)+)(?=\\s|$)\\s*([\\s\\S]*)$`, 'i')
const PART = new RegExp(`(\\d{1,4})\\s*(${UNIT})`, 'gi')

// [hoy|mañana] [a la(s)] HH[:MM][h]
const ABSOLUTE = /^(?:(hoy|mañana|manana)\s+)?(a\s+las?\s+)?(\d{1,2})(?::(\d{2}))?(?:\s*h\b)?(?=\s|$)\s*([\s\S]*)$/i

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
  const [, day, aLas, hh, mm, rest] = match
  // Sin "a las", sin día y sin minutos sería un número suelto: no lo aceptamos.
  if (!aLas && !day && mm === undefined) return null

  const hours = Number(hh)
  const minutes = mm === undefined ? 0 : Number(mm)
  if (hours > 23 || minutes > 59) return null

  const due = new Date(now)
  due.setHours(hours, minutes, 0, 0)
  const tomorrow = day !== undefined && day.toLowerCase() !== 'hoy'
  if (tomorrow) {
    due.setDate(due.getDate() + 1)
  } else if (due.getTime() <= now.getTime()) {
    if (day) return null // "hoy 8:00" cuando ya son las 9
    due.setDate(due.getDate() + 1)
  }
  return { dueAt: due.getTime(), text: cleanText(rest) }
}

function cleanText(raw: string | undefined): string {
  const text = (raw ?? '').trim().replace(/^(?:que|de|para)\s+/i, '')
  return text || DEFAULT_TEXT
}
