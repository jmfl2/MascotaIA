/**
 * Proceso principal: arranca la app, crea las ventanas y conecta
 * el atajo global, la bandeja, los servicios y los canales IPC.
 */
import { app, globalShortcut, ipcMain } from 'electron'
import { IPC, type ExecuteRequest, type ExecuteResponse, type QueryRequest, type QueryResponse } from '../shared/ipc'
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
  bubbleAction,
  bubbleDismissed,
  bubbleHidden,
  bubbleResized,
  createBubbleWindow,
  getBubbleWebContents,
  repositionBubble
} from './bubbleWindow'
import { appInfo, execute, query } from './commandRunner'
import { handleDroppedPaths, setClipboardEnabled, startFeatures } from './features'
import { robotMood } from './robotMood'
import {
  createRobotWindow,
  dragEnd,
  dragStart,
  getRobotWindow,
  isRobotVisible,
  onRobotMoved,
  setRobotVisible
} from './robotWindow'
import { denyAllPermissions, isFrom } from './security'
import { clipboardWatcher } from './services/clipboardWatcher'
import { refreshIndex } from './services/launcher'
import { pomodoroService } from './services/pomodoro'
import { registerShortcut } from './shortcut'
import { getConfig } from './store'
import { createTray } from './tray'

// Una sola instancia: si se lanza otra vez, abrimos la barra de la que ya corre.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openBar())
  app.whenReady().then(start)
}

// Identificador de la app para Windows. En desarrollo tiene que ser la ruta de
// electron.exe para que las notificaciones nativas aparezcan.
app.setAppUserModelId(app.isPackaged ? 'com.jmfl2.mascota' : process.execPath)

// La app vive en la bandeja: cerrar ventanas no la termina.
app.on('window-all-closed', () => {
  /* no salir */
})

app.on('will-quit', () => globalShortcut.unregisterAll())

function start(): void {
  denyAllPermissions()
  registerIpc()

  const robotWin = createRobotWindow()
  createBarWindow()
  const bubbleWin = createBubbleWindow()

  // El robot escucha mientras la barra está abierta; el bocadillo lo sigue al moverse.
  onBarVisibilityChange((open) => robotMood.setBarOpen(open))
  onRobotMoved(repositionBubble)

  registerShortcut(getConfig().shortcut, toggleBar)
  // Los avisos esperan a que el robot y el bocadillo estén listos; si no, un
  // recordatorio vencido al arrancar saldría como notificación de Windows.
  void Promise.all([
    new Promise((resolve) => robotWin.once('ready-to-show', () => resolve(null))),
    new Promise((resolve) => bubbleWin.webContents.once('did-finish-load', () => resolve(null)))
  ]).then(() => setTimeout(startFeatures, 600))
  void refreshIndex(true) // indexa las apps del menú Inicio en segundo plano

  createTray({
    toggleRobot: () => setRobotVisible(!isRobotVisible()),
    isRobotVisible,
    openBar,
    changeShortcut: (accelerator) => registerShortcut(accelerator, toggleBar),
    isClipboardEnabled: () => clipboardWatcher.isRunning(),
    setClipboardEnabled,
    isPomodoroRunning: () => pomodoroService.status() !== null,
    stopPomodoro: () => pomodoroService.stop(),
    quit: () => app.quit()
  })
}

/** Valida que algo sea un string de longitud razonable. */
function isShortString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max
}

function isInt(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max
}

function registerIpc(): void {
  const robot = () => getRobotWindow()?.webContents
  const bar = () => getBarWindow()?.webContents
  const bubble = () => getBubbleWebContents()

  // --- Robot ---
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
  ipcMain.on(IPC.robotDrop, (event, paths: unknown) => {
    if (isFrom(event, robot())) handleDroppedPaths(paths)
  })

  // --- Barra ---
  ipcMain.handle(IPC.barQuery, async (event, req: unknown): Promise<QueryResponse> => {
    const r = (req ?? {}) as Partial<QueryRequest>
    if (!isFrom(event, bar()) || !isInt(r.seq, 0, Number.MAX_SAFE_INTEGER) || !isShortString(r.text, 2000)) {
      return { seq: -1, items: [] }
    }
    const commandId = isShortString(r.commandId, 32) ? r.commandId : null
    return query({ seq: r.seq, commandId, text: r.text })
  })
  ipcMain.handle(IPC.barExecute, async (event, req: unknown): Promise<ExecuteResponse> => {
    const r = (req ?? {}) as Partial<ExecuteRequest>
    if (!isFrom(event, bar()) || !isInt(r.seq, 0, Number.MAX_SAFE_INTEGER) || !isInt(r.index, 0, 1000)) {
      return { kind: 'stale' }
    }
    return execute({ seq: r.seq, index: r.index, secondary: r.secondary === true }, closeBar)
  })
  ipcMain.on(IPC.barHidden, (event) => {
    if (isFrom(event, bar())) barHidden()
  })
  ipcMain.on(IPC.barRequestClose, (event) => {
    if (isFrom(event, bar())) closeBar()
  })
  ipcMain.on(IPC.barError, (event) => {
    if (isFrom(event, bar())) robotMood.flash('confused')
  })
  ipcMain.handle(IPC.appInfo, (event) => (isFrom(event, bar()) ? appInfo() : null))

  // --- Bocadillo ---
  ipcMain.on(IPC.bubbleResize, (event, height: unknown) => {
    if (isFrom(event, bubble()) && typeof height === 'number') bubbleResized(height)
  })
  ipcMain.on(IPC.bubbleAction, (event, payload: unknown) => {
    const p = (payload ?? {}) as Record<string, unknown>
    if (isFrom(event, bubble()) && isShortString(p.bubbleId, 64) && isShortString(p.actionId, 32)) {
      bubbleAction(p.bubbleId, p.actionId)
    }
  })
  ipcMain.on(IPC.bubbleDismiss, (event, bubbleId: unknown) => {
    if (isFrom(event, bubble()) && isShortString(bubbleId, 64)) bubbleDismissed(bubbleId)
  })
  ipcMain.on(IPC.bubbleHidden, (event) => {
    if (isFrom(event, bubble())) bubbleHidden()
  })
}
