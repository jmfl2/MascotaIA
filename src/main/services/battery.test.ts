import { describe, expect, it } from 'vitest'
import { batteryNotice } from './battery'

describe('avisos de batería', () => {
  const none = new Set<number>()
  it('no avisa con la primera lectura ni en un PC sin batería', () => {
    expect(batteryNotice(null, { level: 0.05, charging: false }, none)).toBeNull()
    expect(batteryNotice({ level: 1, charging: false }, { level: 1, charging: true }, none)).toBeNull()
  })
  it('avisa al enchufar', () => {
    expect(batteryNotice({ level: 0.5, charging: false }, { level: 0.5, charging: true }, none)).toEqual({ kind: 'charging', level: 0.5 })
  })
  it('avisa al bajar del 20 % y del 10 %, una vez cada uno', () => {
    expect(batteryNotice({ level: 0.21, charging: false }, { level: 0.2, charging: false }, none)).toEqual({ kind: 'low', level: 0.2, threshold: 0.2 })
    expect(batteryNotice({ level: 0.21, charging: false }, { level: 0.2, charging: false }, new Set([0.2]))).toBeNull()
    expect(batteryNotice({ level: 0.25, charging: false }, { level: 0.08, charging: false }, none)).toEqual({ kind: 'low', level: 0.08, threshold: 0.1 })
  })
})
