import { describe, expect, it } from 'vitest'
import { distanceToRect, NEAR_RADIUS, nearness } from './tabGeometry'

describe('pestaña de arriba', () => {
  const pill = { x: 100, y: 0, width: 200, height: 34 }

  it('mide la distancia al borde más cercano de la píldora', () => {
    expect(distanceToRect({ x: 150, y: 10 }, pill)).toBe(0) // dentro
    expect(distanceToRect({ x: 200, y: 84 }, pill)).toBe(50) // justo debajo
    expect(distanceToRect({ x: 40, y: 10 }, pill)).toBe(60) // a la izquierda
    expect(distanceToRect({ x: 330, y: 74 }, pill)).toBe(50) // en diagonal (30, 40)
  })

  it('crece de 0 a 1 al acercarse, en pasos que no saturan el IPC', () => {
    expect(nearness(0)).toBe(1)
    expect(nearness(NEAR_RADIUS)).toBe(0)
    expect(nearness(NEAR_RADIUS * 5)).toBe(0)
    expect(nearness(NEAR_RADIUS / 2)).toBe(0.5)
    expect(nearness(NEAR_RADIUS * 0.51)).toBe(0.5) // redondeado al paso de 0,05
  })
})
