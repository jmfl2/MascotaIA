import { t } from '../shared/i18n'
import { sanitizeQuery } from './sanitize'
import type { CommandModule, Suggestion } from './types'

const ROCKET_ICON = 'M5 19l3-1l-2-2z M9 15l-2-2c1.5-4.5 5-8 11.5-9c-1 6.5-4.5 10-9 11.5z M14.5 9.5a1 1 0 1 0 0 .01'

/**
 * Lanzador de apps (menú Inicio) y favoritos (carpetas o archivos soltados
 * sobre el robot). Sin texto, muestra los favoritos.
 */
export const launcher: CommandModule = {
  id: 'launcher',
  get name() {
    return t('Abrir', 'Open')
  },
  prefixes: ['abrir', 'a', 'app', 'open', 'o'],
  get hint() {
    return t('Apps, carpetas y favoritos', 'Apps, folders and favorites')
  },
  get placeholder() {
    return t('Nombre de una app o de un favorito…', 'Name of an app or a favorite…')
  },
  accent: '#06b6d4',
  iconPath: ROCKET_ICON,
  global: 'ranked',
  async suggest(query, ctx) {
    const q = sanitizeQuery(query)
    const targets = q ? await ctx.launcher.search(q, 8) : await ctx.launcher.favorites()

    const rows: Suggestion[] = targets.map((target) => ({
      title: target.name,
      subtitle: target.favorite ? `${t('Favorito', 'Favorite')} · ${target.detail}` : target.detail,
      icon: target.icon ? { kind: 'image', src: target.icon } : undefined,
      badge: target.favorite ? '★' : undefined,
      score: target.score,
      run: () => ctx.launcher.open(target.id),
      secondary: target.favorite
        ? {
            label: t('quitar de favoritos', 'remove from favorites'),
            run: () => {
              ctx.launcher.removeFavorite(target.id)
              return { kind: 'refresh' }
            }
          }
        : undefined
    }))

    if (!q && rows.length === 0) {
      rows.push({
        title: t('Aún no tienes favoritos', 'No favorites yet'),
        subtitle: t('Suelta una carpeta, un archivo o un acceso directo sobre el robot', 'Drop a folder, a file or a shortcut on the robot'),
        disabled: true,
        run: () => ({ kind: 'error', message: t('Escribe el nombre de una app', 'Type the name of an app') })
      })
    }
    return rows
  }
}
