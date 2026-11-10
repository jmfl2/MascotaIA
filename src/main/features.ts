/**
 * Conecta los servicios de la fase 2 con el robot y el bocadillo:
 * recordatorios, pomodoro, portapapeles inteligente y favoritos soltados.
 */
import { buildCommandUrl, type AiTask } from '../commands'
import { checkLink, reasonsText, verdictTitle, type FullReport } from '../security'
import { formatDuration } from '../commands/format'
import { sendToAi } from './ai/aiChat'
import { aiStatus } from './ai/aiService'
import { getBarWindow, isBarOpen, openBar } from './barWindow'
import { showBubble, toast } from './bubbleWindow'
import { openExternalUrl, openLink } from './commandRunner'
import { chatterMoment } from './chatter'
import { robotMood } from './robotMood'
import { sendPomodoro } from './robotWindow'
import { sendTabPomodoro } from './tabWindow'
import { translateTarget, type OfferDecision } from './services/clipboardFilter'
import { clipboardWatcher } from './services/clipboardWatcher'
import { addFavorites } from './services/launcher'
import { notesService } from './services/notes'
import { pomodoroService } from './services/pomodoro'
import { remindersService } from './services/reminders'
import { getConfig, setConfig } from './store'
import { IPC } from '../shared/ipc'

const SNOOZE_MS = 10 * 60_000
const LATE_THRESHOLD_MS = 60_000

// --- Recordatorios -------------------------------------------------------------

function startReminders(): void {
  remindersService.start((reminder, lateMs) => {
    robotMood.setAlert(true)
    const late = lateMs > LATE_THRESHOLD_MS ? ` (hace ${formatDuration(lateMs)})` : ''
    showBubble({
      kind: 'reminder',
      title: `⏰ Recordatorio${late}`,
      text: reminder.text,
      timeoutMs: null,
      chime: true,
      notifyIfHidden: true,
      actions: [
        { id: 'done', label: 'Hecho', primary: true, run: () => {} },
        {
          id: 'snooze',
          label: 'En 10 min',
          run: () => {
            remindersService.add(reminder.text, Date.now() + SNOOZE_MS)
            toast('Te lo vuelvo a recordar en 10 min')
          }
        }
      ],
      onClose: () => robotMood.setAlert(false)
    })
  })
}

// --- Pomodoro --------------------------------------------------------------------

function startPomodoro(): void {
  let halfSaid = false
  pomodoroService.setEvents({
    tick: (status, progress) => {
      const view = status ? { phase: status.phase, progress } : null
      sendPomodoro(view)
      sendTabPomodoro(view) // en modo pestaña, el progreso se ve en la pestaña
      // Modo hablador: ánimo a mitad de la concentración.
      if (status?.phase === 'focus' && progress >= 0.5 && !halfSaid) {
        halfSaid = true
        chatterMoment('pomodoro-half')
      }
      if (!status || progress < 0.5) halfSaid = false
    },
    phaseEnd: (ended, status) => {
      robotMood.flash('happy')
      if (ended === 'focus' && status) {
        showBubble({
          kind: 'pomodoro',
          title: '🍅 ¡Bien hecho! Toca descansar',
          text: `Descanso de ${status.breakMin} min. Estira las piernas.`,
          timeoutMs: 15_000,
          chime: true,
          notifyIfHidden: true,
          actions: [
            { id: 'skip', label: 'Saltar descanso', run: () => pomodoroService.skip() },
            { id: 'stop', label: 'Terminar', run: () => pomodoroService.stop() }
          ]
        })
      } else {
        showBubble({
          kind: 'pomodoro',
          title: '☕ Fin del descanso',
          text: '¿Otro bloque de concentración?',
          timeoutMs: 30_000,
          chime: true,
          notifyIfHidden: true,
          actions: [
            { id: 'again', label: 'Otro pomodoro', primary: true, run: () => pomodoroService.restart() },
            { id: 'no', label: 'Ahora no', run: () => {} }
          ]
        })
      }
    }
  })
}

// --- Portapapeles inteligente -----------------------------------------------------

function snippet(text: string, max = 70): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

async function openOrComplain(commandId: string, query: string): Promise<void> {
  const built = buildCommandUrl(commandId, query)
  const outcome = built.ok ? await openExternalUrl(built.url) : { kind: 'error' as const }
  robotMood.flash(outcome.kind === 'close' ? 'happy' : 'confused')
}

/** Abre la barra en modo chat y le pide a la IA que resuma o explique el texto. */
export function askAiAbout(task: AiTask, text: string): void {
  void sendToAi(task, text)
  openBar()
  getBarWindow()?.webContents.send(IPC.barEnterChat)
}

const saveNote = (text: string) => ({
  id: 'note',
  label: 'Guardar nota',
  run: () => {
    notesService.add(text)
    robotMood.flash('happy')
    toast('Nota guardada')
  }
})

// --- Enlaces copiados ---------------------------------------------------------------

