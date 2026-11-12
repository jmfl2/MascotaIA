/**
 * Actualizaciones automáticas desde las releases de GitHub.
 *
 * - Mira si hay versión nueva al rato de arrancar y cada 6 horas.
 * - Si la hay, descarga el instalador en segundo plano y comprueba su huella
 *   SHA-256 (la que da GitHub). Si no coincide, lo borra y no lo usa.
 * - Al terminar, el robot avisa: "Reiniciar y actualizar" o "Luego". Si eliges
 *   "Luego", se instala solo al salir de Mascota.
 * - La instalación es silenciosa (/S) y vuelve a abrir Mascota (--force-run).
 *   Se instala en la misma carpeta y conserva tus datos (%APPDATA%\mascota).
 *
 * En desarrollo (npm run dev) no hace nada.
 */
import { app } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdateView } from '../shared/appearance'
import { t } from '../shared/i18n'
import { showBubble, updateBubble } from './bubbleWindow'
import { robotMood } from './robotMood'
import { LATEST_RELEASE_API, pickUpdate, type AvailableUpdate } from './services/updateCheck'
import { getConfig } from './store'

const FIRST_CHECK_MS = 45_000
const CHECK_EVERY_MS = 6 * 60 * 60_000
const TIMEOUT_MS = 15_000

let view: UpdateView = { state: 'idle' }
let readyFile: string | null = null
let installing = false
let busy: Promise<void> | null = null
const listeners = new Set<() => void>()

export function updateView(): UpdateView {
  return app.isPackaged ? view : { state: 'dev' }
}

/** Para refrescar los ajustes y el menú de la bandeja. */
export function onUpdateChange(cb: () => void): void {
  listeners.add(cb)
}

function setView(next: UpdateView): void {
  view = next
  for (const cb of listeners) cb()
}

function updatesDir(): string {
  return join(app.getPath('temp'), 'mascota-update')
}

/** Descarga el instalador calculando su huella sobre la marcha. */
async function download(update: AvailableUpdate, onProgress: (p: number) => void): Promise<string> {
  const dir = updatesDir()
  rmSync(dir, { recursive: true, force: true }) // restos de otras descargas
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `Mascota-Setup-${update.version}.exe`)

  const res = await fetch(update.url, { headers: { 'User-Agent': 'Mascota-updater' } })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const hash = createHash('sha256')
  const out = createWriteStream(file)
  let received = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > update.size) throw new Error('el instalador es más grande de lo anunciado')
      hash.update(value)
      if (!out.write(value)) await new Promise<void>((resolve) => out.once('drain', () => resolve()))
      onProgress(received / update.size)
    }
  } finally {
    await new Promise<void>((resolve) => out.end(() => resolve()))
  }
  if (received !== update.size || hash.digest('hex') !== update.sha256) {
    rmSync(file, { force: true })
    throw new Error('la huella del instalador no coincide')
  }
  return file
}

function offerRestart(version: string): void {
  robotMood.flash('happy')
  showBubble({
    kind: 'info',
    title: t(`✨ Mascota ${version} está lista`, `✨ Mascota ${version} is ready`),
    text: t('Se instala en unos segundos y vuelvo a abrirme.', 'It installs in a few seconds and I open again.'),
    timeoutMs: null,
    chime: true,
    notifyIfHidden: true,
    actions: [
      { id: 'restart', label: t('Reiniciar y actualizar', 'Restart and update'), primary: true, run: () => installUpdate() },
      { id: 'later', label: t('Al salir', 'When I quit'), run: () => {} }
    ]
  })
}

async function runCheck(manual: boolean): Promise<void> {
  if (!app.isPackaged || readyFile || installing) return
  setView({ state: 'checking' })
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Mascota-updater' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (res.status === 404) {
      setView({ state: 'up-to-date' })
      return
    }
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}`)
    const update = pickUpdate(await res.json(), app.getVersion())
    if (!update) {
      setView({ state: 'up-to-date' })
      return
    }

    setView({ state: 'downloading', version: update.version, progress: 0 })
    const bubbleId = manual
      ? showBubble({ kind: 'info', title: t(`Descargando Mascota ${update.version}…`, `Downloading Mascota ${update.version}…`), text: '0 %', timeoutMs: null })
      : null
    let lastPercent = -1
    readyFile = await download(update, (p) => {
      const percent = Math.floor(p * 100)
      if (percent === lastPercent) return
      lastPercent = percent
      setView({ state: 'downloading', version: update.version, progress: p })
      if (bubbleId) updateBubble(bubbleId, { text: `${percent} %` })
    })
    setView({ state: 'ready', version: update.version })
    offerRestart(update.version)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[actualizaciones]', message)
    setView({ state: 'error', message })
    if (manual) showBubble({ kind: 'info', title: t('No se pudo actualizar', "Couldn't update"), text: message, timeoutMs: 6000 })
  }
}

/** Busca (y descarga) una versión nueva. `manual`: lo pidió el usuario, así que se le cuenta. */
export function checkForUpdates(manual = false): Promise<void> {
  busy ??= runCheck(manual).finally(() => {
    busy = null
  })
  return busy
}

/** Lanza el instalador en silencio y cierra Mascota. `relaunch`: volver a abrirla al terminar. */
export function installUpdate(relaunch = true): void {
  if (!readyFile || installing || !existsSync(readyFile)) return
  installing = true
  const args = relaunch ? ['/S', '--force-run'] : ['/S']
  spawn(readyFile, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  if (relaunch) app.quit()
}

/** Al salir con una actualización descargada, se instala sin volver a abrir. */
export function installOnQuit(): void {
  if (readyFile && !installing && getConfig().autoUpdate) installUpdate(false)
}

export function startUpdater(): void {
  if (!app.isPackaged) return
  // Instaladores de otras veces que ya no hacen falta.
  try {
    for (const f of readdirSync(updatesDir())) rmSync(join(updatesDir(), f), { force: true })
  } catch {
    /* no hay carpeta */
  }
  const tick = () => {
    if (getConfig().autoUpdate) void checkForUpdates()
  }
  setTimeout(tick, FIRST_CHECK_MS)
  setInterval(tick, CHECK_EVERY_MS)
}
