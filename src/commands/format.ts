/** Formatos de fecha y tiempo en español, para subtítulos y avisos. */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`

function startOfDay(t: number): number {
  const d = new Date(t)
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
  if (diff < HOUR && days === 0) return `en ${formatDuration(Math.max(diff, 1000))} (${clock(d)})`
  if (days === 0) return `hoy a las ${clock(d)}`
  if (days === 1) return `mañana a las ${clock(d)}`
  return `el ${d.getDate()}/${d.getMonth() + 1} a las ${clock(d)}`
}

/** Cuándo ocurrió algo: "ahora", "hace 5 min", "hoy 9:12", "ayer", "12/11". */
export function formatAgo(at: number, now: number): string {
  const diff = now - at
  if (diff < MINUTE) return 'ahora'
  if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  if (days === 0) return `hoy ${clock(new Date(at))}`
  if (days === 1) return 'ayer'
  const d = new Date(at)
  return `${d.getDate()}/${d.getMonth() + 1}`
}