async function offerLink(text: string): Promise<void> {
  const report: FullReport = await checkLink(text)
  if (report.verdict === 'invalid') return
  const chattiness = getConfig().personality.chattiness
  // Enlaces sin señales raras: en "normal" solo se comenta si estaba acortado
  // (para decir adónde lleva); en "discreto", nunca.
  if (report.verdict === 'ok' && (chattiness === 'discreto' || (chattiness === 'normal' && !report.shortUrl))) return

  const open = { id: 'open', label: report.verdict === 'ok' ? 'Abrir' : 'Abrir igualmente', primary: report.verdict === 'ok', run: () => void openLink(report.url) }
  const dontOpen = { id: 'no', label: 'No abrir', primary: true, run: () => {} }

  if (report.verdict === 'danger') {
    robotMood.setAlert(true)
    showBubble({
      kind: 'link',
      title: verdictTitle(report),
      text: `${report.site || report.host}\n${reasonsText(report)}`,
      timeoutMs: null,
      chime: true,
      notifyIfHidden: true,
      actions: [dontOpen, open],
      onClose: () => robotMood.setAlert(false)
    })
  } else if (report.verdict === 'caution') {
    robotMood.flash('confused')
    showBubble({
      kind: 'link',
      title: verdictTitle(report),
      text: `${report.site || report.host}\n${reasonsText(report)}`,
      timeoutMs: 15_000,
      actions: [dontOpen, open]
    })
  } else {
    showBubble({
      kind: 'link',
      title: verdictTitle(report),
      text: report.shortUrl ? `Lleva a ${report.host}` : report.host,
      timeoutMs: 6000,
      actions: [open]
    })
  }
}

function offerClipboard(decision: Extract<OfferDecision, { offer: true }>): void {
  if (isBarOpen()) return
  const { text } = decision
  const cfg = getConfig()

  if (decision.kind === 'link') {
    if (cfg.linkGuard) void offerLink(text)
    return
  }
  // Ofrecer ayuda con lo copiado: solo con el portapapeles inteligente y si no es "discreto".
  if (!cfg.clipboardEnabled || cfg.personality.chattiness === 'discreto') return
  const aiReady = aiStatus().state === 'ready'

  if (decision.kind === 'long') {
    if (!aiReady) return // sin IA no hay nada útil que ofrecer para un texto largo
    const words = text.split(/\s+/).length
    showBubble({
      kind: 'clipboard',
      title: '¿Te resumo esto?',
      text: `${words} palabras · «${snippet(text, 60)}»`,
      timeoutMs: 6000,
      actions: [
        { id: 'summarize', label: '✨ Resumir', primary: true, run: () => askAiAbout('summarize', text) },
        { id: 'explain', label: 'Explicar', run: () => askAiAbout('explain', text) },
        saveNote(text)
      ]
    })
    return
  }

  const target = translateTarget(text)
  showBubble({
    kind: 'clipboard',
    title: '¿Te ayudo con esto?',
    text: `«${snippet(text)}»`,
    timeoutMs: 6000,
    actions: [
      { id: 'search', label: 'Buscar', primary: true, run: () => void openOrComplain('google', text) },
      {
        id: 'translate',
        label: target === 'en' ? 'Traducir al inglés' : 'Traducir',
        run: () => void openOrComplain('translate', `${target}: ${text}`)
      },
      saveNote(text),
      ...(aiReady ? [{ id: 'explain', label: '✨ Explicar', run: () => askAiAbout('explain', text) }] : [])
    ]
  })
}

/** El portapapeles se vigila si está activo el portapapeles inteligente o el detector de enlaces. */
function refreshClipboardWatcher(): void {
  const cfg = getConfig()
  if (cfg.clipboardEnabled || cfg.linkGuard) clipboardWatcher.start(offerClipboard)
  else clipboardWatcher.stop()
}

export function isClipboardEnabled(): boolean {
  return getConfig().clipboardEnabled
}

export function setClipboardEnabled(enabled: boolean): void {
  setConfig({ clipboardEnabled: enabled })
  refreshClipboardWatcher()
}

export function setLinkGuard(enabled: boolean): void {
  setConfig({ linkGuard: enabled })
  refreshClipboardWatcher()
}

// --- Favoritos soltados sobre el robot --------------------------------------------

export function handleDroppedPaths(paths: unknown): void {
  if (!Array.isArray(paths)) return
  const valid = paths.filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length < 1000).slice(0, 10)
  const added = addFavorites(valid)
  if (added.length) {
    robotMood.flash('happy')
    showBubble({
      kind: 'favorite',
      title: added.length === 1 ? '⭐ Añadido a favoritos' : `⭐ ${added.length} favoritos nuevos`,
      text: `${snippet(added.join(', '), 90)}\nÁbrelo con «abrir ${snippet(added[0], 20)}».`,
      timeoutMs: 4000
    })
  } else {
    robotMood.flash('confused')
    toast('Ya estaba en favoritos')
  }
}

export function startFeatures(): void {
  startReminders()
  startPomodoro()
  refreshClipboardWatcher()
}
