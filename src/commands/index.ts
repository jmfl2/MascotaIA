/**
 * Registro de comandos.
 *
 * Para añadir un comando nuevo:
 *   1. Crea `src/commands/micomando.ts` exportando un `CommandModule`
 *      (o usa `webCommand()` si solo abre una web).
 *   2. Añádelo a la lista `COMMANDS` de abajo.
 * La barra lo mostrará y el proceso principal se encargará del resto.
 */
import { t } from '../shared/i18n'
import { ai, explain, summarize } from './ai'
import { github } from './github'
import { google } from './google'
import { launcher } from './launcher'
import { link } from './link'
import { maps } from './maps'
import { notes } from './notes'
import { pomodoro } from './pomodoro'
import { reminders } from './reminders'
import { settings } from './settings'
import { translate } from './translate'
import type { CommandModule } from './types'
import { buildWebUrl, type BuildResult, type WebCommand } from './web'
import { youtube } from './youtube'

export type * from './types'
export { MAX_QUERY_LENGTH, sanitizeQuery } from './sanitize'
export type { BuildResult } from './web'

/** Orden en el que se listan en la barra. */
export const COMMANDS: readonly CommandModule[] = [
  google,
  launcher,
  ai,
  link,
  youtube,
  maps,
  github,
  translate,
  notes,
  reminders,
  pomodoro,
  summarize,
  explain,
  settings
]

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

function isWeb(c: CommandModule): c is WebCommand {
  return 'web' in c
}

/** Construye y valida la URL de un comando web (lo usan el portapapeles y los tests). */
export function buildCommandUrl(commandId: string, rawQuery: string): BuildResult {
  const command = findCommandById(commandId)
  if (!command || !isWeb(command)) return { ok: false, error: t('Comando desconocido', 'Unknown command') }
  return buildWebUrl(command.web, rawQuery)
}
