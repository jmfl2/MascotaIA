import { t } from '../../shared/i18n'
import type { MediaAction, TabMediaView } from '../../shared/ipc'
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

// Solo el botón principal: el derecho abre el menú.
pill.addEventListener('click', (e) => {
  if (e.button === 0) api.click()
})
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  api.contextMenu()
})
