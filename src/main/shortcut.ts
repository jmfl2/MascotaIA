/**
 * Atajo global para abrir la barra. Se puede cambiar desde la bandeja
 * (atajos predefinidos) o escribiendo cualquier acelerador de Electron en
 * "shortcut" dentro de %APPDATA%/mascota/config.json.
 */
import { globalShortcut } from 'electron'
import { DEFAULT_SHORTCUT, getConfig, setConfig } from './store'

export const SHORTCUT_PRESETS = ['Control+Space', 'Alt+Space', 'Control+Shift+Space', 'Control+Alt+Space'] as const

let current: string | null = null

/**
 * Registra el atajo. Si está ocupado por otra app (o es inválido), vuelve
 * al anterior o al de por defecto. Devuelve true si se registró el pedido.
 */
export function registerShortcut(accelerator: string, onTrigger: () => void): boolean {
  if (current) globalShortcut.unregister(current)

  if (tryRegister(accelerator, onTrigger)) {
    current = accelerator
    setConfig({ shortcut: accelerator })
    return true
  }

  console.warn(`[atajo] No se pudo registrar "${accelerator}"`)
  for (const fallback of [current, DEFAULT_SHORTCUT, ...SHORTCUT_PRESETS]) {
    if (fallback && fallback !== accelerator && tryRegister(fallback, onTrigger)) {
      current = fallback
      return false
    }
  }
  current = null
  return false
}

function tryRegister(accelerator: string, onTrigger: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, onTrigger)
  } catch {
    return false // acelerador con formato inválido
  }
}

/** Atajo activo ahora mismo (o el configurado si aún no hay ninguno). */
export function currentShortcut(): string {
  return current ?? getConfig().shortcut
}
