/**
 * Atajos propios: un nombre ("trabajo") que abre varias cosas a la vez (apps,
 * webs y carpetas o archivos). Se crean en Ajustes → Atajos y se lanzan desde
 * la barra escribiendo su nombre.
 *
 * Lo que llega de fuera (config.json o la ventana de ajustes) se valida aquí:
 * solo webs http(s), rutas absolutas de Windows e ids del lanzador de apps.
 */
import type { Text } from './i18n'

export type RoutineItem =
  /** App del lanzador (id "app:…", "lnk:…" o "fav:…") con su nombre para enseñarlo. */
  | { kind: 'app'; id: string; name: string }
  | { kind: 'url'; url: string }
  /** Carpeta o archivo (ruta absoluta). */
  | { kind: 'path'; path: string }

export interface Routine {
  id: string
  name: string
  items: RoutineItem[]
}

export const MAX_ROUTINES = 12
export const MAX_ROUTINE_ITEMS = 8
export const MAX_ROUTINE_NAME = 30

export const ROUTINE_KIND_NAMES: Record<RoutineItem['kind'], Text> = {
  app: { es: 'App', en: 'App' },
  url: { es: 'Web', en: 'Web' },
  path: { es: 'Carpeta o archivo', en: 'Folder or file' }
}

const CONTROL = /[\p{Cc}\p{Cf}]/gu
const clean = (raw: string, max: number) => [...raw.normalize('NFC').replace(CONTROL, '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim()

/** Web http(s) válida, en limpio, o null. "notion.so" -> "https://notion.so/". */
export function routineUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text || text.length > 2000 || /\s/.test(text)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return url.href
  } catch {
    return null
  }
}

/** Ruta absoluta de Windows ("C:\…" o "\\servidor\…"), o null. */
export function routinePath(raw: string): string | null {
  const text = raw.trim().replace(/^"(.*)"$/, '$1')
  if (!text || text.length > 400 || /[\p{Cc}\p{Cf}]/u.test(text)) return null
  return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\[^\\]+\\/.test(text) ? text : null
}

const APP_ID = /^(app|lnk|fav):.{1,480}$/s

function validItem(raw: unknown): RoutineItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.kind === 'app' && typeof r.id === 'string' && APP_ID.test(r.id) && typeof r.name === 'string') {
    const name = clean(r.name, 60)
    return name ? { kind: 'app', id: r.id, name } : null
  }
  if (r.kind === 'url' && typeof r.url === 'string') {
    const url = routineUrl(r.url)
    return url ? { kind: 'url', url } : null
  }
  if (r.kind === 'path' && typeof r.path === 'string') {
    const path = routinePath(r.path)
    return path ? { kind: 'path', path } : null
  }
  return null
}

/** Atajos válidos (nombres sin repetir, sin vacíos de más). */
export function validateRoutines(raw: unknown): Routine[] {
  if (!Array.isArray(raw)) return []
  const out: Routine[] = []
  const names = new Set<string>()
  for (const r of raw.slice(0, MAX_ROUTINES)) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = typeof o.id === 'string' && /^[a-z0-9]{1,16}$/.test(o.id) ? o.id : Math.random().toString(36).slice(2, 10)
    const name = typeof o.name === 'string' ? clean(o.name, MAX_ROUTINE_NAME) : ''
    const items = Array.isArray(o.items) ? o.items.slice(0, MAX_ROUTINE_ITEMS).map(validItem).filter((i): i is RoutineItem => i !== null) : []
    // Un atajo a medio crear (sin nombre todavía) se guarda igual para no perderlo al escribir.
    const key = name.toLowerCase()
    if (key && names.has(key)) continue
    if (key) names.add(key)
    out.push({ id, name, items })
  }
  return out
}

/** "Spotify, notion.so y 1 carpeta". */
export function routineSummary(items: readonly RoutineItem[], lang: 'es' | 'en'): string {
  const labels = items.map((i) => (i.kind === 'app' ? i.name : i.kind === 'url' ? new URL(i.url).hostname.replace(/^www\./, '') : (i.path.split(/[\\/]/).filter(Boolean).pop() ?? i.path)))
  if (!labels.length) return lang === 'es' ? 'Vacío' : 'Empty'
  if (labels.length === 1) return labels[0]
  const and = lang === 'es' ? ' y ' : ' and '
  return `${labels.slice(0, -1).join(', ')}${and}${labels[labels.length - 1]}`
}
