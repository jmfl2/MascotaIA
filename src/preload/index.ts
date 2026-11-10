/**
 * Preload: el único puente entre las páginas y Electron.
 *
 * Con `contextIsolation` y `sandbox` activos, las páginas no ven `require`
 * ni `ipcRenderer`; solo esta API mínima y tipada en `window.mascota`.
 * Nunca se expone `ipcRenderer` entero ni canales arbitrarios.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type CursorOffset, type MascotaApi, type RobotState } from '../shared/ipc'

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
    setIgnoreMouse: (ignore) => ipcRenderer.send(IPC.robotSetIgnoreMouse, ignore === true),
    dragStart: () => ipcRenderer.send(IPC.robotDragStart),
    dragEnd: () => ipcRenderer.invoke(IPC.robotDragEnd),
    click: () => ipcRenderer.send(IPC.robotClick),
    onCursor: (cb) => listen<CursorOffset>(IPC.robotCursor, cb),
    onState: (cb) => listen<RobotState>(IPC.robotState, cb),
    onDragMoving: (cb) => listen<void>(IPC.robotDragMoving, () => cb())
  },
  bar: {
    run: (commandId, query) => ipcRenderer.invoke(IPC.barRun, { commandId, query }),
    hidden: () => ipcRenderer.send(IPC.barHidden),
    requestClose: () => ipcRenderer.send(IPC.barRequestClose),
    reportError: () => ipcRenderer.send(IPC.barError),
    onOpen: (cb) => listen<void>(IPC.barOpen, () => cb()),
    onClose: (cb) => listen<void>(IPC.barClose, () => cb()),
    getInfo: () => ipcRenderer.invoke(IPC.appInfo)
  }
}

contextBridge.exposeInMainWorld('mascota', api)
