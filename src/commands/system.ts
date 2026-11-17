/**
 * Control del PC: bloquear, suspender, apagar, reiniciar, volumen y modo
 * oscuro de Windows. Con el prefijo "pc" se listan todas; sin prefijo, escribir
 * "bloquear" o "volumen 30" las ofrece. Apagar y reiniciar dejan 30 segundos
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
    id: 'mute',
    title: () => t('Silenciar o quitar el silencio', 'Mute or unmute'),
    subtitle: () => t('El altavoz de Windows', 'The Windows speaker'),
    words: () => [t('silencio', 'mute'), 'mute', 'silenciar', 'silencio'],
    run: (ctx) => ctx.system.volume({ kind: 'mute' })
  },
  {
    id: 'up',
    title: () => t('Subir el volumen', 'Volume up'),
    subtitle: () => t('10 % más', '10 % more'),
    words: () => [t('subir volumen', 'volume up')],
    run: (ctx) => ctx.system.volume({ kind: 'step', delta: 10 })
  },
  {
    id: 'down',
    title: () => t('Bajar el volumen', 'Volume down'),
    subtitle: () => t('10 % menos', '10 % less'),
    words: () => [t('bajar volumen', 'volume down')],
    run: (ctx) => ctx.system.volume({ kind: 'step', delta: -10 })
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

/** Sin tildes y en minúsculas, para entender "más", "Súbelo"... */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** El texto habla del volumen ("volumen al 50", "sube el vol") o es solo un número ("30", "+10"). */
export function mentionsVolume(text: string): boolean {
  const s = plain(text)
  return /\bvol/.test(s) || /^[+-]?\s*\d{1,3}\s*%?$/.test(s)
}

/**
 * Cambio de volumen pedido con palabras normales, o null:
 * "30", "volumen al 50", "pon el volumen a 30 %", "vol +10", "sube el volumen",
 * "baja el volumen 5", "volume up".
 */
export function parseVolume(text: string): { kind: 'set'; level: number } | { kind: 'step'; delta: number } | null {
  const s = plain(text)
  const num = /(\d{1,3})\s*%?/.exec(s)
  const n = num ? Number(num[1]) : null
  if (n !== null && n > 100) return null
  const up = /(^|\s)\+|\b(sub|mas\b|up\b|aument|louder)/.test(s)
  const down = /(^|\s)-|\b(baj|menos\b|down\b|reduc|quieter)/.test(s)
  if (up !== down) return { kind: 'step', delta: (up ? 1 : -1) * (n ?? 10) }
  if (n !== null) return { kind: 'set', level: n }
  return null
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
    return t('bloquear, apagar, volumen 30, modo oscuro…', 'lock, shut down, volume 30, dark mode…')
  },
  accent: ACCENT,
  iconPath: SYSTEM_ICON,
  global: 'ranked',
  suggest(query, ctx) {
    const q = query.trim()
    const rows: Suggestion[] = []
    // "volumen al 50", "sube el volumen"... sin prefijo, o "30" con el prefijo "vol".
    const vol = mentionsVolume(q) ? parseVolume(q) : null
    if (vol) {
      rows.push({
        title: vol.kind === 'set' ? t(`Poner el volumen al ${vol.level} %`, `Set the volume to ${vol.level} %`) : t(`${vol.delta > 0 ? 'Subir' : 'Bajar'} el volumen un ${Math.abs(vol.delta)} %`, `Volume ${vol.delta > 0 ? 'up' : 'down'} by ${Math.abs(vol.delta)} %`),
        subtitle: t('El altavoz de Windows', 'The Windows speaker'),
        // Un número suelto en la búsqueda sin prefijo es más bien una cuenta: puntúa bajo.
        score: /\bvol/.test(plain(q)) ? 95 : 40,
        run: () => ctx.system.volume(vol)
      })
    }
    if (!q) return ACTIONS.map((a) => actionRow(a, ctx))
    const ranked = ACTIONS.map((a) => ({ a, score: Math.max(0, ...a.words().map((w) => matchScore(w, q)), matchScore(a.title(), q)) }))
      // Si ya se entendió un cambio de volumen, sobran "Subir/Bajar el volumen".
      .filter((x) => x.score > 0 && !(vol && (x.a.id === 'up' || x.a.id === 'down')))
      .sort((x, y) => y.score - x.score)
    return [...rows, ...ranked.map(({ a, score }) => actionRow(a, ctx, score))]
  }
}
