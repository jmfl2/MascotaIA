import { describe, expect, it } from 'vitest'
import { suggestFor } from '../commands/engine'
import { parseInput } from '../commands/index'
import { fakeContext } from '../commands/testing'
import { routinePath, routineSummary, routineUrl, validateRoutines } from './routines'

describe('atajos: validación', () => {
  it('webs: solo http(s), y sin esquema se pone https', () => {
    expect(routineUrl('notion.so')).toBe('https://notion.so/')
    expect(routineUrl('http://localhost:3000')).toBe('http://localhost:3000/')
    expect(routineUrl('javascript:alert(1)')).toBeNull()
    expect(routineUrl('file:///C:/x')).toBeNull()
    expect(routineUrl('hola mundo')).toBeNull()
    expect(routineUrl('palabra')).toBeNull()
  })

  it('rutas: solo absolutas de Windows', () => {
    expect(routinePath('C:\\Users\\Jose\\Documentos')).toBe('C:\\Users\\Jose\\Documentos')
    expect(routinePath('"D:\\Proyectos\\web"')).toBe('D:\\Proyectos\\web')
    expect(routinePath('\\\\servidor\\compartida\\x')).toBe('\\\\servidor\\compartida\\x')
    expect(routinePath('Documentos')).toBeNull()
    expect(routinePath('C:\\a\u0000b')).toBeNull()
  })

  it('limpia lo que llega de fuera', () => {
    const routines = validateRoutines([
      {
        id: 'abc',
        name: '  Trabajo  ',
        items: [
          { kind: 'app', id: 'app:Microsoft.WindowsCalculator!App', name: 'Calculadora' },
          { kind: 'app', id: 'cmd.exe', name: 'Malo' },
          { kind: 'url', url: 'javascript:alert(1)' },
          { kind: 'url', url: 'github.com' },
          { kind: 'path', path: 'C:\\Users' },
          { kind: 'otro' }
        ]
      },
      { id: '../x', name: 'trabajo', items: [] },
      'basura'
    ])
    expect(routines).toEqual([
      {
        id: 'abc',
        name: 'Trabajo',
        items: [
          { kind: 'app', id: 'app:Microsoft.WindowsCalculator!App', name: 'Calculadora' },
          { kind: 'url', url: 'https://github.com/' },
          { kind: 'path', path: 'C:\\Users' }
        ]
      }
    ])
    expect(validateRoutines('no')).toEqual([])
  })

  it('resumen para la barra', () => {
    expect(routineSummary([{ kind: 'app', id: 'app:x', name: 'Spotify' }, { kind: 'url', url: 'https://www.notion.so/' }, { kind: 'path', path: 'C:\\Proyectos\\web' }], 'es')).toBe('Spotify, notion.so y web')
  })
})

describe('atajos: en la barra', () => {
  it('escribir su nombre lo ofrece el primero y lo abre', async () => {
    const { ctx, state } = fakeContext()
    const rows = await suggestFor(null, 'trabajo', ctx)
    expect(rows[0].command.id).toBe('routines')
    expect(rows[0].suggestion.subtitle).toBe('notion.so y Spotify')
    await rows[0].suggestion.run()
    expect(state.ran).toEqual(['atajo:r1'])
  })

  it('"atajo" los lista y ofrece crear más', async () => {
    const { ctx, state } = fakeContext()
    expect(parseInput('atajo x').command?.id).toBe('routines')
    const rows = await suggestFor('routines', '', ctx)
    expect(rows.map((r) => r.suggestion.title)).toEqual(['Abrir el atajo "Trabajo"', 'Crear o editar atajos…'])
    await rows[1].suggestion.run()
    expect(state.opened).toEqual(['ajustes:atajos'])
  })
})
