import { afterEach, describe, expect, it } from 'vitest'
import { pickGreeting } from '../main/chatterLines'
import { translateTarget } from '../main/services/clipboardFilter'
import { chatSystemPrompt, interpretSystemPrompt } from '../ai/prompts'
import { suggestFor } from '../commands/engine'
import { formatAgo, formatWhen } from '../commands/format'
import { buildCommandUrl, findCommandById } from '../commands/index'
import { parseReminder } from '../commands/reminderParser'
import { fakeContext } from '../commands/testing'
import { analyzeLink, verdictTitle } from '../security'
import { formatAccelerator } from './accelerator'
import { getLang, langFromLocale, setLang, t } from './i18n'

afterEach(() => setLang('es'))

describe('idioma', () => {
  it('por defecto es español', () => {
    expect(getLang()).toBe('es')
    expect(t('Hola', 'Hello')).toBe('Hola')
  })

  it('elige el idioma del sistema', () => {
    expect(langFromLocale('es-ES')).toBe('es')
    expect(langFromLocale('es-419')).toBe('es')
    expect(langFromLocale('en-US')).toBe('en')
    expect(langFromLocale('fr-FR')).toBe('en')
    expect(langFromLocale(undefined)).toBe('en')
  })

  it('cambia los textos al pasar a inglés', () => {
    setLang('en')
    expect(t('Hola', 'Hello')).toBe('Hello')
    expect(findCommandById('notes')?.name).toBe('Notes')
    expect(findCommandById('google')?.hint).toBe('Search the web')
    expect(findCommandById('summarize')?.name).toBe('Summarize')
    expect(formatAccelerator('Control+Shift+Space')).toBe('Ctrl+Shift+Space')
    setLang('es')
    expect(findCommandById('notes')?.name).toBe('Notas')
    expect(formatAccelerator('Control+Shift+Space')).toBe('Ctrl+Mayús+Espacio')
  })
})

describe('en inglés', () => {
  const now = new Date(2026, 10, 10, 12, 0, 0)

  it('formatea fechas', () => {
    setLang('en')
    expect(formatWhen(now.getTime() + 10 * 60_000, now.getTime())).toBe('in 10 min (12:10)')
    expect(formatWhen(new Date(2026, 10, 11, 9, 0).getTime(), now.getTime())).toBe('tomorrow at 9:00')
    expect(formatWhen(new Date(2026, 10, 14, 9, 0).getTime(), now.getTime())).toBe('on 11/14 at 9:00')
    expect(formatAgo(now.getTime() - 5 * 60_000, now.getTime())).toBe('5 min ago')
  })

  it('las sugerencias salen en inglés', async () => {
    setLang('en')
    const { ctx } = fakeContext(now.getTime())
    const rows = await suggestFor('notes', '', ctx)
    expect(rows[0].suggestion.title).toBe('No notes yet')
    const list = await suggestFor(null, '', ctx)
    expect(list.map((r) => r.suggestion.title)).toContain('Reminders')
  })

  it('traduce al inglés por defecto', () => {
    setLang('en')
    const r = buildCommandUrl('translate', 'buenos días')
    expect(r.ok && new URL(r.url).searchParams.get('tl')).toBe('en')
    expect(translateTarget('Guten Morgen')).toBe('en')
  })

  it('explica los enlaces en inglés', () => {
    setLang('en')
    const report = analyzeLink('https://paypa1.com/login')
    expect(verdictTitle(report)).toBe('🚨 This link looks like a trap')
    expect(report.reasons[0].text).toMatch(/^It imitates PayPal/)
  })

  it('el robot saluda y la IA responde en inglés', () => {
    setLang('en')
    expect(pickGreeting(9, 0.1, 'Robi')).toBe("Good morning! I'm Robi ☀️")
    expect(chatSystemPrompt(now, { name: 'Robi', aiTone: 'cercano' })).toMatch(/You reply in English/)
    expect(interpretSystemPrompt(now)).toMatch(/Tuesday 11\/10\/2026/)
  })
})

describe('recordatorios en inglés (en cualquier idioma)', () => {
  const now = new Date(2026, 10, 10, 12, 0, 0)
  const at = (h: number, m = 0, day = 10) => new Date(2026, 10, day, h, m).getTime()

  it.each([
    ['in 20 minutes coffee', now.getTime() + 20 * 60_000, 'coffee'],
    ['1 hour and 30 minutes call mom', now.getTime() + 90 * 60_000, 'call mom'],
    ['at 9 gym', at(9, 0, 11), 'gym'],
    ['6:30pm call', at(18, 30), 'call'],
    ['5pm to stretch', at(17), 'stretch'],
    ['tomorrow at 8am run', at(8, 0, 11), 'run'],
    ['today 15:00 meeting', at(15), 'meeting'],
    ['12am backup', at(0, 0, 11), 'backup']
  ])('"%s"', (input, dueAt, text) => {
    expect(parseReminder(input, now)).toEqual({ dueAt, text })
  })

  it('rechaza horas imposibles con am/pm', () => {
    expect(parseReminder('13pm lunch', now)).toBeNull()
  })

  it('sin texto, usa "Reminder" en inglés', () => {
    setLang('en')
    expect(parseReminder('10m', now)?.text).toBe('Reminder')
  })
})
