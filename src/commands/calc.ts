/**
 * Calculadora y conversiones de unidades en la barra.
 *
 *   12*7+3          -> 87
 *   (2+3)^2 / 4     -> 6,25
 *   20% de 85       -> 17          (también "20% of 85")
 *   85 + 20%        -> 102
 *   raiz(2) · sqrt(16) · pi
 *   5 km en millas  -> 3,107 mi    (también "5 km to mi", "5km a m")
 *   30 c en f       -> 86 °F
 *
 * Nunca se usa eval: un analizador propio que solo entiende números, + - * / ^ %,
 * paréntesis y unas pocas funciones. Sin Electron, para poder probarlo.
 */
import { getLang, t } from '../shared/i18n'
import type { CommandModule, Suggestion } from './types'

export const CALC_ICON = 'M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z M8.5 7h7 M9 11.5h.01 M12 11.5h.01 M15 11.5h.01 M9 15h.01 M12 15h.01 M15 15h.01 M9 18h.01 M12 18h.01 M15 18h.01'
const ACCENT = '#f97316'

// --- Expresiones -----------------------------------------------------------------

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'id'; value: string }

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  raiz: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  sen: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  round: Math.round,
  redondear: Math.round
}
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }

/** Número con coma o punto decimal ("2,5" o "2.5"), sin separador de miles. */
const NUMBER = /^\d+(?:[.,]\d+)?|^[.,]\d+/

function tokenize(src: string): Token[] | null {
  const tokens: Token[] = []
  let s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/π/g, 'pi')
  while (s.length) {
    s = s.replace(/^\s+/, '')
    if (!s) break
    const num = NUMBER.exec(s)
    if (num) {
      tokens.push({ type: 'num', value: Number(num[0].replace(',', '.')) })
      s = s.slice(num[0].length)
      continue
    }
    const id = /^[a-zA-Záéíóú]+/.exec(s)
    if (id) {
      tokens.push({ type: 'id', value: id[0].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '') })
      s = s.slice(id[0].length)
      continue
    }
    if ('+-*/^%()'.includes(s[0])) {
      tokens.push({ type: 'op', value: s[0] })
      s = s.slice(1)
      continue
    }
    return null
  }
  return tokens
}

/**
 * Analizador descendente:
 *   expr   := term (('+'|'-') term)*        ("a + b%" suma el b% de a)
 *   term   := power (('*'|'/') power)*
 *   power  := unary ('^' power)?
 *   unary  := '-' unary | postfix
 *   postfix:= primary '%'?
 *   primary:= num | const | func '(' expr ')' | '(' expr ')'
 */
function parse(tokens: Token[]): number | null {
  let i = 0
  const peek = () => tokens[i]
  const isOp = (v: string) => peek()?.type === 'op' && peek()!.value === v
  const fail = (): never => {
    throw new Error('sintaxis')
  }

  function primary(): number {
    const tok = peek()
    if (!tok) return fail()
    if (tok.type === 'num') {
      i++
      return tok.value
    }
    if (tok.type === 'id') {
      i++
      if (tok.value in CONSTANTS) return CONSTANTS[tok.value]
      const fn = FUNCTIONS[tok.value]
      if (!fn || !isOp('(')) return fail()
      i++
      const arg = expr()
      if (!isOp(')')) return fail()
      i++
      return fn(arg)
    }
    if (isOp('(')) {
      i++
      const v = expr()
      if (!isOp(')')) return fail()
      i++
      return v
    }
    return fail()
  }
  /** Devuelve el valor y si llevaba % (para "85 + 20%"). */
  function postfix(): { value: number; percent: boolean } {
    const v = primary()
    if (isOp('%')) {
      i++
      return { value: v / 100, percent: true }
    }
    return { value: v, percent: false }
  }
  function unary(): { value: number; percent: boolean } {
    if (isOp('-')) {
      i++
      const u = unary()
      return { value: -u.value, percent: u.percent }
    }
    if (isOp('+')) {
      i++
      return unary()
    }
    return postfix()
  }
  function power(): { value: number; percent: boolean } {
    const base = unary()
    if (isOp('^')) {
      i++
      const exp = power()
      return { value: base.value ** exp.value, percent: false }
    }
    return base
  }
  function term(): { value: number; percent: boolean } {
    let left = power()
    while (isOp('*') || isOp('/')) {
      const op = peek()!.value
      i++
      const right = power()
      left = { value: op === '*' ? left.value * right.value : left.value / right.value, percent: false }
    }
    return left
  }
  function expr(): number {
    let left = term().value
    while (isOp('+') || isOp('-')) {
      const op = peek()!.value
      i++
      const right = term()
      // "85 + 20%" = 85 + 20 % de 85, como en las calculadoras de bolsillo.
      const amount = right.percent ? left * right.value : right.value
      left = op === '+' ? left + amount : left - amount
    }
    return left
  }

  try {
    const value = expr()
    return i === tokens.length ? value : null
  } catch {
    return null
  }
}

