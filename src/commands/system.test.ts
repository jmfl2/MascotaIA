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

  it('entiende el volumen dicho con palabras', () => {
    expect(parseVolume('volumen al 50')).toEqual({ kind: 'set', level: 50 })
    expect(parseVolume('pon el volumen a 30 %')).toEqual({ kind: 'set', level: 30 })
    expect(parseVolume('sube el volumen')).toEqual({ kind: 'step', delta: 10 })
    expect(parseVolume('Súbelo un 5')).toEqual({ kind: 'step', delta: 5 })
    expect(parseVolume('baja el volumen 20')).toEqual({ kind: 'step', delta: -20 })
    expect(parseVolume('volumen más 15')).toEqual({ kind: 'step', delta: 15 })
    expect(parseVolume('volume down')).toEqual({ kind: 'step', delta: -10 })
    expect(parseVolume('volumen')).toBeNull()
  })

  it('las frases normales sacan la fila del volumen la primera', async () => {
    const { ctx, state } = fakeContext()
    for (const text of ['volumen al 50', 'sube el volumen', 'pon el volumen a 30']) {
      const [first] = await suggestFor(null, text, ctx)
      expect(first.command.id).toBe('system')
      await first.suggestion.run()
    }
    expect(state.ran).toEqual(['pc:vol:{"kind":"set","level":50}', 'pc:vol:{"kind":"step","delta":10}', 'pc:vol:{"kind":"set","level":30}'])
    // Una búsqueda que no habla del volumen no lo ofrece.
    const rows = await suggestFor(null, 'receta de 30 minutos', ctx)
    expect(rows.some((r) => r.suggestion.title.includes('volumen'))).toBe(false)
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
