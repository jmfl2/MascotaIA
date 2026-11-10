/**
 * Fábrica de comandos web: buscan el texto en un sitio y abren el navegador.
 * Cada comando web (google.ts, youtube.ts...) solo declara su URL y sus dominios.
 */
import { sanitizeQuery } from './sanitize'
import type { CommandModule } from './types'

export interface WebCommandDef {
  id: string
  name: string
  prefixes: readonly string[]
  hint: string
  placeholder: string
  accent: string
  iconPath: string
  /** Únicos dominios a los que puede llevar este comando. */
  allowedHosts: readonly string[]
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
  if (!query) return { ok: false, error: 'Escribe algo para buscar' }

  let url: URL
  try {
    url = def.buildUrl(query)
  } catch {
    return { ok: false, error: 'No se pudo construir la dirección' }
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return { ok: false, error: 'Dirección no permitida' }
  }
  if (!def.allowedHosts.includes(url.hostname)) {
    return { ok: false, error: 'Dominio no permitido' }
  }
  return { ok: true, url: url.href }
}

export type WebCommand = CommandModule & { readonly web: WebCommandDef }

export function webCommand(def: WebCommandDef): WebCommand {
  return {
    id: def.id,
    name: def.name,
    prefixes: def.prefixes,
    hint: def.hint,
    placeholder: def.placeholder,
    accent: def.accent,
    iconPath: def.iconPath,
    global: 'web',
    web: def,
    suggest(query, ctx) {
      const q = sanitizeQuery(query)
      if (!q) return []
      return [
        {
          title: q,
          subtitle: `${def.name} · ${def.hint}`,
          run: async () => {
            const result = buildWebUrl(def, q)
            return result.ok ? ctx.openUrl(result.url) : { kind: 'error', message: result.error }
          }
        }
      ]
    }
  }
}
