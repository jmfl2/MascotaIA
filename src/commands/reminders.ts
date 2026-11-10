import { formatWhen } from './format'
import { parseReminder } from './reminderParser'
import { sanitizeQuery } from './sanitize'
import type { CommandModule, Suggestion } from './types'

const BELL_ICON = 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0'
const CLOCK_ICON = 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17z M12 7.5V12l3 2'
const ACCENT = '#f97316'
const HELP = 'rec 10m sacar la ropa · rec 18:30 llamar · rec mañana 9:00 dentista'

/**
 * Recordatorios. "rec 10m sacar la ropa" avisa dentro de 10 minutos.
 * Sin texto, lista los pendientes (Supr cancela).
 */
export const reminders: CommandModule = {
  id: 'reminders',
  name: 'Recordatorios',
  prefixes: ['rec', 'recordar', 'r'],
  hint: 'Avisarte más tarde',
  placeholder: '10m sacar la ropa · 18:30 llamar · mañana 9:00 dentista',
  accent: ACCENT,
  iconPath: BELL_ICON,
  suggest(query, ctx) {
    const q = sanitizeQuery(query)
    const now = ctx.now()
    const rows: Suggestion[] = []

    if (q) {
      const parsed = parseReminder(q, new Date(now))
      if (parsed) {
        const when = formatWhen(parsed.dueAt, now)
        rows.push({
          title: parsed.text,
          subtitle: `Recordártelo ${when}`,
          run: () => {
            ctx.reminders.add(parsed.text, parsed.dueAt)
            return { kind: 'close', mood: 'happy', toast: `Te lo recordaré ${when}` }
          }
        })
      } else {
        rows.push({
          title: 'No entiendo cuándo',
          subtitle: HELP,
          disabled: true,
          run: () => ({ kind: 'error', message: 'Indica cuándo: 10m, 1h30m, 18:30, mañana 9:00…' })
        })
      }
    }

    const pending = [...ctx.reminders.all()].sort((a, b) => a.dueAt - b.dueAt)
    for (const r of pending) {
      rows.push({
        title: r.text,
        subtitle: `Pendiente · ${formatWhen(r.dueAt, now)}`,
        icon: { kind: 'glyph', path: CLOCK_ICON, accent: '#64748b' },
        run: () => ({ kind: 'refresh' }),
        secondary: {
          label: 'cancelar',
          run: () => {
            ctx.reminders.remove(r.id)
            return { kind: 'refresh' }
          }
        }
      })
    }

    if (!q && pending.length === 0) {
      rows.push({
        title: 'No hay recordatorios pendientes',
        subtitle: HELP,
        disabled: true,
        run: () => ({ kind: 'error', message: 'Escribe cuándo y qué: 10m sacar la ropa' })
      })
    }
    return rows
  }
}
