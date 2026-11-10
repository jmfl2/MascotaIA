/**
 * Decide qué filas ve la barra para lo que se ha escrito:
 * - Con un comando fijado (etiqueta): solo sus sugerencias.
 * - Sin texto: la lista de comandos disponibles.
 * - Con texto sin prefijo: destinos web (Google primero) mezclados con apps.
 *   Si una app encaja muy bien ("spoti" -> Spotify), va la primera.
 */
import { COMMANDS, findCommandById } from './index'
import type { CommandContext, CommandModule, Suggestion } from './types'

export interface Ranked {
  command: CommandModule
  suggestion: Suggestion
}

/** Puntuación a partir de la cual una app pasa por delante de Google. */
export const STRONG_MATCH = 75
/** Puntuación mínima para que una app aparezca en la búsqueda sin prefijo. */
export const MIN_GLOBAL_SCORE = 40
const MAX_GLOBAL_RANKED = 3
const MAX_ROWS = 60

async function safeSuggest(command: CommandModule, query: string, ctx: CommandContext): Promise<Ranked[]> {
  try {
    const list = await command.suggest(query, ctx)
    return list.map((suggestion) => ({ command, suggestion }))
  } catch (err) {
    console.warn(`[comandos] "${command.id}" falló al sugerir:`, err)
    return []
  }
}

export async function suggestFor(commandId: string | null, text: string, ctx: CommandContext): Promise<Ranked[]> {
  if (commandId) {
    const command = findCommandById(commandId)
    return command ? (await safeSuggest(command, text, ctx)).slice(0, MAX_ROWS) : []
  }

  if (!text.trim()) {
    return COMMANDS.map((command) => ({
      command,
      suggestion: {
        title: command.name,
        subtitle: command.hint,
        badge: command.prefixes[0],
        run: () => ({ kind: 'activate', commandId: command.id })
      }
    }))
  }

  const [web, ranked] = await Promise.all([
    Promise.all(COMMANDS.filter((c) => c.global === 'web').map((c) => safeSuggest(c, text, ctx))),
    Promise.all(COMMANDS.filter((c) => c.global === 'ranked').map((c) => safeSuggest(c, text, ctx)))
  ])
  const webRows = web.flat()
  const rankedRows = ranked
    .flat()
    .filter((r) => (r.suggestion.score ?? 0) >= MIN_GLOBAL_SCORE)
    .sort((a, b) => (b.suggestion.score ?? 0) - (a.suggestion.score ?? 0))
    .slice(0, MAX_GLOBAL_RANKED)

  const strong = (rankedRows[0]?.suggestion.score ?? 0) >= STRONG_MATCH
  return strong ? [...rankedRows, ...webRows] : [...webRows.slice(0, 1), ...rankedRows, ...webRows.slice(1)]
}
