import { afterEach, describe, expect, it } from 'vitest'
import { setLang } from '../shared/i18n'
import { convert, evaluate, formatNumber } from './calc'
import { suggestFor } from './engine'
import { fakeContext } from './testing'

afterEach(() => setLang('es'))

describe('calculadora', () => {
  it.each([
    ['12*7+3', 87],
    ['2 + 3 * 4', 14],
    ['(2+3)^2 / 4', 6.25],
    ['2^3^2', 512],
    ['-5 + 2', -3],
    ['10 / 4', 2.5],
    ['2,5 * 2', 5],
    ['20% de 85', 17],
    ['20% of 85', 17],
    ['85 + 20%', 102],
    ['85 - 10%', 76.5],
    ['50%', 0.5],
    ['raiz(16)', 4],
    ['sqrt(2) * sqrt(2)', 2.0000000000000004],
    ['2 × 3 ÷ 4', 1.5],
    ['pi * 2', Math.PI * 2],
    ['12*7=', 84]
  ])('%s = %s', (input, expected) => {
    expect(evaluate(input)).toBeCloseTo(expected, 10)
  })

  it.each(['2026', 'hola mundo', 'covid-19', 'e-mail', '1-2 personas', 'pi', '(2+3', '2 +', 'alert(1)', '1/0'])(
    'no es una cuenta: %s',
    (input) => {
      expect(evaluate(input)).toBeNull()
    }
  )
})

describe('conversiones', () => {
  it.each([
    ['5 km en millas', 3.10686, 'mi'],
    ['1 mi to km', 1.609344, 'km'],
    ['30 c en f', 86, '°F'],
    ['98,6 f a c', 37, '°C'],
    ['2 kg en lb', 4.40925, 'lb'],
    ['1 gb en mb', 1024, 'MB'],
    ['100 kmh en mph', 62.1371, 'mph']
  ])('%s', (input, value, symbol) => {
    const r = convert(input)
    expect(r?.symbol).toBe(symbol)
    expect(r?.value).toBeCloseTo(value as number, 3)
  })

  it('no mezcla magnitudes ni inventa unidades', () => {
    expect(convert('5 km en kg')).toBeNull()
    expect(convert('5 patatas en km')).toBeNull()
    expect(convert('voy en tren')).toBeNull()
  })
})

describe('en la barra', () => {
  it('el resultado sale el primero y Intro lo copia', async () => {
    const { ctx, state } = fakeContext()
    const rows = await suggestFor(null, '12*7+3', ctx)
    expect(rows[0].command.id).toBe('calc')
    expect(rows[0].suggestion.title).toBe('= 87')
    await rows[0].suggestion.run()
    expect(state.copied).toEqual(['87'])
  })

  it('decimales según el idioma', () => {
    expect(formatNumber(6.25)).toBe('6,25')
    setLang('en')
    expect(formatNumber(6.25)).toBe('6.25')
    expect(formatNumber(12345.5)).toBe('12,345.5')
  })

  it('el texto normal no saca la calculadora', async () => {
    const { ctx } = fakeContext()
    const rows = await suggestFor(null, 'receta de croquetas', ctx)
    expect(rows.map((r) => r.command.id)).not.toContain('calc')
  })
})
