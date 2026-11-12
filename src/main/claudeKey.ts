/**
 * Clave de API de Anthropic para que Claude responda dentro de la barra.
 *
 * Se guarda cifrada con `safeStorage` (en Windows, DPAPI: solo tu usuario de
 * Windows puede descifrarla) en config.json. Nunca se manda a las páginas: la
 * ventana de ajustes solo sabe si hay una o no. Si no hay ninguna guardada, se
 * usa ANTHROPIC_API_KEY del entorno, si existe.
 */
import { safeStorage } from 'electron'
import { getConfig, setConfig } from './store'

/** Forma de una clave de API de Anthropic. */
export const CLAUDE_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,250}$/

export type ClaudeKeySource = 'settings' | 'env' | null

function fromEnv(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  return key && CLAUDE_KEY_PATTERN.test(key) ? key : null
}

function fromSettings(): string | null {
  const enc = getConfig().claudeKeyEnc
  if (!enc || !safeStorage.isEncryptionAvailable()) return null
  try {
    const key = safeStorage.decryptString(Buffer.from(enc, 'base64'))
    return CLAUDE_KEY_PATTERN.test(key) ? key : null
  } catch {
    return null // cifrada en otro usuario u otro equipo
  }
}

export function getClaudeKey(): string | null {
  return fromSettings() ?? fromEnv()
}

export function claudeKeySource(): ClaudeKeySource {
  if (fromSettings()) return 'settings'
  return fromEnv() ? 'env' : null
}

export type SetKeyResult = 'saved' | 'removed' | 'invalid' | 'no-encryption'

/** Guarda una clave nueva ('' la borra). */
export function setClaudeKey(raw: string): SetKeyResult {
  const key = raw.trim()
  if (!key) {
    setConfig({ claudeKeyEnc: null })
    return 'removed'
  }
  if (!CLAUDE_KEY_PATTERN.test(key)) return 'invalid'
  // Sin cifrado disponible no se guarda en claro: mejor no guardarla.
  if (!safeStorage.isEncryptionAvailable()) return 'no-encryption'
  setConfig({ claudeKeyEnc: safeStorage.encryptString(key).toString('base64') })
  return 'saved'
}
