/** Formatos de fecha y tiempo (en el idioma de la interfaz), para subtítulos y avisos. */
import { t } from '../shared/i18n'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`
/** Día/mes en español, mes/día en inglés. */
const dayMonth = (d: Date) => t(`${d.getDate()}/${d.getMonth() + 1}`, `${d.getMonth() + 1}/${d.getDate()}`)

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Duración legible: "45 s", "10 min", "1 h 30 min". */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return `${Math.max(1, Math.round(ms / 1000))} s`
  const totalMin = Math.round(ms / MINUTE)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Cuenta atrás "mm:ss" (o "h:mm:ss"). */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/** Cuándo ocurrirá algo: "en 10 min (18:40)", "mañana a las 9:00", "el 12/11 a las 9:00". */
export function formatWhen(at: number, now: number): string {
  const d = new Date(at)
  const diff = at - now
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY)
  if (diff < HOUR && days === 0) {
    const inTime = formatDuration(Math.max(diff, 1000))
    return t(`en ${inTime} (${clock(d)})`, `in ${inTime} (${clock(d)})`)
  }
  if (days === 0) return t(`hoy a las ${clock(d)}`, `today at ${clock(d)}`)
  if (days === 1) return t(`mañana a las ${clock(d)}`, `tomorrow at ${clock(d)}`)
  return t(`el ${dayMonth(d)} a las ${clock(d)}`, `on ${dayMonth(d)} at ${clock(d)}`)
}

/** Cuándo ocurrió algo: "ahora", "hace 5 min", "hoy 9:12", "ayer", "12/11". */
export function formatAgo(at: number, now: number): string {
  const diff = now - at
  if (diff < MINUTE) return t('ahora', 'now')
  if (diff < HOUR) {
    const min = Math.floor(diff / MINUTE)
    return t(`hace ${min} min`, `${min} min ago`)
  }
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  if (days === 0) return t(`hoy ${clock(new Date(at))}`, `today ${clock(new Date(at))}`)
  if (days === 1) return t('ayer', 'yesterday')
  return dayMonth(new Date(at))
}
