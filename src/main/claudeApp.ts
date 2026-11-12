/**
 * Abrir Claude con una pregunta ya escrita: en la app de escritorio (si está
 * instalada) o en claude.ai.
 *
 * La app de escritorio registra el esquema claude://; su enlace oficial
 * claude://claude.ai/new?q=… abre un chat nuevo con la pregunta en la caja
 * para revisarla y enviarla (no la envía sola).
 */
import { app, shell } from 'electron'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { buildWebUrl } from '../commands/web'
import { claudeWeb } from '../commands/claude'
import type { Outcome } from '../commands'
import { t } from '../shared/i18n'
import { openExternalUrl } from './commandRunner'
import { getConfig } from './store'

/** Por encima de esto (o con saltos de línea) la pregunta se recortaría: mejor pegarla. */
export const MAX_PREFILL = 500

/** Solo se recuerda el "sí": si la app se instala después, se detecta sin reiniciar. */
let installed = false

/**
 * ¿Está instalada la app de escritorio de Claude? Se le pregunta a Windows qué
 * programa abre los enlaces claude:// (la app de la Microsoft Store también
 * cuenta). Si eso no responde, se mira el registro.
 */
export function claudeAppInstalled(): boolean {
  if (installed || process.platform !== 'win32') return installed
  try {
    if (app.getApplicationNameForProtocol('claude://')) return (installed = true)
  } catch {
    /* sigue con el registro */
  }
  installed = ['HKCU', 'HKLM'].some((hive) => {
    const r = spawnSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe'), ['query', `${hive}\\Software\\Classes\\claude\\shell\\open\\command`], {
      windowsHide: true,
      timeout: 3000
    })
    return r.status === 0
  })
  return installed
}

/** Dónde se abre Claude: lo elegido en los ajustes o, si no se eligió, la app si está. */
export function claudeOpenIn(): 'web' | 'app' {
  const chosen = getConfig().claudeOpenIn
  if (chosen === 'app') return claudeAppInstalled() ? 'app' : 'web'
  if (chosen === 'web') return 'web'
  return claudeAppInstalled() ? 'app' : 'web'
}

export function canPrefill(text: string): boolean {
  return text.length <= MAX_PREFILL && !/[\r\n]/.test(text)
}

/**
 * Abre Claude con la pregunta. `inClipboard`: el texto ya está copiado, así que
 * si es largo basta con abrir y pegar.
 */
export async function openClaude(text: string, inClipboard = false): Promise<Outcome> {
  const prefill = canPrefill(text)
  const pasteToast = inClipboard ? t('Ya lo tienes copiado: pégalo con Ctrl+V', "It's already copied: paste it with Ctrl+V") : undefined

  if (claudeOpenIn() === 'app') {
    const url = prefill ? `claude://claude.ai/new?q=${encodeURIComponent(text)}` : 'claude://claude.ai/new'
    try {
      await shell.openExternal(url)
      return { kind: 'close', mood: 'happy', toast: prefill ? undefined : pasteToast }
    } catch {
      // Si la app no responde, al navegador.
    }
  }
  if (!prefill) {
    const outcome = await openExternalUrl('https://claude.ai/new')
    return outcome.kind === 'close' ? { ...outcome, toast: pasteToast } : outcome
  }
  const built = buildWebUrl(claudeWeb, text)
  return built.ok ? openExternalUrl(built.url) : { kind: 'error', message: built.error }
}
