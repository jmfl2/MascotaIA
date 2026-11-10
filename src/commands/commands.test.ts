import { describe, expect, it } from 'vitest'
import { suggestFor } from './engine'
import { buildCommandUrl, parseInput, sanitizeQuery } from './index'
import { matchScore } from './match'
import { parsePomodoro } from './pomodoro'
import { parseReminder } from './reminderParser'
import { fakeContext } from './testing'

describe('URLs de los comandos web', () => {
  const url = (id: string, q: string) => {
    const r = buildCommandUrl(id, q)
    if (!r.ok) throw new Error(r.error)
    return r.url
  }

  it('codifica caracteres especiales', () => {
    expect(url('google', 'gatos & perros #1 ?x=1')).toBe('https://www.google.com/search?q=gatos+%26+perros+%231+%3Fx%3D1')
    expect(url('maps', 'Plaza Mayor, Madrid')).toBe('https://www.google.com/maps/search/?api=1&query=Plaza+Mayor%2C+Madrid')
  })

  it('no deja escapar del dominio ni ejecutar código', () => {
    expect(url('google', 'javascript:alert(1)')).toBe('https://www.google.com/search?q=javascript%3Aalert%281%29')
    expect(url('github', '../../evil')).toBe('https://github.com/search?q=..%2F..%2Fevil&type=repositories')
    expect(url('github', 'a/..')).toBe('https://github.com/search?q=a%2F..&type=repositories')
  })

  it('abre repositorios de GitHub directamente', () => {
    expect(url('github', 'electron/electron')).toBe('https://github.com/electron/electron')
  })

  it('traduce al idioma indicado con "xx:"', () => {
    expect(url('translate', 'en: buenos días')).toBe('https://translate.google.com/?sl=auto&tl=en&text=buenos+d%C3%ADas&op=translate')
    expect(url('translate', 'en casa')).toContain('tl=es&text=en+casa')
  })

  it('limpia caracteres invisibles y de control', () => {
    expect(url('google', 'hola‮evil​\n\tmundo')).toBe('https://www.google.com/search?q=hola+evil+mundo')
    expect(buildCommandUrl('google', '  ​ ').ok).toBe(false)
    expect(sanitizeQuery('x'.repeat(900))).toHaveLength(500)
  })

  it('rechaza comandos desconocidos o que no son web', () => {
    expect(buildCommandUrl('nope', 'x').ok).toBe(false)
    expect(buildCommandUrl('notes', 'x').ok).toBe(false)
  })
})

describe('prefijos', () => {
  it('detecta el comando solo si hay espacio tras el prefijo', () => {
    expect(parseInput('yt gatos').command?.id).toBe('youtube')
    expect(parseInput('YT gatos').query).toBe('gatos')
    expect(parseInput('ytterbio').command).toBeNull()
    expect(parseInput('rec 10m café').command?.id).toBe('reminders')
    expect(parseInput('nota comprar pilas').command?.id).toBe('notes')
  })
})

describe('recordatorios', () => {
  const now = new Date(2026, 10, 10, 12, 0, 0) // 10/11/2026 12:00
  const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo, d, h, mi).getTime()

  it.each([
    ['10m sacar la ropa', now.getTime() + 10 * 60_000, 'sacar la ropa'],
    ['1h30m llamar', now.getTime() + 90 * 60_000, 'llamar'],
    ['1 hora y 30 minutos llamar', now.getTime() + 90 * 60_000, 'llamar'],
    ['en 20 minutos café', now.getTime() + 20 * 60_000, 'café'],
    ['45s té', now.getTime() + 45_000, 'té'],
    ['18:30 llamar a mamá', at(2026, 10, 10, 18, 30), 'llamar a mamá'],
    ['9:00 gimnasio', at(2026, 10, 11, 9, 0), 'gimnasio'], // ya pasó hoy -> mañana
    ['a las 17 merendar', at(2026, 10, 10, 17, 0), 'merendar'],
    ['mañana 9:00 dentista', at(2026, 10, 11, 9, 0), 'dentista'],
    ['mañana a las 8 correr', at(2026, 10, 11, 8, 0), 'correr'],
    ['10m', now.getTime() + 10 * 60_000, 'Recordatorio']
  ])('"%s"', (input, dueAt, text) => {
    expect(parseReminder(input, now)).toEqual({ dueAt, text })
  })

  it.each(['5 llamar', '10 manzanas', 'mañana', '25:00 nada', 'hoy 8:00 tarde', '99999h algo', ''])('rechaza "%s"', (input) => {
    expect(parseReminder(input, now)).toBeNull()
  })

  it('el comando programa el recordatorio y lo lista', async () => {
    const { ctx, state } = fakeContext(now.getTime())
    const [row] = await suggestFor('reminders', '10m sacar la ropa', ctx)
    expect(row.suggestion.subtitle).toContain('en 10 min')
    expect(await row.suggestion.run()).toMatchObject({ kind: 'close' })
    expect(state.reminders).toHaveLength(1)
    const list = await suggestFor('reminders', '', ctx)
    expect(list[0].suggestion.title).toBe('sacar la ropa')
    await list[0].suggestion.secondary!.run()
    expect(state.reminders).toHaveLength(0)
  })
})

