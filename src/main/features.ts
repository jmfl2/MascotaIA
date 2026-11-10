/**
 * Conecta los servicios de la fase 2 con el robot y el bocadillo:
 * recordatorios, pomodoro, portapapeles inteligente y favoritos soltados.
 */
import { buildCommandUrl } from '../commands'
import { formatDuration } from '../commands/format'
import { isBarOpen } from './barWindow'
import { showBubble, toast } from './bubbleWindow'
import { openExternalUrl } from './commandRunner'
import { robotMood } from './robotMood'
import { sendPomodoro } from './robotWindow'
import { translateTarget } from './services/clipboardFilter'
import { clipboardWatcher } from './services/clipboardWatcher'
import { addFavorites } from './services/launcher'
import { notesService } from './services/notes'
import { pomodoroService } from './services/pomodoro'
import { remindersService } from './services/reminders'
import { getConfig, setConfig } from './store'

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
  pomodoroService.setEvents({
    tick: (status, progress) => sendPomodoro(status ? { phase: status.phase, progress } : null),
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

function offerClipboard(text: string): void {
  if (isBarOpen()) return
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
      {
        id: 'note',
        label: 'Guardar nota',
        run: () => {
          notesService.add(text)
          robotMood.flash('happy')
          toast('Nota guardada')
        }
      }
    ]
  })
}

export function setClipboardEnabled(enabled: boolean): void {
  setConfig({ clipboardEnabled: enabled })
  if (enabled) clipboardWatcher.start(offerClipboard)
  else clipboardWatcher.stop()
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
  if (getConfig().clipboardEnabled) clipboardWatcher.start(offerClipboard)
}
