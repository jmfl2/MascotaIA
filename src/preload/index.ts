/**
 * Preload: el único puente entre las páginas y Electron.
 *
 * Con `contextIsolation` y `sandbox` activos, las páginas no ven `require`
 * ni `ipcRenderer`; solo esta API mínima y tipada en `window.mascota`.
 * Nunca se expone `ipcRenderer` entero ni canales arbitrarios.
 */
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type BubbleView,
  type ChatSnapshot,
  type CursorOffset,
  type MascotaApi,
  type PomodoroView,
  type RobotState,
  type TabInfo,
  type TabMediaView
} from '../shared/ipc'
import type { Appearance, SettingsView } from '../shared/appearance'

/** Suscribe a un canal fijo y devuelve la función para darse de baja. */
function listen<T>(channel: string, cb: (payload: T) => void) {
  const handler = (_event: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

/** Idioma de la interfaz: se pide una vez, al cargar (al cambiarlo, la página se recarga). */
function readLang(): MascotaApi['lang'] {
  const lang: unknown = ipcRenderer.sendSync(IPC.appLang)
  return lang === 'en' ? 'en' : 'es'
}

const api: MascotaApi = {
  lang: readLang(),
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
    onPomodoro: (cb) => listen<PomodoroView>(IPC.robotPomodoro, cb),
    onAppearance: (cb) => listen<Appearance>(IPC.robotAppearance, cb),
    contextMenu: () => ipcRenderer.send(IPC.robotContextMenu),
    onEnter: (cb) => listen<void>(IPC.robotEnter, () => cb()),
    onLeave: (cb) => listen<void>(IPC.robotLeave, () => cb()),
    onMusic: (cb) => listen<boolean>(IPC.robotMusic, (playing) => cb(playing === true))
  },
  tab: {
    click: () => ipcRenderer.send(IPC.tabClick),
    contextMenu: () => ipcRenderer.send(IPC.tabContextMenu),
    onNear: (cb) => listen<number>(IPC.tabNear, cb),
    onInfo: (cb) => listen<TabInfo>(IPC.tabInfo, cb),
    onPomodoro: (cb) => listen<PomodoroView>(IPC.tabPomodoro, cb),
    onMedia: (cb) => listen<TabMediaView>(IPC.tabMedia, cb),
    dragOver: () => ipcRenderer.send(IPC.tabDragOver),
    dropFiles: (files) => {
      const paths = files
        .slice(0, 10)
        .map((f) => webUtils.getPathForFile(f))
        .filter(Boolean)
      if (paths.length) ipcRenderer.send(IPC.tabDrop, paths)
    },
    mediaAction: (action) => ipcRenderer.send(IPC.tabMediaAction, action)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.send(IPC.settingsUpdate, patch),
    close: () => ipcRenderer.send(IPC.settingsClose),
    onChanged: (cb) => listen<SettingsView>(IPC.settingsChanged, cb)
  },
  bar: {
    query: (req) => ipcRenderer.invoke(IPC.barQuery, req),
    execute: (req) => ipcRenderer.invoke(IPC.barExecute, req),
    hidden: () => ipcRenderer.send(IPC.barHidden),
    requestClose: () => ipcRenderer.send(IPC.barRequestClose),
    reportError: () => ipcRenderer.send(IPC.barError),
    onOpen: (cb) => listen<void>(IPC.barOpen, () => cb()),
    onClose: (cb) => listen<void>(IPC.barClose, () => cb()),
    onEnterChat: (cb) => listen<string>(IPC.barEnterChat, (id) => cb(id === 'claude' ? 'claude' : 'ai')),
    getInfo: () => ipcRenderer.invoke(IPC.appInfo)
  },
  ai: {
    send: (text, provider) => ipcRenderer.send(IPC.aiSend, { text, provider }),
    stop: () => ipcRenderer.send(IPC.aiStop),
    reset: () => ipcRenderer.send(IPC.aiReset),
    copy: (index) => ipcRenderer.send(IPC.aiCopy, index),
    snapshot: () => ipcRenderer.invoke(IPC.aiSnapshot),
    onUpdate: (cb) => listen<ChatSnapshot>(IPC.aiUpdate, cb),
    onDelta: (cb) => listen<{ index: number; delta: string }>(IPC.aiDelta, cb)
  },
  bubble: {
    action: (bubbleId, actionId) => ipcRenderer.send(IPC.bubbleAction, { bubbleId, actionId }),
    dismiss: (bubbleId) => ipcRenderer.send(IPC.bubbleDismiss, bubbleId),
    resize: (height) => ipcRenderer.send(IPC.bubbleResize, height),
    hidden: () => ipcRenderer.send(IPC.bubbleHidden),
    onShow: (cb) => listen<BubbleView>(IPC.bubbleShow, cb),
    onUpdate: (cb) => listen<{ id: string; title?: string; text?: string }>(IPC.bubbleUpdate, cb),
    onHide: (cb) => listen<void>(IPC.bubbleHide, () => cb())
  }
}

contextBridge.exposeInMainWorld('mascota', api)
