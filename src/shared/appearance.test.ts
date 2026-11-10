import { describe, expect, it } from 'vitest'
import { sanitizeName, toggleAccessory, validateAppearance, validatePersonality } from './appearance'

describe('ajustes: validación', () => {
  it('limpia el nombre del robot', () => {
    expect(sanitizeName('  Robi  ')).toBe('Robi')
    expect(sanitizeName('Bo‮tb​ot\n')).toBe('Botbot')
    expect(sanitizeName('x'.repeat(50))).toHaveLength(20)
    expect(sanitizeName('🤖 Chispa')).toBe('🤖 Chispa')
    expect(sanitizeName('   ')).toBe('Mascota')
    expect(sanitizeName(42)).toBe('Mascota')
  })

  it('solo acepta skins y accesorios conocidos', () => {
    expect(validateAppearance({ skin: 'menta', accessories: ['gorro', 'gorro', 'gafas', '<script>'] })).toEqual({
      skin: 'menta',
      accessories: ['gorro', 'gafas']
    })
    expect(validateAppearance({ skin: '../../evil' })).toEqual({ skin: 'clasico', accessories: [] })
    expect(validateAppearance(null)).toEqual({ skin: 'clasico', accessories: [] })
  })

  it('un accesorio por zona: ponerse la corona quita el gorro', () => {
    expect(toggleAccessory(['gorro', 'gafas'], 'corona')).toEqual(['gafas', 'corona'])
    expect(toggleAccessory(['gafas', 'corona'], 'corona')).toEqual(['gafas'])
    expect(toggleAccessory(['espada'], 'mando')).toEqual(['espada', 'mando'])
    // Una config editada a mano con dos de la misma zona: gana el último.
    expect(validateAppearance({ accessories: ['gorro', 'vidas', 'helice'] }).accessories).toEqual(['vidas', 'helice'])
  })

  it('personalidad con valores por defecto si algo no encaja', () => {
    expect(validatePersonality({ name: 'Robi', chattiness: 'hablador', aiTone: 'formal' })).toEqual({
      name: 'Robi',
      chattiness: 'hablador',
      aiTone: 'formal'
    })
    expect(validatePersonality({ chattiness: 'gritón', aiTone: 1 })).toEqual({ name: 'Mascota', chattiness: 'normal', aiTone: 'cercano' })
  })
})
