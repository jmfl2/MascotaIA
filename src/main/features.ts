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
import { notesService } from './services/notes'
import { pomodoroService } from './services/pomodoro'
import { remindersService } from './services/reminders'
import { getConfig, setConfig } from './store'
import { IPC } from '../shared/ipc'
import { t } from '../shared/i18n'
import { assistantName } from '../shared/assistants'
import { askAssistant } from './askAssistant'
import { showDropMenu } from './dropMenu'
import { isAbsolute } from 'node:path'

const SNOOZE_MS = 10 * 60_000
const LATE_THRESHOLD_MS = 60_000

// --- Recordatorios -------------------------------------------------------------

function startReminders(): void {
  remindersService.start((reminder, lateMs) => {
    robotMood.setAlert(true)
    const late = lateMs > LATE_THRESHOLD_MS ? t(` (hace ${formatDuration(lateMs)})`, ` (${formatDuration(lateMs)} ago)`) : ''
    showBubble({
      kind: 'reminder',
      title: `⏰ ${t('Recordatorio', 'Reminder')}${late}`,
      text: reminder.text,
      timeoutMs: null,
      chime: true,
      notifyIfHidden: true,
      actions: [
        { id: 'done', label: t('Hecho', 'Done'), primary: true, run: () => {} },
        {
          id: 'snooze',
          label: t('En 10 min', 'In 10 min'),
          run: () => {
            remindersService.add(reminder.text, Date.now() + SNOOZE_MS)
            toast(t('Te lo vuelvo a recordar en 10 min', "I'll remind you again in 10 min"))
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
      // Terminar un bloque de concentración de verdad (25 min o más) merece una celebración.
      robotMood.flash(ended === 'focus' && status && status.focusMin >= 25 ? 'excited' : 'happy')
      if (ended === 'focus' && status) {
        showBubble({
          kind: 'pomodoro',
          title: t('🍅 ¡Bien hecho! Toca descansar', '🍅 Well done! Time for a break'),
          text: t(`Descanso de ${status.breakMin} min. Estira las piernas.`, `${status.breakMin} min break. Stretch your legs.`),
          timeoutMs: 15_000,
          chime: true,
          notifyIfHidden: true,
          actions: [
            { id: 'skip', label: t('Saltar descanso', 'Skip break'), run: () => pomodoroService.skip() },
            { id: 'stop', label: t('Terminar', 'Finish'), run: () => pomodoroService.stop() }
          ]
        })
      } else {
        showBubble({
          kind: 'pomodoro',
          title: t('☕ Fin del descanso', '☕ Break is over'),
          text: t('¿Otro bloque de concentración?', 'Another focus block?'),
          timeoutMs: 30_000,
          chime: true,
          notifyIfHidden: true,
          actions: [
            { id: 'again', label: t('Otro pomodoro', 'Another pomodoro'), primary: true, run: () => pomodoroService.restart() },
            { id: 'no', label: t('Ahora no', 'Not now'), run: () => {} }
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
  getBarWindow()?.webContents.send(IPC.barEnterChat, 'ai')
}

const saveNote = (text: string) => ({
  id: 'note',
  label: t('Guardar nota', 'Save note'),
  run: () => {
    notesService.add(text)
    robotMood.flash('wink')
    toast(t('Nota guardada', 'Note saved'))
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

  const open = { id: 'open', label: report.verdict === 'ok' ? t('Abrir', 'Open') : t('Abrir igualmente', 'Open anyway'), primary: report.verdict === 'ok', run: () => void openLink(report.url) }
  const dontOpen = { id: 'no', label: t('No abrir', "Don't open"), primary: true, run: () => {} }

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
      text: report.shortUrl ? t(`Lleva a ${report.host}`, `Goes to ${report.host}`) : report.host,
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

  // "Preguntar a Claude" (o la IA elegida en los ajustes) con lo que se acaba de copiar.
  const ask = {
    id: 'ask',
    label: `💬 ${t('Preguntar a', 'Ask')} ${assistantName(cfg.askAi)}`,
    run: () => void askAssistant(cfg.askAi, text)
  }

  if (decision.kind === 'long') {
    const words = text.split(/\s+/).length
    showBubble({
      kind: 'clipboard',
      title: aiReady ? t('¿Te resumo esto?', 'Want me to summarize this?') : t('¿Te ayudo con esto?', 'Can I help with this?'),
      text: `${words} ${t('palabras', 'words')} · «${snippet(text, 60)}»`,
      timeoutMs: 6000,
      actions: aiReady
        ? [
            { id: 'summarize', label: t('✨ Resumir', '✨ Summarize'), primary: true, run: () => askAiAbout('summarize', text) },
            { id: 'explain', label: t('Explicar', 'Explain'), run: () => askAiAbout('explain', text) },
            ask,
            saveNote(text)
          ]
        : [{ ...ask, primary: true }, saveNote(text)]
    })
    return
  }

  const target = translateTarget(text)
  showBubble({
    kind: 'clipboard',
    title: t('¿Te ayudo con esto?', 'Can I help with this?'),
    text: `«${snippet(text)}»`,
    timeoutMs: 6000,
    actions: [
      { id: 'search', label: t('Buscar', 'Search'), primary: true, run: () => void openOrComplain('google', text) },
      {
        id: 'translate',
        label: target === 'en' ? t('Traducir al inglés', 'Translate to English') : t('Traducir', 'Translate'),
        run: () => void openOrComplain('translate', `${target}: ${text}`)
      },
      ask,
      saveNote(text),
      ...(aiReady ? [{ id: 'explain', label: t('✨ Explicar', '✨ Explain'), run: () => askAiAbout('explain', text) }] : [])
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

/** Lo soltado encima del robot: un bocadillo con qué hacer (ver dropMenu.ts). */
export function handleDroppedPaths(paths: unknown): void {
  if (!Array.isArray(paths)) return
  const valid = paths.filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length < 1000 && isAbsolute(p)).slice(0, 10)
  if (valid.length) showDropMenu(valid)
}

export function startFeatures(): void {
  startReminders()
  startPomodoro()
  refreshClipboardWatcher()
}
