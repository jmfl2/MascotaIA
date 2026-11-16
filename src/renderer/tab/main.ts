import { t } from '../../shared/i18n'
import type { BubbleView, MediaAction, TabMediaView } from '../../shared/ipc'
import { localizeDocument } from '../shared/i18nDom'
import './tab.css'

localizeDocument()

const POMODORO_COLORS = { focus: '#ff6b5a', break: '#34c759' }

const api = window.mascota.tab
const pill = document.getElementById('pill')!
const nameEl = document.getElementById('name')!
const shortcutEl = document.getElementById('shortcut')!
const art = document.getElementById('art') as HTMLImageElement
const trackTitle = document.getElementById('track-title')!
const trackArtist = document.getElementById('track-artist')!
const root = document.documentElement
let robotName = 'Mascota'
let media: TabMediaView = null

api.onNear((near) => {
  root.style.setProperty('--near', String(Math.min(1, Math.max(0, near))))
})

function updateLabel(): void {
  pill.setAttribute(
    'aria-label',
    media ? `${media.title}${media.artist ? ` · ${media.artist}` : ''}` : t(`Abrir ${robotName}`, `Open ${robotName}`)
  )
}

api.onInfo(({ name, shortcut, emoji }) => {
  robotName = name
  nameEl.textContent = emoji ? `${emoji} ${name}` : name
  shortcutEl.textContent = shortcut
  updateLabel()
})

api.onPomodoro((view) => {
  pill.classList.toggle('has-pomo', !!view)
  if (!view) return
  root.style.setProperty('--pomo', String(Math.min(1, Math.max(0, view.progress))))
  root.style.setProperty('--pomo-color', POMODORO_COLORS[view.phase])
})

function setPlaying(playing: boolean): void {
  pill.classList.toggle('is-playing', playing)
}

api.onMedia((view) => {
  media = view
  pill.classList.toggle('has-music', !!view)
  if (view) {
    trackTitle.textContent = view.title
    trackArtist.textContent = view.artist || view.app
    pill.title = view.app
    pill.classList.toggle('has-art', !!view.art)
    if (view.art) art.src = view.art
    else art.removeAttribute('src')
    setPlaying(view.playing)
  } else {
    pill.removeAttribute('title')
  }
  updateLabel()
})

// Controles de la música: no abren la barra.
for (const button of document.querySelectorAll<HTMLButtonElement>('.ctl')) {
  button.addEventListener('click', (e) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const action = button.dataset.action as MediaAction
    // Respuesta inmediata; el estado real llega en menos de un segundo.
    if (action === 'toggle') setPlaying(!pill.classList.contains('is-playing'))
    api.mediaAction(action)
  })
}

// Arrastrar archivos: al pasar por encima, el robot baja a recogerlos; también se pueden soltar aquí.
const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
let lastDragPing = 0
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
  pill.classList.add('is-drop')
  // Un aviso cada medio segundo basta para que el robot siga esperando.
  if (performance.now() - lastDragPing > 500) {
    lastDragPing = performance.now()
    api.dragOver()
  }
})
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) pill.classList.remove('is-drop')
})
window.addEventListener('drop', (e) => {
  e.preventDefault()
  pill.classList.remove('is-drop')
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) api.dropFiles(files)
})

// --- Avisos dentro de la isla (como la Dynamic Island del iPhone) -----------------------
const ALERT_WIDTH = 380
const alertEl = document.getElementById('alert')!
const alertInner = document.getElementById('alert-inner')!
const alertTitle = document.getElementById('alert-title')!
const alertText = document.getElementById('alert-text')!
const alertActions = document.getElementById('alert-actions')!
const alertTimer = document.getElementById('alert-timer')!
let alert: BubbleView | null = null
let remaining = 0
let deadline = 0
let countdown: number | undefined
let hoveringAlert = false
let hideTimer: number | undefined

/** Ancho mínimo de la isla con un aviso corto ("Nota guardada"). */
const ALERT_MIN_WIDTH = 220

/**
 * Mide el aviso y agranda la isla hasta ese tamaño (el proceso principal lo usa
 * para los clics). Los avisos cortos, sin texto ni botones, se quedan estrechos.
 */
