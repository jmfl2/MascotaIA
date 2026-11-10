/**
 * Iniciar con Windows. En desarrollo el ejecutable es electron.exe y hay que
 * pasarle la ruta del proyecto; empaquetada, la app se lanza a sí misma.
 */
import { app } from 'electron'

function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] }
}

export function startsWithWindows(): boolean {
  return app.getLoginItemSettings(loginItemOptions()).openAtLogin
}

export function setStartsWithWindows(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, ...loginItemOptions() })
}
