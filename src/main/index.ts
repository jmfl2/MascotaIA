/**
 * Proceso principal: arranca la app, crea las ventanas y conecta
 * el atajo global, la bandeja y los canales IPC.
 */
import { app, globalShortcut, ipcMain, shell } from 'electron'
import { buildCommandUrl } from '../commands'
import { IPC, type AppInfo, type RunResult } from '../shared/ipc'
import {
  barHidden,
  closeBar,
  createBarWindow,
  getBarWindow,
  onBarVisibilityChange,
  openBar,
  toggleBar
} from './barWindow'
import {
  createRobotWindow,
  dragEnd,
  dragStart,
  getRobotWindow,
  isRobotVisible,
  sendRobotState,
  setRobotIgnoreMouse,
  setRobotVisible
} from './robotWindow'
import { denyAllPermissions, isFrom } from './security'
import { currentShortcut, registerShortcut } from './shortcut'
import { getConfig } from './store'
import { createTray } from './tray'

// Una sola instancia: si se lanza otra vez, abrimos la barra de la que ya corre.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openBar())
  app.whenReady().then(start)
}

// Identificador de la app para Windows (notificaciones y agrupación).
app.setAppUserModelId('com.jmfl2.mascota')

// La app vive en la bandeja: cerrar ventanas no la termina.
app.on('window-all-closed', () => {
  /* no salir */
})

app.on('will-quit', () => globalShortcut.unregisterAll())

function start(): void {
  denyAllPermissions()
  registerIpc()

  createRobotWindow()
  createBarWindow()

  // El robot escucha mientras la barra está abierta.
  onBarVisibilityChange((open) => sendRobotState(open ? 'listening' : 'idle'))

  registerShortcut(getConfig().shortcut, toggleBar)

  createTray({
    toggleRobot: () => setRobotVisible(!isRobotVisible()),
    isRobotVisible,
    openBar,
    changeShortcut: (accelerator) => registerShortcut(accelerator, toggleBar),
    quit: () => app.quit()
  })
}

/** Valida que algo sea un string de longitud razonable. */
function isShortString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max
}

function registerIpc(): void {
  const robot = () => getRobotWindow()?.webContents
  const bar = () => getBarWindow()?.webContents

  // --- Robot ---
  ipcMain.on(IPC.robotSetIgnoreMouse, (event, ignore: unknown) => {
    if (isFrom(event, robot())) setRobotIgnoreMouse(ignore === true)
  })
  ipcMain.on(IPC.robotDragStart, (event) => {
    if (isFrom(event, robot())) dragStart()
  })
  ipcMain.handle(IPC.robotDragEnd, (event) => {
    if (!isFrom(event, robot())) return { moved: false }
    return dragEnd()
  })
  ipcMain.on(IPC.robotClick, (event) => {
    if (isFrom(event, robot())) toggleBar()
  })

  // --- Barra ---
  ipcMain.handle(IPC.barRun, async (event, payload: unknown): Promise<RunResult> => {
    if (!isFrom(event, bar())) return { ok: false, error: 'Origen no válido' }
    const { commandId, query } = (payload ?? {}) as Record<string, unknown>
    if (!isShortString(commandId, 32) || !isShortString(query, 2000)) {
      return { ok: false, error: 'Petición no válida' }
    }

    const result = buildCommandUrl(commandId, query)
    if (!result.ok) {
      sendRobotState('confused')
      return result
    }

    try {
      await shell.openExternal(result.url)
    } catch (err) {
      console.error('[comando] No se pudo abrir el navegador:', err)
      sendRobotState('confused')
      return { ok: false, error: 'No se pudo abrir el navegador' }
    }

    closeBar()
    sendRobotState('happy')
    return { ok: true }
  })
  ipcMain.on(IPC.barHidden, (event) => {
    if (isFrom(event, bar())) barHidden()
  })
  ipcMain.on(IPC.barRequestClose, (event) => {
    if (isFrom(event, bar())) closeBar()
  })
  ipcMain.on(IPC.barError, (event) => {
    if (isFrom(event, bar())) sendRobotState('confused')
  })
  ipcMain.handle(IPC.appInfo, (event): AppInfo | null => {
    if (!isFrom(event, bar())) return null
    return { shortcut: currentShortcut() }
  })
}
