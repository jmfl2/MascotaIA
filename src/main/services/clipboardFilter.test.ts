import { describe, expect, it } from 'vitest'
import { shouldOffer, translateTarget, type OfferDecision } from './clipboardFilter'

const kind = (d: OfferDecision) => (d.offer ? d.kind : null)

describe('portapapeles: qué se ofrece', () => {
  it.each(['receta de croquetas', 'Hello world', 'Plaza Mayor, Madrid', 'ñu'])('ofrece "%s"', (text) => {
    expect(kind(shouldOffer(text))).toBe('short')
  })

  it('los enlaces sueltos van al detector de enlaces', () => {
    expect(kind(shouldOffer('https://example.com/articulo'))).toBe('link')
    expect(kind(shouldOffer('bit.ly/3abc'))).toBe('link')
    expect(kind(shouldOffer('mira https://example.com'))).toBe('short')
  })

  it.each([
    ['contraseña', 'Tr0ub4dor&3'],
    ['contraseña', 'P@ssw0rd!'],
    ['token GitHub', 'ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789'],
    ['clave API', 'sk-proj-abcdefghijklmnop1234'],
    ['AWS', 'AKIAIOSFODNN7EXAMPLE'],
    ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123'],
    ['hex aleatorio', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b'],
    ['código OTP', '493 817'],
    ['tarjeta', '4111 1111 1111 1111'],
    ['IBAN', 'ES91 2100 0418 4502 0005 1332'],
    ['vacío', '  '],
    ['líneas sin texto', 'a\nb\nc\nd\ne'],
    ['clave privada', '-----BEGIN RSA PRIVATE KEY-----'],
    ['demasiado largo', 'palabra '.repeat(3000)]
  ])('no ofrece %s', (_label, text) => {
    expect(shouldOffer(text).offer).toBe(false)
  })
})

describe('portapapeles: textos largos (para resumir)', () => {
  const article = 'La fotosíntesis es el proceso mediante el cual las plantas convierten la luz en energía química. '.repeat(5)

  it('ofrece resumir artículos y código', () => {
    expect(kind(shouldOffer(article))).toBe('long')
    expect(kind(shouldOffer('function suma(a, b) {\n  // devuelve la suma de los dos números\n  const total = a + b\n  console.log("resultado", total)\n  return total\n}'))).toBe('long')
  })

  it('no ofrece textos largos con secretos dentro', () => {
    expect(shouldOffer(`${article}\nAPI_KEY=sk-live-abcdefghijklmnopqrstuvwx`).offer).toBe(false)
    expect(shouldOffer(`${article}\npassword: hunter2hunter2`).offer).toBe(false)
    expect(shouldOffer(`${article}\n-----BEGIN OPENSSH PRIVATE KEY-----\nabc`).offer).toBe(false)
  })
})

describe('portapapeles: idioma de destino', () => {
  it('traduce el español al inglés y lo demás al español', () => {
    expect(translateTarget('¿Dónde está la estación?')).toBe('en')
    expect(translateTarget('la casa de mi madre')).toBe('en')
    expect(translateTarget('Where is the station?')).toBe('es')
    expect(translateTarget('Guten Morgen')).toBe('es')
  })
})
