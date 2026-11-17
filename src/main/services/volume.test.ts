import { describe, expect, it } from 'vitest'
import { parseVolumeReply, volumeCommand } from './volume'

describe('volumen: órdenes y respuestas', () => {
  it('solo manda órdenes fijas con números válidos', () => {
    expect(volumeCommand({ kind: 'get' })).toBe('get')
    expect(volumeCommand({ kind: 'mute' })).toBe('mute')
    expect(volumeCommand({ kind: 'set', level: 42.4 })).toBe('set 42')
    expect(volumeCommand({ kind: 'set', level: 250 })).toBe('set 100')
    expect(volumeCommand({ kind: 'step', delta: -12 })).toBe('step -12')
    expect(volumeCommand({ kind: 'set', level: Number.NaN })).toBeNull()
  })
  it('lee la respuesta del script', () => {
    expect(parseVolumeReply('76|False')).toEqual({ level: 76, muted: false })
    expect(parseVolumeReply('0|True\r')).toEqual({ level: 0, muted: true })
    expect(parseVolumeReply('error')).toBeNull()
  })
})
