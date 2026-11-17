/**
 * Que Mascota no se quede "zombi" (viva pero sin ventanas que se vean).
 *
 * Pasaba al actualizar: si la versión vieja no llegaba a cerrarse, el instalador
 * cambiaba sus archivos por debajo, sus ventanas se rompían y el proceso seguía
 * vivo ocupando el sitio. Como solo puede haber una Mascota, cada vez que se
 * abría la nueva, esta le pasaba el aviso a la rota y se cerraba: no se veía nada.
 *
 * - Si la que se abre es de otra versión (o en disco ya hay otra versión), la
 *   que estaba abierta se reinicia con los archivos nuevos.
 * - Si una ventana se rompe, se recarga (o, si en disco hay otra versión, se
 *   reinicia la app entera).
 */
import { app, type WebContents } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUTOSTART_FLAG } from './startup'

/** Versión instalada en disco ahora mismo (puede no ser la que está corriendo). */
export function diskVersion(): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')) as { version?: unknown }
    return typeof pkg.version === 'string' ? pkg.version : null
  } catch {
    return null
  }
}

/** ¿Esta Mascota es de otra versión que la de disco o que la que acaban de abrir? */
export function isOutdated(otherVersion?: unknown): boolean {
  const running = app.getVersion()
  if (typeof otherVersion === 'string' && otherVersion !== running) return true
  const onDisk = diskVersion()
  return onDisk !== null && onDisk !== running
}

/** Se reinicia con los archivos de disco. Al reabrir se ve aunque estuviera escondida. */
export function relaunchFresh(reason: string): void {
  console.warn(`[arranque] se reinicia: ${reason}`)
  app.relaunch({ args: process.argv.slice(1).filter((a) => a !== AUTOSTART_FLAG) })
  app.exit(0)
}

/** Ventanas que se recargaron hace poco (para no entrar en un bucle si siguen cayéndose). */
const recentReloads: number[] = []
const MAX_RELOADS_PER_MINUTE = 3

/** Una ventana de Mascota se ha roto: se recarga, o se reinicia la app si hay versión nueva en disco. */
export function onWindowGone(wc: WebContents, reason: string): void {
  if (reason === 'clean-exit') return
  if (isOutdated()) return relaunchFresh(`ventana caída (${reason}) y en disco hay otra versión (${diskVersion()})`)
  const now = Date.now()
  while (recentReloads.length && now - recentReloads[0] > 60_000) recentReloads.shift()
  if (recentReloads.length >= MAX_RELOADS_PER_MINUTE) return relaunchFresh(`ventanas cayéndose una y otra vez (${reason})`)
  recentReloads.push(now)
  setTimeout(() => {
    if (!wc.isDestroyed()) wc.reload()
  }, 1000)
}
