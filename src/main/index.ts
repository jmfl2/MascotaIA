/**
 * Proceso principal: arranca la app, crea las ventanas y conecta
 * el atajo global, la bandeja, los servicios y los canales IPC.
 */
import { app, globalShortcut, ipcMain, Menu } from 'electron'
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
import { chatSnapshot, copyAnswer, resetChat, sendToAi, stopAi } from './ai/aiChat'
import { aiStatus, freeAiMemory, onAiStatusChange, pullModel, refreshAiStatus, setAiModel, shutdownAi, startOllama } from './ai/aiService'
import { appInfo, execute, query } from './commandRunner'
import { startChatter } from './chatter'
import { handleDroppedPaths, isClipboardEnabled, setClipboardEnabled, startFeatures } from './features'
import { robotMood } from './robotMood'
import {
  createRobotWindow,
  dragEnd,
  dragStart,
  getRobotWindow,
  onRobotMoved
} from './robotWindow'
import { denyAllPermissions, isFrom } from './security'
import { dropDone, dropIncoming, isDocked, mascotVisible, needRobot, setDocked, setMascotVisible, showInitialTab } from './dock'
import { createTabWindow, getTabWindow, setTabInfo } from './tabWindow'
import { applySettingsPatch, getSettingsView, notifySettingsChanged, onSettingsChange } from './settings'
import { closeSettings, getSettingsWindow, openSettings } from './settingsWindow'
import { refreshIndex } from './services/launcher'
import { pomodoroService } from './services/pomodoro'
import { registerShortcut } from './shortcut'
import { getConfig } from './store'
import { createTray } from './tray'
import { musicAction, startMusic, stopMusic, syncMusic } from './music'
import { checkForUpdates, installOnQuit, installUpdate, onUpdateChange, startUpdater, updateView } from './updater'
import { activeSeason, onSeasonChange, startSeasons } from './seasons'
import { setLang, t } from '../shared/i18n'

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  shutdownAi()
  stopMusic()
  installOnQuit()
})

function start(): void {
  setLang(getConfig().language)
  denyAllPermissions()
  registerIpc()

  const robotWin = createRobotWindow()
  const tabWin = createTabWindow()
  tabWin.once('ready-to-show', showInitialTab)
  const refreshTabInfo = () => setTabInfo(getConfig().personality.name, getConfig().shortcut, activeSeason()?.emoji)
  refreshTabInfo()
  onSettingsChange(refreshTabInfo)
  onSeasonChange(refreshTabInfo)
  // La música, cuando la pestaña ya está cargada (y al cambiar los ajustes o el modo).
  tabWin.webContents.once('did-finish-load', startMusic)
  onSettingsChange(syncMusic)
  createBarWindow()
  const bubbleWin = createBubbleWindow()

  // El robot escucha mientras la barra está abierta; el bocadillo lo sigue al moverse.
  onBarVisibilityChange((open) => {
    robotMood.setBarOpen(open)
    needRobot('bar', open) // en modo pestaña, el robot baja mientras la barra está abierta
    // Por si se instaló o arrancó Ollama mientras tanto. El modelo no se carga
    // aquí: solo al entrar en un comando de IA (ver commandRunner.query).
    if (open) void refreshAiStatus()
  })
  onRobotMoved(repositionBubble)

  registerShortcut(getConfig().shortcut, toggleBar)
  // Los avisos esperan a que el robot y el bocadillo estén listos; si no, un
  // recordatorio vencido al arrancar saldría como notificación de Windows.
  void Promise.all([
    new Promise((resolve) => robotWin.once('ready-to-show', () => resolve(null))),
    new Promise((resolve) => bubbleWin.webContents.once('did-finish-load', () => resolve(null)))
  ]).then(() =>
    setTimeout(() => {
      startFeatures()
      startChatter()
      startUpdater()
      startSeasons()
    }, 600)
  )
  // Indexa las apps del menú Inicio (y sus iconos) en segundo plano, cuando el
  // robot ya está en pantalla: así no compite con el arranque. Si abres la
  // barra antes, la búsqueda lo lanza ella misma.
  setTimeout(() => void refreshIndex(), 4000)
  void refreshAiStatus()
  setInterval(() => void refreshAiStatus(), 60_000)

  const tray = createTray({
    toggleRobot: () => setMascotVisible(!mascotVisible()),
    isRobotVisible: mascotVisible,
    isDocked,
    setDocked,
    openBar,
    changeShortcut: (accelerator) => registerShortcut(accelerator, toggleBar),
    isClipboardEnabled,
    setClipboardEnabled,
    isPomodoroRunning: () => pomodoroService.status() !== null,
    stopPomodoro: () => pomodoroService.stop(),
    aiStatus,
    setAiModel,
    startOllama: () => void startOllama(),
    pullModel: () => void pullModel(),
    freeAiMemory: () => void freeAiMemory(),
    openSettings,
    updateState: updateView,
    checkForUpdates: () => void checkForUpdates(true),
    installUpdate: () => installUpdate(),
    robotName: () => getConfig().personality.name,
    changed: notifySettingsChanged,
    quit: () => app.quit()
  })
  onAiStatusChange(() => tray.rebuild())
  onUpdateChange(() => {
    tray.rebuild()
    notifySettingsChanged()
  })
  onSettingsChange(() => tray.rebuild())
}

