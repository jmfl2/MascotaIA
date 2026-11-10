/**
 * La canción que suena en la pestaña de arriba, como la "isla" del iPhone.
 *
 * Se enseña mientras suena. Al pausar se queda un minuto (por si se reanuda) y
 * luego desaparece. Con una canción nueva, la píldora se asoma abierta un
 * momento. Solo en modo pestaña y si está activado en los ajustes.
 */
import { isDocked } from './dock'
import { MEDIA_ACTIONS, mediaAction, onNowPlayingChange, setNowPlayingEnabled, type MediaAction, type NowPlaying } from './services/nowPlaying'
import { getConfig } from './store'
import { setTabMedia } from './tabWindow'

/** Cuánto se queda a la vista una canción en pausa. */
const PAUSED_GRACE_MS = 60_000

let pausedTimer: NodeJS.Timeout | null = null
let lastTrack = ''

function show(now: NowPlaying | null): void {
  if (pausedTimer) clearTimeout(pausedTimer)
  pausedTimer = null
  if (!now) {
    lastTrack = ''
    setTabMedia(null)
    return
  }
  const track = `${now.app}|${now.title}|${now.artist}`
  const isNew = track !== lastTrack
  lastTrack = track
  setTabMedia(now, isNew && now.playing)
  if (!now.playing) {
    pausedTimer = setTimeout(() => {
      pausedTimer = null
      setTabMedia(null)
    }, PAUSED_GRACE_MS)
  }
}

export function startMusic(): void {
  onNowPlayingChange(show)
  syncMusic()
}

/** Enciende o apaga el seguimiento según los ajustes (y el modo pestaña). */
export function syncMusic(): void {
  setNowPlayingEnabled(getConfig().nowPlaying && isDocked())
}

export function musicAction(raw: unknown): void {
  if (typeof raw === 'string' && MEDIA_ACTIONS.includes(raw as MediaAction)) mediaAction(raw as MediaAction)
}

export function stopMusic(): void {
  setNowPlayingEnabled(false)
}
