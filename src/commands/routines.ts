/**
 * Atajos propios en la barra: escribir "trabajo" ofrece abrir todo lo del
 * atajo "trabajo" (apps, webs y carpetas). Con "atajo" se listan todos.
 * Se crean y editan en Ajustes → Atajos.
 */
import { getLang, t } from '../shared/i18n'
import { routineSummary, type Routine } from '../shared/routines'
import { matchScore } from './match'
import type { CommandModule, Outcome, Suggestion } from './types'

/** Rayo. */
export const ROUTINE_ICON = 'M13 2.5L5 13.5h6l-1 8l8-11h-6z'
const ACCENT = '#f59e0b'

function row(routine: Routine, run: () => Promise<Outcome>, score?: number): Suggestion {
  return {
    title: t(`Abrir el atajo "${routine.name}"`, `Open the "${routine.name}" shortcut`),
    subtitle: routineSummary(routine.items, getLang()),
    ...(score !== undefined ? { score } : {}),
    run
  }
}

export const routines: CommandModule = {
  id: 'routines',
  get name() {
    return t('Atajos', 'Shortcuts')
  },
  prefixes: ['atajo', 'atajos', 'rutina'],
  get hint() {
    return t('Abrir varias apps y webs a la vez', 'Open several apps and sites at once')
  },
  get placeholder() {
    return t('Nombre del atajo…', 'Shortcut name…')
  },
  accent: ACCENT,
  iconPath: ROUTINE_ICON,
  // En la búsqueda sin prefijo: escribir el nombre de un atajo lo ofrece.
  global: 'ranked',
  suggest(query, ctx) {
    const all = ctx.routines.all().filter((r) => r.name && r.items.length)
    const q = query.trim()
    const create: Suggestion = {
      title: all.length ? t('Crear o editar atajos…', 'Create or edit shortcuts…') : t('Crear un atajo…', 'Create a shortcut…'),
      subtitle: t('En Ajustes → Atajos: un nombre que abre varias cosas a la vez', 'In Settings → Shortcuts: a name that opens several things at once'),
      run: () => {
        ctx.routines.edit()
        return { kind: 'close' }
      }
    }
    if (!q) return [...all.map((r) => row(r, () => ctx.routines.run(r.id))), create]
    const found = all
      .map((r) => ({ r, score: matchScore(r.name, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    // Sin prefijo solo cuenta si encaja: la fila de "crear" sobraría en cada búsqueda.
    return found.map(({ r, score }) => row(r, () => ctx.routines.run(r.id), score))
  }
}
