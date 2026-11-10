/**
 * Lee y aplica los ajustes que cambia la ventana de ajustes. Todo lo que llega
 * se valida aquí (aunque la ventana sea nuestra, por principio).
 */
import { validateAppearance, validatePersonality, type SettingsView } from '../shared/appearance'
import { IPC } from '../shared/ipc'
import { isClipboardEnabled, setClipboardEnabled, setLinkGuard } from './features'
import { sendAppearance } from './robotWindow'
import { getSettingsWindow } from './settingsWindow'
import { setStartsWithWindows, startsWithWindows } from './startup'
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
    startWithWindows: startsWithWindows()
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

  notifySettingsChanged()
}

/** Avisa a la ventana de ajustes y a quien escuche (p. ej. si se cambió algo desde la bandeja). */
export function notifySettingsChanged(): void {
  getSettingsWindow()?.webContents.send(IPC.settingsChanged, getSettingsView())
  for (const cb of listeners) cb()
}
