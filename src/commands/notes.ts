import { formatAgo } from './format'
import { rank } from './match'
import { sanitizeQuery } from './sanitize'
import type { CommandModule, Suggestion } from './types'

const NOTE_ICON = 'M7 3.5h7.5L19 8v12.5H7z M14.5 3.5V8H19 M10 12.5h6 M10 16h4'
const PLUS_ICON = 'M12 5v14 M5 12h14'
const ACCENT = '#eab308'
const MAX_LISTED = 50

/**
 * Notas rápidas.
 *   nota comprar pilas   -> guarda la nota (primera fila) y busca entre las existentes
 *   notas                -> lista las notas (Intro copia, Supr borra)
 */
export const notes: CommandModule = {
  id: 'notes',
  name: 'Notas',
  prefixes: ['nota', 'notas', 'n'],
  hint: 'Guardar y buscar notas rápidas',
  placeholder: 'Escribe una nota o busca entre las tuyas…',
  accent: ACCENT,
  iconPath: NOTE_ICON,
  suggest(query, ctx) {
    const q = sanitizeQuery(query)
    const now = ctx.now()
    const rows: Suggestion[] = []

    if (q) {
      rows.push({
        title: q,
        subtitle: 'Guardar como nota nueva',
        icon: { kind: 'glyph', path: PLUS_ICON, accent: ACCENT },
        run: () => {
          ctx.notes.add(q)
          return { kind: 'close', mood: 'happy', toast: 'Nota guardada' }
        }
      })
    }

    const all = ctx.notes.all()
    const found = q ? rank(all, q, (n) => n.text).map((r) => r.item) : all
    for (const note of found.slice(0, MAX_LISTED)) {
      rows.push({
        title: note.text,
        subtitle: `${formatAgo(note.createdAt, now)} · Intro copia`,
        run: () => {
          ctx.copyText(note.text)
          return { kind: 'close', mood: 'happy', toast: 'Nota copiada al portapapeles' }
        },
        secondary: {
          label: 'borrar',
          run: () => {
            ctx.notes.remove(note.id)
            return { kind: 'refresh' }
          }
        }
      })
    }

    if (!q && all.length === 0) {
      rows.push({
        title: 'Aún no tienes notas',
        subtitle: 'Escribe algo y pulsa Intro para guardarlo',
        disabled: true,
        run: () => ({ kind: 'error', message: 'Escribe la nota primero' })
      })
    }
    return rows
  }
}
