/**
 * Bocadillo del robot. Muestra lo que le manda el proceso principal y le
 * devuelve qué acción se pulsó. El cierre automático se pausa con el ratón
 * encima, para que dé tiempo a leer.
 */
import { animate } from 'motion'
import type { BubbleView } from '../../shared/ipc'
import { animateCrisp } from '../shared/crisp'
import { localizeDocument } from '../shared/i18nDom'
import './bubble.css'

localizeDocument()

const api = window.mascota.bubble
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const bubble = el<HTMLDivElement>('bubble')
const title = el<HTMLParagraphElement>('title')
const text = el<HTMLParagraphElement>('text')
const actions = el<HTMLDivElement>('actions')
const timer = el<HTMLDivElement>('timer')
const closeBtn = el<HTMLButtonElement>('close')

const SPRING_IN = { type: 'spring', visualDuration: 0.42, bounce: 0.35 } as const
const SPRING_OUT = { type: 'spring', visualDuration: 0.18, bounce: 0 } as const

let current: BubbleView | null = null
let remaining = 0
let deadline = 0
let countdown: number | undefined
let hovering = false
let timerAnim: ReturnType<typeof animate> | null = null

// --- Cierre automático (pausable) -------------------------------------------------
function startCountdown(): void {
  if (!current || current.timeoutMs === null || hovering || remaining <= 0) return
  const id = current.id
  deadline = performance.now() + remaining
  countdown = window.setTimeout(() => api.dismiss(id), remaining)
  timerAnim = animate(timer, { scaleX: 0 }, { duration: remaining / 1000, ease: 'linear' })
}

function pauseCountdown(): void {
  if (countdown === undefined) return
  window.clearTimeout(countdown)
  countdown = undefined
  remaining = Math.max(0, deadline - performance.now())
  timerAnim?.stop()
}

bubble.addEventListener('mouseenter', () => {
  hovering = true
  pauseCountdown()
})
bubble.addEventListener('mouseleave', () => {
  hovering = false
  startCountdown()
})

// --- Sonido suave (dos notas generadas, sin archivos de audio) ----------------------
function chime(): void {
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime
    for (const [i, freq] of [880, 1318.5].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.08, t + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t + i * 0.12)
      osc.stop(t + i * 0.12 + 0.65)
    }
    window.setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* sin audio: no pasa nada */
  }
}

// --- Mostrar / ocultar ------------------------------------------------------------
api.onShow((view) => {
  pauseCountdown()
  current = view
  bubble.className = `bubble side-${view.side} kind-${view.kind}`
  title.textContent = view.title
  text.textContent = view.text ?? ''
  actions.replaceChildren(
    ...view.actions.map((a) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = a.primary ? 'action primary' : 'action'
      button.textContent = a.label
      button.addEventListener('click', () => api.action(view.id, a.id))
      return button
    })
  )

  timer.style.display = view.timeoutMs === null ? 'none' : ''
  timer.style.transform = 'scaleX(1)'
  remaining = view.timeoutMs ?? 0

  // El proceso principal ajusta la ventana a la altura del contenido.
  api.resize(bubble.offsetHeight)

  const fromX = view.side === 'left' ? 18 : -18
  bubble.style.transformOrigin = view.side === 'left' ? '100% 50%' : '0% 50%'
  animateCrisp(bubble, { opacity: [0, 1], scale: [0.7, 1], x: [fromX, 0] }, { ...SPRING_IN, opacity: { duration: 0.15 } })
  if (view.chime) chime()
  startCountdown()
})

// Actualización en sitio (p. ej. progreso de una descarga), sin volver a animar.
api.onUpdate((patch) => {
  if (!current || current.id !== patch.id) return
  if (patch.title !== undefined) title.textContent = patch.title
  if (patch.text !== undefined) text.textContent = patch.text
  api.resize(bubble.offsetHeight)
})

api.onHide(() => {
  pauseCountdown()
  const closing = current
  current = null
  const toX = closing?.side === 'left' ? 10 : -10
  void animateCrisp(bubble, { opacity: 0, scale: 0.85, x: toX }, SPRING_OUT).finished.then(() => {
    if (!current) api.hidden() // si llegó otro mientras se cerraba, no ocultamos
  })
})

closeBtn.addEventListener('click', () => {
  if (current) api.dismiss(current.id)
})
