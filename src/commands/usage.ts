/**
 * Cuánto se usa cada app o favorito, para enseñar las más usadas al abrir la
 * barra. Sin Electron: el proceso principal lo guarda en usage.json.
 *
 * La puntuación mezcla frecuencia y lo reciente ("frecencia"): cada apertura
 * vale menos cuanto más antigua es, así que una app que usabas mucho hace
 * meses acaba bajando y deja sitio a las de ahora.
 */

export interface UsageRecord {
  id: string
  /** Puntuación acumulada (aperturas que pierden peso con el tiempo). */
  score: number
  /** Veces que se ha abierto en total. */
  count: number
  lastUsedAt: number
}

const DAY = 24 * 60 * 60_000
/** En cuántos días una apertura pasa a valer la mitad. */
export const HALF_LIFE_DAYS = 14
/** Por debajo de esto, el registro se olvida. */
const MIN_SCORE = 0.05
export const MAX_RECORDS = 300

/** Puntuación de un registro en el instante `now`. */
export function currentScore(r: UsageRecord, now: number): number {
  const days = Math.max(0, now - r.lastUsedAt) / DAY
  return r.score * 0.5 ** (days / HALF_LIFE_DAYS)
}

/** Suma una apertura al registro (o lo crea). Devuelve la lista nueva. */
export function recordUse(list: readonly UsageRecord[], id: string, now: number): UsageRecord[] {
  const prev = list.find((r) => r.id === id)
  const next: UsageRecord = prev
    ? { id, score: currentScore(prev, now) + 1, count: prev.count + 1, lastUsedAt: now }
    : { id, score: 1, count: 1, lastUsedAt: now }
  return [next, ...list.filter((r) => r.id !== id && currentScore(r, now) >= MIN_SCORE)].slice(0, MAX_RECORDS)
}

/** Ids ordenados de más a menos usado ahora mismo. */
export function rankUsage(list: readonly UsageRecord[], now: number): UsageRecord[] {
  return [...list]
    .filter((r) => currentScore(r, now) >= MIN_SCORE)
    .sort((a, b) => currentScore(b, now) - currentScore(a, now) || b.lastUsedAt - a.lastUsedAt)
}
