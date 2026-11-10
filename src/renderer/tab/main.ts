import './tab.css'

const POMODORO_COLORS = { focus: '#ff6b5a', break: '#34c759' }

const api = window.mascota.tab
const pill = document.getElementById('pill')!
const nameEl = document.getElementById('name')!
const shortcutEl = document.getElementById('shortcut')!
const root = document.documentElement

api.onNear((near) => {
  root.style.setProperty('--near', String(Math.min(1, Math.max(0, near))))
})

api.onInfo(({ name, shortcut }) => {
  nameEl.textContent = name
  shortcutEl.textContent = shortcut
  pill.setAttribute('aria-label', `Abrir ${name}`)
})

api.onPomodoro((view) => {
  pill.classList.toggle('has-pomo', !!view)
  if (!view) return
  root.style.setProperty('--pomo', String(Math.min(1, Math.max(0, view.progress))))
  root.style.setProperty('--pomo-color', POMODORO_COLORS[view.phase])
})

// Solo el botón principal: el derecho abre el menú.
pill.addEventListener('click', (e) => {
  if (e.button === 0) api.click()
})
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  api.contextMenu()
})
