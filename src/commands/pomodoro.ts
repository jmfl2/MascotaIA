import { formatCountdown } from './format'
import type { CommandModule, Suggestion } from './types'

const TOMATO_ICON = 'M12 7.5c4.4 0 7.5 2.9 7.5 6.5s-3.4 6.5-7.5 6.5S4.5 17.6 4.5 14s3.1-6.5 7.5-6.5z M12 7.5V4.5 M9 6l3 1.5l3-1.5'
const STOP_ICON = 'M7 7h10v10H7z'
const SKIP_ICON = 'M6 6.5l8 5.5l-8 5.5z M17 6.5v11'
const ACCENT = '#ef4444'

export const DEFAULT_FOCUS_MIN = 25
export const DEFAULT_BREAK_MIN = 5

/** "50/10" -> { focus: 50, break: 10 }; "40" -> { focus: 40, break: 5 } */
export function parsePomodoro(q: string): { focusMin: number; breakMin: number } | null {
  const m = /^(\d{1,3})(?:\s*\/\s*(\d{1,3}))?$/.exec(q.trim())
  if (!m) return null
  const focusMin = Number(m[1])
  const breakMin = m[2] === undefined ? DEFAULT_BREAK_MIN : Number(m[2])
  if (focusMin < 1 || focusMin > 180 || breakMin < 1 || breakMin > 60) return null
  return { focusMin, breakMin }
}

/** Pomodoro: "pomo" empieza 25/5, "pomo 50/10" a medida; si ya hay uno, permite detenerlo o saltar de fase. */
export const pomodoro: CommandModule = {
  id: 'pomodoro',
  name: 'Pomodoro',
  prefixes: ['pomo', 'pomodoro'],
  hint: 'Temporizador de concentración',
  placeholder: '25/5 por defecto · prueba 50/10',
  accent: ACCENT,
  iconPath: TOMATO_ICON,
  suggest(query, ctx) {
    const status = ctx.pomodoro.status()
    const q = query.trim().toLowerCase()

    if (status) {
      const left = formatCountdown(status.endsAt - ctx.now())
      const focus = status.phase === 'focus'
      return [
        {
          title: `${focus ? 'Concentración' : 'Descanso'} · quedan ${left}`,
          subtitle: `Pomodoro ${status.focusMin}/${status.breakMin} · Intro lo detiene`,
          icon: { kind: 'glyph', path: STOP_ICON, accent: '#64748b' },
          run: () => {
            ctx.pomodoro.stop()
            return { kind: 'close', toast: 'Pomodoro detenido' }
          }
        },
        {
          title: focus ? 'Saltar al descanso' : 'Volver a concentrarse',
          subtitle: focus ? `Empieza ya el descanso de ${status.breakMin} min` : `Empieza otro bloque de ${status.focusMin} min`,
          icon: { kind: 'glyph', path: SKIP_ICON, accent: '#64748b' },
          run: () => {
            ctx.pomodoro.skip()
            return { kind: 'close', mood: 'happy' }
          }
        }
      ] satisfies Suggestion[]
    }

    const parsed = q ? parsePomodoro(q) : { focusMin: DEFAULT_FOCUS_MIN, breakMin: DEFAULT_BREAK_MIN }
    if (!parsed) {
      return [
        {
          title: 'Formato: minutos de concentración / descanso',
          subtitle: 'pomo · pomo 50/10 · pomo 40',
          disabled: true,
          run: () => ({ kind: 'error', message: 'Usa minutos: 25/5, 50/10…' })
        }
      ]
    }
    return [
      {
        title: `Empezar pomodoro de ${parsed.focusMin} min`,
        subtitle: `Luego, descanso de ${parsed.breakMin} min${q ? '' : ' · prueba "pomo 50/10"'}`,
        run: () => {
          ctx.pomodoro.start(parsed.focusMin, parsed.breakMin)
          return { kind: 'close', mood: 'happy', toast: `¡A concentrarse! ${parsed.focusMin} min` }
        }
      }
    ]
  }
}
