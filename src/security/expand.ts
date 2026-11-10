/**
 * Desacortar enlaces (bit.ly, t.co...) sin visitar el destino.
 *
 * Se pregunta solo al acortador, con `redirect: 'manual'`: su respuesta trae la
 * cabecera Location con el destino y ahí se para. Solo se contacta con hosts de
 * la lista SHORTENERS; en cuanto el siguiente salto no es un acortador, se deja
 * de hacer peticiones. `fetch` se inyecta para poder probarlo.
 */
import { t } from '../shared/i18n'
import { SHORTENERS } from './brands'

export type ExpandResult = { ok: true; finalUrl: string; hops: string[] } | { ok: false; error: string; hops: string[] }

const MAX_HOPS = 4
const TIMEOUT_MS = 4000

function isShortenerHost(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return SHORTENERS.has(host) || SHORTENERS.has(host.replace(/^www\./, ''))
}

export async function expandShortLink(input: string, fetchFn: typeof fetch = fetch): Promise<ExpandResult> {
  const hops: string[] = []
  let current: URL
  try {
    current = new URL(input)
  } catch {
    return { ok: false, error: t('No es un enlace válido', 'Not a valid link'), hops }
  }

  for (let i = 0; i < MAX_HOPS; i++) {
    if (!isShortenerHost(current)) return { ok: true, finalUrl: current.href, hops }
    if (current.protocol === 'http:') current.protocol = 'https:' // al acortador, siempre cifrado
    if (current.protocol !== 'https:') return { ok: false, error: t('Tipo de enlace no permitido', 'Link type not allowed'), hops }
    hops.push(current.href)

    let location: string | null = null
    try {
      for (const method of ['HEAD', 'GET'] as const) {
        const res = await fetchFn(current.href, {
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { 'User-Agent': 'Mascota/1.0 (comprobador de enlaces)' }
        })
        void res.body?.cancel().catch(() => {}) // no nos interesa el contenido
        if (res.status >= 300 && res.status < 400) location = res.headers.get('location')
        // Algunos acortadores no aceptan HEAD: se reintenta con GET.
        if (location || ![400, 403, 404, 405, 501].includes(res.status) || method === 'GET') break
      }
    } catch {
      return { ok: false, error: t('El acortador no respondió', 'The shortener did not respond'), hops }
    }

    if (!location) return { ok: false, error: t('El acortador no dice adónde lleva', "The shortener doesn't say where it goes"), hops }
    try {
      current = new URL(location, current)
    } catch {
      return { ok: false, error: t('El acortador devolvió una dirección no válida', 'The shortener returned an invalid address'), hops }
    }
  }
  return { ok: false, error: t('Demasiados saltos entre acortadores', 'Too many hops between shorteners'), hops }
}
