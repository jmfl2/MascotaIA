import { describe, expect, it } from 'vitest'
import { suggestFor } from './engine'
import { fakeContext } from './testing'
import { currentScore, HALF_LIFE_DAYS, MAX_RECORDS, rankUsage, recordUse, type UsageRecord } from './usage'

const DAY = 24 * 60 * 60_000
const now = new Date(2026, 10, 10, 12, 0, 0).getTime()

describe('uso de las apps', () => {
  it('cuenta las aperturas', () => {
    let list: UsageRecord[] = []
    list = recordUse(list, 'a', now)
    list = recordUse(list, 'a', now)
    list = recordUse(list, 'b', now)
    expect(list.find((r) => r.id === 'a')).toMatchObject({ count: 2, score: 2 })
    expect(rankUsage(list, now).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('lo de hace tiempo pesa menos que lo de ahora', () => {
    const old: UsageRecord = { id: 'vieja', score: 6, count: 6, lastUsedAt: now - 3 * HALF_LIFE_DAYS * DAY }
    const recent: UsageRecord = { id: 'nueva', score: 2, count: 2, lastUsedAt: now }
    expect(currentScore(old, now)).toBeCloseTo(0.75)
    expect(rankUsage([old, recent], now).map((r) => r.id)).toEqual(['nueva', 'vieja'])
  })

  it('olvida lo que ya casi no cuenta y no crece sin límite', () => {
    const forgotten: UsageRecord = { id: 'x', score: 1, count: 1, lastUsedAt: now - 365 * DAY }
    expect(rankUsage([forgotten], now)).toEqual([])
    let list: UsageRecord[] = []
    for (let i = 0; i < MAX_RECORDS + 20; i++) list = recordUse(list, `app${i}`, now)
    expect(list).toHaveLength(MAX_RECORDS)
    expect(list[0].id).toBe(`app${MAX_RECORDS + 19}`)
  })
})

describe('barra vacía', () => {
  const app = (id: string, name: string) => ({ id, name, detail: 'Aplicación', favorite: false, score: 100 })

  it('pone las apps más usadas arriba y los comandos debajo', async () => {
    const { ctx, state } = fakeContext(now)
    state.apps = [app('lnk:spotify', 'Spotify'), app('lnk:code', 'Visual Studio Code')]
    state.mostUsed = ['lnk:code', 'lnk:spotify']
    const rows = await suggestFor(null, '', ctx)
    expect(rows.slice(0, 3).map((r) => r.suggestion.title)).toEqual(['Visual Studio Code', 'Spotify', 'Google'])
    expect(rows[0].suggestion.subtitle).toBe('Más usada · abierta 3 veces')

    await rows[0].suggestion.run()
    expect(state.launched).toEqual(['lnk:code'])

    expect(await rows[1].suggestion.secondary!.run()).toEqual({ kind: 'refresh' })
    expect(state.mostUsed).toEqual(['lnk:code'])
  })

  it('sin historial, solo los comandos', async () => {
    const { ctx } = fakeContext(now)
    const rows = await suggestFor(null, '', ctx)
    expect(rows[0].command.id).toBe('google')
  })
})
