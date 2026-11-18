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
import { expandPath } from '../shared/routines'
import { getClaudeKey } from './claudeKey'
import { openClaude } from './claudeApp'
import { suggestFor, type Ranked } from '../commands/engine'
import type { AppInfo, CommandMeta, ExecuteRequest, ExecuteResponse, QueryRequest, QueryResponse, ResultView } from '../shared/ipc'
import { sendToAi } from './ai/aiChat'
import { aiStatus, interpret, pullModel, refreshAiStatus, startOllama, warmUpModel } from './ai/aiService'
import { expandShortLink } from '../security/expand'
import { showBubble, toast } from './bubbleWindow'
import { openSettings } from './settingsWindow'
import { getConfig, setConfig } from './store'
import { robotMood } from './robotMood'
import { clipboardWatcher } from './services/clipboardWatcher'
import { launcherService } from './services/launcher'
import { notesService } from './services/notes'
import { pomodoroService } from './services/pomodoro'
import { remindersService } from './services/reminders'
import { listTerminals, runInTerminal } from './services/terminals'
import { closeProcesses, listProcesses } from './services/processes'
import { cancelShutdown, lockPc, scheduleShutdown, setWindowsDarkMode, sleepPc } from './services/systemControl'
import { getVolume } from './services/volume'
import { showTabVolume } from './tabWindow'
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

/** Control del PC (services/systemControl.ts) con sus avisos. */
function systemContext(): CommandContext['system'] {
  const fail = (message: string): Outcome => ({ kind: 'error', message })
  return {
    async lock() {
      return (await lockPc()) ? { kind: 'close' } : fail(t('No se pudo bloquear', "Couldn't lock"))
    },
    async sleep() {
      // Se cierra la barra antes: al volver, que no esté abierta.
      setTimeout(() => void sleepPc(), 400)
      return { kind: 'close' }
    },
    async shutdown(restart) {
      if (!(await scheduleShutdown(restart, SHUTDOWN_DELAY_S))) return fail(t('Windows no lo ha permitido', "Windows didn't allow it"))
      showBubble({
        kind: 'reminder',
        title: restart ? t(`El PC se reinicia en ${SHUTDOWN_DELAY_S} s`, `Restarting in ${SHUTDOWN_DELAY_S} s`) : t(`El PC se apaga en ${SHUTDOWN_DELAY_S} s`, `Shutting down in ${SHUTDOWN_DELAY_S} s`),
        text: t('Guarda lo que tengas abierto', 'Save what you have open'),
        actions: [{ id: 'cancel', label: t('Cancelar', 'Cancel'), primary: true, run: () => void cancelShutdown() }],
        timeoutMs: SHUTDOWN_DELAY_S * 1000,
        notifyIfHidden: true
      })
      return { kind: 'close' }
    },
    async cancelShutdown() {
      return (await cancelShutdown()) ? { kind: 'close', toast: t('Apagado cancelado', 'Shutdown cancelled') } : fail(t('No había nada que cancelar', 'There was nothing to cancel'))
    },
    async volumeBar() {
      const now = await getVolume()
      if (!now) return fail(t('No se pudo leer el volumen', "Couldn't read the volume"))
      if (!showTabVolume(now)) return fail(t('La barra de volumen sale en la isla: enciende "Mostrar la mascota"', 'The volume bar shows in the island: turn on "Show the mascot"'))
      return { kind: 'close' }
    },
    async darkMode(dark) {
      if (!(await setWindowsDarkMode(dark))) return fail(t('No se pudo cambiar el tema de Windows', "Couldn't change the Windows theme"))
      return { kind: 'close', toast: dark ? t('🌙 Windows en modo oscuro', '🌙 Windows in dark mode') : t('☀️ Windows en modo claro', '☀️ Windows in light mode') }
    }
  }
}

/** Segundos para cancelar un apagado o reinicio. */
const SHUTDOWN_DELAY_S = 30

/** Abre todo lo de un atajo, una cosa detrás de otra. */
async function runRoutine(id: string): Promise<Outcome> {
  const routine = getConfig().routines.find((r) => r.id === id)
  if (!routine?.items.length) return { kind: 'error', message: t('Ese atajo está vacío', 'That shortcut is empty') }
  let opened = 0
  for (const item of routine.items) {
    try {
      if (item.kind === 'app') {
        if ((await launcherService.open(item.id)).kind === 'close') opened++
      } else if (item.kind === 'url') {
        // Ya validada al guardar (solo http y https).
        await shell.openExternal(item.url)
        opened++
      } else {
        // Carpetas, documentos y programas (.exe, .lnk, .bat...): como un doble clic.
        const error = await shell.openPath(expandPath(item.path, process.env))
        if (error) console.warn('[atajos] no se pudo abrir', item.path, error)
        else opened++
      }
    } catch (err) {
      console.warn('[atajos] no se pudo abrir:', err)
    }
  }
  const total = routine.items.length
  if (!opened) return { kind: 'error', message: t('No se pudo abrir nada de ese atajo', "Couldn't open anything in that shortcut") }
  return {
    kind: 'close',
    mood: 'happy',
    toast: opened === total ? t(`⚡ ${routine.name}: abierto`, `⚡ ${routine.name}: opened`) : t(`⚡ ${routine.name}: ${opened} de ${total} abiertos`, `⚡ ${routine.name}: ${opened} of ${total} opened`)
  }
}

export const commandContext: CommandContext = {
  claude: { ready: () => getClaudeKey() !== null, open: (text) => openClaude(text) },
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
  system: systemContext(),
  routines: {
    all: () => getConfig().routines,
    run: runRoutine,
    edit: () => openSettings('shortcuts')
  },
  processes: {
    list: listProcesses,
    async close(group, force) {
      if (await closeProcesses(group.pids, force)) return { kind: 'close', mood: 'wink', toast: t(`${group.name} cerrado`, `${group.name} closed`) }
      return force
        ? { kind: 'error', message: t(`No se pudo cerrar ${group.name} (quizá necesita permisos de administrador)`, `Couldn't close ${group.name} (it may need admin rights)`) }
        : { kind: 'error', message: t(`${group.name} no se cerró del todo: pulsa Supr para forzarlo`, `${group.name} didn't fully close: press Delete to force it`) }
    }
  },
  terminal: {
    list: () => listTerminals(getConfig().lastTerminal),
    run(id, command) {
      if (!runInTerminal(id, command)) return { kind: 'error', message: t('No se pudo abrir esa terminal', "Couldn't open that terminal") }
      setConfig({ lastTerminal: id })
      return { kind: 'close', mood: 'happy' }
    }
  },
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
