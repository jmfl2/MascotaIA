/**
 * Lanzador: apps del menú Inicio + favoritos.
 *
 * Fuentes del índice:
 * - `Get-StartApps` (PowerShell): todas las apps del menú Inicio con su nombre
 *   en el idioma del sistema, incluidas las de la Microsoft Store. Se abren con
 *   `explorer.exe shell:AppsFolder\<AppID>`.
 * - Los accesos directos (.lnk) de las carpetas del menú Inicio: permiten
 *   obtener el icono real y abrir el programa directamente.
 * - Favoritos (favorites.json): carpetas, archivos o accesos directos que el
 *   usuario suelta sobre el robot.
 *
 * Solo se abre lo que está en el índice o en favoritos: el texto que escribe
 * el usuario nunca se usa como ruta ni como comando.
 */
import { app, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, isAbsolute, join, parse } from 'node:path'
import type { LaunchTarget, Outcome } from '../../commands'
import { normalize, matchScore } from '../../commands/match'
import { extractIcons, lowPriority } from './iconExtractor'
import { arrayOf, isNum, isStr, newId, readJson, writeJson } from './jsonFile'

interface Entry {
  id: string
  name: string
  detail: string
  /** Ruta a abrir con shell.openPath (accesos directos y favoritos). */
  path?: string
  /** AppID para shell:AppsFolder (apps sin acceso directo, p. ej. de la Store). */
  appId?: string
  favorite: boolean
}

interface Favorite {
  id: string
  name: string
  path: string
  addedAt: number
}

const FAVORITES_FILE = 'favorites.json'
/** Iconos ya extraídos, para no repetir el trabajo en cada arranque. */
const ICONS_FILE = 'icons.json'
const REFRESH_AFTER_MS = 10 * 60_000
const FAVORITE_BOOST = 15
const SHORTCUT_EXT = new Set(['.lnk', '.url', '.appref-ms'])
/** Accesos directos que no son apps útiles. */
const NOISE = /(uninstall|desinstalar|readme|l[eé]ame|release notes|website|sitio web|documentation|documentaci[oó]n|help|ayuda)\b/i
/** AppID seguro para pasarlo como argumento a explorer.exe. */
const SAFE_APP_ID = /^[^"\r\n\0<>|]{1,260}$/

let index: Entry[] = []
let indexedAt = 0
let indexing: Promise<void> | null = null
let favorites: Favorite[] | null = null
/** Iconos de Electron (32 px), solo mientras no llegan los buenos. */
const iconCache = new Map<string, string | null>()
/** Iconos en alta resolución por elemento (ruta o shell:AppsFolder\<AppID>). */
const hiResIcons = new Map<string, string>()
/** Elementos ya pedidos al extractor (con o sin éxito), para no repetirlos. */
const requestedIcons = new Set<string>()
let iconQueue: Promise<void> = Promise.resolve()

interface CachedIcon {
  target: string
  /** Fecha de modificación del acceso directo (0 en apps de la Store). */
  mtime: number
  url: string
}
let iconDisk: Map<string, CachedIcon> | null = null

function loadIconDisk(): Map<string, CachedIcon> {
  iconDisk ??= new Map(
    readJson(
      ICONS_FILE,
      (raw) =>
        arrayOf(raw, (c) =>
          isStr(c.target, 1000) && isNum(c.mtime) && isStr(c.url, 70_000) && c.url.startsWith('data:image/png;base64,')
            ? { target: c.target, mtime: c.mtime, url: c.url }
            : null
        ),
      () => []
    ).map((c) => [c.target, c])
  )
  return iconDisk
}

/** Fecha de modificación de una ruta (si cambia el acceso directo, se vuelve a sacar el icono). */
function mtimeOf(target: string): number {
  if (!isAbsolute(target)) return 0
  try {
    return Math.floor(statSync(target).mtimeMs)
  } catch {
    return -1
  }
}

// --- Favoritos -----------------------------------------------------------------

function loadFavorites(): Favorite[] {
  favorites ??= readJson(
    FAVORITES_FILE,
    (raw) =>
      arrayOf(raw, (f) =>
        isStr(f.id, 64) && isStr(f.name, 260) && isStr(f.path, 1000) && isNum(f.addedAt) && isAbsolute(f.path)
          ? { id: f.id, name: f.name, path: f.path, addedAt: f.addedAt }
          : null
      ),
    () => []
  )
  return favorites
}

function favoriteEntry(f: Favorite): Entry {
  return { id: `fav:${f.id}`, name: f.name, detail: f.path, path: f.path, favorite: true }
}

/** Nombre visible de una ruta: carpeta o archivo sin extensión de acceso directo. */
function displayName(path: string): string {
  const { root, base, name, ext } = parse(path)
  if (!base) return root.replace(/[\\/]+$/, '') // "C:\" -> "C:"
  return SHORTCUT_EXT.has(ext.toLowerCase()) ? name : base
}

/** Añade rutas a favoritos. Devuelve los nombres añadidos (ignora duplicados e inexistentes). */
export function addFavorites(paths: string[]): string[] {
  const added: string[] = []
  const list = loadFavorites()
  for (const path of paths) {
    if (!isAbsolute(path) || !existsSync(path)) continue
    if (list.some((f) => f.path.toLowerCase() === path.toLowerCase())) continue
    const fav: Favorite = { id: newId(), name: displayName(path), path, addedAt: Date.now() }
    list.unshift(fav)
    added.push(fav.name)
  }
  if (added.length) {
    favorites = list.slice(0, 200)
    writeJson(FAVORITES_FILE, favorites)
    loadIcons(favorites.map(favoriteEntry))
  }
  return added
}

// --- Índice de apps ------------------------------------------------------------

function startMenuDirs(): string[] {
  return [
    join(process.env.ProgramData ?? 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    join(app.getPath('appData'), 'Microsoft\\Windows\\Start Menu\\Programs')
  ]
}

/** Busca accesos directos en el menú Inicio (hasta 4 niveles de carpetas). */
function scanShortcuts(dir: string, depth = 0, out = new Map<string, string>()): Map<string, string> {
  if (depth > 4) return out
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    const full = join(dir, name)
    const ext = extname(name).toLowerCase()
    if (SHORTCUT_EXT.has(ext)) {
      const display = basename(name, extname(name))
      if (!NOISE.test(display) && !out.has(normalize(display))) out.set(normalize(display), full)
    } else if (!ext) {
      try {
        if (statSync(full).isDirectory()) scanShortcuts(full, depth + 1, out)
      } catch {
        /* sin permiso: se ignora */
      }
    }
  }
  return out
}

/** Lista de apps según Windows (nombres localizados, incluye la Store). */
function getStartApps(): Promise<Array<{ name: string; appId: string }>> {
  const script = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress'
  return new Promise((resolve) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 20_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (err) {
          console.warn('[lanzador] Get-StartApps falló:', err.message)
          return resolve([])
        }
        try {
          const parsed: unknown = JSON.parse(stdout.trim() || '[]')
          const list = Array.isArray(parsed) ? parsed : [parsed]
          resolve(
            arrayOf(list, (a) =>
              isStr(a.Name, 260) && isStr(a.AppID, 260) && a.Name.trim() && SAFE_APP_ID.test(a.AppID)
                ? { name: a.Name.trim(), appId: a.AppID }
                : null
            )
          )
        } catch {
          resolve([])
        }
      }
    )
    lowPriority(child.pid)
  })
}

