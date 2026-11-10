import type { CommandModule } from './types'

const GEAR_ICON = 'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z M12 2.8v2.4 M12 18.8v2.4 M4.2 7.5l2.1 1.2 M17.7 15.3l2.1 1.2 M4.2 16.5l2.1-1.2 M17.7 8.7l2.1-1.2'

/** "ajustes": abre la ventana de ajustes (skin, accesorios, personalidad...). */
export const settings: CommandModule = {
  id: 'settings',
  name: 'Ajustes',
  prefixes: ['ajustes', 'config', 'skin'],
  hint: 'Skin, accesorios y personalidad del robot',
  placeholder: 'Intro para abrir los ajustes',
  accent: '#64748b',
  iconPath: GEAR_ICON,
  suggest(_query, ctx) {
    return [
      {
        title: 'Abrir los ajustes',
        subtitle: 'Skin, accesorios, nombre, cuánto habla y tono de la IA',
        run: () => {
          ctx.openSettings()
          return { kind: 'close' }
        }
      }
    ]
  }
}
