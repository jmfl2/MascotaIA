import { describe, expect, it } from 'vitest'
import { suggestFor } from './engine'
import { parseInput } from './index'
import { fakeContext } from './testing'

describe('control del PC', () => {
  it('cualquier cosa sobre el volumen ofrece solo la barra', async () => {
    const { ctx } = fakeContext()
    for (const text of ['volumen al 50', 'sube el volumen', 'pon el volumen a 30', 'silencio']) {
      const rows = await suggestFor(null, text, ctx)
      expect(rows[0].suggestion.title).toBe('Barra de volumen')
      expect(rows.some((r) => /Subir|Bajar|Silenciar|Poner el volumen/.test(r.suggestion.title))).toBe(false)
    }
    const { query } = parseInput('volumen 30')
    const [first] = await suggestFor('system', query, ctx)
    expect(first?.suggestion.title).toBe('Barra de volumen')
    // Una búsqueda que no habla del volumen no lo ofrece.
    expect((await suggestFor(null, 'receta de 30 minutos', ctx)).some((r) => r.command.id === 'system')).toBe(false)
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

describe('barra de volumen', () => {
  it('"volumen" a secas ofrece la barra la primera', async () => {
    const { ctx, state } = fakeContext()
    const [first] = await suggestFor(null, 'volumen', ctx)
    expect(first.suggestion.title).toBe('Barra de volumen')
    await first.suggestion.run()
    expect(state.ran).toEqual(['pc:vol-bar'])
  })
})