/** "20% de 85" / "20 % of 85" */
const PERCENT_OF = /^\s*(\d+(?:[.,]\d+)?)\s*%\s*(?:de|of)\s+(.+)$/i

/**
 * Evalúa una expresión. Devuelve null si no lo es o si es solo un número
 * suelto (escribir "2026" no es una cuenta).
 */
export function evaluate(input: string): number | null {
  const text = input.trim().replace(/=\s*$/, '')
  if (!text || text.length > 200) return null
  const pct = PERCENT_OF.exec(text)
  if (pct) {
    const base = evaluate(pct[2]) ?? (NUMBER.test(pct[2].trim()) && /^[\d.,\s]+$/.test(pct[2]) ? Number(pct[2].trim().replace(',', '.')) : null)
    return base === null ? null : (Number(pct[1].replace(',', '.')) / 100) * base
  }
  const tokens = tokenize(text)
  if (!tokens || tokens.length < 2) return null
  // Tiene que haber algo que calcular: un operador o una función/constante.
  if (!tokens.some((tk) => tk.type === 'op' || tk.type === 'id')) return null
  const value = parse(tokens)
  return value !== null && Number.isFinite(value) ? value : null
}

// --- Unidades ----------------------------------------------------------------------

interface Unit {
  kind: 'length' | 'mass' | 'volume' | 'temp' | 'data' | 'speed'
  /** Factor a la unidad base (m, kg, l, B, m/s); la temperatura se trata aparte. */
  factor: number
  symbol: string
}

const UNITS: Record<string, Unit> = {}
function unit(names: string[], kind: Unit['kind'], factor: number, symbol: string): void {
  for (const n of names) UNITS[n] = { kind, factor, symbol }
}
unit(['mm', 'milimetro', 'milimetros', 'millimeter', 'millimeters'], 'length', 0.001, 'mm')
unit(['cm', 'centimetro', 'centimetros', 'centimeter', 'centimeters'], 'length', 0.01, 'cm')
unit(['m', 'metro', 'metros', 'meter', 'meters'], 'length', 1, 'm')
unit(['km', 'kilometro', 'kilometros', 'kilometer', 'kilometers'], 'length', 1000, 'km')
unit(['in', 'pulgada', 'pulgadas', 'inch', 'inches'], 'length', 0.0254, 'in')
unit(['ft', 'pie', 'pies', 'foot', 'feet'], 'length', 0.3048, 'ft')
unit(['yd', 'yarda', 'yardas', 'yard', 'yards'], 'length', 0.9144, 'yd')
unit(['mi', 'milla', 'millas', 'mile', 'miles'], 'length', 1609.344, 'mi')
unit(['g', 'gramo', 'gramos', 'gram', 'grams'], 'mass', 0.001, 'g')
unit(['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos', 'kilogram', 'kilograms'], 'mass', 1, 'kg')
unit(['t', 'tonelada', 'toneladas', 'tonne', 'tonnes'], 'mass', 1000, 't')
unit(['oz', 'onza', 'onzas', 'ounce', 'ounces'], 'mass', 0.028349523125, 'oz')
unit(['lb', 'lbs', 'libra', 'libras', 'pound', 'pounds'], 'mass', 0.45359237, 'lb')
unit(['ml', 'mililitro', 'mililitros', 'milliliter', 'milliliters'], 'volume', 0.001, 'ml')
unit(['l', 'litro', 'litros', 'liter', 'liters', 'litre', 'litres'], 'volume', 1, 'l')
unit(['gal', 'galon', 'galones', 'gallon', 'gallons'], 'volume', 3.785411784, 'gal')
unit(['taza', 'tazas', 'cup', 'cups'], 'volume', 0.2365882365, 'cup')
unit(['c', 'celsius', 'centigrados', 'grados'], 'temp', 1, '°C')
unit(['f', 'fahrenheit'], 'temp', 1, '°F')
unit(['k', 'kelvin'], 'temp', 1, 'K')
unit(['b', 'byte', 'bytes'], 'data', 1, 'B')
unit(['kb', 'kilobyte', 'kilobytes'], 'data', 1024, 'KB')
unit(['mb', 'megabyte', 'megabytes'], 'data', 1024 ** 2, 'MB')
unit(['gb', 'gigabyte', 'gigabytes'], 'data', 1024 ** 3, 'GB')
unit(['tb', 'terabyte', 'terabytes'], 'data', 1024 ** 4, 'TB')
unit(['kmh', 'km/h'], 'speed', 1 / 3.6, 'km/h')
unit(['mph'], 'speed', 0.44704, 'mph')
unit(['m/s', 'ms'], 'speed', 1, 'm/s')

