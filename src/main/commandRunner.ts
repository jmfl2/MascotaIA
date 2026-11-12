/**
 * Ejecuta los comandos de la barra en el proceso principal.
 *
 * `query` calcula las sugerencias y guarda las acciones de la última consulta;
 * al renderer solo le llega una vista serializable. `execute` recibe el índice
 * de la fila elegida y ejecuta la acción guardada: el renderer nunca envía
 * URLs, rutas ni textos que se vayan a ejecutar.
 */
import { clipboard, shell } from 'electron'
import { COMMANDS, type CommandContext, type Outcome } from '../commands'
import { t } from '../shared/i18n'
import { getClaudeKey } from './claudeKey'
import { suggestFor, type Ranked } from '../commands/engine'
import type { AppInfo, CommandMeta, ExecuteRequest, ExecuteResponse, QueryRequest, QueryResponse, ResultView } from '../shared/ipc'
import { sendToAi } from './ai/aiChat'
import { aiStatus, interpret, pullModel, refreshAiStatus, startOllama, warmUpModel } from './ai/aiService'
import { expandShortLink } from '../security/expand'
import { toast } from './bubbleWindow'
import { openSettings } from './settingsWindow'
import { getConfig } from './store'
import { robotMood } from './robotMood'
import { clipboardWatcher } from './services/clipboardWatcher'
import { launcherService } from './services/launcher'
import { notesService } from './services/notes'
import { pomodoroService } from './services/pomodoro'
import { remindersService } from './services/reminders'
import { currentShortcut } from './shortcut'

/** Abre una URL en el navegador. Los comandos ya la validaron; aquí se comprueba otra vez. */
export async function openExternalUrl(url: string): Promise<Outcome> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { kind: 'error', message: t('Dirección no válida', 'Invalid address') }
  }
  if (parsed.protocol !== 'https:') return { kind: 'error', message: t('Dirección no permitida', 'Address not allowed') }
  try {
    await shell.openExternal(parsed.href)
    return { kind: 'close', mood: 'happy' }
  } catch (err) {
    console.error('[comandos] No se pudo abrir el navegador:', err)
    return { kind: 'error', message: t('No se pudo abrir el navegador', 'Could not open the browser') }
  }
}

/** Abre un enlace que ha copiado o pegado el usuario (solo http y https). */
export async function openLink(url: string): Promise<Outcome> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { kind: 'error', message: t('Enlace no válido', 'Invalid link') }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { kind: 'error', message: t('Ese tipo de enlace no se abre', "That kind of link can't be opened") }
  try {
    await shell.openExternal(parsed.href)
    return { kind: 'close' }
  } catch {
    return { kind: 'error', message: t('No se pudo abrir el navegador', 'Could not open the browser') }
  }
}

export const commandContext: CommandContext = {
  claude: { ready: () => getClaudeKey() !== null },
  now: () => Date.now(),
  openUrl: openExternalUrl,
  copyText: (text) => clipboardWatcher.copy(text),
  clipboardText: () => clipboard.readText().catch(() => ''),
  links: {
    open: openLink,
    async expand(url) {
      const result = await expandShortLink(url)
      return result.ok
        ? { kind: 'activate', commandId: 'link', text: result.finalUrl }
        : { kind: 'error', message: result.error }
    }
  },
  openSettings: () => openSettings(),
  ai: {
    status: aiStatus,
    interpret,
    start: startOllama,
    pull: pullModel
  },
  notes: notesService,
  reminders: remindersService,
  pomodoro: pomodoroService,
  launcher: launcherService
}

let lastSeq = -1
let lastRows: Ranked[] = []

export function appInfo(): AppInfo {
  const commands: CommandMeta[] = COMMANDS.map(({ id, name, prefixes, placeholder, accent, iconPath }) => ({
    id,
    name,
    prefixes,
    placeholder,
    accent,
    iconPath
  }))
  return { shortcut: currentShortcut(), commands, robotName: getConfig().personality.name }
}

function toView({ command, suggestion: s }: Ranked): ResultView {
  return {
    title: s.title.slice(0, 300),
    subtitle: s.subtitle?.slice(0, 300),
    icon: s.icon ?? { kind: 'glyph', path: command.iconPath, accent: command.accent },
    badge: s.badge,
    disabled: s.disabled,
    secondaryLabel: s.secondary?.label,
    commandId: command.id
  }
}

export async function query(req: QueryRequest): Promise<QueryResponse> {
  // Los comandos de IA necesitan saber si Ollama está listo; sin texto basta con el último estado.
  // Entrar en uno de ellos es la señal de que vas a usar la IA: se precalienta el modelo.
  if (req.commandId && ['ai', 'summarize', 'explain'].includes(req.commandId)) {
    await refreshAiStatus()
    warmUpModel()
  }
  const rows = await suggestFor(req.commandId, req.text, commandContext)
  // Solo guardamos si sigue siendo la consulta más reciente.
  if (req.seq >= lastSeq) {
    lastSeq = req.seq
    lastRows = rows
  }
  return { seq: req.seq, items: rows.map(toView) }
}

/** Ejecuta la fila elegida y aplica los efectos (cerrar barra, ánimo del robot, bocadillo). */
export async function execute(req: ExecuteRequest, closeBar: () => void): Promise<ExecuteResponse> {
  if (req.seq !== lastSeq) return { kind: 'stale' }
  const row = lastRows[req.index]
  if (!row) return { kind: 'stale' }
  const action = req.secondary ? row.suggestion.secondary : row.suggestion
  if (!action) return { kind: 'refresh' }

  let outcome: Outcome
  try {
    outcome = await action.run()
  } catch (err) {
    console.error(`[comandos] "${row.command.id}" falló:`, err)
    outcome = { kind: 'error', message: t('Algo salió mal', 'Something went wrong') }
  }

  switch (outcome.kind) {
    case 'close':
      closeBar()
      if (outcome.mood) robotMood.flash(outcome.mood)
      if (outcome.toast) toast(outcome.toast)
      return { kind: 'close' }
    case 'error':
      robotMood.flash('confused')
      return outcome
    case 'chat':
      // La conversación la lleva el proceso principal; la barra pasa a la vista de chat.
      void sendToAi(outcome.task, outcome.text)
      return { kind: 'activate', commandId: 'ai', text: '' }
    default:
      return outcome
  }
}
