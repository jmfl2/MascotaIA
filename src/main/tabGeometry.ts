/** Cálculos de la pestaña de arriba, sin Electron para poder probarlos. */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Distancia (px) desde la que la pestaña empieza a crecer. */
export const NEAR_RADIUS = 140

/** Distancia del punto al rectángulo (0 si está dentro o en el borde). */
export function distanceToRect(p: { x: number; y: number }, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height))
  return Math.hypot(dx, dy)
}

/** Cercanía de 0 a 1, en pasos de 0,05 para no mandar un mensaje por cada píxel. */
export function nearness(distance: number, radius = NEAR_RADIUS): number {
  return Math.round(Math.min(1, Math.max(0, 1 - distance / radius)) * 20) / 20
}
