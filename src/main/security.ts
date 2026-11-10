/**
 * Endurecimiento de las ventanas. Nuestras páginas son locales y no navegan,
 * así que cualquier navegación, ventana nueva o permiso se bloquea.
 */
import { app, session, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'

/** Opciones de webPreferences comunes a todas las ventanas. */
export function secureWebPreferences(preload: string): Electron.WebPreferences {
  return {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    spellcheck: false,
    devTools: !app.isPackaged
  }
}

/** Bloquea navegación, popups y webviews en un WebContents. */
export function hardenWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-redirect', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

/** Deniega todas las peticiones de permisos (cámara, notificaciones, etc.). */
export function denyAllPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
}

/** Comprueba que un mensaje IPC viene de la ventana esperada. */
export function isFrom(
  event: IpcMainEvent | IpcMainInvokeEvent,
  contents: WebContents | undefined
): boolean {
  return !!contents && !contents.isDestroyed() && event.sender === contents && event.senderFrame === contents.mainFrame
}
