import { describe, expect, it } from 'vitest'
import { ACCESSORIES, slotOf, validateAppearance } from './appearance'
import { SEASONS, seasonFor } from './seasons'

const on = (month: number, day: number) => seasonFor(new Date(2026, month - 1, day, 12))?.id ?? null

describe('fechas especiales', () => {
  it.each([
    [12, 1, 'navidad'],
    [12, 24, 'navidad'],
    [12, 31, 'ano-nuevo'],
    [1, 1, 'ano-nuevo'],
    [1, 6, 'navidad'],
    [1, 7, null],
    [10, 23, null],
    [10, 31, 'halloween'],
    [11, 1, 'halloween'],
    [11, 2, null],
    [2, 14, 'san-valentin'],
    [2, 15, null],
    [7, 15, null]
  ])('%i/%i -> %s', (m, d, expected) => {
    expect(on(m, d)).toBe(expected)
  })

  it('cada fecha usa accesorios que existen, de zonas distintas', () => {
    const ids = new Set<string>(ACCESSORIES.map((a) => a.id))
    for (const season of SEASONS) {
      for (const acc of season.accessories) expect(ids.has(acc)).toBe(true)
      const slots = season.accessories.map(slotOf)
      expect(new Set(slots).size).toBe(slots.length)
    }
  })
})

describe('personalización', () => {
  it('forma de los ojos válida o la normal', () => {
    expect(validateAppearance({ eyeShape: 'corazones' }).eyeShape).toBe('corazones')
    expect(validateAppearance({ eyeShape: 'láser' }).eyeShape).toBe('normal')
  })

  it('accesorios con identificadores únicos', () => {
    const ids = ACCESSORIES.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(45)
  })
})
