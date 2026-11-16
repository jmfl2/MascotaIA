/**
 * "> comando": ejecuta lo escrito en la terminal que elijas (Windows Terminal,
 * PowerShell, Símbolo del sistema, Git Bash...). Cada terminal instalada es una
 * fila; la última que usaste sale la primera. Sin nada escrito, solo la abre.
 */
import { t } from '../shared/i18n'
import type { CommandModule, Suggestion } from './types'

/** Ventana con el símbolo ">_". */
export const TERMINAL_ICON = 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M7 10l3 2.5L7 15 M12 15h5'
const ACCENT = '#22c55e'
/** Más largo que esto no es un comando que se escriba a mano en la barra. */
const MAX_COMMAND = 2000

export const terminal: CommandModule = {
  id: 'terminal',
  get name() {
    return t('Terminal', 'Terminal')
  },
  prefixes: ['>', 'terminal', 'term'],
  get hint() {
    return t('Ejecutar un comando en la terminal que elijas', 'Run a command in the terminal you choose')
  },
  get placeholder() {
    return t('Escribe el comando y elige la terminal…', 'Type the command and pick the terminal…')
  },
  accent: ACCENT,
  iconPath: TERMINAL_ICON,
  suggest(query, ctx) {
    // Una sola línea: los saltos de línea los convertiría la terminal en Intros.
    const command = query.replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, MAX_COMMAND)
    const terminals = ctx.terminal.list()
    if (!terminals.length) {
      return [
        {
          title: t('No se ha encontrado ninguna terminal', 'No terminal found'),
          disabled: true,
          run: () => ({ kind: 'error', message: t('No hay ninguna terminal instalada', 'No terminal is installed') })
        }
      ]
    }
    return terminals.map(
      (term): Suggestion => ({
        title: command ? command : t(`Abrir ${term.name}`, `Open ${term.name}`),
        subtitle: command
          ? t(`Ejecutar en ${term.name}`, `Run in ${term.name}`) + (term.lastUsed ? t(' · la última que usaste', ' · the last one you used') : '')
          : t('Se abre en tu carpeta de usuario', 'Opens in your user folder'),
        run: () => ctx.terminal.run(term.id, command)
      })
    )
  }
}
