import { describe, expect, it } from 'vitest'
import { pickGreeting, pickLine } from './chatterLines'

describe('modo hablador', () => {
  it('saluda según la hora y con su nombre', () => {
    expect(pickGreeting(8, 0.1, 'Robi')).toBe('¡Buenos días! Soy Robi ☀️')
    expect(pickGreeting(16, 0.9, 'Robi')).toBe('¡Buenas tardes! Aquí estoy 👋')
    expect(pickGreeting(22, 0.1, 'Robi')).toContain('Buenas noches')
    expect(pickGreeting(3, 0.1, 'Robi')).toContain('Trasnochando')
  })

  it('elige frases dentro de la lista', () => {
    for (const r of [0, 0.5, 0.999999, 1]) expect(pickLine('break', r, 'x')).toBeTruthy()
  })
})
