import { describe, expect, it } from 'vitest'
import { suggestFor } from './engine'
import { parseInput } from './index'
import { parseVolume } from './system'
import { fakeContext } from './testing'

describe('control del PC', () => {
  it('entiende el volumen', () => {
    expect(parseVolume('30')).toEqual({ kind: 'set', level: 30 })
    expect(parseVolume('volumen 45 %')).toEqual({ kind: 'set', level: 45 })
    expect(parseVolume('+10')).toEqual({ kind: 'step', delta: 10 })
    expect(parseVolume('vol -5')).toEqual({ kind: 'step', delta: -5 })
    expect(parseVolume('250')).toBeNull()
    expect(parseVolume('alto')).toBeNull()
  })

  it('"volumen 30" pone el volumen', async () => {
    const { ctx, state } = fakeContext()
    const { command, query } = parseInput('volumen 30')
    expect(command?.id).toBe('system')
    const [first] = await suggestFor('system', query, ctx)
    await first.suggestion.run()
    expect(state.ran).toEqual(['pc:vol:{"kind":"set","level":30}'])
  })

  it('"bloquear" sin prefijo lo ofrece el primero', async () => {
    const { ctx, state } = fakeContext()
    const rows = await suggestFor(null, 'bloquear', ctx)
    expect(rows[0].suggestion.title).toBe('Bloquear el PC')
    await rows[0].suggestion.run()
    expect(state.ran).toEqual(['pc:lock'])
  })

  it('con el prefijo "pc" lista todo', async () => {
    const { ctx } = fakeContext()
    const titles = (await suggestFor('system', '', ctx)).map((r) => r.suggestion.title)
    expect(titles).toContain('Apagar el PC')
    expect(titles).toContain('Modo oscuro de Windows')
  })
})