async function buildIndex(): Promise<void> {
  const shortcuts = new Map<string, string>()
  for (const dir of startMenuDirs()) scanShortcuts(dir, 0, shortcuts)
  const startApps = await getStartApps()

  const entries: Entry[] = []
  const seen = new Set<string>()
  for (const a of startApps) {
    const key = normalize(a.name)
    if (seen.has(key) || NOISE.test(a.name)) continue
    seen.add(key)
    const path = shortcuts.get(key)
    entries.push(
      path
        ? { id: `lnk:${path}`, name: a.name, detail: 'Aplicación', path, favorite: false }
        : { id: `app:${a.appId}`, name: a.name, detail: 'Aplicación', appId: a.appId, favorite: false }
    )
  }
  // Accesos directos que Get-StartApps no listó (o si PowerShell falló).
  for (const [key, path] of shortcuts) {
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ id: `lnk:${path}`, name: basename(path, extname(path)), detail: 'Aplicación', path, favorite: false })
  }
  index = entries
  indexedAt = Date.now()
  console.log(`[lanzador] ${entries.length} apps indexadas`)
  loadIcons(allEntries())
}

/** Reindexa en segundo plano si el índice es viejo. Devuelve la promesa en curso. */
export function refreshIndex(force = false): Promise<void> {
  if (indexing) return indexing
  if (!force && index.length && Date.now() - indexedAt < REFRESH_AFTER_MS) return Promise.resolve()
  indexing = buildIndex().finally(() => {
    indexing = null
  })
  return indexing
}

// --- Iconos ----------------------------------------------------------------------

