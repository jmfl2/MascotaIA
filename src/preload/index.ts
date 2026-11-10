/**
 * Preload: el único puente entre las páginas y Electron.
 *
 * Con `contextIsolation` y `sandbox` activos, las páginas no ven `require`
 * ni `ipcRenderer`; solo esta API mínima y tipada en `window.mascota`.
 * Nunca se expone `ipcRenderer` entero ni canales arbitrarios.
 */
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC, type BubbleView, type CursorOffset, type MascotaApi, type PomodoroView, type RobotState } from '../shared/ipc'

/** Suscribe a un canal fijo y devuelve la función para darse de baja. */
function listen<T>(channel: string, cb: (payload: T) => void) {
  const handler = (_event: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: MascotaApi = {
  robot: {
    dragStart: () => ipcRenderer.send(IPC.robotDragStart),
    dragEnd: () => ipcRenderer.invoke(IPC.robotDragEnd),
    click: () => ipcRenderer.send(IPC.robotClick),
    dropFiles: (files) => {
      // Desde Electron 32 `File.path` no existe: la ruta se obtiene aquí, en el preload.
      const paths = files
        .slice(0, 10)
        .map((f) => webUtils.getPathForFile(f))
        .filter(Boolean)
      if (paths.length) ipcRenderer.send(IPC.robotDrop, paths)
    },
    onCursor: (cb) => listen<CursorOffset>(IPC.robotCursor, cb),
    onHover: (cb) => listen<boolean>(IPC.robotHover, cb),
    onState: (cb) => listen<RobotState>(IPC.robotState, cb),
    onDragMoving: (cb) => listen<void>(IPC.robotDragMoving, () => cb()),
    onPomodoro: (cb) => listen<PomodoroView>(IPC.robotPomodoro, cb)
  },
  bar: {
    query: (req) => ipcRenderer.invoke(IPC.barQuery, req),
    execute: (req) => ipcRenderer.invoke(IPC.barExecute, req),
    hidden: () => ipcRenderer.send(IPC.barHidden),
    requestClose: () => ipcRenderer.send(IPC.barRequestClose),
    reportError: () => ipcRenderer.send(IPC.barError),
    onOpen: (cb) => listen<void>(IPC.barOpen, () => cb()),
    onClose: (cb) => listen<void>(IPC.barClose, () => cb()),
    getInfo: () => ipcRenderer.invoke(IPC.appInfo)
  },
  bubble: {
    action: (bubbleId, actionId) => ipcRenderer.send(IPC.bubbleAction, { bubbleId, actionId }),
    dismiss: (bubbleId) => ipcRenderer.send(IPC.bubbleDismiss, bubbleId),
    resize: (height) => ipcRenderer.send(IPC.bubbleResize, height),
    hidden: () => ipcRenderer.send(IPC.bubbleHidden),
    onShow: (cb) => listen<BubbleView>(IPC.bubbleShow, cb),
    onHide: (cb) => listen<void>(IPC.bubbleHide, () => cb())
  }
}

contextBridge.exposeInMainWorld('mascota', api)
