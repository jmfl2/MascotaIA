/**
 * Decide qué filas ve la barra para lo que se ha escrito:
 * - Con un comando fijado (etiqueta): solo sus sugerencias.
 * - Sin texto: la lista de comandos disponibles.
 * - Con texto sin prefijo: destinos web (Google primero) mezclados con apps.
 *   Si una app encaja muy bien ("spoti" -> Spotify), va la primera.
 *   Si es una frase y la IA está lista, se ofrece "Interpretar con IA"
 *   justo debajo de Google (solo consulta al modelo si se elige).
 */
import { t } from '../shared/i18n'
import { looksLikeUrl } from '../security'
import { ai } from './ai'
import { calc, calcSuggestion } from './calc'
import { launcher } from './launcher'
import { link } from './link'
import { COMMANDS, findCommandById } from './index'
import type { CommandContext, CommandModule, LaunchTarget, Suggestion } from './types'

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
/** Apps más usadas que se ven al abrir la barra, encima de los comandos. */
export const MOST_USED_ROWS = 4

async function safeSuggest(command: CommandModule, query: string, ctx: CommandContext): Promise<Ranked[]> {
  try {
    const list = await command.suggest(query, ctx)
    return list.map((suggestion) => ({ command, suggestion }))
  } catch (err) {
    console.warn(`[comandos] "${command.id}" falló al sugerir:`, err)
    return []
  }
}

/** Las apps que más abres, para tenerlas a un Intro nada más abrir la barra. */
async function mostUsedRows(ctx: CommandContext): Promise<Ranked[]> {
  let targets: LaunchTarget[]
  try {
    targets = await ctx.launcher.mostUsed(MOST_USED_ROWS)
  } catch (err) {
    console.warn('[comandos] no se pudieron leer las apps más usadas:', err)
    return []
  }
  return targets.map((target) => ({
    command: launcher,
    suggestion: {
      title: target.name,
      subtitle: target.uses
        ? `${t('Más usada', 'Most used')} · ${t(`abierta ${target.uses} ${target.uses === 1 ? 'vez' : 'veces'}`, `opened ${target.uses} ${target.uses === 1 ? 'time' : 'times'}`)}`
        : t('Más usada', 'Most used'),
      icon: target.icon ? { kind: 'image', src: target.icon } : undefined,
      badge: target.favorite ? '★' : undefined,
      run: () => ctx.launcher.open(target.id),
      secondary: {
        label: t('quitar de las más usadas', 'remove from most used'),
        run: () => {
          ctx.launcher.forgetUse(target.id)
          return { kind: 'refresh' }
        }
      }
    }
  }))
}

export async function suggestFor(commandId: string | null, text: string, ctx: CommandContext): Promise<Ranked[]> {
  if (commandId) {
    const command = findCommandById(commandId)
    return command ? (await safeSuggest(command, text, ctx)).slice(0, MAX_ROWS) : []
  }

  if (!text.trim()) {
    const commandRows: Ranked[] = COMMANDS.map((command) => ({
      command,
      suggestion: {
        title: command.name,
        subtitle: command.hint,
        badge: command.prefixes[0],
        run: () => ({ kind: 'activate', commandId: command.id })
      }
    }))
    return [...(await mostUsedRows(ctx)), ...commandRows]
  }

  // Si es una cuenta o una conversión ("12*7", "5 km en millas"), el resultado va el primero.
  const calcRow = calcSuggestion(text, (s) => ctx.copyText(s))
  const calcRows: Ranked[] = calcRow ? [{ command: calc, suggestion: calcRow }] : []

  // Si se pega un enlace, lo primero es ofrecer comprobarlo.
  const linkRows: Ranked[] = looksLikeUrl(text)
    ? [
        {
          command: link,
          suggestion: {
            title: t('🛡️ Comprobar el enlace antes de abrirlo', '🛡️ Check the link before opening it'),
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
              title: t('✨ Interpretar con IA', '✨ Interpret with AI'),
              subtitle: t('La IA elige el comando adecuado y tú lo confirmas', 'The AI picks the right command and you confirm it'),
              run: () => ctx.ai.interpret(text)
            }
          }
        ]
      : []

  const strong = (rankedRows[0]?.suggestion.score ?? 0) >= STRONG_MATCH
  const [first, ...restWeb] = webRows
  return strong
    ? [...calcRows, ...linkRows, ...rankedRows, ...(first ? [first] : []), ...interpretRows, ...restWeb]
    : [...calcRows, ...linkRows, ...(first ? [first] : []), ...interpretRows, ...rankedRows, ...restWeb]
}
