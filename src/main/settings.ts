/**
 * Lee y aplica los ajustes que cambia la ventana de ajustes. Todo lo que llega
 * se valida aquí (aunque la ventana sea nuestra, por principio).
 */
import { validateAppearance, validatePersonality, type SettingsView } from '../shared/appearance'
import { isLang, setLang } from '../shared/i18n'
import { IPC } from '../shared/ipc'
import { closeBar, getBarWindow } from './barWindow'
import { closeBubble, getBubbleWebContents } from './bubbleWindow'
import { isDocked, setDocked } from './dock'
import { isClipboardEnabled, setClipboardEnabled, setLinkGuard } from './features'
import { sendAppearance } from './robotWindow'
import { getSettingsWindow } from './settingsWindow'
import { setStartsWithWindows, startsWithWindows } from './startup'
import { getTabWindow } from './tabWindow'
import { getConfig, setConfig } from './store'

const listeners = new Set<() => void>()

/** Para refrescar lo que dependa de los ajustes (menú de la bandeja...). */
export function onSettingsChange(cb: () => void): void {
  listeners.add(cb)
}

export function getSettingsView(): SettingsView {
  const cfg = getConfig()
  return {
    appearance: cfg.appearance,
    personality: cfg.personality,
    clipboardEnabled: isClipboardEnabled(),
    linkGuard: cfg.linkGuard,
    startWithWindows: startsWithWindows(),
    dockTop: isDocked(),
    language: cfg.language
  }
}

export function applySettingsPatch(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const patch = raw as Record<string, unknown>
  const cfg = getConfig()

  if (patch.appearance !== undefined) {
    const appearance = validateAppearance({ ...cfg.appearance, ...(patch.appearance as object) })
    setConfig({ appearance })
    sendAppearance(appearance)
  }
  if (patch.personality !== undefined) {
    setConfig({ personality: validatePersonality({ ...cfg.personality, ...(patch.personality as object) }) })
  }
  if (typeof patch.clipboardEnabled === 'boolean') setClipboardEnabled(patch.clipboardEnabled)
  if (typeof patch.linkGuard === 'boolean') setLinkGuard(patch.linkGuard)
  if (typeof patch.startWithWindows === 'boolean') setStartsWithWindows(patch.startWithWindows)
  if (typeof patch.dockTop === 'boolean') setDocked(patch.dockTop)
  if (isLang(patch.language) && patch.language !== cfg.language) {
    setConfig({ language: patch.language })
    setLang(patch.language)
    reloadPages()
  }

  notifySettingsChanged()
}

/**
 * Las páginas leen el idioma al cargar: se recargan para que cambien sus textos.
 * El robot no tiene textos visibles y se deja tal cual (así no parpadea).
 */
function reloadPages(): void {
  closeBar()
  closeBubble()
  const pages = [getBarWindow()?.webContents, getBubbleWebContents(), getTabWindow()?.webContents, getSettingsWindow()?.webContents]
  for (const wc of pages) if (wc && !wc.isDestroyed()) wc.reload()
}

/** Avisa a la ventana de ajustes y a quien escuche (p. ej. si se cambió algo desde la bandeja). */
export function notifySettingsChanged(): void {
  getSettingsWindow()?.webContents.send(IPC.settingsChanged, getSettingsView())
  for (const cb of listeners) cb()
}