function fitAlert(): void {
  let width = ALERT_WIDTH
  if (alertEl.classList.contains('is-quiet')) {
    alertEl.style.width = 'max-content'
    width = Math.min(ALERT_WIDTH, Math.max(ALERT_MIN_WIDTH, Math.ceil(alertEl.offsetWidth)))
    alertEl.style.width = ''
  }
  root.style.setProperty('--alert-w', `${width}px`)
  const height = Math.ceil(alertInner.offsetHeight + (alert?.timeoutMs === null ? 0 : 4))
  root.style.setProperty('--alert-h', `${height}px`)
  api.alertSize(width, height)
}

function startCountdown(): void {
  if (!alert || alert.timeoutMs === null || hoveringAlert || remaining <= 0) return
  const id = alert.id
  deadline = performance.now() + remaining
  countdown = window.setTimeout(() => api.alertDismiss(id), remaining)
  alertTimer.style.transition = `transform ${remaining}ms linear`
  alertTimer.style.transform = 'scaleX(0)'
}

function pauseCountdown(): void {
  if (countdown === undefined) return
  window.clearTimeout(countdown)
  countdown = undefined
  remaining = Math.max(0, deadline - performance.now())
  // Congela la barrita donde está.
  const progress = alert?.timeoutMs ? remaining / alert.timeoutMs : 0
  alertTimer.style.transition = 'none'
  alertTimer.style.transform = `scaleX(${progress})`
}

alertEl.addEventListener('mouseenter', () => {
  hoveringAlert = true
  pauseCountdown()
})
alertEl.addEventListener('mouseleave', () => {
  hoveringAlert = false
  startCountdown()
})
// Hacer clic en el aviso no abre la barra (solo sus botones hacen algo).
alertEl.addEventListener('click', (e) => e.stopPropagation())
document.getElementById('alert-close')!.addEventListener('click', () => {
  if (alert) api.alertDismiss(alert.id)
})

/** Dos notas suaves generadas (sin archivos de audio), como el bocadillo. */
function chime(): void {
  try {
    const ctx = new AudioContext()
    const t0 = ctx.currentTime
    for (const [i, freq] of [880, 1318.5].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t0 + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.08, t0 + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + i * 0.12)
      osc.stop(t0 + i * 0.12 + 0.65)
    }
    window.setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* sin audio: no pasa nada */
  }
}

api.onAlert((view) => {
  pauseCountdown()
  window.clearTimeout(hideTimer)
  alert = view
  if (!view) {
    // Primero se desvanece el contenido y luego la isla vuelve a su tamaño.
    alertEl.classList.remove('is-shown')
    hideTimer = window.setTimeout(() => {
      pill.classList.remove('has-alert')
      alertEl.hidden = true
    }, 160)
    return
  }
  alertTitle.textContent = view.title
  alertText.textContent = view.text ?? ''
  alertText.hidden = !view.text
  alertActions.replaceChildren(
    ...view.actions.map((a) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = a.primary ? 'alert-action primary' : 'alert-action'
      button.textContent = a.label
      button.addEventListener('click', () => api.alertAction(view.id, a.id))
      return button
    })
  )
  alertActions.hidden = view.actions.length === 0
  alertEl.classList.toggle('is-quiet', view.actions.length === 0 && !view.text)
  alertTimer.hidden = view.timeoutMs === null
  alertTimer.style.transition = 'none'
  alertTimer.style.transform = 'scaleX(1)'
  remaining = view.timeoutMs ?? 0

  alertEl.hidden = false
  fitAlert()
  pill.classList.add('has-alert')
  requestAnimationFrame(() => alertEl.classList.add('is-shown'))
  if (view.chime) chime()
  // La barrita empieza a contar en el siguiente fotograma (para que se anime).
  requestAnimationFrame(() => requestAnimationFrame(startCountdown))
})

api.onAlertUpdate((patch) => {
  if (!alert || alert.id !== patch.id) return
  if (patch.title !== undefined) alertTitle.textContent = patch.title
  if (patch.text !== undefined) {
    alertText.textContent = patch.text
    alertText.hidden = !patch.text
  }
  fitAlert()
})

// Solo el botón principal: el derecho abre el menú.
pill.addEventListener('click', (e) => {
  if (e.button === 0 && !pill.classList.contains('has-alert')) api.click()
})
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  api.contextMenu()
})