/** Cambia de modo desde un menú y avisa a los ajustes y a la bandeja. */
function toggleDock(docked: boolean): void {
  setDocked(docked)
  notifySettingsChanged()
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

  // Idioma: lo pide el preload de cada página al cargar (solo nuestras ventanas).
  ipcMain.on(IPC.appLang, (event) => {
    const ours = [robot(), bar(), bubble(), getTabWindow()?.webContents, getSettingsWindow()?.webContents]
    event.returnValue = ours.some((wc) => isFrom(event, wc)) ? getConfig().language : 'es'
  })

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
    if (!isFrom(event, robot())) return
    dropDone()
    handleDroppedPaths(paths)
  })
  ipcMain.on(IPC.robotContextMenu, (event) => {
    const win = getRobotWindow()
    if (!isFrom(event, robot()) || !win) return
    Menu.buildFromTemplate([
      { label: t('Abrir barra', 'Open bar'), click: () => openBar() },
      { label: t('Ajustes…', 'Settings…'), click: () => openSettings() },
      { type: 'separator' },
      { label: t('Esconder en una pestaña arriba', 'Hide in a tab at the top'), type: 'checkbox', checked: isDocked(), click: (item) => toggleDock(item.checked) },
      { type: 'separator' },
      { label: isDocked() ? t('Ocultar pestaña', 'Hide tab') : t('Ocultar robot', 'Hide robot'), click: () => setMascotVisible(false) }
    ]).popup({ window: win })
  })

  // --- Pestaña (modo pestaña) ---
  const tab = () => getTabWindow()?.webContents
  ipcMain.on(IPC.tabClick, (event) => {
    if (isFrom(event, tab())) toggleBar()
  })
  ipcMain.on(IPC.tabDragOver, (event) => {
    if (isFrom(event, tab())) dropIncoming()
  })
  ipcMain.on(IPC.tabDrop, (event, paths: unknown) => {
    if (!isFrom(event, tab())) return
    dropDone()
    handleDroppedPaths(paths)
  })
  ipcMain.on(IPC.tabMediaAction, (event, action: unknown) => {
    if (isFrom(event, tab())) musicAction(action)
  })
  ipcMain.on(IPC.tabContextMenu, (event) => {
    const win = getTabWindow()
    if (!isFrom(event, tab()) || !win) return
    Menu.buildFromTemplate([
      { label: t('Abrir barra', 'Open bar'), click: () => openBar() },
      { label: t('Ajustes…', 'Settings…'), click: () => openSettings() },
      { type: 'separator' },
      { label: t('Robot siempre en pantalla', 'Robot always on screen'), click: () => toggleDock(false) },
      { label: t('Ocultar pestaña', 'Hide tab'), click: () => setMascotVisible(false) }
    ]).popup({ window: win })
  })

  // --- Ajustes ---
  const settingsWc = () => getSettingsWindow()?.webContents
  ipcMain.handle(IPC.settingsGet, (event) => (isFrom(event, settingsWc()) ? getSettingsView() : null))
  ipcMain.on(IPC.settingsUpdate, (event, patch: unknown) => {
    if (isFrom(event, settingsWc())) applySettingsPatch(patch)
  })
  ipcMain.on(IPC.settingsClose, (event) => {
    if (isFrom(event, settingsWc())) closeSettings()
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

  // --- Chat con la IA (desde la barra) ---
  ipcMain.on(IPC.aiSend, (event, payload: unknown) => {
    const p = (payload ?? {}) as Record<string, unknown>
    const provider = p.provider === 'claude' ? 'claude' : 'local'
    if (isFrom(event, bar()) && isShortString(p.text, 20_000)) void sendToAi('chat', p.text, provider)
  })
  ipcMain.on(IPC.aiStop, (event) => {
    if (isFrom(event, bar())) stopAi()
  })
  ipcMain.on(IPC.aiReset, (event) => {
    if (isFrom(event, bar())) resetChat()
  })
  ipcMain.on(IPC.aiCopy, (event, index: unknown) => {
    if (isFrom(event, bar()) && isInt(index, 0, 1000)) copyAnswer(index)
  })
  ipcMain.handle(IPC.aiSnapshot, (event) => (isFrom(event, bar()) ? chatSnapshot() : null))
}