describe('notas', () => {
  it('guarda, busca, copia y borra', async () => {
    const { ctx, state } = fakeContext()
    await (await suggestFor('notes', 'comprar pilas AA', ctx))[0].suggestion.run()
    await (await suggestFor('notes', 'llamar al fontanero', ctx))[0].suggestion.run()
    expect(state.notes).toHaveLength(2)

    const found = await suggestFor('notes', 'pilas', ctx)
    expect(found.map((r) => r.suggestion.title)).toEqual(['pilas', 'comprar pilas AA'])
    await found[1].suggestion.run()
    expect(state.copied).toEqual(['comprar pilas AA'])

    await found[1].suggestion.secondary!.run()
    expect(state.notes.map((n) => n.text)).toEqual(['llamar al fontanero'])
  })
})

describe('pomodoro', () => {
  it('interpreta los minutos', () => {
    expect(parsePomodoro('50/10')).toEqual({ focusMin: 50, breakMin: 10 })
    expect(parsePomodoro('40')).toEqual({ focusMin: 40, breakMin: 5 })
    expect(parsePomodoro('0/5')).toBeNull()
    expect(parsePomodoro('abc')).toBeNull()
  })

  it('empieza y luego ofrece detener', async () => {
    const { ctx, state } = fakeContext()
    await (await suggestFor('pomodoro', '', ctx))[0].suggestion.run()
    expect(state.pomodoro?.focusMin).toBe(25)
    const rows = await suggestFor('pomodoro', '', ctx)
    expect(rows[0].suggestion.title).toBe('Concentración · quedan 25:00')
    await rows[0].suggestion.run()
    expect(state.pomodoro).toBeNull()
  })
})

describe('búsqueda sin prefijo', () => {
  it('sin texto lista los comandos y elegir uno lo fija', async () => {
    const { ctx } = fakeContext()
    const rows = await suggestFor(null, '', ctx)
    expect(rows[0].command.id).toBe('google')
    expect(await rows.find((r) => r.command.id === 'youtube')!.suggestion.run()).toEqual({ kind: 'activate', commandId: 'youtube' })
  })

  it('Google va primero salvo que una app encaje muy bien', async () => {
    const { ctx, state } = fakeContext()
    state.apps = [
      { id: 'lnk:spotify', name: 'Spotify', detail: 'Aplicación', favorite: false, score: 90 },
      { id: 'lnk:x', name: 'Algo de spotify', detail: 'Aplicación', favorite: false, score: 55 }
    ]
    const strong = await suggestFor(null, 'spoti', ctx)
    expect(strong[0].suggestion.title).toBe('Spotify')

    state.apps = [{ id: 'lnk:x', name: 'Algo de gatos', detail: 'Aplicación', favorite: false, score: 55 }]
    const weak = await suggestFor(null, 'gatos', ctx)
    expect(weak.map((r) => r.command.id).slice(0, 3)).toEqual(['google', 'launcher', 'youtube'])
  })

  it('abrir una web pasa por openUrl', async () => {
    const { ctx, state } = fakeContext()
    const [first] = await suggestFor(null, 'receta croquetas', ctx)
    await first.suggestion.run()
    expect(state.opened).toEqual(['https://www.google.com/search?q=receta+croquetas'])
  })
})

describe('puntuación de coincidencias', () => {
  it('ordena de más a menos parecido', () => {
    expect(matchScore('Spotify', 'spotify')).toBe(100)
    expect(matchScore('Spotify', 'spo')).toBe(90)
    expect(matchScore('Microsoft Edge', 'edge')).toBe(75)
    expect(matchScore('Visual Studio Code', 'vsc')).toBe(65)
    expect(matchScore('Música', 'musica')).toBe(100)
    expect(matchScore('Calculadora', 'xyz')).toBe(0)
  })
})
