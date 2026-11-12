import { describe, expect, it } from 'vitest'
import { chatSystemPrompt } from '../ai/prompts'
import { suggestFor } from './engine'
import { buildCommandUrl, parseInput } from './index'
import { fakeContext } from './testing'

describe('preguntar a otras IAs', () => {
  const url = (id: string, q: string) => {
    const r = buildCommandUrl(id, q)
    if (!r.ok) throw new Error(r.error)
    return r.url
  }

  it('abre cada web con la pregunta escrita', () => {
    expect(url('chatgpt', '¿qué es una API?')).toBe('https://chatgpt.com/?q=%C2%BFqu%C3%A9+es+una+API%3F')
    expect(url('perplexity', 'mejores portátiles')).toBe('https://www.perplexity.ai/search?q=mejores+port%C3%A1tiles')
  })

  it('prefijos', () => {
    expect(parseInput('claude hola').command?.id).toBe('claude')
    expect(parseInput('cl hola').command?.id).toBe('claude')
    expect(parseInput('gpt hola').command?.id).toBe('chatgpt')
    expect(parseInput('pplx hola').command?.id).toBe('perplexity')
    expect(parseInput('gem hola').command?.id).toBe('gemini')
  })

  it('no se cuelan en la búsqueda sin prefijo', async () => {
    const { ctx } = fakeContext()
    const rows = await suggestFor(null, 'receta de croquetas', ctx)
    expect(rows.map((r) => r.command.id)).not.toContain('chatgpt')
    expect(rows.map((r) => r.command.id)).not.toContain('perplexity')
  })

  it('Gemini copia la pregunta y abre la web', async () => {
    const { ctx, state } = fakeContext()
    const [row] = await suggestFor('gemini', 'resume esto', ctx)
    const outcome = await row.suggestion.run()
    expect(state.copied).toEqual(['resume esto'])
    expect(state.opened).toEqual(['https://gemini.google.com/app'])
    expect(outcome).toMatchObject({ kind: 'close', toast: expect.stringContaining('Ctrl+V') })
  })
})

describe('Claude', () => {
  it('sin clave: abre Claude con la pregunta y ofrece poner la clave', async () => {
    const { ctx, state } = fakeContext()
    const rows = await suggestFor('claude', '¿por qué el cielo es azul?', ctx)
    expect(rows).toHaveLength(2)
    await rows[0].suggestion.run()
    expect(state.opened).toEqual(['claude:¿por qué el cielo es azul?'])
    await rows[1].suggestion.run()
    expect(state.opened).toContain('ajustes')
  })

  it('con clave: no hay filas (la barra pasa a la conversación)', async () => {
    const { ctx, state } = fakeContext()
    state.claudeKey = true
    expect(await suggestFor('claude', 'hola', ctx)).toEqual([])
  })

  it('el prompt dice quién responde', () => {
    const now = new Date(2026, 10, 12, 10, 0)
    expect(chatSystemPrompt(now, undefined, 'claude')).toMatch(/Claude, de Anthropic/)
    expect(chatSystemPrompt(now, undefined, 'claude')).not.toMatch(/modelo pequeño/)
    expect(chatSystemPrompt(now)).toMatch(/modelo pequeño/)
  })
})
