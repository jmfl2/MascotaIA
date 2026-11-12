/**
 * "Preguntar a…" desde el bocadillo del portapapeles: manda lo que acabas de
 * copiar a la IA que elijas en los ajustes (Claude, ChatGPT, Perplexity o Gemini).
 *
 * - Claude con clave de API: responde dentro de la barra.
 * - Si no, se abre su web con el texto ya escrito. Si el texto es largo (o la web
 *   no acepta la pregunta en la dirección, como Gemini) se abre vacía: el texto
 *   ya está en el portapapeles porque lo acabas de copiar, basta con Ctrl+V.
 */
import { buildCommandUrl } from '../commands'
import { claudeWeb } from '../commands/claude'
import { buildWebUrl } from '../commands/web'
import type { Assistant } from '../shared/assistants'
import { t } from '../shared/i18n'
import { IPC } from '../shared/ipc'
import { sendToAi } from './ai/aiChat'
import { getBarWindow, openBar } from './barWindow'
import { toast } from './bubbleWindow'
import { getClaudeKey } from './claudeKey'
import { openExternalUrl } from './commandRunner'
import { robotMood } from './robotMood'

/** Páginas para pegar la pregunta a mano. */
const HOME: Record<Assistant, string> = {
  claude: 'https://claude.ai/new',
  chatgpt: 'https://chatgpt.com/',
  perplexity: 'https://www.perplexity.ai/',
  gemini: 'https://gemini.google.com/app'
}

/**
 * Por encima de esto (o con saltos de línea) la pregunta se recortaría o se
 * aplanaría en la dirección: mejor pegarla tal cual.
 */
export const MAX_PREFILL = 500

/** Dirección con la pregunta ya escrita, o null si hay que pegarla. */
export function prefillUrl(assistant: Assistant, text: string): string | null {
  if (assistant === 'gemini' || text.length > MAX_PREFILL || /[\r\n]/.test(text)) return null
  const built = assistant === 'claude' ? buildWebUrl(claudeWeb, text) : buildCommandUrl(assistant, text)
  return built.ok ? built.url : null
}

export async function askAssistant(assistant: Assistant, text: string): Promise<void> {
  if (assistant === 'claude' && getClaudeKey()) {
    void sendToAi('chat', text, 'claude')
    openBar()
    getBarWindow()?.webContents.send(IPC.barEnterChat, 'claude')
    return
  }
  const url = prefillUrl(assistant, text)
  const outcome = await openExternalUrl(url ?? HOME[assistant])
  robotMood.flash(outcome.kind === 'close' ? 'happy' : 'confused')
  if (!url && outcome.kind === 'close') toast(t('Ya lo tienes copiado: pégalo con Ctrl+V', "It's already copied: paste it with Ctrl+V"))
}