const unitKey = (raw: string) =>
  raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/^°/, '')
    .trim()

function toKelvin(v: number, symbol: string): number {
  if (symbol === '°C') return v + 273.15
  if (symbol === '°F') return ((v - 32) * 5) / 9 + 273.15
  return v
}
function fromKelvin(k: number, symbol: string): number {
  if (symbol === '°C') return k - 273.15
  if (symbol === '°F') return ((k - 273.15) * 9) / 5 + 32
  return k
}

const CONVERSION = /^\s*(-?\d+(?:[.,]\d+)?)\s*(°?[a-zA-Záéíóú/]+)\s+(?:en|a|to|in)\s+(°?[a-zA-Záéíóú/]+)\s*$/i

export interface Conversion {
  value: number
  symbol: string
  from: string
}

/** "5 km en millas" -> { value: 3.107, symbol: 'mi' } */
export function convert(input: string): Conversion | null {
  const m = CONVERSION.exec(input)
  if (!m) return null
  const from = UNITS[unitKey(m[2])]
  const to = UNITS[unitKey(m[3])]
  if (!from || !to || from.kind !== to.kind || from === to) return null
  const amount = Number(m[1].replace(',', '.'))
  const value = from.kind === 'temp' ? fromKelvin(toKelvin(amount, from.symbol), to.symbol) : (amount * from.factor) / to.factor
  return { value, symbol: to.symbol, from: `${formatNumber(amount)} ${from.symbol}` }
}

// --- Formato y comando -------------------------------------------------------------

/** Hasta 10 cifras significativas, con el separador decimal del idioma. */
export function formatNumber(value: number): string {
  const rounded = Number(value.toPrecision(10))
  return rounded.toLocaleString(getLang() === 'en' ? 'en-US' : 'es-ES', { maximumFractionDigits: 10, useGrouping: Math.abs(rounded) >= 10_000 })
}

/** Lo que se copia: sin separador de miles, para poder pegarlo en otro sitio. */
function plain(value: number): string {
  const s = String(Number(value.toPrecision(10)))
  return getLang() === 'en' ? s : s.replace('.', ',')
}

/** Fila con el resultado, si el texto es una cuenta o una conversión. */
export function calcSuggestion(text: string, copy: (s: string) => void): Suggestion | null {
  const conv = convert(text)
  if (conv) {
    const shown = `${formatNumber(conv.value)} ${conv.symbol}`
    return {
      title: `= ${shown}`,
      subtitle: `${conv.from} · ${t('Intro copia el resultado', 'Enter copies the result')}`,
      score: 100,
      run: () => {
        copy(`${plain(conv.value)} ${conv.symbol}`)
        return { kind: 'close', mood: 'happy', toast: t(`Copiado: ${shown}`, `Copied: ${shown}`) }
      }
    }
  }
  const value = evaluate(text)
  if (value === null) return null
  const shown = formatNumber(value)
  return {
    title: `= ${shown}`,
    subtitle: `${text.trim()} · ${t('Intro copia el resultado', 'Enter copies the result')}`,
    score: 100,
    run: () => {
      copy(plain(value))
      return { kind: 'close', mood: 'happy', toast: t(`Copiado: ${shown}`, `Copied: ${shown}`) }
    }
  }
}

/** "= 12*7" o "calc 5 km en m". Sin prefijo, las cuentas también salen las primeras. */
export const calc: CommandModule = {
  id: 'calc',
  get name() {
    return t('Calculadora', 'Calculator')
  },
  prefixes: ['=', 'calc'],
  get hint() {
    return t('Cuentas y conversiones (5 km en millas)', 'Maths and conversions (5 km to mi)')
  },
  get placeholder() {
    return t('12*7+3 · 20% de 85 · 30 c en f', '12*7+3 · 20% of 85 · 30 c to f')
  },
  accent: ACCENT,
  iconPath: CALC_ICON,
  suggest(query, ctx) {
    if (!query.trim()) return []
    const row = calcSuggestion(query, (s) => ctx.copyText(s))
    return [
      row ?? {
        title: t('No sé calcular eso', "I can't calculate that"),
        subtitle: t('Prueba 12*7+3, 20% de 85, raiz(2) o 5 km en millas', 'Try 12*7+3, 20% of 85, sqrt(2) or 5 km to mi'),
        disabled: true,
        run: () => ({ kind: 'error', message: t('No es una cuenta', 'Not a calculation') })
      }
    ]
  }
}
