/**
 * Temporizador Pomodoro (en memoria: si se cierra la app, se pierde).
 * Al acabar la concentración empieza solo el descanso; al acabar el
 * descanso se detiene y pregunta si se quiere otro.
 */
import type { PomodoroStatus } from '../../commands'

export interface PomodoroEvents {
  /** Cada segundo mientras está activo, y con `null` al detenerse. */
  tick(status: PomodoroStatus | null, progress: number): void
  /** Ha terminado una fase. */
  phaseEnd(ended: 'focus' | 'break', status: PomodoroStatus | null): void
}

let status: PomodoroStatus | null = null
let timer: NodeJS.Timeout | null = null
/** Duraciones del último pomodoro, para repetirlo. */
let last = { focusMin: 25, breakMin: 5 }
let events: PomodoroEvents = { tick: () => {}, phaseEnd: () => {} }

function progressOf(s: PomodoroStatus, now: number): number {
  const total = s.endsAt - s.phaseStartedAt
  return total > 0 ? Math.min(1, Math.max(0, (now - s.phaseStartedAt) / total)) : 1
}

function beginPhase(phase: 'focus' | 'break', focusMin: number, breakMin: number): void {
  const now = Date.now()
  const minutes = phase === 'focus' ? focusMin : breakMin
  status = { phase, phaseStartedAt: now, endsAt: now + minutes * 60_000, focusMin, breakMin }
  timer ??= setInterval(tick, 1000)
  tick()
}

function tick(): void {
  if (!status) return
  const now = Date.now()
  if (now >= status.endsAt) {
    const ended = status.phase
    if (ended === 'focus') beginPhase('break', status.focusMin, status.breakMin)
    else clear()
    events.phaseEnd(ended, status)
    return
  }
  events.tick(status, progressOf(status, now))
}

function clear(): void {
  status = null
  if (timer) clearInterval(timer)
  timer = null
  events.tick(null, 0)
}

export const pomodoroService = {
  setEvents(e: PomodoroEvents): void {
    events = e
  },
  status: (): PomodoroStatus | null => status,
  start(focusMin: number, breakMin: number): void {
    last = { focusMin, breakMin }
    beginPhase('focus', focusMin, breakMin)
  },
  /** Otro pomodoro con las mismas duraciones que el anterior. */
  restart(): void {
    beginPhase('focus', last.focusMin, last.breakMin)
  },
  stop: clear,
  /** Pasa a la fase siguiente sin esperar. */
  skip(): void {
    if (!status) return
    beginPhase(status.phase === 'focus' ? 'break' : 'focus', status.focusMin, status.breakMin)
  }
}
