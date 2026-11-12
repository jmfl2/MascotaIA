/**
 * Fábrica de comandos web: buscan el texto en un sitio y abren el navegador.
 * Cada comando web (google.ts, youtube.ts...) solo declara su URL y sus dominios.
 */
import { t, tx, type Localized } from '../shared/i18n'
import { sanitizeQuery } from './sanitize'
import type { CommandModule } from './types'

export interface WebCommandDef {
  id: string
  name: Localized
  prefixes: readonly string[]
  hint: Localized
  placeholder: Localized
  accent: string
  iconPath: string
  /** Únicos dominios a los que puede llevar este comando. */
  allowedHosts: readonly string[]
  /** Si sale como destino alternativo al escribir sin prefijo (por defecto, sí). */
  global?: boolean
  /**
   * Construye la URL de destino a partir de la consulta ya saneada y no vacía.
   * Debe usar `URL`/`URLSearchParams` (o `encodeURIComponent`) para codificar.
   */
  buildUrl(query: string): URL
}

export type BuildResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Sanea la consulta, construye la URL y la valida: solo https, sin
 * credenciales ni puerto y solo hacia los dominios declarados.
 */
export function buildWebUrl(def: WebCommandDef, rawQuery: string): BuildResult {
  const query = sanitizeQuery(rawQuery)
  if (!query) return { ok: false, error: t('Escribe algo para buscar', 'Type something to search') }

  let url: URL
  try {
    url = def.buildUrl(query)
  } catch {
    return { ok: false, error: t('No se pudo construir la dirección', 'Could not build the address') }
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return { ok: false, error: t('Dirección no permitida', 'Address not allowed') }
  }
  if (!def.allowedHosts.includes(url.hostname)) {
    return { ok: false, error: t('Dominio no permitido', 'Domain not allowed') }
  }
  return { ok: true, url: url.href }
}

export type WebCommand = CommandModule & { readonly web: WebCommandDef }

export function webCommand(def: WebCommandDef): WebCommand {
  const command: WebCommand = {
    id: def.id,
    get name() {
      return tx(def.name)
    },
    prefixes: def.prefixes,
    get hint() {
      return tx(def.hint)
    },
    get placeholder() {
      return tx(def.placeholder)
    },
    accent: def.accent,
    iconPath: def.iconPath,
    global: def.global === false ? undefined : 'web',
    web: def,
    suggest(query, ctx) {
      const q = sanitizeQuery(query)
      if (!q) return []
      return [
        {
          title: q,
          subtitle: `${command.name} · ${command.hint}`,
          run: async () => {
            const result = buildWebUrl(def, q)
            return result.ok ? ctx.openUrl(result.url) : { kind: 'error', message: result.error }
          }
        }
      ]
    }
  }
  return command
}
