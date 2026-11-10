/**
 * Registro de comandos.
 *
 * Para añadir un comando nuevo:
 *   1. Crea `src/commands/micomando.ts` exportando un `CommandModule`.
 *   2. Añádelo a la lista `COMMANDS` de abajo.
 * Nada más: la barra lo mostrará y el proceso principal lo validará solo.
 */
import { github } from './github'
import { google } from './google'
import { maps } from './maps'
import { sanitizeQuery } from './sanitize'
import { translate } from './translate'
import type { BuildResult, CommandModule } from './types'
import { youtube } from './youtube'

export type { BuildResult, CommandModule } from './types'
export { MAX_QUERY_LENGTH, sanitizeQuery } from './sanitize'

/** Orden en el que se muestran en la barra. El primero es el comando por defecto. */
export const COMMANDS: readonly CommandModule[] = [google, youtube, maps, github, translate]

export const DEFAULT_COMMAND: CommandModule = COMMANDS[0]

export function findCommandById(id: string): CommandModule | undefined {
  return COMMANDS.find((c) => c.id === id)
}

export function findCommandByPrefix(prefix: string): CommandModule | undefined {
  const p = prefix.toLowerCase()
  return COMMANDS.find((c) => c.prefixes.includes(p))
}

/**
 * Detecta un prefijo al principio del texto: "yt gatos" -> { YouTube, "gatos" }.
 * Solo cuenta si hay un espacio después del prefijo, para no interferir
 * mientras se escribe una palabra que empieza igual ("ytterbio").
 */
export function parseInput(text: string): { command: CommandModule | null; query: string } {
  const match = /^(\S+)\s+([\s\S]*)$/.exec(text.trimStart())
  if (match) {
    const command = findCommandByPrefix(match[1])
    if (command) return { command, query: match[2] }
  }
  return { command: null, query: text }
}

/**
 * Construye y valida la URL final. Es la única puerta de salida hacia el
 * navegador: el proceso principal llama aquí antes de `shell.openExternal`.
 */
export function buildCommandUrl(commandId: string, rawQuery: string): BuildResult {
  const command = findCommandById(commandId)
  if (!command) return { ok: false, error: 'Comando desconocido' }

  const query = sanitizeQuery(rawQuery)
  if (!query) return { ok: false, error: 'Escribe algo para buscar' }

  let url: URL
  try {
    url = command.buildUrl(query)
  } catch {
    return { ok: false, error: 'No se pudo construir la dirección' }
  }

  // Defensa en profundidad: solo https, sin credenciales y solo los dominios declarados.
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return { ok: false, error: 'Dirección no permitida' }
  }
  if (!command.allowedHosts.includes(url.hostname)) {
    return { ok: false, error: 'Dominio no permitido' }
  }

  return { ok: true, url: url.href, command }
}