/** Qué se le pide al shell de Windows para sacar el icono de una entrada. */
function iconTarget(e: Entry): string | undefined {
  if (e.path) return e.path
  if (e.appId && SAFE_APP_ID.test(e.appId)) return `shell:AppsFolder\\${e.appId}`
  return undefined
}

/**
 * Extrae en segundo plano los iconos en alta resolución que falten. Los lotes
 * van en cola (un solo PowerShell a la vez); mientras tanto se usa el de Electron.
 */
function loadIcons(entries: Entry[]): void {
  const disk = loadIconDisk()
  const missing: string[] = []
  for (const target of entries.map(iconTarget)) {
    if (!target || requestedIcons.has(target)) continue
    requestedIcons.add(target)
    const cached = disk.get(target)
    if (cached && cached.mtime === mtimeOf(target)) hiResIcons.set(target, cached.url)
    else missing.push(target)
  }
  if (!missing.length) return
  iconQueue = iconQueue.then(async () => {
    const icons = await extractIcons(missing)
    for (const [target, url] of icons) {
      hiResIcons.set(target, url)
      disk.set(target, { target, mtime: mtimeOf(target), url })
    }
    console.log(`[lanzador] ${icons.size}/${missing.length} iconos nuevos en alta resolución`)
    // Se guardan solo los de apps que siguen existiendo.
    const alive = new Set(allEntries().map(iconTarget))
    writeJson(ICONS_FILE, [...disk.values()].filter((c) => alive.has(c.target)))
  })
}

async function iconFor(e: Entry): Promise<string | undefined> {
  const target = iconTarget(e)
  const hiRes = target && hiResIcons.get(target)
  if (hiRes) return hiRes
  const path = e.path
  if (!path) return undefined
  if (iconCache.has(path)) return iconCache.get(path) ?? undefined
  try {
    const img = await app.getFileIcon(path, { size: 'normal' })
    const url = img.isEmpty() ? null : img.toDataURL()
    iconCache.set(path, url)
    return url ?? undefined
  } catch {
    iconCache.set(path, null)
    return undefined
  }
}

async function toTarget(e: Entry, score: number): Promise<LaunchTarget> {
  return { id: e.id, name: e.name, detail: e.detail, favorite: e.favorite, score, icon: await iconFor(e) }
}

// --- API para los comandos ---------------------------------------------------------

function allEntries(): Entry[] {
  return [...loadFavorites().map(favoriteEntry), ...index]
}

export const launcherService = {
  async search(query: string, limit: number): Promise<LaunchTarget[]> {
    if (!index.length) await refreshIndex() // primera vez: esperamos al índice
    else void refreshIndex()
    const ranked = allEntries()
      .map((e) => ({ e, score: Math.min(100, matchScore(e.name, query) + (e.favorite ? FAVORITE_BOOST : 0)) }))
      .filter((r) => r.score > (r.e.favorite ? FAVORITE_BOOST : 0))
      .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, 'es'))
      .slice(0, limit)
    return Promise.all(ranked.map((r) => toTarget(r.e, r.score)))
  },

  async favorites(): Promise<LaunchTarget[]> {
    return Promise.all(loadFavorites().map((f) => toTarget(favoriteEntry(f), 100)))
  },

  async open(id: string): Promise<Outcome> {
    const entry = allEntries().find((e) => e.id === id)
    if (!entry) return { kind: 'error', message: 'Ya no está disponible' }
    if (entry.path) {
      if (!existsSync(entry.path)) return { kind: 'error', message: 'No se encuentra: ¿se movió o se borró?' }
      const error = await shell.openPath(entry.path)
      return error ? { kind: 'error', message: `No se pudo abrir: ${error}` } : { kind: 'close', mood: 'happy' }
    }
    if (entry.appId && SAFE_APP_ID.test(entry.appId)) {
      // Argumentos como array y sin shell: no hay interpretación de comandos.
      const child = spawn('explorer.exe', [`shell:AppsFolder\\${entry.appId}`], { detached: true, stdio: 'ignore' })
      child.on('error', (err) => console.warn('[lanzador] explorer.exe falló:', err))
      child.unref()
      return { kind: 'close', mood: 'happy' }
    }
    return { kind: 'error', message: 'No se puede abrir' }
  },

  removeFavorite(id: string): boolean {
    const favId = id.startsWith('fav:') ? id.slice(4) : null
    if (!favId) return false
    const list = loadFavorites()
    const next = list.filter((f) => f.id !== favId)
    if (next.length === list.length) return false
    favorites = next
    writeJson(FAVORITES_FILE, favorites)
    return true
  }
}
