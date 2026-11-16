/**
 * Iniciar con Windows. En desarrollo el ejecutable es electron.exe y hay que
 * pasarle la ruta del proyecto; empaquetada, la app se lanza a sí misma.
 */
import { app } from 'electron'

/** Marca con la que Windows abre Mascota al iniciar sesión. */
export const AUTOSTART_FLAG = '--autostart'

function loginItemOptions() {
  return app.isPackaged ? { args: [AUTOSTART_FLAG] } : { path: process.execPath, args: [app.getAppPath(), AUTOSTART_FLAG] }
}

/** ¿La ha abierto Windows al iniciar sesión (y no la persona a mano)? */
export function openedAtLogin(argv: readonly string[] = process.argv): boolean {
  return argv.includes(AUTOSTART_FLAG)
}

/** Las copias que se configuraron sin la marca la recuperan (para saber si se abrió sola). */
export function refreshLoginItem(): void {
  if (startsWithWindows()) setStartsWithWindows(true)
}

export function startsWithWindows(): boolean {
  return app.getLoginItemSettings(loginItemOptions()).openAtLogin
}

export function setStartsWithWindows(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, ...loginItemOptions() })
}
