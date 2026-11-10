/** Contexto falso en memoria para probar los comandos sin Electron. */
import type { CommandContext, LaunchTarget, Note, PomodoroStatus, Reminder } from './types'

export function fakeContext(now = new Date(2026, 10, 10, 12, 0, 0).getTime()) {
  const state = {
    opened: [] as string[],
    copied: [] as string[],
    notes: [] as Note[],
    reminders: [] as Reminder[],
    pomodoro: null as PomodoroStatus | null,
    apps: [] as LaunchTarget[],
    launched: [] as string[]
  }
  let seq = 0
  const id = () => String(++seq)

  const ctx: CommandContext = {
    now: () => now,
    openUrl: async (url) => {
      state.opened.push(url)
      return { kind: 'close', mood: 'happy' }
    },
    copyText: (text) => void state.copied.push(text),
    notes: {
      all: () => state.notes,
      add: (text) => {
        const note = { id: id(), text, createdAt: now }
        state.notes.unshift(note)
        return note
      },
      remove: (noteId) => {
        const before = state.notes.length
        state.notes = state.notes.filter((n) => n.id !== noteId)
        return state.notes.length < before
      }
    },
    reminders: {
      all: () => state.reminders,
      add: (text, dueAt) => {
        const r = { id: id(), text, dueAt, createdAt: now }
        state.reminders.push(r)
        return r
      },
      remove: (rid) => {
        const before = state.reminders.length
        state.reminders = state.reminders.filter((r) => r.id !== rid)
        return state.reminders.length < before
      }
    },
    pomodoro: {
      status: () => state.pomodoro,
      start: (focusMin, breakMin) => {
        state.pomodoro = { phase: 'focus', phaseStartedAt: now, endsAt: now + focusMin * 60_000, focusMin, breakMin }
      },
      stop: () => void (state.pomodoro = null),
      skip: () => {
        if (state.pomodoro) state.pomodoro = { ...state.pomodoro, phase: state.pomodoro.phase === 'focus' ? 'break' : 'focus' }
      }
    },
    launcher: {
      search: async (q) => state.apps.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())),
      favorites: async () => state.apps.filter((a) => a.favorite),
      open: async (targetId) => {
        state.launched.push(targetId)
        return { kind: 'close', mood: 'happy' }
      },
      removeFavorite: (targetId) => {
        const app = state.apps.find((a) => a.id === targetId)
        if (app) app.favorite = false
        return !!app
      }
    }
  }
  return { ctx, state }
}
