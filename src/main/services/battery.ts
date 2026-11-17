/** Cuándo avisar de la batería (sin Electron, para probarlo). Lo usa src/main/status.ts. */
import type { BatteryReport } from '../../shared/ipc'

/** Avisos de batería baja: uno por cada umbral al bajar. */
export const LOW_LEVELS = [0.2, 0.1] as const

export type BatteryNotice = { kind: 'charging'; level: number } | { kind: 'low'; level: number; threshold: number }

/** Qué aviso toca con el nuevo dato, o ninguno. */
export function batteryNotice(prev: BatteryReport | null, next: BatteryReport, alreadyWarned: ReadonlySet<number>): BatteryNotice | null {
  // La primera lectura solo sirve de referencia: no se avisa al arrancar.
  if (!prev) return null
  // Un PC sin batería dice "cargando al 100 %" siempre: eso no es enchufar nada.
  if (next.charging && !prev.charging) return next.level < 1 ? { kind: 'charging', level: next.level } : null
  if (next.charging) return null
  // Al cruzar un umbral hacia abajo (si se salta varios, el más bajo).
  const crossed = LOW_LEVELS.filter((l) => next.level <= l && prev.level > l && !alreadyWarned.has(l))
  const threshold = crossed[crossed.length - 1]
  return threshold !== undefined ? { kind: 'low', level: next.level, threshold } : null
}
