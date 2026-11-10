/**
 * Decide qué filas ve la barra para lo que se ha escrito:
 * - Con un comando fijado (etiqueta): solo sus sugerencias.
 * - Sin texto: la lista de comandos disponibles.
 * - Con texto sin prefijo: destinos web (Google primero) mezclados con apps.
 *   Si una app encaja muy bien ("spoti" -> Spotify), va la primera.
 *   Si es una frase y la IA está lista, se ofrece "Interpretar con IA"
 *   justo debajo de Google (solo consulta al modelo si se elige).
 */
import { looksLikeUrl } from '../security'
import { ai } from './ai'
import { link } from './link'
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
/** Palabras mínimas para ofrecer la interpretación con IA. */
export const MIN_INTERPRET_WORDS = 3

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

  // Si se pega un enlace, lo primero es ofrecer comprobarlo.
  const linkRows: Ranked[] = looksLikeUrl(text)
    ? [
        {
          command: link,
          suggestion: {
            title: '🛡️ Comprobar el enlace antes de abrirlo',
            subtitle: text.trim().slice(0, 120),
            run: () => ({ kind: 'activate', commandId: 'link', text: text.trim() })
          }
        }
      ]
    : []

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

  const words = text.trim().split(/\s+/).length
  const interpretRows: Ranked[] =
    words >= MIN_INTERPRET_WORDS && ctx.ai.status().state === 'ready'
      ? [
          {
            command: ai,
            suggestion: {
              title: '✨ Interpretar con IA',
              subtitle: 'La IA elige el comando adecuado y tú lo confirmas',
              run: () => ctx.ai.interpret(text)
            }
          }
        ]
      : []

  const strong = (rankedRows[0]?.suggestion.score ?? 0) >= STRONG_MATCH
  const [first, ...restWeb] = webRows
  return strong
    ? [...linkRows, ...rankedRows, ...(first ? [first] : []), ...interpretRows, ...restWeb]
    : [...linkRows, ...(first ? [first] : []), ...interpretRows, ...rankedRows, ...restWeb]
}
