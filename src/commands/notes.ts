import { t } from '../shared/i18n'
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
  get name() {
    return t('Notas', 'Notes')
  },
  prefixes: ['nota', 'notas', 'n', 'note', 'notes'],
  get hint() {
    return t('Guardar y buscar notas rápidas', 'Save and search quick notes')
  },
  get placeholder() {
    return t('Escribe una nota o busca entre las tuyas…', 'Write a note or search your notes…')
  },
  accent: ACCENT,
  iconPath: NOTE_ICON,
  suggest(query, ctx) {
    const q = sanitizeQuery(query)
    const now = ctx.now()
    const rows: Suggestion[] = []

    if (q) {
      rows.push({
        title: q,
        subtitle: t('Guardar como nota nueva', 'Save as a new note'),
        icon: { kind: 'glyph', path: PLUS_ICON, accent: ACCENT },
        run: () => {
          ctx.notes.add(q)
          return { kind: 'close', mood: 'happy', toast: t('Nota guardada', 'Note saved') }
        }
      })
    }

    const all = ctx.notes.all()
    const found = q ? rank(all, q, (n) => n.text).map((r) => r.item) : all
    for (const note of found.slice(0, MAX_LISTED)) {
      rows.push({
        title: note.text,
        subtitle: `${formatAgo(note.createdAt, now)} · ${t('Intro copia', 'Enter copies')}`,
        run: () => {
          ctx.copyText(note.text)
          return { kind: 'close', mood: 'happy', toast: t('Nota copiada al portapapeles', 'Note copied to the clipboard') }
        },
        secondary: {
          label: t('borrar', 'delete'),
          run: () => {
            ctx.notes.remove(note.id)
            return { kind: 'refresh' }
          }
        }
      })
    }

    if (!q && all.length === 0) {
      rows.push({
        title: t('Aún no tienes notas', 'No notes yet'),
        subtitle: t('Escribe algo y pulsa Intro para guardarlo', 'Type something and press Enter to save it'),
        disabled: true,
        run: () => ({ kind: 'error', message: t('Escribe la nota primero', 'Write the note first') })
      })
    }
    return rows
  }
}
