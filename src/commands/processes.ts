/**
 * "cerrar chrome": lista los programas abiertos y los cierra.
 * Intro lo cierra como el botón X (puede preguntar si guardas); Supr lo fuerza.
 * Sin nada escrito, enseña los que más memoria usan.
 */
import { t } from '../shared/i18n'
import { rank } from './match'
import type { CommandModule, Outcome, ProcessGroup, Suggestion } from './types'

/** Círculo con una X. */
export const PROCESS_ICON = 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M9 9l6 6 M15 9l-6 6'
const ACCENT = '#ef4444'
const MAX_ROWS = 8

/** "512 MB", "1,4 GB". */
export function formatMemory(kb: number): string {
  const mb = kb / 1024
  if (mb < 1024) return `${Math.max(1, Math.round(mb))} MB`
  return `${(mb / 1024).toFixed(1).replace('.', t(',', '.'))} GB`
}

function row(group: ProcessGroup, close: (force: boolean) => Promise<Outcome>): Suggestion {
  const count = group.pids.length
  return {
    title: group.name,
    subtitle: [
      count === 1 ? t('1 proceso', '1 process') : t(`${count} procesos`, `${count} processes`),
      formatMemory(group.memoryKb),
      t('Intro para cerrar', 'Enter to close')
    ].join(' · '),
    run: () => close(false),
    secondary: { label: t('forzar el cierre', 'force close'), run: () => close(true) }
  }
}

export const processes: CommandModule = {
  id: 'processes',
  get name() {
    return t('Cerrar programas', 'Close programs')
  },
  prefixes: ['cerrar', 'kill', 'matar', 'proc'],
  get hint() {
    return t('Cerrar un programa o proceso abierto', 'Close an open program or process')
  },
  get placeholder() {
    return t('Escribe el programa que quieres cerrar…', 'Type the program you want to close…')
  },
  accent: ACCENT,
  iconPath: PROCESS_ICON,
  async suggest(query, ctx) {
    const groups = await ctx.processes.list()
    const q = query.trim()
    const found = q ? rank(groups, q, (g) => g.name).map((r) => r.item) : groups
    if (!found.length) {
      return [
        {
          title: q ? t(`No hay ningún programa abierto que se llame "${q}"`, `No open program called "${q}"`) : t('No se han podido leer los programas abiertos', "Couldn't read the open programs"),
          disabled: true,
          run: () => ({ kind: 'error', message: t('Elige un programa de la lista', 'Pick a program from the list') })
        }
      ]
    }
    return found.slice(0, MAX_ROWS).map((group) => row(group, (force) => ctx.processes.close(group, force)))
  }
}
