/**
 * Control del PC: bloquear, suspender, apagar, reiniciar, barra de volumen y
 * modo oscuro de Windows. Con el prefijo "pc" se listan todas; sin prefijo,
 * escribir "bloquear" o "volumen" las ofrece. Apagar y reiniciar dejan 30 segundos
 * para cancelar.
 */
import { t } from '../shared/i18n'
import { matchScore } from './match'
import type { CommandContext, CommandModule, Outcome, Suggestion } from './types'

/** Monitor. */
export const SYSTEM_ICON = 'M4 4.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z M9 20.5h6 M12 16.5v4'
const ACCENT = '#64748b'

interface Action {
  id: string
  title: () => string
  subtitle: () => string
  /** Palabras con las que se encuentra sin prefijo. */
  words: () => string[]
  run: (ctx: CommandContext) => Outcome | Promise<Outcome>
}

const ACTIONS: Action[] = [
  {
    id: 'volume-bar',
    title: () => t('Barra de volumen', 'Volume bar'),
    subtitle: () => t('En la isla: arrástrala para subir o bajar el volumen', 'In the island: drag it to turn the volume up or down'),
    words: () => [t('volumen', 'volume'), 'volumen', 'volume', t('barra de volumen', 'volume bar')],
    run: (ctx) => ctx.system.volumeBar()
  },
  {
    id: 'lock',
    title: () => t('Bloquear el PC', 'Lock the PC'),
    subtitle: () => t('Como Windows + L', 'Like Windows + L'),
    words: () => [t('bloquear', 'lock'), 'lock', 'bloquear'],
    run: (ctx) => ctx.system.lock()
  },
  {
    id: 'sleep',
    title: () => t('Suspender', 'Sleep'),
    subtitle: () => t('El PC se duerme y se despierta tal cual', 'The PC sleeps and wakes up as it was'),
    words: () => [t('suspender', 'sleep'), 'dormir', 'sleep', 'suspender'],
    run: (ctx) => ctx.system.sleep()
  },
  {
    id: 'shutdown',
    title: () => t('Apagar el PC', 'Shut down the PC'),
    subtitle: () => t('En 30 segundos: puedes cancelarlo desde la isla', 'In 30 seconds: you can cancel it from the island'),
    words: () => [t('apagar', 'shut down'), 'shutdown', 'apagar'],
    run: (ctx) => ctx.system.shutdown(false)
  },
  {
    id: 'restart',
    title: () => t('Reiniciar el PC', 'Restart the PC'),
    subtitle: () => t('En 30 segundos: puedes cancelarlo desde la isla', 'In 30 seconds: you can cancel it from the island'),
    words: () => [t('reiniciar', 'restart'), 'restart', 'reiniciar', 'reboot'],
    run: (ctx) => ctx.system.shutdown(true)
  },
  {
    id: 'cancel',
    title: () => t('Cancelar el apagado', 'Cancel the shutdown'),
    subtitle: () => t('Si habías pedido apagar o reiniciar', 'If you asked to shut down or restart'),
    words: () => [t('cancelar apagado', 'cancel shutdown')],
    run: (ctx) => ctx.system.cancelShutdown()
  },
  {
    id: 'dark',
    title: () => t('Modo oscuro de Windows', 'Windows dark mode'),
    subtitle: () => t('Las apps y la barra de tareas en oscuro', 'Apps and the taskbar in dark'),
    words: () => [t('modo oscuro', 'dark mode'), 'oscuro', 'dark'],
    run: (ctx) => ctx.system.darkMode(true)
  },
  {
    id: 'light',
    title: () => t('Modo claro de Windows', 'Windows light mode'),
    subtitle: () => t('Las apps y la barra de tareas en claro', 'Apps and the taskbar in light'),
    words: () => [t('modo claro', 'light mode'), 'claro', 'light'],
    run: (ctx) => ctx.system.darkMode(false)
  }
]

/** Sin tildes y en minúsculas, para entender "Súbelo", "música"... */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** El texto habla del volumen ("volumen al 50", "sube el vol", "silencio"): se ofrece la barra. */
export function mentionsVolume(text: string): boolean {
  return /\bvol|silenci|\bmute\b/.test(plain(text))
}

function actionRow(action: Action, ctx: CommandContext, score?: number): Suggestion {
  return { title: action.title(), subtitle: action.subtitle(), ...(score !== undefined ? { score } : {}), run: () => action.run(ctx) }
}

export const system: CommandModule = {
  id: 'system',
  get name() {
    return t('Control del PC', 'PC control')
  },
  prefixes: ['pc', 'sistema', 'volumen', 'vol'],
  get hint() {
    return t('Bloquear, apagar, suspender, volumen y modo oscuro', 'Lock, shut down, sleep, volume and dark mode')
  },
  get placeholder() {
    return t('bloquear, apagar, volumen, modo oscuro…', 'lock, shut down, volume, dark mode…')
  },
  accent: ACCENT,
  iconPath: SYSTEM_ICON,
  global: 'ranked',
  suggest(query, ctx) {
    const q = query.trim()
    if (!q) return ACTIONS.map((a) => actionRow(a, ctx))
    // Cualquier cosa sobre el volumen ("volumen al 50", "sube el volumen", "silencio") ofrece la barra la primera.
    // Un número suelto ("30" tras el prefijo "volumen") también, pero sin prefijo puntúa bajo: suele ser una cuenta.
    const volume = mentionsVolume(q) ? 95 : /^[+-]?\s*\d{1,3}\s*%?$/.test(q) ? 40 : 0
    const ranked = ACTIONS.map((a) => ({
      a,
      score: Math.max(a.id === 'volume-bar' ? volume : 0, ...a.words().map((w) => matchScore(w, q)), matchScore(a.title(), q))
    }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
    return ranked.map(({ a, score }) => actionRow(a, ctx, score))
  }
}
