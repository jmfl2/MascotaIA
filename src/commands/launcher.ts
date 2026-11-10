import { sanitizeQuery } from './sanitize'
import type { CommandModule, Suggestion } from './types'

const ROCKET_ICON = 'M5 19l3-1l-2-2z M9 15l-2-2c1.5-4.5 5-8 11.5-9c-1 6.5-4.5 10-9 11.5z M14.5 9.5a1 1 0 1 0 0 .01'

/**
 * Lanzador de apps (menú Inicio) y favoritos (carpetas o archivos soltados
 * sobre el robot). Sin texto, muestra los favoritos.
 */
export const launcher: CommandModule = {
  id: 'launcher',
  name: 'Abrir',
  prefixes: ['abrir', 'a', 'app'],
  hint: 'Apps, carpetas y favoritos',
  placeholder: 'Nombre de una app o de un favorito…',
  accent: '#06b6d4',
  iconPath: ROCKET_ICON,
  global: 'ranked',
  async suggest(query, ctx) {
    const q = sanitizeQuery(query)
    const targets = q ? await ctx.launcher.search(q, 8) : await ctx.launcher.favorites()

    const rows: Suggestion[] = targets.map((t) => ({
      title: t.name,
      subtitle: t.favorite ? `Favorito · ${t.detail}` : t.detail,
      icon: t.icon ? { kind: 'image', src: t.icon } : undefined,
      badge: t.favorite ? '★' : undefined,
      score: t.score,
      run: () => ctx.launcher.open(t.id),
      secondary: t.favorite
        ? {
            label: 'quitar de favoritos',
            run: () => {
              ctx.launcher.removeFavorite(t.id)
              return { kind: 'refresh' }
            }
          }
        : undefined
    }))

    if (!q && rows.length === 0) {
      rows.push({
        title: 'Aún no tienes favoritos',
        subtitle: 'Suelta una carpeta, un archivo o un acceso directo sobre el robot',
        disabled: true,
        run: () => ({ kind: 'error', message: 'Escribe el nombre de una app' })
      })
    }
    return rows
  }
}
