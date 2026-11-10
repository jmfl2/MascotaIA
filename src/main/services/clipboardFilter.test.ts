import { describe, expect, it } from 'vitest'
import { shouldOffer, translateTarget } from './clipboardFilter'

describe('portapapeles: qué se ofrece', () => {
  it.each(['receta de croquetas', 'Hello world', 'https://example.com/articulo', 'Plaza Mayor, Madrid', 'ñu'])('ofrece "%s"', (text) => {
    expect(shouldOffer(text).offer).toBe(true)
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
    ['muy largo', 'palabra '.repeat(60)],
    ['código', 'a\nb\nc\nd\ne'],
    ['clave privada', '-----BEGIN RSA PRIVATE KEY-----']
  ])('no ofrece %s', (_label, text) => {
    expect(shouldOffer(text).offer).toBe(false)
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
